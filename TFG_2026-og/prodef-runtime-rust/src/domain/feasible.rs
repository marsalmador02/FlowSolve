//! Sampling feasible solutions (domain logic, not JSON).

use anyhow::{bail, Result};
use rand::prelude::StdRng;

use crate::domain::solution::Solution;
use crate::domain::runtime::RuntimeProblem;

const GENERATE_ATTEMPTS: usize = 100_000;

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
