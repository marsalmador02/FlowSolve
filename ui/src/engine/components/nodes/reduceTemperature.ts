/**
 * reduceTemperature.ts
 * 
 * This module defines the ReduceTemperatureComponent, which is responsible for reducing the
 * temperature parameter in a simulated annealing process. It calculates the next temperature
 * based on the current iteration and updates the node data accordingly.
 */

import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

const TEMPERATURE_MAX = 100;
const MIN_TEMPERATURE = 0.1;

/**
 * ReduceTemperatureComponent is a component that reduces the temperature parameter in a simulated
 * annealing process. It calculates the next temperature based on the current iteration and updates
 * the node data accordingly.
 */
export class ReduceTemperatureComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const accepted = incoming.solution;
    if (!accepted) {
      return { kind: 'error', message: 'reduceTemperature requires a solution as input.' };
    }

    const temperatureCurrent = ctx.nodeData.temperatureCurrent ?? TEMPERATURE_MAX;
    const maxIterations = Math.max(1, incoming.maxIterations ?? ctx.nodeData.maxIterations ?? 10);

    const stepIndex = Math.max(0, (incoming.idIteration ?? 1) - 1);
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
