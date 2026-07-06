/**
 * Subtraction Component
 *
 * Removes solutions contained in one set from another set. It is commonly used in
 * Tabu Search to exclude solutions already present in the tabu list.
 */

import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { JoinRuntimeComponent, toPretty } from '../base';

// Produces a stable string key from a solution's variable vector.
function vectorKey(solution: SolutionLike): string {
  return JSON.stringify(solution.variableValue);
}

// Extracts all solutions from a packet, whether it carries a set or a single item.
function packetToSet(packet: Packet): SolutionLike[] {
  if (packet.solutionSet) return packet.solutionSet.filter(Boolean) as SolutionLike[];
  if (packet.solution) return [packet.solution];
  return [];
}

export class SubtractionComponent extends JoinRuntimeComponent {
  async executeJoin(ctx: ComponentContext, packets: Packet[]): Promise<ExecuteResult> {
    if (packets.length < 2) return { kind: 'wait' };

    const sources = ctx.getIncomingSources();
    const storageIds = new Set(sources.filter((s) => s.type === 'storage').map((s) => s.id));

    const storagePacket = packets.find((p) => storageIds.has(p.fromId));
    const otherPacket = packets.find((p) => p !== storagePacket);

    if (!storagePacket || !otherPacket) {
      return { kind: 'error', message: 'subtraction requires one input from a storage node.' };
    }

    const toRemove = new Set(packetToSet(storagePacket).map(vectorKey));
    const remaining = packetToSet(otherPacket).filter((sol) => !toRemove.has(vectorKey(sol)));

    ctx.updateNodeData({ solutionSet: toPretty(remaining), setSize: remaining.length });
    ctx.appendTrace(`➖ Subtraction: ${remaining.length} remaining (${packetToSet(otherPacket).length - remaining.length} filtered out)`);

    return { kind: 'emit', idIteration: packets[0].idIteration, solutionSet: remaining };
  }
}