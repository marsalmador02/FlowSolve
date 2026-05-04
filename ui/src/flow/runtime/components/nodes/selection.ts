/*
 * Archivo: selection.ts
 *
 * Que contiene:
 * - Componente de seleccion evolutiva (elite + tournament) que opera sobre una
 *   poblacion de soluciones (via Rust 'selection').
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Recibe un solutionSet y emite otro solutionSet de igual tamano con los seleccionados.
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class SelectionComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const input = incoming.solutionSet as SolutionLike[];
    if (input.length === 0) {
      return { kind: 'error', message: 'selection requires a non-empty population.' };
    }

    const eliteSize = ctx.nodeData.eliteSize ?? 1;
    const tournamentSize = ctx.nodeData.tournamentSize ?? 3;

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'selection',
        payload: {
          candidates: input,
          targetSize: input.length,
          eliteSize,
          tournamentSize,
        },
      },
    });

    const payload = response.payload as { selected?: SolutionLike[] };
    const selected = Array.isArray(payload.selected) && payload.selected.length > 0
      ? payload.selected
      : input;

    ctx.updateNodeData({ solutionSet: toPretty(selected), setSize: selected.length });
    const lines = [`🎯 Selection: elite=${eliteSize}, strategy=tournament(${tournamentSize})`];
    selected.forEach((individual, idx) => {
      lines.push(`      s${idx + 1}: ${formatCompact(individual)}`);
    });
    ctx.appendTrace(lines.join('\n'));

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solutionSet: selected,
    };
  }
}
