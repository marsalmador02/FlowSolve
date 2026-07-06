# UI and Graph Editor

## Overview

This part of the UI provides a visual environment for building, configurin and executing metaheuristic algorithms. Users can create workflows by connecting components in a graph-based editor and observe how solutions evolve during execution.

The system is built around **React Flow**, where each node represents a metaheuristic operation and edges define the execution flow between them.

## Main Features

### Graph Editor

Users can create algorithms visually by:

* Dragging components from the sidebar.
* Connecting nodes through input/output handles.
* Configuring node parameters.
* Defining start and end nodes.

The resulting graph represents the execution logic of the algorithm.

### Algorithm Templates

The editor includes predefined templates for common metaheuristics:

* GRASP
* Iterated Local Search (ILS)
* Variable Neighborhood Search (VNS)
* Tabu Search
* Simulated Annealing

Templates automatically generate the required nodes and connections, providing a quick starting point for experimentation.

### Runtime Execution

Workflows can be executed directly from the UI.

The execution engine:

1. Validates the graph structure.
2. Creates runtime component instances.
3. Routes packets between connected nodes.
4. Updates node state and execution traces.
5. Displays intermediate and final solutions.

### Execution Monitoring

During execution, users can inspect:

* Current node being executed.
* Generated solutions.
* Objective values.
* Iteration counters.
* Acceptance decisions.
* Error messages.

Execution traces are displayed in real time to help understand the behavior of the algorithm.

### Problem Configuration

The UI supports loading optimization problems through JSON definitions.

Available examples include:

* Knapsack Problem
* Traveling Salesman Problem (TSP)
* Assignment Problem

Users can edit the JSON directly before executing a workflow.

### Result Export

Execution results can be exported as:

* TXT execution traces
* CSV metric histories

CSV exports are designed for later analysis and comparison of algorithm performance.

# Architecture

The UI is organized into four main areas:

## Flow Editor

Responsible for workflow construction and visualization.

### Main Files

| File                 | Responsibility                              |
| -------------------- | ------------------------------------------- |
| `FlowSidebar.tsx`    | Component toolbox and algorithm templates   |
| `flowNodes.tsx`      | Custom React Flow node definitions          |
| `ExecutionPanel.tsx` | Problem configuration and execution traces  |
| `flow.ts`            | Shared flow types and node data definitions |
| `flowHelpers.ts`     | Shared utility functions                    |

## Templates

Responsible for generating predefined algorithm graphs.

### Main Files

| File                  | Responsibility                         |
| --------------------- | -------------------------------------- |
| `flowTemplates.ts`    | Defines predefined algorithm templates |
| `algorithmBuilder.ts` | Template selection and creation logic  |

## Runtime Engine

Responsible for workflow execution.

### Main Files

| File                 | Responsibility                   |
| -------------------- | -------------------------------- |
| `packetExecutor.ts`  | Executes workflow graphs         |
| `packet.ts`          | Runtime packet definitions       |
| `registry.ts`        | Runtime component registry       |
| `graphValidation.ts` | Workflow validation              |
| `base.ts`            | Runtime component abstractions   |
| `useFlowRunner.ts`   | React hook for execution control |

## Runtime Components

Each executable node has its own runtime implementation.

Examples include:

* Single Solution Generator
* Local Search
* Perturbation
* Acceptance
* Storage
* Loop
* Neighborhood
* Selection Best
* Subtraction
* Temperature Acceptance
* Reduce Temperature
* Change Neighborhood

## API Bridge Integration

The UI communicates with a thin Node.js bridge that forwards requests to the Rust execution runtime.

### Main Files

| File                 | Responsibility                   |
| -------------------- | -------------------------------- |
| `prodefApi.ts`       | HTTP client for the Node.js bridge |
| `runtimeContract.ts` | Request and response definitions |

## Data Export

### Main Files

| File              | Responsibility                        |
| ----------------- | ------------------------------------- |
| `executionCsv.ts` | CSV generation and download utilities |
