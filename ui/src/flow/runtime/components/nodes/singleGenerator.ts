/*
 * Archivo: singleGenerator.ts
 *
 * Que contiene:
 * - Componente que genera UNA solucion aleatoria factible via Rust (mode 'generate').
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Solo se usa cuando esta marcado como start: al arrancar, produce el seed inicial
 *   que luego viaja al loop conectado.
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class SingleGeneratorComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: { mode: 'generate' },
    });

    if (!response.result) {
      return { kind: 'error', message: 'Runtime generate returned no result.' };
    }

    ctx.updateNodeData({ solution: toPretty(response.result) });
    ctx.appendTrace(`🧪 Single Solution Generator: ${formatCompact(response.result as SolutionLike)}`);

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solution: response.result as SolutionLike,
    };
  }
}
