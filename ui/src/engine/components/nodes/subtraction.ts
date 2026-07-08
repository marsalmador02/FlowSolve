/**
 * subtraction.ts
 * 
 * This module defines the SubtractionComponent, which is responsible for performing a set subtraction
 * operation on incoming packets. It removes solutions present in the storage node from the other
 * incoming packet and updates the node data accordingly.
 */

import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { JoinRuntimeComponent, toPretty } from '../base';

/**
 * Generates a stable string key from a solution's variable vector.
 * 
 * @param solution The solution for which to generate a key.
 * @returns A unique string key for the solution.
 */
function vectorKey(solution: SolutionLike): string {
  return JSON.stringify(solution.variableValue);
}

/**
 * Extracts all solutions from a packet, whether it carries a set or a single item.
 * 
 * @param packet The packet from which to extract solutions.
 * @returns Array of solutions contained in the packet.
 */
function packetToSet(packet: Packet): SolutionLike[] {
  if (packet.solutionSet) return packet.solutionSet.filter(Boolean) as SolutionLike[];
  if (packet.solution) return [packet.solution];
  return [];
}

/**
 * SubtractionComponent is a component that performs a set subtraction operation on incoming packets.
 * It removes solutions present in the storage node from the other incoming packet and updates the
 * node data accordingly.
 */
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