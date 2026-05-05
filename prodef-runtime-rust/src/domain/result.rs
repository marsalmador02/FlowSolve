//! Canonical single-solution result returned by execution modes.

use serde::Serialize;

/// Result of a solver execution returned in `ExecutionResponse.result`.
#[derive(Debug, Serialize, Clone)]
pub(crate) struct SolverResult {
    /// Problem name copied from the input contract.
    #[serde(rename = "problemName")]
    pub(crate) problem_name: String,
    /// Feasibility flag computed by the runtime.
    #[serde(rename = "isFeasible")]
    pub(crate) is_feasible: bool,
    /// Evaluated objective values in declaration order.
    #[serde(rename = "goalValues")]
    pub(crate) goal_values: Vec<f64>,
    /// Solution serialized in the external JSON shape.
    #[serde(rename = "variableValue")]
    pub(crate) variable_value: serde_json::Value,
}
