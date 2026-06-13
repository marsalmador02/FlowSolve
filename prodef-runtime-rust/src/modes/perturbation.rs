// modes/perturbation.rs
//
// Mode: `perturbation`
//
// Applies k random moves to a base solution, retrying until a feasible
// result is found (up to maxAttempts tries per step).
//
// Payload:
//   {
//     "base":        { "variableValue": [...] }
//     "k":           int   (number of moves, default 3)
//     "maxAttempts": int   (retries per move, default 100)
//   }
//
// Response:
//   { "perturbed": SolverResult }

use anyhow::{bail, Context, Result};
use rand::prelude::StdRng;
use rand::Rng;
use serde_json::{json, Value};

use crate::problem::Problem;
use crate::solution::{require_object, Solution, SolverResult};

pub(crate) fn perturbation(
    problem: &Problem,
    payload: &Value,
    rng: &mut StdRng,
) -> Result<Value> {
    let obj = require_object(payload)?;

    let base_val = obj.get("base").context("perturbation requires `base`")?;
    let base = Solution::from_candidate(problem, base_val)
        .context("perturbation `base` is missing or invalid `variableValue`")?;

    if !problem.is_feasible(&base)? {
        bail!("perturbation `base` solution is not feasible");
    }

    let k = obj
        .get("k")
        .and_then(Value::as_u64)
        .map(|v| v.max(1) as usize)
        .unwrap_or(3);

    let max_attempts = obj
        .get("maxAttempts")
        .and_then(Value::as_u64)
        .map(|v| v.max(1) as usize)
        .unwrap_or(100);

    let mut current = base;
    let mut attempts_used = 0usize;

    for _ in 0..k {
        let (next, attempts) = apply_random_move(problem, &current, max_attempts, rng)?;
        attempts_used += attempts;
        current = next;
    }

    let result = serde_json::to_value(SolverResult::build(problem, &current)?)?;
    Ok(json!({
        "winner": result,
        "attempts": attempts_used,
        "maxAttempts": max_attempts,
        "k": k
    }))
}

/// Apply one random feasible move to `solution`.
///
/// For permutations: swap two random positions.
/// For vectors: flip a random bit (binary) or nudge a random element by ±1.
fn apply_random_move(
    problem: &Problem,
    solution: &Solution,
    max_attempts: usize,
    rng: &mut StdRng,
) -> Result<(Solution, usize)> {
    for attempt in 1..=max_attempts {
        let candidate = random_neighbor(problem, solution, rng);
        if problem.is_feasible(&candidate)? {
            return Ok((candidate, attempt));
        }
    }
    Ok((solution.clone(), max_attempts))
}

fn random_neighbor(problem: &Problem, solution: &Solution, rng: &mut StdRng) -> Solution {
    match solution {
        Solution::Permutation(p) => {
            let n = p.len();
            let i = rng.gen_range(0..n);
            let j = (i + 1 + rng.gen_range(0..n - 1)) % n;
            let mut next = p.clone();
            next.swap(i, j);
            Solution::Permutation(next)
        }
        Solution::Vector(v) => {
            let n = v.len();
            let i = rng.gen_range(0..n);
            let mut next = v.clone();
            let lo = problem.lower();
            let hi = problem.upper();
            // Binary: flip 0↔1.  Integer/continuous: nudge ±1 within bounds.
            if (hi - lo - 1.0).abs() < 1e-9 {
                next[i] = if next[i] == 0.0 { 1.0 } else { 0.0 };
            } else {
                let delta = if rng.gen::<bool>() { 1.0 } else { -1.0 };
                next[i] = (next[i] + delta).clamp(lo, hi);
            }
            Solution::Vector(next)
        }
    }
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

    fn tsp() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../../examples/tsp.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    #[test]
    fn perturbs_vector_solution() {
        let p = knapsack();
        let mut rng = StdRng::seed_from_u64(42);
        let payload = json!({
            "base": { "variableValue": [1,1,1,1,0] },
            "k": 2,
            "maxAttempts": 50
        });
        let result = perturbation(&p, &payload, &mut rng).unwrap();
        let perturbed = &result["perturbed"];
        assert!(perturbed["isFeasible"].as_bool().unwrap());
        assert_eq!(perturbed["variableValue"].as_array().unwrap().len(), 5);
    }

    #[test]
    fn perturbs_permutation_solution() {
        let p = tsp();
        let mut rng = StdRng::seed_from_u64(42);
        let payload = json!({
            "base": { "variableValue": [1,2,3,4] },
            "k": 2,
            "maxAttempts": 50
        });
        let result = perturbation(&p, &payload, &mut rng).unwrap();
        let perturbed = &result["perturbed"];
        assert!(perturbed["isFeasible"].as_bool().unwrap());
        assert_eq!(perturbed["variableValue"].as_array().unwrap().len(), 4);
    }
}