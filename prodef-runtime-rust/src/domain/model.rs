use serde::Deserialize;

/// Root JSON schema for a Prodef optimization problem.
#[derive(Debug, Deserialize)]
pub(crate) struct Problem {
    pub(crate) name: String,
    pub(crate) parameters: Option<Vec<Parameter>>,
    pub(crate) variables: Vec<Variable>,
    pub(crate) goals: Vec<Goal>,
    pub(crate) constraints: Option<Vec<Constraint>>,
    pub(crate) classes: Option<Vec<Class>>,
    pub(crate) objects: Option<Vec<Instance>>,
}

/// Named numeric parameter available in expressions.
#[derive(Debug, Deserialize)]
pub(crate) struct Parameter {
    pub(crate) symbol: String,
    pub(crate) value: f64,
}

/// Decision variable declaration.
#[derive(Debug, Deserialize)]
pub(crate) struct Variable {
    pub(crate) symbol: String,
    pub(crate) within: String,
    pub(crate) shape: Shape,
    pub(crate) range: Option<Range>,
}

/// Optional lower/upper numeric bounds for a variable.
#[derive(Debug, Deserialize)]
pub(crate) struct Range {
    #[serde(rename = "lowerBound")]
    pub(crate) lower_bound: Option<serde_json::Value>,
    #[serde(rename = "upperBound")]
    pub(crate) upper_bound: Option<serde_json::Value>,
}

/// Variable shape variants supported by the schema.
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum Shape {
    #[serde(rename = "single")]
    Single,
    #[serde(rename = "vector")]
    Vector {
        #[serde(rename = "isPermutation")]
        is_permutation: Option<bool>,
        size: Size,
    },
    #[serde(rename = "matrix")]
    Matrix { size: MatrixSize },
}

/// Matrix dimensions.
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub(crate) struct MatrixSize {
    rows: Size,
    columns: Size,
}

/// Generic size descriptor (fixed value or symbolic parameter).
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub(crate) struct Size {
    fixed: bool,
    pub(crate) value: serde_json::Value,
}

/// Objective expression to evaluate.
#[derive(Debug, Deserialize)]
pub(crate) struct Goal {
    pub(crate) sense: Option<String>,
    pub(crate) expression: String,
}

/// Feasibility expression that must evaluate to true.
#[derive(Debug, Deserialize)]
pub(crate) struct Constraint {
    #[allow(dead_code)]
    pub(crate) name: Option<String>,
    pub(crate) expression: String,
}

/// Class declaration for tabular/matrix-like data in expressions.
#[derive(Debug, Deserialize)]
pub(crate) struct Class {
    pub(crate) symbol: String,
    pub(crate) attributes: Vec<ClassAttribute>,
}

/// Attribute metadata within a class.
#[derive(Debug, Deserialize)]
pub(crate) struct ClassAttribute {
    pub(crate) symbol: String,
}

/// One object/row belonging to a class.
#[derive(Debug, Deserialize)]
pub(crate) struct Instance {
    pub(crate) class: String,
    pub(crate) attributes: Vec<InstanceAttribute>,
}

/// Concrete value for one attribute of an instance.
#[derive(Debug, Deserialize)]
pub(crate) struct InstanceAttribute {
    pub(crate) attribute: String,
    pub(crate) value: serde_json::Value,
}
