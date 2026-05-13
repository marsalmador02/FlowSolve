/*
 * Archivo: reduceTemperature.ts
 *
 * Que contiene:
 * - Componente SA que reduce la temperatura linealmente.
 *   Reducción por paso = 100 / maxIterations (p.ej., 10 pasos → 10% cada paso, 100 pasos → 1% cada paso)
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Forwardea la solucion aceptada y reduce la temperatura.
 * - El Loop node propaga maxIterations en la primera iteración.
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
    const maxIterations = ctx.nodeData.maxIterations ?? 10;

    const reduction = TEMPERATURE_MAX / maxIterations;
    const nextTemp = Math.max(MIN_TEMPERATURE, temperatureCurrent - reduction);

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
    const reductionStr = reduction.toFixed(2);
    ctx.appendTrace(
      `❄️ Reduce Temperature: T ${temperatureCurrent.toFixed(2)} - ${reductionStr} = ${tempStr} | ${formatCompact(forwarded)}`,
    );

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solution: forwarded,
    };
  }
}
