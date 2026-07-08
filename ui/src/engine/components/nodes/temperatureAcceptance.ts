/**
 * Temperature Acceptance Component
 *
 * Implements the acceptance rule used by Simulated Annealing. It may accept worse
 * solutions with a probability that depends on the current temperature value.
 */

import { callRuntimeExecute } from '../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { JoinRuntimeComponent, formatCompact, formatScore, solutionScore, toPretty } from '../base';
  
/**
 * Determines if the problem is a maximization problem.
 *
 * @param problem The problem to check.
 * @returns True if the problem is a maximization problem, false otherwise.
 */
function isMaximizeProblem(problem: unknown): boolean {
  try {
    const rawProblem = (problem as any)?.raw || problem;
    if (rawProblem && Array.isArray(rawProblem.goals) && rawProblem.goals.length > 0) {
      const sense = rawProblem.goals[0].sense || '';
      return sense.toLowerCase().includes('maximiz');
    }
  } catch {
  }
  return false;
}

/**
 * Calculates the acceptance probability for a candidate solution compared to a stored solution
 * based on the current temperature and the problem's optimization sense (maximize or minimize).
 *
 * @param problem The problem for which to calculate acceptance probability.
 * @param candidate The candidate solution.
 * @param stored The stored solution.
 * @param temperatureCurrent The current temperature.
 * @returns The acceptance probability.
 */
function acceptanceProbability(problem: unknown, candidate: SolutionLike, stored: SolutionLike, temperatureCurrent: number): number {
  const candidateScore = solutionScore(candidate);
  const storedScore = solutionScore(stored);
  const isMaximize = isMaximizeProblem(problem);
  const delta = isMaximize
    ? storedScore - candidateScore
    : candidateScore - storedScore;

  if (delta <= 0.0) {
    return 1.0;
  }

  const temp = Math.max(temperatureCurrent, 1e-12);
  return Math.exp(-delta / temp);
}

/**
 * TemperatureAcceptanceComponent class implements the acceptance rule for Simulated Annealing.
 * It extends JoinRuntimeComponent and processes packets from perturbation and storage sources.
 */
export class TemperatureAcceptanceComponent extends JoinRuntimeComponent {
  async executeJoin(ctx: ComponentContext, packets: Packet[]): Promise<ExecuteResult> {
    if (packets.length < 2) {
      return { kind: 'wait' };
    }

    const sources = ctx.getIncomingSources();
    const candidateIds = new Set(
      sources.filter((source) => source.type === 'perturbation').map((source) => source.id),
    );
    const storedIds = new Set(
      sources.filter((source) => source.type === 'storage').map((source) => source.id),
    );

    const candidatePacket = packets.find((packet) => candidateIds.has(packet.fromId));
    const storedPacket = packets.find((packet) => storedIds.has(packet.fromId));
    if (!candidatePacket || !storedPacket) {
      return {
        kind: 'error',
        message: 'temperatureAcceptance requires one packet from perturbation and one from storage.',
      };
    }

    const candidate = candidatePacket.solution as SolutionLike;
    const stored = storedPacket.solution as SolutionLike;
    if (!candidate || !stored) {
      return { kind: 'error', message: 'temperatureAcceptance requires two solutions.' };
    }

    const temperatureCurrent = ctx.nodeData.temperatureCurrent ?? 100;

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'temperature-acceptance',
        payload: {
          candidate,
          stored,
          temperatureCurrent,
        },
      },
    });

    const payload = response.payload as {
      winner?: SolutionLike;
      accepted?: boolean;
    };
    const winner = payload.winner;
    if (!winner) {
      return {
        kind: 'error',
        message: 'temperatureAcceptance runtime response is missing winner.',
      };
    }

    ctx.updateNodeData({
      solution: toPretty(winner),
      decisionSummary: formatCompact(winner),
    });
    const candScore = formatScore(solutionScore(candidate));
    const storedScore = formatScore(solutionScore(stored));
    const acceptancePct = (acceptanceProbability(ctx.problem, candidate, stored, temperatureCurrent) * 100).toFixed(1);
    const accepted = payload.accepted ? '✓ Accepted' : '✗ Rejected';
    ctx.appendTrace(
      `🌡️ Temperature Acceptance (T=${temperatureCurrent.toFixed(2)} | p=${acceptancePct}%): candidate=${candScore} | stored=${storedScore} | ${accepted}`,
    );

    return {
      kind: 'emit',
      idIteration: candidatePacket.idIteration,
      maxIterations: candidatePacket.maxIterations ?? storedPacket.maxIterations,
      solution: winner,
    };
  }
}
