// Shared type contracts for flow nodes, edges, and algorithm metadata.
import type { Edge, Node } from 'reactflow';

// Acceptance strategies supported by the acceptance component.
export type AcceptancePolicy = 'bestOnly' | 'improveCurrent' | 'threshold' | 'always';

// Canonical node kinds available in the flow graph.
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
  | 'substraction'
  | 'selectionBest';

// Runtime payload attached to each node in React Flow.
export interface FlowNodeData {
  label: string;
  start?: boolean;
  end?: boolean;
  isRunning?: boolean;
  json?: string;
  solution?: string;
  trace?: string;
  error?: string;

  policy?: AcceptancePolicy;
  threshold?: number;
  temperatureInitial?: number;
  temperatureCurrent?: number;
  temperaturePrevious?: number;
  coolingAlpha?: number;
  alpha?: number;
  effectiveAlpha?: number;
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

// Typed aliases for React Flow primitives used across the project.
export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;
