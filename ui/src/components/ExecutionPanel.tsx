/**
 * Execution Panel
 *
 * Renders the right-side panel used during execution. It allows users to edit
 * problem definitions, configure start/end nodes, inspect execution traces and
 * export execution results.
 */

import type { FlowNodeData, FlowNode } from '../types/flow';
import {
  ASSIGNMENT_TEMPLATE_JSON,
  KNAPSACK_TEMPLATE_JSON,
  TSP_TEMPLATE_JSON,
} from '../constants/problemTemplates';

export interface ExecutionPanelProps {
  selectedNode: FlowNode | null;
  selectedData?: FlowNodeData;
  globalTrace: string[];
  setNodeStart: (id: string, isStart: boolean) => void;
  setNodeEnd: (id: string, isEnd: boolean) => void;
  onProblemJsonChange: (newJson: string) => void;
  applyProblemExample: (exampleJson: string) => void;
  onExportTrace: () => void;
  onExportCsv: () => void;
}

/**
 * Displays execution controls, problem settings,
 * and runtime traces.
 */
export function ExecutionPanel({
  selectedNode,
  selectedData,
  globalTrace,
  setNodeStart,
  setNodeEnd,
  onProblemJsonChange,
  applyProblemExample,
  onExportTrace,
  onExportCsv,
}: ExecutionPanelProps) {
  const canBeStart =
    selectedNode?.type === 'singleSolution' ||
    selectedNode?.type === 'populationGeneration' ||
    selectedNode?.type === 'termination';

  const canBeEnd =
    selectedNode?.type === 'storage' ||
    selectedNode?.type === 'termination';

  return (
    <>
      {selectedNode?.type === 'problem' && (
        <aside className="properties">
          <div className="properties-title">Problem JSON</div>
          <div className="properties-actions">
            <button className="sidebar-action" onClick={() => applyProblemExample(KNAPSACK_TEMPLATE_JSON)}>Knapsack</button>
            <button className="sidebar-action" onClick={() => applyProblemExample(TSP_TEMPLATE_JSON)}>TSP</button>
            <button className="sidebar-action" onClick={() => applyProblemExample(ASSIGNMENT_TEMPLATE_JSON)}>Assignment</button>
          </div>
          <textarea value={selectedData?.json ?? ''} onChange={(e) => onProblemJsonChange(e.target.value)} />
        </aside>
      )}

      {(canBeStart || canBeEnd) && (
        <aside className="properties properties-node-flags">
          {canBeStart && (
            <label className="form-label">
              <b>Start node</b>
              <input
                type="checkbox"
                checked={selectedData?.start === true}
                onChange={(e) => setNodeStart(selectedNode.id, e.target.checked)}
              />
            </label>
          )}
          {canBeStart && canBeEnd && <div className="form-divider" />}
          {canBeEnd && (
            <label className="form-label">
              <b>End node</b>
              <input
                type="checkbox"
                checked={selectedData?.end === true}
                onChange={(e) => setNodeEnd(selectedNode.id, e.target.checked)}
              />
            </label>
          )}
        </aside>
      )}

      {globalTrace.length > 0 && (
        <aside className="properties properties-global-trace">
          <div className="properties-title">Execution Trace</div>
          <div className="properties-actions">
            <button className="sidebar-action" onClick={onExportTrace}>Export trace as .txt</button>
            <button className="sidebar-action" onClick={onExportCsv}>Export CSV</button>
          </div>
          <textarea value={globalTrace.join('\n')} readOnly />
        </aside>
      )}
    </>
  );
}