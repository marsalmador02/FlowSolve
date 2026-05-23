/*
 * File: populationGenerator.ts
 *
 * Contains:
 * - Node that generates an initial population of solutions.
 *
 * Role in the flow (startup -> graph execution):
 * - Emits a solutionSet ready for evolutionary operators or further processing.
 */
import { callRuntimeExecute } from '../../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

export class PopulationGeneratorComponent extends RuntimeComponent {
  async execute(ctx: ComponentContext, incoming: Packet): Promise<ExecuteResult> {
    const count = ctx.nodeData.populationSize ?? 10;
    const response = await callRuntimeExecute({
      problem: ctx.problem,
      execution: { mode: 'generate-population', payload: { count } },
    });

    const population: SolutionLike[] = Array.isArray(response.population)
      ? (response.population as SolutionLike[]).filter(Boolean)
      : [];

    ctx.updateNodeData({ solutionSet: toPretty(population), setSize: population.length });
    const lines = [`🧬 Population Generator: size=${population.length}`];
    population.forEach((individual, idx) => {
      lines.push(`      s${idx + 1}: ${formatCompact(individual)}`);
    });
    ctx.appendTrace(lines.join('\n'));

    return {
      kind: 'emit',
      idIteration: incoming.idIteration,
      solutionSet: population,
    };
  }
}
