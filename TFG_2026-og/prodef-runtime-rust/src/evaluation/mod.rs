// This module contains the logic for evaluating expressions in the context of a problem and a solution.

mod expr;

pub(crate) use expr::{eval_constraint, eval_numeric_expr};
