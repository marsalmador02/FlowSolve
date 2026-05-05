//! Evaluation of numeric expressions and constraints in the runtime.

mod expr;

pub(crate) use expr::{eval_constraint, eval_numeric_expr};
