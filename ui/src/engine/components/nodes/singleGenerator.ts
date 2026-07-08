/**
 * singleGenerator.ts
 * 
 * This module defines the SingleGeneratorComponent, which is responsible for generating a single
 * solution using the runtime API. It updates the node data with the generated solution.
 */

import { callRuntimeExecute } from '../../../services/prodefApi';
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../packet';
import { RuntimeComponent, formatCompact, toPretty } from '../base';

/**
 * SingleGeneratorComponent is a component that generates a single solution using the runtime API. It
 * updates the node data with the generated solution and appends a trace message.
 */
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
