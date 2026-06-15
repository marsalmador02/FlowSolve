// problem.rs — optimization problem loaded from JSON.
//
// Owns deserialization, validation, data loading, random generation,
// feasibility checking, and objective evaluation.
//
// Supports three problem families:
//   - Knapsack: binary vector, class attributes (item[i].weight), weight constraint
//   - Assignment: permutation, square cost matrix (cost[i, assignment[i]])
//   - TSP: permutation, distance matrix with wrap-around tour

use std::collections::HashMap;

use anyhow::{anyhow, bail, Result};
use rand::prelude::*;
use serde::Deserialize;
use rand::rngs::ThreadRng;

use crate::eval::{eval_constraint, eval_numeric};
use crate::solution::Solution;

#[derive(Deserialize)]
struct RawProblem {
    name: String,
    parameters: Vec<RawParameter>,
    variables: Vec<RawVariable>,
    goals: Vec<RawGoal>,
    #[serde(default)]
    constraints: Vec<RawConstraint>,
    classes: Vec<RawClass>,
    objects: Vec<RawInstance>,
}

#[derive(Deserialize)]
struct RawParameter {
    symbol: String,
    value: f64,
}

#[derive(Deserialize)]
struct RawVariable {
    symbol: String,
    within: String,
    range: Option<RawRange>,
    shape: RawShape,
}

#[derive(Deserialize)]
struct RawRange {
    #[serde(rename = "lowerBound")]
    lower_bound: Option<f64>,
    #[serde(rename = "upperBound")]
    upper_bound: Option<f64>,
}

#[derive(Deserialize)]
struct RawShape {
    #[serde(rename = "type")]
    kind: String,
    #[serde(rename = "isPermutation")]
    is_permutation: bool,
    size: RawSize,
}

#[derive(Deserialize)]
struct RawSize {
    fixed: bool, // mirar
    value: serde_json::Value,
}

#[derive(Deserialize)]
struct RawGoal {
    sense: String,
    expression: String,
}

#[derive(Deserialize)]
struct RawConstraint {
    expression: String,
}

#[derive(Deserialize)]
struct RawClass {
    symbol: String,
    attributes: Vec<RawClassAttribute>,
}

#[derive(Deserialize)]
struct RawClassAttribute {
    symbol: String,
}

#[derive(Deserialize)]
struct RawInstance {
    class: String,
    attributes: Vec<RawInstanceAttribute>,
}

#[derive(Deserialize)]
struct RawInstanceAttribute {
    attribute: String,
    value: serde_json::Value,
}

#[derive(Clone, Copy, PartialEq)]
pub enum Sense {
    Minimize,
    Maximize,
}

pub struct Problem {
    pub name: String,
    pub var_name: String,
    pub params: HashMap<String, f64>,
    pub data: HashMap<String, Vec<f64>>,
    var_size: usize,
    is_permutation: bool,
    lower: f64,
    upper: f64,
    sense: Sense,
    goal_exprs: Vec<String>,
    constraint_exprs: Vec<String>,
}

impl Problem {
    pub fn from_json(value: serde_json::Value) -> Result<Self> {
        let raw: RawProblem = serde_json::from_value(value)?;
        let var = &raw.variables[0];

        let sense = raw
            .goals
            .first()
            .map(|g| {
                if g.sense.eq_ignore_ascii_case("minimize") {
                    Sense::Minimize
                } else {
                    Sense::Maximize
                }
            })
            .unwrap();

        let params = raw.parameters.iter().map(|p| (p.symbol.clone(), p.value)).collect();
        // params = {"N": 10, "MaxWeight": 40, ...}
        let var_size = resolve_size(&var.shape.size.value, &params)?;

        Ok(Self {
            name: raw.name,
            var_name: var.symbol.clone(),
            params,
            data: build_data_map(&raw.classes, &raw.objects)?,
            var_size,
            is_permutation: var.shape.is_permutation,
            lower: var.range.as_ref().and_then(|r| r.lower_bound).unwrap_or(0.0),
            upper: var.range.as_ref().and_then(|r| r.upper_bound).unwrap_or(0.0),
            sense,
            goal_exprs: raw.goals.iter().map(|g| g.expression.clone()).collect(),
            constraint_exprs: raw.constraints.iter().map(|c| c.expression.clone()).collect(),
        })
    }

    pub fn var_size(&self) -> usize {
        self.var_size
    }

    pub fn is_permutation(&self) -> bool {
        self.is_permutation
    }

    pub fn lower(&self) -> f64 {
        self.lower
    }

    pub fn upper(&self) -> f64 {
        self.upper
    }

    pub fn sense(&self) -> Sense {
        self.sense
    }

    pub fn random_solution(&self, rng: &mut ThreadRng) -> Solution {
        if self.is_permutation {
            let mut values: Vec<usize> = (0..self.var_size).collect();
            values.shuffle(rng);
            Solution::Permutation(values)
        } else {
            let low = self.lower as i64;
            let high = self.upper as i64;
            Solution::Vector(
                (0..self.var_size)
                    .map(|_| rng.gen_range(low..=high) as f64)
                    .collect(),
            )
        }
    }

    /// Try random candidates until one is feasible, up to 100 000 attempts.
    pub fn random_feasible_solution(&self, rng: &mut ThreadRng) -> Result<Solution> {
        const LIMIT: i64 = 100_000;
        for _ in 0..LIMIT {
            let candidate = self.random_solution(rng);
            if self.is_feasible(&candidate)? {
                return Ok(candidate);
            }
        }
        bail!("No feasible solution found after {} attempts", LIMIT)
    }

    pub fn is_feasible(&self, solution: &Solution) -> Result<bool> {
        for expr in &self.constraint_exprs {
            if !eval_constraint(expr, self, solution)? {
                return Ok(false);
            }
        }
        Ok(true)
    }

    pub fn eval_goals(&self, solution: &Solution) -> Result<Vec<f64>> {
        self.goal_exprs
            .iter()
            .map(|expr| eval_numeric(expr, self, solution))
            .collect()
    }

    /// Sum of all goal values — the single scalar used by search.
    pub fn score(&self, solution: &Solution) -> Result<f64> {
        Ok(self.eval_goals(solution)?.into_iter().sum())
    }

    /// True if score `a` is strictly better than `b` under this problem's sense.
    pub fn is_better(&self, a: f64, b: f64) -> bool {
        match self.sense {
            Sense::Maximize => a > b,
            Sense::Minimize => a < b,
        }
    }

    /// Read a decision variable value at a 1-based index.
    pub fn var_at(&self, solution: &Solution, idx: usize) -> Result<f64> {
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

    /// Read a class attribute column at a 1-based row index.
    /// Key format: "ClassName.attr"
    pub fn class_attr_at(&self, class: &str, attr: &str, idx: usize) -> Result<f64> {
        let key = format!("{}.{}", class, attr);
        self.data
            .get(&key)
            .ok_or_else(|| anyhow!("Unknown attribute: {}", key))?
            .get(idx - 1)
            .copied()
            .ok_or_else(|| anyhow!("Index {} out of bounds for {}", idx, key))
    }

    /// Read a matrix cell at 1-based (row, col).
    /// Key format: "ClassName.rowN"
    pub fn matrix_at(&self, class: &str, row: usize, col: usize) -> Result<f64> {
        let key = format!("{}.row{}", class, row);
        self.data
            .get(&key)
            .ok_or_else(|| anyhow!("Unknown matrix row: {}", key))?
            .get(col - 1)
            .copied()
            .ok_or_else(|| anyhow!("Column {} out of bounds in {}", col, key))
    }
}

/// Build the flat data map used by eval.rs for class attribute and matrix access.
///
/// For a class `item` with numeric attributes [value, weight] and N objects, produces:
///   "item.value" → [v1, v2, ..., vN]
///   "item.weight" → [w1, w2, ..., wN]
///   "item.row1"   → [v1, w1]
///   "item.row2"   → [v2, w2]
fn build_data_map(classes: &[RawClass], objects: &[RawInstance]) -> Result<HashMap<String, Vec<f64>>> {
    let mut out = HashMap::new();

    for class in classes {
        let rows: Vec<&RawInstance> = objects
            .iter()
            .filter(|o| o.class == class.symbol)
            .collect();
        // Example:
        // rows = [
        //   {class: "item", attributes: [{attribute: "value", value: 10}, {attribute: "weight", value: 2}]},
        //   {class: "item", attributes: [{attribute: "value", value: 20}, {attribute: "weight", value: 3}]},
        //   ... ]

        let numeric_attrs: Vec<&str> = class
            .attributes
            .iter()
            .map(|a| a.symbol.as_str())
            .filter(|attr| {
                rows.iter().any(|row| {
                    row.attributes
                        .iter()
                        .find(|ia| ia.attribute == *attr)
                        .and_then(|ia| ia.value.as_f64())
                        .is_some()
                })
            })
            .collect();
        // Example:
        // numeric_attrs = ["value", "weight"]

        // Column vectors: "ClassName.attr" → [row1_val, row2_val, ...]
        for attr in &numeric_attrs {
            let column: Result<Vec<f64>> = rows
                .iter()
                .map(|row| {
                    row.attributes
                        .iter()
                        .find(|ia| ia.attribute == *attr)
                        .and_then(|ia| ia.value.as_f64())
                        .ok_or_else(|| {
                            anyhow!(
                                "Missing numeric attribute '{}' in class '{}'",
                                attr,
                                class.symbol
                            )
                        })
                })
                .collect();

            out.insert(format!("{}.{}", class.symbol, attr), column?);
        }
        // Example:
        // columns = {
        //   "item.value" → [10, 20, ...],
        //   "item.weight" → [2, 3, ...] }
        //
        // out = {
        //   "item.value" → [10, 20, ...],
        //   "item.weight" → [2, 3, ...] }

        // Row vectors: "ClassName.rowN" → [numeric attr values only]
        for (i, row) in rows.iter().enumerate() {
            let row_values: Result<Vec<f64>> = numeric_attrs
                .iter()
                .map(|attr| {
                    row.attributes
                        .iter()
                        .find(|ia| ia.attribute == *attr)
                        .and_then(|ia| ia.value.as_f64())
                        .ok_or_else(|| {
                            anyhow!(
                                "Missing numeric attribute '{}' in class '{}'",
                                attr,
                                class.symbol
                            )
                        })
                })
                .collect();

            out.insert(format!("{}.row{}", class.symbol, i + 1), row_values?);
        }
        // row_values = {
        //   "item.row1" → [10, 2],
        //   "item.row2" → [20, 3], ... }
        // out = {
        //   "item.value" → [10, 20, ...],
        //   "item.weight" → [2, 3, ...],
        //   "item.row1" → [10, 2],
        //   "item.row2" → [20, 3], ... }
    }

    Ok(out)
}

fn resolve_size(value: &serde_json::Value, params: &HashMap<String, f64>) -> Result<usize> {
    match value {
        serde_json::Value::Number(n) => {
            let n = n
                .as_u64()
                .ok_or_else(|| anyhow!("Size must be a positive integer"))?;
            Ok(n as usize)
        }
        serde_json::Value::String(name) => {
            let n = params
                .get(name)
                .copied()
                .ok_or_else(|| anyhow!("Unknown size parameter '{}'", name))?;
            Ok(n as usize)
        }
        _ => bail!("Size must be a number or a parameter name"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load(json: &str) -> Problem {
        let v: serde_json::Value = serde_json::from_str(json).expect("parse json");
        Problem::try_from(v).expect("build problem")
    }

    // Basic examples (small, used in other test modules too)

    #[test]
    fn tsp_builds_and_evaluates() {
        let p = load(include_str!("../../examples/tsp.json"));
        assert_eq!(p.var_size(), 4);
        assert!(p.is_permutation());
        assert_eq!(p.sense(), Sense::Minimize);

        let sol = Solution::Permutation(vec![0, 1, 2, 3]);
        let goals = p.eval_goals(&sol).unwrap();
        assert!((goals[0] - 75.0).abs() < 1e-6, "expected 75, got {}", goals[0]);
        assert!(p.is_feasible(&sol).unwrap());
    }

    #[test]
    fn knapsack_builds_and_evaluates() {
        let p = load(include_str!("../../examples/knapsack.json"));
        assert!(!p.is_permutation());
        assert_eq!(p.sense(), Sense::Maximize);

        let sol = Solution::Vector(vec![0.0; p.var_size()]);
        assert!(p.is_feasible(&sol).unwrap());
        assert_eq!(p.score(&sol).unwrap(), 0.0);
    }

    // Complex examples — the three problem families we support

    #[test]
    fn knapsack_complex_evaluates_correctly() {
        let p = load(include_str!("../../examples/knapsack_complex.json"));
        assert_eq!(p.var_size(), 10);
        assert!(!p.is_permutation());
        assert_eq!(p.sense(), Sense::Maximize);

        // All zeros → feasible, score 0
        let empty = Solution::Vector(vec![0.0; 10]);
        assert!(p.is_feasible(&empty).unwrap());
        assert_eq!(p.score(&empty).unwrap(), 0.0);

        // Item 9 alone (value=35, weight=1) → feasible, score 35
        let mut pick_9 = vec![0.0; 10];
        pick_9[8] = 1.0;
        let sol = Solution::Vector(pick_9);
        assert!(p.is_feasible(&sol).unwrap());
        assert_eq!(p.score(&sol).unwrap(), 35.0);

        // All ones → total weight = 25 (> MaxWeight=40? let's check)
        // weights: 2+3+4+2+3+4+3+2+1+1 = 25 <= 40, so feasible
        let all = Solution::Vector(vec![1.0; 10]);
        assert!(p.is_feasible(&all).unwrap());
    }

    #[test]
    fn assignment_complex_evaluates_correctly() {
        let p = load(include_str!("../../examples/assignment_complex.json"));
        assert_eq!(p.var_size(), 9);
        assert!(p.is_permutation());
        assert_eq!(p.sense(), Sense::Minimize);

        // Identity permutation [0..8] → each agent i gets task i+1
        // Optimal diagonal: 6+4+20+18+17+16+15+14+23 is NOT identity
        // Identity [1,2,3,4,5,6,7,8,9] in 1-based → [0,1,2,3,4,5,6,7,8] in 0-based
        // cost[1,1]=14, cost[2,2]=20, cost[3,3]=20, ...
        let identity = Solution::Permutation(vec![0, 1, 2, 3, 4, 5, 6, 7, 8]);
        assert!(p.is_feasible(&identity).unwrap());
        let score = p.score(&identity).unwrap();
        assert!(score > 0.0);

        // Best known: agent i → task i (diagonal has lowest costs)
        // cost row1: task_2=6 is cheapest → agent 1 should go to task 2
        // Just verify it evaluates without error
        let best = Solution::Permutation(vec![1, 0, 2, 3, 4, 5, 6, 7, 8]);
        let best_score = p.score(&best).unwrap();
        assert!(p.is_better(best_score, score), "swapping agent 1 and 2 should improve cost");
    }

    #[test]
    fn tsp_complex_evaluates_correctly() {
        let p = load(include_str!("../../examples/tsp_complex.json"));
        assert_eq!(p.var_size(), 7);
        assert!(p.is_permutation());
        assert_eq!(p.sense(), Sense::Minimize);

        // Identity tour [0,1,2,3,4,5,6] → cities 1→2→3→4→5→6→7→1
        let identity = Solution::Permutation(vec![0, 1, 2, 3, 4, 5, 6]);
        assert!(p.is_feasible(&identity).unwrap());
        let score = p.score(&identity).unwrap();
        assert!(score > 0.0, "tour cost should be positive");
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