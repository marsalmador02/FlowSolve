//! # Mode: `perturbation`
//!
//! Applies k random moves to a base solution, retrying each move until a feasible result
//! is found.
//!
//! ## Request payload
//!
//! ```json
//! {
//!   "base":        { "variableValue": [1, 0, 1, 0, 0] },
//!   "k":           3,
//!   "maxAttempts": 100
//! }
//! ```
//!
//! ## Response
//!
//! ```json
//! {
//!   "winner":      { "isFeasible": true, … },
//!   "attempts":    6,
//!   "maxAttempts": 100,
//!   "k":           3
//! }
//! ```

use anyhow::{bail, Context, Result};
use rand::rngs::ThreadRng;
use serde_json::{json, Value};
use rand::Rng;

use crate::problem::Problem;
use crate::solution::{require_object, Solution, SolverResult};

/// Entry point called by the mode dispatcher in [`crate::api`].
///
/// Parses `base`, `k` and `maxAttempts` from `payload`. Applies `k` random moves and
/// returns the perturbed solution.
pub fn perturbation(
    problem: &Problem,
    payload: &Value,
    rng: &mut ThreadRng,
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
/// Retries up to `max_attempts` times until the resulting candidate is feasible. If no
/// feasible candidate is found, returns the original solution unchanged.
fn apply_random_move(
    problem: &Problem,
    solution: &Solution,
    max_attempts: usize,
    rng: &mut ThreadRng,
) -> Result<(Solution, usize)> {
    for attempt in 1..=max_attempts {
        let candidate = random_neighbor(problem, solution, rng);
        if problem.is_feasible(&candidate)? {
            return Ok((candidate, attempt));
        }
    }
    Ok((solution.clone(), max_attempts))
}

/// Generate a single random neighbor of `solution` without checking feasibility.
fn random_neighbor(problem: &Problem, solution: &Solution, rng: &mut ThreadRng) -> Solution {
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
    use serde_json::json;

    fn knapsack() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../examples/knapsack.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    fn tsp() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../examples/tsp.json")).unwrap();
        Problem::from_json(v).unwrap()
    }

    #[test]
    fn perturbs_vector_solution() {
        let p = knapsack();
        let mut rng = rand::thread_rng();
        let payload = json!({
            "base": { "variableValue": [1,1,1,1,0] },
            "k": 2,
            "maxAttempts": 50
        });
        let result = perturbation(&p, &payload, &mut rng).unwrap();
        let perturbed = &result["winner"];
        assert!(perturbed["isFeasible"].as_bool().unwrap());
        assert_eq!(perturbed["variableValue"].as_array().unwrap().len(), 5);
    }

    #[test]
    fn perturbs_permutation_solution() {
        let p = tsp();
        let mut rng = rand::thread_rng();
        let payload = json!({
            "base": { "variableValue": [1,2,3,4] },
            "k": 2,
            "maxAttempts": 50
        });
        let result = perturbation(&p, &payload, &mut rng).unwrap();
        let perturbed = &result["winner"];
        assert!(perturbed["isFeasible"].as_bool().unwrap());
        assert_eq!(perturbed["variableValue"].as_array().unwrap().len(), 4);
    }
}