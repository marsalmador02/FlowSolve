//! Library facade for `prodef-runtime-rust`.
//!
//! This crate exposes selected internal modules for documentation and
//! testing purposes (doctests). The binary target remains `main.rs`.

pub(crate) mod api;
pub(crate) mod domain;
pub(crate) mod evaluation;
pub(crate) mod modes;
pub(crate) mod search;
pub mod operators;
