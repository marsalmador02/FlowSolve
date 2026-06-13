// solution.rs
//
// Everything related to representing, converting, and building results
// for a single solution.
//
// Replaces: domain/solution.rs, domain/result.rs, api/response.rs,
//           and the parse/serialize helpers from api/parse.rs.

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::problem::Problem;

// ── Solution ─────────────────────────────────────────────────────────────────

/// A solution in runtime (internal) coordinates.
///
/// - `Vector` is used for binary, integer, and continuous problems.
/// - `Permutation` stores 0-based positions; the external JSON contract
///   always uses 1-based indices (handled in `to_json` / `from_json`).
#[derive(Clone, Debug)]
pub(crate) enum Solution {
    Vector(Vec<f64>),
    Permutation(Vec<usize>),
}

impl Solution {
    /// Serialize to the JSON shape returned by the API.
    ///
    /// Permutations are converted to 1-based so the UI always sees [1..N].
    /// Vectors are returned as-is.
    pub(crate) fn to_json(&self) -> Value {
        match self {
            Solution::Vector(v) => json!(v),
            Solution::Permutation(p) => {
                let one_based: Vec<usize> = p.iter().map(|x| x + 1).collect();
                json!(one_based)
            }
        }
    }

    /// Parse a solution from a JSON array, using the problem shape as the
    /// contract for length and type.
    ///
    /// Permutations are accepted in either 0-based or 1-based form and
    /// normalized to 0-based internally. Wrong lengths, duplicates, and
    /// non-integer values are rejected.
    pub(crate) fn from_json(problem: &Problem, value: &Value) -> Result<Self> {
        let arr = value
            .as_array()
            .context("variableValue must be an array")?;

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

    /// Parse the `variableValue` field out of a candidate JSON object.
    ///
    /// Returns `None` if the field is missing or the value cannot be parsed.
    /// The silent failure is intentional — modes that receive a list of
    /// candidates skip unparseable entries rather than failing entirely.
    pub(crate) fn from_candidate(problem: &Problem, candidate: &Value) -> Option<Self> {
        if let Some(v) = candidate.get("variableValue") {
            return Self::from_json(problem, v).ok();
        }

        if candidate.is_array() {
            return Self::from_json(problem, candidate).ok();
        }

        None
    }
}

// ── SolverResult ─────────────────────────────────────────────────────────────

/// The result of evaluating a single solution, ready to serialize to JSON.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct SolverResult {
    #[serde(rename = "problemName")]
    pub(crate) problem_name: String,
    #[serde(rename = "isFeasible")]
    pub(crate) is_feasible: bool,
    #[serde(rename = "goalValues")]
    pub(crate) goal_values: Vec<f64>,
    #[serde(rename = "variableValue")]
    pub(crate) variable_value: Value,
}

impl SolverResult {
    /// Evaluate a solution against a problem and build the full result.
    pub(crate) fn build(problem: &Problem, solution: &Solution) -> Result<Self> {
        Ok(Self {
            problem_name: problem.name.clone(),
            is_feasible: problem.is_feasible(solution)?,
            goal_values: problem.eval_goals(solution)?,
            variable_value: solution.to_json(),
        })
    }
}

// ── Payload helpers ───────────────────────────────────────────────────────────

/// Require that `payload` is a JSON object and return a reference to it.
///
/// This is used at the top of every mode handler to get a typed handle on
/// the payload before reading individual fields.
pub(crate) fn require_object(payload: &Value) -> Result<&Map<String, Value>> {
    payload
        .as_object()
        .context("execution.payload must be a JSON object")
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
    fn permutation_round_trips_through_json() {
        let p = tsp();
        // Internal 0-based permutation
        let sol = Solution::Permutation(vec![0, 1, 2, 3]);
        // to_json should produce 1-based [1,2,3,4]
        let json = sol.to_json();
        assert_eq!(json, json!([1, 2, 3, 4]));
        // from_json with 1-based input should normalize back to 0-based
        let parsed = Solution::from_json(&p, &json).unwrap();
        match parsed {
            Solution::Permutation(perm) => assert_eq!(perm, vec![0, 1, 2, 3]),
            _ => panic!("expected permutation"),
        }
    }

    #[test]
    fn permutation_accepts_0_based_input() {
        let p = tsp();
        let json = json!([0, 1, 2, 3]);
        let parsed = Solution::from_json(&p, &json).unwrap();
        match parsed {
            Solution::Permutation(perm) => assert_eq!(perm, vec![0, 1, 2, 3]),
            _ => panic!("expected permutation"),
        }
    }

    #[test]
    fn vector_round_trips_through_json() {
        let p = knapsack();
        let sol = Solution::Vector(vec![1.0, 0.0, 1.0, 0.0, 1.0]);
        let json = sol.to_json();
        let parsed = Solution::from_json(&p, &json).unwrap();
        match parsed {
            Solution::Vector(v) => assert_eq!(v, vec![1.0, 0.0, 1.0, 0.0, 1.0]),
            _ => panic!("expected vector"),
        }
    }

    #[test]
    fn wrong_length_is_rejected() {
        let p = knapsack(); // var_size = 5
        let json = json!([1, 0, 1]); // length 3
        assert!(Solution::from_json(&p, &json).is_err());
    }

    #[test]
    fn from_candidate_returns_none_on_missing_field() {
        let p = knapsack();
        let candidate = json!({ "isFeasible": true }); // no variableValue
        assert!(Solution::from_candidate(&p, &candidate).is_none());
    }

    #[test]
    fn solver_result_build() {
        let p = knapsack();
        let sol = Solution::Vector(vec![0.0; p.var_size()]);
        let result = SolverResult::build(&p, &sol).unwrap();
        assert!(result.is_feasible);
        assert_eq!(result.goal_values, vec![0.0]);
        assert_eq!(result.variable_value, json!([0.0, 0.0, 0.0, 0.0, 0.0]));
    }
}