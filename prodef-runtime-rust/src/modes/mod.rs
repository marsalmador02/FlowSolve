// modes/mod.rs
//
// The dispatcher lives in api.rs as a plain match expression.
// This file just declares the submodules.

pub(crate) mod generate;
pub(crate) mod local_search;
pub(crate) mod neighborhood;
pub(crate) mod perturbation;
pub(crate) mod select_best;
pub(crate) mod temperature_acceptance;