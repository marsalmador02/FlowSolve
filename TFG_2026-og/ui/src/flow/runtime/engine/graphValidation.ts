/*
 * Archivo: graphValidation.ts
 *
 * Que contiene:
 * - Validaciones de estructura previas a la ejecucion del grafo packet-based.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Se ejecuta antes de encolar el primer paquete. Garantiza que el grafo cumple
 *   las precondiciones del motor: start unico valido, loop presente, joins con
 *   dos entradas y storage como una de las entradas de substraction.
 */
import type { FlowEdge, FlowNode, NodeKind } from '../../../types/flow';

function collectIncoming(edges: FlowEdge[], nodeId: string): FlowEdge[] {
  return edges.filter((edge) => edge.target === nodeId);
}

export function validateGraph(nodes: FlowNode[], edges: FlowEdge[]) {
  const errors: string[] = [];

  const starts = nodes.filter((n) => n.data?.start === true && n.type !== 'problem');
  if (starts.length !== 1) {
    errors.push(`Exactly one start node is required (found ${starts.length}).`);
  }

  let startNode: FlowNode | null = null;
  if (starts.length === 1) {
    const candidate = starts[0];
    if (!['singleSolution', 'populationGeneration', 'termination'].includes(candidate.type as NodeKind)) {
      errors.push(
        `Start node must be singleSolution, populationGeneration or termination (got ${candidate.type}).`,
      );
    } else {
      startNode = candidate;
    }
  }

  const ends = nodes.filter((n) => n.data?.end === true && n.type !== 'problem');
  if (ends.length > 1) {
    errors.push(`At most one end node is allowed (found ${ends.length}).`);
  }
  let endNode: FlowNode | null = ends[0] ?? null;
  if (endNode && !['storage', 'termination'].includes(endNode.type as NodeKind)) {
    errors.push(`End node must be storage or termination (got ${endNode.type}).`);
    endNode = null;
  }

  const loopNodes = nodes.filter((n) => n.type === 'termination');
  if (loopNodes.length === 0) {
    errors.push('Graph must contain one Loop (termination) node.');
  } else if (loopNodes.length > 1) {
    errors.push(`Graph must contain exactly one Loop (found ${loopNodes.length}).`);
  }
  const loopNode: FlowNode | null = loopNodes[0] ?? null;

  if (startNode && loopNode && startNode.type !== 'termination') {
    const reaches = edges.some((e) => e.source === startNode!.id && e.target === loopNode.id);
    if (!reaches) {
      errors.push('Start generator must have an outgoing edge into the Loop node.');
    }
  }

  for (const node of nodes) {
    if (node.type === 'substraction') {
      const incoming = collectIncoming(edges, node.id);
      if (incoming.length !== 2) {
        errors.push(`Substraction node ${node.id} requires exactly 2 incoming edges (found ${incoming.length}).`);
        continue;
      }
      const sourceTypes = incoming
        .map((edge) => nodes.find((n) => n.id === edge.source)?.type)
        .filter(Boolean) as NodeKind[];
      if (!sourceTypes.includes('storage')) {
        errors.push(`Substraction node ${node.id} must have one incoming edge from a storage node.`);
      }
    }

    if (node.type === 'acceptance' || node.type === 'temperatureAcceptance') {
      const incoming = collectIncoming(edges, node.id);
      if (incoming.length !== 2) {
        errors.push(`Acceptance node ${node.id} requires exactly 2 incoming edges (found ${incoming.length}).`);
      }
    }

    if (node.type === 'changeNeighborhood') {
      const incoming = collectIncoming(edges, node.id);
      if (incoming.length !== 2) {
        errors.push(`Change Neighborhood node ${node.id} requires exactly 2 incoming edges (found ${incoming.length}).`);
      }
    }
  }

  if (errors.length > 0 || !startNode) {
    return { ok: false, errors };
  }

  return { ok: true, graph: { startNode, endNode, loopNode } };
}
