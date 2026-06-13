// eval.rs
//
// Expression evaluator for goals and constraints.
//
// Supports the compact expression language used by the problem schema:
//   - numeric literals and problem parameters         e.g. 42, N
//   - variable access with 1-based index              e.g. x[i]
//   - class attribute access                          e.g. item[i].weight
//   - matrix access                                   e.g. d[i,j]
//   - sum over a range                                e.g. sum x[i]*item[i].weight over i=(1:N)
//   - arithmetic: +  -  *                             e.g. 3*x[1] + x[2]
//   - comparisons: <=  >=  =   (and chained <=)       e.g. 1 <= x[1] <= N
//
// Replaces: evaluation/expr.rs  (logic unchanged, imports updated)

use anyhow::{anyhow, bail, Result};

use crate::problem::Problem;
use crate::solution::Solution;

// ── Public entry points ───────────────────────────────────────────────────────

/// Evaluate a boolean constraint expression.
pub(crate) fn eval_constraint(expr: &str, p: &Problem, s: &Solution) -> Result<bool> {
    // Chained <=  (e.g. "0 <= x[1] <= N")
    if expr.contains("<=") {
        let parts: Vec<&str> = expr.split("<=").map(str::trim).collect();
        if parts.len() == 3 {
            let a = eval_numeric(parts[0], p, s)?;
            let b = eval_numeric(parts[1], p, s)?;
            let c = eval_numeric(parts[2], p, s)?;
            return Ok(a <= b && b <= c);
        }
    }

    if let Some((lhs, rhs)) = expr.split_once("<=") {
        return Ok(eval_numeric(lhs.trim(), p, s)? <= eval_numeric(rhs.trim(), p, s)?);
    }

    // Chained >=
    if expr.contains(">=") {
        let parts: Vec<&str> = expr.split(">=").map(str::trim).collect();
        if parts.len() == 3 {
            let a = eval_numeric(parts[0], p, s)?;
            let b = eval_numeric(parts[1], p, s)?;
            let c = eval_numeric(parts[2], p, s)?;
            return Ok(a >= b && b >= c);
        }
    }

    if let Some((lhs, rhs)) = expr.split_once(">=") {
        return Ok(eval_numeric(lhs.trim(), p, s)? >= eval_numeric(rhs.trim(), p, s)?);
    }

    if let Some((lhs, rhs)) = expr.split_once('=') {
        let l = eval_numeric(lhs.trim(), p, s)?;
        let r = eval_numeric(rhs.trim(), p, s)?;
        return Ok((l - r).abs() < 1e-12);
    }

    bail!("Unsupported constraint operator in '{}'", expr)
}

/// Evaluate a numeric expression.
pub(crate) fn eval_numeric(expr: &str, p: &Problem, s: &Solution) -> Result<f64> {
    eval_scalar(expr.trim(), p, s, None)
}

// ── Recursive scalar evaluator ────────────────────────────────────────────────

// `idx_ctx` carries the current loop variable when inside a `sum` body:
// Some(("i", 3)) means the symbol "i" currently equals 3.
fn eval_scalar(
    expr: &str,
    p: &Problem,
    s: &Solution,
    idx_ctx: Option<(&str, usize)>,
) -> Result<f64> {
    let orig = expr.trim();

    // `sum` must be tried first so the loop variable stays scoped to its body.
    if let Some(result) = try_eval_sum(orig, p, s)? {
        return Ok(result);
    }

    // Strip a single layer of outer parentheses.
    let e = {
        let e = orig.replace(' ', "");
        if e.starts_with('(') && e.ends_with(')') && e.len() >= 2 {
            e[1..e.len() - 1].to_string()
        } else {
            e
        }
    };

    // Addition — split at top-level '+' and sum the parts.
    if let Some(parts) = split_top_level(&e, '+') {
        let mut total = 0.0;
        for part in parts {
            total += eval_scalar(part, p, s, idx_ctx)?;
        }
        return Ok(total);
    }

    // Subtraction — split at top-level '-' (ignoring a leading unary minus).
    if let Some(parts) = split_top_level_minus(&e) {
        let mut iter = parts.into_iter();
        let first = iter.next().ok_or_else(|| anyhow!("Empty subtraction"))?;
        let mut acc = eval_scalar(&first, p, s, idx_ctx)?;
        for part in iter {
            acc -= eval_scalar(&part, p, s, idx_ctx)?;
        }
        return Ok(acc);
    }

    // Multiplication — split at top-level '*' and multiply.
    if let Some(parts) = split_top_level(&e, '*') {
        let mut total = 1.0;
        for part in parts {
            total *= eval_scalar(part, p, s, idx_ctx)?;
        }
        return Ok(total);
    }

    // Numeric literal.
    if let Ok(v) = e.parse::<f64>() {
        return Ok(v);
    }

    // Problem parameter.
    if let Some(&v) = p.params.get(&e) {
        return Ok(v);
    }

    // Variable access: x[i]
    let var_prefix = format!("{}[", p.var_name);
    if e.starts_with(&var_prefix) && e.ends_with(']') {
        let inside = &e[var_prefix.len()..e.len() - 1];
        let idx = eval_index(inside, p, s, idx_ctx)?;
        return p.var_at(s, idx);
    }

    // Class attribute access: item[i].weight
    if let Some((left, attr)) = e.split_once("].") {
        if let Some((class, idx_expr)) = left.split_once('[') {
            let idx = eval_index(idx_expr, p, s, idx_ctx)?;
            return p.class_attr_at(class, attr, idx);
        }
    }

    // Matrix access: d[i,j]
    if let Some((class, rest)) = e.split_once('[') {
        if rest.ends_with(']') {
            let inside = &rest[..rest.len() - 1];
            if let Some(parts) = split_top_level(inside, ',') {
                if parts.len() >= 2 {
                    let row = eval_index(parts[0], p, s, idx_ctx)?;
                    let col = eval_index(parts[1], p, s, idx_ctx)?;
                    return p.matrix_at(class, row, col);
                }
            }
        }
    }

    bail!("Unsupported expression: '{}'", expr)
}

// ── Sum expression ────────────────────────────────────────────────────────────

/// Try to parse and evaluate a `sum <term> over <var>=(<a>:<b>)` expression.
///
/// Returns `Ok(None)` when the expression does not start with `sum`, so the
/// caller can fall through to the rest of the grammar.
fn try_eval_sum(expr: &str, p: &Problem, s: &Solution) -> Result<Option<f64>> {
    let Some(rest) = expr.strip_prefix("sum") else {
        return Ok(None);
    };

    let rest = rest.trim();
    let Some((term, over_part)) = rest.split_once(" over ") else {
        return Ok(None);
    };

    let (idx_name, range_and_tail) = over_part
        .split_once('=')
        .ok_or_else(|| anyhow!("Malformed sum range in '{}'", expr))?;

    let idx_name = idx_name.trim();
    let after_open = range_and_tail
        .trim()
        .strip_prefix('(')
        .ok_or_else(|| anyhow!("Malformed sum bounds in '{}'", expr))?;

    let close = after_open
        .find(')')
        .ok_or_else(|| anyhow!("Malformed sum bounds in '{}'", expr))?;

    let range_raw = &after_open[..close];
    let tail = after_open[close + 1..].trim();

    let (a_raw, b_raw) = range_raw
        .split_once(':')
        .ok_or_else(|| anyhow!("Malformed sum bounds in '{}'", expr))?;

    let a = eval_scalar(a_raw.trim(), p, s, None)? as i64;
    let b = eval_scalar(b_raw.trim(), p, s, None)? as i64;

    let mut total = 0.0;
    for i in a.min(b)..=a.max(b) {
        total += eval_scalar(term.trim(), p, s, Some((idx_name, i as usize)))?;
    }

    if tail.is_empty() {
        return Ok(Some(total));
    }
    if let Some(rest_tail) = tail.strip_prefix('+') {
        return Ok(Some(total + eval_scalar(rest_tail.trim(), p, s, None)?));
    }
    if let Some(rest_tail) = tail.strip_prefix('-') {
        return Ok(Some(total - eval_scalar(rest_tail.trim(), p, s, None)?));
    }

    bail!("Malformed sum tail in '{}': expected '+' or '-'", expr)
}

// ── Index expression evaluator ────────────────────────────────────────────────

/// Evaluate a 1-based index expression used inside `x[...]`, `item[...]`, etc.
///
/// Handles: integer literals, the current loop variable, loop variable ± offset,
/// problem parameters, and nested variable reads.
fn eval_index(
    expr: &str,
    p: &Problem,
    s: &Solution,
    idx_ctx: Option<(&str, usize)>,
) -> Result<usize> {
    let e = expr.trim().replace(' ', "");

    // Integer literal.
    if let Ok(v) = e.parse::<i64>() {
        if v < 1 { bail!("Indices are 1-based; got {}", v); }
        return Ok(v as usize);
    }

    // Loop variable and arithmetic on it (i, i+1, i-1, ...).
    if let Some((sym, i)) = idx_ctx {
        if e == sym {
            return Ok(i);
        }
        if let Some((a, b)) = e.split_once('+') {
            if a == sym {
                let offset = b.parse::<i64>()?;
                let v = i as i64 + offset;
                if v < 1 { bail!("Index out of range: {}", v); }
                return Ok(v as usize);
            }
        }
        if let Some((a, b)) = e.split_once('-') {
            if a == sym {
                let offset = b.parse::<i64>()?;
                let v = i as i64 - offset;
                if v < 1 { bail!("Index out of range: {}", v); }
                return Ok(v as usize);
            }
        }
    }

    // Problem parameter used as an index.
    if let Some(&v) = p.params.get(&e) {
        let v = v as i64;
        if v < 1 { bail!("Parameter '{}' used as index must be >= 1", e); }
        return Ok(v as usize);
    }

    // Variable read used as an index: x[k].
    let var_prefix = format!("{}[", p.var_name);
    if e.starts_with(&var_prefix) && e.ends_with(']') {
        let inside = e.trim_start_matches(&var_prefix).trim_end_matches(']');
        let pos = eval_index(inside, p, s, idx_ctx)?;
        return Ok(p.var_at(s, pos)? as usize);
    }

    bail!("Unsupported index expression: '{}'", expr)
}

// ── Top-level split helpers ───────────────────────────────────────────────────

/// Split `expr` by `op` only at the top level (not inside brackets).
fn split_top_level<'a>(expr: &'a str, op: char) -> Option<Vec<&'a str>> {
    let mut depth = 0_i32;
    let mut parts = Vec::new();
    let mut last = 0;
    let mut found = false;

    for (i, c) in expr.char_indices() {
        match c {
            '(' | '[' => depth += 1,
            ')' | ']' => depth -= 1,
            _ => {}
        }
        if depth == 0 && c == op {
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

/// Split on subtraction at the top level, preserving a leading unary minus.
fn split_top_level_minus(expr: &str) -> Option<Vec<&str>> {
    let mut depth = 0_i32;
    let mut parts = Vec::new();
    let mut last = 0;
    let mut found = false;

    for (i, c) in expr.char_indices() {
        match c {
            '(' | '[' => depth += 1,
            ')' | ']' => depth -= 1,
            _ => {}
        }
        // Skip i == 0 to leave a leading '-' as a unary minus.
        if depth == 0 && c == '-' && i != 0 {
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

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn tsp() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../examples/tsp.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    fn knapsack() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../examples/knapsack.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    #[test]
    fn knapsack_goal_evaluates() {
        let p = knapsack();
        // [1,1,1,1,0] — all but last item selected
        let s = Solution::Vector(vec![1.0, 1.0, 1.0, 1.0, 0.0]);
        let goals = p.eval_goals(&s).unwrap();
        assert_eq!(goals.len(), 1);
        assert!(goals[0] > 0.0);
    }

    #[test]
    fn tsp_goal_evaluates() {
        let p = tsp();
        // Identity permutation [0,1,2,3]
        let s = Solution::Permutation(vec![0, 1, 2, 3]);
        let goals = p.eval_goals(&s).unwrap();
        assert!((goals[0] - 75.0).abs() < 1e-6, "expected 75, got {}", goals[0]);
    }

    #[test]
    fn constraint_lte_passes_and_fails() {
        let p = knapsack();
        let feasible = Solution::Vector(vec![0.0; p.var_size()]);
        assert!(p.is_feasible(&feasible).unwrap());

        // All-ones is infeasible for the knapsack weight constraint
        let infeasible = Solution::Vector(vec![1.0; p.var_size()]);
        assert!(!p.is_feasible(&infeasible).unwrap());
    }
}