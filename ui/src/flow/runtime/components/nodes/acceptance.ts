/*
 * File: acceptance.ts
 *
 * Contains:
 * - Acceptance component with 2 inputs: waits for two packets sharing the same
 *   idIteration and delegates the best-solution decision to Rust.
 *
 * Role in the flow (startup -> graph execution):
 * - Synchronizes two graph paths and selects the best candidate solution.
 */
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { callRuntimeExecute } from '../../../../services/prodefApi';
import { JoinRuntimeComponent, formatCompact, formatScore, toPretty } from '../base';

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
