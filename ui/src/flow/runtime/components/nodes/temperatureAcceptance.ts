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
    const winner = payload.winner as SolutionLike;

    ctx.updateNodeData({
      solution: toPretty(winner),
      decisionSummary: formatCompact(winner),
    });
    const candScore = formatScore(solutionScore(candidate));
    const storedScore = formatScore(solutionScore(stored));
    const accepted = payload.accepted ? '✓ Accepted' : '✗ Rejected';
    ctx.appendTrace(
      `🌡️ Temperature Acceptance (T=${temperatureCurrent.toFixed(0)}): candidate=${candScore} | stored=${storedScore} | ${accepted}`,
    );

    return {
      kind: 'emit',
      idIteration: candidatePacket.idIteration,
      solution: winner,
    };
  }
}
