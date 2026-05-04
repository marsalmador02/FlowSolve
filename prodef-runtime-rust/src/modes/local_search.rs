//! Mode: `local-search`.
//!
//! Payload/response contract is documented in this module and summarized in `modes::mod`.

use anyhow::{Context, Result};

use crate::api::parse::{parse_solution_from_value, payload_object};
use crate::api::response::build_solver_result;
use crate::modes::context::{ModeContext, ModeOutcome};
use crate::search;
/// Run a local search starting from `solution` provided in the payload.
///
/// Returns the improved solution as `result`.
pub(crate) fn execute(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let obj = payload_object(ctx.payload)?;
    let solution_value = obj
        .get("solution")
        .context("local-search payload requires `solution` array")?;
    let start = parse_solution_from_value(ctx.runtime, solution_value)?;
    let (improved, _trace) = search::run(ctx.runtime, start)?;
    Ok(ModeOutcome::with_result(build_solver_result(
        ctx.runtime,
        &improved,
    )?))
}
