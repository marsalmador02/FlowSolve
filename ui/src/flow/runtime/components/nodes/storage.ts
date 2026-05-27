/*
 * File: storage.ts
 *
 * Contains:
 * - Storage component with two automatic modes:
 *   - Overwrite: when no successor is a substraction node, it replaces the solution/set.
 *   - Accumulate: when a successor is substraction, it accumulates received
 *     solutions into a growing list. While accumulating it calls Rust to pick
 *     the best solution and places it at index 0 for fast access.
 *
 * Role in the flow (startup -> graph execution):
 * - Lightweight flow memory. In accumulate mode it gathers candidate history
 *   later substracted by `substraction`. If used as terminal node, the first
 *   solution (best) is considered the result. The node also maintains a `history`
 *   array storing objective values for CSV export.
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
        maxIterations: incoming.maxIterations,
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
        maxIterations: incoming.maxIterations,
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
      maxIterations: incoming.maxIterations,
      solution,
    };
  }
}
