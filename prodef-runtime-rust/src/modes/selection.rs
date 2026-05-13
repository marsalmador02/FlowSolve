//! Mode: `selection`.
//!
//! Payload/response contract is documented in this module and summarized in `modes::mod`.

use anyhow::{bail, Result};
use rand::prelude::*;
use serde_json::{json, Value};
use std::collections::HashSet;

use crate::api::parse::{parse_candidate, payload_object, solution_to_f64_vec};
use crate::api::validation;
use crate::domain::Solution;
use crate::modes::context::{ModeContext, ModeOutcome};
use crate::modes::common;

/// Select `targetSize` solutions from `candidates[]` using elitism plus
/// tournament selection. Payload accepts `targetSize`, `tournamentSize`,
/// and `eliteSize` optional parameters.
pub(crate) fn execute(ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    let obj = payload_object(ctx.payload)?;
    let candidates = validation::non_empty_array_in_obj(obj, "candidates", "selection")?;

    let mut pool: Vec<Solution> = candidates
        .iter()
        .filter_map(|c| parse_candidate(ctx.runtime, c))
        .collect();

    pool.retain(|s| ctx.runtime.is_feasible(s).unwrap_or(false));
    if pool.is_empty() {
        bail!("Selection pool is empty after parsing/filtering");
    }

    let target_size = obj
        .get("targetSize")
        .and_then(Value::as_u64)
        .map(|v| v as usize)
        .unwrap_or(pool.len());

    let tournament_size = obj
        .get("tournamentSize")
        .and_then(Value::as_u64)
        .map(|v| v as usize)
        .unwrap_or(3);

    let elite_size = obj
        .get("eliteSize")
        .and_then(Value::as_u64)
        .map(|v| v as usize)
        .unwrap_or(1);

    pool.sort_by(|a, b| compare_by_score(ctx.runtime, a, b));

    // Keep one representative per vector to reduce duplicate collapse.
    let mut unique_keys = HashSet::new();
    pool.retain(|s| unique_keys.insert(vector_key(s)));

    let mut selected: Vec<Solution> = Vec::with_capacity(target_size);
    let mut selected_keys: HashSet<String> = HashSet::new();

    let elites = elite_size.min(target_size).min(pool.len());
    for elite in pool.iter().take(elites) {
        selected_keys.insert(vector_key(elite));
        selected.push(elite.clone());
    }

    while selected.len() < target_size {
        let mut appended = false;
        for _ in 0..12 {
            let winner = tournament_pick(ctx.runtime, &pool, tournament_size, ctx.rng)?;
            let key = vector_key(&winner);
            if !selected_keys.contains(&key) {
                selected_keys.insert(key);
                selected.push(winner);
                appended = true;
                break;
            }
        }

        if appended {
            continue;
        }

        if let Some(next_unique) = pool
            .iter()
            .find(|candidate| !selected_keys.contains(&vector_key(candidate)))
            .cloned()
        {
            selected_keys.insert(vector_key(&next_unique));
            selected.push(next_unique);
        } else {
            // All unique vectors already selected; duplicates are now unavoidable.
            let winner = tournament_pick(ctx.runtime, &pool, tournament_size, ctx.rng)?;
            selected.push(winner);
        }
    }

    let mut selected_json = common::solutions_as_json_values(ctx.runtime, &selected)?;
    for (idx, value) in selected_json.iter_mut().enumerate() {
        if let Some(map) = value.as_object_mut() {
            map.insert("isElite".to_string(), Value::Bool(idx < elites));
        }
    }

    Ok(ModeOutcome::with_payload(json!({
        "selected": selected_json,
        "eliteCount": elites,
    })))
}

fn vector_key(solution: &Solution) -> String {
    format!("{:?}", solution_to_f64_vec(solution))
}

fn compare_by_score(
    runtime: &crate::domain::RuntimeProblem,
    a: &Solution,
    b: &Solution,
) -> std::cmp::Ordering {
    let sa = runtime.objective_score(a).unwrap_or(f64::NAN);
    let sb = runtime.objective_score(b).unwrap_or(f64::NAN);

    if runtime.is_maximize() {
        sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
    } else {
        sa.partial_cmp(&sb).unwrap_or(std::cmp::Ordering::Equal)
    }
}

fn tournament_pick(
    runtime: &crate::domain::RuntimeProblem,
    pool: &[Solution],
    tournament_size: usize,
    rng: &mut StdRng,
) -> Result<Solution> {
    if pool.is_empty() {
        bail!("Selection pool is empty");
    }

    let mut winner = pool[rng.gen_range(0..pool.len())].clone();

    for _ in 1..tournament_size {
        let challenger = pool[rng.gen_range(0..pool.len())].clone();
        let better = if runtime.is_maximize() {
            runtime.objective_score(&challenger)? > runtime.objective_score(&winner)?
        } else {
            runtime.objective_score(&challenger)? < runtime.objective_score(&winner)?
        };
        if better {
            winner = challenger;
        }
    }

    Ok(winner)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::prelude::StdRng;
    use rand::SeedableRng;
    use serde_json::{json, Value};

    // Helper to extract scores of selected solutions from payload for testing purposes.
    fn selected_scores(runtime: &crate::domain::RuntimeProblem, payload: &Value) -> Vec<f64> {
        let selected = payload
            .get("selected")
            .and_then(Value::as_array)
            .expect("selected array");

        selected
            .iter()
            .map(|item| {
                let values = item
                    .get("variableValue")
                    .and_then(Value::as_array)
                    .expect("selected item should contain variableValue as array");

                let vec = values
                    .iter()
                    .map(|v| v.as_f64().expect("numeric value"))
                    .collect::<Vec<f64>>();

                let solution = crate::domain::Solution::Vector(vec);
                runtime.objective_score(&solution).expect("score")
            })
            .collect()
    }

    #[test]
    fn selection_selects_target_size_knapsack() {
        let raw: crate::domain::model::Problem =
            serde_json::from_str(include_str!("../../../examples/knapsack.json"))
                .expect("parse knapsack example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);

        let candidates = json!({
            "candidates": [
                { "variableValue": [1,1,1,1,0] },
                { "variableValue": [0,0,0,0,0] },
                { "variableValue": [1,0,1,0,1] }
            ],
            "targetSize": 2,
            "tournamentSize": 2,
            "eliteSize": 1
        });

        let ctx = ModeContext {
            runtime: &runtime,
            payload: &candidates,
            rng: &mut rng,
        };

        let outcome = execute(ctx).expect("selection execute");
        let payload = outcome.payload.expect("payload present");
        let selected = payload
            .get("selected")
            .and_then(|v| v.as_array())
            .expect("selected array");

        assert_eq!(selected.len(), 2);
        for s in selected {
            let is_feasible = s.get("isFeasible").and_then(|v| v.as_bool()).unwrap_or(false);
            assert!(is_feasible, "selected solver result should be marked feasible");
        }
    }

    #[test]
    fn selection_selects_best_knapsack_candidates() {
        let raw: crate::domain::model::Problem =
            serde_json::from_str(include_str!("../../../examples/knapsack.json"))
                .expect("parse knapsack example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);

        let payload = json!({
            "candidates": [
                { "variableValue": [1, 1, 1, 1, 1] },
                { "variableValue": [1, 1, 0, 1, 0] },
                { "variableValue": [1, 0, 0, 1, 0] },
                { "variableValue": [0, 0, 0, 0, 0] }
            ],
            "targetSize": 3,
            "tournamentSize": 2,
            "eliteSize": 3
        });

        let ctx = ModeContext {
            runtime: &runtime,
            payload: &payload,
            rng: &mut rng,
        };

        let outcome = execute(ctx).expect("selection execute");
        let payload = outcome.payload.expect("payload present");

        let scores = selected_scores(&runtime, &payload);
        assert_eq!(scores, vec![94.0, 70.0, 0.0]);

        let selected = payload
            .get("selected")
            .and_then(Value::as_array)
            .expect("selected array");
        assert_eq!(selected.len(), 3);
    }

    #[test]
    fn selection_selects_best_assignment_candidates() {
        let raw: crate::domain::model::Problem =
            serde_json::from_str(include_str!("../../../examples/assignment.json"))
                .expect("parse assignment example");
        let runtime = crate::domain::RuntimeProblem::new(raw).expect("build runtime");
        let mut rng = StdRng::seed_from_u64(42);

        let payload = json!({
            "candidates": [
                { "variableValue": [1, 2, 3, 4] },
                { "variableValue": [2, 1, 3, 4] },
                { "variableValue": [4, 3, 2, 1] }
            ],
            "targetSize": 3,
            "tournamentSize": 2,
            "eliteSize": 3
        });

        let ctx = ModeContext {
            runtime: &runtime,
            payload: &payload,
            rng: &mut rng,
        };

        let outcome = execute(ctx).expect("selection execute");
        let payload = outcome.payload.expect("payload present");

        let scores = selected_scores(&runtime, &payload);
        assert_eq!(scores, vec![20.0, 23.0, 39.0]);

        let selected = payload
            .get("selected")
            .and_then(Value::as_array)
            .expect("selected array");
        assert_eq!(selected.len(), 3);
    }
}