use anyhow::Result;
use serde_json::{json, Value};

use crate::domain::{RuntimeProblem, Solution, SolverResult};

// Convert a `Solution` to a JSON value. For permutations, we convert to 1-based indexing for better readability.
// Example: [0, 2, 1] → [1, 3, 2].
pub(crate) fn solution_to_json(solution: &Solution) -> Value {
    match solution {
        Solution::Vector(v) => json!(v),
        Solution::Permutation(v) => {
            let one_based: Vec<usize> = v.iter().map(|x| x + 1).collect();
            json!(one_based)
        }
    }
}

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

pub(crate) fn solver_result_json(runtime: &RuntimeProblem, solution: &Solution) -> Result<Value> {
    Ok(serde_json::to_value(build_solver_result(runtime, solution)?)?)
}
