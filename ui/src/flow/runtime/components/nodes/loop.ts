/**
 * Loop Component
 *
 * Acts as the execution controller of the workflow. It manages iteration counters
 * and the stopping condition.
 */

import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, solutionScore, toPretty } from '../base';

/**
 * Runtime implementation of the Loop node.
 *
 * Controls iteration count and determines when workflow execution should terminate.
 */
export class LoopComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const maxIterations = ctx.nodeData.maxIterations ?? 10;
    const current = ctx.nodeData.iteration ?? 0;
    const next = current + 1;

    if (!Array.isArray(ctx.nodeData.history)) {
      ctx.updateNodeData({ history: [] });
    }
    const history = (ctx.nodeData.history as number[]) || [];

    const patchPayload: Record<string, unknown> = {};
    if (incoming.solution) {
      patchPayload.solution = toPretty(incoming.solution);
      const score = solutionScore(incoming.solution);
      if (Number.isFinite(score)) {
        history.push(score);
      }
    }
    if (Array.isArray(incoming.solutionSet)) {
      patchPayload.solutionSet = toPretty(incoming.solutionSet);
      patchPayload.setSize = incoming.solutionSet.length;

      if (incoming.solutionSet.length > 0) {
        const best = incoming.solutionSet[0] as SolutionLike;
        const score = solutionScore(best);
        if (Number.isFinite(score)) {
          history.push(score);
        }
      }
    }

    if (next > maxIterations) {
      ctx.updateNodeData({
        ...patchPayload,
        iteration: current,
        shouldStop: true,
        status: `stop: reached ${current}/${maxIterations}`,
        history,
      });
      ctx.appendTrace(`🔁 Loop: stop at ${current}/${maxIterations}`);
      return {
        kind: 'stop',
        solution: incoming.solution ?? null,
        solutionSet: incoming.solutionSet ?? null,
      };
    }

    ctx.updateNodeData({
      ...patchPayload,
      iteration: next,
      shouldStop: false,
      status: `continue: ${next}/${maxIterations}`,
      history,
    });
    ctx.appendTrace(`🔁 Loop: Step ${next}`);

    return {
      kind: 'emit',
      idIteration: next,
      maxIterations,
      solution: incoming.solution ?? null,
      solutionSet: incoming.solutionSet ?? null,
    };
  }
}
