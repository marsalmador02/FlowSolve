use std::collections::HashMap;

use anyhow::{anyhow, bail, Result};
use rand::prelude::*;

use crate::domain::model::{Class, Instance, Problem, Shape};
use crate::domain::solution::Solution;
use crate::evaluation::{eval_constraint, eval_numeric_expr};

/// Runtime-ready problem representation used by evaluation and search.
pub(crate) struct RuntimeProblem {
    pub(crate) raw: Problem,
    pub(crate) params: HashMap<String, f64>,
    pub(crate) data: HashMap<String, Vec<f64>>,
    pub(crate) var_name: String,
    n: usize,
    is_permutation: bool,
    lower: f64,
    upper: f64,
}

impl RuntimeProblem {
    pub(crate) fn new(raw: Problem) -> Result<Self> {
        if raw.variables.len() != 1 {
            bail!("Only one variable is currently supported");
        }

        let var = &raw.variables[0];
        let var_name = var.symbol.clone();
        let params = build_params(&raw);
        let data = build_data_map(raw.classes.as_deref(), raw.objects.as_deref())?;

        let (n, is_permutation, lower, upper) = match &var.shape {
            Shape::Vector { is_permutation, size } => {
                let n = resolve_size(&size.value, &params)?;

                let lower = var
                    .range
                    .as_ref()
                    .and_then(|r| r.lower_bound.as_ref())
                    .map(bound_to_f64)
                    .transpose()?
                    .unwrap_or(0.0);
                let upper = var
                    .range
                    .as_ref()
                    .and_then(|r| r.upper_bound.as_ref())
                    .map(bound_to_f64)
                    .transpose()?
                    .unwrap_or_else(|| if var.within.eq_ignore_ascii_case("binary") { 1.0 } else { 10.0 });

                if lower > upper {
                    bail!("Invalid variable bounds: lowerBound > upperBound");
                }

                (n, is_permutation.unwrap_or(false), lower, upper)
            }
            _ => bail!("Only vector variables are currently supported"),
        };

        Ok(Self { raw, params, data, var_name, n, is_permutation, lower, upper })
    }

    pub(crate) fn generate_random_solution(&self, rng: &mut StdRng) -> Solution {
        // For permutations, we generate a random permutation of [0, n-1].
        if self.is_permutation {
            let mut values: Vec<usize> = (0..self.n).collect();
            values.shuffle(rng);
            Solution::Permutation(values)
        } else {
            let lower = self.lower.ceil() as i64;
            let upper = self.upper.floor() as i64;
            Solution::Vector(
                (0..self.n)
                    .map(|_| rng.gen_range(lower..=upper) as f64)
                    .collect(),
            )
        }
    }

    pub(crate) fn evaluate_goals(&self, solution: &Solution) -> Result<Vec<f64>> {
        self.raw.goals.iter().map(|goal| eval_numeric_expr(&goal.expression, self, solution)).collect()
    }

    pub(crate) fn is_feasible(&self, solution: &Solution) -> Result<bool> {
        for constraint in self.raw.constraints.iter().flatten() {
            if !eval_constraint(&constraint.expression, self, solution)? {
                return Ok(false);
            }
        }

        Ok(true)
    }

    pub(crate) fn var_at(&self, solution: &Solution, idx_1_based: usize) -> Result<f64> {
        if idx_1_based == 0 {
            bail!("Indexing is 1-based");
        }

        match solution {
            Solution::Vector(values) => values.get(idx_1_based - 1).copied().ok_or_else(|| anyhow!("Index {} out of bounds", idx_1_based)),
            Solution::Permutation(values) => values
                .get(idx_1_based - 1)
                .map(|value| (*value + 1) as f64)
                .ok_or_else(|| anyhow!("Index {} out of bounds", idx_1_based)),
        }
    }

    pub(crate) fn class_attr_at(&self, class: &str, attr: &str, idx_1_based: usize) -> Result<f64> {
        if idx_1_based == 0 {
            bail!("Indexing is 1-based");
        }

        let key = format!("{}.{}", class, attr);
        let values = self.data.get(&key).ok_or_else(|| anyhow!("Unknown class attribute: {}", key))?;
        values.get(idx_1_based - 1).copied().ok_or_else(|| anyhow!("Index {} out of bounds for {}", idx_1_based, key))
    }

    pub(crate) fn matrix_at(&self, class: &str, row_1_based: usize, col_1_based: usize) -> Result<f64> {
        if row_1_based == 0 || col_1_based == 0 {
            bail!("Indexing is 1-based");
        }

        let row_key = format!("{}.row{}", class, row_1_based);
        let row = self.data.get(&row_key).ok_or_else(|| anyhow!("Unknown matrix row key: {}", row_key))?;
        row.get(col_1_based - 1).copied().ok_or_else(|| anyhow!("Column {} out of bounds in {}", col_1_based, row_key))
    }

    pub(crate) fn solution_size(&self) -> usize {
        self.n
    }

    pub(crate) fn solution_is_permutation(&self) -> bool {
        self.is_permutation
    }

    pub(crate) fn is_maximize(&self) -> bool {
        self.raw
            .goals
            .first()
            .and_then(|goal| goal.sense.as_deref())
            .map(|sense| !sense.eq_ignore_ascii_case("minimize"))
            .unwrap_or(true)
    }

    pub(crate) fn is_better_score(&self, candidate: f64, reference: f64) -> bool {
        if self.is_maximize() {
            candidate > reference
        } else {
            candidate < reference
        }
    }

    pub(crate) fn objective_score(&self, solution: &Solution) -> Result<f64> {
        Ok(self.evaluate_goals(solution)?.into_iter().sum())
    }
}

fn build_params(raw: &Problem) -> HashMap<String, f64> {
    raw.parameters
        .iter()
    .flatten()
        .map(|param| (param.symbol.clone(), param.value))
        .collect()
}

fn matches_solution_shape(solution: &Solution, size: usize, is_permutation: bool) -> bool {
    match solution {
        Solution::Permutation(values) => {
            if !is_permutation || values.len() != size {
                return false;
            }
            let mut seen = vec![false; size];
            for &value in values {
                if value >= size || seen[value] {
                    return false;
                }
                seen[value] = true;
            }
            true
        }
        Solution::Vector(values) => !is_permutation && values.len() == size,
    }
}

fn is_integral_domain(within: &str) -> bool {
    within.eq_ignore_ascii_case("integers") || within.eq_ignore_ascii_case("binary")
}

fn build_data_map(classes: Option<&[Class]>, objects: Option<&[Instance]>) -> Result<HashMap<String, Vec<f64>>> {
    let mut out = HashMap::new();
    let Some(classes) = classes else {
        return Ok(out);
    };
    let Some(objects) = objects else {
        return Ok(out);
    };

    // For each class, we create entries for its numeric attributes and for each row of objects.
    for class in classes {
        // Find all objects of this class
        let rows: Vec<&Instance> = objects.iter().filter(|object| object.class == class.symbol).collect();
        if rows.is_empty() {
            continue;
        }
        // Determine which attributes are numeric by checking the first row (if it exists)
        let mut numeric_attrs = Vec::new();
        for attr in &class.attributes {
            // Check if the first row has this attribute and if its value can be converted to f64
            if let Some(first_value) = rows[0].attributes.iter().find(|item| item.attribute == attr.symbol) {
                // If the value can be converted to f64, we consider this attribute numeric
                if to_f64(&first_value.value).is_ok() {
                    numeric_attrs.push(attr.symbol.clone());
                }
            }
        }

        // For each numeric attribute, build a column vector. Also build row vectors for each object.
        for attr in &numeric_attrs {
            let mut column = Vec::new();
            for row in &rows {
                let value = row
                    .attributes
                    .iter()
                    .find(|item| item.attribute == *attr)
                    .ok_or_else(|| anyhow!("Missing attribute {} in class {}", attr, class.symbol))?;
                column.push(to_f64(&value.value)?);
            }
            out.insert(format!("{}.{}", class.symbol, attr), column);
        }

        // Build row vectors for each object
        for (row_index, row) in rows.iter().enumerate() {
            let mut row_values = Vec::new();
            for attr in &numeric_attrs {
                // We can assume the attribute exists and is numeric since we filtered for numeric_attrs based on the first row
                let value = row
                    .attributes
                    .iter()
                    .find(|item| item.attribute == *attr)
                    .ok_or_else(|| anyhow!("Missing attribute {} in class {}", attr, class.symbol))?;
                row_values.push(to_f64(&value.value)?);
            }
            out.insert(format!("{}.row{}", class.symbol, row_index + 1), row_values); // 1-based indexing for rows
        }
    }

    Ok(out)
}

fn resolve_size(value: &serde_json::Value, params: &HashMap<String, f64>) -> Result<usize> {
    match value {
        serde_json::Value::Number(number) => {
            let n = number
                .as_u64()
                .ok_or_else(|| anyhow!("Invalid vector size: expected positive integer"))?;
            if n == 0 {
                bail!("Invalid vector size: must be > 0");
            }
            Ok(n as usize)
        }
        serde_json::Value::String(name) => {
            let n = params
                .get(name)
                .copied()
                .ok_or_else(|| anyhow!("Unknown size parameter '{}'", name))?;
            if n < 1.0 || (n.fract().abs() > 1e-9) {
                bail!("Size parameter '{}' must be a positive integer", name);
            }
            Ok(n as usize)
        }
        _ => bail!("Invalid vector size: expected number or parameter name"),
    }
}

fn to_f64(value: &serde_json::Value) -> Result<f64> {
    match value {
        serde_json::Value::Number(number) => number.as_f64().ok_or_else(|| anyhow!("Invalid number")),
        serde_json::Value::String(text) => text.parse::<f64>().map_err(|_| anyhow!("Expected numeric string, got '{}'", text)),
        _ => bail!("Expected numeric value"),
    }
}

fn bound_to_f64(value: &serde_json::Value) -> Result<f64> {
    match value {
        serde_json::Value::Number(number) => number.as_f64().ok_or_else(|| anyhow!("Invalid numeric bound")),
        serde_json::Value::String(text) => {
            if text.eq_ignore_ascii_case("infinity") || text.eq_ignore_ascii_case("+infinity") {
                Ok(f64::INFINITY)
            } else if text.eq_ignore_ascii_case("-infinity") {
                Ok(f64::NEG_INFINITY)
            } else {
                text.parse::<f64>().map_err(|_| anyhow!("Invalid string bound '{}': expected a number or Infinity", text))
            }
        }
        _ => bail!("Invalid bound value type"),
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::model::Problem;

    #[test]
    fn runtime_from_tsp_example_and_evaluate() {
        let raw: Problem = serde_json::from_str(include_str!("../../../examples/tsp.json")).expect("parse example");
        let runtime = RuntimeProblem::new(raw).expect("build runtime");
        assert_eq!(runtime.solution_size(), 4);

        // Permutation 0,1,2,3 corresponds to cities 1..4 in order.
        let perm = Solution::Permutation(vec![0, 1, 2, 3]);
        let goals = runtime.evaluate_goals(&perm).expect("eval goals");
        // Expected distance: 1->2 (12) + 2->3 (35) + 3->4 (11) + 4->1 (17) = 75
        assert_eq!(goals.len(), 1);
        let total = goals[0];
        assert!((total - 75.0).abs() < 1e-6, "expected 75, got {}", total);

        let feasible = runtime.is_feasible(&perm).expect("is_feasible");
        assert!(feasible, "permutation should be feasible (no constraints)");
    }
}
