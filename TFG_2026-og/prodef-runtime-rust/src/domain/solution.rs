#[derive(Clone, Debug)]
pub(crate) enum Solution {
    Vector(Vec<f64>),
    Permutation(Vec<usize>),
}