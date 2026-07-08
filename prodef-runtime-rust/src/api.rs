//! # API layer
//!
//! This module defines the JSON request and response shapes for the API, and dispatches to the correct
//! mode based on the `execution.mode` field.
//!
//! ## Request shape
//!
//! ```json
//! {
//!   "problem":   { … },
//!   "execution": {
//!     "mode":    "generate",
//!     "payload": { … }
//!   }
//! }
//! ```
//!
//! ## Response shape
//!
//!```json
//! {
//!   "result":  { … },
//!   "payload": { … }
//! }
//!```

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
 
use crate::problem::Problem;
use crate::solution::SolverResult;
use crate::modes::{generate, local_search, neighborhood, perturbation, select_best, temperature_acceptance};
 
/// The full JSON body sent by the caller.
#[derive(Deserialize)]
pub struct ExecutionRequest {
    /// Problem definition (variables, objectives, constraints, etc.).
    problem: Value,
    /// What to compute and any extra parameters it needs.
    execution: ExecutionSpec,
}
 
/// The `execution` block inside an [`ExecutionRequest`].
#[derive(Deserialize)]
pub struct ExecutionSpec {
    /// One of: `"generate"`, `"perturbation"`, `"neighborhood"`, `"local-search"`, `"select-best"`,
    /// `"temperature-acceptance"`.
    mode: String,
    /// Mode-specific parameters.
    #[serde(default)]
    payload: Value,
}
 
/// The JSON body returned to the caller.
#[derive(Serialize, Default)]
pub struct ExecutionResponse {
    /// A single evaluated solution.
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<SolverResult>,
    /// Free-form JSON returned by modes.
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<Value>,
}
 
/// Parse the request, build the problem, and dispatch to the correct mode.
///
/// Returns an [`ExecutionResponse`] on success or an error if the mode is unknown.
pub fn run(req: ExecutionRequest) -> Result<ExecutionResponse> {
    let problem = Problem::from_json(req.problem)?;
    let mut rng = rand::thread_rng();
    let payload = &req.execution.payload;
 
    match req.execution.mode.as_str() {
        "generate" => {
            let result = generate::generate(&problem, &mut rng)?;
            Ok(ExecutionResponse { result: Some(result), ..Default::default() })
        }
 
        "perturbation" => {
            let p = perturbation::perturbation(&problem, payload, &mut rng)?;
            Ok(ExecutionResponse { payload: Some(p), ..Default::default() })
        }
 
        "neighborhood" => {
            let p = neighborhood::neighborhood(&problem, payload, &mut rng)?;
            Ok(ExecutionResponse { payload: Some(p), ..Default::default() })
        }
 
        "local-search" => {
            let result = local_search::local_search(&problem, payload, &mut rng)?;
            Ok(ExecutionResponse { result: Some(result), ..Default::default() })
        }
 
        "select-best" => {
            let p = select_best::select_best(&problem, payload, &mut rng)?;
            Ok(ExecutionResponse { payload: Some(p), ..Default::default() })
        }
 
        "temperature-acceptance" => {
            let p = temperature_acceptance::temperature_acceptance(&problem, payload, &mut rng)?;
            Ok(ExecutionResponse { payload: Some(p), ..Default::default() })
        }
 
        other => bail!("Unknown execution mode: '{}'", other),
    }
}
 
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
 
    /// Helper that builds a minimal knapsack [`ExecutionRequest`] for a given mode.
    fn knapsack_request(mode: &str, payload: Value) -> ExecutionRequest {
        ExecutionRequest {
            problem: serde_json::from_str(include_str!("../examples/knapsack.json")).unwrap(),
            execution: ExecutionSpec {
                mode: mode.to_string(),
                payload,
            },
        }
    }
 
    /// `generate` mode must return a `result` field and no `payload` field.
    #[test]
    fn generate_mode_returns_result_not_payload() {
        let req = knapsack_request("generate", json!(null));
        let resp = run(req).unwrap();
        assert!(resp.result.is_some(), "expected result to be set");
        assert!(resp.payload.is_none(), "payload should be absent for generate");
    }
 
    /// An unrecognised mode string must produce an error, not a panic.
    #[test]
    fn unknown_mode_returns_error() {
        let req = knapsack_request("does-not-exist", json!(null));
        assert!(run(req).is_err());
    }
}