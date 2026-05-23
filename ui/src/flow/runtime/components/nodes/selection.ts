/*
 * File: selection.ts
 *
 * Contains:
 * - Component that selects individuals from a population to pass to the next
 *   generation (delegates to Rust 'selection').
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class SelectionComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const input = (incoming.solutionSet as SolutionLike[]) || [];
    if (!Array.isArray(input) || input.length === 0) {
      return { kind: 'error', message: 'selection requires a non-empty population.' };
    }

    const eliteSize = ctx.nodeData.eliteSize ?? 1;
    const tournamentSize = ctx.nodeData.tournamentSize ?? 3;

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'selection',
        payload: {
          candidates: input,
          targetSize: input.length,
          eliteSize,
          tournamentSize,
        },
      },
    });

    const payload = response.payload as { selected?: SolutionLike[]; eliteCount?: number };
    const selected = Array.isArray(payload.selected) && payload.selected.length > 0
      ? payload.selected
      : input;

    ctx.updateNodeData({ solutionSet: toPretty(selected), setSize: selected.length });
    const realElite = payload.eliteCount ?? eliteSize;
    const lines = [`🎯 Selection: elite=${realElite}, strategy=tournament(${tournamentSize})`];
    selected.forEach((individual, idx) => {
      lines.push(`      s${idx + 1}: ${formatCompact(individual)}`);
    });
    ctx.appendTrace(lines.join('\n'));

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solutionSet: selected,
    };
  }
}
