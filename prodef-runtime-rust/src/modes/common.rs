use anyhow::Result;
use serde_json::Value;

use crate::api::response::solver_result_json;
use crate::domain::{RuntimeProblem, Solution};

/// Convert a list of runtime solutions into JSON solver results.
pub(crate) fn solutions_as_json_values(
    runtime: &RuntimeProblem,
    solutions: &[Solution],
) -> Result<Vec<Value>> {
    solutions
        .iter()
        .map(|s| solver_result_json(runtime, s))
        .collect()
}
