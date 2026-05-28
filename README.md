# Othimi FlowSolve

Othimi FlowSolve is a visual tool for building, visualizing, and executing metaheuristics using node-based graphs. It makes it possible to design optimization algorithms without writing code, through a visual interface connected to a Rust execution engine.

## General architecture

The system is divided into three main layers:

```text
┌─────────────────────────────────────────────────────────┐
│ UI (React + React Flow)                                 │
│ - Visual graph design                                   │
│ - Node and parameter configuration                      │
│ - Step-by-step or full execution                        │
│ - Trace and result visualization                        │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────────────┐
│ Intermediate backend (Node.js)                          │
│ - REST API                                              │
│ - Communication between UI and Rust engine              │
│ - Request/response management                           │
└────────────────────┬────────────────────────────────────┘
                     │ Process execution
┌────────────────────▼────────────────────────────────────┐
│ Optimization engine (Rust)                              │
│ - Solution generation and evaluation                    │
│ - Metaheuristic operators                               │
│ - Local search and perturbation                         │
│ - JSON-based responses                                  │
└─────────────────────────────────────────────────────────┘
```

## Requirements

- Node.js
- npm
- Rust
- cargo
- Git

## Installation

### Install dependencies

```bash
npm install

npm --prefix ui install
```

### Run the application

```bash
npm start
```

Then open:

```text
http://localhost:5173
```

## Project structure

```text
FlowSolve/
├── README.md
├── package.json
├── prodef-runtime-rust/          # Execution engine
├── ui/                           # React interface
```

## Execution flow

1. The user builds a graph in the visual interface.
2. The UI serializes the flow and sends it to the backend.
3. The backend runs the Rust engine with the received request.
4. The engine processes the selected mode and returns a JSON result.
5. The UI updates nodes and traces on screen.

## Main components

The tool includes nodes for common metaheuristic operations such as:

- Solution generation
- Population generation
- Mutation
- Crossover
- Perturbation
- Local search
- Selection
- Best-solution selection
- Neighborhood generation
- Temperature-based acceptance
- Iteration control
- Solution storage

## Runtime modes supported

| Mode | Description |
|---|---|
| `generate` | Generates a random solution |
| `generate-population` | Generates an initial population |
| `mutation` | Applies mutation |
| `crossover` | Applies crossover |
| `perturbation` | Perturbs a solution |
| `neighborhood` | Generates neighbors |
| `selection` | Selects solutions |
| `select-best` | Returns the best solution |
| `local-search` | Runs local search |
| `temperature-acceptance` | Temperature-based acceptance |

## Documentation

The project includes both manual documentation and automatically generated documentation:

- General documentation in the various `README.md` files
- Rust runtime documentation generated with `rustdoc`
- UI documentation generated with `TypeDoc`

### Generate documentation

```bash
npm run docs:rust
npm run docs:ui
```

### Generated HTML documentation

- UI (`TypeDoc`):
  - `ui/docs/ui/index.html`

- Rust runtime (`rustdoc`):
  - `prodef-runtime-rust/target/doc/prodef_runtime_rust/index.html`