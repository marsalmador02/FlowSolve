/**
 * localSearch.ts
 * 
 * This module defines the LocalSearchComponent, which is responsible for executing a local search
 * procedure on a candidate solution. It interacts with the runtime API to perform the local search
 * and updates the node data with the improved solution.
 */

import { callRuntimeExecute } from '../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { RuntimeComponent, formatCompact, solutionScore, toPretty } from '../base';

/**
 * LocalSearchComponent is a component that performs a local search on an incoming solution. It uses
 * the runtime API to find an improved solution and updates the node data accordingly.
 */
export class LocalSearchComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const base = incoming.solution as SolutionLike;
    const vector = Array.isArray(base?.variableValue) ? (base?.variableValue as number[]) : null;
    if (!vector) {
      return { kind: 'error', message: 'localSearch requires a solution with variableValue[].' };
    }

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'local-search',
        payload: { solution: vector, steps: 100 },
      },
    });

    if (!response.result) {
      return { kind: 'error', message: 'Runtime local-search returned no result.' };
    }

    const improved = response.result as SolutionLike;
    ctx.updateNodeData({ solution: toPretty(improved) });

    const baseScore = solutionScore(base);
    const outScore = solutionScore(improved);
    const delta = outScore - baseScore;
    const sign = delta > 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0);

    ctx.appendTrace(
      `🔍 Local Search: baseline = ${formatCompact(base)}\n      Best move: ${formatCompact(improved)} (Δ${sign})`,
    );

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solution: improved,
    };
  }
}
