//! # Mode: `select-best`
//!
//! Picks the best feasible candidate from a list.
//!
//! If no candidate is feasible, falls back to the first parseable one so that the caller
//! always receives something to work with.
//!
//! ## Request payload
//!
//! ```json
//! {
//!   "candidates": [
//!     { "variableValue": [1, 0, 0, 0, 0] },
//!     { "variableValue": [1, 1, 1, 1, 0] },
//!     { "variableValue": [1, 1, 1, 1, 1] }
//!   ]
//! }
//! ```
//!
//! ## Response
//!
//! ```json
//! {
//!   "winner":        { "isFeasible": true, "goalValues": […], "variableValue": […] },
//!   "selectedIndex": 1,
//!   "score":         42.0
//! }
//! ```

use anyhow::{Context, Result};
use rand::rngs::ThreadRng;
use serde_json::{json, Value};
 
use crate::problem::Problem;
use crate::solution::{require_object, Solution, SolverResult};

/// Entry point called by the mode dispatcher in [`crate::api`].
///
/// Iterates over `candidates`, evaluates each feasible one and returns the one with
/// the best objective score.
pub fn select_best(
    problem: &Problem,
    payload: &Value,
    _rng: &mut ThreadRng,
) -> Result<Value> {
    let obj = require_object(payload)?;
    let candidates = obj
        .get("candidates")
        .and_then(Value::as_array)
        .filter(|a| !a.is_empty())
        .context("select-best payload requires a non-empty `candidates` array")?;

    let worst = if problem.sense() == crate::problem::Sense::Maximize {
        f64::NEG_INFINITY
    } else {
        f64::INFINITY
    };

    let mut best_idx: Option<usize> = None;
    let mut best_score = worst;
    let mut fallback: Option<(usize, Solution)> = None;

    for (idx, candidate) in candidates.iter().enumerate() {
        let Some(solution) = Solution::from_candidate(problem, candidate) else {
            continue;
        };
        if fallback.is_none() {
            fallback = Some((idx, solution.clone()));
        }
        if !problem.is_feasible(&solution).unwrap_or(false) {
            continue;
        }
        if let Ok(score) = problem.score(&solution) {
            if problem.is_better(score, best_score) {
                best_score = score;
                best_idx = Some(idx);
            }
        }
    }

    let (winner_idx, winner_solution) = match best_idx {
        Some(idx) => (idx, Solution::from_candidate(problem, &candidates[idx]).unwrap()),
        None => fallback.context("select-best could not parse any candidate")?,
    };

    let score = problem.score(&winner_solution).ok();
    let winner = serde_json::to_value(SolverResult::build(problem, &winner_solution)?)?;

    Ok(json!({
        "winner": winner,
        "selectedIndex": winner_idx,
        "score": score,
    }))
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
    fn picks_best_feasible_candidate() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let payload = json!({
            "candidates": [
                { "variableValue": [1,0,0,0,0] },
                { "variableValue": [1,1,1,1,0] },
                { "variableValue": [1,1,1,1,1] }
            ]
        });
        let result = select_best(&p, &payload, &mut rng).unwrap();
        assert_eq!(result["selectedIndex"], 1);
        assert!(result["winner"].get("isFeasible").unwrap().as_bool().unwrap());
    }

    #[test]
    fn all_infeasible_returns_fallback() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let payload = json!({
            "candidates": [
                { "variableValue": [1,1,1,1,1] },
                { "variableValue": [1,1,1,1,1] }
            ]
        });
        let result = select_best(&p, &payload, &mut rng).unwrap();
        assert_eq!(result["selectedIndex"], 0);
    }

    #[test]
    fn empty_candidates_returns_error() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let payload = json!({ "candidates": [] });
        assert!(select_best(&p, &payload, &mut rng).is_err());
    }
}