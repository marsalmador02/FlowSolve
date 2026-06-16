// Contract types for executing runtime operations through the Rust engine.
//
// The backend contract is intentionally tiny: each request targets one
// component (mode) and returns at most one of `result`, `population`,
// `payload` or `catalog`. The rest of the fields the UI used to receive
// (state, trace, warnings...) are handled locally in JS.

export type RuntimeExecutionMode =
  | 'generate'
  | 'generate-population'
  | 'local-search'
  | 'catalog'
  | 'select-best'
  | 'temperature-acceptance'
  | 'selection'
  | 'crossover'
  | 'mutation'
  | 'perturbation'
  | 'neighborhood';

export interface RuntimeComponentDescriptor {
  kind: string;
  label: string;
  category: string;
  stateful: boolean;
}

export interface RuntimeExecutionRequest {
  problem?: unknown;
  execution: {
    mode: RuntimeExecutionMode;
    payload?: RuntimeExecutionPayload;
  };
}

export interface RuntimeExecutionPayload {
  [key: string]: unknown;
  count?: number;
  steps?: number;
  solution?: number[];
  candidates?: unknown[];
  mutationRate?: number;
  mutationRateExpression?: string;
  maxAttempts?: number;
  k?: number;
  kExpression?: string;
  neighborhood?: number;
  neighborhoodExpression?: string;
  maxNeighbors?: number;
}

export interface RuntimeSolverResult {
  problemName: string;
  isFeasible: boolean;
  goalValues: number[];
  variableValue: unknown;
}

export interface RuntimeExecutionResponse {
  result?: RuntimeSolverResult | null;
  population?: RuntimeSolverResult[] | null;
  payload?: unknown | null;
  catalog?: RuntimeComponentDescriptor[] | null;
}
