//! Local search trajectory for a single starting solution.
//!
//! The search operates on the runtime solution shape and returns the best
//! feasible neighbor found in one pass over the neighborhood. The trace is for
//! diagnostics, while the search result remains a plain `Solution`.

use anyhow::{bail, Result};

use crate::domain::{RuntimeProblem, Solution};

/// Run one local-search pass from a feasible starting solution.
///
/// The returned trace records each candidate neighborhood move, the resulting
/// score, and the stopping reason.
pub(crate) fn run(
    problem: &RuntimeProblem,
    solution: Solution,
) -> Result<(Solution, Vec<String>)> {
    if !problem.is_feasible(&solution)? {
        bail!("Initial solution is not feasible; LocalSearch requires feasible input");
    }

    let mut trace = Vec::new();

    let current_score = problem.objective_score(&solution)?;
    trace.push(format!(
        "Start: solution={} score={:.3}",
        format_solution(&solution),
        current_score
    ));

    let (best_solution, best_move, step_logs) = local_search_step(problem, &solution)?;
    let best_score = problem.objective_score(&best_solution)?;
    let delta = best_score - current_score;

    for line in step_logs {
        trace.push(format!("  {}", line));
    }

    trace.push(format!(
        "Step 1: best move: {} -> score={:.3} (Δ{:+.3})",
        best_move, best_score, delta
    ));

    if delta.abs() < 1e-12 {
        trace.push(format!("Stop: no improvement (best score={:.3})", current_score));
        trace.push(format!("Final solution: {}", format_solution(&solution)));
        return Ok((solution, trace));
    }

    trace.push(format!(
        "Stop: completed 1 step (best score={:.3})",
        best_score
    ));
    trace.push(format!("Final solution: {}", format_solution(&best_solution)));

    Ok((best_solution, trace))
}

fn local_search_step(
    problem: &RuntimeProblem,
    solution: &Solution,
) -> Result<(Solution, String, Vec<String>)> {
    let base_score = problem.objective_score(solution)?;

    let mut best_solution = solution.clone();
    let mut best_move = "keep current".to_string();
    let mut best_score = base_score;

    let mut trace = Vec::new();

    match solution {
        Solution::Permutation(p) => {
            for i in 0..p.len() {
                for j in (i + 1)..p.len() {
                    let mut candidate_perm = p.clone();
                    candidate_perm.swap(i, j);

                    let candidate = Solution::Permutation(candidate_perm);
                    let move_name = format!("swap pos {} <-> {}", i + 1, j + 1);

                    if !problem.is_feasible(&candidate)? {
                        trace.push(format!("try {} -> infeasible", move_name));
                        continue;
                    }

                    let score = problem.objective_score(&candidate)?;
                    trace.push(format!(
                        "try {} -> score={:.3} (Δ{:+.3})",
                        move_name,
                        score,
                        score - base_score
                    ));

                    if problem.is_better_score(score, best_score) {
                        best_score = score;
                        best_solution = candidate;
                        best_move = move_name;
                    }
                }
            }
        }

        Solution::Vector(v) => {
            let var = &problem.raw.variables[0];

            let is_integer_like = var.within == "integers" || var.within == "binary";
            let (lower_bound, upper_bound) = vector_bounds(problem)?;

            let is_binary = var.within == "binary"
                || ((lower_bound - 0.0).abs() < 1e-9 && (upper_bound - 1.0).abs() < 1e-9);

            if is_binary {
                for i in 0..v.len() {
                    let current = v[i].round();

                    let flipped = if current == 0.0 { 1.0 } else { 0.0 };

                    let mut candidate_vec = v.clone();
                    candidate_vec[i] = flipped;

                    let candidate = Solution::Vector(candidate_vec);
                    let move_name = format!("flip x[{}] {}->{}", i + 1, current as i64, flipped as i64);

                    if !problem.is_feasible(&candidate)? {
                        trace.push(format!("try {} -> infeasible", move_name));
                        continue;
                    }

                    let score = problem.objective_score(&candidate)?;
                    trace.push(format!(
                        "try {} -> score={:.3} (Δ{:+.3})",
                        move_name,
                        score,
                        score - base_score
                    ));

                    if problem.is_better_score(score, best_score) {
                        best_score = score;
                        best_solution = candidate;
                        best_move = move_name;
                    }
                }

                return Ok((best_solution, best_move, trace));
            }

            if is_integer_like {
                for i in 0..v.len() {
                    let current = v[i].round();
                    let flipped = if (current - 0.0).abs() < 1e-9 { 1.0 } else { 0.0 };

                    let mut candidate_vec = v.clone();
                    candidate_vec[i] = flipped;

                    let candidate = Solution::Vector(candidate_vec);
                    let move_name = format!("flip x[{}] {}->{}", i + 1, current as i64, flipped as i64);

                    if !problem.is_feasible(&candidate)? {
                        trace.push(format!("try {} -> infeasible", move_name));
                        continue;
                    }

                    let score = problem.objective_score(&candidate)?;
                    trace.push(format!(
                        "try {} -> score={:.3} (Δ{:+.3})",
                        move_name,
                        score,
                        score - base_score
                    ));

                    if problem.is_better_score(score, best_score) {
                        best_score = score;
                        best_solution = candidate;
                        best_move = move_name;
                    }
                }
            } else {
                for i in 0..v.len() {
                    let current_value = v[i];

                    let down = (current_value - 1.0).max(lower_bound);
                    if (down - current_value).abs() > 1e-12 {
                        let mut candidate_vec = v.clone();
                        candidate_vec[i] = down;

                        let candidate = Solution::Vector(candidate_vec);
                        let move_name =
                            format!("set x[{}] from {:.3} to {:.3}", i + 1, current_value, down);

                        if !problem.is_feasible(&candidate)? {
                            trace.push(format!("try {} -> infeasible", move_name));
                        } else {
                            let score = problem.objective_score(&candidate)?;
                            trace.push(format!(
                                "try {} -> score={:.3} (Δ{:+.3})",
                                move_name,
                                score,
                                score - base_score
                            ));

                            if problem.is_better_score(score, best_score) {
                                best_score = score;
                                best_solution = candidate;
                                best_move = move_name;
                            }
                        }
                    }

                    let up = (current_value + 1.0).min(upper_bound);
                    if (up - current_value).abs() > 1e-12 {
                        let mut candidate_vec = v.clone();
                        candidate_vec[i] = up;

                        let candidate = Solution::Vector(candidate_vec);
                        let move_name =
                            format!("set x[{}] from {:.3} to {:.3}", i + 1, current_value, up);

                        if !problem.is_feasible(&candidate)? {
                            trace.push(format!("try {} -> infeasible", move_name));
                        } else {
                            let score = problem.objective_score(&candidate)?;
                            trace.push(format!(
                                "try {} -> score={:.3} (Δ{:+.3})",
                                move_name,
                                score,
                                score - base_score
                            ));

                            if problem.is_better_score(score, best_score) {
                                best_score = score;
                                best_solution = candidate;
                                best_move = move_name;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok((best_solution, best_move, trace))
}

fn format_solution(solution: &Solution) -> String {
    match solution {
        Solution::Permutation(p) => {
            let values: Vec<String> = p.iter().map(|x| (x + 1).to_string()).collect();
            format!("perm[{}]", values.join(","))
        }
        Solution::Vector(v) => {
            let values: Vec<String> = v
                .iter()
                .map(|x| {
                    if (x.round() - x).abs() < 1e-9 {
                        format!("{}", *x as i64)
                    } else {
                        format!("{:.3}", x)
                    }
                })
                .collect();

            format!("vec[{}]", values.join(","))
        }
    }
}

fn vector_bounds(problem: &RuntimeProblem) -> Result<(f64, f64)> {
    let var = problem
        .raw
        .variables
        .first()
        .ok_or_else(|| anyhow::anyhow!("Problem has no variables"))?;

    let default_upper = if var.within == "binary" { 1.0 } else { 10.0 };

    let lower_bound = var
        .range
        .as_ref()
        .and_then(|r| r.lower_bound.as_ref())
        .map(bound_to_f64)
        .transpose()?
        .unwrap_or(0.0);

    let upper_bound = var
        .range
        .as_ref()
        .and_then(|r| r.upper_bound.as_ref())
        .map(bound_to_f64)
        .transpose()?
        .unwrap_or(default_upper);

    Ok((lower_bound, upper_bound))
}

fn bound_to_f64(bound: &serde_json::Value) -> Result<f64> {
    match bound {
        serde_json::Value::Number(n) => n
            .as_f64()
            .ok_or_else(|| anyhow::anyhow!("Invalid numeric bound")),
        serde_json::Value::String(s) => {
            if s.eq_ignore_ascii_case("infinity") || s.eq_ignore_ascii_case("+infinity") {
                Ok(f64::INFINITY)
            } else if s.eq_ignore_ascii_case("-infinity") {
                Ok(f64::NEG_INFINITY)
            } else {
                s.parse::<f64>().map_err(|_| {
                    anyhow::anyhow!(
                        "Invalid string bound '{}': expected number or Infinity",
                        s
                    )
                })
            }
        }
        _ => bail!("Invalid bound value type"),
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::model::Problem;

    fn identity_permutation(n: usize) -> Solution {
        Solution::Permutation((0..n).collect())
    }

    #[test]
    fn local_search_runs_on_knapsack_example() {
        let raw: Problem = serde_json::from_str(include_str!("../../examples/knapsack.json")).expect("parse knapsack");
        let runtime = RuntimeProblem::new(raw).expect("build runtime");
        
        let init = Solution::Vector(vec![0.0; runtime.solution_size()]);
        assert!(runtime.is_feasible(&init).unwrap());
        let (res, trace) = run(&runtime, init).expect("local search run");
        
        assert!(trace.iter().any(|s| s.contains("Start: solution=vec[0,0,0,0,0] score=0.000")));
        assert!(trace.iter().any(|s| s.contains("Step 1: best move: flip x[4] 0->1 -> score=37.000 (Δ+37.000)")));
        assert!(trace.iter().any(|s| s.contains("Final solution: vec[0,0,0,1,0]")));

        match res {
            Solution::Vector(_) | Solution::Permutation(_) => {}
        }
    }

    #[test]
    fn local_search_runs_on_knapsack_complex() {
        let raw: Problem = serde_json::from_str(include_str!("../../examples/knapsack_complex.json")).expect("parse knapsack complex");
        let runtime = RuntimeProblem::new(raw).expect("build runtime");
        
        let init = Solution::Vector(vec![0.0; runtime.solution_size()]);
        assert!(runtime.is_feasible(&init).unwrap());
        let (res, trace) = run(&runtime, init).expect("local search run");
        
        assert!(trace.iter().any(|s| s.contains("Start: solution=vec[0,0,0,0,0,0,0,0,0,0] score=0.000")));
        assert!(trace.iter().any(|s| s.contains("Step 1: best move: flip x[9] 0->1 -> score=35.000 (Δ+35.000)")));
        assert!(trace.iter().any(|s| s.contains("Final solution: vec[0,0,0,0,0,0,0,0,1,0]")));

        match res {
            Solution::Vector(_) | Solution::Permutation(_) => {}
        }
    }

    #[test]
    fn local_search_runs_on_tsp_example() {
        let raw: Problem =
            serde_json::from_str(include_str!("../../examples/tsp.json"))
                .expect("parse tsp");
        let runtime = RuntimeProblem::new(raw).expect("build runtime");

        let init = identity_permutation(runtime.solution_size());
        assert!(runtime.is_feasible(&init).unwrap());

        let (res, trace) = run(&runtime, init).expect("local search run");

        assert!(trace.iter().any(|s| s.contains("Start: solution=perm[1,2,3,4] score=75.000")));
        assert!(trace.iter().any(|s| s.contains("Step 1: best move: swap pos 1 <-> 2 -> score=56.000 (Δ-19.000)")));
        assert!(trace.iter().any(|s| s.contains("Final solution: perm[2,1,3,4]")));

        match res {
            Solution::Vector(_) | Solution::Permutation(_) => {}
        }
    }

    #[test]
    fn local_search_runs_on_tsp_complex_example() {
        let raw: Problem =
            serde_json::from_str(include_str!("../../examples/tsp_complex.json"))
                .expect("parse tsp complex");
        let runtime = RuntimeProblem::new(raw).expect("build runtime");

        let init = identity_permutation(runtime.solution_size());
        assert!(runtime.is_feasible(&init).unwrap());

        let (res, trace) = run(&runtime, init).expect("local search run");

        assert!(trace.iter().any(|s| s.contains("Start: solution=perm[1,2,3,4,5,6,7] score=102.000")));
        assert!(trace.iter().any(|s| s.contains("Step 1: best move: swap pos 1 <-> 4 -> score=74.000 (Δ-28.000)")));
        assert!(trace.iter().any(|s| s.contains("Final solution: perm[4,2,3,1,5,6,7]")));

        match res {
            Solution::Vector(_) | Solution::Permutation(_) => {}
        }
    }

    #[test]
    fn local_search_runs_on_assignment_example() {
        let raw: Problem =
            serde_json::from_str(include_str!("../../examples/assignment.json"))
                .expect("parse assignment");
        let runtime = RuntimeProblem::new(raw).expect("build runtime");

        let init = identity_permutation(runtime.solution_size());
        assert!(runtime.is_feasible(&init).unwrap());

        let (res, trace) = run(&runtime, init).expect("local search run");

        assert!(trace.iter().any(|s| s.contains("Start: solution=perm[1,2,3,4] score=39.000")));
        assert!(trace.iter().any(|s| s.contains("Step 1: best move: swap pos 1 <-> 2 -> score=20.000 (Δ-19.000)")));
        assert!(trace.iter().any(|s| s.contains("Final solution: perm[2,1,3,4]")));

        match res {
            Solution::Vector(_) | Solution::Permutation(_) => {}
        }
    }

    #[test]
    fn local_search_runs_on_assignment_complex_example() {
        let raw: Problem =
            serde_json::from_str(include_str!("../../examples/assignment_complex.json"))
                .expect("parse assignment complex");
        let runtime = RuntimeProblem::new(raw).expect("build runtime");

        let init = identity_permutation(runtime.solution_size());
        assert!(runtime.is_feasible(&init).unwrap());

        let (res, trace) = run(&runtime, init).expect("local search run");

        assert!(trace.iter().any(|s| s.contains("Start: solution=perm[1,2,3,4,5,6,7,8,9] score=157.000")));
        assert!(trace.iter().any(|s| s.contains("Step 1: best move: swap pos 1 <-> 2 -> score=133.000 (Δ-24.000)")));
        assert!(trace.iter().any(|s| s.contains("Final solution: perm[2,1,3,4,5,6,7,8,9]")));

        match res {
            Solution::Vector(_) | Solution::Permutation(_) => {}
        }
    }
}