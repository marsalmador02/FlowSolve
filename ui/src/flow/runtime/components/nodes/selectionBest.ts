/*
 * Archivo: selectionBest.ts
 *
 * Que contiene:
 * - Componente que recibe un set y devuelve la mejor solucion (via Rust 'select-best').
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Convierte un paquete con solutionSet en un paquete con solution unica.
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class SelectionBestComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const candidates = Array.isArray(incoming.solutionSet)
      ? (incoming.solutionSet as SolutionLike[])
      : incoming.solution
        ? [incoming.solution as SolutionLike]
        : [];

    if (candidates.length === 0) {
      return { kind: 'error', message: 'selectionBest received empty input.' };
    }

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'select-best',
        payload: { candidates: candidates },
      },
    });

    const winner = (response.payload as { winner?: SolutionLike })?.winner ?? candidates[0];
    ctx.updateNodeData({ solution: toPretty(winner) });
    ctx.appendTrace(`🏆 Selection Best: ${formatCompact(winner)}`);

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solution: winner,
    };
  }
}
