import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlowSidebar } from './FlowSidebar';

describe('FlowSidebar', () => {
  it('shows empty states when no palette items or custom templates are available', () => {
    render(
      <FlowSidebar
        onLoadGraspTemplate={vi.fn()}
        onLoadIlsTemplate={vi.fn()}
        onLoadVnsTemplate={vi.fn()}
        onLoadTabuTemplate={vi.fn()}
        onLoadSaTemplate={vi.fn()}
        onLoadEvolutionaryTemplate={vi.fn()}
        customTemplates={[]}
        onSaveCustomTemplate={vi.fn()}
        onLoadCustomTemplate={vi.fn()}
        onDeleteCustomTemplate={vi.fn()}
        onExportCustomTemplate={vi.fn()}
        onImportCustomTemplate={vi.fn()}
        generationPaletteItems={[]}
        modificationPaletteItems={[]}
        otherPaletteItems={[]}
      />,
    );

    expect(screen.getByText('No generation components available.')).toBeTruthy();
    expect(screen.getByText('No modification components available.')).toBeTruthy();
    expect(screen.getByText('No additional components available.')).toBeTruthy();
    expect(screen.queryByText('Load')).toBeNull();
  });

  it('wires template actions and drag-and-drop data for palette items', () => {
    const onLoadGraspTemplate = vi.fn();
    const onLoadCustomTemplate = vi.fn();
    const onDeleteCustomTemplate = vi.fn();
    const onExportCustomTemplate = vi.fn();
    const onImportCustomTemplate = vi.fn();
    const onSaveCustomTemplate = vi.fn();
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: '',
    };

    render(
      <FlowSidebar
        onLoadGraspTemplate={onLoadGraspTemplate}
        onLoadIlsTemplate={vi.fn()}
        onLoadVnsTemplate={vi.fn()}
        onLoadTabuTemplate={vi.fn()}
        onLoadSaTemplate={vi.fn()}
        onLoadEvolutionaryTemplate={vi.fn()}
        customTemplates={[{ id: 'template-1', name: 'My template', createdAt: '2026-05-06T00:00:00.000Z' }]}
        onSaveCustomTemplate={onSaveCustomTemplate}
        onLoadCustomTemplate={onLoadCustomTemplate}
        onDeleteCustomTemplate={onDeleteCustomTemplate}
        onExportCustomTemplate={onExportCustomTemplate}
        onImportCustomTemplate={onImportCustomTemplate}
        generationPaletteItems={[{ kind: 'generation-kind', label: 'Generation item' }]}
        modificationPaletteItems={[{ kind: 'mutation-kind', label: 'Mutation item' }]}
        otherPaletteItems={[{ kind: 'storage-kind', label: 'Storage item' }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load GRASP Template' }));
    expect(onLoadGraspTemplate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Save current as template' }));
    expect(onSaveCustomTemplate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(onLoadCustomTemplate).toHaveBeenCalledWith('template-1');

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExportCustomTemplate).toHaveBeenCalledWith('template-1');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteCustomTemplate).toHaveBeenCalledWith('template-1');

    fireEvent.dragStart(screen.getByText('Generation item'), { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/reactflow', 'generation-kind');
    expect(dataTransfer.effectAllowed).toBe('move');

    fireEvent.dragStart(screen.getByText('Mutation item'), { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/reactflow', 'mutation-kind');

    fireEvent.dragStart(screen.getByText('Storage item'), { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/reactflow', 'storage-kind');
  });

  it('imports a custom template from an uploaded file', async () => {
    const onImportCustomTemplate = vi.fn();
    const { container } = render(
      <FlowSidebar
        onLoadGraspTemplate={vi.fn()}
        onLoadIlsTemplate={vi.fn()}
        onLoadVnsTemplate={vi.fn()}
        onLoadTabuTemplate={vi.fn()}
        onLoadSaTemplate={vi.fn()}
        onLoadEvolutionaryTemplate={vi.fn()}
        customTemplates={[]}
        onSaveCustomTemplate={vi.fn()}
        onLoadCustomTemplate={vi.fn()}
        onDeleteCustomTemplate={vi.fn()}
        onExportCustomTemplate={vi.fn()}
        onImportCustomTemplate={onImportCustomTemplate}
        generationPaletteItems={[]}
        modificationPaletteItems={[]}
        otherPaletteItems={[]}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const file = new File(['{"name":"Imported"}'], 'template.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve('{"name":"Imported"}'),
    });

    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(onImportCustomTemplate).toHaveBeenCalledWith('{"name":"Imported"}');
    });
  });
});
