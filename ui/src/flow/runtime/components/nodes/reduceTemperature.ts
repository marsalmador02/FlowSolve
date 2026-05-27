/*
 * File: reduceTemperature.ts
 *
 * Contains:
 * - SA node that reduces temperature using a geometric schedule.
 *   It interpolates between T0 = 100 and Tf = 0.1 across maxIterations steps.
 *
 * Role in the flow (startup -> graph execution):
 * - Forwards the accepted solution and reduces the temperature value.
 * - Uses the loop budget forwarded in the packet when available.
 */
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

const TEMPERATURE_MAX = 100;
const MIN_TEMPERATURE = 0.1;

export class ReduceTemperatureComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const accepted = incoming.solution;
    if (!accepted) {
      return { kind: 'error', message: 'reduceTemperature requires a solution as input.' };
    }

    const temperatureCurrent = ctx.nodeData.temperatureCurrent ?? TEMPERATURE_MAX;
    const maxIterations = Math.max(1, incoming.maxIterations ?? ctx.nodeData.maxIterations ?? 10);

    // Determine step index (0-based). Use idIteration-1 so the first step starts at T0.
    const stepIndex = Math.max(0, (incoming.idIteration ?? 1) - 1);
    // Normalized fraction over (maxIterations - 1) so that:
    // - fraction = 0 -> T0
    // - fraction = 1 -> Tf
    const denom = Math.max(1, maxIterations - 1);
    const fraction = Math.min(1, stepIndex / denom);

    const T0 = TEMPERATURE_MAX;
    const Tf = MIN_TEMPERATURE;
    const nextTemp = T0 * Math.pow(Tf / T0, fraction);

    const forwarded = accepted as SolutionLike;

    ctx.updateNodeData({
      solution: toPretty(forwarded),
      temperatureCurrent: nextTemp,
    });

    const tempAcceptanceNodes = ctx.findNodesByKind('temperatureAcceptance');
    for (const node of tempAcceptanceNodes) {
      ctx.updateNodeDataById(node.id, { temperatureCurrent: nextTemp });
    }

    const tempStr = Number.isFinite(nextTemp) ? nextTemp.toFixed(2) : '-';
    ctx.appendTrace(
      `❄️ Reduce Temperature: T ${temperatureCurrent.toFixed(2)} -> ${tempStr} | ${formatCompact(forwarded)}`,
    );

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      maxIterations: incoming.maxIterations,
      solution: forwarded,
    };
  }
}
