//! Mapping from domain values to the JSON response contract.
//!
//! This module defines how solutions are serialized back to the caller and how
//! feasibility/objective metadata is assembled into `SolverResult`.

use anyhow::Result;
use serde_json::{json, Value};

use crate::domain::{RuntimeProblem, Solution, SolverResult};

/// Convert a runtime solution to the JSON representation returned by the API.
///
/// Permutations are emitted using 1-based indices to match the external JSON
/// contract, while numeric vectors are returned unchanged.
pub(crate) fn solution_to_json(solution: &Solution) -> Value {
    match solution {
        Solution::Vector(v) => json!(v),
        Solution::Permutation(v) => {
            let one_based: Vec<usize> = v.iter().map(|x| x + 1).collect();
            json!(one_based)
        }
    }
}

/// Build a full solver result from a runtime solution.
///
/// The function evaluates feasibility first and then computes every goal
/// value. The returned `SolverResult` is the canonical JSON shape for a single
/// solution in `ExecutionResponse`.
pub(crate) fn build_solver_result(runtime: &RuntimeProblem, solution: &Solution) -> Result<SolverResult> {
    let is_feasible = runtime.is_feasible(solution)?;
    let goals = runtime.evaluate_goals(solution)?;
    Ok(SolverResult {
        problem_name: runtime.raw.name.clone(),
        is_feasible,
        goal_values: goals,
        variable_value: solution_to_json(solution),
    })
}

/// Serialize a single solver result into JSON for payload-bearing modes.
pub(crate) fn solver_result_json(runtime: &RuntimeProblem, solution: &Solution) -> Result<Value> {
    Ok(serde_json::to_value(build_solver_result(runtime, solution)?)?)
}
