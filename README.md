# Othimi FlowSolve

Othimi FlowSolve is a visual tool for building, visualizing, and executing metaheuristics using node-based graphs. It makes it possible to design optimization algorithms without writing code, through a visual interface connected to a Rust execution engine.

# Architecture

The system is divided into three layers.

```text
┌──────────────────────────────────────────────────────────────┐
│ UI (React + React Flow)                                      │
│ • Visual editor                                              │
│ • Component configuration                                    │
│ • Algorithm templates                                        │
│ • Trace and metric export                                    │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼───────────────────────────────┐
│ Node.js Backend                                               │
│ • REST API                                                    │
│ • Request validation                                          │
│ • Communication with the Rust runtime                         │
└──────────────────────────────┬───────────────────────────────┘
                               │ Process execution
┌──────────────────────────────▼───────────────────────────────┐
│ Rust Engine                                                  │
│ • Problem loading                                             │
│ • Expression evaluation                                       │
│ • Feasibility checking                                        │
│ • Metaheuristic operators                                     │
│ • JSON responses                                              │
└──────────────────────────────────────────────────────────────┘
```

# Included Metaheuristics

The editor provides predefined templates for:

- GRASP
- Iterated Local Search (ILS)
- Variable Neighborhood Search (VNS)
- Tabu Search
- Simulated Annealing

These templates can be modified or extended visually.

# Optimization Problems

Problems are described as JSON files and loaded dynamically.

Currently supported problem families include:

- Knapsack Problem
- Traveling Salesman Problem (TSP)
- Assignment Problem

# Runtime Operations

The Rust runtime currently implements the following execution modes:

| Mode | Description |
|------|-------------|
| `generate` | Generate one random feasible solution |
| `local-search` | Perform one best-improvement local search step |
| `perturbation` | Apply random perturbations to a solution |
| `neighborhood` | Generate the neighborhood of a solution |
| `select-best` | Select the best feasible candidate |
| `temperature-acceptance` | Simulated annealing acceptance criterion |

# Installation

## Requirements

- Node.js
- npm
- Rust
- Cargo
- Git

Install all dependencies:

```bash
npm install
npm --prefix ui install
```

# Running the application

Start the application:

```bash
npm start
```

The UI is available at:

```
http://localhost:5173
```

# Project Structure

```text
FlowSolve/
│
├── README.md
├── package.json
├── ui/                     # React visual editor
└── prodef-runtime-rust/    # Rust optimization runtime
```

# Execution

1. The user builds a graph in the visual interface.
2. The UI serializes the flow and sends it to the backend.
3. The backend runs the Rust engine with the received request.
4. The engine processes the selected mode and returns a JSON result.
5. The UI updates nodes and traces on screen.

# Documentation

Each subsystem includes its own documentation.

| Directory | Description |
|-----------|-------------|
| `ui/README.md` | Visual editor architecture and execution engine |
| `prodef-runtime-rust/README.md` | Rust runtime architecture and execution modes |

The project also generates API documentation automatically.

## Generate documentation

```bash
npm run docs:ui
npm run docs:rust
```

Generated documentation:

- **TypeDoc**

```
ui/docs/ui/index.html
```

- **Rustdoc**

```
prodef-runtime-rust/target/doc/prodef_runtime_rust/index.html
```

## Testing

```bash
npm test
```