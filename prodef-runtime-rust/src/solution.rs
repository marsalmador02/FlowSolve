//! # Solution types, JSON conversion, and evaluated result
//!
//! This module defines how solutions are represented in memory, how they are
//! serialised to JSON (sent back to the caller), and how they are deserialised
//! from JSON (received in request payloads).
//!
//! ## Solution variants
//!
//! | Variant | Used for |
//! |---------|----------|
//! | [`Solution::Vector`] | Binary, integer, or continuous variables |
//! | [`Solution::Permutation`] | Ordering / routing problems (TSP, …) |
//!
//! Permutations are stored **0-based** in memory but the JSON API always
//! sends and receives **1-based** indices.

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::problem::Problem;

/// A solution in runtime (in-memory) coordinates.
///
/// - `Vector` — a list of numeric values; used for binary (`0`/`1`),
///   integer, and continuous decision variables.
/// - `Permutation` — a reordering of `0..N-1`; the external JSON contract
///   always uses 1-based indices (see [`Solution::to_json`] and
///   [`Solution::from_json`]).
#[derive(Clone, Debug)]
pub enum Solution {
    /// A vector of numeric decision variables.
    Vector(Vec<f64>),
    /// A permutation stored with **0-based** positions.
    Permutation(Vec<usize>),
}

impl Solution {
    /// Serialise this solution to the JSON shape returned by the API.
    ///
    /// Permutation elements are shifted to 1-based; vector elements are
    /// returned as-is.
    pub fn to_json(&self) -> Value {
        match self {
            Solution::Vector(v) => json!(v),
            Solution::Permutation(p) => {
                let one_based: Vec<usize> = p.iter().map(|x| x + 1).collect();
                json!(one_based)
            }
        }
    }

    /// Parse a solution from a JSON array.
    ///
    /// Permutations are accepted in either **0-based** or **1-based** form
    /// and normalised to 0-based internally.  Wrong lengths and non-integer
    /// values are rejected with a descriptive error.
    pub fn from_json(problem: &Problem, value: &Value) -> Result<Self> {
        let arr = value.as_array().context("variableValue must be an array")?;

        if arr.len() != problem.var_size() {
            bail!(
                "solution length mismatch: expected {}, got {}",
                problem.var_size(),
                arr.len()
            );
        }

        if problem.is_permutation() {
            let mut values = Vec::with_capacity(arr.len());
            for item in arr {
                let n: usize = item
                    .as_i64()
                    .ok_or_else(|| anyhow!("Permutation must contain integers"))?
                    .try_into()
                    .context("Permutation values must be non-negative")?;
                values.push(n);
            }
            // Accept both 0-based [0..N-1] and 1-based [1..N]; normalise to 0-based.
            let is_1_based = !values.iter().any(|&x| x == 0);
            let perm = if is_1_based {
                values.into_iter().map(|x| x - 1).collect()
            } else {
                values
            };
            Ok(Solution::Permutation(perm))
        } else {
            let values = arr
                .iter()
                .map(|item| {
                    item.as_i64()
                        .map(|n| n as f64)
                        .or_else(|| item.as_f64())
                        .ok_or_else(|| anyhow!("Vector must contain numbers"))
                })
                .collect::<Result<Vec<f64>>>()?;
            Ok(Solution::Vector(values))
        }
    }

    /// Try to parse a solution from a *candidate* JSON value.
    ///
    /// Accepts two shapes:
    /// - An object with a `"variableValue"` field: `{ "variableValue": [...] }`.
    /// - A bare JSON array: `[1, 2, 3]`.
    ///
    /// Returns `None` if the value is missing or cannot be parsed — callers
    /// that iterate over a list of candidates skip bad entries rather than
    /// failing the whole batch.
    pub fn from_candidate(problem: &Problem, candidate: &Value) -> Option<Self> {
        if let Some(v) = candidate.get("variableValue") {
            return Self::from_json(problem, v).ok();
        }
        if candidate.is_array() {
            return Self::from_json(problem, candidate).ok();
        }
        None
    }
}

/// The fully-evaluated result for a single solution, ready to be serialised
/// and returned in the API response.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SolverResult {
    /// Name of the problem that was solved.
    #[serde(rename = "problemName")]
    pub problem_name: String,
    /// Whether all constraints are satisfied.
    #[serde(rename = "isFeasible")]
    pub is_feasible: bool,
    /// Objective / goal values in the same order as declared in the problem.
    #[serde(rename = "goalValues")]
    pub goal_values: Vec<f64>,
    /// The decision variables (1-based for permutations).
    #[serde(rename = "variableValue")]
    pub variable_value: Value,
}

impl SolverResult {
    /// Build a [`SolverResult`] by evaluating `solution` against `problem`.
    pub fn build(problem: &Problem, solution: &Solution) -> Result<Self> {
        Ok(Self {
            problem_name: problem.name.clone(),
            is_feasible: problem.is_feasible(solution)?,
            goal_values: problem.eval_goals(solution)?,
            variable_value: solution.to_json(),
        })
    }
}

/// Require that `payload` is a JSON object.
///
/// Used as the first line in every mode handler to give a clear error
/// when the caller sends a non-object payload.
pub fn require_object(payload: &Value) -> Result<&Map<String, Value>> {
    payload.as_object().context("execution.payload must be a JSON object")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tsp() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../examples/tsp.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    fn knapsack() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../examples/knapsack.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    #[test]
    fn permutation_round_trips_through_json() {
        let p = tsp();
        let sol = Solution::Permutation(vec![0, 1, 2, 3]);
        let json = sol.to_json();
        assert_eq!(json, json!([1, 2, 3, 4]));
        let parsed = Solution::from_json(&p, &json).unwrap();
        match parsed {
            Solution::Permutation(perm) => assert_eq!(perm, vec![0, 1, 2, 3]),
            _ => panic!("expected permutation"),
        }
    }

    #[test]
    fn permutation_accepts_0_based_input() {
        let p = tsp();
        let parsed = Solution::from_json(&p, &json!([0, 1, 2, 3])).unwrap();
        match parsed {
            Solution::Permutation(perm) => assert_eq!(perm, vec![0, 1, 2, 3]),
            _ => panic!("expected permutation"),
        }
    }

    #[test]
    fn vector_round_trips_through_json() {
        let p = knapsack();
        let sol = Solution::Vector(vec![1.0, 0.0, 1.0, 0.0, 1.0]);
        let parsed = Solution::from_json(&p, &sol.to_json()).unwrap();
        match parsed {
            Solution::Vector(v) => assert_eq!(v, vec![1.0, 0.0, 1.0, 0.0, 1.0]),
            _ => panic!("expected vector"),
        }
    }

    #[test]
    fn wrong_length_is_rejected() {
        let p = knapsack();
        assert!(Solution::from_json(&p, &json!([1, 0, 1])).is_err());
    }

    #[test]
    fn from_candidate_returns_none_on_missing_field() {
        let p = knapsack();
        assert!(Solution::from_candidate(&p, &json!({ "isFeasible": true })).is_none());
    }

    #[test]
    fn solver_result_build() {
        let p = knapsack();
        let sol = Solution::Vector(vec![0.0; p.var_size()]);
        let result = SolverResult::build(&p, &sol).unwrap();
        assert!(result.is_feasible);
        assert_eq!(result.goal_values, vec![0.0]);
    }
}