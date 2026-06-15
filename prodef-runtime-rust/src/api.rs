// api.rs — request/response types and mode dispatcher.

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::problem::Problem;
use crate::solution::SolverResult;
use crate::modes::{generate, local_search, neighborhood, perturbation, select_best, temperature_acceptance};
 
#[derive(Deserialize)]
pub struct ExecutionRequest {
    problem: Value,
    execution: ExecutionSpec,
}

#[derive(Deserialize)]
pub struct ExecutionSpec {
    mode: String,
    #[serde(default)]
    payload: Value,
}

#[derive(Serialize, Default)]
pub struct ExecutionResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<SolverResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<Value>,
}

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