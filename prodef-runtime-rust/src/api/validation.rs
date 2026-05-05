//! Small validation helpers used by mode payload parsers.
//!
//! Each helper enforces one rule and emits the same error wording everywhere
//! that rule is reused, so mode-specific validation stays consistent.

use anyhow::{bail, Result};
use serde_json::{Map, Value};

/// Require a non-empty array field inside a payload object.
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
