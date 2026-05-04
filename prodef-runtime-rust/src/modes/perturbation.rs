//! Mode: `perturbation`.
//!
//! Payload/response contract is documented in this module and summarized in `modes::mod`.

use anyhow::{Context, Result};
use serde_json::{json, Value};

use crate::api::parse::{
    parse_solution_from_value, payload_object, solution_to_f64_vec, vec_to_solution,
};
use crate::api::response::solver_result_json;
use crate::modes::context::{ModeContext, ModeOutcome};

/// Apply sequential perturbations to a `base` solution.
///
/// The mode will attempt up to `maxAttempts` candidate perturbations and
/// perform `k` sequential perturbation steps. Returns the final `winner`.
use crate::operators::{
    apply_random_bitflip, apply_random_swap, variable_flags, PERTURB_INNER_MAX_TRIES,
};

pub(crate) fn execute(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let obj = payload_object(ctx.payload)?;
    let base_candidate = obj
        .get("base")
        .context("perturbation payload requires `base`")?;
    let variable_value = base_candidate
        .get("variableValue")
        .context("perturbation base requires variableValue[]")?;
    let base_solution = parse_solution_from_value(ctx.runtime, variable_value)?;

    let max_attempts: usize = obj
        .get("maxAttempts")
        .and_then(Value::as_i64)
        .map(|v| v.max(1) as usize)
        .unwrap_or(200);

    let neighborhood_k: usize = obj
        .get("k")
        .and_then(Value::as_i64)
        .map(|v| v.max(1) as usize)
        .or_else(|| obj.get("neighborhood").and_then(Value::as_i64).map(|v| v.max(1) as usize))
        .unwrap_or(1);

    let (_, is_binary) = variable_flags(ctx.runtime);

    let mut current = base_solution.clone();
    let mut attempts_made: usize = 0;

    for _step in 0..neighborhood_k {
        let source_vec = solution_to_f64_vec(&current);
        for _ in 0..PERTURB_INNER_MAX_TRIES {
            if attempts_made >= max_attempts {
                break;
            }

            let candidate_vec = if is_binary {
                apply_random_bitflip(&source_vec, ctx.rng)
            } else {
                apply_random_swap(&source_vec, ctx.rng)
            };

            attempts_made += 1;

            if let Some(candidate) = vec_to_solution(ctx.runtime, &candidate_vec) {
                if ctx.runtime.is_feasible(&candidate).unwrap_or(false) {
                    current = candidate;
                    break;
                }
            }
        }

        if attempts_made >= max_attempts {
            break;
        }
    }

    let picked = current;
    let attempts_used = attempts_made.min(max_attempts);

    let winner = solver_result_json(ctx.runtime, &picked)?;

    Ok(ModeOutcome::with_payload(json!({
        "winner": winner,
        "attempts": attempts_used,
        "maxAttempts": max_attempts,
        "k": neighborhood_k,
    })))
}
