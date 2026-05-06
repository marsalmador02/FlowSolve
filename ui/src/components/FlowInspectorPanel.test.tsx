import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ASSIGNMENT_COMPLEX_TEMPLATE_JSON,
  ASSIGNMENT_TEMPLATE_JSON,
  KNAPSACK_COMPLEX_TEMPLATE_JSON,
  KNAPSACK_TEMPLATE_JSON,
  TSP_COMPLEX_TEMPLATE_JSON,
  TSP_TEMPLATE_JSON,
} from '../constants/problemTemplates';
import type { FlowNode } from '../types/flow';
import { FlowInspectorPanel } from './FlowInspectorPanel';

function makeNode(id: string, type: FlowNode['type'], label: string): FlowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label },
  };
}

describe('FlowInspectorPanel', () => {
  it('loads concrete problem examples and propagates JSON edits', () => {
    const applyProblemExample = vi.fn();
    const onProblemJsonChange = vi.fn();

    render(
      <FlowInspectorPanel
        selectedNode={makeNode('problem-1', 'problem', 'Problem')}
        selectedData={{ label: 'Problem', json: '{"existing":true}' }}
        globalTrace={[]}
        setNodeStart={vi.fn()}
        setNodeEnd={vi.fn()}
        onProblemJsonChange={onProblemJsonChange}
        applyProblemExample={applyProblemExample}
        onExportTrace={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Knapsack' }));
    expect(applyProblemExample).toHaveBeenCalledWith(KNAPSACK_TEMPLATE_JSON);

    fireEvent.click(screen.getByRole('button', { name: 'Complex knapsack' }));
    expect(applyProblemExample).toHaveBeenCalledWith(KNAPSACK_COMPLEX_TEMPLATE_JSON);

    fireEvent.click(screen.getByRole('button', { name: 'TSP' }));
    expect(applyProblemExample).toHaveBeenCalledWith(TSP_TEMPLATE_JSON);

    fireEvent.click(screen.getByRole('button', { name: 'Complex TSP' }));
    expect(applyProblemExample).toHaveBeenCalledWith(TSP_COMPLEX_TEMPLATE_JSON);

    fireEvent.click(screen.getByRole('button', { name: 'Assignment' }));
    expect(applyProblemExample).toHaveBeenCalledWith(ASSIGNMENT_TEMPLATE_JSON);

    fireEvent.click(screen.getByRole('button', { name: 'Complex Assignment' }));
    expect(applyProblemExample).toHaveBeenCalledWith(ASSIGNMENT_COMPLEX_TEMPLATE_JSON);

    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(editor.value).toBe('{"existing":true}');

    fireEvent.change(editor, { target: { value: '{"updated":false}' } });
    expect(onProblemJsonChange).toHaveBeenCalledWith('{"updated":false}');
  });

  it('exposes start and end flags for loop-capable nodes', () => {
    const setNodeStart = vi.fn();
    const setNodeEnd = vi.fn();

    render(
      <FlowInspectorPanel
        selectedNode={makeNode('termination-1', 'termination', 'Termination')}
        selectedData={{ label: 'Termination', start: true, end: false }}
        globalTrace={[]}
        setNodeStart={setNodeStart}
        setNodeEnd={setNodeEnd}
        onProblemJsonChange={vi.fn()}
        applyProblemExample={vi.fn()}
        onExportTrace={vi.fn()}
      />,
    );

    const startCheckbox = screen.getByLabelText('Start node') as HTMLInputElement;
    const endCheckbox = screen.getByLabelText('End node') as HTMLInputElement;

    expect(startCheckbox.checked).toBe(true);
    expect(endCheckbox.checked).toBe(false);

    fireEvent.click(startCheckbox);
    expect(setNodeStart).toHaveBeenCalledWith('termination-1', false);

    fireEvent.click(endCheckbox);
    expect(setNodeEnd).toHaveBeenCalledWith('termination-1', true);
  });

  it('shows execution trace output and export action when trace data exists', () => {
    const onExportTrace = vi.fn();

    render(
      <FlowInspectorPanel
        selectedNode={makeNode('storage-1', 'storage', 'Storage')}
        selectedData={{ label: 'Storage', end: true }}
        globalTrace={['step 1', 'step 2']}
        setNodeStart={vi.fn()}
        setNodeEnd={vi.fn()}
        onProblemJsonChange={vi.fn()}
        applyProblemExample={vi.fn()}
        onExportTrace={onExportTrace}
      />,
    );

    const traceTextarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(traceTextarea.value).toBe('step 1\nstep 2');
    fireEvent.click(screen.getByRole('button', { name: 'Export trace as .txt' }));
    expect(onExportTrace).toHaveBeenCalledTimes(1);
  });
});
