/*
 * Archivo: storage.ts
 *
 * Que contiene:
 * - Componente storage con dos modos automaticos:
 *   - Overwrite: cuando ningun sucesor es substraction, reemplaza la solucion/set.
 *   - Accumulate: cuando algun sucesor es substraction, va acumulando todas las
 *     soluciones que recibe en una lista que crece con el tiempo.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Memoria ligera del flujo. En modo accumulate acumula el historico de candidatos
 *   que despues restara substraction. Si es nodo final, su ultimo guardado es el resultado.
 */
import { parseJson } from '../../../../utils/flowHelpers';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, solutionsEqualByVars, toPretty } from '../base';

// Lee el set acumulado en modo accumulate, manejando ambos formatos posibles (array o string)
function readAccumulated(ctx: ComponentContext): SolutionLike[] {
  const data = ctx.nodeData;
  if (Array.isArray(data.solutionSet)) {
    return [...(data.solutionSet as SolutionLike[])];
  }
  if (typeof data.solutionSet === 'string' && data.solutionSet.length > 0) {
    const parsed = parseJson<SolutionLike[]>(data.solutionSet);
    return Array.isArray(parsed) ? parsed : [];
  }
  return [];
}

// Convierte un paquete en un array de soluciones, ya sea a partir de solutionSet o solution unica.
function packetSolutions(incoming: Packet): SolutionLike[] {
  if (Array.isArray(incoming.solutionSet) && incoming.solutionSet.length > 0) {
    return incoming.solutionSet.filter(Boolean) as SolutionLike[];
  }
  if (incoming.solution) {
    return [incoming.solution];
  }
  return [];
}

export class StorageComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const outgoing = ctx.getOutgoingTargets();
    const feedsSubstraction = outgoing.some((o) => o.type === 'substraction');
    
    if (feedsSubstraction) {
      const existing = readAccumulated(ctx);
      const arriving = packetSolutions(incoming);
      let added = 0;
      for (const candidate of arriving) {
        const alreadyStored = existing.some((prev) => solutionsEqualByVars(prev, candidate));
        if (!alreadyStored) {
          existing.push(candidate);
          added += 1;
        }
      }

      ctx.updateNodeData({
        solutionSet: toPretty(existing),
        setSize: existing.length,
        solution: undefined,
      });
      ctx.appendTrace(`📦 Storage (accumulate): added ${added}, total size=${existing.length}`);

      return {
        kind: 'emit',
        idIteration: incoming.idIteration,
        solutionSet: existing,
      };
    }

    if (Array.isArray(incoming.solutionSet) && incoming.solutionSet.length > 0) {
      const set = incoming.solutionSet;
      ctx.updateNodeData({
        solutionSet: toPretty(set),
        setSize: set.length,
        solution: undefined,
      });
      ctx.appendTrace(`📦 Storage: population size=${set.length}`);
      return {
        kind: 'emit',
        idIteration: incoming.idIteration,
        solutionSet: set,
      };
    }

    const solution = incoming.solution ?? null;
    ctx.updateNodeData({
      solution: solution ? toPretty(solution) : undefined,
      solutionSet: undefined,
      setSize: 0,
    });
    if (solution) {
      ctx.appendTrace(`📦 Storage: ${formatCompact(solution)}`);
    } else {
      ctx.appendTrace('📦 Storage: (empty)');
    }

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solution,
    };
  }
}
