/*
 * Archivo: mutation.ts
 *
 * Que contiene:
 * - Componente de mutacion evolutiva que aplica variaciones sobre una poblacion
 *   con tasa configurable (via Rust 'mutation').
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Recibe un solutionSet y emite un solutionSet mutado del mismo tamano.
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class MutationComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const input = incoming.solutionSet as SolutionLike[];
    if (input.length === 0) {
      return { kind: 'error', message: 'mutation requires a non-empty population.' };
    }

    const mutationRate = ctx.nodeData.mutationRate ?? 0.1;

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'mutation',
        payload: {
          incomingSet: input,
          mutationRate,
          mutationRateExpression: ctx.nodeData.mutationRateExpression,
        },
      },
    });

    const payload = response.payload as { mutated?: SolutionLike[]; mutationOperator?: string; elitePreserved?: number };
    const mutated = Array.isArray(payload.mutated) && payload.mutated.length > 0
      ? payload.mutated
      : input;

    ctx.updateNodeData({ solutionSet: toPretty(mutated), setSize: mutated.length });
    const op = payload.mutationOperator ?? 'bit-flip+repair';
    const elitePreserved = payload.elitePreserved ?? 0;
    const lines = [`🧫 Mutation: rate=${mutationRate}, operator=${op}, elitePreserved=${elitePreserved}`];
    mutated.forEach((individual, idx) => {
      lines.push(`      s${idx + 1}: ${formatCompact(individual)}`);
    });
    ctx.appendTrace(lines.join('\n'));

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solutionSet: mutated,
    };
  }
}
