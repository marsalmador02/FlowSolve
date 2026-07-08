/**
 * flowTemplates.ts
 * 
 * This file defines the templates for various algorithms, including GRASP, ILS, VNS, Tabu Search 
 * and Simulated Annealing. Each template consists of a set of nodes and edges that represent the
 * workflow of the algorithm.
 */

import { MarkerType } from 'reactflow';
import { COMPONENT_LABELS } from '../constants/flowCatalog';
import { KNAPSACK_TEMPLATE_JSON, TSP_TEMPLATE_JSON } from '../constants/problemTemplates';
import type { FlowEdge, FlowNode, FlowNodeData } from '../types/flow';

export type UpdateNodeData = (id: string, patch: Partial<FlowNodeData>) => void;

/**
 * Creates a new flow edge with the specified properties.
 * 
 * @param id The unique identifier for the edge.
 * @param source The ID of the source node.
 * @param target The ID of the target node.
 * @returns A new flow edge.
 */
function mkEdge(id: string, source: string, target: string): FlowEdge {
  return { id, source, target, markerEnd: { type: MarkerType.ArrowClosed } };
}

/**
 * Creates an updater function for a specific node that applies a patch to its data.
 * 
 * @param nodeId The ID of the node to update.
 * @param updateNodeData The function to call to update the node's data.
 * @returns A function that takes a patch and applies it to the node's data.
 */
function mkUpdater(nodeId: string, updateNodeData: UpdateNodeData) {
  return (patch: Partial<FlowNodeData>) => updateNodeData(nodeId, patch);
}

/**
 * Builds the GRASP algorithm template with its nodes and edges.
 * 
 * @param updateNodeData The function to update node data.
 * @returns An object containing the nodes and edges of the GRASP template.
 */
export function buildGRASPTemplate(updateNodeData: UpdateNodeData) {
  const nodes: FlowNode[] = [
    {
      id: 'problem',
      type: 'problem',
      position: { x: 80, y: 240 },
      data: {
        label: COMPONENT_LABELS.Problem,
        json: KNAPSACK_TEMPLATE_JSON,
        trace: '',
        onUpdate: mkUpdater('problem', updateNodeData),
      },
    },
    {
      id: 'termination-template',
      type: 'termination',
      position: { x: 370, y: 80 },
      data: {
        label: COMPONENT_LABELS.LoopComponent,
        trace: '',
        maxIterations: 10,
        iteration: 0,
        shouldStop: false,
        start: true,
        end: true,
        status: 'ready',
        onUpdate: mkUpdater('termination-template', updateNodeData),
      },
    },
    {
      id: 'single-template',
      type: 'singleSolution',
      position: { x: 690, y: 80 },
      data: {
        label: COMPONENT_LABELS.SingleSolutionGenerationComponent,
        trace: '',
        onUpdate: mkUpdater('single-template', updateNodeData),
      },
    },
    {
      id: 'local-template',
      type: 'localSearch',
      position: { x: 1010, y: 30 },
      data: {
        label: COMPONENT_LABELS.LocalSearchComponent,
        trace: '',
        onUpdate: mkUpdater('local-template', updateNodeData),
      },
    },
    {
      id: 'storage-template',
      type: 'storage',
      position: { x: 690, y: 340 },
      data: {
        label: COMPONENT_LABELS.StorageComponent,
        trace: '',
        history: [],
        acceptCount: 0,
        end: false,
        onUpdate: mkUpdater('storage-template', updateNodeData),
      },
    },
    {
      id: 'acceptance-template',
      type: 'acceptance',
      position: { x: 1320, y: 210 },
      data: {
        label: COMPONENT_LABELS.AcceptanceComponent,
        trace: '',
        threshold: 0,
        onUpdate: mkUpdater('acceptance-template', updateNodeData),
      },
    },
  ];

  const edges: FlowEdge[] = [
    mkEdge('e-term-single', 'termination-template', 'single-template'),
    mkEdge('e-term-storage', 'termination-template', 'storage-template'),
    mkEdge('e-single-local', 'single-template', 'local-template'),
    mkEdge('e-local-acceptance', 'local-template', 'acceptance-template'),
    mkEdge('e-storage-acceptance', 'storage-template', 'acceptance-template'),
    mkEdge('e-acceptance-term', 'acceptance-template', 'termination-template'),
  ];

  return { nodes, edges };
}

/**
 * Builds the ILS algorithm template with its nodes and edges.
 * 
 * @param updateNodeData The function to update node data.
 * @returns An object containing the nodes and edges of the ILS template.
 */
export function buildILSTemplate(updateNodeData: UpdateNodeData) {
  const nodes: FlowNode[] = [
    {
      id: 'problem',
      type: 'problem',
      position: { x: 80, y: 240 },
      data: {
        label: COMPONENT_LABELS.Problem,
        json: TSP_TEMPLATE_JSON,
        trace: '',
        onUpdate: mkUpdater('problem', updateNodeData),
      },
    },
    {
      id: 'termination-template',
      type: 'termination',
      position: { x: 420, y: 120 },
      data: {
        label: COMPONENT_LABELS.LoopComponent,
        trace: '',
        maxIterations: 10,
        iteration: 0,
        shouldStop: false,
        end: true,
        status: 'ready',
        onUpdate: mkUpdater('termination-template', updateNodeData),
      },
    },
    {
      id: 'single-template',
      type: 'singleSolution',
      position: { x: 760, y: 40 },
      data: {
        label: COMPONENT_LABELS.SingleSolutionGenerationComponent,
        trace: '',
        start: true,
        onUpdate: mkUpdater('single-template', updateNodeData),
      },
    },
    {
      id: 'perturbation-template',
      type: 'perturbation',
      position: { x: 760, y: 290 },
      data: {
        label: COMPONENT_LABELS.PerturbationComponent,
        trace: '',
        onUpdate: mkUpdater('perturbation-template', updateNodeData),
      },
    },
    {
      id: 'local-template',
      type: 'localSearch',
      position: { x: 1090, y: 290 },
      data: {
        label: COMPONENT_LABELS.LocalSearchComponent,
        trace: '',
        onUpdate: mkUpdater('local-template', updateNodeData),
      },
    },
    {
      id: 'acceptance-template',
      type: 'acceptance',
      position: { x: 1410, y: 170 },
      data: {
        label: COMPONENT_LABELS.AcceptanceComponent,
        trace: '',
        threshold: 0,
        onUpdate: mkUpdater('acceptance-template', updateNodeData),
      },
    },
  ];

  const edges: FlowEdge[] = [
    mkEdge('e-single-loop', 'single-template', 'termination-template'),
    mkEdge('e-loop-perturbation', 'termination-template', 'perturbation-template'),
    mkEdge('e-loop-acceptance', 'termination-template', 'acceptance-template'),
    mkEdge('e-perturbation-local', 'perturbation-template', 'local-template'),
    mkEdge('e-local-acceptance', 'local-template', 'acceptance-template'),
    mkEdge('e-acceptance-loop', 'acceptance-template', 'termination-template'),
  ];

  return { nodes, edges };
}

/**
 * Builds the VNS algorithm template with its nodes and edges.
 *
 * @param updateNodeData The function to update node data.
 * @returns An object containing the nodes and edges of the VNS template.
 */
export function buildVNSTemplate(updateNodeData: UpdateNodeData) {
  const nodes: FlowNode[] = [
    {
      id: 'problem',
      type: 'problem',
      position: { x: 80, y: 250 },
      data: {
        label: COMPONENT_LABELS.Problem,
        json: KNAPSACK_TEMPLATE_JSON,
        trace: '',
        onUpdate: mkUpdater('problem', updateNodeData),
      },
    },
    {
      id: 'single-template',
      type: 'singleSolution',
      position: { x: 430, y: 40 },
      data: {
        label: COMPONENT_LABELS.SingleSolutionGenerationComponent,
        trace: '',
        start: true,
        onUpdate: mkUpdater('single-template', updateNodeData),
      },
    },
    {
      id: 'termination-template',
      type: 'termination',
      position: { x: 760, y: 130 },
      data: {
        label: COMPONENT_LABELS.LoopComponent,
        trace: '',
        maxIterations: 10,
        iteration: 0,
        shouldStop: false,
        end: true,
        status: 'ready',
        onUpdate: mkUpdater('termination-template', updateNodeData),
      },
    },
    {
      id: 'perturbation-template',
      type: 'perturbation',
      position: { x: 1080, y: 40 },
      data: {
        label: COMPONENT_LABELS.PerturbationComponent,
        trace: '',
        onUpdate: mkUpdater('perturbation-template', updateNodeData),
      },
    },
    {
      id: 'local-template',
      type: 'localSearch',
      position: { x: 1380, y: 40 },
      data: {
        label: COMPONENT_LABELS.LocalSearchComponent,
        trace: '',
        onUpdate: mkUpdater('local-template', updateNodeData),
      },
    },
    {
      id: 'acceptance-template',
      type: 'acceptance',
      position: { x: 1380, y: 250 },
      data: {
        label: COMPONENT_LABELS.AcceptanceComponent,
        trace: '',
        threshold: 0,
        onUpdate: mkUpdater('acceptance-template', updateNodeData),
      },
    },
    {
      id: 'neighborhood-template',
      type: 'changeNeighborhood',
      position: { x: 1080, y: 310 },
      data: {
        label: COMPONENT_LABELS.ChangeNeighbourhoodComponent,
        trace: '',
        neighborhoodValue: 1,
        neighborhoodInfo: 'k=1',
        onUpdate: mkUpdater('neighborhood-template', updateNodeData),
      },
    },
  ];

  const edges: FlowEdge[] = [
    mkEdge('e-single-loop', 'single-template', 'termination-template'),
    mkEdge('e-loop-perturbation', 'termination-template', 'perturbation-template'),
    mkEdge('e-loop-acceptance', 'termination-template', 'acceptance-template'),
    mkEdge('e-loop-neighborhood', 'termination-template', 'neighborhood-template'),
    mkEdge('e-perturbation-local', 'perturbation-template', 'local-template'),
    mkEdge('e-local-acceptance', 'local-template', 'acceptance-template'),
    mkEdge('e-acceptance-neighborhood', 'acceptance-template', 'neighborhood-template'),
    mkEdge('e-neighborhood-loop', 'neighborhood-template', 'termination-template'),
  ];

  return { nodes, edges };
}

/**
 * Builds the Tabu Search algorithm template with its nodes and edges.
 *
 * @param updateNodeData The function to update node data.
 * @returns An object containing the nodes and edges of the Tabu Search template.
 */
export function buildTabuTemplate(updateNodeData: UpdateNodeData) {
  const nodes: FlowNode[] = [
    {
      id: 'problem',
      type: 'problem',
      position: { x: 80, y: 250 },
      data: {
        label: COMPONENT_LABELS.Problem,
        json: KNAPSACK_TEMPLATE_JSON,
        trace: '',
        onUpdate: mkUpdater('problem', updateNodeData),
      },
    },
    {
      id: 'single-template',
      type: 'singleSolution',
      position: { x: 420, y: 60 },
      data: {
        label: COMPONENT_LABELS.SingleSolutionGenerationComponent,
        trace: '',
        start: true,
        onUpdate: mkUpdater('single-template', updateNodeData),
      },
    },
    {
      id: 'termination-template',
      type: 'termination',
      position: { x: 750, y: 150 },
      data: {
        label: COMPONENT_LABELS.LoopComponent,
        trace: '',
        maxIterations: 10,
        iteration: 0,
        shouldStop: false,
        end: false,
        status: 'ready',
        onUpdate: mkUpdater('termination-template', updateNodeData),
      },
    },
    {
      id: 'storage-template',
      type: 'storage',
      position: { x: 1080, y: 300 },
      data: {
        label: COMPONENT_LABELS.StorageComponent,
        trace: '',
        history: [],
        acceptCount: 0,
        solutionSet: '[]',
        setSize: 0,
        end: true,
        onUpdate: mkUpdater('storage-template', updateNodeData),
      },
    },
    {
      id: 'neighborhood-template',
      type: 'neighborhood',
      position: { x: 1080, y: 70 },
      data: {
        label: COMPONENT_LABELS.NeighbourhoodComponent,
        trace: '',
        solutionSet: '[]',
        setSize: 0,
        onUpdate: mkUpdater('neighborhood-template', updateNodeData),
      },
    },
    {
      id: 'subtraction-template',
      type: 'subtraction',
      position: { x: 1410, y: 180 },
      data: {
        label: COMPONENT_LABELS.SubtractionComponent,
        trace: '',
        solutionSet: '[]',
        setSize: 0,
        onUpdate: mkUpdater('subtraction-template', updateNodeData),
      },
    },
    {
      id: 'selection-template',
      type: 'selectionBest',
      position: { x: 1740, y: 180 },
      data: {
        label: COMPONENT_LABELS.SelectionOfBestComponent,
        trace: '',
        onUpdate: mkUpdater('selection-template', updateNodeData),
      },
    },
  ];

  const edges: FlowEdge[] = [
    mkEdge('e-single-loop', 'single-template', 'termination-template'),
    mkEdge('e-loop-storage', 'termination-template', 'storage-template'),
    mkEdge('e-loop-neighborhood', 'termination-template', 'neighborhood-template'),
    mkEdge('e-storage-subtraction', 'storage-template', 'subtraction-template'),
    mkEdge('e-neighborhood-subtraction', 'neighborhood-template', 'subtraction-template'),
    mkEdge('e-subtraction-selection', 'subtraction-template', 'selection-template'),
    mkEdge('e-selection-loop', 'selection-template', 'termination-template'),
  ];

  return { nodes, edges };
}

/**
 * Builds the Simulated Annealing algorithm template with its nodes and edges.
 *
 * @param updateNodeData The function to update node data.
 * @returns An object containing the nodes and edges of the Simulated Annealing template.
 */
export function buildSATemplate(updateNodeData: UpdateNodeData) {
  const nodes: FlowNode[] = [
    {
      id: 'problem',
      type: 'problem',
      position: { x: 80, y: 240 },
      data: {
        label: COMPONENT_LABELS.Problem,
        json: KNAPSACK_TEMPLATE_JSON,
        trace: '',
        onUpdate: mkUpdater('problem', updateNodeData),
      },
    },
    {
      id: 'single-template',
      type: 'singleSolution',
      position: { x: 420, y: 60 },
      data: {
        label: COMPONENT_LABELS.SingleSolutionGenerationComponent,
        trace: '',
        start: true,
        onUpdate: mkUpdater('single-template', updateNodeData),
      },
    },
    {
      id: 'termination-template',
      type: 'termination',
      position: { x: 760, y: 140 },
      data: {
        label: COMPONENT_LABELS.LoopComponent,
        trace: '',
        maxIterations: 10,
        iteration: 0,
        shouldStop: false,
        end: true,
        status: 'ready',
        onUpdate: mkUpdater('termination-template', updateNodeData),
      },
    },
    {
      id: 'storage-template',
      type: 'storage',
      position: { x: 1080, y: 300 },
      data: {
        label: COMPONENT_LABELS.StorageComponent,
        trace: '',
        history: [],
        acceptCount: 0,
        end: false,
        onUpdate: mkUpdater('storage-template', updateNodeData),
      },
    },
    {
      id: 'perturbation-template',
      type: 'perturbation',
      position: { x: 1080, y: 60 },
      data: {
        label: COMPONENT_LABELS.PerturbationComponent,
        trace: '',
        onUpdate: mkUpdater('perturbation-template', updateNodeData),
      },
    },
    {
      id: 'temperature-acceptance-template',
      type: 'temperatureAcceptance',
      position: { x: 1410, y: 170 },
      data: {
        label: COMPONENT_LABELS.TemperatureAcceptanceComponent,
        trace: '',
        temperatureCurrent: 100,
        onUpdate: mkUpdater('temperature-acceptance-template', updateNodeData),
      },
    },
    {
      id: 'reduce-temperature-template',
      type: 'reduceTemperature',
      position: { x: 1730, y: 170 },
      data: {
        label: COMPONENT_LABELS.ReduceTemperatureComponent,
        trace: '',
        onUpdate: mkUpdater('reduce-temperature-template', updateNodeData),
      },
    },
  ];

  const edges: FlowEdge[] = [
    mkEdge('e-single-loop', 'single-template', 'termination-template'),
    mkEdge('e-loop-storage', 'termination-template', 'storage-template'),
    mkEdge('e-loop-perturbation', 'termination-template', 'perturbation-template'),
    mkEdge('e-storage-temp-acceptance', 'storage-template', 'temperature-acceptance-template'),
    mkEdge('e-perturbation-temp-acceptance', 'perturbation-template', 'temperature-acceptance-template'),
    mkEdge('e-temp-acceptance-reduce', 'temperature-acceptance-template', 'reduce-temperature-template'),
    mkEdge('e-reduce-loop', 'reduce-temperature-template', 'termination-template'),
  ];

  return { nodes, edges };
}