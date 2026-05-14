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
    apply_random_bitflip, apply_random_swap,
    one_point_crossover, order_crossover_f64, pmx_crossover_f64, uniform_crossover_f64,
    variable_flags,
};

// Helper to pick two distinct parents, with retries to avoid identical pairs when possible.
fn distinct_parent_pair(
    parents: &[Solution],
    rng: &mut StdRng,
) -> (Solution, Solution) {
    let len = parents.len();
    if len < 2 {
        return (parents[0].clone(), parents[0].clone());
    }

    let mut best_pair = (parents[0].clone(), parents[1].clone());
    for _ in 0..16 {
        let i = rng.gen_range(0..len);
        let mut j = rng.gen_range(0..len);
        if i == j {
            j = (j + 1) % len;
        }

        let p1 = parents[i].clone();
        let p2 = parents[j].clone();
        best_pair = (p1.clone(), p2.clone());

        if solution_to_f64_vec(&p1) != solution_to_f64_vec(&p2) {
            return (p1, p2);
        }
    }

    best_pair
}

fn pick_valid_child(runtime: &crate::domain::RuntimeProblem, child_vec: Vec<f64>, fallback: &Solution) -> Solution {
    match vec_to_solution(runtime, &child_vec) {
        Some(solution) if runtime.is_feasible(&solution).unwrap_or(false) => solution,
        _ => fallback.clone(),
    }
}

// If crossover fails to produce a valid child after several attempts, apply a forced variation to try to escape local optima.
fn force_variation(source: &[f64], is_permutation: bool, is_binary: bool, rng: &mut StdRng) -> Vec<f64> {
    if is_permutation {
        return apply_random_swap(source, rng);
    }
    if is_binary {
        return apply_random_bitflip(source, rng);
    }
    if source.is_empty() {
        return source.to_vec();
    }
    let mut out = source.to_vec();
    let idx = rng.gen_range(0..out.len());
    out[idx] += if rng.gen::<f64>() < 0.5 { -1.0 } else { 1.0 };
    out
}

fn is_same_vec(a: &[f64], b: &[f64]) -> bool {
    a.len() == b.len() && a.iter().zip(b.iter()).all(|(x, y)| x == y)
}

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

    let parent_entries: Vec<(Solution, bool)> = parents
        .iter()
        .filter_map(|p| {
            parse_candidate(ctx.runtime, p)
                .map(|solution| {
                    let is_elite = p
                        .get("isElite")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    (solution, is_elite)
                })
        })
        .collect();
    let parent_solutions: Vec<Solution> = parent_entries
        .iter()
        .map(|(solution, _)| solution.clone())
        .collect();
    if parent_solutions.len() < 2 {
        bail!("crossover could not parse at least two parent variableValue[]");
    }

    let target_size = obj
        .get("targetSize")
        .and_then(Value::as_u64)
        .map(|v| v as usize)
        .unwrap_or(parent_solutions.len());

    let (is_permutation, is_binary) = variable_flags(ctx.runtime);
    let operator = obj
        .get("crossoverOperator")
        .and_then(Value::as_str)
        .map(|v| v.to_ascii_lowercase())
        .unwrap_or_else(|| "uniform".to_string());

    let elites: Vec<Solution> = parent_entries
        .iter()
        .filter(|(_, is_elite)| *is_elite)
        .map(|(solution, _)| solution.clone())
        .collect();
    let elite_count = elites.len().min(target_size);

    let mut offspring: Vec<Solution> = Vec::with_capacity(target_size);
    offspring.extend(elites.into_iter().take(elite_count));

    while offspring.len() < target_size {
        let (p1, p2) = distinct_parent_pair(&parent_solutions, ctx.rng);
        let v1 = solution_to_f64_vec(&p1);
        let v2 = solution_to_f64_vec(&p2);

        let mut chosen: Option<Solution> = None;
        for _ in 0..10 {
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

            if is_same_vec(&child_vec, &v1) || is_same_vec(&child_vec, &v2) {
                continue;
            }

            if let Some(solution) = vec_to_solution(ctx.runtime, &child_vec) {
                if ctx.runtime.is_feasible(&solution).unwrap_or(false) {
                    chosen = Some(solution);
                    break;
                }
            }
        }

        if chosen.is_none() {
            let varied = force_variation(&v1, is_permutation, is_binary, ctx.rng);
            if !is_same_vec(&varied, &v1) && !is_same_vec(&varied, &v2) {
                chosen = match vec_to_solution(ctx.runtime, &varied) {
                    Some(solution) if ctx.runtime.is_feasible(&solution).unwrap_or(false) => Some(solution),
                    _ => None,
                };
            }
        }

        let solution = chosen.unwrap_or_else(|| pick_valid_child(ctx.runtime, v1.clone(), &p1));
        offspring.push(solution);
    }

    let mut offspring_json = common::solutions_as_json_values(ctx.runtime, &offspring)?;
    for (idx, value) in offspring_json.iter_mut().enumerate() {
        if let Some(map) = value.as_object_mut() {
            map.insert("isElite".to_string(), Value::Bool(idx < elite_count));
        }
    }

    Ok(ModeOutcome::with_payload(json!({
        "offspring": offspring_json,
        "crossoverOperator": operator,
        "eliteBypassed": elite_count,
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