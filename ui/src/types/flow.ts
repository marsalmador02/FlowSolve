/**
 * flow.ts
 *
 * This file contains type definitions for the flow graph used in the workflow editor.
 */

import type { Edge, Node } from 'reactflow';

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
 * FlowNodeData defines the structure of the data associated with each node in the flow graph.
 * It includes properties for algorithm parameters, current state, and callbacks for updating the node's
 * data.
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

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;