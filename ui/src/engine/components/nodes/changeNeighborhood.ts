/**
 * changeNeighborhood.ts
 * 
 * This module defines the ChangeNeighbourhoodComponent, which is responsible for adjusting the
 * neighborhood size in a Variable Neighborhood Search (VNS) algorithm based on the comparison of
 * accepted and baseline solutions. It updates the node data and propagates the new neighborhood
 * size to connected perturbation nodes.
 */

import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { JoinRuntimeComponent, formatCompact, solutionScore, solutionsEqualByVars, toPretty } from '../base';

/**
 * Selects the accepted and baseline packets from the incoming ones, based on the context of the loop.
 * 
 * @param ctx Component context.
 * @param packets Incoming packets.
 * @returns Object containing the accepted and baseline packets.
 */
function selectAcceptedAndBaseline(
  ctx: ComponentContext,
  packets: Packet[],
): { accepted: Packet; baseline: Packet } {
  const loopIds = new Set(
    ctx.getIncomingSources().filter((s) => s.type === 'termination').map((s) => s.id),
  );

  const fromLoop = packets.find((p) => loopIds.has(p.fromId));
  if (fromLoop) {
    const other = packets.find((p) => p !== fromLoop) ?? packets[0];
    return { accepted: other, baseline: fromLoop };
  }

  let isMaximize = false;
  try {
    const rawProblem = (ctx.problem as any)?.raw || ctx.problem;
    if (rawProblem && Array.isArray(rawProblem.goals) && rawProblem.goals.length > 0) {
      const sense = rawProblem.goals[0].sense || '';
      isMaximize = sense.toLowerCase().includes('maximiz');
    }
  } catch {
  }

  const sorted = [...packets].sort((a, b) => {
    const sa = solutionScore(a.solution as SolutionLike);
    const sb = solutionScore(b.solution as SolutionLike);
    return isMaximize ? sb - sa : sa - sb;
  });
  return { accepted: sorted[0], baseline: sorted[1] };
}

/**
 * ChangeNeighbourhoodComponent is a component that adjusts the neighborhood size in a VNS algorithm
 * based on the comparison of accepted and baseline solutions. It updates the node data and propagates
 * the new neighborhood size to connected perturbation nodes.
 */
export class ChangeNeighbourhoodComponent extends JoinRuntimeComponent {
  async executeJoin(ctx: ComponentContext, packets: Packet[]): Promise<ExecuteResult> {
    if (packets.length < 2) {
      return { kind: 'wait' };
    }

    const { accepted, baseline } = selectAcceptedAndBaseline(ctx, packets);
    const acceptedSol = accepted.solution as SolutionLike;
    const baselineSol = baseline.solution as SolutionLike;

    if (!acceptedSol) {
      return { kind: 'error', message: 'changeNeighborhood requires an accepted solution.' };
    }

    const varsLength = Array.isArray(acceptedSol.variableValue)
      ? acceptedSol.variableValue.length
      : 0;
    const maxK = varsLength;
    const currentK = ctx.nodeData.neighborhoodValue ?? 1;

    const sameSolution = solutionsEqualByVars(baselineSol, acceptedSol);
    let nextK: number;
    let info: string;
    if (sameSolution) {
      nextK = Math.min(currentK + 1, maxK);
      info = `No improvement. k = ${currentK} -> k = ${nextK}`;
    } else if (currentK > 1) {
      nextK = 1;
      info = `Improved. Reset k = ${currentK} -> k = 1`;
    } else {
      nextK = 1;
      info = `Improved. Keep k = 1`;
    }

    ctx.updateNodeData({
      solution: toPretty(acceptedSol),
      neighborhoodValue: nextK,
      neighborhoodInfo: info,
    });

    const perturbationNodes = ctx.findNodesByKind('perturbation');
    for (const perturbation of perturbationNodes) {
      ctx.updateNodeDataById(perturbation.id, { neighborhoodValue: nextK });
    }

    ctx.appendTrace(`🔄 Change Neighborhood: ${info} | ${formatCompact(acceptedSol)}`);

    return {
      kind: 'emit',
      idIteration: packets[0].idIteration,
      solution: acceptedSol,
    };
  }
}
