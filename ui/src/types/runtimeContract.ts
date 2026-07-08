/**
 * runtimeContract.ts
 *
 * This file contains type definitions for the runtime contract used in the workflow execution.
 */

/**
 * RuntimeExecutionMode defines the different modes of execution available in the runtime.
 */
export type RuntimeExecutionMode =
  | 'generate'
  | 'local-search'
  | 'select-best'
  | 'temperature-acceptance'
  | 'perturbation'
  | 'neighborhood';

/**
 * RuntimeExecutionRequest defines the structure of the request sent to the runtime for execution.
 * It includes the problem definition and the execution mode along with any additional payload.
 */
export interface RuntimeExecutionRequest {
  problem?: unknown;
  execution: {
    mode: RuntimeExecutionMode;
    payload?: RuntimeExecutionPayload;
  };
}

export type RuntimeExecutionPayload = Record<string, unknown>;

/**
 * RuntimeSolverResult defines the structure of the result returned by the runtime after execution.
 * It includes information about the problem, feasibility, goal values and variable values.
 */
export interface RuntimeSolverResult {
  problemName: string;
  isFeasible: boolean;
  goalValues: number[];
  variableValue: unknown;
}

/**
 * RuntimeExecutionResponse defines the structure of the response received from the runtime after execution.
 * It includes the result of the execution, any population of results and an optional payload.
 */
export interface RuntimeExecutionResponse {
  result?: RuntimeSolverResult | null;
  population?: RuntimeSolverResult[] | null;
  payload?: unknown | null;
}
