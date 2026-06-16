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

export interface FlowNodeData {
  label: string;
  start?: boolean;
  end?: boolean;
  isRunning?: boolean;
  json?: string;
  solution?: string;
  trace?: string;
  error?: string;
  temperatureCurrent?: number;

  history?: number[];

  decisionSummary?: string;

  maxIterations?: number;
  iteration?: number;
  shouldStop?: boolean;
  status?: string;

  neighborhoodValue?: number;
  neighborhoodInfo?: string;
  solutionSet?: string;
  setSize?: number;
  maxAttempts?: number;
  maxNeighbors?: number;

  onUpdate?: (patch: Partial<FlowNodeData>) => void;
}

export type FlowNode = Node<FlowNodeData>;
