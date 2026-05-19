/*
 * Archivo: FlowInspectorPanel.tsx
 *
 * Que contiene:
 * - Panel lateral derecho con:
 *   - Editor del JSON del Problem con botones de ejemplos.
 *   - Marcado Start/End del nodo seleccionado.
 *   - Traza global de la ejecucion.
 *   - Exportacion simple de la traza a un archivo de texto.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Permite definir el problema, elegir el nodo de arranque y el de cierre,
 *   seguir la traza global mientras corre el flujo y exportarla al final.
 */
import type { FlowNodeData, FlowNode } from '../types/flow';
import {
  ASSIGNMENT_COMPLEX_TEMPLATE_JSON,
  ASSIGNMENT_TEMPLATE_JSON,
  KNAPSACK_COMPLEX_TEMPLATE_JSON,
  KNAPSACK_TEMPLATE_JSON,
  TSP_COMPLEX_TEMPLATE_JSON,
  TSP_TEMPLATE_JSON,
} from '../constants/problemTemplates';

interface FlowInspectorPanelProps {
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

export function FlowInspectorPanel({
  selectedNode,
  selectedData,
  globalTrace,
  setNodeStart,
  setNodeEnd,
  onProblemJsonChange,
  applyProblemExample,
  onExportTrace,
  onExportCsv,
}: FlowInspectorPanelProps) {
  const canBeStart =
    selectedNode?.type === 'singleSolution'
    || selectedNode?.type === 'populationGeneration'
    || selectedNode?.type === 'termination';
  const canBeEnd = selectedNode?.type === 'storage' || selectedNode?.type === 'termination';
  const showStartEndControls = canBeStart || canBeEnd;

  return (
    <>
      {selectedNode?.type === 'problem' ? (
        <aside className="properties">
          <div className="properties-title">Problem JSON</div>
          <div className="properties-actions">
            <button className="sidebar-action" onClick={() => applyProblemExample(KNAPSACK_COMPLEX_TEMPLATE_JSON)}>
              Knapsack
            </button>
            <button className="sidebar-action" onClick={() => applyProblemExample(TSP_COMPLEX_TEMPLATE_JSON)}>
              TSP
            </button>
            <button className="sidebar-action" onClick={() => applyProblemExample(ASSIGNMENT_COMPLEX_TEMPLATE_JSON)}>
              Assignment
            </button>
          </div>
          <textarea value={selectedData?.json ?? ''} onChange={(e) => onProblemJsonChange(e.target.value)} />
        </aside>
      ) : null}

      {showStartEndControls ? (
        <aside className="properties properties-node-flags">
          {canBeStart ? (
            <label className="form-label">
              <b>Start node</b>
              <input
                type="checkbox"
                checked={selectedData?.start === true}
                onChange={(e) => setNodeStart(selectedNode.id, e.target.checked)}
              />
            </label>
          ) : null}
          {canBeStart && canBeEnd ? <div className="form-divider" /> : null}
          {canBeEnd ? (
            <label className="form-label">
              <b>End node</b>
              <input
                type="checkbox"
                checked={selectedData?.end === true}
                onChange={(e) => setNodeEnd(selectedNode.id, e.target.checked)}
              />
            </label>
          ) : null}
        </aside>
      ) : null}

      {globalTrace.length > 0 ? (
        <aside className="properties properties-global-trace">
          <div className="properties-title">Execution Trace</div>
          <div className="properties-actions">
            <button className="sidebar-action" onClick={onExportTrace}>
              Export trace as .txt
            </button>
            <button className="sidebar-action" onClick={onExportCsv}>
              Export CSV
            </button>
          </div>
          <textarea value={globalTrace.join('\n')} readOnly />
        </aside>
      ) : null}
    </>
  );
}