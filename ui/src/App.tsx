/*
 * File: App.tsx
 *
 * Contains:
 * - Main container for the metaheuristics visual editor.
 * - Reactive canvas state: nodes, edges, selection, traces and panels.
 * - Integration with React Flow (render, drag-and-drop, connections, minimap).
 * - Loads component catalog from backend and handles templates.
 * - Bridge to useFlowRunner for executing Run Flow and Run Next Step.
 *
 * Role in the flow (startup -> graph execution):
 * - Receives control from main.tsx and builds the editing experience.
 * - Hydrates the component palette via API and displays the editable canvas.
 * - Triggers graph execution delegating to the execution runtime via useFlowRunner.
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
  NodeChange,
  EdgeChange,
  ReactFlowInstance,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { KNAPSACK_TEMPLATE_JSON } from './constants/problemTemplates';
import { COMPONENT_LABELS } from './constants/flowCatalog';
import { flowNodeTypes } from './components/flowNodes';
import { FlowSidebar } from './components/FlowSidebar';
import { ExecutionPanel } from './components/ExecutionPanel';
import { buildAlgorithmTemplate, type AlgorithmTemplateKey } from './flow/algorithms/algorithmBuilder';
import type { FlowNode, FlowNodeData, NodeKind } from './types/flow';
import { useFlowRunner } from './hooks/useFlowRunner';
import { buildExecutionCsvFromGraph, downloadCsv, getProblemInstanceName } from './utils/executionCsv';

interface StoredTemplate {
  id: string;
  name: string;
  nodes: Array<{ id: string; type: NodeKind; position: { x: number; y: number }; data: FlowNodeData }>;
  edges: Edge[];
}

const CUSTOM_TEMPLATES_STORAGE_KEY = 'prodef.ui.customTemplates';

function downloadFile(fileName: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 200);
}

function loadTemplatesFromStorage(): StoredTemplate[] {
    let existingTemplates = JSON.parse(localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY) as string);

    if (existingTemplates == null) {
      existingTemplates = [];
    }

    return existingTemplates;
}

export default function App() {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [globalTrace, setGlobalTrace] = useState<string[]>([]);
  const [executionHistories, setExecutionHistories] = useState<number[][]>([]);
  const [customTemplates, setCustomTemplates] = useState<StoredTemplate[]>(loadTemplatesFromStorage);
  const algorithmNameRef = useRef('Custom');

  const nodeId = useRef(0);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const nodesRef = useRef<FlowNode[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const activeIterationRef = useRef<number | null>(null);
  const neighborhoodSizeRef = useRef(1);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => {
      localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(customTemplates));
  }, [customTemplates]);

  const generationKinds = ['SingleSolutionGenerationComponent'];
  const modificationKinds = [
    'LocalSearchComponent', 'PerturbationComponent', 'TemperatureAcceptanceComponent', 'ReduceTemperatureComponent',
    'ChangeNeighbourhoodComponent', 'NeighbourhoodComponent', 'SubtractionComponent', 'SelectionOfBestComponent',
  ];
  const otherKinds = ['StorageComponent', 'LoopComponent', 'AcceptanceComponent'];

  const makePaletteItems = (kinds: string[]) =>
    kinds.map((k) => ({ kind: k, label: COMPONENT_LABELS[k as keyof typeof COMPONENT_LABELS] }));

  const generationPaletteItems = makePaletteItems(generationKinds);
  const modificationPaletteItems = makePaletteItems(modificationKinds);
  const otherPaletteItems = makePaletteItems(otherKinds);

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
    appendExecutionHistory: (history: number[]) => {
      if (history.length > 0) {
        setExecutionHistories((prev) => [...prev, [...history]]);
      }
    },
    setNeighborhoodSize: (size) => { neighborhoodSizeRef.current = size; },
  });

  const createDefaultProblemNode = useCallback((): FlowNode => ({
    id: 'problem',
    type: 'problem',
    position: { x: 80, y: 80 },
    connectable: true,
    data: {
      label: COMPONENT_LABELS.Problem,
      start: false,
      end: false,
      trace: '',
      json: KNAPSACK_TEMPLATE_JSON,
      onUpdate: (patch) => updateNodeData('problem', patch),
    },
  }), [updateNodeData]);

  useEffect(() => {
    setNodes((prev) => {
      if (prev.some((n) => n.type === 'problem')) return prev;
      return [createDefaultProblemNode(), ...prev];
    });
  }, [createDefaultProblemNode]);

  const resetFlow = useCallback(() => {
    setGlobalTrace([]);
    setExecutionHistories([]);
    activeIterationRef.current = null;
    setNeighborhoodLevel(1);
    setNodes((prev) => prev.map((node) => {
      const base = { trace: '', error: undefined, isRunning: false };

      if (node.type === 'termination') {
        const max = Math.max(1, Number(node.data.maxIterations ?? 10));
        return { ...node, data: { ...node.data, ...base, iteration: 0, shouldStop: false,
          status: `continue: 0/${max}`, solutionSet: undefined, solution: undefined, history: [] } };
      }
      if (node.type === 'storage') {
        return { ...node, data: { ...node.data, ...base, solutionSet: undefined, solution: undefined, 
          setSize: 0, history: [] } };
      }
      if (node.type === 'temperatureAcceptance' || node.type === 'reduceTemperature') {
        return { ...node, data: { ...node.data, ...base, temperatureCurrent: 100 } };
      }
      return { ...node, data: { ...node.data, ...base } };
    }));
    setSelectedNode(null);
  }, [setNeighborhoodLevel]);

  const runFlowAndKeepTrace = useCallback(async () => {
    activeIterationRef.current = null;
    setNeighborhoodLevel(1);
    setNodes((prev) => prev.map((node) => ({
      ...node, data: { ...node.data, trace: '', error: undefined, isRunning: false },
    })));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await runFlowUntilEnd();
  }, [runFlowUntilEnd, setNeighborhoodLevel]);

  const loadTemplateGraph = useCallback(
    (template: { nodes: FlowNode[]; edges: Edge[]; algorithmName?: string }) => {
      const nodesWithOnUpdate = template.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onUpdate: (patch: Partial<FlowNodeData>) => updateNodeData(node.id, patch),
        },
      }));
      const hasProblem = nodesWithOnUpdate.some((n) => n.type === 'problem');
      const nextNodes = hasProblem ? nodesWithOnUpdate : [createDefaultProblemNode(), ...nodesWithOnUpdate];

      nodeId.current = 0;
      activeIterationRef.current = null;
      algorithmNameRef.current = template.algorithmName ?? 'Custom';
      setNodes(nextNodes);
      setEdges(template.edges);
      setSelectedNode(null);
      setGlobalTrace([]);
      setNeighborhoodLevel(1);
      setTimeout(() => rfInstance.current?.fitView({ duration: 500 }), 60);
    },
    [createDefaultProblemNode, setNeighborhoodLevel, updateNodeData],
  );

  const loadTemplate = useCallback((kind: AlgorithmTemplateKey) => {
    loadTemplateGraph(buildAlgorithmTemplate(kind, updateNodeData));
  }, [loadTemplateGraph, updateNodeData]);

  const KIND_TO_NODE_TYPE: Record<string, NodeKind> = {
    Problem: 'problem',
    SingleSolutionGenerationComponent: 'singleSolution',
    LocalSearchComponent: 'localSearch',
    PerturbationComponent: 'perturbation',
    TemperatureAcceptanceComponent: 'temperatureAcceptance',
    ReduceTemperatureComponent: 'reduceTemperature',
    NeighbourhoodComponent: 'neighborhood',
    ChangeNeighbourhoodComponent: 'changeNeighborhood',
    SubtractionComponent: 'subtraction',
    SelectionOfBestComponent: 'selectionBest',
    StorageComponent: 'storage',
    LoopComponent: 'termination',
    AcceptanceComponent: 'acceptance',
  };

  const createNode = useCallback((kind: string, position: { x: number; y: number }): FlowNode => {
    const type = KIND_TO_NODE_TYPE[kind];
    const id = kind === 'Problem' ? 'problem' : `${type}-${nodeId.current++}`;

    const data: FlowNodeData = {
      label: COMPONENT_LABELS[kind as keyof typeof COMPONENT_LABELS] ?? kind,
      start: false,
      end: false,
      trace: '',
      onUpdate: (patch) => updateNodeData(id, patch),
    };

    if (type === 'problem') data.json = KNAPSACK_TEMPLATE_JSON;
    if (type === 'temperatureAcceptance') data.temperatureCurrent = 100;
    if (type === 'storage') { data.history = []; data.solutionSet = '[]'; data.setSize = 0; }
    if (type === 'termination') { data.maxIterations = 10; data.iteration = 0; data.shouldStop = false; data.status = 'ready'; }
    if (type === 'changeNeighborhood') { data.neighborhoodValue = neighborhoodSizeRef.current; data.neighborhoodInfo = `k=${neighborhoodSizeRef.current}`; }
    if (type === 'neighborhood' || type === 'subtraction') { data.solutionSet = '[]'; data.setSize = 0; }

    return { id, type, position, data, connectable: true };
  }, [updateNodeData]);

  const onInit = useCallback((instance: ReactFlowInstance) => { rfInstance.current = instance; }, []);
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);
  const onSelectionChange = useCallback((selection: { nodes: FlowNode[] }) => {
    setSelectedNode(selection.nodes[0] ?? null);
  }, []);
  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
  }, []);
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/reactflow');
    if (!kind) return;
    if (kind === 'Problem' && nodesRef.current.some((n) => n.type === 'problem')) return;

    const reactFlow = rfInstance.current;
    if (!reactFlow) return;

    const position = reactFlow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    setNodes((nds) => nds.concat(createNode(kind, position)));
  }, [createNode]);

  const onSaveCustomTemplate = useCallback(() => {
    if (nodesRef.current.length === 0) return;
    const name = window.prompt('Template name');
    if (!name) return;

    const snapshot: StoredTemplate = {
      id: `custom-${Date.now()}`,
      name: name,
      nodes: nodesRef.current.map((n) => ({
        id: n.id,
        type: n.type as NodeKind,
        position: n.position,
        data: n.data,
      })),
      edges: edgesRef.current.map((e) => ({ ...e })),
    };
    setCustomTemplates((prev) => [snapshot, ...prev]);
  }, []);

  const onLoadCustomTemplate = useCallback((templateId: string) => {
    const template = customTemplates.find((t) => t.id === templateId);
    if (!template) return;
    const nodesWithOnUpdate: FlowNode[] = template.nodes.map((n) => ({
      id: n.id, type: n.type, position: n.position, connectable: true,
      data: {
        ...n.data,
        onUpdate: (patch: Partial<FlowNodeData>) => updateNodeData(n.id, patch),
      },
    }));
    loadTemplateGraph({ nodes: nodesWithOnUpdate, edges: template.edges });
  }, [customTemplates, loadTemplateGraph, updateNodeData]);

  const onDeleteCustomTemplate = useCallback((templateId: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }, []);

  const onExportCustomTemplate = useCallback((templateId: string) => {
    const template = customTemplates.find((t) => t.id === templateId);
    if (!template) return;

    downloadFile(`template-${template.id}.json`, JSON.stringify(template, null, 2));
  }, [customTemplates]);

  const deleteEverything = useCallback(() => {
    nodeId.current = 0;
    activeIterationRef.current = null;
    setNodes([createDefaultProblemNode()]);
    setEdges([]);
    setSelectedNode(null);
    setGlobalTrace([]);
    setNeighborhoodLevel(1);
  }, [createDefaultProblemNode, setNeighborhoodLevel]);

  const onProblemJsonChange = useCallback((newJson: string) => {
    if (selectedNode?.type === 'problem') {
      updateNodeData(selectedNode.id, { json: newJson });
    }
  }, [selectedNode, updateNodeData]);

  const applyProblemExample = useCallback((exampleJson: string) => {
    const problem = getNodeByType('problem');
    if (!problem) return;

    updateNodeData(problem.id, { json: exampleJson });
  }, [getNodeByType, updateNodeData]);

  const setNodeStart = useCallback((id: string, isStart: boolean) => {
    const validTypes = ['singleSolution', 'termination'];
    setNodes((prev) => prev.map((node) => {
      if (node.id === id && validTypes.includes(node.type as string)) {
        return { ...node, data: { ...node.data, start: isStart } };
      }
      return { ...node, data: { ...node.data, start: isStart ? false : node.data.start } };
    }));
  }, []);

  const setNodeEnd = useCallback((id: string, isEnd: boolean) => {
    const validTypes = ['storage', 'termination'];
    setNodes((prev) => prev.map((node) => {
      if (node.id === id && validTypes.includes(node.type as string)) {
        return { ...node, data: { ...node.data, end: isEnd } };
      }
      return { ...node, data: { ...node.data, end: isEnd ? false : node.data.end } };
    }));
  }, []);

  const onExportTrace = useCallback(() => {
    if (globalTrace.length === 0) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(`trace-${timestamp}.txt`, globalTrace.join('\n'));
  }, [globalTrace]);

  const onExportCsv = useCallback(() => {
    try {
      const problemNode = getNodeByType('problem');
      const instance = getProblemInstanceName(problemNode?.data.json);
      const csv = buildExecutionCsvFromGraph({
        nodes,
        edges,
        instance,
        algorithm: algorithmNameRef.current,
        executionHistories,
      });
      if (!csv) return;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadFile(`metrics-${timestamp}.csv`, csv, 'text/csv;charset=utf-8');
    } catch {
    }
  }, [edges, executionHistories, getNodeByType, nodes]);

  return (
    <div className="app">
      <FlowSidebar
        onLoadGraspTemplate={() => loadTemplate('grasp')}
        onLoadIlsTemplate={() => loadTemplate('ils')}
        onLoadVnsTemplate={() => loadTemplate('vns')}
        onLoadTabuTemplate={() => loadTemplate('tabu')}
        customTemplates={customTemplates}
        onSaveCustomTemplate={onSaveCustomTemplate}
        onLoadCustomTemplate={onLoadCustomTemplate}
        onDeleteCustomTemplate={onDeleteCustomTemplate}
        onExportCustomTemplate={onExportCustomTemplate}
        generationPaletteItems={generationPaletteItems}
        modificationPaletteItems={modificationPaletteItems}
        otherPaletteItems={otherPaletteItems}
      />

      <div className="canvas">
        <div className="canvas-controls">
          <button className="canvas-icon-button" title="Run step" aria-label="Run step"
            onClick={() => { void runFlowNextStep(); }}>
            1x
          </button>
          <button className="canvas-icon-button" title="Run flow" aria-label="Run flow"
            onClick={() => { void runFlowAndKeepTrace(); }}>
            ▶
          </button>
          <button className="canvas-icon-button" title="Reset flow" aria-label="Reset flow"
            onClick={resetFlow}>
            ↻
          </button>
          <button className="canvas-icon-button" title="Delete everything" aria-label="Delete everything"
            onClick={deleteEverything}>
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

        <img className="app-logo" src="/othimi_color.png" alt="Othimi" />

        <ExecutionPanel
          selectedNode={selectedNode}
          selectedData={selectedNode?.data}
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