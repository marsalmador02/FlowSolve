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

export function buildExecutionCsvFromGlobalTrace(params: {
  globalTrace: string[];
  algorithm: string;
  instance: string;
  metricName?: string;
}): string {
  const { globalTrace, algorithm, instance, metricName = 'ObjectiveValue' } = params;

  const rows: ExecutionCsvRow[] = [];
  let executionId = 0;
  let generation = 0;

  for (const rawLine of globalTrace) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith('=== FLOW RUN')) {
      executionId += 1;
      generation = 0;
      continue;
    }

    const stepMatch = line.match(/^🔁\s*Loop:\s*Step\s*(\d+)/i);
    if (stepMatch) {
      generation = Number(stepMatch[1]);
      continue;
    }

    const acceptanceMatch = line.match(/^✅\s*Acceptance:\s*([+-]?\d+(?:\.\d+)?)\s*->/i);
    if (acceptanceMatch && executionId > 0 && generation > 0) {
      rows.push({
        Algorithm: algorithm,
        Instance: instance,
        MetricName: metricName,
        ExecutionId: executionId,
        MetricValue: Number(acceptanceMatch[1]),
        Generation: generation,
      });
    }
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
    ...rows.map((row) =>
      header.map((key) => csvEscape(row[key])).join(','),
    ),
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