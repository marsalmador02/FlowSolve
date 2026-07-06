//! # Mode: `temperature-acceptance`
//!
//! Implements the simulated annealing acceptance rule.
//!
//! - A better candidate is always accepted.
//! - A worse candidate is accepted with probability `exp(-Δ / T)`, where `Δ > 0` is how
//!   much worse it is and `T` is the current temperature.
//!
//! ## Request payload
//!
//! ```json
//! {
//!   "candidate":          [1, 1, 1, 1, 0],
//!   "stored":             [0, 0, 0, 0, 0],
//!   "temperatureCurrent": 50.0
//! }
//! ```
//!
//! ## Response
//!
//! ```json
//! {
//!   "accepted": true,
//!   "winner":   { "isFeasible": true, "goalValues": […], "variableValue": […] }
//! }
//! ```

use anyhow::{Context, Result};
use rand::rngs::ThreadRng;
use rand::Rng;
use serde_json::{json, Value};

use crate::problem::{Problem, Sense};
use crate::solution::{require_object, Solution, SolverResult};

/// Entry point called by the mode dispatcher in [`crate::api`].
///
/// Computes the score delta between `candidate` and `stored`, then applies the
/// Metropolis acceptance criterion.
pub fn temperature_acceptance(
    problem: &Problem,
    payload: &Value,
    rng: &mut ThreadRng,
) -> Result<Value> {
    let obj = require_object(payload)?;

    let candidate_val = obj
        .get("candidate")
        .context("temperature-acceptance requires `candidate`")?;
    let stored_val = obj
        .get("stored")
        .context("temperature-acceptance requires `stored`")?;

    let candidate = parse_solution(problem, candidate_val, "candidate")?;
    let stored = parse_solution(problem, stored_val, "stored")?;

    let temperature = obj
        .get("temperatureCurrent")
        .and_then(Value::as_f64)
        .unwrap_or(100.0)
        .max(0.0);

    let candidate_score = problem.score(&candidate)?;
    let stored_score = problem.score(&stored)?;

    let delta = match problem.sense() {
        Sense::Maximize => stored_score - candidate_score,
        Sense::Minimize => candidate_score - stored_score,
    };

    let accepted = if delta <= 0.0 {
        true
    } else {
        let t = temperature.max(1e-12);
        rng.gen::<f64>() < (-delta / t).exp()
    };

    let winner = if accepted { candidate } else { stored };
    let winner_result = serde_json::to_value(SolverResult::build(problem, &winner)?)?;

    Ok(json!({
        "accepted": accepted,
        "winner": winner_result,
    }))
}

/// Parse a solution from a value that is either a bare array or a candidate object.
fn parse_solution(problem: &Problem, value: &Value, label: &str) -> Result<Solution> {
    if value.is_array() {
        return Solution::from_json(problem, value)
            .with_context(|| format!("`{}` array is not a valid solution", label));
    }
    Solution::from_candidate(problem, value)
        .with_context(|| format!("`{}` object is missing or invalid `variableValue`", label))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn knapsack() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../examples/knapsack.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    #[test]
    fn accepts_better_candidate() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let payload = json!({
            "candidate": [1,1,1,1,0],
            "stored":    [0,0,0,0,0],
            "temperatureCurrent": 1.0
        });
        let result = temperature_acceptance(&p, &payload, &mut rng).unwrap();
        assert!(result["accepted"].as_bool().unwrap());
        assert_eq!(result["winner"]["variableValue"].as_array().unwrap().len(), 5);
    }

    #[test]
    fn always_accepts_equal_score() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let payload = json!({
            "candidate": [0,0,0,0,0],
            "stored":    [0,0,0,0,0],
            "temperatureCurrent": 0.001
        });
        let result = temperature_acceptance(&p, &payload, &mut rng).unwrap();
        assert!(result["accepted"].as_bool().unwrap());
    }

    #[test]
    fn rejects_worse_candidate_at_zero_temperature() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let payload = json!({
            "candidate": [0,0,0,0,0],
            "stored":    [0,0,0,1,0],
            "temperatureCurrent": 0.0
        });
        let result = temperature_acceptance(&p, &payload, &mut rng).unwrap();
        assert!(!result["accepted"].as_bool().unwrap());
    }

    #[test]
    fn rejected_candidate_returns_stored_as_winner() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let payload = json!({
            "candidate": [0,0,0,0,0],
            "stored":    [0,0,0,1,0],
            "temperatureCurrent": 0.0
        });
        let result = temperature_acceptance(&p, &payload, &mut rng).unwrap();
        if !result["accepted"].as_bool().unwrap() {
            let vals = result["winner"]["variableValue"].as_array().unwrap();
            assert_eq!(vals[3].as_f64().unwrap(), 1.0, "winner should be stored when candidate is rejected");
        }
    }
}