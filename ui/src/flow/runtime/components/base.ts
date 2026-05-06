/**
 * Base abstractions for runtime components.
 *
 * Purpose:
 * - Provide common execute contracts for single-input and join components.
 * - Centralize formatting and score helpers used in traces.
 */
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../engine/packet';

export abstract class RuntimeComponent {
  // Number of incoming packets required per iteration. Defaults to 1.
  readonly arity: number = 1;

  // Execute one step when a packet reaches this component.
  async execute(_ctx: ComponentContext, _incoming: Packet): Promise<ExecuteResult> {
    return { kind: 'error', message: 'execute not implemented' };
  }

  // Execute one step when all expected incoming packets for a given iteration
  // are available. Only join components override this method.
  async executeJoin(_ctx: ComponentContext, _packets: Packet[]): Promise<ExecuteResult> {
    return { kind: 'error', message: 'executeJoin not implemented' };
  }
}

export abstract class JoinRuntimeComponent extends RuntimeComponent {
  readonly arity: number = 2;

  async execute(_ctx: ComponentContext, _incoming: Packet): Promise<ExecuteResult> {
    return { kind: 'error', message: 'join components must be invoked via executeJoin' };
  }

  abstract executeJoin(ctx: ComponentContext, packets: Packet[]): Promise<ExecuteResult>;
}

// Compute an aggregate score treating infeasible results as very bad.
export function solutionScore(result: SolutionLike): number {
  if (!result || result.isFeasible === false) {
    return Number.NEGATIVE_INFINITY;
  }
  if (!Array.isArray(result.goalValues)) {
    return Number.NEGATIVE_INFINITY;
  }
  return result.goalValues.reduce(
    (acc: number, value: number) => acc + value,
    0,
  );
}

// Format a numeric score for traces.
export function formatScore(score: number): string {
  return Number.isFinite(score) ? Number(score).toString() : '-Inf';
}

// Format the variable vector of a solution for traces.
export function formatVars(result: SolutionLike): string {
  if (!result) {
    return '[]';
  }
  if (Array.isArray(result.variableValue)) {
    return JSON.stringify(result.variableValue);
  }
  return '[]';
}

// Compact "score -> vars" formatter used by the new traces.
export function formatCompact(result: SolutionLike): string {
  return `${formatScore(solutionScore(result))} -> ${formatVars(result)}`;
}

// Vector equality helper for comparing variableValue arrays.
export function solutionsEqualByVars(
  a: SolutionLike,
  b: SolutionLike,
): boolean {
  const av = a.variableValue as unknown[];
  const bv = b.variableValue as unknown[];
  if (!av || !bv || av.length !== bv.length) {
    return false;
  }
  for (let i = 0; i < av.length; i += 1) {
    if (av[i] !== bv[i]) {
      return false;
    }
  }
  return true;
}

// Serialize payloads stored in node.data as pretty JSON.
export function toPretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
