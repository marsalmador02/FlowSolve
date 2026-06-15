// eval.rs — expression evaluator for goals and constraints.
//
// Expression language supported:
//   sum x[i]*item[i].value over i=(1:N)   — weighted sum over a range
//   item[i].weight                         — class attribute access (1-based)
//   cost[i, assignment[i]]                 — matrix access (1-based row, col)
//   x[i]                                  — variable access (1-based)
//   N, MaxWeight                           — problem parameters
//   +  -  *                               — arithmetic
//   <=  >=  =  (and chained <=)           — comparisons

use anyhow::{anyhow, bail, Result};

use crate::problem::Problem;
use crate::solution::Solution;

// The loop index context: when evaluating inside `sum ... over i=(1:N)`,
// this carries ("i", current_value) so sub-expressions can resolve `i`.
type IdxCtx<'a> = Option<(&'a str, usize)>;

/// Evaluate a boolean constraint expression.
pub fn eval_constraint(expr: &str, p: &Problem, s: &Solution) -> Result<bool> {
    // Try each operator. split() gives 2 parts for "a <= b", 3 for "a <= b <= c".
    for op in ["<=", ">="] {
        let parts: Vec<&str> = expr.split(op).collect();
        match parts.len() {
            2 => {
                let l = eval_numeric(parts[0], p, s)?;
                let r = eval_numeric(parts[1], p, s)?;
                return if op == "<=" { Ok(l <= r) } else { Ok(l >= r) };
            }
            3 => {
                let a = eval_numeric(parts[0], p, s)?;
                let b = eval_numeric(parts[1], p, s)?;
                let c = eval_numeric(parts[2], p, s)?;
                return if op == "<=" { Ok(a <= b && b <= c) } else { Ok(a >= b && b >= c) };
            }
            _ => {}
        }
    }

    if let Some((lhs, rhs)) = expr.split_once('=') {
        let l = eval_numeric(lhs, p, s)?;
        let r = eval_numeric(rhs, p, s)?;
        return Ok(l == r);
    }

    bail!("Unsupported constraint operator in '{}'", expr)
}

/// Evaluate a numeric expression and return its value.
pub fn eval_numeric(expr: &str, p: &Problem, s: &Solution) -> Result<f64> {
    eval_expr(expr.trim(), p, s, None)
}

// Core recursive evaluator.
//
// `idx_ctx` holds the current loop variable binding when called from inside a
// `sum` body — e.g. Some(("i", 3)) means the symbol "i" resolves to 3.
// It is passed through unchanged to all recursive calls.
//
// Two string forms are used:
//   `expr` — original string with spaces, used for `sum` detection (spaces matter for " over ")
//   `e`    — spaces removed, used for everything else (operators, literals, access expressions)
fn eval_expr(expr: &str, p: &Problem, s: &Solution, idx_ctx: IdxCtx) -> Result<f64> {
    // `sum` must be detected before removing spaces because it uses " over " as a delimiter.
    if let Some(result) = eval_sum(expr, p, s)? {
        return Ok(result);
    }

    // Arithmetic — evaluate left to right by splitting at top-level operators.
    if let Some(parts) = split_at(expr, '+', false) {
        return parts.iter().map(|part| eval_expr(part, p, s, idx_ctx)).sum();
    }
    if let Some(parts) = split_at(expr, '-', true) {
        let mut iter = parts.iter();
        let first = iter.next().ok_or_else(|| anyhow!("Empty expression"))?;
        let mut acc = eval_expr(first, p, s, idx_ctx)?;
        for part in iter {
            acc -= eval_expr(part, p, s, idx_ctx)?;
        }
        return Ok(acc);
    }
    if let Some(parts) = split_at(expr, '*', false) {
        let mut product = 1.0_f64;
        for part in parts {
            product *= eval_expr(part, p, s, idx_ctx)?;
        }
        return Ok(product);
    }

    // Numeric literal.
    if let Ok(v) = expr.parse::<f64>() {
        return Ok(v);
    }

    // Problem parameter (e.g. N, MaxWeight).
    if let Some(&v) = p.params.get(expr) {
        return Ok(v);
    }

    // Variable access: x[i]
    let var_prefix = format!("{}[", p.var_name);
    if expr.starts_with(var_prefix.as_str()) && expr.ends_with(']') {
        let inside = &expr[var_prefix.len()..expr.len() - 1];
        let idx = eval_index(inside, p, s, idx_ctx)?;
        return p.var_at(s, idx);
    }

    // Class attribute access: item[i].weight
    if let Some((left, attr)) = expr.split_once("].") {
        if let Some((class, idx_expr)) = left.split_once('[') {
            let idx = eval_index(idx_expr, p, s, idx_ctx)?;
            return p.class_attr_at(class, attr, idx);
        }
    }

    // Matrix access: cost[i,j]  or  distance[city[i], city[i+1]]
    if let Some((class, rest)) = expr.split_once('[') {
        if rest.ends_with(']') {
            let inside = &rest[..rest.len() - 1];
            if let Some(parts) = split_at(inside, ',', false) {
                if parts.len() == 2 {
                    let row = eval_index(parts[0], p, s, idx_ctx)?;
                    let col = eval_index(parts[1], p, s, idx_ctx)?;
                    return p.matrix_at(class, row, col);
                }
            }
        }
    }

    bail!("Cannot evaluate expression fragment: '{}'", expr)
}

// Evaluate a `sum <term> over <var>=(<lo>:<hi>)` expression.
// Returns None if the expression does not start with "sum" (not an error).
// Returns Some(total) on success.
fn eval_sum(expr: &str, p: &Problem, s: &Solution) -> Result<Option<f64>> {
    let Some(rest) = expr.strip_prefix("sum") else {
        return Ok(None);
    };

    let rest = rest.trim();
    let Some((term, over_part)) = rest.split_once(" over ") else {
        return Ok(None);
    };

    // Parse "i=(1:N)" or "i=(1:N-1)"
    let (var, bounds_str) = over_part.split_once('=')
        .ok_or_else(|| anyhow!("Expected '=' in sum range, got '{}'", over_part))?;

    let bounds_inner = bounds_str.trim()
        .strip_prefix('(').ok_or_else(|| anyhow!("Expected '(' in sum bounds"))?
        .split_once(')').ok_or_else(|| anyhow!("Expected ')' in sum bounds"))?;

    let (range_raw, tail) = bounds_inner;

    let (lo_raw, hi_raw) = range_raw.split_once(':')
        .ok_or_else(|| anyhow!("Expected ':' in sum range '{}'", range_raw))?;

    let lo = eval_expr(lo_raw.trim(), p, s, None)? as i64;
    let hi = eval_expr(hi_raw.trim(), p, s, None)? as i64;

    let mut total = 0.0;
    let var = var.trim();
    for i in lo.min(hi)..=lo.max(hi) {
        total += eval_expr(term.trim(), p, s, Some((var, i as usize)))?;
    }

    // Optional continuation after the closing paren: "+ distance[city[N], city[1]]"
    let tail = tail.trim();
    if tail.is_empty() {
        return Ok(Some(total));
    }
    if let Some(rest) = tail.strip_prefix('+') {
        return Ok(Some(total + eval_expr(rest.trim(), p, s, None)?));
    }
    if let Some(rest) = tail.strip_prefix('-') {
        return Ok(Some(total - eval_expr(rest.trim(), p, s, None)?));
    }

    bail!("Unexpected continuation after sum: '{}'", tail)
}

// Evaluate an index expression (always resolves to a 1-based usize).
//
// Handles:
//   3          — integer literal
//   i          — loop variable
//   i+1, i-1  — loop variable ± offset
//   N          — problem parameter
//   x[k]       — variable value used as index (e.g. assignment[i] in TSP/assignment)
fn eval_index(expr: &str, p: &Problem, s: &Solution, idx_ctx: IdxCtx) -> Result<usize> {
    let e = expr.trim().replace(' ', "");

    if let Ok(v) = e.parse::<i64>() {
        if v < 1 { bail!("Index must be >= 1, got {}", v); }
        return Ok(v as usize);
    }

    if let Some((sym, i)) = idx_ctx {
        if e == sym {
            return Ok(i);
        }
        // sym+offset or sym-offset
        for (split_char, sign) in [('+', 1i64), ('-', -1i64)] {
            if let Some((a, b)) = e.split_once(split_char) {
                if a == sym {
                    let offset: i64 = b.parse()?;
                    let v = i as i64 + sign * offset;
                    if v < 1 { bail!("Index out of range: {}", v); }
                    return Ok(v as usize);
                }
            }
        }
    }

    if let Some(&v) = p.params.get(&e) {
        let v = v as i64;
        if v < 1 { bail!("Parameter '{}' used as index must be >= 1", e); }
        return Ok(v as usize);
    }

    // Variable value used as an index — e.g. assignment[i] in cost[i, assignment[i]]
    let var_prefix = format!("{}[", p.var_name);
    if e.starts_with(var_prefix.as_str()) && e.ends_with(']') {
        let inside = e.trim_start_matches(var_prefix.as_str()).trim_end_matches(']');
        let pos = eval_index(inside, p, s, idx_ctx)?;
        return Ok(p.var_at(s, pos)? as usize);
    }

    bail!("Cannot resolve index expression: '{}'", expr)
}

// Split `expr` at every top-level occurrence of `op` (not inside brackets).
// If `skip_leading` is true, a `-` at position 0 is left alone (unary minus).
// Returns None if `op` does not appear at the top level.
fn split_at<'a>(expr: &'a str, op: char, skip_leading: bool) -> Option<Vec<&'a str>> {
    let mut depth = 0i32;
    let mut parts = Vec::new();
    let mut last = 0;
    let mut found = false;

    for (i, c) in expr.char_indices() {
        match c {
            '(' | '[' => depth += 1,
            ')' | ']' => depth -= 1,
            _ => {}
        }
        if depth == 0 && c == op && !(skip_leading && i == 0) {
            parts.push(&expr[last..i]);
            last = i + 1;
            found = true;
        }
    }

    if found {
        parts.push(&expr[last..]);
        Some(parts)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load(json: &str) -> Problem {
        let v: serde_json::Value = serde_json::from_str(json).unwrap();
        Problem::try_from(v).unwrap()
    }

    #[test]
    fn knapsack_goal_and_constraint() {
        let p = load(include_str!("../../examples/knapsack.json"));
        let selected = Solution::Vector(vec![1.0, 1.0, 1.0, 1.0, 0.0]);
        let goals = p.eval_goals(&selected).unwrap();
        assert!(goals[0] > 0.0);
        assert!(p.is_feasible(&selected).unwrap());

        let all = Solution::Vector(vec![1.0; p.var_size()]);
        assert!(!p.is_feasible(&all).unwrap());
    }

    #[test]
    fn tsp_goal_evaluates() {
        let p = load(include_str!("../../examples/tsp.json"));
        let sol = Solution::Permutation(vec![0, 1, 2, 3]);
        let goals = p.eval_goals(&sol).unwrap();
        assert!((goals[0] - 75.0).abs() < 1e-6, "expected 75, got {}", goals[0]);
    }

    #[test]
    fn chained_comparison() {
        let p = load(include_str!("../../examples/knapsack.json"));
        let sol = Solution::Vector(vec![0.0; p.var_size()]);
        // "0 <= 0 <= 1" should pass
        assert!(eval_constraint("0 <= 0 <= 1", &p, &sol).unwrap());
        // "0 <= 2 <= 1" should fail
        assert!(!eval_constraint("0 <= 2 <= 1", &p, &sol).unwrap());
    }
}