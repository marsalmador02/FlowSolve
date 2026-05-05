//! Internal solution representation used by the runtime and search operators.

/// Solution values in runtime coordinates.
#[derive(Clone, Debug)]
pub(crate) enum Solution {
    /// Dense numeric decision vector.
    Vector(Vec<f64>),
    /// Permutation encoded as 0-based positions.
    Permutation(Vec<usize>),
}