/*
 * Archivo: storage.ts
 *
 * Que contiene:
 * - Componente storage con dos modos automaticos:
 *   - Overwrite: cuando ningun sucesor es substraction, reemplaza la solucion/set.
 *   - Accumulate: cuando algun sucesor es substraction, va acumulando todas las
 *     soluciones que recibe en una lista que crece con el tiempo.
 *     Al accumular, se llama a Rust para determinar la mejor solucion y se coloca
 *     al inicio de la lista para acceso rápido.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Memoria ligera del flujo. En modo accumulate acumula el historico de candidatos
 *   que despues restara substraction. Si es nodo final, la primera solucion (mejor) es el resultado.
 * El nodo también mantiene un array `history` que almacena el valor objetivo de cada
 * solución que recibe. Este history se usa para exportar el CSV de ejecución.
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import { parseJson } from '../../../../utils/flowHelpers';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, solutionScore, solutionsEqualByVars, toPretty } from '../base';

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

    if (!Array.isArray(ctx.nodeData.history)) {
      ctx.updateNodeData({ history: [] });
    }
    const history = (ctx.nodeData.history as number[]) || [];
    
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

      // Call Rust to determine the best solution and move it to index 0
      if (existing.length > 0) {
        try {
          const response = await callRuntimeExecute({
            problem: ctx.problem,
            execution: {
              mode: 'select-best',
              payload: { candidates: existing },
            },
          });

          const best = (response.payload as { winner?: SolutionLike })?.winner;
          if (best) {
            // Remove best from current position and place at index 0
            const filtered = existing.filter((sol) => !solutionsEqualByVars(sol, best));
            existing.splice(0, existing.length, best, ...filtered);
            
            const score = solutionScore(best);
            if (Number.isFinite(score)) {
              history.push(score);
            }
          }
        } catch (error) {
          ctx.appendTrace(`⚠️ Storage: could not determine best via Rust, keeping current order`);
        }
      }

      ctx.updateNodeData({
        solutionSet: toPretty(existing),
        setSize: existing.length,
        solution: undefined,
        history,
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
      
      if (set.length > 0) {
        const best = set[0] as SolutionLike;
        const score = solutionScore(best);
        if (Number.isFinite(score)) {
          history.push(score);
        }
      }
      
      ctx.updateNodeData({
        solutionSet: toPretty(set),
        setSize: set.length,
        solution: undefined,
        history,
      });
      ctx.appendTrace(`📦 Storage: population size=${set.length}`);
      return {
        kind: 'emit',
        idIteration: incoming.idIteration,
        solutionSet: set,
      };
    }

    const solution = incoming.solution ?? null;
    
    if (solution) {
      const score = solutionScore(solution);
      if (Number.isFinite(score)) {
        history.push(score);
      }
    }
    
    ctx.updateNodeData({
      solution: solution ? toPretty(solution) : undefined,
      solutionSet: undefined,
      setSize: 0,
      history,
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
