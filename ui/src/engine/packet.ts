/**
 * packet.ts
 * 
 * This file defines the types and interfaces for packets that travel through the workflow graph during
 * execution.
 */

import type { FlowNodeData, NodeKind } from '../types/flow';

/**
 * Represents a solution-like object that can be used as a payload in packets.
 */
export type SolutionLike = {
  problemName?: string;
  isFeasible?: boolean;
  goalValues?: number[];
  variableValue?: unknown;
  [key: string]: unknown;
};

/**
 * Represents a packet that travels through the workflow graph during execution.
 */
export interface Packet {
  idIteration: number;
  maxIterations?: number;
  fromId: string;
  solution?: SolutionLike | null;
  solutionSet?: SolutionLike[] | null;
}

/**
 * Represents a packet that is sent to a node for execution.
 */
export interface IncomingSource {
  id: string;
  type: NodeKind;
}

/**
 * Represents the context provided to a component during its execution.
 */
export interface ComponentContext {
  nodeId: string;
  nodeType: NodeKind;
  nodeData: FlowNodeData;
  problem: unknown;
  updateNodeData: (patch: Partial<FlowNodeData>) => void;
  updateNodeDataById: (nodeId: string, patch: Partial<FlowNodeData>) => void;
  appendTrace: (msg: string) => void;
  getIncomingSources: () => IncomingSource[];
  getOutgoingTargets: () => IncomingSource[];
  findNodesByKind: (kind: NodeKind) => IncomingSource[];
}

/**
 * Represents the result of a single component execution step.
 */
export type ExecuteResult =
  | { kind: 'emit'; solution?: SolutionLike | null; solutionSet?: SolutionLike[] | null; idIteration?: number; maxIterations?: number }
  | { kind: 'wait' }
  | { kind: 'stop'; solution?: SolutionLike | null; solutionSet?: SolutionLike[] | null }
  | { kind: 'error'; message: string };
