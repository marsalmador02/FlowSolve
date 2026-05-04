/*
 * Archivo: crossover.ts
 *
 * Que contiene:
 * - Componente de cruzamiento evolutivo que produce descendencia de una poblacion
 *   de padres (via Rust 'crossover').
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Recibe un solutionSet (padres) y emite un solutionSet (descendencia).
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class CrossoverComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const parents = Array.isArray(incoming.solutionSet) ? (incoming.solutionSet as SolutionLike[]) : [];
    if (parents.length < 2) {
      return { kind: 'error', message: 'crossover requires a population of at least 2 parents.' };
    }

    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: {
        mode: 'crossover',
        payload: {
          parents,
          targetSize: parents.length,
        },
      },
    });

    const payload = response.payload as { offspring: SolutionLike[]; crossoverOperator: string };
    const offspring = Array.isArray(payload.offspring) && payload.offspring.length > 0
      ? payload.offspring
      : parents;

    ctx.updateNodeData({ solutionSet: toPretty(offspring), setSize: offspring.length });
    const op = payload.crossoverOperator ?? 'uniform+repair';
    const lines = [`🧬 Crossover: operator=${op}`];
    offspring.forEach((individual, idx) => {
      lines.push(`      s${idx + 1}: ${formatCompact(individual)}`);
    });
    ctx.appendTrace(lines.join('\n'));

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solutionSet: offspring,
    };
  }
}
