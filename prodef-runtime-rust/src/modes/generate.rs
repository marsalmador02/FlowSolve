//! # Mode: `generate`
//!
//! Generates a single random feasible solution for the problem.
//!
//! ## Response
//!
//! ```json
//! { "result": { "isFeasible": true, "goalValues": […], "variableValue": […] } }
//! ```

use anyhow::Result;
use rand::rngs::ThreadRng;
 
use crate::problem::Problem;
use crate::solution::SolverResult;

/// Generate one random feasible solution and return it as a [`SolverResult`].
///
/// Internally calls [`Problem::random_feasible_solution`], which retries until it finds
/// a solution that satisfies all constraints.
pub fn generate(problem: &Problem, rng: &mut ThreadRng) -> Result<SolverResult> {
    let solution = problem.random_feasible_solution(rng)?;
    SolverResult::build(problem, &solution)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn knapsack() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../examples/knapsack.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    #[test]
    fn generate_returns_feasible_result() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let result = generate(&p, &mut rng).unwrap();
        assert!(result.is_feasible);
    }

    #[test]
    fn generated_solution_has_correct_variable_count() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let result = generate(&p, &mut rng).unwrap();
        let arr = result.variable_value.as_array().unwrap();
        assert_eq!(arr.len(), p.var_size());
    }

    #[test]
    fn generate_result_has_goal_values() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let result = generate(&p, &mut rng).unwrap();
        assert!(!result.goal_values.is_empty());
    }
}