// modes/neighborhood.rs
//
// Mode: `neighborhood`
//
// Generates all neighbors of a base solution using exhaustive moves:
//   - Permutation: all pairwise swaps
//   - Binary vector: all single-bit flips
//   - Integer/continuous vector: ±1 at every position (within bounds)
//
// Payload:  { "base": { "variableValue": [...] } }
// Response: { "neighbors": [ SolverResult, ... ] }

use anyhow::{bail, Context, Result};
use rand::rngs::ThreadRng;
use serde_json::{json, Value};

use crate::problem::Problem;
use crate::solution::{require_object, Solution, SolverResult};

pub fn neighborhood(
    problem: &Problem,
    payload: &Value,
    _rng: &mut ThreadRng,
) -> Result<Value> {
    let obj = require_object(payload)?;

    let base_val = obj.get("base").context("neighborhood requires `base`")?;
    let base = Solution::from_candidate(problem, base_val)
        .context("neighborhood `base` is missing or invalid `variableValue`")?;

    if !problem.is_feasible(&base)? {
        bail!("neighborhood `base` solution is not feasible");
    }

    let neighbors = generate_neighbors(problem, &base)?;

    let results: Vec<Value> = neighbors
        .iter()
        .map(|n| Ok(serde_json::to_value(SolverResult::build(problem, n)?)?))
        .collect::<Result<_>>()?;

    Ok(json!({
        "generated": results.clone(),
        "feasible": results,
        "neighbors": results
    }))
}

/// Enumerate every neighbor reachable by a single move from `solution`.
fn generate_neighbors(problem: &Problem, solution: &Solution) -> Result<Vec<Solution>> {
    match solution {
        Solution::Permutation(p) => {
            let mut out = Vec::new();
            for i in 0..p.len() {
                for j in (i + 1)..p.len() {
                    let mut next = p.clone();
                    next.swap(i, j);
                    out.push(Solution::Permutation(next));
                }
            }
            Ok(out)
        }
        Solution::Vector(v) => {
            let lo = problem.lower();
            let hi = problem.upper();
            let is_binary = (hi - lo - 1.0).abs() < 1e-9;
            let mut out = Vec::new();

            for i in 0..v.len() {
                if is_binary {
                    // Flip this bit.
                    let mut next = v.clone();
                    next[i] = if next[i] == 0.0 { 1.0 } else { 0.0 };
                    out.push(Solution::Vector(next));
                } else {
                    // Step down.
                    if v[i] - 1.0 >= lo {
                        let mut next = v.clone();
                        next[i] -= 1.0;
                        out.push(Solution::Vector(next));
                    }
                    // Step up.
                    if v[i] + 1.0 <= hi {
                        let mut next = v.clone();
                        next[i] += 1.0;
                        out.push(Solution::Vector(next));
                    }
                }
            }
            Ok(out)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::ThreadRng;
    use rand::SeedableRng;
    use serde_json::json;

    fn knapsack() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../../examples/knapsack.json")).unwrap();
        Problem::try_from(v).unwrap()
    }

    fn tsp() -> Problem {
        let v: serde_json::Value =
            serde_json::from_str(include_str!("../../../examples/tsp.json")).unwrap();
        Problem::try_from(v).unwrap()
    }

    #[test]
    fn binary_vector_neighborhood_has_n_neighbors() {
        let p = knapsack(); // var_size = 5, binary
        let mut rng = StdRng::seed_from_u64(42);
        let payload = json!({ "base": { "variableValue": [1,1,1,1,0] } });
        let result = neighborhood(&p, &payload, &mut rng).unwrap();
        let neighbors = result["neighbors"].as_array().unwrap();
        // One flip per position → 5 neighbors
        assert_eq!(neighbors.len(), 5);
    }

    #[test]
    fn permutation_neighborhood_has_n_choose_2_neighbors() {
        let p = tsp(); // var_size = 4
        let mut rng = StdRng::seed_from_u64(42);
        let payload = json!({ "base": { "variableValue": [1,2,3,4] } });
        let result = neighborhood(&p, &payload, &mut rng).unwrap();
        let neighbors = result["neighbors"].as_array().unwrap();
        // C(4,2) = 6 swap neighbors
        assert_eq!(neighbors.len(), 6);
    }
}