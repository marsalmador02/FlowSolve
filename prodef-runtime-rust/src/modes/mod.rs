// modes/mod.rs
//
// The dispatcher lives in api.rs as a plain match expression.
// This file just declares the submodules.

pub mod generate;
pub mod local_search;
pub mod neighborhood;
pub mod perturbation;
pub mod select_best;
pub mod temperature_acceptance;