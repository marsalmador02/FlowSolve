// Pre-built flow graphs (nodes + edges) for each demo algorithm template.
import { MarkerType } from 'reactflow';
import { COMPONENT_LABELS } from '../constants/flowCatalog';
import { KNAPSACK_TEMPLATE_JSON, TSP_TEMPLATE_JSON } from '../constants/problemTemplates';
import type { FlowEdge, FlowNode, FlowNodeData } from '../types/flow';

type UpdateNodeData = (id: string, patch: Partial<FlowNodeData>) => void;

function mkEdge(id: string, source: string, target: string): FlowEdge {
  return {
    id,
    source,
    target,
    markerEnd: { type: MarkerType.ArrowClosed },
  };
}

function mkUpdater(nodeId: string, updateNodeData: UpdateNodeData) {
  return (patch: Partial<FlowNodeData>) => updateNodeData(nodeId, patch);
}

export function buildGraspTemplate(updateNodeData: UpdateNodeData) {
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
        end: false,
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
        end: true,
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
        policy: 'bestOnly',
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

export function buildIlsTemplate(updateNodeData: UpdateNodeData) {
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
        policy: 'bestOnly',
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

export function buildVnsTemplate(updateNodeData: UpdateNodeData) {
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
        policy: 'bestOnly',
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
      id: 'substraction-template',
      type: 'substraction',
      position: { x: 1410, y: 180 },
      data: {
        label: COMPONENT_LABELS.SubstractionComponent,
        trace: '',
        solutionSet: '[]',
        setSize: 0,
        onUpdate: mkUpdater('substraction-template', updateNodeData),
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
    mkEdge('e-storage-substraction', 'storage-template', 'substraction-template'),
    mkEdge('e-neighborhood-substraction', 'neighborhood-template', 'substraction-template'),
    mkEdge('e-substraction-selection', 'substraction-template', 'selection-template'),
    mkEdge('e-selection-loop', 'selection-template', 'termination-template'),
  ];

  return { nodes, edges };
}

export function buildSimulatedAnnealingTemplate(updateNodeData: UpdateNodeData) {
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
        end: true,
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
        temperatureInitial: 100,
        temperatureCurrent: 100,
        coolingAlpha: 0.95,
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

export function buildEvolutionaryTemplate(updateNodeData: UpdateNodeData) {
  const nodes: FlowNode[] = [
    {
      id: 'problem',
      type: 'problem',
      position: { x: 80, y: 270 },
      data: {
        label: COMPONENT_LABELS.Problem,
        json: KNAPSACK_TEMPLATE_JSON,
        trace: '',
        onUpdate: mkUpdater('problem', updateNodeData),
      },
    },
    {
      id: 'population-template',
      type: 'populationGeneration',
      position: { x: 420, y: 110 },
      data: {
        label: COMPONENT_LABELS.PopulationGenerationComponent,
        trace: '',
        populationSize: 10,
        solutionSet: '[]',
        setSize: 0,
        start: true,
        onUpdate: mkUpdater('population-template', updateNodeData),
      },
    },
    {
      id: 'termination-template',
      type: 'termination',
      position: { x: 760, y: 110 },
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
      id: 'selection-template',
      type: 'selection',
      position: { x: 1090, y: 30 },
      data: {
        label: COMPONENT_LABELS.SelectionComponent,
        trace: '',
        tournamentSize: 3,
        eliteSize: 1,
        solutionSet: '[]',
        setSize: 0,
        onUpdate: mkUpdater('selection-template', updateNodeData),
      },
    },
    {
      id: 'crossover-template',
      type: 'crossover',
      position: { x: 1420, y: 110 },
      data: {
        label: COMPONENT_LABELS.CrossoverComponent,
        trace: '',
        solutionSet: '[]',
        setSize: 0,
        onUpdate: mkUpdater('crossover-template', updateNodeData),
      },
    },
    {
      id: 'mutation-template',
      type: 'mutation',
      position: { x: 1750, y: 110 },
      data: {
        label: COMPONENT_LABELS.MutationComponent,
        trace: '',
        mutationRate: 0.25,
        solutionSet: '[]',
        setSize: 0,
        onUpdate: mkUpdater('mutation-template', updateNodeData),
      },
    },
  ];

  const edges: FlowEdge[] = [
    mkEdge('e-population-loop', 'population-template', 'termination-template'),
    mkEdge('e-loop-selection', 'termination-template', 'selection-template'),
    mkEdge('e-selection-crossover', 'selection-template', 'crossover-template'),
    mkEdge('e-crossover-mutation', 'crossover-template', 'mutation-template'),
    mkEdge('e-mutation-loop', 'mutation-template', 'termination-template'),
  ];

  return { nodes, edges };
}
