//! # Execution mode handlers
//!
//! Each submodule implements one `execution.mode` value.

pub mod generate;
pub mod local_search;
pub mod neighborhood;
pub mod perturbation;
pub mod select_best;
pub mod temperature_acceptance;