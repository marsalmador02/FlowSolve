/*
 * Archivo: App.tsx
 *
 * Que contiene:
 * - Contenedor principal del editor visual de metaheuristicas.
 * - Estado reactivo del canvas: nodos, aristas, seleccion, trazas y paneles.
 * - Integracion de React Flow (render, drag-and-drop, conexiones, minimapa).
 * - Carga de catalogo de componentes desde backend y manejo de templates.
 * - Puente con useFlowRunner para ejecutar Run Flow y Run Next Step.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Recibe el control desde main.tsx y construye toda la experiencia de edicion.
 * - Hidrata la paleta de componentes via API y muestra el lienzo editable.
 * - Dispara la ejecucion del grafo cuando el usuario corre el flujo, delegando
 *   al runtime de ejecucion (graphExecutor) a traves de useFlowRunner.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Connection,
  Edge,
  NodeChange,
  EdgeChange,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { KNAPSACK_TEMPLATE_JSON } from './constants/problemTemplates';
import { COMPONENT_LABELS } from './constants/flowCatalog';
import { flowNodeTypes } from './components/flowNodes';
import { FlowSidebar } from './components/FlowSidebar';
import { FlowInspectorPanel } from './components/FlowInspectorPanel';
import { buildAlgorithmTemplate } from './flow/algorithms/algorithmBuilder';
import type { FlowEdge, FlowNode, FlowNodeData, NodeKind } from './types/flow';
import { useFlowRunner } from './hooks/useFlowRunner';
import { buildExecutionCsvFromGlobalTrace, downloadCsv, getProblemInstanceName } from './utils/executionCsv';

interface StoredTemplateNode {
  id: string;
  type: NodeKind;
  position: { x: number; y: number };
  data: FlowNodeData;
}

interface StoredTemplate {
  id: string;
  name: string;
  createdAt: string;
  nodes: StoredTemplateNode[];
  edges: FlowEdge[];
}

interface SidebarPaletteItem {
  kind: string;
  label: string;
}

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

const CUSTOM_TEMPLATES_STORAGE_KEY = 'prodef.ui.customTemplates';

const EMOJI_BY_SIDEBAR_KIND: Record<string, string> = {
  Problem: '📄',
  SingleSolutionGenerationComponent: '🧪',
  PopulationGenerationComponent: '👥',
  SelectionComponent: '🎯',
  CrossoverComponent: '🧬',
  MutationComponent: '🧫',
  LocalSearchComponent: '🔍',
  PerturbationComponent: '🌪️',
  TemperatureAcceptanceComponent: '🌡️',
  ReduceTemperatureComponent: '❄️',
  ChangeNeighbourhoodComponent: '🧭',
  NeighbourhoodComponent: '🧩',
  SubstractionComponent: '➖',
  SelectionOfBestComponent: '🏆',
  StorageComponent: '📦',
  LoopComponent: '🔁',
  AcceptanceComponent: '✅',
};

function withLeadingEmoji(label: string, sidebarKind: string): string {
  const emoji = EMOJI_BY_SIDEBAR_KIND[sidebarKind];
  if (!emoji) {
    return label;
  }
  const trimmed = label.trim();
  if (!trimmed) {
    return `${emoji} ${sidebarKind}`;
  }
  if (trimmed.startsWith(emoji)) {
    return trimmed;
  }
  return `${emoji} ${trimmed}`;
}

function mapRuntimeKindToSidebarKind(kind: string): string {
  const map: Record<string, string> = {
    singleSolution: 'SingleSolutionGenerationComponent',
    populationGeneration: 'PopulationGenerationComponent',
    localSearch: 'LocalSearchComponent',
    perturbation: 'PerturbationComponent',
    selection: 'SelectionComponent',
    crossover: 'CrossoverComponent',
    mutation: 'MutationComponent',
    acceptance: 'AcceptanceComponent',
    temperatureAcceptance: 'TemperatureAcceptanceComponent',
    reduceTemperature: 'ReduceTemperatureComponent',
    changeNeighborhood: 'ChangeNeighbourhoodComponent',
    neighborhood: 'NeighbourhoodComponent',
    substraction: 'SubstractionComponent',
    selectionBest: 'SelectionOfBestComponent',
    storage: 'StorageComponent',
    termination: 'LoopComponent',
    problem: 'Problem',
  };
  return map[kind] ?? kind;
}

function mapCatalogCategory(category: string): 'generation' | 'modification' | 'other' {
  if (category === 'generation') {
    return 'generation';
  }
  if (category === 'evolutionary' || category === 'improvement') {
    return 'modification';
  }
  return 'other';
}

function sanitizeNodeDataForTemplate(data: FlowNodeData): FlowNodeData {
  const { onUpdate, isRunning, error, trace, ...rest } = data;
  return {
    ...rest,
    trace: '',
    error: undefined,
    isRunning: false,
  };
}

function estimateNextNodeId(nodes: Array<{ id: string }>) {
  let maxId = 0;
  for (const node of nodes) {
    const match = node.id.match(/-(\d+)$/);
    if (!match) {
      continue;
    }
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed >= maxId) {
      maxId = parsed + 1;
    }
  }
  return Math.max(1, maxId);
}

// Top-level React component for the interactive flow builder.
export default function App() {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [globalTrace, setGlobalTrace] = useState<string[]>([]);
  const [neighborhoodSize, setNeighborhoodSize] = useState(1);
  const [customTemplates, setCustomTemplates] = useState<StoredTemplate[]>([]);
  const [generationPaletteItems, setGenerationPaletteItems] = useState<SidebarPaletteItem[]>([]);
  const [modificationPaletteItems, setModificationPaletteItems] = useState<SidebarPaletteItem[]>([]);
  const [otherPaletteItems, setOtherPaletteItems] = useState<SidebarPaletteItem[]>([]);
  const [isCustomTemplatesHydrated, setIsCustomTemplatesHydrated] = useState(false);
  const [executionAlgorithm, setExecutionAlgorithm] = useState('Custom');
  const nodeId = useRef(0);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const nodesRef = useRef<FlowNode[]>([]);
  const edgesRef = useRef<FlowEdge[]>([]);
  const activeIterationRef = useRef<number | null>(null);
  const neighborhoodSizeRef = useRef(1);

  // Keep imperative node access synchronized for async runner operations.
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Keep imperative edge access synchronized for connectivity checks.
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Mirror neighborhood state into a ref consumed by callbacks.
  useEffect(() => {
    neighborhoodSizeRef.current = neighborhoodSize;
  }, [neighborhoodSize]);

  // Load user-defined templates from local storage once on app start.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY);
      if (!raw) {
        setIsCustomTemplatesHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setIsCustomTemplatesHydrated(true);
        return;
      }
      const normalized: StoredTemplate[] = parsed
        .filter((item) => (
          item
          && typeof item.id === 'string'
          && typeof item.name === 'string'
          && Array.isArray(item.nodes)
          && Array.isArray(item.edges)
        ))
        .map((item) => ({
          id: item.id,
          name: item.name,
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
          nodes: item.nodes,
          edges: item.edges,
        }));
      setCustomTemplates(normalized);
    } catch {
      setCustomTemplates([]);
    } finally {
      setIsCustomTemplatesHydrated(true);
    }
  }, []);

  // Persist user-defined templates whenever they change.
  useEffect(() => {
    if (!isCustomTemplatesHydrated) {
      return;
    }
    try {
      window.localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(customTemplates));
    } catch {
      // Ignore persistence errors (quota/privacy mode) and keep in-memory state.
    }
  }, [customTemplates, isCustomTemplatesHydrated]);

  useEffect(() => {
    const generationKinds = ['SingleSolutionGenerationComponent', 'PopulationGenerationComponent'];
    const modificationKinds = [
      'SelectionComponent', 'CrossoverComponent', 'MutationComponent', 'LocalSearchComponent',
      'PerturbationComponent', 'TemperatureAcceptanceComponent', 'ReduceTemperatureComponent',
      'ChangeNeighbourhoodComponent', 'NeighbourhoodComponent', 'SubstractionComponent', 'SelectionOfBestComponent',
    ];
    const otherKinds = ['StorageComponent', 'LoopComponent', 'AcceptanceComponent', 'Problem'];

    const make = (kinds: string[]) => kinds.map((k) => ({ kind: k, label: withLeadingEmoji(COMPONENT_LABELS[k as keyof typeof COMPONENT_LABELS] ?? k, k) }));

    setGenerationPaletteItems(make(generationKinds));
    setModificationPaletteItems(make(modificationKinds));
    setOtherPaletteItems(make(otherKinds));
  }, []);

  const {
    getNodeByType,
    updateNodeData,
    setNeighborhoodLevel,
    runFlowUntilEnd,
    runFlowNextStep,
  } = useFlowRunner({
    nodesRef,
    edgesRef,
    activeIterationRef,
    neighborhoodSizeRef,
    setNodes,
    setSelectedNode,
    setGlobalTrace,
    setNeighborhoodSize,
  });

  const createDefaultProblemNode = useCallback((): FlowNode => {
    const id = 'problem';
    return {
      id,
      type: 'problem',
      position: { x: 80, y: 80 },
      connectable: true,
      data: {
        label: COMPONENT_LABELS.Problem,
        start: false,
        end: false,
        trace: '',
        error: undefined,
        json: KNAPSACK_TEMPLATE_JSON,
        onUpdate: (patch: Partial<FlowNodeData>) => updateNodeData(id, patch),
      },
    };
  }, [updateNodeData]);

  const onExportCsv = useCallback(() => {
    try {
      if (globalTrace.length === 0) {
        return;
      }

      const problemNode = getNodeByType('problem');
      const instance = getProblemInstanceName(problemNode?.data.json);

      const csv = buildExecutionCsvFromGlobalTrace({
        globalTrace,
        algorithm: executionAlgorithm,
        instance,
        metricName: 'ObjectiveValue',
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCsv(`prodef-metrics-${timestamp}.csv`, csv);
    } catch {
      // Ignore export failures silently.
    }
  }, [executionAlgorithm, getNodeByType, globalTrace]);

  // Ensure the editor always starts with one Problem node.
  useEffect(() => {
    setNodes((prev) => {
      if (prev.some((node) => node.type === 'problem')) {
        return prev;
      }
      return [createDefaultProblemNode(), ...prev];
    });
  }, [createDefaultProblemNode]);

  // Connect two nodes by adding an arrowed edge.
  const onConnect = useCallback(
    (connection: Edge | Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          },
          eds
        )
      ),
    []
  );

  // Apply node-level position/selection edits from React Flow.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const filteredChanges = changes.filter((change) => !(change.type === 'remove' && change.id === 'problem'));
    setNodes((nds) => {
      const updated = applyNodeChanges(filteredChanges, nds);
      if (updated.some((node) => node.type === 'problem')) {
        return updated;
      }
      return [createDefaultProblemNode(), ...updated];
    });
  }, [createDefaultProblemNode]);

  // Apply edge-level edits from React Flow.
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // Track current node selection for the properties panel.
  const onSelectionChange = useCallback(({ nodes }: { nodes: FlowNode[] }) => {
    setSelectedNode(nodes[0] ?? null);
  }, []);

  // Enable drag-over behavior for sidebar-to-canvas drops.
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Store React Flow instance to support fitView and imperative actions.
  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstance.current = instance;
  }, []);

  // Create a new graph node with defaults based on the dragged component kind.
  const createNode = useCallback((kind: string, position: { x: number; y: number }): FlowNode => {
    const typeMap: Record<string, NodeKind> = {
      Problem: 'problem',
      SingleSolutionGenerationComponent: 'singleSolution',
      PopulationGenerationComponent: 'populationGeneration',
      SelectionComponent: 'selection',
      CrossoverComponent: 'crossover',
      MutationComponent: 'mutation',
      LocalSearchComponent: 'localSearch',
      PerturbationComponent: 'perturbation',
      TemperatureAcceptanceComponent: 'temperatureAcceptance',
      ReduceTemperatureComponent: 'reduceTemperature',
      NeighbourhoodComponent: 'neighborhood',
      ChangeNeighbourhoodComponent: 'changeNeighborhood',
      SubstractionComponent: 'substraction',
      SelectionOfBestComponent: 'selectionBest',
      StorageComponent: 'storage',
      LoopComponent: 'termination',
      AcceptanceComponent: 'acceptance',
    };

    const type = typeMap[kind] ?? 'problem';
    const id = kind === 'Problem' ? 'problem' : `${type}-${nodeId.current++}`;

    const data: FlowNodeData = {
      label: withLeadingEmoji(COMPONENT_LABELS[kind as keyof typeof COMPONENT_LABELS] ?? kind, kind),
      start: false,
      end: false,
      trace: '',
      error: undefined,
      onUpdate: (patch: Partial<FlowNodeData>) => updateNodeData(id, patch),
    };

    if (type === 'problem') {
      data.json = KNAPSACK_TEMPLATE_JSON;
    }
    if (type === 'acceptance') {
      data.policy = 'bestOnly';
      data.threshold = 0;
    }
    if (type === 'populationGeneration') {
      data.populationSize = 10;
      data.solutionSet = '[]';
      data.setSize = 0;
    }
    if (type === 'selection') {
      data.tournamentSize = 3;
      data.eliteSize = 1;
      data.solutionSet = '[]';
      data.setSize = 0;
    }
    if (type === 'crossover') {
      data.solutionSet = '[]';
      data.setSize = 0;
    }
    if (type === 'mutation') {
      data.mutationRate = 0.25;
      data.solutionSet = '[]';
      data.setSize = 0;
    }
    if (type === 'temperatureAcceptance') {
      data.temperatureCurrent = 100;
    }
    if (type === 'storage') {
      data.history = [];
      data.acceptCount = 0;
      data.solutionSet = '[]';
      data.setSize = 0;
    }
    if (type === 'termination') {
      data.maxIterations = 10;
      data.iteration = 0;
      data.shouldStop = false;
      data.status = 'ready';
    }
    if (type === 'changeNeighborhood') {
      data.neighborhoodValue = neighborhoodSizeRef.current;
      data.neighborhoodInfo = `k=${neighborhoodSizeRef.current}`;
    }
    if (type === 'neighborhood' || type === 'substraction') {
      data.solutionSet = '[]';
      data.setSize = 0;
    }

    return {
      id,
      type,
      position,
      data,
      connectable: true,
    };
  }, [updateNodeData, neighborhoodSizeRef]);

  // Handle dropping a component kind onto the canvas and append a new node.
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const reactFlowBounds = (event.target as HTMLElement).getBoundingClientRect();
      const kind = event.dataTransfer.getData('application/reactflow');
      if (!kind) {
        return;
      }

      if (kind === 'Problem' && nodesRef.current.some((n) => n.type === 'problem')) {
        return;
      }

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      setNodes((nds) => nds.concat(createNode(kind, position)));
    },
    [createNode]
  );

  const loadTemplateGraph = useCallback(
    (template: { nodes: FlowNode[]; edges: FlowEdge[] }, algorithmName = 'Custom') => {
      const hasProblem = template.nodes.some((node) => node.type === 'problem');
      const nextNodes = hasProblem ? template.nodes : [createDefaultProblemNode(), ...template.nodes];

      nodeId.current = estimateNextNodeId(nextNodes);
      activeIterationRef.current = null;
      setNodes(nextNodes);
      setEdges(template.edges);
      setSelectedNode(null);
      setGlobalTrace([]);
      setExecutionAlgorithm(algorithmName);
      setNeighborhoodLevel(1);
      setTimeout(() => rfInstance.current?.fitView({ duration: 300, padding: 0.2 }), 60);
    },
    [createDefaultProblemNode, setNeighborhoodLevel],
  );

  const loadGraspTemplate = useCallback(() => {
    const template = buildAlgorithmTemplate('grasp', updateNodeData);
    loadTemplateGraph(template, 'GRASP');
  }, [loadTemplateGraph, updateNodeData]);

  const loadIlsTemplate = useCallback(() => {
    const template = buildAlgorithmTemplate('ils', updateNodeData);
    loadTemplateGraph(template, 'ILS');
  }, [loadTemplateGraph, updateNodeData]);

  const loadVnsTemplate = useCallback(() => {
    const template = buildAlgorithmTemplate('vns', updateNodeData);
    loadTemplateGraph(template, 'VNS');
  }, [loadTemplateGraph, updateNodeData]);

  const loadTabuTemplate = useCallback(() => {
    const template = buildAlgorithmTemplate('tabu', updateNodeData);
    loadTemplateGraph(template, 'Tabu Search');
  }, [loadTemplateGraph, updateNodeData]);

  const loadSaTemplate = useCallback(() => {
    const template = buildAlgorithmTemplate('simulatedAnnealing', updateNodeData);
    loadTemplateGraph(template, 'Simulated Annealing');
  }, [loadTemplateGraph, updateNodeData]);

  const loadEvolutionaryTemplate = useCallback(() => {
    const template = buildAlgorithmTemplate('evolutionary', updateNodeData);
    loadTemplateGraph(template, 'Evolutionary');
  }, [loadTemplateGraph, updateNodeData]);

  const onSaveCustomTemplate = useCallback(() => {
    if (nodesRef.current.length === 0) {
      return;
    }

    const name = window.prompt('Template name');
    if (!name || name.trim().length === 0) {
      return;
    }

    const savedNodes: StoredTemplateNode[] = nodesRef.current.map((node) => ({
      id: node.id,
      type: node.type as NodeKind,
      position: node.position,
      data: sanitizeNodeDataForTemplate(node.data),
    }));
    const savedEdges: FlowEdge[] = edgesRef.current.map((edge) => ({ ...edge }));

    const snapshot: StoredTemplate = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      nodes: savedNodes,
      edges: savedEdges,
    };

    setCustomTemplates((prev) => [snapshot, ...prev]);
  }, []);

  const onLoadCustomTemplate = useCallback((templateId: string) => {
    const template = customTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    const reboundNodes: FlowNode[] = template.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      connectable: true,
      data: {
        ...node.data,
        trace: '',
        error: undefined,
        isRunning: false,
        onUpdate: (patch: Partial<FlowNodeData>) => updateNodeData(node.id, patch),
      },
    }));

    const reboundEdges: FlowEdge[] = template.edges.map((edge) => ({ ...edge }));
    loadTemplateGraph({ nodes: reboundNodes, edges: reboundEdges }, 'Custom');
  }, [customTemplates, loadTemplateGraph, updateNodeData]);

  const onDeleteCustomTemplate = useCallback((templateId: string) => {
    setCustomTemplates((prev) => prev.filter((item) => item.id !== templateId));
  }, []);

  const onExportCustomTemplate = useCallback((templateId: string) => {
    try {
      const template = customTemplates.find((item) => item.id === templateId);
      if (!template) {
        return;
      }

      const safeName = template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      downloadTextFile(`prodef-template-${safeName || template.id}.json`, JSON.stringify(template, null, 2));
    } catch {
      // Ignore export failures silently.
    }
  }, [customTemplates]);

  const onExportTrace = useCallback(() => {
    try {
      if (globalTrace.length === 0) {
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`prodef-trace-${timestamp}.txt`, globalTrace.join('\n'));
    } catch {
      // Ignore export failures silently.
    }
  }, [globalTrace]);

  const onImportCustomTemplate = useCallback((rawJson: string) => {
    try {
      const parsed = JSON.parse(rawJson);
      if (
        !parsed
        || typeof parsed.id !== 'string'
        || typeof parsed.name !== 'string'
        || !Array.isArray(parsed.nodes)
        || !Array.isArray(parsed.edges)
      ) {
        return;
      }

      const imported: StoredTemplate = {
        id: parsed.id,
        name: parsed.name,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
        nodes: parsed.nodes,
        edges: parsed.edges,
      };

      setCustomTemplates((prev) => {
        const existingById = new Map(prev.map((t) => [t.id, t]));
        existingById.set(imported.id, imported);
        return Array.from(existingById.values());
      });
    } catch {
      // Ignore malformed import content.
    }
  }, []);

  const deleteEverything = useCallback(() => {
    nodeId.current = 0;
    activeIterationRef.current = null;
    setNodes([createDefaultProblemNode()]);
    setEdges([]);
    setSelectedNode(null);
    setGlobalTrace([]);
    setExecutionAlgorithm('Custom');
    setNeighborhoodLevel(1);
  }, [createDefaultProblemNode, setNeighborhoodLevel]);

  // Update the JSON payload for the selected problem node.
  const onProblemJsonChange = useCallback(
    (newJson: string) => {
      if (!selectedNode || selectedNode.type !== 'problem') {
        return;
      }
      updateNodeData(selectedNode.id, { json: newJson });
    },
    [selectedNode, updateNodeData]
  );

  // Apply a predefined example JSON into the problem node.
  const applyProblemExample = useCallback((exampleJson: string) => {
    const problem = getNodeByType('problem');
    if (!problem) {
      return;
    }
    updateNodeData(problem.id, { json: exampleJson, error: undefined });
    setSelectedNode((prev) => {
      if (!prev || prev.id !== problem.id) {
        return problem;
      }
      return { ...prev, data: { ...prev.data, json: exampleJson, error: undefined } };
    });
  }, [getNodeByType, updateNodeData]);

  const setNodeStart = useCallback((id: string, isStart: boolean) => {
    setNodes((prev) => prev.map((node) => {
      if (node.type === 'problem') {
        return { ...node, data: { ...node.data, start: false } };
      }
      const isValidStart = node.type === 'singleSolution' || node.type === 'populationGeneration' || node.type === 'termination';
      if (node.id === id && isValidStart) {
        return { ...node, data: { ...node.data, start: isStart } };
      }
      return { ...node, data: { ...node.data, start: isStart ? false : node.data.start } };
    }));

    setSelectedNode((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev.id === id) {
        return { ...prev, data: { ...prev.data, start: isStart } };
      }
      if (isStart) {
        return { ...prev, data: { ...prev.data, start: false } };
      }
      return prev;
    });
  }, [setNodes]);

  const setNodeEnd = useCallback((id: string, isEnd: boolean) => {
    setNodes((prev) => prev.map((node) => {
      if (node.type === 'problem') {
        return { ...node, data: { ...node.data, end: false } };
      }
      const isValidEnd = node.type === 'storage' || node.type === 'termination';
      if (node.id === id && isValidEnd) {
        return { ...node, data: { ...node.data, end: isEnd } };
      }
      return { ...node, data: { ...node.data, end: isEnd ? false : node.data.end } };
    }));

    setSelectedNode((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev.id === id) {
        return { ...prev, data: { ...prev.data, end: isEnd } };
      }
      if (isEnd) {
        return { ...prev, data: { ...prev.data, end: false } };
      }
      return prev;
    });
  }, [setNodes]);

  const resetFlow = useCallback(() => {
    setGlobalTrace([]);
    setExecutionAlgorithm('Custom');
    activeIterationRef.current = null;
    setNeighborhoodLevel(1);
    setNodes((prev) => prev.map((node) => {
      const baseData: Partial<typeof node.data> = {
        trace: '',
        error: undefined,
        isRunning: false,
      };

      if (node.type === 'termination') {
        const maxIterations = Math.max(1, Number(node.data.maxIterations ?? 10));
        return {
          ...node,
          data: {
            ...node.data,
            ...baseData,
            iteration: 0,
            shouldStop: false,
            status: `continue: 0/${maxIterations}`,
            solutionSet: undefined,
            solution: undefined,
          },
        };
      }

      if (node.type === 'storage') {
        return {
          ...node,
          data: {
            ...node.data,
            ...baseData,
            history: [],
            acceptCount: 0,
            solutionSet: '[]',
            setSize: 0,
            currentSolution: undefined,
            currentScore: undefined,
            bestSolution: undefined,
            bestScore: undefined,
            solution: undefined,
          },
        };
      }

      if (node.type === 'populationGeneration' || node.type === 'selection' || node.type === 'crossover' || node.type === 'mutation' || node.type === 'neighborhood' || node.type === 'substraction') {
        return {
          ...node,
          data: {
            ...node.data,
            ...baseData,
            solutionSet: '[]',
            setSize: 0,
            solution: undefined,
          },
        };
      }

      if (node.type === 'acceptance' || node.type === 'temperatureAcceptance' || node.type === 'selectionBest' || node.type === 'localSearch' || node.type === 'perturbation' || node.type === 'singleSolution') {
        return {
          ...node,
          data: {
            ...node.data,
            ...baseData,
            solution: undefined,
            decisionSummary: undefined,
            temperatureCurrent: undefined,
          },
        };
      }

      if (node.type === 'changeNeighborhood') {
        return {
          ...node,
          data: {
            ...node.data,
            ...baseData,
            neighborhoodValue: 1,
            neighborhoodInfo: 'run start -> k=1',
          },
        };
      }

      if (node.type === 'reduceTemperature') {
        return {
          ...node,
          data: {
            ...node.data,
            ...baseData,
            solution: undefined,
            temperatureCurrent: undefined,
            temperatureInitial: undefined,
            temperaturePrevious: undefined,
            alpha: undefined,
          },
        };
      }

      if (node.type === 'problem') {
        return {
          ...node,
          data: {
            ...node.data,
            ...baseData,
          },
        };
      }

      return {
        ...node,
        data: {
          ...node.data,
          ...baseData,
        },
      };
    }));
    setSelectedNode(null);
  }, [setNeighborhoodLevel]);

  // Convenience alias for selected node data used by the properties panel.
  const selectedData = selectedNode?.data;

  return (
    <div className="app">
      <FlowSidebar
        onLoadGraspTemplate={loadGraspTemplate}
        onLoadIlsTemplate={loadIlsTemplate}
        onLoadVnsTemplate={loadVnsTemplate}
        onLoadTabuTemplate={loadTabuTemplate}
        onLoadSaTemplate={loadSaTemplate}
        onLoadEvolutionaryTemplate={loadEvolutionaryTemplate}
        customTemplates={customTemplates}
        onSaveCustomTemplate={onSaveCustomTemplate}
        onLoadCustomTemplate={onLoadCustomTemplate}
        onDeleteCustomTemplate={onDeleteCustomTemplate}
        onExportCustomTemplate={onExportCustomTemplate}
        onImportCustomTemplate={onImportCustomTemplate}
        generationPaletteItems={generationPaletteItems}
        modificationPaletteItems={modificationPaletteItems}
        otherPaletteItems={otherPaletteItems}
      />

      <div className="canvas">
        <div className="canvas-controls">
          <button className="canvas-icon-button" title="Run step" aria-label="Run step" onClick={() => { void runFlowNextStep(); }}>
            1x
          </button>
          <button className="canvas-icon-button" title="Run flow" aria-label="Run flow" onClick={() => { resetFlow(); void runFlowUntilEnd(); }}>
            ▶
          </button>
          <button className="canvas-icon-button" title="Reset flow" aria-label="Reset flow" onClick={resetFlow}>
            ↻
          </button>
          <button className="canvas-icon-button" title="Delete everything" aria-label="Delete everything" onClick={deleteEverything}>
            🗑️
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={flowNodeTypes}
          onInit={onInit}
          onSelectionChange={onSelectionChange}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background color="#aaa" gap={16} />
        </ReactFlow>

        <FlowInspectorPanel
          selectedNode={selectedNode}
          selectedData={selectedData}
          globalTrace={globalTrace}
          setNodeStart={setNodeStart}
          setNodeEnd={setNodeEnd}
          onProblemJsonChange={onProblemJsonChange}
          applyProblemExample={applyProblemExample}
          onExportTrace={onExportTrace}
          onExportCsv={onExportCsv}
        />
      </div>
    </div>
  );
}
