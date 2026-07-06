/**
 * Runtime Contract
 *
 * Defines the request and response structures exchanged between the UI runtime
 * engine and the backend execution service.
 */

export type RuntimeExecutionMode =
  | 'generate'
  | 'local-search'
  | 'select-best'
  | 'temperature-acceptance'
  | 'perturbation'
  | 'neighborhood';
export interface RuntimeExecutionRequest {
  problem?: unknown;
  execution: {
    mode: RuntimeExecutionMode;
    payload?: RuntimeExecutionPayload;
  };
}

export type RuntimeExecutionPayload = Record<string, unknown>;

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
}
