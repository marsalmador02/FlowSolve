// api.rs
//
// Request/response contract and mode dispatcher.
//
// Reads an ExecutionRequest, builds the Problem, calls the right mode
// function, and returns an ExecutionResponse.
//
// Replaces: api/mod.rs, modes/mod.rs, modes/context.rs, modes/common.rs

use anyhow::{bail, Context, Result};
use rand::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::problem::Problem;
use crate::solution::SolverResult;

use crate::modes::{
    generate, local_search, neighborhood, perturbation, select_best, temperature_acceptance,
};

// ── Request ───────────────────────────────────────────────────────────────────

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

// ── Response ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Default)]
pub(crate) struct ExecutionResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) result: Option<SolverResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) population: Option<Vec<SolverResult>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) payload: Option<Value>,
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub(crate) fn run(req: ExecutionRequest) -> Result<ExecutionResponse> {
    let problem = build_problem(req.problem)?;
    let mut rng = StdRng::from_entropy();
    let payload = &req.execution.payload;

    match req.execution.mode.as_str() {
        "generate" => {
            let result = generate::generate(&problem, &mut rng)?;
            Ok(ExecutionResponse { result: Some(result), ..Default::default() })
        }

        "generate-population" => {
            let population = generate::generate_population(&problem, payload, &mut rng)?;
            Ok(ExecutionResponse { population: Some(population), ..Default::default() })
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
    let p = local_search::local_search(&problem, payload, &mut rng)?;
    let result = p
        .get("result")
        .cloned()
        .context("local-search returned no result")?;
    let result: SolverResult = serde_json::from_value(result)?;
    Ok(ExecutionResponse {
        result: Some(result),
        payload: Some(p),
        ..Default::default()
    })
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

// ── Helpers ───────────────────────────────────────────────────────────────────

fn build_problem(problem_value: Option<Value>) -> Result<Problem> {
    let value = problem_value.context("execution.problem is required")?;
    Problem::from_json(value)
}