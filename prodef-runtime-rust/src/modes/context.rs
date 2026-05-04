//! Shared context and outcome for every execution mode (`api` maps this to `ExecutionResponse`).

use rand::prelude::StdRng;
use serde_json::Value;

use crate::domain::{RuntimeProblem, SolverResult};

/// Input passed to every mode handler after JSON dispatch.
pub(crate) struct ModeContext<'a> {
    pub runtime: &'a RuntimeProblem,
    pub payload: &'a Value,
    pub rng: &'a mut StdRng,
}

/// What a mode produces before serialization. Maps 1:1 to optional fields on `ExecutionResponse`.
#[derive(Default)]
pub(crate) struct ModeOutcome {
    pub result: Option<SolverResult>,
    pub population: Option<Vec<SolverResult>>,
    pub payload: Option<Value>,
}

// Helper methods to construct a `ModeOutcome` with just one of the fields set.
impl ModeOutcome {
    pub(crate) fn with_result(r: SolverResult) -> Self {
        Self {
            result: Some(r),
            ..Default::default()
        }
    }

    pub(crate) fn with_population(p: Vec<SolverResult>) -> Self {
        Self {
            population: Some(p),
            ..Default::default()
        }
    }

    pub(crate) fn with_payload(v: Value) -> Self {
        Self {
            payload: Some(v),
            ..Default::default()
        }
    }
}
