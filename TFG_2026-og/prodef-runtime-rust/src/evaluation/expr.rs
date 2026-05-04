use anyhow::{anyhow, bail, Result};

use crate::domain::{RuntimeProblem, Solution};

// Evaluates a constraint expression and returns whether it is satisfied.
pub(crate) fn eval_constraint(expr: &str, p: &RuntimeProblem, s: &Solution) -> Result<bool> {
    // Support chained comparisons like: a <= b <= c
    if expr.contains("<=") {
        let parts: Vec<&str> = expr.split("<=").map(str::trim).collect();
        if parts.len() == 3 {
            let a = eval_numeric_expr(parts[0], p, s)?;
            let b = eval_numeric_expr(parts[1], p, s)?;
            let c = eval_numeric_expr(parts[2], p, s)?;
            return Ok(a <= b && b <= c);
        }
    }

    if let Some((lhs, rhs)) = expr.split_once("<=") {
        let left_value = eval_numeric_expr(lhs.trim(), p, s)?;
        let right_value = eval_numeric_expr(rhs.trim(), p, s)?;
        return Ok(left_value <= right_value);
    }

    // Support chained comparisons like: a >= b >= c
    if expr.contains(">=") {
        let parts: Vec<&str> = expr.split(">=").map(str::trim).collect();
        if parts.len() == 3 {
            let a = eval_numeric_expr(parts[0], p, s)?;
            let b = eval_numeric_expr(parts[1], p, s)?;
            let c = eval_numeric_expr(parts[2], p, s)?;
            return Ok(a >= b && b >= c);
        }
    }

    if let Some((lhs, rhs)) = expr.split_once(">=") {
        let left_value = eval_numeric_expr(lhs.trim(), p, s)?;
        let right_value = eval_numeric_expr(rhs.trim(), p, s)?;
        return Ok(left_value >= right_value);
    }

    // a = b (exact equality)
    if let Some((lhs, rhs)) = expr.split_once('=') {
        let left_value = eval_numeric_expr(lhs.trim(), p, s)?;
        let right_value = eval_numeric_expr(rhs.trim(), p, s)?;
        return Ok((left_value - right_value).abs() < 1e-12);
    }

    bail!("Unsupported constraint operator in '{}'", expr)
}

// Evaluates a numeric expression that appears in goals/constraints.
pub(crate) fn eval_numeric_expr(expr: &str, p: &RuntimeProblem, s: &Solution) -> Result<f64> {
    let e = expr.trim();
    eval_scalar(e, p, s, None)
}

// Recursive evaluator for scalar expressions.
fn eval_scalar(expr: &str, p: &RuntimeProblem, s: &Solution, idx_ctx: Option<(&str, usize)>) -> Result<f64> {
    let orig = expr.trim();

    // 1) Try to evaluate sum expressions. For example, `sum i=1:N x[i]` or `sum i=1:N x[i]*item[i].weight`.
    if let Some(result) = try_eval_sum(orig, p, s)? {
        return Ok(result);
    }

    // 2) Remove all spaces for easier parsing of the remaining expression.
    // For example, `x [ i ] * item [ i ] . weight` -> `x[i]*item[i].weight`.
    let mut e = orig.replace(' ', "");

    // 3) Handle parentheses: if the entire expression is wrapped in parentheses, remove them and evaluate the inside. For example, `(x[i] + 1)` -> `x[i] + 1`.
    if e.starts_with('(') && e.ends_with(')') && e.len() >= 2 {
        e = e[1..e.len() - 1].to_string();
    }

    // 4) Addition.
    if let Some(parts) = split_top_level(&e, '+') {
        let mut total = 0.0;
        for part in parts {
            total += eval_scalar(part, p, s, idx_ctx)?;
        }
        return Ok(total);
    }

    // 5) Subtraction.
    if let Some(parts) = split_top_level_minus(&e) {
        let mut iter = parts.into_iter();
        let first = iter.next().ok_or_else(|| anyhow!("Empty parts in subtraction"))?;
        let mut acc = eval_scalar(&first, p, s, idx_ctx)?;
        for part in iter {
            acc -= eval_scalar(&part, p, s, idx_ctx)?;
        }
        return Ok(acc);
    }

    // 6) Multiplication.
    if let Some(parts) = split_top_level(&e, '*') {
        let mut total = 1.0;
        for part in parts {
            total *= eval_scalar(part, p, s, idx_ctx)?;
        }
        return Ok(total);
    }

    // 7) Numeric literal.
    if let Ok(v) = e.parse::<f64>() {
        return Ok(v);
    }

    // 8) Parameter.
    if let Some(v) = p.params.get(&e) {
        return Ok(*v);
    }

    // 9) Variable access: x[i]
    let var_prefix = format!("{}[", p.var_name);
    if e.starts_with(&var_prefix) && e.ends_with(']') {
        let inside = &e[var_prefix.len()..e.len() - 1];
        let idx = eval_index_expr(inside, p, s, idx_ctx)?;
        return p.var_at(s, idx);
    }

    // 10) Class attribute access: item[i].weight
    if let Some((left, attr)) = e.split_once("].") {
        if let Some((class, idx_expr)) = left.split_once('[') {
            let idx = eval_index_expr(idx_expr, p, s, idx_ctx)?;
            return p.class_attr_at(class, attr, idx);
        }
    }

    // 11) Matrix access: `d[i,j]`
    if let Some((class, rest)) = e.split_once('[') {
        if rest.ends_with(']') {
            let inside = &rest[..rest.len() - 1];
            if let Some(parts) = split_top_level(inside, ',') {
                if parts.len() >= 2 {
                    let row = eval_index_expr(parts[0], p, s, idx_ctx)?;
                    let col = eval_index_expr(parts[1], p, s, idx_ctx)?;
                    return p.matrix_at(class, row, col);
                }
            }
        }
    }

    bail!("Unsupported expression fragment: '{}'", expr)
}

// Tries to evaluate a sum expression and returns:
// - Ok(Some(value)) if this is a sum expression
// - Ok(None) if expr does not start with `sum`
fn try_eval_sum(expr: &str, p: &RuntimeProblem, s: &Solution) -> Result<Option<f64>> {
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
    let range_and_tail = range_and_tail.trim();

    let after_open = range_and_tail
        .strip_prefix('(')
        .ok_or_else(|| anyhow!("Malformed sum bounds in '{}'", expr))?;

    let close_pos = after_open
        .find(')')
        .ok_or_else(|| anyhow!("Malformed sum bounds in '{}'", expr))?;

    let range_raw = &after_open[..close_pos];
    let tail = after_open[close_pos + 1..].trim();

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

    // Supports expressions like:
    // sum ... over ... + rest
    // sum ... over ... - rest
    if let Some(rest_tail) = tail.strip_prefix('+') {
        return Ok(Some(total + eval_scalar(rest_tail.trim(), p, s, None)?));
    }
    if let Some(rest_tail) = tail.strip_prefix('-') {
        return Ok(Some(total - eval_scalar(rest_tail.trim(), p, s, None)?));
    }

    bail!("Malformed sum tail in '{}': expected '+' or '-' continuation", expr)
}

// Evaluates an index expression used in x[i], item[i].attr, d[i,j], etc.
fn eval_index_expr(expr: &str, p: &RuntimeProblem, s: &Solution, idx_ctx: Option<(&str, usize)>) -> Result<usize> {
    let e = expr.trim().replace(' ', "");

    // Direct integer index.
    if let Ok(v) = e.parse::<i64>() {
        if v < 1 {
            bail!("Indices are 1-based and must be >= 1");
        }
        return Ok(v as usize);
    }

    // Loop variable: i, i+1, i-1
    if let Some((sym, i)) = idx_ctx {
        if e == sym {
            return Ok(i);
        }
        if let Some((a, b)) = e.split_once('+') {
            if a == sym {
                let add = b.parse::<i64>()?;
                let value = i as i64 + add;
                if value < 1 {
                    bail!("Indices are 1-based and must be >= 1");
                }
                return Ok(value as usize);
            }
        }
        if let Some((a, b)) = e.split_once('-') {
            if a == sym {
                let sub = b.parse::<i64>()?;
                let value = i as i64 - sub;
                if value < 1 {
                    bail!("Indices are 1-based and must be >= 1");
                }
                return Ok(value as usize);
            }
        }
    }

    // Parameter index (for example N).
    if let Some(v) = p.params.get(&e) {
        let value = *v as i64;
        if value < 1 {
            bail!("Indices are 1-based and must be >= 1");
        }
        return Ok(value as usize);
    }

    // Variable-based index (needed for assignment and TSP: cost[i, assignment[i]], distance[city[i], city[i+1]])
    let var_prefix = format!("{}[", p.var_name);
    if e.starts_with(&var_prefix) && e.ends_with(']') {
        let inside = e
            .trim_start_matches(&var_prefix)
            .trim_end_matches(']');
        let pos = eval_index_expr(inside, p, s, idx_ctx)?;
        return Ok(p.var_at(s, pos)? as usize);
    }

    bail!("Unsupported index expression: '{}'", expr)
}

// Splits by an operator only at top-level depth (outside () and []).
fn split_top_level<'a>(expr: &'a str, op: char) -> Option<Vec<&'a str>> {
    let mut depth = 0_i32;
    let mut out = Vec::new();
    let mut last = 0_usize;
    let mut found = false;

    for (i, c) in expr.char_indices() {
        match c {
            '(' | '[' => depth += 1,
            ')' | ']' => depth -= 1,
            _ => {}
        }
        if depth == 0 && c == op {
            out.push(&expr[last..i]);
            last = i + 1;
            found = true;
        }
    }

    if found {
        out.push(&expr[last..]);
        Some(out)
    } else {
        None
    }
}

// Similar to split_top_level, but it avoids treating the first '-' as a subtraction operator, which allows us to
// correctly parse expressions like `-3+2` without splitting at the first '-'.
fn split_top_level_minus(expr: &str) -> Option<Vec<&str>> {
    let mut depth = 0_i32;
    let mut out = Vec::new();
    let mut last = 0_usize;
    let mut found = false;

    for (i, c) in expr.char_indices() {
        match c {
            '(' | '[' => depth += 1,
            ')' | ']' => depth -= 1,
            _ => {}
        }
        if depth == 0 && c == '-' && i != 0 {
            out.push(&expr[last..i]);
            last = i + 1;
            found = true;
        }
    }

    if found {
        out.push(&expr[last..]);
        Some(out)
    } else {
        None
    }
}
