/*
 * Archivo: reduceTemperature.ts
 *
 * Que contiene:
 * - Componente SA que reduce la temperatura actual aplicando la tasa de
 *   enfriamiento con politica local equivalente al runtime Rust.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Forwardea la solucion aceptada actualizando el estado de temperatura.
 */
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class ReduceTemperatureComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const accepted = incoming.solution;
    if (!accepted) {
      return { kind: 'error', message: 'reduceTemperature requires a solution as input.' };
    }

    const coolingAlpha = ctx.nodeData.coolingAlpha ?? 0.95;
    const temperatureCurrentRaw = ctx.nodeData.temperatureCurrent ?? ctx.nodeData.temperatureInitial ?? 100;
    const temperatureCurrent = Math.min(100, temperatureCurrentRaw);
    const alpha = Math.min(0.999, Math.max(0.9, coolingAlpha));
    const stagnationStreakRaw = ctx.nodeData.stagnationStreak ?? 0;
    const stagnationStreak = Math.max(0, Math.floor(stagnationStreakRaw));

    const coolingMode = stagnationStreak >= 3
      ? (stagnationStreak % 5 === 0 ? 'hold' : 'slow')
      : 'normal';
    const effectiveAlpha = coolingMode === 'hold' ? 1 : (coolingMode === 'slow' ? Math.min(0.999, alpha + 0.02) : alpha);
    const nextTemp = coolingMode === 'hold'
      ? temperatureCurrent
      : Math.max(0, temperatureCurrent * effectiveAlpha);
    const forwarded = accepted as SolutionLike;

    ctx.updateNodeData({
      solution: toPretty(forwarded),
      temperatureCurrent: nextTemp,
      temperaturePrevious: temperatureCurrent,
      alpha,
      effectiveAlpha,
      coolingMode,
    });

    const tempAcceptanceNodes = ctx.findNodesByKind('temperatureAcceptance');
    for (const node of tempAcceptanceNodes) {
      ctx.updateNodeDataById(node.id, { temperatureCurrent: nextTemp });
    }

    const tempStr = Number.isFinite(nextTemp) ? nextTemp.toFixed(3) : '-';
    ctx.appendTrace(
      `❄️ Reduce Temperature (${coolingMode}): T ${temperatureCurrent.toFixed(3)} -> ${tempStr} | ${formatCompact(forwarded)}`,
    );

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solution: forwarded,
    };
  }
}
