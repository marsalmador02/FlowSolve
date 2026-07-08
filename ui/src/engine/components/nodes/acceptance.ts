/**
 * acceptance.ts
 * 
 * This module defines the AcceptanceComponent, which is responsible for selecting the best solution
 * from multiple candidates in a workflow graph. It interacts with the runtime API to perform the
 * selection and updates the node data accordingly.
 */

import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { callRuntimeExecute } from '../../../services/prodefApi';
import { JoinRuntimeComponent, formatCompact, toPretty } from '../base';

/**
 * AcceptanceComponent is a component that selects the best solution from incoming packets. It uses
 * the runtime API to determine the winner among candidate solutions and updates the node data.
 */
export class AcceptanceComponent extends JoinRuntimeComponent {
  async executeJoin(ctx: ComponentContext, packets: Packet[]): Promise<ExecuteResult> {
    if (packets.length < 2) {
      return { kind: 'wait' };
    }

    const candidates: SolutionLike[] = packets
      .map((p) => p.solution)
      .filter((s): s is SolutionLike => Boolean(s));

    if (candidates.length === 0) {
      return { kind: 'error', message: 'acceptance received no valid solutions.' };
    }

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'select-best',
        payload: { candidates: candidates },
      },
    });

    const payload = (response.payload) as {
      winner: SolutionLike;
      selectedIndex: number;
      score: number;
    };
    const winner = payload.winner;

    ctx.updateNodeData({
      solution: toPretty(winner),
      decisionSummary: formatCompact(winner),
    });
    ctx.appendTrace(
      `✅ Acceptance: ${formatCompact(winner)}`,
    );

    return {
      kind: 'emit',
      idIteration: packets[0].idIteration,
      solution: winner,
    };
  }
}
