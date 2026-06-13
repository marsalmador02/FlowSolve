// modes/generate.rs
//
// Modes: `generate`  and  `generate-population`
//
// generate            → one feasible SolverResult in `result`
// generate-population → N feasible SolverResults in `population`
//                       payload: { "count": N }  (default 10)

use anyhow::Result;
use rand::prelude::StdRng;
use serde_json::Value;

use crate::problem::Problem;
use crate::solution::SolverResult;

pub(crate) fn generate(problem: &Problem, rng: &mut StdRng) -> Result<SolverResult> {
    let solution = problem.random_feasible_solution(rng)?;
    SolverResult::build(problem, &solution)
}

pub(crate) fn generate_population(
    problem: &Problem,
    payload: &Value,
    rng: &mut StdRng,
) -> Result<Vec<SolverResult>> {
    let count = payload
        .get("count")
        .and_then(Value::as_u64)
        .map(|c| c.max(1) as usize)
        .unwrap_or(10);

    (0..count)
        .map(|_| {
            let solution = problem.random_feasible_solution(rng)?;
            SolverResult::build(problem, &solution)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::prelude::StdRng;
    use rand::SeedableRng;
    use serde_json::json;

    fn knapsack() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../../examples/knapsack.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    #[test]
    fn generate_returns_feasible_result() {
        let p = knapsack();
        let mut rng = StdRng::seed_from_u64(42);
        let result = generate(&p, &mut rng).unwrap();
        assert!(result.is_feasible);
    }

    #[test]
    fn generate_population_respects_count() {
        let p = knapsack();
        let mut rng = StdRng::seed_from_u64(42);
        let pop = generate_population(&p, &json!({ "count": 3 }), &mut rng).unwrap();
        assert_eq!(pop.len(), 3);
        for r in pop {
            assert!(r.is_feasible);
        }
    }

    #[test]
    fn generate_population_defaults_to_10() {
        let p = knapsack();
        let mut rng = StdRng::seed_from_u64(42);
        let pop = generate_population(&p, &json!(null), &mut rng).unwrap();
        assert_eq!(pop.len(), 10);
    }
}