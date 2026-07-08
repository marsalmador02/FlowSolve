/**
 * storage.ts
 * 
 * This module defines the StorageComponent, which is responsible for storing and managing solutions
 * in the workflow. It can accumulate solutions, select the best solution and update the node data
 * accordingly.
 */

import { callRuntimeExecute } from '../../../services/prodefApi';
import { parseJson } from '../../../utils/flowHelpers';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { RuntimeComponent, formatCompact, solutionScore, solutionsEqualByVars, toPretty } from '../base';

/**
 * Reads the accumulated solutions from the node data. It handles both array and string representations.
 * 
 * @param ctx Component context.
 * @returns Array of accumulated solutions.
 */
function readAccumulated(ctx: ComponentContext): SolutionLike[] {
  const solutionSet = ctx.nodeData.solutionSet;
  if (Array.isArray(solutionSet)) return [...solutionSet as SolutionLike[]];
  if (typeof solutionSet === 'string' && solutionSet.length > 0) {
    const parsed = parseJson<SolutionLike[]>(solutionSet);
    return parsed ? parsed : [];
  }
  return [];
}

/**
 * Extracts all solutions from a packet, whether it carries a set or a single item.
 * 
 * @param incoming Incoming packet.
 * @returns Array of solutions contained in the packet.
 */
function packetSolutions(incoming: Packet): SolutionLike[] {
  if (incoming.solutionSet && incoming.solutionSet.length > 0) {
    return incoming.solutionSet;
  }
  if (incoming.solution) return [incoming.solution];
  return [];
}
  
/**
 * StorageComponent is a component that manages the storage of solutions in the workflow. It can
 * accumulate solutions, select the best solution and update the node data accordingly.
 */
export class StorageComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const feedsSubtraction = ctx.getOutgoingTargets().some((o) => o.type === 'subtraction');
    const history: number[] = ctx.nodeData.history
      ? (ctx.nodeData.history)
      : [];

    if (feedsSubtraction) {
      const existing = readAccumulated(ctx);
      const arriving = packetSolutions(incoming);

      let added = 0;
      for (const candidate of arriving) {
        if (!existing.some((prev) => solutionsEqualByVars(prev, candidate))) {
          existing.push(candidate);
          added += 1;
        }
      }

      if (existing.length > 0) {
        const response = await callRuntimeExecute({
          problem: ctx.problem,
          execution: { 
            mode: 'select-best', 
            payload: { candidates: existing } 
          },
        });
        const best = (response.payload as { winner?: SolutionLike }).winner;
        if (best) {
          const rest = existing.filter((sol) => !solutionsEqualByVars(sol, best));
          existing.splice(0, existing.length, best, ...rest);
          const score = solutionScore(best);
          if (Number.isFinite(score)) history.push(score);
        }
      }

      ctx.updateNodeData({ solutionSet: toPretty(existing), setSize: existing.length, solution: undefined, history });
      ctx.appendTrace(`📦 Storage (accumulate): added ${added}, total size=${existing.length}`);
      return { kind: 'emit', idIteration: incoming.idIteration, maxIterations: incoming.maxIterations, solutionSet: existing };
    }

    const solution = incoming.solution ?? null;
    if (solution) {
      const score = solutionScore(solution);
      if (Number.isFinite(score)) history.push(score);
    }

    ctx.updateNodeData({ solution: solution ? toPretty(solution) : undefined, solutionSet: undefined, setSize: 0, history });
    ctx.appendTrace(solution ? `📦 Storage: ${formatCompact(solution)}` : '📦 Storage: (empty)');
    return { kind: 'emit', idIteration: incoming.idIteration, maxIterations: incoming.maxIterations, solution };
  }
}