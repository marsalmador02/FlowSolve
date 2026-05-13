//! Mode: `mutation`.
//!
//! Input: `incomingSet` plus an optional mutation rate.
//! Output: the mutated solutions and the operator that was chosen.

use anyhow::{bail, Context, Result};
use rand::prelude::*;
use serde_json::{json, Value};

use crate::api::parse::{parse_candidate, payload_object, solution_to_f64_vec, vec_to_solution};
use crate::domain::Solution;
use crate::modes::common;
use crate::modes::context::{ModeContext, ModeOutcome};
use crate::operators::{
    apply_random_bitflip, apply_random_swap, detect_problem_family,
    mutate_permutation_inversion_f64, variable_flags, ProblemFamily,
};

fn repair_solution(runtime: &crate::domain::RuntimeProblem, base: &Solution, vars: &[f64]) -> Solution {
    match vec_to_solution(runtime, vars) {
        Some(next) if runtime.is_feasible(&next).unwrap_or(false) => next,
        _ => base.clone(),
    }
}

/// Mutate each incoming solution with the selected operator.
pub(crate) fn execute(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let obj = payload_object(ctx.payload)?;
    let incoming = obj
        .get("incomingSet")
        .and_then(Value::as_array)
        .context("mutation payload requires `incomingSet[]`")?;
    if incoming.is_empty() {
        bail!("mutation requires a non-empty incomingSet");
    }

    let incoming_entries: Vec<(Solution, bool)> = incoming
        .iter()
        .filter_map(|c| {
            parse_candidate(ctx.runtime, c)
                .map(|solution| {
                    let is_elite = c
                        .get("isElite")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    (solution, is_elite)
                })
        })
        .collect();
    let incoming_solutions: Vec<Solution> = incoming_entries
        .iter()
        .map(|(solution, _)| solution.clone())
        .collect();
    if incoming_solutions.is_empty() {
        bail!("mutation could not parse incomingSet variableValue[]");
    }

    let rate = obj
        .get("mutationRate")
        .and_then(Value::as_f64)
        .unwrap_or(0.25);

    let (is_permutation, is_binary) = variable_flags(ctx.runtime);
    let family = detect_problem_family(ctx.runtime);

    let operator = if is_binary {
        "bit-flip+repair".to_string()
    } else if is_permutation {
        match family {
            ProblemFamily::Assignment => "swap".to_string(),
            _ => "inversion".to_string(),
        }
    } else {
        "delta".to_string()
    };

    let mut mutated: Vec<(Solution, bool)> = Vec::with_capacity(incoming_entries.len());
    for (base, is_elite) in &incoming_entries {
        if *is_elite {
            mutated.push((base.clone(), true));
            continue;
        }

        if ctx.rng.gen::<f64>() > rate {
            mutated.push((base.clone(), false));
            continue;
        }
        let mut current = base.clone();
        let mut vars = solution_to_f64_vec(&current);
        if vars.is_empty() {
            mutated.push((base.clone(), false));
            continue;
        }
        let steps = if is_binary {
            if ctx.rng.gen::<f64>() < 0.5 { 2 } else { 3 }
        } else {
            1
        };

        for _ in 0..steps {
            let next_vars = if is_permutation {
                if operator.contains("swap") {
                    apply_random_swap(&vars, ctx.rng)
                } else {
                    let mut candidate = vars.clone();
                    mutate_permutation_inversion_f64(&mut candidate, ctx.rng);
                    candidate
                }
            } else if is_binary {
                apply_random_bitflip(&vars, ctx.rng)
            } else {
                let mut candidate = vars.clone();
                let idx = ctx.rng.gen_range(0..candidate.len());
                candidate[idx] += if ctx.rng.gen::<f64>() < 0.5 { -1.0 } else { 1.0 };
                candidate
            };

            current = repair_solution(ctx.runtime, &current, &next_vars);
            vars = solution_to_f64_vec(&current);
            if vars.is_empty() {
                current = base.clone();
                break;
            }
        }
        mutated.push((current, false));
    }

    let mut mutated_json = common::solutions_as_json_values(
        ctx.runtime,
        &mutated.iter().map(|(solution, _)| solution.clone()).collect::<Vec<Solution>>(),
    )?;
    for (idx, value) in mutated_json.iter_mut().enumerate() {
        if let Some(map) = value.as_object_mut() {
            map.insert("isElite".to_string(), Value::Bool(mutated[idx].1));
        }
    }

    let elite_preserved = mutated.iter().filter(|(_, is_elite)| *is_elite).count();
    Ok(ModeOutcome::with_payload(json!({
        "mutated": mutated_json,
        "mutationRate": rate,
        "mutationOperator": operator,
        "elitePreserved": elite_preserved,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::prelude::StdRng;
    use serde_json::json;

    #[test]
    fn mutation_mutates_and_returns_payload() {
        let raw: crate::domain::model::Problem = serde_json::from_str(include_str!("../../../examples/knapsack.json")).expect("parse knapsack example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);

        let incoming = json!({ "incomingSet": [{ "variableValue": [1,1,1,1,0] }], "mutationRate": 1.0, "mutationOperator": "bit-flip+repair" });
        let ctx = ModeContext { runtime: &runtime, payload: &incoming, rng: &mut rng };

        let outcome = execute(ctx).expect("mutation execute");
        let payload = outcome.payload.expect("payload present");
        let mutated = payload.get("mutated").and_then(|v| v.as_array()).expect("mutated array");
        assert_eq!(mutated.len(), 1);
        for cand in mutated {
            let is_feasible = cand.get("isFeasible").and_then(|v| v.as_bool()).unwrap_or(false);
            assert!(is_feasible, "mutated solver result should be marked feasible");
        }
    }

    #[test]
    fn mutation_uses_swap_for_assignment_and_keeps_permutation_valid() {
        let raw: crate::domain::model::Problem =
            serde_json::from_str(include_str!("../../../examples/assignment.json"))
                .expect("parse assignment example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);

        let payload = json!({
            "incomingSet": [
                { "variableValue": [1, 2, 3, 4] }
            ],
            "mutationRate": 1.0
        });

        let ctx = ModeContext {
            runtime: &runtime,
            payload: &payload,
            rng: &mut rng,
        };

        let outcome = execute(ctx).expect("mutation execute");
        let payload = outcome.payload.expect("payload present");

        assert_eq!(
            payload.get("mutationOperator").and_then(Value::as_str),
            Some("swap")
        );

        let mutated = payload
            .get("mutated")
            .and_then(Value::as_array)
            .expect("mutated array");
        assert_eq!(mutated.len(), 1);

        let solution = parse_candidate(&runtime, &mutated[0]).expect("parse mutated solution");
        assert!(runtime.is_feasible(&solution).expect("feasibility check"));

        let base = parse_candidate(&runtime, &json!({"variableValue": [1, 2, 3, 4]}))
            .expect("parse base solution");

        assert_ne!(
            solution_to_f64_vec(&solution),
            solution_to_f64_vec(&base),
            "swap mutation should change the permutation"
        );
    }
}
