import React from 'react';
import { Handle, Position, type NodeTypes } from 'reactflow';
import type { FlowNodeData } from '../types/flow';

function nodeClassName(data: FlowNodeData) {
  return data.isRunning ? 'custom-node custom-node-running' : 'custom-node';
}

function NodeBadge({ show, label, className }: { show?: boolean; label: string; className: string }) {
  return show ? <span className={className}>{label}</span> : null;
}

function ErrorText({ error }: { error?: string }) {
  return error ? <div className="error-text">{error}</div> : null;
}

// Renders the score and variable values for a single solution stored as a JSON string.
function SolutionSummary({ solution }: { solution?: string }) {
  if (!solution) return null;
  try {
    const parsed = JSON.parse(solution);
    const score = parsed.goalValues.reduce((acc: number, v: number) => acc + v, 0);
    const vars = JSON.stringify(parsed.variableValue);
    return (
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Objective value</span>
          <span className="solution-summary-value">{score}</span>
        </div>
        <div className="solution-summary-row">
          <span className="solution-summary-key">Solution</span>
          <span className="solution-summary-value">{vars}</span>
        </div>
      </div>
    );
  } catch {
    return <div className="solution-text">Solution unavailable</div>;
  }
}

// Renders a compact text list from a solution set (JSON array string).
// prefix: 'n' for neighbours, 's' for population members.
function SolutionSetList({ solutionSet, prefix = 's' }: { solutionSet?: string; prefix?: string }) {
  if (!solutionSet) return null;
  try {
    const parsed: Array<{ variableValue: unknown; goalValues: number[]; isFeasible?: boolean }> = JSON.parse(solutionSet);
    if (parsed.length === 0) return null;
    const lines = parsed.map((item, i) => {
      const vars = JSON.stringify(item.variableValue);
      const score = item.isFeasible === false ? '❌' : item.goalValues[0];
      return `${vars} -> ${score}`;
    });
    return <div className="solution-text">{lines.join('\n')}</div>;
  } catch {
    return null;
  }
}

function StoredSolutionsSummary({ data }: { data: FlowNodeData }) {
  try {
    const set = data.solutionSet ? JSON.parse(data.solutionSet as string) : null;
    const count = Array.isArray(set) ? set.length : (data.solution ? 1 : 0);
    if (count === 0) return null;

    const scores: number[] = Array.isArray(set)
      ? set.map((item: { goalValues: number[] }) => item.goalValues?.reduce((a: number, b: number) => a + b, 0) ?? 0)
      : [];

    return (
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Solutions</span>
          <span className="solution-summary-value">{count}</span>
        </div>
        {scores.length > 0 && <div className="solution-text">{scores.join(', ')}</div>}
      </div>
    );
  } catch {
    return null;
  }
}

function Stepper({
  value, min = 0, step = 1, onChange,
}: {
  value: number; min?: number; step?: number; onChange: (next: number) => void;
}) {
  return (
    <div className="stepper">
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(min, value - step))}>-</button>
      <input
        className="stepper-input"
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
      />
      <button type="button" className="stepper-btn" onClick={() => onChange(value + step)}>+</button>
    </div>
  );
}

function ProblemNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Problem definition</div>
    </div>
  );
}

function SingleSolutionNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-header">
        <div className="custom-node-title">{data.label}</div>
        <NodeBadge show={data.start} label="START" className="node-badge-start" />
      </div>
      <div className="custom-node-subtitle">Generates feasible solution when trigger arrives</div>
      <ErrorText error={data.error} />
      <SolutionSummary solution={data.solution} />
    </div>
  );
}

function LocalSearchNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Improves candidate solution</div>
      <ErrorText error={data.error} />
      <SolutionSummary solution={data.solution} />
    </div>
  );
}

function AcceptanceNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Accepts one incoming solution and forwards winner</div>
      <SolutionSummary solution={data.solution} />
      <ErrorText error={data.error} />
    </div>
  );
}

function TemperatureAcceptanceNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} id="in-perturbation" style={{ top: 24 }} />
      <Handle type="target" position={Position.Left} id="in-storage" style={{ top: 52 }} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Accepts worse candidate by probability based on temperature</div>
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Temperature</span>
          <span className="solution-summary-value">{(data.temperatureCurrent ?? 100).toFixed(2)}</span>
        </div>
        {data.decisionSummary && (
          <div className="solution-summary-row">
            <span className="solution-summary-key">Decision</span>
            <span className="solution-summary-value">{data.decisionSummary}</span>
          </div>
        )}
      </div>
      <ErrorText error={data.error} />
    </div>
  );
}

function ReduceTemperatureNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Reduces temperature using loop iteration and forwards solution</div>
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Temperature</span>
          <span className="solution-summary-value">{(data.temperatureCurrent ?? 100).toFixed(2)}</span>
        </div>
      </div>
      <ErrorText error={data.error} />
    </div>
  );
}

function parseSolutionSet(solutionSet?: string) {
  if (!solutionSet) return [];
  try {
    const parsed = JSON.parse(solutionSet);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function StorageNode({ data }: { data: FlowNodeData }) {
  const set = parseSolutionSet(data.solutionSet as string | undefined);

  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-header">
        <div className="custom-node-title">{data.label}</div>
        <NodeBadge show={data.end} label="END" className="node-badge-end" />
      </div>
      <div className="custom-node-subtitle">Stored solutions</div>

      {data.solution ? (
        <SolutionSummary solution={data.solution} />
      ) : set.length === 1 ? (
        <SolutionSummary solution={JSON.stringify(set[0])} />
      ) : (
        <StoredSolutionsSummary data={data} />
      )}

      <ErrorText error={data.error} />
    </div>
  );
}

function TerminationNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} id="to-single" style={{ top: 24 }} />
      <Handle type="source" position={Position.Right} id="to-storage" style={{ top: 52 }} />
      <div className="custom-node-header">
        <div className="custom-node-title">{data.label}</div>
        <NodeBadge show={data.start} label="START" className="node-badge-start" />
        <NodeBadge show={data.end} label="END" className="node-badge-end" />
      </div>
      <div className="custom-node-subtitle">Controls the loop lifecycle</div>
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Max iterations</span>
          <Stepper
            value={data.maxIterations ?? 1}
            min={1}
            onChange={(v) => data.onUpdate?.({ maxIterations: v })}
          />
        </div>
        <div className="solution-summary-row">
          <span className="solution-summary-key">Iteration</span>
          <span className="solution-summary-value">{Math.max(1, data.iteration ?? 1)}</span>
        </div>
      </div>
      <ErrorText error={data.error} />
    </div>
  );
}

function ChangeNeighborhoodNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} id="in-acceptance" style={{ top: 24 }} />
      <Handle type="target" position={Position.Left} id="in-secondary" style={{ top: 52 }} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Adjusts neighbourhood size when both inputs match</div>
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Neighbourhood</span>
          <span className="solution-summary-value">{data.neighborhoodValue ?? 1}</span>
        </div>
        {data.neighborhoodInfo && (
          <div className="solution-summary-row">
            <span className="solution-summary-key">Last</span>
            <span className="solution-summary-value">{data.neighborhoodInfo}</span>
          </div>
        )}
      </div>
      <ErrorText error={data.error} />
    </div>
  );
}

function NeighborhoodNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Builds feasible neighbours set from input solution</div>

      <div className="solution-summary">
        <SolutionSetList solutionSet={data.solutionSet as string} prefix="n" />
      </div>

      <ErrorText error={data.error} />
    </div>
  );
}

function SubtractionNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} id="in-neighborhood" style={{ top: 24 }} />
      <Handle type="target" position={Position.Left} id="in-archive" style={{ top: 52 }} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Returns given population minus archive (tabu list)</div>
      {data.trace && (
        <div className="solution-summary">
          <div className="solution-summary-row">
            <span className="solution-summary-key">Remaining</span>
            <span className="solution-summary-value">{data.setSize}</span>
          </div>
        </div>
      )}
      <ErrorText error={data.error} />
    </div>
  );
}

function SelectionBestNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Selects the best solution in the set</div>
      <SolutionSummary solution={data.solution} />
      <ErrorText error={data.error} />
    </div>
  );
}

function PerturbationNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Perturbs solution and repairs feasibility</div>
      <ErrorText error={data.error} />
      <SolutionSummary solution={data.solution} />
    </div>
  );
}

// ── Registry ───────────────────────────────────────────────────────────────────

export const flowNodeTypes: NodeTypes = {
  problem: ProblemNode,
  singleSolution: SingleSolutionNode,
  localSearch: LocalSearchNode,
  perturbation: PerturbationNode,
  acceptance: AcceptanceNode,
  temperatureAcceptance: TemperatureAcceptanceNode,
  reduceTemperature: ReduceTemperatureNode,
  storage: StorageNode,
  termination: TerminationNode,
  changeNeighborhood: ChangeNeighborhoodNode,
  neighborhood: NeighborhoodNode,
  subtraction: SubtractionNode,
  selectionBest: SelectionBestNode,
};