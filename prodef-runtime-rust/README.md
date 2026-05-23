# FlowSolve Runtime (Rust) - Summary

This README gives a concise overview of the `prodef-runtime-rust/` crate, what it does, how it is organized and how it fits with the UI.

## 1. What this runtime is

`prodef-runtime-rust/` is the Rust execution engine for FlowSolve's optimization semantics. It receives a JSON request, validates and normalizes the problem, dispatches the selected execution mode, and returns a JSON response for the UI.

In practice it:

1. Reads an `ExecutionRequest` from JSON.
2. Builds a runtime-ready `RuntimeProblem` from `execution.problem`.
3. Dispatches the request through `execution.mode`.
4. Runs the corresponding generation, selection, crossover, mutation, local-search, perturbation, neighborhood, or acceptance logic.
5. Serializes an `ExecutionResponse` back to JSON.

## 2. How the runtime works

### 2.1 Execution flow

```
CLI / UI bridge
  ↓
src/main.rs
  ↓
api::run
  ↓
domain::RuntimeProblem
  ↓
modes::dispatch
  ↓
operators / search / evaluation
  ↓
ExecutionResponse
```

### 2.2 Request contract

`execution.problem` is required for the supported modes.

```json
{
  "problem": { ... },
  "execution": {
    "mode": "generate",
    "payload": { ... }
  }
}
```

### 2.3 Response contract

`ExecutionResponse` can contain one or more of:

- `result`: a single `SolverResult`.
- `population`: a list of `SolverResult`.
- `payload`: free JSON with mode metadata.

## 3. Folder structure

### Root files

- `Cargo.toml`: crate manifest and dependencies.
- `README.md`: this document.

### `src/`

- `src/main.rs`: CLI entry point.
- `src/lib.rs`: module wiring for the crate.

#### `src/api/`

- `src/api/mod.rs`: request/response boundary and `run` entry point.
- `src/api/parse.rs`: `variableValue` parsing and normalization helpers.
- `src/api/response.rs`: conversion from runtime solutions to JSON responses.
- `src/api/validation.rs`: shared payload validation helpers.

#### `src/domain/`

- `src/domain/model.rs`: external problem schema.
- `src/domain/runtime.rs`: runtime-ready problem representation.
- `src/domain/solution.rs`: internal solution types.
- `src/domain/result.rs`: solver result type.
- `src/domain/feasible.rs`: feasible solution generation helpers.

#### `src/evaluation/`

- `src/evaluation/expr.rs`: expression evaluator for goals and constraints.
- `src/evaluation/mod.rs`: evaluation module wiring.

#### `src/modes/`

- `src/modes/mod.rs`: mode dispatcher.
- `src/modes/context.rs`: shared execution context and outcome types.
- `src/modes/common.rs`: shared helpers for modes.
- `src/modes/generate.rs`: single and population generation.
- `src/modes/selection.rs`: selection logic.
- `src/modes/crossover.rs`: crossover logic.
- `src/modes/mutation.rs`: mutation logic.
- `src/modes/perturbation.rs`: perturbation logic.
- `src/modes/neighborhood.rs`: neighborhood generation.
- `src/modes/local_search.rs`: local-search execution mode.
- `src/modes/select_best.rs`: best-candidate selection.
- `src/modes/temperature_acceptance.rs`: simulated-annealing-style acceptance.

#### `src/operators/`

- `src/operators/mod.rs`: low-level operators and defaults by problem family.

#### `src/search/`

- `src/search/local_search.rs`: search helpers.

## 4. Core runtime model

### 4.1 Problem schema (`domain/model.rs`)

The runtime accepts problems with:

- `name`
- `parameters`
- `variables`
- `goals`
- `constraints`
- `classes`
- `objects`

### 4.2 Current runtime limitations

`RuntimeProblem::new` enforces the current executable subset:

- only one decision variable per problem,
- only `shape.type == "vector"`,
- the vector can be permutation-encoded or numeric,
- indexing is 1-based in the evaluation layer,
- binary variables default to `[0, 1]` when no range is provided,
- non-binary variables default to `[0, 10]` when no range is provided.

### 4.3 `RuntimeProblem`

`RuntimeProblem` adapts the JSON problem into an executable form. It is responsible for:

- building the parameter map,
- loading class and instance data,
- validating solution shape and size,
- generating random solutions,
- checking feasibility,
- evaluating goals,
- comparing scores for maximize/minimize problems.

Key methods include:

- `generate_random_solution`
- `evaluate_goals`
- `is_feasible`
- `objective_score`
- `is_better_score`
- `solution_size`
- `solution_is_permutation`

### 4.4 Solution types

```rust
pub enum Solution {
    Vector(Vec<f64>),
    Permutation(Vec<usize>),
}
```

- `Vector` is used for binary, integer, and continuous problems.
- `Permutation` is used for TSP, assignment, ordering, and similar problems.

### 4.5 Expression evaluation (`evaluation/expr.rs`)

The evaluator supports:

- numeric literals and problem parameters,
- `x[i]` variable access,
- class attributes like `item[i].weight`,
- matrix access like `d[i,j]`,
- sum notation such as `sum ... over i=(1:N)`,
- comparisons `<=`, `>=`, and `=`,
- additive chaining with `+`.

## 5. Supported modes

`modes::dispatch` currently recognizes:

| Mode | Handler | Description | Main payload fields |
|------|---------|-------------|---------------------|
| `generate` | `generate::execute_single` | Generate one feasible solution | none or empty |
| `generate-population` | `generate::execute_population` | Generate a feasible population | `count` |
| `selection` | `selection::execute` | Elitist plus tournament selection | `candidates`, `targetSize`, `tournamentSize`, `eliteSize` |
| `crossover` | `crossover::execute` | Crossover between parents | `parents`, `targetSize`, `crossoverOperator` |
| `mutation` | `mutation::execute` | Mutate an input set | `incomingSet`, `mutationRate` |
| `perturbation` | `perturbation::execute` | Sequential perturbation | `base`, `k`, `maxAttempts` |
| `neighborhood` | `neighborhood::execute` | Generate neighbors from a base solution | `base` |
| `local-search` | `local_search::execute` | Hill-climbing local search | `solution` |
| `select-best` | `select_best::execute` | Pick the best feasible candidate | `candidates` |
| `temperature-acceptance` | `temperature_acceptance::execute` | Simulated-annealing-style acceptance rule | `candidate`, `stored`, `temperatureCurrent` |

## 6. Parsing and response helpers

### `src/api/parse.rs`

This module converts JSON payloads to internal solutions and back. It accepts permutation arrays in either 0-based or 1-based form, rejects duplicates and wrong lengths, and normalizes everything to the runtime representation.

### `src/api/response.rs`

This module converts runtime solutions back to JSON. It also computes `SolverResult` values with feasibility and objective metadata.

### `src/api/validation.rs`

This module centralizes payload validation so mode handlers return consistent errors.