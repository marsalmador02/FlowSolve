//! Mode: `generate` and `generate-population`.
//!
//! Input: no solution payload, only an optional `count` for population mode.
//! Output: a single feasible result or a feasible population in JSON form.

use anyhow::Result;
use serde_json::Value;

use crate::api::parse::payload_object;
use crate::api::response::build_solver_result;
use crate::domain::feasible::generate_feasible;
use crate::modes::context::{ModeContext, ModeOutcome};

pub(crate) fn execute_single(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let solution = generate_feasible(ctx.runtime, ctx.rng)?;
    Ok(ModeOutcome::with_result(build_solver_result(
        ctx.runtime,
        &solution,
    )?))
}

pub(crate) fn execute_population(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let count = if ctx.payload.is_null() {
        10
    } else {
        payload_object(ctx.payload)?
            .get("count")
            .and_then(Value::as_u64)
            .map(|c| c.max(1) as usize)
            .unwrap_or(10)
    };

    let mut population = Vec::with_capacity(count);
    for _ in 0..count {
        let solution = generate_feasible(ctx.runtime, ctx.rng)?;
        population.push(build_solver_result(ctx.runtime, &solution)?);
    }

    Ok(ModeOutcome::with_population(population))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::prelude::StdRng;
    use serde_json::json;

    #[test]
    fn execute_population_respects_count() {
        let raw: crate::domain::model::Problem = serde_json::from_str(include_str!("../../examples/knapsack.json")).expect("parse knapsack example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);
        let payload = json!({ "count": 3 });
        let ctx = ModeContext { runtime: &runtime, payload: &payload, rng: &mut rng };

        let outcome = execute_population(ctx).expect("execute population");
        let pop = outcome.population.expect("population present");
        assert_eq!(pop.len(), 3);
        for sol in pop {
            assert!(sol.is_feasible, "generated SolverResult should be marked feasible");
        }
    }
    
    #[test]
    fn execute_population_generates_feasible() {
        let raw: crate::domain::model::Problem = serde_json::from_str(include_str!("../../examples/knapsack.json")).expect("parse knapsack example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);
        let payload = json!({ "count": 5 });
        let ctx = ModeContext { runtime: &runtime, payload: &payload, rng: &mut rng };

        let outcome = execute_population(ctx).expect("execute population");
        let pop = outcome.population.expect("population present");
        for sol in pop {
            let values = sol.variable_value.as_array().expect("variableValue should be an array")
                .iter()
                .map(|v| v.as_f64().expect("variableValue elements should be numbers"))
                .collect::<Vec<_>>();
            let solution = crate::domain::Solution::Vector(values);
            assert!(runtime.is_feasible(&solution).expect("check feasibility"), "generated SolverResult should be marked feasible");
        }
    }

    #[test]
    fn execute_single_generates_feasible() {
        let raw: crate::domain::model::Problem = serde_json::from_str(include_str!("../../examples/knapsack.json")).expect("parse knapsack example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);
        let ctx = ModeContext { runtime: &runtime, payload: &json!(null), rng: &mut rng };

        let outcome = execute_single(ctx).expect("execute single");
        let result = outcome.result.expect("result present");
        assert!(result.is_feasible, "generated SolverResult should be marked feasible");

        let values = result.variable_value.as_array().expect("variableValue should be an array")
            .iter()
            .map(|v| v.as_f64().expect("variableValue elements should be numbers"))
            .collect::<Vec<_>>();
        let solution = crate::domain::Solution::Vector(values);
        assert!(runtime.is_feasible(&solution).expect("check feasibility"));
    }
}