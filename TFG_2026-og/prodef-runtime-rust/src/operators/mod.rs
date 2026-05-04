//! Reusable operator library: crossover, mutation, perturbation, neighborhood.
//!
//! This module centralizes low-level operators used by mode handlers and
//! higher-level search routines. It includes crossover operators for
//! permutations and continuous vectors, mutation/perturbation helpers, and
//! small utilities to infer variable characteristics from the runtime.

use rand::prelude::*;

use crate::domain::model::Shape;
use crate::domain::RuntimeProblem;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProblemFamily {
    Assignment,
    Tsp,
    Other,
}

pub(crate) fn detect_problem_family(runtime: &RuntimeProblem) -> ProblemFamily {
    let name = runtime.raw.name.to_ascii_lowercase();
    let variable_symbol = runtime
        .raw
        .variables
        .first()
        .map(|v| v.symbol.to_ascii_lowercase())
        .unwrap();
    let goal_expr = runtime
        .raw
        .goals
        .first()
        .map(|g| g.expression.to_ascii_lowercase())
        .unwrap();

    let context = format!("{name} {variable_symbol} {goal_expr}");
    if context.contains("assignment") || context.contains("assign") {
        return ProblemFamily::Assignment;
    }
    if context.contains("tsp")
        || context.contains("travel")
        || context.contains("city")
        || context.contains("distance")
    {
        return ProblemFamily::Tsp;
    }

    ProblemFamily::Other
}

/// Heuristically detect problem family (Assignment, Tsp, Other) from
/// `RuntimeProblem` metadata (name, variable symbol, goal expression).

/// Returns `(is_permutation, is_binary)` for the single runtime variable.
pub(crate) fn variable_flags(runtime: &RuntimeProblem) -> (bool, bool) {
    let variable = runtime.raw.variables.first();
    let is_permutation = matches!(
        variable.map(|v| &v.shape),
        Some(Shape::Vector { is_permutation: Some(true), .. })
    );

    let is_binary = variable
        .map(|v| v.within.eq_ignore_ascii_case("binary"))
        .unwrap_or(false);

    (is_permutation, is_binary)
}

/// Generate neighbor vectors for `source`.
///
/// - For permutation variables: returns all pairwise swaps.
/// - For binary vectors: returns single-bit flips for each position.
/// - Otherwise: returns +1 and -1 perturbations for each position.


/// One-point crossover for two equal-length vectors.
///
/// Returns a child where the prefix up to a random `point` comes from `a`
/// and the suffix comes from `b`. If lengths are incompatible, returns
/// a clone of `a`.
///
/// # Examples
///
/// ```rust
/// use rand::SeedableRng;
/// use rand::rngs::StdRng;
/// use prodef_runtime_rust::operators::one_point_crossover;
/// let a = vec![0.0, 1.0, 2.0];
/// let b = vec![2.0, 1.0, 0.0];
/// let mut rng = StdRng::seed_from_u64(42);
/// let child = one_point_crossover(&a, &b, &mut rng);
/// assert_eq!(child.len(), a.len());
/// ```
pub fn one_point_crossover(a: &[f64], b: &[f64], rng: &mut StdRng) -> Vec<f64> {
    if a.len() < 2 || b.len() < 2 || a.len() != b.len() {
        return a.to_vec();
    }

    // Elegimos un punto de corte entre 1 y len-1.
    let point = rng.gen_range(1..a.len());

    // El hijo toma el prefijo de A y el sufijo de B.
    let mut child = Vec::with_capacity(a.len());
    child.extend_from_slice(&a[..point]);
    child.extend_from_slice(&b[point..]);

    child
}

/// One-point crossover for two equal-length vectors.
///
/// Returns a child where the prefix up to a random `point` comes from `a`
/// and the suffix comes from `b`. If lengths are incompatible, returns
/// a clone of `a`.

/// Uniform crossover: for each position choose the gene from `a` or `b`
/// with equal probability. Returns `a` when inputs are invalid.
///
/// # Examples
///
/// ```rust
/// use rand::SeedableRng;
/// use rand::rngs::StdRng;
/// use prodef_runtime_rust::operators::uniform_crossover_f64;
/// let a = vec![0.0, 1.0, 2.0];
/// let b = vec![2.0, 1.0, 0.0];
/// let mut rng = StdRng::seed_from_u64(123);
/// let child = uniform_crossover_f64(&a, &b, &mut rng);
/// assert_eq!(child.len(), a.len());
/// ```
pub fn uniform_crossover_f64(a: &[f64], b: &[f64], rng: &mut StdRng) -> Vec<f64> {
    if a.is_empty() || b.is_empty() || a.len() != b.len() {
        return a.to_vec();
    }
    let mut out = Vec::with_capacity(a.len());
    for i in 0..a.len() {
        if rng.gen::<f64>() < 0.5 {
            out.push(a[i]);
        } else {
            out.push(b[i]);
        }
    }
    out
}

/// Uniform crossover: for each position choose the gene from `a` or `b`
/// with equal probability. Returns `a` when inputs are invalid.

/// Order crossover for permutation-encoded vectors.
///
/// Preserves a contiguous segment from `a` and fills remaining positions
/// with the order of elements from `b` not present in the segment.
///
/// # Examples
///
/// ```rust
/// use rand::SeedableRng;
/// use rand::rngs::StdRng;
/// use prodef_runtime_rust::operators::order_crossover_f64;
/// let a = vec![0.0, 1.0, 2.0, 3.0];
/// let b = vec![3.0, 2.0, 1.0, 0.0];
/// let mut rng = StdRng::seed_from_u64(7);
/// let child = order_crossover_f64(&a, &b, &mut rng);
/// assert_eq!(child.len(), a.len());
/// ```
pub fn order_crossover_f64(a: &[f64], b: &[f64], rng: &mut StdRng) -> Vec<f64> {
    let n = a.len();
    if n < 2 || b.len() != n {
        return a.to_vec();
    }

    // Elegimos dos cortes aleatorios.
    let mut cut1 = rng.gen_range(0..n);
    let mut cut2 = rng.gen_range(0..n);
    if cut1 > cut2 {
        std::mem::swap(&mut cut1, &mut cut2);
    }
    if cut1 == cut2 {
        cut2 = (cut1 + 1).min(n - 1);
    }

    // Hijo vacío.
    let mut child = vec![-1.0; n];

    // Guardamos qué valores ya quedaron fijados en el segmento copiado de A.
    let mut used = std::collections::HashSet::new();
    for i in cut1..=cut2 {
        child[i] = a[i];
        used.insert(a[i] as i64);
    }

    // Rellenamos el resto con los valores de B, en orden circular,
    // saltando los que ya están en el segmento.
    let mut fill_pos = (cut2 + 1) % n;
    for i in 0..n {
        let candidate = b[(cut2 + 1 + i) % n];
        if used.contains(&(candidate as i64)) {
            continue;
        }

        while child[fill_pos] >= 0.0 {
            fill_pos = (fill_pos + 1) % n;
        }

        child[fill_pos] = candidate;
    }

    child
}

/// Order crossover for permutation-encoded vectors.
///
/// Preserves a contiguous segment from `a` and fills remaining positions
/// with the order of elements from `b` not present in the segment.

/// Partially Mapped Crossover (PMX) for permutations.
///
/// Produces a child permutation preserving mapping relationships inside
/// the chosen cut segment and filling remaining positions accordingly.
///
/// # Examples
///
/// ```rust
/// use rand::SeedableRng;
/// use rand::rngs::StdRng;
/// use prodef_runtime_rust::operators::pmx_crossover_f64;
/// let a = vec![0.0, 1.0, 2.0, 3.0];
/// let b = vec![3.0, 2.0, 1.0, 0.0];
/// let mut rng = StdRng::seed_from_u64(99);
/// let child = pmx_crossover_f64(&a, &b, &mut rng);
/// assert_eq!(child.len(), a.len());
/// ```
pub fn pmx_crossover_f64(a: &[f64], b: &[f64], rng: &mut StdRng) -> Vec<f64> {
    let n = a.len();
    if n < 2 || b.len() != n {
        return a.to_vec();
    }

    // Elegimos dos cortes aleatorios.
    let mut cut1 = rng.gen_range(0..n);
    let mut cut2 = rng.gen_range(0..n);
    if cut1 > cut2 {
        std::mem::swap(&mut cut1, &mut cut2);
    }
    if cut1 == cut2 {
        cut2 = (cut1 + 1).min(n - 1);
    }

    // Hijo en construcción. -1.0 significa "vacío".
    let mut child = vec![-1.0; n];

    // Para cada valor de B guardamos su posición.
    // Así podemos saltar rápido de un valor a otro cuando aparece un conflicto.
    let mut pos_in_b = vec![0usize; n];
    for (i, &v) in b.iter().enumerate() {
        let idx = v.round() as usize;
        if idx >= n {
            return a.to_vec();
        }
        pos_in_b[idx] = i;
    }

    // 1) Copiamos el segmento central de A al hijo.
    for i in cut1..=cut2 {
        child[i] = a[i];
    }

    // Ejemplo mental:
    // a = [1, 2, 3, 4, 5, 6]
    // b = [4, 1, 6, 2, 5, 3]
    // cortes: índice 2..=4
    //
    // Después de copiar el segmento de A:
    // child = [-1, -1, 3, 4, 5, -1]

    // 2) Revisamos los valores de B que caen dentro del segmento.
    // Si el valor ya está dentro del segmento, se ignora.
    // Si no, se sigue el mapeo hasta encontrar un hueco libre.
    for i in cut1..=cut2 {
        let value = b[i].round() as usize;

        if child[cut1..=cut2]
            .iter()
            .any(|x| x.round() as usize == value)
        {
            continue;
        }

        let mut pos = i;
        loop {
            let mapped = a[pos].round() as usize;
            let next_pos = pos_in_b[mapped];

            if child[next_pos] < 0.0 {
                child[next_pos] = b[i];
                break;
            }

            pos = next_pos;
        }
    }

    // Ejemplo paso a paso con esos datos:
    //
    // Segmento copiado:
    // child = [-1, -1, 3, 4, 5, -1]
    //
    // i = 2, b[2] = 6
    // 6 no está en el segmento.
    // a[2] = 3 -> en b, el 3 está en pos 5
    // child[5] está libre, así que ponemos 6 ahí.
    // child = [-1, -1, 3, 4, 5, 6]
    //
    // i = 3, b[3] = 2
    // 2 no está en el segmento.
    // a[3] = 4 -> en b, el 4 está en pos 0
    // child[0] está libre, así que ponemos 2 ahí.
    // child = [2, -1, 3, 4, 5, 6]
    //
    // i = 4, b[4] = 5
    // 5 ya está en el segmento, así que se ignora.
    //
    // 3) Rellenamos cualquier hueco restante con el gen correspondiente de B.
    // child[1] = b[1] = 1
    //
    // Resultado final:
    // child = [2, 1, 3, 4, 5, 6]

    for i in 0..n {
        if child[i] < 0.0 {
            child[i] = b[i];
        }
    }

    child
}

/// Partially Mapped Crossover (PMX) for permutations.
///
/// Produces a child permutation preserving mapping relationships inside
/// the chosen cut segment and filling remaining positions accordingly.

/// Mutate a permutation by swapping two randomly chosen positions.
///
/// # Examples
///
/// ```rust
/// use rand::SeedableRng;
/// use rand::rngs::StdRng;
/// use prodef_runtime_rust::operators::mutate_permutation_swap_f64;
/// let mut v = vec![0.0, 1.0, 2.0];
/// let mut rng = StdRng::seed_from_u64(55);
/// mutate_permutation_swap_f64(&mut v, &mut rng);
/// assert_eq!(v.len(), 3);
/// ```
pub fn mutate_permutation_swap_f64(vars: &mut [f64], rng: &mut StdRng) {
    if vars.len() < 2 {
        return;
    }
    let i = rng.gen_range(0..vars.len());
    let mut j = rng.gen_range(0..vars.len());
    if i == j {
        j = (j + 1) % vars.len();
    }
    vars.swap(i, j);
}

/// Mutate a permutation by inverting (reversing) a random subsequence.
///
/// # Examples
///
/// ```rust
/// use rand::SeedableRng;
/// use rand::rngs::StdRng;
/// use prodef_runtime_rust::operators::mutate_permutation_inversion_f64;
/// let mut v = vec![0.0, 1.0, 2.0, 3.0];
/// let mut rng = StdRng::seed_from_u64(11);
/// mutate_permutation_inversion_f64(&mut v, &mut rng);
/// assert_eq!(v.len(), 4);
/// ```
pub fn mutate_permutation_inversion_f64(vars: &mut [f64], rng: &mut StdRng) {
    if vars.len() < 2 {
        return;
    }
    let mut i = rng.gen_range(0..vars.len());
    let mut j = rng.gen_range(0..vars.len());
    if i > j {
        std::mem::swap(&mut i, &mut j);
    }
    if i == j {
        j = (j + 1).min(vars.len() - 1);
        if i == j {
            i = i.saturating_sub(1);
        }
    }
    vars[i..=j].reverse();
}

/// Mutate a permutation by inverting (reversing) a random subsequence.

/// Max draws for one elementary perturbation (single flip or single swap) before giving up that step.
pub(crate) const PERTURB_INNER_MAX_TRIES: usize = 10;

/// Maximum inner attempts used by perturbation mode when trying to
/// generate a feasible elementary perturbation.

/// One random bit flip at a uniform index (binary vectors).
/// Flip a single random bit in a binary-encoded vector. Returns a new
/// vector with one position toggled between 0.0 and 1.0.
///
/// # Examples
///
/// ```rust
/// use rand::SeedableRng;
/// use rand::rngs::StdRng;
/// use prodef_runtime_rust::operators::apply_random_bitflip;
/// let source = vec![0.0, 1.0, 0.0];
/// let mut rng = StdRng::seed_from_u64(5);
/// let out = apply_random_bitflip(&source, &mut rng);
/// assert_eq!(out.len(), source.len());
/// ```
pub fn apply_random_bitflip(source: &[f64], rng: &mut StdRng) -> Vec<f64> {
    let n = source.len();
    if n == 0 {
        return source.to_vec();
    }
    let mut out = source.to_vec();
    let i = rng.gen_range(0..n);
    out[i] = if out[i].round() == 0.0 { 1.0 } else { 0.0 };
    out
}

/// Flip a single random bit in a binary-encoded vector. Returns a new
/// vector with one position toggled between 0.0 and 1.0.

/// One random swap of two distinct positions (permutation as f64 encoding).
/// Apply a single random swap of two distinct positions in `source`.
/// For permutation-encoded solutions this represents a minimal perturbation.
///
/// # Examples
///
/// ```rust
/// use rand::SeedableRng;
/// use rand::rngs::StdRng;
/// use prodef_runtime_rust::operators::apply_random_swap;
/// let source = vec![0.0, 1.0, 2.0];
/// let mut rng = StdRng::seed_from_u64(6);
/// let out = apply_random_swap(&source, &mut rng);
/// assert_eq!(out.len(), source.len());
/// ```
pub fn apply_random_swap(source: &[f64], rng: &mut StdRng) -> Vec<f64> {
    let n = source.len();
    if n < 2 {
        return source.to_vec();
    }
    let mut out = source.to_vec();
    let i = rng.gen_range(0..n);
    let mut j = rng.gen_range(0..n);
    if i == j {
        j = (j + 1) % n;
    }
    out.swap(i, j);
    out
}

/// Apply a single random swap of two distinct positions in `source`.
/// For permutation-encoded solutions this represents a minimal perturbation.

/// Generate neighbor vectors for `source`.
///
/// - For permutation variables: returns all pairwise swaps.
/// - For binary vectors: returns single-bit flips for each position.
/// - Otherwise: returns +1 and -1 perturbations for each position.
///
/// # Examples
///
/// ```rust
/// use prodef_runtime_rust::operators::generate_neighbor_vectors;
/// let source = vec![0.0, 1.0, 0.0];
/// let neighbors = generate_neighbor_vectors(&source, false, true);
/// assert!(!neighbors.is_empty());
/// ```
pub fn generate_neighbor_vectors(
    source: &[f64],
    is_permutation: bool,
    is_binary: bool,
) -> Vec<Vec<f64>> {
    let n = source.len();
    let mut out: Vec<Vec<f64>> = Vec::new();

    if is_permutation {
        for i in 0..n {
            for j in (i + 1)..n {
                let mut v = source.to_vec();
                v.swap(i, j);
                out.push(v);
            }
        }
        return out;
    }

    if is_binary {
        for i in 0..n {
            let mut v = source.to_vec();
            v[i] = if v[i] >= 0.5 { 0.0 } else { 1.0 };
            out.push(v);
        }
        return out;
    }

    for i in 0..n {
        let mut up = source.to_vec();
        up[i] += 1.0;
        out.push(up);
        let mut down = source.to_vec();
        down[i] -= 1.0;
        out.push(down);
    }

    out
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn neighbors_for_permutation() {
        let src = vec![0.0, 1.0, 2.0];
        let n = generate_neighbor_vectors(&src, true, false);
        // For n=3 permutations, pairwise swaps = 3
        assert_eq!(n.len(), 3);
        // One expected neighbor: swap 0 and 1 -> [1,0,2]
        assert!(n.iter().any(|v| v == &vec![1.0, 0.0, 2.0]));
    }

    #[test]
    fn neighbors_for_binary() {
        let src = vec![0.0, 1.0, 0.0];
        let n = generate_neighbor_vectors(&src, false, true);
        assert_eq!(n.len(), 3);
        assert!(n.iter().any(|v| v == &vec![1.0, 1.0, 0.0]));
    }

    #[test]
    fn neighbors_for_continuous() {
        let src = vec![2.0, 3.0];
        let n = generate_neighbor_vectors(&src, false, false);
        // For each position we get +1 and -1 => 4 neighbors
        assert_eq!(n.len(), 4);
        assert!(n.iter().any(|v| v == &vec![3.0, 3.0]));
        assert!(n.iter().any(|v| v == &vec![1.0, 3.0]));
    }

    fn assert_is_permutation(values: &[f64], n: usize) {
        assert_eq!(values.len(), n);

        let mut sorted = values.to_vec();
        sorted.sort_by(|a, b| a.total_cmp(b));

        let expected: Vec<f64> = (0..n).map(|i| i as f64).collect();
        assert_eq!(sorted, expected);
    }

    #[test]
    fn pmx_crossover_keeps_identical_parents_unchanged() {
        let a = vec![0.0, 1.0, 2.0, 3.0];
        let b = vec![0.0, 1.0, 2.0, 3.0];
        let mut rng = StdRng::seed_from_u64(99);

        let child = pmx_crossover_f64(&a, &b, &mut rng);

        assert_eq!(child, a);
    }

    #[test]
    fn pmx_crossover_returns_valid_permutation_for_specific_example() {
        let a = vec![0.0, 1.0, 2.0, 3.0];
        let b = vec![3.0, 2.0, 1.0, 0.0];
        let mut rng = StdRng::seed_from_u64(99);

        let child = pmx_crossover_f64(&a, &b, &mut rng);

        assert_is_permutation(&child, 4);
        assert!(child.iter().all(|v| v.fract() == 0.0));
    }

    fn pmx_with_cuts(a: &[f64], b: &[f64], cut1: usize, cut2: usize) -> Vec<f64> {
        let n = a.len();
        if n < 2 || b.len() != n {
            return a.to_vec();
        }

        let mut child = vec![-1.0; n];

        let mut pos_in_b = vec![0usize; n];
        for (i, &v) in b.iter().enumerate() {
            let idx = v.round() as usize;
            if idx >= n {
                return a.to_vec();
            }
            pos_in_b[idx] = i;
        }

        for i in cut1..=cut2 {
            child[i] = a[i];
        }

        for i in cut1..=cut2 {
            let value = b[i].round() as usize;

            if child[cut1..=cut2]
                .iter()
                .any(|x| x.round() as usize == value)
            {
                continue;
            }

            let mut pos = i;
            loop {
                let mapped = a[pos].round() as usize;
                let next_pos = pos_in_b[mapped];

                if child[next_pos] < 0.0 {
                    child[next_pos] = b[i];
                    break;
                }

                pos = next_pos;
            }
        }

        for i in 0..n {
            if child[i] < 0.0 {
                child[i] = b[i];
            }
        }

        child
    }

    #[test]
    fn pmx_crossover_with_fixed_cuts_matches_expected_child() {
        let a = vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0];
        let b = vec![3.0, 0.0, 5.0, 1.0, 4.0, 2.0];

        let child = pmx_with_cuts(&a, &b, 2, 4);

        assert_eq!(child, vec![1.0, 0.0, 2.0, 3.0, 4.0, 5.0]);
    }

    fn ox_with_cuts(a: &[f64], b: &[f64], cut1: usize, cut2: usize) -> Vec<f64> {
        let n = a.len();
        if n < 2 || b.len() != n {
            return a.to_vec();
        }

        let mut child = vec![-1.0; n];
        let mut used = std::collections::HashSet::new();

        for i in cut1..=cut2 {
            child[i] = a[i];
            used.insert(a[i] as i64);
        }

        let mut fill_pos = (cut2 + 1) % n;
        for i in 0..n {
            let candidate = b[(cut2 + 1 + i) % n];
            if used.contains(&(candidate as i64)) {
                continue;
            }

            while child[fill_pos] >= 0.0 {
                fill_pos = (fill_pos + 1) % n;
            }

            child[fill_pos] = candidate;
        }

        child
    }

    #[test]
    fn order_crossover_with_fixed_cuts_matches_expected_child() {
        let a = vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0];
        let b = vec![3.0, 5.0, 1.0, 4.0, 0.0, 2.0];

        let child = ox_with_cuts(&a, &b, 2, 4);

        assert_eq!(child, vec![1.0, 0.0, 2.0, 3.0, 4.0, 5.0]);
    }

    fn one_point_with_cut(a: &[f64], b: &[f64], point: usize) -> Vec<f64> {
        if a.len() < 2 || b.len() < 2 || a.len() != b.len() || point == 0 || point >= a.len() {
            return a.to_vec();
        }

        let mut child = Vec::with_capacity(a.len());
        child.extend_from_slice(&a[..point]);
        child.extend_from_slice(&b[point..]);
        child
    }

    #[test]
    fn one_point_with_fixed_cut_builds_expected_child() {
        let a = vec![1.0, 2.0, 3.0, 4.0];
        let b = vec![9.0, 8.0, 7.0, 6.0];

        let child = one_point_with_cut(&a, &b, 2);

        assert_eq!(child, vec![1.0, 2.0, 7.0, 6.0]);
    }

    fn uniform_with_mask(a: &[f64], b: &[f64], mask: &[bool]) -> Vec<f64> {
        assert_eq!(a.len(), b.len());
        assert_eq!(a.len(), mask.len());

        let mut child = Vec::with_capacity(a.len());
        for i in 0..a.len() {
            child.push(if mask[i] { a[i] } else { b[i] });
        }
        child
    }

    #[test]
    fn uniform_with_fixed_mask_builds_expected_child() {
        let a = vec![1.0, 2.0, 3.0, 4.0];
        let b = vec![9.0, 8.0, 7.0, 6.0];

        let child = uniform_with_mask(&a, &b, &[true, false, true, false]);

        assert_eq!(child, vec![1.0, 8.0, 3.0, 6.0]);
    }
}