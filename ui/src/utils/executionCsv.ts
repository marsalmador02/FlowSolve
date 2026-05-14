import type { FlowEdge, FlowNode } from '../types/flow';

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
  if (/[",\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseProblemInstanceName(problemJsonText: string): string {
  try {
    const parsed = JSON.parse(problemJsonText);
    if (parsed && typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
      return parsed.name.trim();
    }
  } catch {
    // ignore
  }
  return 'unknown_instance';
}

export function getProblemInstanceName(problemJsonText: string | undefined): string {
  if (!problemJsonText) return 'unknown_instance';
  return parseProblemInstanceName(problemJsonText);
}

type GraphSignature = {
  nodes: string[];
  edges: string[];
};

function normalizeSignatureList(values: string[]): string[] {
  return [...values].sort();
}

function buildGraphSignature(nodes: FlowNode[], edges: FlowEdge[]): GraphSignature {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  return {
    nodes: normalizeSignatureList(nodes.map((node) => node.type ?? 'unknown')),
    edges: normalizeSignatureList(
      edges.map((edge) => {
        const sourceType = nodeById.get(edge.source)?.type ?? 'unknown';
        const targetType = nodeById.get(edge.target)?.type ?? 'unknown';
        return `${sourceType}->${targetType}`;
      }),
    ),
  };
}

function sameSignature(actual: GraphSignature, expected: GraphSignature): boolean {
  if (actual.nodes.length !== expected.nodes.length || actual.edges.length !== expected.edges.length) {
    return false;
  }
  return actual.nodes.every((value, index) => value === expected.nodes[index])
    && actual.edges.every((value, index) => value === expected.edges[index]);
}

/**
 * Detects the algorithm type by matching the exact graph template signature.
 * The comparison checks the full node multiset and the full edge multiset,
 * so extra nodes, missing nodes, duplicated nodes, or changed wiring do not match.
 * Returns the algorithm name in PascalCase.
 */
function detectAlgorithmFromGraph(nodes: FlowNode[], edges: FlowEdge[]): string {
  const actual = buildGraphSignature(nodes, edges);

  const templateSignatures: Array<{ algorithm: string; signature: GraphSignature }> = [
    {
      algorithm: 'Grasp',
      signature: {
        nodes: normalizeSignatureList([
          'problem',
          'termination',
          'singleSolution',
          'localSearch',
          'storage',
          'acceptance',
        ]),
        edges: normalizeSignatureList([
          'termination->singleSolution',
          'termination->storage',
          'singleSolution->localSearch',
          'localSearch->acceptance',
          'storage->acceptance',
          'acceptance->termination',
        ]),
      },
    },
    {
      algorithm: 'Ils',
      signature: {
        nodes: normalizeSignatureList([
          'problem',
          'termination',
          'singleSolution',
          'perturbation',
          'localSearch',
          'acceptance',
        ]),
        edges: normalizeSignatureList([
          'singleSolution->termination',
          'termination->perturbation',
          'termination->acceptance',
          'perturbation->localSearch',
          'localSearch->acceptance',
          'acceptance->termination',
        ]),
      },
    },
    {
      algorithm: 'Vns',
      signature: {
        nodes: normalizeSignatureList([
          'problem',
          'singleSolution',
          'termination',
          'perturbation',
          'localSearch',
          'acceptance',
          'changeNeighborhood',
        ]),
        edges: normalizeSignatureList([
          'singleSolution->termination',
          'termination->perturbation',
          'termination->acceptance',
          'termination->changeNeighborhood',
          'perturbation->localSearch',
          'localSearch->acceptance',
          'acceptance->changeNeighborhood',
          'changeNeighborhood->termination',
        ]),
      },
    },
    {
      algorithm: 'TabuSearch',
      signature: {
        nodes: normalizeSignatureList([
          'problem',
          'singleSolution',
          'termination',
          'storage',
          'neighborhood',
          'substraction',
          'selectionBest',
        ]),
        edges: normalizeSignatureList([
          'singleSolution->termination',
          'termination->storage',
          'termination->neighborhood',
          'storage->substraction',
          'neighborhood->substraction',
          'substraction->selectionBest',
          'selectionBest->termination',
        ]),
      },
    },
    {
      algorithm: 'SimulatedAnnealing',
      signature: {
        nodes: normalizeSignatureList([
          'problem',
          'singleSolution',
          'termination',
          'storage',
          'perturbation',
          'temperatureAcceptance',
          'reduceTemperature',
        ]),
        edges: normalizeSignatureList([
          'singleSolution->termination',
          'termination->storage',
          'termination->perturbation',
          'storage->temperatureAcceptance',
          'perturbation->temperatureAcceptance',
          'temperatureAcceptance->reduceTemperature',
          'reduceTemperature->termination',
        ]),
      },
    },
    {
      algorithm: 'EvolutionaryAlgorithm',
      signature: {
        nodes: normalizeSignatureList([
          'problem',
          'populationGeneration',
          'termination',
          'selection',
          'crossover',
          'mutation',
        ]),
        edges: normalizeSignatureList([
          'populationGeneration->termination',
          'termination->selection',
          'selection->crossover',
          'crossover->mutation',
          'mutation->termination',
        ]),
      },
    },
  ];

  const matchedTemplate = templateSignatures.find(({ signature }) => sameSignature(actual, signature));
  return matchedTemplate?.algorithm ?? 'Unknown';
}

/**
 * Extracts the history from the END node (either Loop/Termination or Storage).
 * Returns array of metric values to use for the CSV export.
 */
function extractHistoryFromEndNode(nodes: FlowNode[], maxIterations: number): number[] {
  const endNode = nodes.find((n) => n.data.end === true);

  if (!endNode) {
    return [];
  }

  const history = endNode.data.history || [];

  if (history.length > maxIterations) {
    return history.slice(-maxIterations);
  }

  return history;
}

/**
 * Extracts maxIterations from the Loop/Termination node.
 */
function extractMaxIterations(nodes: FlowNode[]): number {
  const terminationNode = nodes.find((n) => n.type === 'termination');
  return terminationNode?.data.maxIterations || 0;
}

export function buildExecutionCsvFromGraph(params: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  instance: string;
}): string {
  const { nodes, edges, instance } = params;

  const algorithm = detectAlgorithmFromGraph(nodes, edges);
  const maxIterations = extractMaxIterations(nodes);
  const history = extractHistoryFromEndNode(nodes, maxIterations);

  const rows: ExecutionCsvRow[] = [];

  for (let i = 0; i < history.length; i++) {
    rows.push({
      Algorithm: algorithm,
      Instance: instance,
      MetricName: 'ObjectiveValue',
      ExecutionId: 1,
      MetricValue: history[i],
      Generation: i + 1,
    });
  }

  const header: (keyof ExecutionCsvRow)[] = [
    'Algorithm',
    'Instance',
    'MetricName',
    'ExecutionId',
    'MetricValue',
    'Generation',
  ];

  return [
    header.join(','),
    ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(',')),
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