/*
 * File: flowNodes.tsx
 *
 * Contains:
 * - Visual renderers for each node type in React Flow.
 * - Input/output handles (including specialized handles like
 *   in-local, in-storage, to-single, to-storage).
 * - Visual summaries for solutions, sets, scores, running states and errors.
 *
 * Role in the flow (startup -> graph execution):
 * - Renders the graph the user builds in App.
 * - Defines visible connection structure and, via handles, assists routing of
 *   packets between nodes in the runtime.
 */

import React from 'react';
import { Handle, Position, type NodeTypes } from 'reactflow';
import type { FlowNodeData } from '../types/flow';

function renderStartBadge(data: FlowNodeData) {
  if (!data.start) {
    return null;
  }
  return <span className="node-badge-start">START</span>;
}

function renderEndBadge(data: FlowNodeData) {
  if (!data.end) {
    return null;
  }
  return <span className="node-badge-end">END</span>;
}

function nodeClassName(data: FlowNodeData) {
  return data.isRunning ? 'custom-node custom-node-running' : 'custom-node';
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

function renderSolutionSummary(data: FlowNodeData) {
  if (!data.solution) {
    return null;
  }

  try {
    const parsed = JSON.parse(data.solution);
    const score = parsed.goalValues.reduce((acc: number, v: any) => acc + v, 0);
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

function renderStoredSolutions(data: FlowNodeData) {
  const scoreFromSolution = (value: any): number | null => {
    if (!value) {
      return null;
    }
    const goals = value.goalValues;
    if (!goals) {
      return null;
    }
    const score = goals.reduce((acc: number, item: number) => acc + item, 0);
    return score;
  };

  const scores: number[] = [];
  if (data.solutionSet) {
    const parsed = JSON.parse(data.solutionSet);
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        const score = scoreFromSolution(item);
        if (score !== null) {
          scores.push(score);
        }
      });
    }
  }

  if (scores.length === 0 && data.solution) {
    const parsed = JSON.parse(data.solution);
    const score = scoreFromSolution(parsed);
    if (score !== null) {
      scores.push(score);
    }
  }

  if (scores.length === 0) {
    return null;
  }

  return (
    <div className="solution-summary">
      <div className="solution-summary-row">
        <span className="solution-summary-key">Solutions</span>
        <span className="solution-summary-value">{scores.length}</span>
      </div>
      <div className="solution-text">{scores.map((score) => score).join(', ')}</div>
    </div>
  );
}

function renderNeighborList(data: FlowNodeData) {
  if (!data.solutionSet) {
    return null;
  }

  const parsed = JSON.parse(data.solutionSet);
  if (parsed.length === 0) {
    return null;
  }

  const lines = parsed.map((item: any, index: number) => {
    const vars = JSON.stringify(item.variableValue);
    const score = Number(item.goalValues[0]);
    return `n${index + 1}: ${vars} -> ${score}`;
  });

  return <div className="solution-text">{lines.join('\n')}</div>;
}

function renderSolutionSetList(data: FlowNodeData) {
  if (!data.solutionSet) {
    return null;
  }

  const parsed = JSON.parse(data.solutionSet);
  if (parsed.length === 0) {
    return null;
  }

  const lines = parsed.map((item: any, index: number) => {
    const vars = JSON.stringify(item.variableValue);
    const isInfeasible = item?.isFeasible === false;
    const score = isInfeasible ? 'infeasible' : item.goalValues[0];
    return `s${index + 1}: ${vars} -> ${score}`;
  });

  return <div className="solution-text">{lines.join('\n')}</div>;
}

function SingleSolutionNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-header">
          <div className="custom-node-title">{data.label}</div>
          {renderStartBadge(data)}
        </div>
        <div className="custom-node-subtitle">Generates feasible solution when trigger arrives</div>
      </div>
      {data.error ? <div className="error-text">{data.error}</div> : null}
      {renderSolutionSummary(data)}
    </div>
  );
}

function PopulationGenerationNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-header">
          <div className="custom-node-title">{data.label}</div>
          {renderStartBadge(data)}
        </div>
        <div className="custom-node-subtitle">Generates a feasible population</div>
      </div>
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Population size</span>
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ populationSize: Math.max(1, (data.populationSize ?? 10) - 1) })}
            >
              -
            </button>
            <input
              className="stepper-input"
              type="number"
              min={1}
              value={data.populationSize ?? 10}
              onChange={(e) => data.onUpdate?.({ populationSize: Math.max(1, Number(e.target.value)) })}
            />
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ populationSize: (data.populationSize ?? 10) + 1 })}
            >
              +
            </button>
          </div>
        </div>
      </div>
      {renderSolutionSetList(data)}
      {data.error ? <div className="error-text">{data.error}</div> : null}
    </div>
  );
}

function SelectionNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Selects parents from population</div>
      </div>
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Tournament size</span>
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ tournamentSize: Math.max(1, (data.tournamentSize ?? 3) - 1) })}
            >
              -
            </button>
            <input
              className="stepper-input"
              type="number"
              min={1}
              value={data.tournamentSize ?? 3}
              onChange={(e) => data.onUpdate?.({ tournamentSize: Math.max(1, Number(e.target.value) || 1) })}
            />
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ tournamentSize: (data.tournamentSize ?? 3) + 1 })}
            >
              +
            </button>
          </div>
        </div>
        <div className="solution-summary-row">
          <span className="solution-summary-key">Elite size</span>
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ eliteSize: Math.max(0, (data.eliteSize ?? 1) - 1) })}
            >
              -
            </button>
            <input
              className="stepper-input"
              type="number"
              min={0}
              value={data.eliteSize ?? 1}
              onChange={(e) => data.onUpdate?.({ eliteSize: Math.max(0, Number(e.target.value) || 0) })}
            />
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ eliteSize: (data.eliteSize ?? 1) + 1 })}
            >
              +
            </button>
          </div>
        </div>
      </div>
      {renderSolutionSetList(data)}
      {data.error ? <div className="error-text">{data.error}</div> : null}
    </div>
  );
}

function CrossoverNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Combines parents into offspring</div>
      </div>
      {renderSolutionSetList(data)}
      {data.error ? <div className="error-text">{data.error}</div> : null}
    </div>
  );
}

function MutationNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-title">{data.label}</div>
        <div className="custom-node-subtitle">Mutates offspring into next generation</div>
      </div>
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Mutation rate</span>
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ mutationRate: Math.max(0, Math.min(1, Number(((data.mutationRate ?? 0.25) - 0.01).toFixed(2)))) })}
            >
              -
            </button>
            <input
              className="stepper-input"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={Number((data.mutationRate ?? 0.25).toFixed(2))}
              onChange={(e) => data.onUpdate?.({ mutationRate: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })}
            />
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ mutationRate: Math.max(0, Math.min(1, Number(((data.mutationRate ?? 0.25) + 0.01).toFixed(2)))) })}
            >
              +
            </button>
          </div>
        </div>
      </div>
      {renderSolutionSetList(data)}
      {data.error ? <div className="error-text">{data.error}</div> : null}
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
      {data.error ? <div className="error-text">{data.error}</div> : null}
      {renderSolutionSummary(data)}
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
      {renderSolutionSummary(data)}
      {data.error ? <div className="error-text">{data.error}</div> : null}
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
        {data.decisionSummary ? (
          <div className="solution-summary-row">
            <span className="solution-summary-key">Decision</span>
            <span className="solution-summary-value">{data.decisionSummary}</span>
          </div>
        ) : null}
      </div>
      {data.error ? <div className="error-text">{data.error}</div> : null}
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
      {data.error ? <div className="error-text">{data.error}</div> : null}
    </div>
  );
}
1
function StorageNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="custom-node-info">
        <div className="custom-node-header">
          <div className="custom-node-title">{data.label}</div>
          {renderEndBadge(data)}
        </div>
        <div className="custom-node-subtitle">Stored solutions</div>
      </div>
      {renderStoredSolutions(data)}
      {data.error ? <div className="error-text">{data.error}</div> : null}
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
          {renderStartBadge(data)}
          {renderEndBadge(data)}
        </div>
        <div className="custom-node-subtitle">Controls the loop lifecycle</div>
      </div>
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Max iterations</span>
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ maxIterations: Math.max(1, (data.maxIterations ?? 1) - 1) })}
            >
              -
            </button>
            <input
              className="stepper-input"
              type="number"
              min={1}
              value={data.maxIterations ?? 1}
              onChange={(e) => data.onUpdate?.({ maxIterations: Math.max(1, Number(e.target.value) || 1) })}
            />
            <button
              type="button"
              className="stepper-btn"
              onClick={() => data.onUpdate?.({ maxIterations: (data.maxIterations ?? 1) + 1 })}
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="solution-summary">
        <div className="solution-summary-row">
          <span className="solution-summary-key">Iteration</span>
          <span className="solution-summary-value">{Math.max(1, data.iteration ?? 1)}</span>
        </div>
      </div>
      {data.error ? <div className="error-text">{data.error}</div> : null}
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
        {data.neighborhoodInfo ? (
          <div className="solution-summary-row">
            <span className="solution-summary-key">Last</span>
            <span className="solution-summary-value">{data.neighborhoodInfo}</span>
          </div>
        ) : null}
      </div>
      {data.error ? <div className="error-text">{data.error}</div> : null}
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
      {renderNeighborList(data)}
      {data.error ? <div className="error-text">{data.error}</div> : null}
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
      {data.trace ? (
        <div className="solution-summary">
          <div className="solution-summary-row">
            <span className="solution-summary-key">Remaining</span>
            <span className="solution-summary-value">{data.setSize}</span>
          </div>
        </div>
      ) : null}
      {data.error ? <div className="error-text">{data.error}</div> : null}
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
      {renderSolutionSummary(data)}
      {data.error ? <div className="error-text">{data.error}</div> : null}
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
      {data.error ? <div className="error-text">{data.error}</div> : null}
      {renderSolutionSummary(data)}
    </div>
  );
}

export const flowNodeTypes: NodeTypes = {
  problem: ProblemNode,
  singleSolution: SingleSolutionNode,
  populationGeneration: PopulationGenerationNode,
  selection: SelectionNode,
  crossover: CrossoverNode,
  mutation: MutationNode,
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