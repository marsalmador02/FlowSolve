//! Mode: `neighborhood`.
//!
//! Input: a base solution in `base.variableValue`.
//! Output: all generated neighbors plus the subset that remains feasible.

use anyhow::{Context, Result};
use serde_json::{json, Value};

use crate::api::parse::{
    parse_solution_from_value, payload_object, solution_to_f64_vec, vec_to_solution,
};
use crate::api::response::solver_result_json;
use crate::modes::context::{ModeContext, ModeOutcome};
use crate::operators::{generate_neighbor_vectors, variable_flags};

/// Generate neighbor solutions from the base candidate and split them by feasibility.
pub(crate) fn execute(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let obj = payload_object(ctx.payload)?;
    let base_candidate = obj.get("base").context("neighborhood payload requires `base`")?;
    let base_value = base_candidate
        .get("variableValue")
        .context("neighborhood payload requires `base.variableValue`")?;
    let base_solution = parse_solution_from_value(ctx.runtime, base_value)?;

    let (is_permutation, is_binary) = variable_flags(ctx.runtime);
    let source_vec = solution_to_f64_vec(&base_solution);
    let generated_vecs =
        generate_neighbor_vectors(&source_vec, is_permutation, is_binary);

    let mut generated: Vec<Value> = Vec::new();
    let mut feasible: Vec<Value> = Vec::new();
    for vars in &generated_vecs {
        if let Some(solution) = vec_to_solution(ctx.runtime, vars) {
            let candidate_json = solver_result_json(ctx.runtime, &solution)?;
            let is_feasible = candidate_json
                .get("isFeasible")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if is_feasible {
                feasible.push(candidate_json.clone());
            }
            generated.push(candidate_json);
        }
    }

    Ok(ModeOutcome::with_payload(json!({
        "generated": generated,
        "feasible": feasible,
    })))
}
