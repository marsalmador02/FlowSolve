//! Mode: `select-best`.
//!
//! Payload/response contract is documented in this module and summarized in `modes::mod`.

use anyhow::{Context, Result};
use serde_json::json;

use crate::api::parse::{parse_candidate, payload_object};
use crate::api::response::solver_result_json;
use crate::api::validation;
use crate::modes::context::{ModeContext, ModeOutcome};

/// Select the best feasible candidate from `candidates[]`.
///
/// Payload: `candidates[]` (array of candidate solver results).
/// Returns: `winner`, `selectedIndex`, and `score`.
pub(crate) fn execute(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let obj = payload_object(ctx.payload)?;
    let candidates = validation::non_empty_array_in_obj(obj, "candidates", "select-best")?;

    let is_maximize = ctx.runtime.is_maximize();
    let mut best_idx: Option<usize> = None;
    let mut best_score = if is_maximize {
        f64::NEG_INFINITY
    } else {
        f64::INFINITY
    };
    let mut fallback_solution = None;

    for (idx, candidate) in candidates.iter().enumerate() {
        let Some(solution) = parse_candidate(ctx.runtime, candidate) else {
            continue;
        };
        if fallback_solution.is_none() {
            fallback_solution = Some((idx, solution.clone()));
        }
        if !ctx.runtime.is_feasible(&solution).unwrap_or(false) {
            continue;
        }
        if let Ok(score) = ctx.runtime.objective_score(&solution) {
            if ctx.runtime.is_better_score(score, best_score) {
                best_score = score;
                best_idx = Some(idx);
            }
        }
    }

    let (winner_idx, winner_solution) = if let Some(idx) = best_idx {
        (idx, parse_candidate(ctx.runtime, &candidates[idx]).unwrap())
    } else {
        fallback_solution.context("select-best could not parse any candidate variableValue[]")?
    };

    let winner = solver_result_json(ctx.runtime, &winner_solution)?;
    let score = ctx.runtime.objective_score(&winner_solution).ok();

    Ok(ModeOutcome::with_payload(json!({
        "winner": winner,
        "selectedIndex": winner_idx,
        "score": score,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use rand::SeedableRng;
    use rand::prelude::StdRng;

    #[test]
    fn select_best_picks_feasible_winner() {
        let raw: crate::domain::model::Problem = serde_json::from_str(include_str!("../../examples/knapsack.json")).expect("parse knapsack example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);

        let candidates = json!({ "candidates": [ { "variableValue": [1,0,0,0,0] }, { "variableValue": [1,1,1,1,0] }, { "variableValue": [1,1,1,1,1] } ] });
        let ctx = ModeContext { runtime: &runtime, payload: &candidates, rng: &mut rng };

        let outcome = execute(ctx).expect("select-best execute");
        let payload = outcome.payload.expect("payload present");
        let idx = payload.get("selectedIndex").and_then(|v| v.as_u64()).expect("selectedIndex");
        assert_eq!(idx, 1);
        assert!(payload.get("winner").is_some());
    }
}
