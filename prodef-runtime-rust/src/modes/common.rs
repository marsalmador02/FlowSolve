use anyhow::Result;
use serde_json::Value;

use crate::api::response::solver_result_json;
use crate::domain::{RuntimeProblem, Solution};

// Helper to convert a list of solutions to JSON values for API responses.
pub(crate) fn solutions_as_json_values(
    runtime: &RuntimeProblem,
    solutions: &[Solution],
) -> Result<Vec<Value>> {
    solutions
        .iter()
        .map(|s| solver_result_json(runtime, s))
        .collect()
}
