//! Boundary between external JSON and the internal runtime model.
//!
//! This layer owns the request/response contract for CLI and HTTP-style
//! execution: it deserializes `ExecutionRequest`, builds a `RuntimeProblem`
//! when the selected mode needs one, dispatches to `crate::modes`, and
//! serializes `ExecutionResponse`.

use anyhow::{Context, Result};
use rand::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::domain::{Problem, RuntimeProblem, SolverResult};
use crate::modes::{dispatch, ModeContext};

pub(crate) mod parse;
pub(crate) mod response;
pub(crate) mod validation;

/// External execution request consumed by the CLI/API boundary.
#[derive(Debug, Deserialize)]
pub(crate) struct ExecutionRequest {
    #[serde(default)]
    pub(crate) problem: Option<Value>,
    pub(crate) execution: ExecutionSpec,
}

/// Mode selection plus the mode-specific payload.
#[derive(Debug, Deserialize)]
pub(crate) struct ExecutionSpec {
    pub(crate) mode: String,
    #[serde(default)]
    pub(crate) payload: Value,
}

/// Normalized execution response returned by the boundary layer.
#[derive(Debug, Serialize, Default)]
pub(crate) struct ExecutionResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) result: Option<SolverResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) population: Option<Vec<SolverResult>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) payload: Option<Value>,
}

/// Parse the request, build the runtime when needed, dispatch the mode, and
/// return the serialized response contract.
pub(crate) fn run(req: ExecutionRequest) -> Result<ExecutionResponse> {
    let mode = req.execution.mode;

    let runtime = build_runtime(req.problem.clone())?;
    let mut rng = StdRng::from_entropy();
    let payload = req.execution.payload;

    let outcome = dispatch(
        &mode,
        ModeContext {
            runtime: &runtime,
            payload: &payload,
            rng: &mut rng,
        },
    )?;

    Ok(ExecutionResponse {
        result: outcome.result,
        population: outcome.population,
        payload: outcome.payload,
    })
}

/// Build a runtime problem from `execution.problem` when the mode requires it.
///
/// Returns a validation error if the payload is missing or not a valid
/// `Problem` JSON document.
fn build_runtime(problem_payload: Option<Value>) -> Result<RuntimeProblem> {
    let problem_value = problem_payload.context("execution.problem is required for this mode")?;
    let problem: Problem = serde_json::from_value(problem_value)
        .context("execution.problem is not a valid Problem JSON")?;
    RuntimeProblem::new(problem)
}
