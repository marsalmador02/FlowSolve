// solution.rs — solution types, JSON conversion, and solver result.

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::problem::Problem;

/// A solution in runtime coordinates.
///
/// `Vector` is used for binary, integer, and continuous problems.
/// `Permutation` stores 0-based positions; the external JSON contract
/// always uses 1-based indices (see `to_json` / `from_json`).
#[derive(Clone, Debug)]
pub enum Solution {
    Vector(Vec<f64>),
    Permutation(Vec<usize>),
}

impl Solution {
    /// Serialize to the JSON shape returned by the API.
    /// Permutations are converted to 1-based; vectors are returned as-is.
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
    /// Permutations are accepted in either 0-based or 1-based form and
    /// normalized to 0-based internally. Wrong lengths and non-integer
    /// values are rejected.
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
            // Accept both 0-based [0..N-1] and 1-based [1..N]; normalize to 0-based.
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
                        .ok_or_else(|| anyhow!("Vector must contain integers"))
                        .map(|n| n as f64)
                })
                .collect::<Result<Vec<f64>>>()?;
            Ok(Solution::Vector(values))
        }
    }

    /// Parse the `variableValue` field from a candidate JSON object,
    /// or accept a bare array directly.
    ///
    /// Returns `None` if the value is missing or unparseable — callers that
    /// iterate over a list of candidates skip bad entries rather than failing.
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

/// The result of evaluating a single solution, ready to serialize to JSON.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SolverResult {
    #[serde(rename = "problemName")]
    pub problem_name: String,
    #[serde(rename = "isFeasible")]
    pub is_feasible: bool,
    #[serde(rename = "goalValues")]
    pub goal_values: Vec<f64>,
    #[serde(rename = "variableValue")]
    pub variable_value: Value,
}

impl SolverResult {
    pub fn build(problem: &Problem, solution: &Solution) -> Result<Self> {
        Ok(Self {
            problem_name: problem.name.clone(),
            is_feasible: problem.is_feasible(solution)?,
            goal_values: problem.eval_goals(solution)?,
            variable_value: solution.to_json(),
        })
    }
}

/// Require that `payload` is a JSON object — used at the top of every mode handler.
pub fn require_object(payload: &Value) -> Result<&Map<String, Value>> {
    payload.as_object().context("execution.payload must be a JSON object")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tsp() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../examples/tsp.json")).unwrap();
        Problem::try_from(v).unwrap()
    }

    fn knapsack() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../examples/knapsack.json")).unwrap();
        Problem::try_from(v).unwrap()
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