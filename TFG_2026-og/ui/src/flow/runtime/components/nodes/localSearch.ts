/*
 * Archivo: localSearch.ts
 *
 * Que contiene:
 * - Componente que genera vecinos de una solucion y se queda con el mejor (via Rust 'local-search').
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Mejora la solucion entrante usando la estructura de vecindad apropiada al tipo
 *   de problema (bit-flip o swap segun runtime Rust).
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, solutionScore, toPretty } from '../base';

export class LocalSearchComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const base = incoming.solution as SolutionLike;
    const vector = Array.isArray(base?.variableValue) ? (base?.variableValue as number[]) : null;
    if (!vector) {
      return { kind: 'error', message: 'localSearch requires a solution with variableValue[].' };
    }

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'local-search',
        payload: { solution: vector, steps: 100 },
      },
    });

    if (!response.result) {
      return { kind: 'error', message: 'Runtime local-search returned no result.' };
    }

    const improved = response.result as SolutionLike;
    ctx.updateNodeData({ solution: toPretty(improved) });

    const baseScore = solutionScore(base);
    const outScore = solutionScore(improved);
    const delta = outScore - baseScore;
    const sign = delta > 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0);
    ctx.appendTrace(
      `🔍 LocalSearch: baseline = ${formatCompact(base)}\n      Best move: ${formatCompact(improved)} (Δ${sign})`,
    );

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solution: improved,
    };
  }
}
