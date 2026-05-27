import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const importedTemplate = {
  id: 'imported-template',
  name: 'Imported template',
  createdAt: '2026-05-24T00:00:00.000Z',
  nodes: [
    {
      id: 'imported-problem',
      type: 'problem',
      position: { x: 40, y: 40 },
      data: {
        label: 'Imported problem',
        json: '{"name":"Imported"}',
      },
    },
    {
      id: 'imported-termination',
      type: 'termination',
      position: { x: 220, y: 40 },
      data: {
        label: 'Imported termination',
        start: false,
        end: false,
      },
    },
  ],
  edges: [
    {
      id: 'imported-edge',
      source: 'imported-problem',
      target: 'imported-termination',
    },
  ],
};

const builtInTemplate = {
  nodes: [
    {
      id: 'grasp-problem',
      type: 'problem',
      position: { x: 40, y: 40 },
      data: {
        label: 'Problem',
        json: '{"name":"GRASP"}',
      },
    },
    {
      id: 'grasp-termination',
      type: 'termination',
      position: { x: 220, y: 40 },
      data: {
        label: 'Termination',
        start: false,
        end: false,
      },
    },
  ],
  edges: [
    {
      id: 'grasp-edge',
      source: 'grasp-problem',
      target: 'grasp-termination',
    },
  ],
};

const appMocks = vi.hoisted(() => ({
  buildAlgorithmTemplate: vi.fn(),
  buildExecutionCsvFromGraph: vi.fn(),
  downloadCsv: vi.fn(),
  getProblemInstanceName: vi.fn(),
  useFlowRunner: vi.fn(),
}));

function createDropEvent(kind: string) {
  return {
    preventDefault: vi.fn(),
    clientX: 160,
    clientY: 120,
    dataTransfer: {
      getData: (key: string) => (key === 'application/reactflow' ? kind : ''),
    },
    target: {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    },
  };
}

// Mocking `reactflow` to test drag-and-drop, node selection and rendering without relying on the actual library.
vi.mock('reactflow', () => ({
  __esModule: true,
  default: (props: any) => {
    const nodes = props.nodes ?? [];
    const terminationNode = nodes.find((node: any) => node.type === 'termination');
    const problemNode = nodes.find((node: any) => node.type === 'problem') ?? nodes[0];

    // Simulate node selection and drag-and-drop by calling the corresponding props callbacks.
    return (
      <div data-testid="reactflow">
        <div data-testid="canvas-nodes">{nodes.map((node: any) => `${node.id}:${node.type}`).join('|')}</div>
        <button type="button" onClick={() => props.onSelectionChange?.({ nodes: problemNode ? [problemNode] : [] })}>
          Select problem node
        </button>
        <button type="button" onClick={() => props.onSelectionChange?.({ nodes: terminationNode ? [terminationNode] : [] })}>
          Select termination node
        </button>
        <button type="button" onClick={() => props.onDrop?.(createDropEvent('SingleSolutionGenerationComponent'))}>
          Drop single solution
        </button>
        {props.children}
      </div>
    );
  },
  addEdge: (connection: any, edges: any[]) => edges.concat(connection),
  applyEdgeChanges: (_changes: any[], edges: any[]) => edges,
  applyNodeChanges: (_changes: any[], nodes: any[]) => nodes,
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  MarkerType: { ArrowClosed: 'ArrowClosed' },
}));

vi.mock('./components/FlowSidebar', () => ({
  __esModule: true,
  FlowSidebar: (props: any) => (
    <aside data-testid="sidebar">
      <button type="button" onClick={props.onLoadGraspTemplate}>Load GRASP Template</button>
      <button type="button" onClick={props.onSaveCustomTemplate}>Save current as template</button>
      <button type="button" onClick={() => props.onImportCustomTemplate(JSON.stringify(importedTemplate))}>Import custom template</button>
      {props.customTemplates.map((template: any) => (
        <div key={template.id}>
          <button type="button" onClick={() => props.onLoadCustomTemplate(template.id)}>Load {template.name}</button>
          <button type="button" onClick={() => props.onExportCustomTemplate(template.id)}>Export {template.name}</button>
          <button type="button" onClick={() => props.onDeleteCustomTemplate(template.id)}>Delete {template.name}</button>
        </div>
      ))}
    </aside>
  ),
}));

vi.mock('./components/FlowInspectorPanel', () => ({
  __esModule: true,
  FlowInspectorPanel: (props: any) => (
    <aside data-testid="inspector">
      {props.selectedNode?.type === 'problem' ? (
        <>
          <textarea aria-label="Problem JSON" value={props.selectedData?.json ?? ''} readOnly />
          <button type="button" onClick={() => props.applyProblemExample('{"preset":"knapsack"}')}>Knapsack</button>
          <button type="button" onClick={() => props.applyProblemExample('{"preset":"tsp"}')}>TSP</button>
          <button type="button" onClick={() => props.applyProblemExample('{"preset":"assignment"}')}>Assignment</button>
        </>
      ) : null}
      {props.selectedNode?.type === 'singleSolution' || props.selectedNode?.type === 'populationGeneration' || props.selectedNode?.type === 'termination' ? (
        <label>
          Start node
          <input
            type="checkbox"
            checked={props.selectedData?.start === true}
            onChange={(event) => props.setNodeStart(props.selectedNode.id, event.target.checked)}
          />
        </label>
      ) : null}
      {props.selectedNode?.type === 'storage' || props.selectedNode?.type === 'termination' ? (
        <label>
          End node
          <input
            type="checkbox"
            checked={props.selectedData?.end === true}
            onChange={(event) => props.setNodeEnd(props.selectedNode.id, event.target.checked)}
          />
        </label>
      ) : null}
      {props.globalTrace.length > 0 ? (
        <>
          <textarea aria-label="Execution Trace" value={props.globalTrace.join('\n')} readOnly />
          <button type="button" onClick={props.onExportTrace}>Export trace as .txt</button>
          <button type="button" onClick={props.onExportCsv}>Export CSV</button>
        </>
      ) : null}
    </aside>
  ),
}));

vi.mock('./hooks/useFlowRunner', () => ({
  __esModule: true,
  useFlowRunner: (args: any) => appMocks.useFlowRunner(args),
}));

vi.mock('./flow/algorithms/algorithmBuilder', () => ({
  __esModule: true,
  buildAlgorithmTemplate: (...args: any[]) => appMocks.buildAlgorithmTemplate(...args),
}));

vi.mock('./utils/executionCsv', () => ({
  __esModule: true,
  buildExecutionCsvFromGraph: (...args: any[]) => appMocks.buildExecutionCsvFromGraph(...args),
  downloadCsv: (...args: any[]) => appMocks.downloadCsv(...args),
  getProblemInstanceName: (...args: any[]) => appMocks.getProblemInstanceName(...args),
}));

import App from './App';

function installBlobUrlMocks() {
  const createObjectURL = vi.fn(() => 'blob:mock');
  const revokeObjectURL = vi.fn();

  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  });

  return { createObjectURL, revokeObjectURL };
}

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    appMocks.buildAlgorithmTemplate.mockReturnValue(builtInTemplate);
    appMocks.buildExecutionCsvFromGraph.mockReturnValue('csv-output');
    appMocks.downloadCsv.mockImplementation(() => undefined);
    appMocks.getProblemInstanceName.mockReturnValue('demo-instance');
    appMocks.useFlowRunner.mockImplementation((args: any) => ({
      getNodeByType: (type: string) => args.nodesRef.current.find((node: any) => node.type === type),
      updateNodeData: (id: string, patch: any) => {
        args.setNodes((prev: any[]) => prev.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)));
        args.setSelectedNode((prev: any) => (prev && prev.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev));
      },
      setNeighborhoodLevel: (nextValue: number) => {
        const normalized = Math.max(1, Math.floor(nextValue));
        args.neighborhoodSizeRef.current = normalized;
        args.setNeighborhoodSize(normalized);
      },
      runFlowUntilEnd: vi.fn(async () => {
        args.setGlobalTrace((prev: string[]) => [...prev, 'step 3', 'step 4']);
        args.appendExecutionHistory([3, 4]);
        return undefined;
      }),
      runFlowNextStep: vi.fn(async () => {
        args.setGlobalTrace((prev: string[]) => [...prev, 'step 1', 'step 2']);
        args.appendExecutionHistory([1, 2]);
        return undefined;
      }),
    }));
  });

  it('loads a built-in template and lets the inspector toggle start/end flags', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas-nodes').textContent).toContain('problem:problem');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load GRASP Template' }));

    await waitFor(() => {
      expect(screen.getByTestId('canvas-nodes').textContent).toContain('grasp-termination:termination');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select termination node' }));

    const startCheckbox = screen.getByLabelText('Start node') as HTMLInputElement;
    const endCheckbox = screen.getByLabelText('End node') as HTMLInputElement;

    expect(startCheckbox.checked).toBe(false);
    expect(endCheckbox.checked).toBe(false);

    fireEvent.click(startCheckbox);
    expect((screen.getByLabelText('Start node') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(endCheckbox);
    expect((screen.getByLabelText('End node') as HTMLInputElement).checked).toBe(true);
  });

  it('resets the graph and then deletes it back to the default problem node', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas-nodes').textContent).toContain('problem:problem');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load GRASP Template' }));
    await waitFor(() => {
      expect(screen.getByTestId('canvas-nodes').textContent).toContain('grasp-termination:termination');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select termination node' }));
    expect(screen.getByLabelText('Start node')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reset flow' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Start node')).toBeNull();
      expect(screen.queryByLabelText('End node')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }));

    await waitFor(() => {
      expect(screen.getByTestId('canvas-nodes').textContent).toBe('problem:problem');
    });
  });

  it('imports, saves and exports templates, and exports trace and CSV', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Saved template');
    const { createObjectURL } = installBlobUrlMocks();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas-nodes').textContent).toContain('problem:problem');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Import custom template' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Load Imported template' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load Imported template' }));

    await waitFor(() => {
      expect(screen.getByTestId('canvas-nodes').textContent).toContain('imported-termination:termination');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save current as template' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export Saved template' })).toBeTruthy();
    });

    const clicksBeforeTemplateExport = clickSpy.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Export Saved template' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy.mock.calls.length).toBeGreaterThan(clicksBeforeTemplateExport);

    fireEvent.click(screen.getByRole('button', { name: 'Run step' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Execution Trace') as HTMLTextAreaElement).value).toContain('step 1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export trace as .txt' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy();
    });

    await waitFor(() => {
      const trace = (screen.getByLabelText('Execution Trace') as HTMLTextAreaElement).value;
      expect(trace).toContain('step 1');
      expect(trace).toContain('step 3');
    });

    const clicksBeforeTraceExport = clickSpy.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Export trace as .txt' }));
    expect(clickSpy.mock.calls.length).toBeGreaterThan(clicksBeforeTraceExport);

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(appMocks.buildExecutionCsvFromGraph).toHaveBeenCalledWith(expect.objectContaining({
      executionHistories: [[1, 2], [3, 4]],
    }));
    expect(appMocks.downloadCsv).toHaveBeenCalledWith(expect.stringMatching(/^prodef-metrics-/), 'csv-output');
    expect(promptSpy).toHaveBeenCalledWith('Template name');
  });
});