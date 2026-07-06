//! Expression evaluation for the three supported problem families.
//!
//! This module evaluates goal and constraint expressions for knapsack,
//! assignment, and TSP problems only.

use anyhow::{anyhow, bail, Result};

use crate::problem::Problem;
use crate::solution::Solution;

/// Evaluate a constraint expression and return whether it is satisfied.
pub fn eval_constraint(expr: &str, p: &Problem, s: &Solution) -> Result<bool> {
    let expr = compact(expr);

    for op in ["<=", ">=", "=="] {
        if expr.contains(op) {
            let parts: Vec<&str> = expr.split(op).collect();

            let a = eval_numeric(parts[0], p, s)?;
            let b = eval_numeric(parts[1], p, s)?;
             return Ok(if op == "<=" {
                a <= b
            } else if op == ">=" {
                a >= b
            } else {
                a == b
            });
        }
    }
    
    bail!("No supported operator found in '{}'", expr)
}

/// Evaluate a numeric expression in the current problem and solution context.
pub fn eval_numeric(expr: &str, p: &Problem, s: &Solution) -> Result<f64> {
    eval_expr(&compact(expr), p, s, None)
}

// Evaluate an expression recursively, handling sums, arithmetic and variable lookups.
fn eval_expr(expr: &str, p: &Problem, s: &Solution, current_i: Option<usize>) -> Result<f64> {
    if let Some(total) = eval_sum(expr, p, s)? {
        return Ok(total);
    }

    if let Some(parts) = split_top_level_all(expr, '+', false) {
        let mut total = 0.0;
        for part in parts {
            total += eval_expr(part, p, s, current_i)?;
        }
        return Ok(total);
    }

    if let Some(parts) = split_top_level_all(expr, '-', true) {
        let mut iter = parts.into_iter();
        let first = iter.next().ok_or_else(|| anyhow!("Empty expression"))?;
        let mut acc = eval_expr(first, p, s, current_i)?;
        for part in iter {
            acc -= eval_expr(part, p, s, current_i)?;
        }
        return Ok(acc);
    }

    if let Some(parts) = split_top_level_all(expr, '*', false) {
        let mut acc = 1.0;
        for part in parts {
            acc *= eval_expr(part, p, s, current_i)?;
        }
        return Ok(acc);
    }

    if let Ok(value) = expr.parse::<f64>() {
        return Ok(value);
    }

    if let Some(&value) = p.params.get(expr) {
        return Ok(value);
    }

    if let Some(value) = read_variable(expr, p, s, current_i)? {
        return Ok(value);
    }

    if let Some(value) = read_class_attr(expr, p, s, current_i)? {
        return Ok(value);
    }

    if let Some(value) = read_matrix(expr, p, s, current_i)? {
        return Ok(value);
    }

    bail!("Cannot evaluate expression: '{}'", expr)
}

fn eval_sum(expr: &str, p: &Problem, s: &Solution) -> Result<Option<f64>> {
    if !expr.starts_with("sum") {
        return Ok(None);
    }

    let rest = &expr[3..];
    let Some((term, after_term)) = rest.split_once("over") else {
        return Ok(None);
    };

    let Some((_var, bounds)) = after_term.split_once('=') else {
        bail!("Bad sum range: '{}'", after_term);
    };

    let bounds = bounds
        .strip_prefix('(')
        .ok_or_else(|| anyhow!("Bad sum range: '{}'", bounds))?;

    let (range, tail) = bounds
        .split_once(')')
        .ok_or_else(|| anyhow!("Bad sum range: '{}'", bounds))?;

    let Some(colon_pos) = range.find(':') else {
        bail!("Bad sum range: '{}'", range);
    };
    let lo_raw = &range[..colon_pos];
    let hi_raw = &range[colon_pos + 1..];

    let lo = eval_expr(lo_raw, p, s, None)? as i64;
    let hi = eval_expr(hi_raw, p, s, None)? as i64;

    let mut total = 0.0;
    for i in lo..=hi {
        total += eval_expr(term, p, s, Some(i as usize))?;
    }

    if tail.is_empty() {
        return Ok(Some(total));
    }

    if tail.starts_with('+') {
        return Ok(Some(total + eval_expr(&tail[1..], p, s, None)?));
    }
    if tail.starts_with('-') {
        return Ok(Some(total - eval_expr(&tail[1..], p, s, None)?));
    }

    bail!("Bad continuation after sum: '{}'", tail)
}

fn read_variable(expr: &str, p: &Problem, s: &Solution, current_i: Option<usize>) -> Result<Option<f64>> {
    let prefix = format!("{}[", p.var_name);
    if expr.starts_with(&prefix) && expr.ends_with(']') {
        let inside = &expr[prefix.len()..expr.len() - 1];
        return Ok(Some(p.var_at(s, eval_index(inside, p, s, current_i)?)?));
    }
    Ok(None)
}

fn read_class_attr(expr: &str, p: &Problem, s: &Solution, current_i: Option<usize>) -> Result<Option<f64>> {
    let Some((left, attr)) = expr.split_once("].") else {
        return Ok(None);
    };
    let Some((class, index_expr)) = left.split_once('[') else {
        return Ok(None);
    };
    let idx = eval_index(index_expr, p, s, current_i)?;
    Ok(Some(p.class_attr_at(class, attr, idx)?))
}

fn read_matrix(expr: &str, p: &Problem, s: &Solution, current_i: Option<usize>) -> Result<Option<f64>> {
    let Some((class, rest)) = expr.split_once('[') else {
        return Ok(None);
    };
    let Some(inside) = rest.strip_suffix(']') else {
        return Ok(None);
    };
    let Some((row_expr, col_expr)) = split_top_level_once_str(inside, ",") else {
        return Ok(None);
    };
    let row = eval_index(row_expr, p, s, current_i)?;
    let col = eval_index(col_expr, p, s, current_i)?;
    Ok(Some(p.matrix_at(class, row, col)?))
}

fn eval_index(expr: &str, p: &Problem, s: &Solution, current_i: Option<usize>) -> Result<usize> {
    let expr = compact(expr);

    if let Ok(value) = expr.parse::<usize>() {
        return Ok(value);
    }

    if let Some(i) = current_i {
        if expr == "i" {
            return Ok(i);
        }
        if expr.starts_with("i+") {
            let offset: usize = expr[2..].parse()?;
            return Ok(i + offset);
        }
    }

    if let Some(&value) = p.params.get(&expr) {
        let value = value as usize;
        if value == 0 {
            bail!("Index must be >= 1");
        }
        return Ok(value);
    }

    let prefix = format!("{}[", p.var_name);
    if expr.starts_with(&prefix) && expr.ends_with(']') {
        let inside = &expr[prefix.len()..expr.len() - 1];
        let pos = eval_index(inside, p, s, current_i)?;
        return Ok(p.var_at(s, pos)? as usize);
    }

    bail!("Cannot resolve index: '{}'", expr)
}


fn compact(expr: &str) -> String {
    expr.to_string()
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect()
}

// Split an expression by a top-level operator and return all parts.
// Example: `split_top_level_all("a+b+c", '+', false)` returns `Some(vec!["a", "b", "c"])`.
fn split_top_level_all(expr: &str, op: char, skip_leading: bool) -> Option<Vec<&str>> {
    let mut depth = 0i32;
    let mut parts = Vec::new();
    let mut last = 0usize;
    let mut found = false;

    for (idx, ch) in expr.char_indices() {
        match ch {
            '(' | '[' => depth += 1,
            ')' | ']' => depth -= 1,
            _ => {}
        }

        if depth == 0 && ch == op && !(skip_leading && idx == 0) {
            parts.push(&expr[last..idx]);
            last = idx + ch.len_utf8();
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

/// Split an expression by a top-level operator and return the first two parts.
///
/// Example: `split_top_level_once_str("a+b+c", "+")` returns `Some(("a", "b+c"))`.
fn split_top_level_once_str<'a>(expr: &'a str, op: &str) -> Option<(&'a str, &'a str)> {
    let mut depth = 0i32;
    let bytes = expr.as_bytes();
    let op_bytes = op.as_bytes();
    let mut i = 0usize;

    while i + op_bytes.len() <= bytes.len() {
        match bytes[i] as char {
            '(' | '[' => depth += 1,
            ')' | ']' => depth -= 1,
            _ => {}
        }

        if depth == 0 && &bytes[i..i + op_bytes.len()] == op_bytes {
            return Some((&expr[..i], &expr[i + op_bytes.len()..]));
        }

        i += 1;
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load(json: &str) -> Problem {
        let v: serde_json::Value = serde_json::from_str(json).unwrap();
        Problem::from_json(v).unwrap()
    }
 
    #[test]
    fn knapsack_goal_and_constraint() {
        let p = load(include_str!("../examples/knapsack.json"));
        let selected = Solution::Vector(vec![1.0, 1.0, 1.0, 1.0, 0.0]);
        let goals = p.eval_goals(&selected).unwrap();
        assert!(goals[0] > 0.0);
        assert!(p.is_feasible(&selected).unwrap());

        let empty = Solution::Vector(vec![0.0; p.var_size()]);
        assert_eq!(p.eval_goals(&empty).unwrap()[0], 0.0);
    }

    #[test]
    fn tsp_goal_evaluates() {
        let p = load(include_str!("../examples/tsp.json"));
        let sol = Solution::Permutation(vec![0, 1, 2, 3]);
        let goals = p.eval_goals(&sol).unwrap();
        assert!((goals[0] - 75.0).abs() < 1e-6, "expected 75, got {}", goals[0]);
    }

    #[test]
    fn chained_comparison() {
        let p = load(include_str!("../examples/knapsack.json"));
        let sol = Solution::Vector(vec![0.0; p.var_size()]);
        assert!(eval_constraint("0 <= 0 <= 1", &p, &sol).unwrap());
        assert!(!eval_constraint("0 <= 2 <= 1", &p, &sol).unwrap());
    }
}