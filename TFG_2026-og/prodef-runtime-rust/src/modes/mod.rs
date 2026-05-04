//! Execution modes: business logic for each `execution.mode` value.
//!
//! - **Uniform entry**: [`dispatch`](fn.dispatch.html) with [`ModeContext`](context::ModeContext) → [`ModeOutcome`](context::ModeOutcome).
//! - **Payload contracts**: See docstrings in each mode module for JSON field documentation.

use anyhow::{bail, Result};

pub(crate) mod common;
pub(crate) mod context;

pub(crate) mod crossover;
pub(crate) mod generate;
pub(crate) mod local_search;
pub(crate) mod mutation;
pub(crate) mod neighborhood;
pub(crate) mod perturbation;
pub(crate) mod select_best;
pub(crate) mod selection;
pub(crate) mod temperature_acceptance;

pub(crate) use context::{ModeContext, ModeOutcome};

/// Routes normalized `mode` string to the corresponding handler.
pub(crate) fn dispatch(mode: &str, ctx: ModeContext<'_>) -> Result<ModeOutcome> {
    match mode {
        "generate" => generate::execute_single(ctx),
        "generate-population" => generate::execute_population(ctx),
        "local-search" | "local_search" => local_search::execute(ctx),
        "select-best" | "selection-best" => select_best::execute(ctx),
        "selection" => selection::execute(ctx),
        "crossover" => crossover::execute(ctx),
        "mutation" => mutation::execute(ctx),
        "perturbation" => perturbation::execute(ctx),
        "neighborhood" => neighborhood::execute(ctx),
        "temperature-acceptance" | "temperature_acceptance" => temperature_acceptance::execute(ctx),
        other => bail!(
            "Unsupported execution.mode '{other}'"
        ),
    }
}
