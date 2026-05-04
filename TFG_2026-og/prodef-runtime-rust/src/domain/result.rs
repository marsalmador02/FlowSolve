use serde::Serialize;

// Result of a solver execution, to be returned in the `result` field of `ExecutionResponse`.
#[derive(Debug, Serialize, Clone)]
pub(crate) struct SolverResult {
    #[serde(rename = "problemName")]
    pub(crate) problem_name: String,
    #[serde(rename = "isFeasible")]
    pub(crate) is_feasible: bool,
    #[serde(rename = "goalValues")]
    pub(crate) goal_values: Vec<f64>,
    #[serde(rename = "variableValue")]
    pub(crate) variable_value: serde_json::Value,
}
