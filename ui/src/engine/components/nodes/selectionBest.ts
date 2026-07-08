/**
 * selectionBest.ts
 * 
 * This module defines the SelectionBestComponent, which is responsible for selecting the best solution
 * from a set of candidate solutions. It interacts with the runtime API to perform the selection and
 * updates the node data accordingly.
 */

import { callRuntimeExecute } from '../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

/**
 * SelectionBestComponent is a component that selects the best solution from incoming packets. It uses
 * the runtime API to determine the winner among candidate solutions and updates the node data.
 */
export class SelectionBestComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const candidates = Array.isArray(incoming.solutionSet)
      ? (incoming.solutionSet as SolutionLike[])
      : incoming.solution
        ? [incoming.solution as SolutionLike]
        : [];

    if (candidates.length === 0) {
      return { kind: 'error', message: 'selectionBest received empty input.' };
    }

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'select-best',
        payload: { candidates: candidates },
      },
    });

    const winner = (response.payload as { winner?: SolutionLike }).winner ?? candidates[0];
    ctx.updateNodeData({ solution: toPretty(winner) });
    ctx.appendTrace(`🏆 Selection Best: ${formatCompact(winner)}`);

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solution: winner,
    };
  }
}
