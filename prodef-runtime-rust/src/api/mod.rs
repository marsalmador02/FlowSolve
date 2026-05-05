//! HTTP/CLI contract: deserialize `ExecutionRequest`, dispatch modes, serialize `ExecutionResponse`.
//! Business logic lives in `crate::modes` and `crate::domain`.

use anyhow::{Context, Result};
use rand::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::domain::{Problem, RuntimeProblem, SolverResult};
use crate::modes::{dispatch, ModeContext};

pub(crate) mod parse;
pub(crate) mod response;
pub(crate) mod validation;

#[derive(Debug, Deserialize)]
pub(crate) struct ExecutionRequest {
    #[serde(default)]
    pub(crate) problem: Option<Value>,
    pub(crate) execution: ExecutionSpec,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ExecutionSpec {
    pub(crate) mode: String,
    #[serde(default)]
    pub(crate) payload: Value,
}

    // The API response structure. Modes can fill in `result` (single solution), `population` (multiple solutions), 
    // and/or `payload` (arbitrary JSON).
    #[derive(Debug, Serialize, Default)]
    pub(crate) struct ExecutionResponse {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub(crate) result: Option<SolverResult>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub(crate) population: Option<Vec<SolverResult>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub(crate) payload: Option<Value>,
    }

// The outcome of running a mode, which can include a single solution, a population, and/or arbitrary payload.
pub(crate) fn run(req: ExecutionRequest) -> Result<ExecutionResponse> {
    let mode = req.execution.mode;

    // 'catalog' mode removed; dispatch modes directly.

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

fn build_runtime(problem_payload: Option<Value>) -> Result<RuntimeProblem> {
    let problem_value = problem_payload.context("execution.problem is required for this mode")?;
    let problem: Problem = serde_json::from_value(problem_value)
        .context("execution.problem is not a valid Problem JSON")?;
    RuntimeProblem::new(problem)
}
