/**
 * Runtime Contract
 *
 * Defines the request and response structures exchanged between the UI runtime
 * engine and the backend execution service.
 */

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

/**
 * Request sent from the UI to the runtime backend.
 */
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
  maxAttemptsExpression?: string;
  k?: number;
  kExpression?: string;
  neighborhood?: number;
  neighborhoodExpression?: string;
  maxNeighbors?: number;
  maxNeighborsExpression?: string;
}

/**
 * Represents a solution returned by the backend solver.
 */
export interface RuntimeSolverResult {
  problemName: string;
  isFeasible: boolean;
  goalValues: number[];
  variableValue: unknown;
}

/**
 * Response returned by the runtime backend.
 */
export interface RuntimeExecutionResponse {
  result?: RuntimeSolverResult | null;
  population?: RuntimeSolverResult[] | null;
  payload?: unknown | null;
  catalog?: RuntimeComponentDescriptor[] | null;
}
