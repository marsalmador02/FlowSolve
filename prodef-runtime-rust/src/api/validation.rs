use anyhow::{bail, Result};
use serde_json::{Map, Value};

// Helper functions for validating mode payloads, with consistent error messages.
pub(crate) fn non_empty_array_in_obj<'a>(
    obj: &'a Map<String, Value>,
    key: &str,
    mode_hint: &str,
) -> Result<&'a Vec<Value>> {
    let arr = obj
        .get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| anyhow::anyhow!("{} payload requires `{}[]`", mode_hint, key))?;
    if arr.is_empty() {
        bail!("{} received an empty `{}` array", mode_hint, key);
    }
    Ok(arr)
}
