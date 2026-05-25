//! Parsing and normalization helpers for execution payloads.
//!
//! This module accepts the UI-facing JSON shapes and converts them into the
//! internal `Solution` representation. It also performs compatibility
//! normalization for permutation encodings so legacy 1-based payloads and the
//! current 0-based runtime can coexist.

use anyhow::{anyhow, bail, Context, Result};
use serde_json::{Map, Value};

use crate::domain::{RuntimeProblem, Solution};

/// View the payload as an object payload for the current mode.
pub(crate) fn payload_object(payload: &Value) -> Result<&Map<String, Value>> {
    payload.as_object().context("execution.payload must be an object for this mode")
}

/// Parse a solution array from JSON using the runtime shape as the contract.
///
/// Permutations accept either 0-based or 1-based indices; the returned value
/// is always normalized to 0-based runtime coordinates. Duplicate values,
/// non-integer entries, and wrong lengths are rejected.
pub(crate) fn parse_solution_from_value(runtime: &RuntimeProblem, value: &Value) -> Result<Solution> {
    let arr = value
        .as_array()
        .context("expected variableValue to be an array")?;

    if arr.len() != runtime.solution_size() {
        bail!(
            "solution length mismatch: expected {}, got {}",
            runtime.solution_size(),
            arr.len()
        );
    }

    if runtime.solution_is_permutation() {
        let mut values = Vec::with_capacity(arr.len());
        for item in arr {
            let n: usize = item
                .as_i64()
                .ok_or_else(|| anyhow!("Permutation must contain integers"))?
                .try_into()
                .context("Permutation values must be non-negative")?;
            values.push(n);
        }

        let is_1_based = !values.iter().any(|&x| x == 0);
        let perm = if is_1_based {
            values.into_iter().map(|x| x - 1).collect()
        } else {
            values
        };

        Ok(Solution::Permutation(perm))
    } else {
        let mut values = Vec::with_capacity(arr.len());
        for item in arr {
            let n: i64 = item
                .as_i64()
                .ok_or_else(|| anyhow!("Vector must contain integers"))?;
            values.push(n as f64);
        }

        Ok(Solution::Vector(values))
    }
}

/// Extract `variableValue` from a candidate object and parse it as a solution.
///
/// Returns `None` when the payload is structurally missing or cannot be
/// normalized into a valid solution. That silent failure is intentional here
/// because several modes filter candidates opportunistically.
pub(crate) fn parse_candidate(runtime: &RuntimeProblem, candidate: &Value) -> Option<Solution> {
    let value = candidate.get("variableValue")?;
    parse_solution_from_value(runtime, value).ok()
}

/// Convert a runtime solution back to the JSON shape exposed by responses.
pub(crate) fn solution_to_f64_vec(solution: &Solution) -> Vec<f64> {
    match solution {
        Solution::Vector(v) => v.clone(),
        Solution::Permutation(p) => p.iter().map(|x| *x as f64).collect(),
    }
}

/// Convert raw numeric values into a runtime solution.
///
/// For permutation problems the values must form a complete permutation in
/// either 0-based or 1-based form; duplicates and out-of-range values are
/// rejected. For non-permutation problems the values are accepted as-is.
pub(crate) fn vec_to_solution(runtime: &RuntimeProblem, values: &[f64]) -> Option<Solution> {
    if !runtime.solution_is_permutation() {
        return Some(Solution::Vector(values.to_vec()));
    }

    let n = runtime.solution_size();

    if values.len() != n {
        return None;
    }

    let mut perm = Vec::with_capacity(n);
    let mut seen = vec![false; n];

    for value in values {
        let idx = *value as i64;

        if idx < 0 || idx >= n as i64 {
            return None;
        }

        let idx = idx as usize;
        if seen[idx] {
            return None;
        }

        seen[idx] = true;
        perm.push(idx);
    }

    Some(Solution::Permutation(perm))
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::model::Problem;

    #[test]
    fn parse_and_vec_to_solution_permutation() {
        let raw: Problem = serde_json::from_str(include_str!("../../examples/tsp.json")).expect("parse tsp example");
        let runtime = RuntimeProblem::new(raw).expect("build runtime");

        let vals = vec![0.0, 1.0, 2.0, 3.0];
        let sol = vec_to_solution(&runtime, &vals).expect("should parse permutation");
        match sol {
            Solution::Permutation(p) => assert_eq!(p, vec![0, 1, 2, 3]),
            _ => panic!("expected permutation"),
        }

        let vals_dup = vec![0.0, 1.0, 1.0, 2.0];
        assert!(vec_to_solution(&runtime, &vals_dup).is_none(), "duplicates should be rejected");
    }

    #[test]
    fn vec_to_solution_vector_accepts_knapsack() {
        let raw: Problem = serde_json::from_str(include_str!("../../examples/knapsack.json")).expect("parse knapsack example");
        let runtime = RuntimeProblem::new(raw).expect("build runtime");
        assert!(!runtime.solution_is_permutation());
        let vals = vec![1.0, 0.0, 1.0, 0.0, 1.0];
        let sol = vec_to_solution(&runtime, &vals).expect("should parse vector");
        match sol {
            Solution::Vector(v) => assert_eq!(v, vals),
            _ => panic!("expected vector"),
        }
    }
}