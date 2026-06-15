// modes/temperature_acceptance.rs
//
// Mode: `temperature-acceptance`
//
// Simulated annealing acceptance rule.
// Always accepts improvements; accepts worse candidates with probability
// exp(-delta / T) where delta > 0 means the candidate is worse.
//
// Payload:
//   {
//     "candidate":           [...] or { "variableValue": [...] }
//     "stored":              [...] or { "variableValue": [...] }
//     "temperatureCurrent":  float  (default 100.0)
//   }
//
// Response:
//   { "accepted": bool, "winner": SolverResult }

use anyhow::{Context, Result};
use rand::rngs::ThreadRng;
use rand::Rng;
use serde_json::{json, Value};

use crate::problem::{Problem, Sense};
use crate::solution::{require_object, Solution, SolverResult};

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

    // delta > 0 means the candidate is worse than what is stored.
    let delta = match problem.sense() {
        Sense::Maximize => stored_score - candidate_score,
        Sense::Minimize => candidate_score - stored_score,
    };

    let accepted = if delta <= 0.0 {
        true // candidate is better or equal — always accept
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

/// Accept a solution supplied either as a bare array or as a candidate object.
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
    use rand::rngs::ThreadRng;
    use rand::SeedableRng;
    use serde_json::json;

    fn knapsack() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../../examples/knapsack.json")).unwrap();
        Problem::try_from(v).unwrap()
    }

    #[test]
    fn accepts_better_candidate() {
        let p = knapsack();
        let mut rng = StdRng::seed_from_u64(42);
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
        let mut rng = StdRng::seed_from_u64(42);
        let payload = json!({
            "candidate": [0,0,0,0,0],
            "stored":    [0,0,0,0,0],
            "temperatureCurrent": 0.001
        });
        let result = temperature_acceptance(&p, &payload, &mut rng).unwrap();
        // delta == 0 → always accept
        assert!(result["accepted"].as_bool().unwrap());
    }
}