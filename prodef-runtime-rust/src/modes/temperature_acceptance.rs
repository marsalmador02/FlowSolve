//! Mode: `temperature-acceptance`.
//!
//! Simple simulated annealing acceptance rule: compare two candidate vectors
//! and decide whether to accept the new candidate based on score and temperature.

use anyhow::{Context, Result};
use rand::Rng;
use serde_json::{json, Value};

use crate::api::parse::{payload_object, parse_candidate, vec_to_solution};
use crate::domain::Solution;
use crate::api::response::build_solver_result;
use crate::modes::context::{ModeContext, ModeOutcome};

/// Simulated Annealing acceptance: decide if `candidate` replaces `stored`.
///
/// Payload: `{ "candidate": [v1, v2, ...], "stored": [v1, v2, ...], "temperatureCurrent": float }`
/// Returns: `{ "accepted": bool, "winner": [best_vector] }`
pub(crate) fn execute(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let obj = payload_object(ctx.payload)?;

    let candidate_value = obj
        .get("candidate")
        .context("temperature-acceptance requires `candidate` value")?;
    let stored_value = obj
        .get("stored")
        .context("temperature-acceptance requires `stored` value")?;

    let candidate_solution = parse_solution_like(ctx.runtime, candidate_value, "candidate")?;
    let stored_solution = parse_solution_like(ctx.runtime, stored_value, "stored")?;

    // Accept temperature from payload (sent by UI as temperatureCurrent)
    let temperature = obj
        .get("temperatureCurrent")
        .or_else(|| obj.get("temperature"))  // Fallback for backwards compat
        .and_then(Value::as_f64)
        .unwrap_or(1.0)
        .max(0.0);

    let candidate_score = ctx.runtime.objective_score(&candidate_solution)?;
    let stored_score = ctx.runtime.objective_score(&stored_solution)?;

    let is_better = ctx.runtime.is_better_score(candidate_score, stored_score);
    let delta = (stored_score - candidate_score).abs();
    let accept_prob = if is_better { 1.0 } else if temperature > 0.0 { (-delta / temperature).exp() } else { 0.0 };

    let accepted = is_better || (ctx.rng.gen::<f64>() < accept_prob);
    let winner_solution = if accepted { candidate_solution } else { stored_solution };
    let winner_json = build_solver_result(ctx.runtime, &winner_solution)?;

    Ok(ModeOutcome::with_payload(json!({
        "accepted": accepted,
        "winner": winner_json,
    })))
}

fn parse_solution_like(runtime: &crate::domain::RuntimeProblem, value: &Value, label: &str) -> Result<Solution> {
    if let Some(array) = value.as_array() {
        let vec = array.iter().map(|v| v.as_f64().unwrap_or(0.0)).collect::<Vec<f64>>();
        return vec_to_solution(runtime, &vec).context(format!("{label} vector is invalid"));
    }

    parse_candidate(runtime, value).context(format!("{label} object is invalid or missing `variableValue`"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::prelude::StdRng;
    use serde_json::json;

    #[test]
    fn temperature_acceptance_accepts_better_candidate() {
        let raw: crate::domain::model::Problem = serde_json::from_str(include_str!("../../../examples/knapsack.json")).expect("parse knapsack");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);

        let payload = json!({ "candidate": [1,1,1,1,0], "stored": [0,0,0,0,0], "temperature": 1.0 });
        let ctx = ModeContext { runtime: &runtime, payload: &payload, rng: &mut rng };

        let outcome = execute(ctx).expect("execute");
        let p = outcome.payload.expect("payload");
        assert!(p.get("accepted").and_then(|v| v.as_bool()).unwrap_or(false));
        let winner = p.get("winner").expect("winner field");
        let winner_values = winner
            .get("variableValue")
            .and_then(|v| v.as_array())
            .expect("winner.variableValue array");
        assert_eq!(winner_values.len(), 5);
    }
}
