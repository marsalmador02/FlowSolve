/**
 * Perturbation Component
 *
 * Produces a modified version of an existing solution by applying controlled 
 * random changes. It is typically used in diversification phases of metaheuristic
 * algorithms.
 */

import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, solutionScore, toPretty } from '../base';

export class PerturbationComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const base = incoming.solution;
    if (!base) {
      return { kind: 'error', message: 'perturbation requires a solution as input.' };
    }

    const maxAttempts = ctx.nodeData.maxAttempts ?? 10;
    const k = ctx.nodeData.neighborhoodValue ?? 1;

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'perturbation',
        payload: {
          base,
          maxAttempts,
          k,
        },
      },
    });

    const payload = (response.payload ?? {}) as {
      winner?: SolutionLike;
      attempts?: number;
      maxAttempts?: number;
    };
    const result: SolutionLike = payload.winner ?? (base as SolutionLike);
    const attempts = payload.attempts ?? 1;
    const delta = solutionScore(result) - solutionScore(base);
    const sign = delta >= 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0);

    ctx.updateNodeData({ solution: toPretty(result) });
    ctx.appendTrace(
      `🌪️ Perturbation: attempts = ${attempts}/${maxAttempts} | baseline = ${formatCompact(base)}\n      Attempt ${attempts} -> ${formatCompact(result)} (Δ${sign})`,
    );

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      maxIterations: incoming.maxIterations,
      solution: result,
    };
  }
}
