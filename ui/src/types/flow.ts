/**
 * Flow Types
 *
 * Contains the shared type definitions used by React Flow, including node types,
 * edge types, execution metadata and algorithm-specific configuration data.
 */

import type { Edge, Node } from 'reactflow';

// Node kinds available in the flow graph.
export type NodeKind =
  | 'problem'
  | 'singleSolution'
  | 'populationGeneration'
  | 'selection'
  | 'crossover'
  | 'mutation'
  | 'localSearch'
  | 'perturbation'
  | 'acceptance'
  | 'temperatureAcceptance'
  | 'reduceTemperature'
  | 'storage'
  | 'termination'
  | 'changeNeighborhood'
  | 'neighborhood'
  | 'subtraction'
  | 'selectionBest';

/**
 * Runtime data associated with a React Flow node.
 *
 * Stores both execution state and algorithm-specific configuration used by the
 * workflow editor.
 */
export interface FlowNodeData {
  label: string;
  start?: boolean;
  end?: boolean;
  isRunning?: boolean;
  json?: string;
  solution?: string;
  trace?: string;
  error?: string;

  threshold?: number;
  temperatureCurrent?: number;
  coolingMode?: 'normal' | 'slow' | 'hold';
  stagnationStreak?: number;

  bestSolution?: string;
  bestScore?: number;
  currentSolution?: string;
  currentScore?: number;
  history?: number[];
  acceptCount?: number;

  decisionSummary?: string;

  maxIterations?: number;
  iteration?: number;
  shouldStop?: boolean;
  status?: string;

  neighborhoodValue?: number;
  neighborhoodInfo?: string;
  solutionSet?: string;
  setSize?: number;
  populationSize?: number;
  tournamentSize?: number;
  eliteSize?: number;
  mutationRate?: number;
  mutationRateExpression?: string;
  neighborhoodExpression?: string;
  maxAttempts?: number;
  maxAttemptsExpression?: string;
  maxNeighbors?: number;
  maxNeighborsExpression?: string;

  onUpdate?: (patch: Partial<FlowNodeData>) => void;
}

// The React Flow node and edge types used in the flow graph.
export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;