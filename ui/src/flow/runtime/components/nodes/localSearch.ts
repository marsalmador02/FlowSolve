/**
 * Local Search Component
 *
 * Applies a local search procedure to an incoming solution. The resulting solution
 * is expected to be equal to or better than the original candidate.
 */

import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, solutionScore, toPretty } from '../base';

/**
 * Runtime implementation of the Local Search node.
 *
 * Receives a candidate solution, executes a local search procedure and forwards
 * the improved solution.
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
