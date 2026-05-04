/*
 * Archivo: substraction.ts
 *
 * Que contiene:
 * - Componente substraction de 2 entradas: espera un paquete desde storage y otro
 *   desde un componente distinto con el mismo idIteration.
 * - Resta (set difference por vector de variables) el conjunto de storage al otro set.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Sincroniza dos caminos; una entrada DEBE venir de storage. Emite el set resultante.
 */
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { JoinRuntimeComponent, toPretty } from '../base';

// Crea una clave string unica para cada solucion basada en su vector de variables.
function vectorKey(solution: SolutionLike): string {
  return JSON.stringify(solution.variableValue);
}

// Convierte un paquete en un array de soluciones, ya sea a partir de solutionSet o solution unica.
function packetToSet(packet: Packet): SolutionLike[] {
  if (Array.isArray(packet.solutionSet)) {
    return packet.solutionSet.filter(Boolean) as SolutionLike[];
  }
  if (packet.solution) {
    return [packet.solution];
  }
  return [];
}

export class SubstractionComponent extends JoinRuntimeComponent {
  async executeJoin(ctx: ComponentContext, packets: Packet[]): Promise<ExecuteResult> {
    if (packets.length < 2) {
      return { kind: 'wait' };
    }

    const sources = ctx.getIncomingSources();
    const storageIds = new Set(sources.filter((s) => s.type === 'storage').map((s) => s.id));

    const storagePacket = packets.find((p) => storageIds.has(p.fromId));
    const otherPacket = packets.find((p) => p !== storagePacket);

    if (!storagePacket || !otherPacket) {
      return {
        kind: 'error',
        message: 'substraction requires one input from a storage node.',
      };
    }

    const toRemove = new Set(
      packetToSet(storagePacket)
        .map(vectorKey) // Convertir cada solucion del storage en su clave string unica
        .filter((k): k is string => Boolean(k)), // Filtrar claves no validas
    );
    const source = packetToSet(otherPacket);

    const remaining = source.filter((solution) => {
      const key = vectorKey(solution);
      return key !== null && !toRemove.has(key);
    });

    ctx.updateNodeData({ solutionSet: toPretty(remaining), setSize: remaining.length });
    ctx.appendTrace(
      `➖ Substraction: ${source.length} - ${toRemove.size} = ${remaining.length}`,
    );

    return {
      kind: 'emit',
      idIteration: packets[0].idIteration,
      solutionSet: remaining,
    };
  }
}
