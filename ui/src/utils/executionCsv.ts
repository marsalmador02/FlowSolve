import type { FlowNode } from '../types/flow';
import { Edge } from 'reactflow';

export interface ExecutionCsvRow {
  Algorithm: string;
  Instance: string;
  MetricName: string;
  ExecutionId: number;
  MetricValue: number;
  Generation: number;
}

function csvEscape(value: string | number): string {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function getProblemInstanceName(problemJsonText: string | undefined): string {
  if (!problemJsonText) return 'unknown_instance';
  try {
    const parsed = JSON.parse(problemJsonText);
    if (parsed && typeof parsed.name === 'string' && parsed.name.trim()) {
      return parsed.name.trim();
    }
  } catch {
    // Fall through.
  }
  return 'unknown_instance';
}

export function buildExecutionCsvFromGraph(params: {
  nodes: FlowNode[];
  edges: Edge[];
  instance: string;
  algorithm: string;
  executionHistories?: number[][];
}): string {
  const { instance, algorithm, executionHistories } = params;

  const terminationNode = params.nodes.find((n) => n.type === 'termination');
  const maxIterations = terminationNode?.data.maxIterations ?? 0;

  let histories = executionHistories ?? [];
  if (histories.length === 0) {
    const endNode = params.nodes.find((n) => n.data.end === true);
    const history = endNode?.data.history ?? [];
    const trimmed = history.length > maxIterations ? history.slice(-maxIterations) : history;
    histories = trimmed.length > 0 ? [trimmed as number[]] : [];
  }

  const rows: ExecutionCsvRow[] = [];
  histories.forEach((history, execIdx) => {
    history.forEach((value, genIdx) => {
      rows.push({
        Algorithm: algorithm,
        Instance: instance,
        MetricName: 'ObjectiveValue',
        ExecutionId: execIdx + 1,
        MetricValue: value,
        Generation: genIdx + 1,
      });
    });
  });

  const header: (keyof ExecutionCsvRow)[] = [
    'Algorithm', 'Instance', 'MetricName', 'ExecutionId', 'MetricValue', 'Generation',
  ];

  return [
    header.join(','),
    ...rows.map((row) => header.map((k) => csvEscape(row[k])).join(',')),
  ].join('\n');
}

export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob(['\ufeff', csvText], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}