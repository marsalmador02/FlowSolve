/*
 * File: singleGenerator.ts
 *
 * Contains:
 * - Component that generates a single random feasible solution via Rust (mode 'generate').
 *
 * Role in the flow (startup -> graph execution):
 * - Used as a start node: on startup it produces the initial seed that travels into the loop.
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class SingleGeneratorComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: { mode: 'generate' },
    });

    if (!response.result) {
      return { kind: 'error', message: 'Runtime generate returned no result.' };
    }

    ctx.updateNodeData({ solution: toPretty(response.result) });
    ctx.appendTrace(`🧪 Single Solution Generator: ${formatCompact(response.result as SolutionLike)}`);

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solution: response.result as SolutionLike,
    };
  }
}
