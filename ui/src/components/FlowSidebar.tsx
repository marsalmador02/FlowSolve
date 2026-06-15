/*
 * File: FlowSidebar.tsx
 *
 * Contains:
 * - Left-side sidebar for the editor.
 * - High-level actions: load templates, run full flow, run next step, reset,
 *   and manage custom templates.
 * - Drag-and-drop palette of components available to build the graph.
 *
 * Role in the flow (startup -> graph execution):
 * - Entry point for user interaction with the process.
 * - From here users assemble the graph (dragging nodes) and trigger execution
 *   that flows through App -> useFlowRunner -> graphExecutor.
 */

interface SidebarPaletteItem {
  kind: string;
  label: string;
}

interface CustomTemplateItem {
  id: string;
  name: string;
  createdAt: string;
}

// Props contract for sidebar actions exposed to the parent App.
interface FlowSidebarProps {
  onLoadGraspTemplate: () => void;
  onLoadIlsTemplate: () => void;
  onLoadVnsTemplate: () => void;
  onLoadTabuTemplate: () => void;
  onLoadSaTemplate: () => void;
  customTemplates: CustomTemplateItem[];
  onSaveCustomTemplate: () => void;
  onLoadCustomTemplate: (templateId: string) => void;
  onDeleteCustomTemplate: (templateId: string) => void;
  onExportCustomTemplate: (templateId: string) => void;
  onImportCustomTemplate: (rawJson: string) => void;
  generationPaletteItems: SidebarPaletteItem[];
  modificationPaletteItems: SidebarPaletteItem[];
  otherPaletteItems: SidebarPaletteItem[];
}

function draggableItem(item: SidebarPaletteItem) {
  return (
    <div
      key={item.kind}
      className="sidebar-item sidebar-item--nested"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/reactflow', item.kind);
        event.dataTransfer.effectAllowed = 'move';
      }}
    >
      {item.label}
    </div>
  );
}

export function FlowSidebar({
  onLoadGraspTemplate,
  onLoadIlsTemplate,
  onLoadVnsTemplate,
  onLoadTabuTemplate,
  onLoadSaTemplate,
  customTemplates,
  onSaveCustomTemplate,
  onLoadCustomTemplate,
  onDeleteCustomTemplate,
  onExportCustomTemplate,
  onImportCustomTemplate,
  generationPaletteItems,
  modificationPaletteItems,
  otherPaletteItems,
}: FlowSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-toolbar">
        <details className="sidebar-dropdown">
          <summary className="sidebar-title">ALGORITHM TEMPLATES</summary>
          <button className="toolbar-button" onClick={onLoadGraspTemplate}>
            Load GRASP Template
          </button>
          <button className="toolbar-button" onClick={onLoadIlsTemplate}>
            Load ILS Template
          </button>
          <button className="toolbar-button" onClick={onLoadVnsTemplate}>
            Load VNS Template
          </button>
          <button className="toolbar-button" onClick={onLoadTabuTemplate}>
            Load Tabu Search Template
          </button>
          <button className="toolbar-button" onClick={onLoadSaTemplate}>
            Load Simulated Annealing Template
          </button>
        </details>

      </div>

      <div className="sidebar-divider" aria-hidden="true" />

      <details className="sidebar-dropdown">
        <summary className="sidebar-title">PERSONALIZED TEMPLATES</summary>
        <div className="template-icon-actions">
          <button className="toolbar-button template-icon-button" onClick={onSaveCustomTemplate} title="Save current as template" aria-label="Save current as template">
            💾
          </button>
        </div>
        {customTemplates.length > 0 ? (
          <div className="custom-template-list">
            {customTemplates.map((template) => (
              <div key={template.id}>
                <div className="custom-template-name" title={template.name}>{template.name}</div>
                <div className="custom-template-row">
                  <button className="toolbar-button custom-template-load" onClick={() => onLoadCustomTemplate(template.id)}>
                    Load
                  </button>
                  <button className="toolbar-button custom-template-export" onClick={() => onExportCustomTemplate(template.id)}>
                    Export
                  </button>
                  <button className="toolbar-button custom-template-delete" onClick={() => onDeleteCustomTemplate(template.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </details>

      <div className="sidebar-divider" aria-hidden="true" />

      <div className="sidebar-scroll">
        <details className="sidebar-dropdown">
          <summary className="sidebar-title">METAHEURISTIC COMPONENT</summary>
          <div className="sidebar-section-title">Generation Component</div>
          {generationPaletteItems.map((item) => draggableItem(item))}
          {generationPaletteItems.length === 0 ? (
            <div className="sidebar-item sidebar-item--nested">No generation components available.</div>
          ) : null}

          <div className="sidebar-section-title">Modification Component</div>
          {modificationPaletteItems.map((item) => draggableItem(item))}
          {modificationPaletteItems.length === 0 ? (
            <div className="sidebar-item sidebar-item--nested">No modification components available.</div>
          ) : null}

          <div className="sidebar-section-title">Other Metaheuristic Components</div>
          {otherPaletteItems.map((item) => draggableItem(item))}
          {otherPaletteItems.length === 0 ? (
            <div className="sidebar-item sidebar-item--nested">No additional components available.</div>
          ) : null}
        </details>
      </div>
    </aside>
  );
}
