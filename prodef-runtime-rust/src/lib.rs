//! Library facade for `prodef-runtime-rust`.
//!
//! This crate exposes selected internal modules for documentation
//! purposes.

#![cfg_attr(test, allow(dead_code))]
#![allow(dead_code)]

pub(crate) mod api;
pub(crate) mod domain;
pub(crate) mod evaluation;
pub(crate) mod modes;
pub(crate) mod search;
pub mod operators;
