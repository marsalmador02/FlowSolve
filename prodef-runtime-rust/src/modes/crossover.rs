//! Mode: `crossover`.
//!
//! Payload/response contract is documented in this module and summarized in `modes::mod`.

use anyhow::{bail, Context, Result};
use rand::prelude::*;
use serde_json::{json, Value};

use crate::api::parse::{
    parse_candidate, payload_object, solution_to_f64_vec, vec_to_solution,
};
use crate::domain::Solution;
use crate::modes::common;
use crate::modes::context::{ModeContext, ModeOutcome};
use crate::operators::{
    one_point_crossover, order_crossover_f64, pmx_crossover_f64, uniform_crossover_f64,
    variable_flags,
};

/// Produce offspring from `parents[]` using the selected crossover operator.
///
/// Operator defaults depend on whether the variable is permutation, binary,
/// or continuous/integer.
pub(crate) fn execute(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let obj = payload_object(ctx.payload)?;
    let parents = obj
        .get("parents")
        .and_then(Value::as_array)
        .context("crossover payload requires `parents[]`")?;
    if parents.len() < 2 {
        bail!("crossover requires at least two parents");
    }

    let parent_solutions: Vec<Solution> = parents
        .iter()
        .filter_map(|p| parse_candidate(ctx.runtime, p))
        .collect();
    if parent_solutions.len() < 2 {
        bail!("crossover could not parse at least two parent variableValue[]");
    }

    let target_size = obj
        .get("targetSize")
        .and_then(Value::as_u64)
        .map(|v| v as usize)
        .unwrap();

    let (is_permutation, is_binary) = variable_flags(ctx.runtime);
    let operator = obj
        .get("crossoverOperator")
        .and_then(Value::as_str)
        .map(|v| v.to_ascii_lowercase())
        .unwrap();

    let mut offspring: Vec<Solution> = Vec::with_capacity(target_size);
    while offspring.len() < target_size {
        let p1 = parent_solutions[ctx.rng.gen_range(0..parent_solutions.len())].clone();
        let p2 = parent_solutions[ctx.rng.gen_range(0..parent_solutions.len())].clone();
        let v1 = solution_to_f64_vec(&p1);
        let v2 = solution_to_f64_vec(&p2);

        let child_vec = if is_permutation {
            if operator.contains("pmx") {
                pmx_crossover_f64(&v1, &v2, ctx.rng)
            } else {
                order_crossover_f64(&v1, &v2, ctx.rng)
            }
        } else if is_binary {
            if operator.contains("one") {
                one_point_crossover(&v1, &v2, ctx.rng)
            } else {
                uniform_crossover_f64(&v1, &v2, ctx.rng)
            }
        } else if operator.contains("uniform") {
            uniform_crossover_f64(&v1, &v2, ctx.rng)
        } else {
            one_point_crossover(&v1, &v2, ctx.rng)
        };

        match vec_to_solution(ctx.runtime, &child_vec) {
            Some(solution) => offspring.push(solution),
            None => offspring.push(p1),
        }
    }

    let offspring_json = common::solutions_as_json_values(ctx.runtime, &offspring)?;
    Ok(ModeOutcome::with_payload(json!({
        "offspring": offspring_json,
        "crossoverOperator": operator,
    })))
}

    #[cfg(test)]
    mod tests {
        use super::*;
        use rand::SeedableRng;
        use rand::prelude::StdRng;
        use serde_json::json;

    #[test]
    fn crossover_produces_offspring() {
        let raw: crate::domain::model::Problem = serde_json::from_str(include_str!("../../../examples/assignment.json")).expect("parse assignment example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);

        let parents = json!({ "parents": [ { "variableValue": [0,1,2,3] }, { "variableValue": [3,2,1,0] } ], "targetSize": 2, "crossoverOperator": "pmx" });
        let ctx = ModeContext { runtime: &runtime, payload: &parents, rng: &mut rng };

        let outcome = execute(ctx).expect("crossover execute");
        let payload = outcome.payload.expect("payload present");
        let offspring = payload.get("offspring").and_then(|v| v.as_array()).expect("offspring array");
        assert_eq!(offspring.len(), 2);
        for o in offspring {
            let parsed = crate::api::parse::parse_candidate(&runtime, o).expect("parse offspring");
            match parsed {
                crate::domain::Solution::Permutation(ref p) => assert_eq!(p.len(), runtime.solution_size()),
                _ => panic!("expected permutation offspring"),
            }
            assert!(runtime.is_feasible(&parsed).expect("check offspring feasibility"));
        }
    }
}