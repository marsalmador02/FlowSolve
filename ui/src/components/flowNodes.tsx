import { Handle, Position, type NodeTypes } from 'reactflow';
import type { FlowNodeData } from '../types/flow';

function nodeClassName(data: FlowNodeData) {
  return data.isRunning ? 'custom-node custom-node-running' : 'custom-node';
}

function StartBadge({ data }: { data: FlowNodeData }) {
  if (!data.start) return null;
  return <span className="node-badge-start">START</span>;
}

function EndBadge({ data }: { data: FlowNodeData }) {
  if (!data.end) return null;
  return <span className="node-badge-end">END</span>;
}

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="error-text">{error}</div>;
}

function scoreFromSolution(value: any): number | null {
  const goals = value.goalValues;
  return goals ? goals.reduce((acc: number, item: number) => acc + item, 0) : null;
}

function SolutionSummary({ data }: { data: FlowNodeData }) {
  if (!data.solution) return null;
  const parsed = JSON.parse(data.solution);
  const score = scoreFromSolution(parsed);
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
  return <div className="solution-text">Solution unavailable</div>;
}

function StoredSolutions({ data }: { data: FlowNodeData }) {
  const scores: number[] = [];

  if (data.solutionSet) {
      const parsed = JSON.parse(data.solutionSet);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          const score = scoreFromSolution(item);
          if (score !== null) scores.push(score);
        });
      }
  }

  if (scores.length === 0 && data.solution) {
      const score = scoreFromSolution(JSON.parse(data.solution));
      if (score !== null) scores.push(score);
  }

  if (scores.length === 0) return null;

  return (
    <div className="solution-summary">
      <div className="solution-summary-row">
        <span className="solution-summary-key">Solutions</span>
        <span className="solution-summary-value">{scores.length}</span>
      </div>
      <div className="solution-text">{scores.join(', ')}</div>
    </div>
  );
}

function SolutionSetList({ data }: { data: FlowNodeData }) {
  if (!data.solutionSet) return null;
  const parsed = JSON.parse(data.solutionSet);
  if (parsed.length === 0) return null;

  const lines = parsed.map((item: any, index: number) => {
    const vars = JSON.stringify(item.variableValue);
    const isInfeasible = item.isFeasible === false;
    const score = isInfeasible ? 'infeasible' : item.goalValues[0];
    return `${vars} -> ${score}`;
  });

  return (
    <div className="solution-summary">
      <div className="solution-text" style={{ whiteSpace: 'pre-line' }}>{lines.join('\n')}</div>
    </div>
  );
}

function Stepper({label, value, min = 0, step = 1, onChange}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="solution-summary-row">
      <span className="solution-summary-key">{label}</span>
      <div className="stepper">
        <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}>-</button>
        <input
          className="stepper-input"
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
        />
        <button type="button" className="stepper-btn" onClick={() => onChange(Number((value + step).toFixed(2)))}>+</button>
      </div>
    </div>
  );
}

function ProblemNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Problem definition</div>
      </div>
    </div>
  );
}

function SingleSolutionNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-header">
          <div className="custom-node-title">{data.label}</div>
          <StartBadge data={data} />
        </div>
        <div className="custom-node-subtitle">Generates feasible solution when trigger arrives</div>
      </div>
      <ErrorText error={data.error} />
      <SolutionSummary data={data} />
    </div>
  );
}

function LocalSearchNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Improves candidate solution</div>
      </div>
      <ErrorText error={data.error} />
      <SolutionSummary data={data} />
    </div>
  );
}

function PerturbationNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Perturbs solution and repairs feasibility</div>
      </div>
      <ErrorText error={data.error} />
      <SolutionSummary data={data} />
    </div>
  );
}

function AcceptanceNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Accepts one incoming solution and forwards winner</div>
      </div>
      <SolutionSummary data={data} />
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
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Accepts worse candidate by probability based on temperature</div>
      </div>
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
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Reduces temperature using loop iteration and forwards solution</div>
      </div>
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

function StorageNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-header">
          <div className="custom-node-title">{data.label}</div>
          <EndBadge data={data} />
        </div>
        <div className="custom-node-subtitle">Stored solutions</div>
      </div>
      <StoredSolutions data={data} />
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
      <div className="custom-node-info">
        <div className="custom-node-header">
          <div className="custom-node-title">{data.label}</div>
          <StartBadge data={data} />
          <EndBadge data={data} />
        </div>
        <div className="custom-node-subtitle">Controls the loop lifecycle</div>
      </div>
      <div className="solution-summary">
        <Stepper
          label="Max iterations"
          value={data.maxIterations ?? 1}
          min={1}
          onChange={(next) => data.onUpdate?.({ maxIterations: next })}
        />
      </div>
      <div className="solution-summary">
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
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Adjusts neighbourhood size when both inputs match</div>
      </div>
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
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Builds feasible neighbours set from input solution</div>
      </div>
      <SolutionSetList data={data}/>
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
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Returns given population minus archive (tabu list)</div>
      </div>
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
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Selects the best solution in the set</div>
      </div>
      <SolutionSummary data={data} />
      <ErrorText error={data.error} />
    </div>
  );
}

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