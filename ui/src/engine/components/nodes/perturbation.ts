/**
 * perturbation.ts
 * 
 * This module defines the PerturbationComponent, which is responsible for applying a perturbation
 * procedure to an incoming solution. It interacts with the runtime API to perform the perturbation
 * and updates the node data with the resulting solution.
 */

import { callRuntimeExecute } from '../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { RuntimeComponent, formatCompact, solutionScore, toPretty } from '../base';

/**
 * PerturbationComponent is a component that applies a perturbation procedure to an incoming solution.
 * It uses the runtime API to find a perturbed solution and updates the node data accordingly.
 */
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
