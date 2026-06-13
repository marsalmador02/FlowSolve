// problem.rs
//
// Single source of truth for the optimization problem.
// Handles JSON deserialization, validation, data loading, and all
// runtime operations (random generation, feasibility, evaluation).
//
// Replaces: domain/model.rs, domain/runtime.rs, domain/feasible.rs

use std::collections::HashMap;

use anyhow::{anyhow, bail, Result};
use rand::prelude::*;
use serde::Deserialize;

use crate::eval::{eval_constraint, eval_numeric};
use crate::solution::Solution;

// ── JSON schema (replaces model.rs) ─────────────────────────────────────────
//
// These are the raw deserialization types. They are private to this module;
// nothing outside needs to know about them.

#[derive(Debug, Deserialize)]
struct RawProblem {
    name: String,
    parameters: Option<Vec<RawParameter>>,
    variables: Vec<RawVariable>,
    goals: Vec<RawGoal>,
    constraints: Option<Vec<RawConstraint>>,
    classes: Option<Vec<RawClass>>,
    objects: Option<Vec<RawInstance>>,
}

#[derive(Debug, Deserialize)]
struct RawParameter {
    symbol: String,
    value: f64,
}

#[derive(Debug, Deserialize)]
struct RawVariable {
    symbol: String,
    within: String,
    shape: RawShape,
    range: Option<RawRange>,
}

#[derive(Debug, Deserialize)]
struct RawRange {
    #[serde(rename = "lowerBound")]
    lower_bound: Option<serde_json::Value>,
    #[serde(rename = "upperBound")]
    upper_bound: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum RawShape {
    #[serde(rename = "vector")]
    Vector {
        #[serde(rename = "isPermutation")]
        is_permutation: Option<bool>,
        size: RawSize,
    },
    // Other shapes are not supported; we reject them in Problem::from_json.
    #[serde(other)]
    Unsupported,
}

#[derive(Debug, Deserialize)]
struct RawSize {
    #[allow(dead_code)]
    fixed: bool,
    value: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct RawGoal {
    sense: Option<String>,
    expression: String,
}

#[derive(Debug, Deserialize)]
struct RawConstraint {
    #[allow(dead_code)]
    name: Option<String>,
    expression: String,
}

#[derive(Debug, Deserialize)]
struct RawClass {
    symbol: String,
    attributes: Vec<RawClassAttribute>,
}

#[derive(Debug, Deserialize)]
struct RawClassAttribute {
    symbol: String,
}

#[derive(Debug, Deserialize)]
struct RawInstance {
    class: String,
    attributes: Vec<RawInstanceAttribute>,
}

#[derive(Debug, Deserialize)]
struct RawInstanceAttribute {
    attribute: String,
    value: serde_json::Value,
}

// ── Sense ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum Sense {
    Minimize,
    Maximize,
}

// ── Problem ──────────────────────────────────────────────────────────────────

/// The runtime problem. Built once from JSON, used everywhere.
///
/// All fields are resolved and validated up front so the rest of the code
/// never has to deal with `Option`s, symbolic sizes, or raw JSON values.
pub(crate) struct Problem {
    pub(crate) name: String,

    // These are public because the expression evaluator (eval.rs) reads them.
    pub(crate) var_name: String,
    pub(crate) params: HashMap<String, f64>,
    pub(crate) data: HashMap<String, Vec<f64>>,

    var_size: usize,
    is_permutation: bool,
    lower: f64,
    upper: f64,

    sense: Sense,
    goal_exprs: Vec<String>,
    constraint_exprs: Vec<String>,
}

impl Problem {
    /// Build a `Problem` from a raw JSON value.
    ///
    /// Returns an error if the JSON doesn't match the schema, if there is not
    /// exactly one variable, or if the variable is not a vector.
    pub(crate) fn from_json(value: serde_json::Value) -> Result<Self> {
        let raw: RawProblem = serde_json::from_value(value)
            .map_err(|e| anyhow!("Invalid problem JSON: {}", e))?;

        if raw.variables.len() != 1 {
            bail!("Only one variable is currently supported");
        }

        let var = &raw.variables[0];
        let var_name = var.symbol.clone();

        let params: HashMap<String, f64> = raw
            .parameters
            .iter()
            .flatten()
            .map(|p| (p.symbol.clone(), p.value))
            .collect();

        let data = build_data_map(
            raw.classes.as_deref(),
            raw.objects.as_deref(),
        )?;

        let (var_size, is_permutation, lower, upper) = match &var.shape {
            RawShape::Vector { is_permutation, size } => {
                let n = resolve_size(&size.value, &params)?;

                let lower = var
                    .range
                    .as_ref()
                    .and_then(|r| r.lower_bound.as_ref())
                    .map(parse_bound)
                    .transpose()?
                    .unwrap_or(0.0);

                let upper = var
                    .range
                    .as_ref()
                    .and_then(|r| r.upper_bound.as_ref())
                    .map(parse_bound)
                    .transpose()?
                    .unwrap_or_else(|| {
                        if var.within.eq_ignore_ascii_case("binary") { 1.0 } else { 10.0 }
                    });

                if lower > upper {
                    bail!("Invalid variable bounds: lowerBound > upperBound");
                }

                (n, is_permutation.unwrap_or(false), lower, upper)
            }
            RawShape::Unsupported => bail!("Only vector variables are currently supported"),
        };

        let sense = raw
            .goals
            .first()
            .and_then(|g| g.sense.as_deref())
            .map(|s| {
                if s.eq_ignore_ascii_case("minimize") { Sense::Minimize } else { Sense::Maximize }
            })
            .unwrap_or(Sense::Maximize);

        let goal_exprs = raw.goals.iter().map(|g| g.expression.clone()).collect();
        let constraint_exprs = raw
            .constraints
            .iter()
            .flatten()
            .map(|c| c.expression.clone())
            .collect();

        Ok(Self {
            name: raw.name,
            var_name,
            params,
            data,
            var_size,
            is_permutation,
            lower,
            upper,
            sense,
            goal_exprs,
            constraint_exprs,
        })
    }

    // ── Shape accessors ──────────────────────────────────────────────────────

    pub(crate) fn var_size(&self) -> usize {
        self.var_size
    }

    pub(crate) fn is_permutation(&self) -> bool {
        self.is_permutation
    }

    pub(crate) fn lower(&self) -> f64 {
        self.lower
    }

    pub(crate) fn upper(&self) -> f64 {
        self.upper
    }

    pub(crate) fn sense(&self) -> Sense {
        self.sense
    }

    // ── Random generation ────────────────────────────────────────────────────

    /// Generate a random solution compatible with this problem's shape.
    pub(crate) fn random_solution(&self, rng: &mut StdRng) -> Solution {
        if self.is_permutation {
            let mut values: Vec<usize> = (0..self.var_size).collect();
            values.shuffle(rng);
            Solution::Permutation(values)
        } else {
            let lo = self.lower.ceil() as i64;
            let hi = self.upper.floor() as i64;
            Solution::Vector(
                (0..self.var_size)
                    .map(|_| rng.gen_range(lo..=hi) as f64)
                    .collect(),
            )
        }
    }

    /// Try random candidates until one is feasible, up to `limit` attempts.
    pub(crate) fn random_feasible_solution(&self, rng: &mut StdRng) -> Result<Solution> {
        const LIMIT: usize = 100_000;
        for _ in 0..LIMIT {
            let candidate = self.random_solution(rng);
            if self.is_feasible(&candidate)? {
                return Ok(candidate);
            }
        }
        bail!("No feasible solution found after {} attempts", LIMIT)
    }

    // ── Evaluation ───────────────────────────────────────────────────────────

    /// Check whether `solution` satisfies every constraint.
    pub(crate) fn is_feasible(&self, solution: &Solution) -> Result<bool> {
        for expr in &self.constraint_exprs {
            if !eval_constraint(expr, self, solution)? {
                return Ok(false);
            }
        }
        Ok(true)
    }

    /// Evaluate every goal expression and return the values in order.
    pub(crate) fn eval_goals(&self, solution: &Solution) -> Result<Vec<f64>> {
        self.goal_exprs
            .iter()
            .map(|expr| eval_numeric(expr, self, solution))
            .collect()
    }

    /// Single scalar score used by search and comparison (sum of all goals).
    pub(crate) fn score(&self, solution: &Solution) -> Result<f64> {
        Ok(self.eval_goals(solution)?.into_iter().sum())
    }

    /// Return true if `a` is strictly better than `b` under this problem's sense.
    pub(crate) fn is_better(&self, a: f64, b: f64) -> bool {
        match self.sense {
            Sense::Maximize => a > b,
            Sense::Minimize => a < b,
        }
    }

    // ── Data access (used by eval.rs) ────────────────────────────────────────

    /// Read a decision variable value at a 1-based index.
    pub(crate) fn var_at(&self, solution: &Solution, idx: usize) -> Result<f64> {
        if idx == 0 {
            bail!("Indices are 1-based");
        }
        match solution {
            Solution::Vector(v) => v
                .get(idx - 1)
                .copied()
                .ok_or_else(|| anyhow!("Index {} out of bounds", idx)),
            Solution::Permutation(p) => p
                .get(idx - 1)
                .map(|x| (*x + 1) as f64)
                .ok_or_else(|| anyhow!("Index {} out of bounds", idx)),
        }
    }

    /// Read a class attribute value at a 1-based row index.
    pub(crate) fn class_attr_at(&self, class: &str, attr: &str, idx: usize) -> Result<f64> {
        if idx == 0 {
            bail!("Indices are 1-based");
        }
        let key = format!("{}.{}", class, attr);
        let col = self
            .data
            .get(&key)
            .ok_or_else(|| anyhow!("Unknown class attribute: {}", key))?;
        col.get(idx - 1)
            .copied()
            .ok_or_else(|| anyhow!("Index {} out of bounds for {}", idx, key))
    }

    /// Read a matrix cell at 1-based (row, col) coordinates.
    pub(crate) fn matrix_at(&self, class: &str, row: usize, col: usize) -> Result<f64> {
        if row == 0 || col == 0 {
            bail!("Indices are 1-based");
        }
        let key = format!("{}.row{}", class, row);
        let r = self
            .data
            .get(&key)
            .ok_or_else(|| anyhow!("Unknown matrix row: {}", key))?;
        r.get(col - 1)
            .copied()
            .ok_or_else(|| anyhow!("Column {} out of bounds in {}", col, key))
    }
}

// ── Private helpers ──────────────────────────────────────────────────────────

/// Build the flat data map used for class attribute and matrix access.
///
/// For every class, two kinds of keys are produced:
/// - `"ClassName.attr"` → column vector (all values for that attribute)
/// - `"ClassName.rowN"` → row vector (all numeric attribute values for row N)
fn build_data_map(
    classes: Option<&[RawClass]>,
    objects: Option<&[RawInstance]>,
) -> Result<HashMap<String, Vec<f64>>> {
    let mut out = HashMap::new();

    let (Some(classes), Some(objects)) = (classes, objects) else {
        return Ok(out);
    };

    for class in classes {
        let rows: Vec<&RawInstance> = objects
            .iter()
            .filter(|o| o.class == class.symbol)
            .collect();

        if rows.is_empty() {
            continue;
        }

        // Only keep attributes whose first value is numeric.
        let numeric_attrs: Vec<&str> = class
            .attributes
            .iter()
            .filter(|a| {
                rows[0]
                    .attributes
                    .iter()
                    .find(|ia| ia.attribute == a.symbol)
                    .map(|ia| parse_f64(&ia.value).is_ok())
                    .unwrap_or(false)
            })
            .map(|a| a.symbol.as_str())
            .collect();

        // Column vectors: "ClassName.attr" → [v1, v2, ...]
        for attr in &numeric_attrs {
            let column: Result<Vec<f64>> = rows
                .iter()
                .map(|row| {
                    row.attributes
                        .iter()
                        .find(|ia| ia.attribute == *attr)
                        .ok_or_else(|| anyhow!("Missing attribute {} in class {}", attr, class.symbol))
                        .and_then(|ia| parse_f64(&ia.value))
                })
                .collect();
            out.insert(format!("{}.{}", class.symbol, attr), column?);
        }

        // Row vectors: "ClassName.rowN" → [attr1_val, attr2_val, ...]
        for (i, row) in rows.iter().enumerate() {
            let row_values: Result<Vec<f64>> = numeric_attrs
                .iter()
                .map(|attr| {
                    row.attributes
                        .iter()
                        .find(|ia| ia.attribute == *attr)
                        .ok_or_else(|| anyhow!("Missing attribute {} in class {}", attr, class.symbol))
                        .and_then(|ia| parse_f64(&ia.value))
                })
                .collect();
            out.insert(format!("{}.row{}", class.symbol, i + 1), row_values?);
        }
    }

    Ok(out)
}

fn resolve_size(value: &serde_json::Value, params: &HashMap<String, f64>) -> Result<usize> {
    match value {
        serde_json::Value::Number(n) => {
            let n = n.as_u64().ok_or_else(|| anyhow!("Vector size must be a positive integer"))?;
            if n == 0 { bail!("Vector size must be > 0"); }
            Ok(n as usize)
        }
        serde_json::Value::String(name) => {
            let n = params
                .get(name)
                .copied()
                .ok_or_else(|| anyhow!("Unknown size parameter '{}'", name))?;
            if n < 1.0 || n.fract().abs() > 1e-9 {
                bail!("Size parameter '{}' must be a positive integer", name);
            }
            Ok(n as usize)
        }
        _ => bail!("Vector size must be a number or a parameter name"),
    }
}

fn parse_f64(value: &serde_json::Value) -> Result<f64> {
    match value {
        serde_json::Value::Number(n) => n.as_f64().ok_or_else(|| anyhow!("Invalid number")),
        serde_json::Value::String(s) => s.parse().map_err(|_| anyhow!("Expected number, got '{}'", s)),
        _ => bail!("Expected a numeric value"),
    }
}

fn parse_bound(value: &serde_json::Value) -> Result<f64> {
    match value {
        serde_json::Value::Number(n) => n.as_f64().ok_or_else(|| anyhow!("Invalid bound")),
        serde_json::Value::String(s) => match s.to_lowercase().as_str() {
            "infinity" | "+infinity" => Ok(f64::INFINITY),
            "-infinity" => Ok(f64::NEG_INFINITY),
            _ => s.parse().map_err(|_| anyhow!("Invalid bound '{}': expected a number or Infinity", s)),
        },
        _ => bail!("Bound must be a number or a string"),
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn load(json: &str) -> Problem {
        let v: serde_json::Value = serde_json::from_str(json).expect("parse json");
        Problem::from_json(v).expect("build problem")
    }

    #[test]
    fn tsp_builds_and_evaluates() {
        let p = load(include_str!("../../examples/tsp.json"));
        assert_eq!(p.var_size(), 4);
        assert!(p.is_permutation());

        // Identity permutation [0,1,2,3] → 1-based [1,2,3,4]
        let sol = Solution::Permutation(vec![0, 1, 2, 3]);
        let goals = p.eval_goals(&sol).expect("eval goals");
        assert!((goals[0] - 75.0).abs() < 1e-6, "expected 75, got {}", goals[0]);
        assert!(p.is_feasible(&sol).expect("feasible"));
    }

    #[test]
    fn knapsack_builds_and_evaluates() {
        let p = load(include_str!("../../examples/knapsack.json"));
        assert!(!p.is_permutation());

        let sol = Solution::Vector(vec![0.0; p.var_size()]);
        assert!(p.is_feasible(&sol).expect("feasible"));
        assert_eq!(p.score(&sol).expect("score"), 0.0);
    }

    #[test]
    fn sense_parsed_correctly() {
        let p = load(include_str!("../../examples/tsp.json"));
        assert_eq!(p.sense(), Sense::Minimize);

        let p = load(include_str!("../../examples/knapsack.json"));
        assert_eq!(p.sense(), Sense::Maximize);
    }

    #[test]
    fn is_better_respects_sense() {
        let p = load(include_str!("../../examples/tsp.json")); // minimize
        assert!(p.is_better(10.0, 20.0));
        assert!(!p.is_better(20.0, 10.0));

        let p = load(include_str!("../../examples/knapsack.json")); // maximize
        assert!(p.is_better(20.0, 10.0));
        assert!(!p.is_better(10.0, 20.0));
    }
}