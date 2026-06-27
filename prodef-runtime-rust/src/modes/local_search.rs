//! # Mode: `local-search`
//!
//! Local search using a best-improvement strategy: evaluates every neighbor of the
//! current solution in one step and moves to the one with the best objective value.
//!
//! ## Request payload
//!
//! ```json
//! { "solution": { "variableValue": [1, 0, 1, 0, 0] } }
//! ```
//!
//! The starting solution must be feasible.
//!
//! ## Response
//!
//! ```json
//! { "result": { "isFeasible": true, "goalValues": […], "variableValue": […] } }
//! ```
//!
//! ## Algorithm
//!
//! 1. Enumerate every neighbor via a single move (swap for permutations, flip for
//!    vectors).
//! 2. Among feasible neighbors, select the one with the best score.
//! 3. If it improves on the starting solution, move to it. Otherwise stay.

use anyhow::{bail, Context, Result};
use rand::rngs::ThreadRng;
use serde_json::{Value};

use crate::problem::Problem;
use crate::solution::{require_object, Solution, SolverResult};

/// Entry point called by the mode dispatcher in [`crate::api`].
///
/// Parses the starting solution from `payload`, runs one best-improvement step and
/// returns the result.
pub fn local_search(problem: &Problem, payload: &Value, _rng: &mut ThreadRng) -> Result<SolverResult> {
    let obj = require_object(payload)?;

    let sol_val = obj.get("solution").context("local-search requires `solution`")?;
    let start = Solution::from_candidate(problem, sol_val)
        .context("local-search `solution` is missing or invalid `variableValue`")?;

    let (best, _trace) = run(problem, start)?;
    SolverResult::build(problem, &best)
}


/// Run one best-improvement local search step from `start`.
///
/// Returns the best neighbor found (or `start` if no improvement exists) together with
/// a human-readable trace of every move tried.
fn run(problem: &Problem, start: Solution) -> Result<(Solution, Vec<String>)> {
    if !problem.is_feasible(&start)? {
        bail!("local-search requires a feasible starting solution");
    }

    let mut trace = Vec::new();
    let start_score = problem.score(&start)?;
    trace.push(format!(
        "Start: solution={} score={:.3}",
        fmt(&start),
        start_score
    ));

    let (best, best_move, step_trace) = best_neighbor(problem, &start)?;
    let best_score = problem.score(&best)?;
    let delta = best_score - start_score;

    for line in step_trace {
        trace.push(format!("  {}", line));
    }
    trace.push(format!(
        "Step 1: best move: {} -> score={:.3} (Δ{:+.3})",
        best_move, best_score, delta
    ));

    if delta.abs() < 1e-12 {
        trace.push(format!("Stop: no improvement (best score={:.3})", start_score));
        trace.push(format!("Final solution: {}", fmt(&start)));
        return Ok((start, trace));
    }

    trace.push(format!("Stop: completed 1 step (best score={:.3})", best_score));
    trace.push(format!("Final solution: {}", fmt(&best)));
    Ok((best, trace))
}

/// Enumerate every neighbor of `solution` and return the best feasible one.
///
/// Returns the best solution found, its move description and the full per-move trace.
fn best_neighbor(
    problem: &Problem,
    solution: &Solution,
) -> Result<(Solution, String, Vec<String>)> {
    let base_score = problem.score(solution)?;
    let mut best = solution.clone();
    let mut best_move = "keep current".to_string();
    let mut best_score = base_score;
    let mut trace = Vec::new();

    match solution {
        Solution::Permutation(p) => {
            for i in 0..p.len() {
                for j in (i + 1)..p.len() {
                    let mut next_p = p.clone();
                    next_p.swap(i, j);
                    let candidate = Solution::Permutation(next_p);
                    let move_name = format!("swap pos {} <-> {}", i + 1, j + 1);
                    try_move(problem, candidate, &move_name, base_score, &mut best, &mut best_move, &mut best_score, &mut trace)?;
                }
            }
        }

        Solution::Vector(v) => {
            let lo = problem.lower();
            let hi = problem.upper();
            let is_binary = (hi - lo - 1.0).abs() < 1e-9;

            for i in 0..v.len() {
                if is_binary {
                    let flipped = if v[i] == 0.0 { 1.0 } else { 0.0 };
                    let mut next = v.clone();
                    next[i] = flipped;
                    let move_name = format!("flip x[{}] {}->{}",
                        i + 1, v[i] as i64, flipped as i64);
                    try_move(problem, Solution::Vector(next), &move_name, base_score, &mut best, &mut best_move, &mut best_score, &mut trace)?;
                } else {
                    if v[i] - 1.0 >= lo {
                        let mut next = v.clone();
                        next[i] -= 1.0;
                        let move_name = format!("set x[{}] from {:.3} to {:.3}", i + 1, v[i], v[i] - 1.0);
                        try_move(problem, Solution::Vector(next), &move_name, base_score, &mut best, &mut best_move, &mut best_score, &mut trace)?;
                    }
                    if v[i] + 1.0 <= hi {
                        let mut next = v.clone();
                        next[i] += 1.0;
                        let move_name = format!("set x[{}] from {:.3} to {:.3}", i + 1, v[i], v[i] + 1.0);
                        try_move(problem, Solution::Vector(next), &move_name, base_score, &mut best, &mut best_move, &mut best_score, &mut trace)?;
                    }
                }
            }
        }
    }

    Ok((best, best_move, trace))
}

/// Evaluate one candidate move and update the running best if it improves.
///
/// Infeasible candidates are skipped.
fn try_move(
    problem: &Problem,
    candidate: Solution,
    move_name: &str,
    base_score: f64,
    best: &mut Solution,
    best_move: &mut String,
    best_score: &mut f64,
    trace: &mut Vec<String>,
) -> Result<()> {
    if !problem.is_feasible(&candidate)? {
        trace.push(format!("try {} -> infeasible", move_name));
        return Ok(());
    }
    let score = problem.score(&candidate)?;
    trace.push(format!(
        "try {} -> score={:.3} (Δ{:+.3})",
        move_name,
        score,
        score - base_score
    ));
    if problem.is_better(score, *best_score) {
        *best_score = score;
        *best = candidate;
        *best_move = move_name.to_string();
    }
    Ok(())
}

/// Format a solution compactly for use in trace messages.
fn fmt(solution: &Solution) -> String {
    match solution {
        Solution::Permutation(p) => {
            let s: Vec<String> = p.iter().map(|x| (x + 1).to_string()).collect();
            format!("perm[{}]", s.join(","))
        }
        Solution::Vector(v) => {
            let s: Vec<String> = v
                .iter()
                .map(|x| {
                    if (x.round() - x).abs() < 1e-9 { format!("{}", *x as i64) }
                    else { format!("{:.3}", x) }
                })
                .collect();
            format!("vec[{}]", s.join(","))
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn load(path: &str) -> Problem {
        let v: serde_json::Value = serde_json::from_str(path).unwrap();
        Problem::from_json(v).unwrap()
    }

    #[test]
    fn knapsack_local_search() {
        let p = load(include_str!("../../examples/knapsack.json"));
        let init = Solution::Vector(vec![0.0; p.var_size()]);
        let (res, trace) = run(&p, init).unwrap();
        assert!(trace.iter().any(|s| s.contains("Start: solution=vec[0,0,0,0,0] score=0.000")));
        assert!(trace.iter().any(|s| s.contains("Step 1: best move: flip x[4] 0->1 -> score=37.000 (Δ+37.000)")));
        assert!(trace.iter().any(|s| s.contains("Final solution: vec[0,0,0,1,0]")));
        match res { Solution::Vector(_) | Solution::Permutation(_) => {} }
    }

    #[test]
    fn tsp_local_search() {
        let p = load(include_str!("../../examples/tsp.json"));
        let init = Solution::Permutation((0..p.var_size()).collect());
        let (res, trace) = run(&p, init).unwrap();
        assert!(trace.iter().any(|s| s.contains("Start: solution=perm[1,2,3,4] score=75.000")));
        assert!(trace.iter().any(|s| s.contains("Step 1: best move: swap pos 1 <-> 2 -> score=56.000 (Δ-19.000)")));
        assert!(trace.iter().any(|s| s.contains("Final solution: perm[2,1,3,4]")));
        match res { Solution::Vector(_) | Solution::Permutation(_) => {} }
    }

    #[test]
    fn local_search_mode_via_payload() {
        let p = load(include_str!("../../examples/knapsack.json"));
        let mut rng = rand::thread_rng();
        let payload = json!({ "solution": { "variableValue": [0,0,0,0,0] } });
        let result = local_search(&p, &payload, &mut rng).unwrap();
        assert!(result.is_feasible);
        assert!(!result.goal_values.is_empty());
    }
}