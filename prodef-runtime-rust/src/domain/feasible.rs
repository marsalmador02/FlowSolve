//! Sampling feasible solutions that satisfy the runtime constraints.
//!
//! This helper bridges random generation and the modes that require a feasible
//! starting point or a feasible population. It retries until it finds a valid
//! candidate or reaches the configured attempt limit.

use anyhow::{bail, Result};
use rand::prelude::StdRng;

use crate::domain::solution::Solution;
use crate::domain::runtime::RuntimeProblem;

const GENERATE_ATTEMPTS: usize = 100_000;

/// Try random candidates until one satisfies the runtime constraints.
pub(crate) fn generate_feasible(runtime: &RuntimeProblem, rng: &mut StdRng) -> Result<Solution> {
    for _ in 0..GENERATE_ATTEMPTS {
        let candidate = runtime.generate_random_solution(rng);
        if runtime.is_feasible(&candidate)? {
            return Ok(candidate);
        }
    }
    bail!(
        "No feasible random solution found after {} attempts",
        GENERATE_ATTEMPTS
    )
}
