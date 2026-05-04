/*
 * Archivo: temperatureAcceptance.ts
 *
 * Que contiene:
 * - Componente temperature-acceptance (SA) de 2 entradas: acepta la mejor solucion
 *   o la peor con probabilidad exp(delta/T) (via Rust 'temperature-acceptance').
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Sincroniza dos caminos y emite la solucion aceptada segun la politica SA.
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { JoinRuntimeComponent, formatCompact, formatScore, solutionScore, toPretty } from '../base';

export class TemperatureAcceptanceComponent extends JoinRuntimeComponent {
  async executeJoin(ctx: ComponentContext, packets: Packet[]): Promise<ExecuteResult> {
    if (packets.length < 2) {
      return { kind: 'wait' };
    }

    const candidate = packets[0].solution as SolutionLike;
    const stored = packets[1].solution as SolutionLike;
    if (!candidate || !stored) {
      return { kind: 'error', message: 'temperatureAcceptance requires two solutions.' };
    }

    const temperatureCurrent = 
      ctx.nodeData.temperatureCurrent ?? ctx.nodeData.temperatureInitial ?? 100;
    const coolingAlpha = ctx.nodeData.coolingAlpha ?? 0.95;

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'temperature-acceptance',
        payload: {
          candidate,
          stored,
          temperatureCurrent,
          coolingAlpha,
        },
      },
    });

    const payload = response.payload as {
      winner?: SolutionLike;
      temperatureCurrent?: number;
      accepted?: boolean;
    };
    const winner = payload.winner as SolutionLike;
    const nextTemp = payload.temperatureCurrent ?? temperatureCurrent;

    ctx.updateNodeData({
      solution: toPretty(winner),
      temperatureCurrent: nextTemp,
      decisionSummary: formatCompact(winner),
    });
    const candScore = formatScore(solutionScore(candidate));
    const storedScore = formatScore(solutionScore(stored));
    ctx.appendTrace(
      `🌡️ Temperature Acceptance (T=${nextTemp.toFixed(3)}): ${candScore} vs ${storedScore}. Accepted: ${formatCompact(winner)}`,
    );

    return {
      kind: 'emit',
      idIteration: packets[0].idIteration,
      solution: winner,
    };
  }
}
