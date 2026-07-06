/**
 * Flow Sidebar
 *
 * Provides the components for building workflows. It contains predefined algorithm
 * templates, custom templates and draggable components that can be added to the
 * canvas.
 */

interface SidebarPaletteItem {
  kind: string;
  label: string;
}

interface CustomTemplateItem {
  id: string;
  name: string;
}

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
  onImportCustomTemplate: () => void;
  generationPaletteItems: SidebarPaletteItem[];
  modificationPaletteItems: SidebarPaletteItem[];
  otherPaletteItems: SidebarPaletteItem[];
}

function draggableItem(item: SidebarPaletteItem) {
  return (
    <div
      key={item.kind}
      className="sidebar-item"
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

/**
 * Main sidebar used to build workflow graphs.
 *
 * Provides templates and draggable runtime components.
 */
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
          <button className="toolbar-button" onClick={onLoadGraspTemplate}>Load GRASP Template</button>
          <button className="toolbar-button" onClick={onLoadIlsTemplate}>Load ILS Template</button>
          <button className="toolbar-button" onClick={onLoadVnsTemplate}>Load VNS Template</button>
          <button className="toolbar-button" onClick={onLoadTabuTemplate}>Load Tabu Search Template</button>
          <button className="toolbar-button" onClick={onLoadSaTemplate}>Load Simulated Annealing Template</button>
        </details>
      </div>

      <div className="sidebar-divider" aria-hidden="true" />

      <details className="sidebar-dropdown">
        <summary className="sidebar-title">PERSONALIZED TEMPLATES</summary>
        <div className="template-icon-actions">
          <button
            className="toolbar-button template-icon-button"
            onClick={onSaveCustomTemplate}
            title="Save current as template"
            aria-label="Save current as template"
          >
            💾
          </button>

          <button
            className="toolbar-button template-icon-button"
            onClick={onImportCustomTemplate}
            title="Import template"
            aria-label="Import template"
          >
            📂
          </button>
        </div>
        {customTemplates.length > 0 && (
          <div className="custom-template-list">
            {customTemplates.map((template) => (
              <div key={template.id}>
                <div className="custom-template-name" title={template.name}>{template.name}</div>
                <div className="custom-template-row">
                  <button className="toolbar-button custom-template-load" onClick={() => onLoadCustomTemplate(template.id)}>Load</button>
                  <button className="toolbar-button custom-template-export" onClick={() => onExportCustomTemplate(template.id)}>Export</button>
                  <button className="toolbar-button custom-template-delete" onClick={() => onDeleteCustomTemplate(template.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </details>

      <div className="sidebar-divider" aria-hidden="true" />

      <div className="sidebar-scroll">
        <details className="sidebar-dropdown">
          <summary className="sidebar-title">METAHEURISTIC COMPONENT</summary>
          <div className="sidebar-section-title">Generation Component</div>
          {generationPaletteItems.length > 0
            ? generationPaletteItems.map((item) => draggableItem(item))
            : <div className="sidebar-item">No generation components available.</div>}

          <div className="sidebar-section-title">Modification Component</div>
          {modificationPaletteItems.length > 0
            ? modificationPaletteItems.map((item) => draggableItem(item))
            : <div className="sidebar-item">No modification components available.</div>}

          <div className="sidebar-section-title">Other Metaheuristic Components</div>
          {otherPaletteItems.length > 0
            ? otherPaletteItems.map((item) => draggableItem(item))
            : <div className="sidebar-item">No additional components available.</div>}
        </details>
      </div>
    </aside>
  );
}