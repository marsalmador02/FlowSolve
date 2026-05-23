/*
 * File: neighborhood.ts
 *
 * Contains:
 * - Component that generates feasible neighbors for a solution (delegates to Rust 'neighborhood').
 *
 * Role in the flow (startup -> graph execution):
 * - Converts a packet with a single solution into a packet with a solutionSet (feasible neighbors).
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class NeighborhoodComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const base = incoming.solution as SolutionLike;
    if (!base) {
      return { kind: 'error', message: 'neighborhood requires a solution as input.' };
    }

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'neighborhood',
        payload: {
          base,
          maxNeighbors: Number(ctx.nodeData.maxNeighbors ?? 32),
        },
      },
    });

    const payload = response.payload as { generated?: SolutionLike[]; feasible?: SolutionLike[] };
    const feasible = Array.isArray(payload.feasible) ? payload.feasible.filter(Boolean) : [];
    const generated = Array.isArray(payload.generated) ? payload.generated.filter(Boolean) : [];
    const neighbors = feasible.length > 0 ? feasible : generated;

    ctx.updateNodeData({ solutionSet: toPretty(neighbors), setSize: neighbors.length });
    const lines = [
      `🧩 Neighborhood: baseline = ${formatCompact(base)}`,
      `    Generated neighbors:`,
    ];
    neighbors.forEach((neighbor, idx) => {
      lines.push(`      n${idx + 1}: ${formatCompact(neighbor)}`);
    });
    ctx.appendTrace(lines.join('\n'));

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solutionSet: neighbors,
    };
  }
}
