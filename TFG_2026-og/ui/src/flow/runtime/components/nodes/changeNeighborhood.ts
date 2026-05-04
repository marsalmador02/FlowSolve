/*
 * Archivo: changeNeighborhood.ts
 *
 * Que contiene:
 * - Componente VNS que ajusta k comparando dos paquetes con el mismo idIteration.
 *   Si ambas soluciones son iguales (por variableValue) -> k se incrementa.
 *   Si difieren -> k se resetea a 1 (si previamente se habia incrementado).
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Sincroniza baseline (desde loop) y accepted (desde acceptance u otro camino).
 * - Propaga el valor de k resultante a los nodos perturbation para que el numero
 *   de bit-flips/swaps en la siguiente iteracion escale con el vecindario.
 * - Re-emite la solucion accepted (la mejor del ciclo) hacia el siguiente componente.
 */
import type { ComponentContext, ExecuteResult, Packet, SolutionLike } from '../../engine/packet';
import { JoinRuntimeComponent, formatCompact, solutionScore, solutionsEqualByVars, toPretty } from '../base';

// Helper to select accepted and baseline packets from the incoming ones, based on the context of the loop.
function selectAcceptedAndBaseline(
  ctx: ComponentContext,
  packets: Packet[],
): { accepted: Packet; baseline: Packet } {
  const loopIds = new Set(
    ctx.getIncomingSources().filter((s) => s.type === 'termination').map((s) => s.id),
  );

  const fromLoop = packets.find((p) => loopIds.has(p.fromId));
  if (fromLoop) {
    const other = packets.find((p) => p !== fromLoop) ?? packets[0];
    return { accepted: other, baseline: fromLoop };
  }

  const sorted = [...packets].sort((a, b) => {
    const sa = solutionScore(a.solution as SolutionLike);
    const sb = solutionScore(b.solution as SolutionLike);
    return sb - sa;
  });
  return { accepted: sorted[0], baseline: sorted[1] };
}

export class ChangeNeighborhoodComponent extends JoinRuntimeComponent {
  async executeJoin(ctx: ComponentContext, packets: Packet[]): Promise<ExecuteResult> {
    if (packets.length < 2) {
      return { kind: 'wait' };
    }

    const { accepted, baseline } = selectAcceptedAndBaseline(ctx, packets);
    const acceptedSol = accepted.solution as SolutionLike;
    const baselineSol = baseline.solution as SolutionLike;

    if (!acceptedSol) {
      return { kind: 'error', message: 'changeNeighborhood requires an accepted solution.' };
    }

    const varsLength = Array.isArray(acceptedSol.variableValue)
      ? acceptedSol.variableValue.length
      : 0;
    const maxK = varsLength;
    const currentK = ctx.nodeData.neighborhoodValue ?? 1;

    const sameSolution = solutionsEqualByVars(baselineSol, acceptedSol);
    let nextK: number;
    let info: string;
    if (sameSolution) {
      nextK = Math.min(currentK + 1, maxK);
      info = `No improvement. k = ${currentK} -> k = ${nextK}`;
    } else if (currentK > 1) {
      nextK = 1;
      info = `Improved. Reset k = ${currentK} -> k = 1`;
    } else {
      nextK = 1;
      info = `Improved. Keep k = 1`;
    }

    ctx.updateNodeData({
      solution: toPretty(acceptedSol),
      neighborhoodValue: nextK,
      neighborhoodInfo: info,
    });

    const perturbationNodes = ctx.findNodesByKind('perturbation');
    for (const perturbation of perturbationNodes) {
      ctx.updateNodeDataById(perturbation.id, { neighborhoodValue: nextK });
    }

    ctx.appendTrace(`🔄 Change Neighborhood: ${info} | ${formatCompact(acceptedSol)}`);

    return {
      kind: 'emit',
      idIteration: packets[0].idIteration,
      solution: acceptedSol,
    };
  }
}
