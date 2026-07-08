# Rust Execution Backend

## Overview

This part of the system is the execution backend for metaheuristic algorithms. It receives a JSON request describing an optimization problem and an operation to perform, runs that operation and returns a JSON response.

## Main Features

### Problem Loading

Problems are defined in JSON and loaded at runtime. The backend supports:

* **Binary vector problems.**
* **Permutation problems.**

### Expression Evaluator

Supported syntax includes:

* Weighted sums over index ranges: `sum x[i]*item[i].value over i=(1:N)`
* Class attribute access: `item[i].weight`
* Matrix access: `distance[city[i], city[i+1]]`
* Variable access: `x[i]`
* Problem parameters: `N`, `MaxWeight`
* Arithmetic operators: `+`, `-`, `*`
* Comparisons: `sum x[i]*item[i].weight over i=(1:N) <= MaxWeight`

### Execution Modes

Each request specifies a mode that determines what operation to run. Available modes:

* `generate`: generates one random feasible solution.
* `perturbation`: applies k random moves to a base solution to escape local optima.
* `neighborhood`: enumerates all neighbors reachable by a single move from a base solution.
* `local-search`: runs one best-improvement step from a starting solution.
* `select-best`: picks the best feasible candidate from a list.
* `temperature-acceptance`: applies the simulated annealing acceptance rule.

## Architecture

The backend is organized into four main areas:

### Entry Point

Reads the request file, parses it, calls the dispatcher and prints the response.

#### Main Files

| File      | Responsibility                            |
| --------- | ----------------------------------------- |
| `main.rs` | CLI argument parsing and request dispatch |
| `api.rs`  | Request/response types and mode router    |

### Problem and Evaluation

Responsible for loading the problem definition and evaluating goals and constraints.

#### Main Files

| File         | Responsibility                                          |
| ------------ | ------------------------------------------------------- |
| `problem.rs` | Problem struct, JSON loading, feasibility, scoring      |
| `eval.rs`    | Expression evaluator for goal and constraint expressions |

### Solution

Responsible for representing and serializing solutions.

#### Main Files

| File          | Responsibility                                              |
| ------------- | ----------------------------------------------------------- |
| `solution.rs` | `Solution` enum, JSON conversion, `SolverResult` builder   |

### Execution Modes

Each mode is its own submodule under `src/modes/`. All modes share the same signature: they receive the problem, a JSON payload, and a random number generator, and return either a `SolverResult` or a JSON value.

#### Main Files

| File                      | Mode                    | Returns        |
| ------------------------- | ----------------------- | -------------- |
| `modes/generate.rs`       | `generate`              | `SolverResult` |
| `modes/local_search.rs`   | `local-search`          | `SolverResult` |
| `modes/perturbation.rs`   | `perturbation`          | JSON payload   |
| `modes/neighborhood.rs`   | `neighborhood`          | JSON payload   |
| `modes/select_best.rs`    | `select-best`           | JSON payload   |
| `modes/temperature_acceptance.rs` | `temperature-acceptance` | JSON payload |