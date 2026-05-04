/*
 * Archivo: packet.ts
 *
 * Que contiene:
 * - Tipos canonicos del motor packet-based de ejecucion de grafo.
 * - Estructura del paquete que viaja por las aristas (solution/solutionSet/idIteration).
 * - Tipos de resultado de execute (emit | wait | stop | error).
 * - ComponentContext con dependencias minimas que cada componente necesita.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Todo componente consume un Packet y devuelve un ExecuteResult.
 * - El motor enruta los emits por las aristas salientes y sincroniza joins.
 */
import type { FlowNodeData, NodeKind } from '../../../types/flow';

// Wrap a single solver result coming from Rust (includes score/vars/feasibility).
export type SolutionLike = {
  problemName?: string;
  isFeasible?: boolean;
  goalValues?: number[];
  variableValue?: unknown;
  [key: string]: unknown;
};

// Packet traveling through edges during execution.
export interface Packet {
  // Monotonically increasing id controlled by the loop.
  idIteration: number;
  // Id of the node that emitted this packet ('__boot__' for the very first).
  fromId: string;
  // Single-solution payload (may be absent if solutionSet is used).
  solution?: SolutionLike | null;
  // Population payload (may be absent if solution is used).
  solutionSet?: SolutionLike[] | null;
}

// Identifier of an incoming node (used for join sync and storage detection).
export interface IncomingSource {
  id: string;
  type: NodeKind;
}

// Bundle of capabilities passed to each component execute call.
export interface ComponentContext {
  nodeId: string;
  nodeType: NodeKind;
  nodeData: FlowNodeData;
  problem: unknown;
  updateNodeData: (patch: Partial<FlowNodeData>) => void;
  // Patch any other node in the graph by id (used e.g. by changeNeighborhood
  // to propagate k to perturbation nodes).
  updateNodeDataById: (nodeId: string, patch: Partial<FlowNodeData>) => void;
  appendTrace: (msg: string) => void;
  getIncomingSources: () => IncomingSource[];
  // Nodes reachable through outgoing edges from this component.
  getOutgoingTargets: () => IncomingSource[];
  // Look up every node with the given kind (used for cross-node propagation).
  findNodesByKind: (kind: NodeKind) => IncomingSource[];
}

// Outcome of a single component execution step.
export type ExecuteResult =
  | { kind: 'emit'; solution?: SolutionLike | null; solutionSet?: SolutionLike[] | null; idIteration?: number }
  | { kind: 'wait' }
  | { kind: 'stop'; solution?: SolutionLike | null; solutionSet?: SolutionLike[] | null }
  | { kind: 'error'; message: string };
