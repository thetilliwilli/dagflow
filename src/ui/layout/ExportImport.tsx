// Выгрузка в файл и загрузка из файла (FR-029, FR-030)
import { useState, type ChangeEvent } from 'react';
import { importExport } from '../../model/import';
import { buildExport, toJsonText } from '../../model/serialize';
import { useActions, useApp, useAppState } from '../../store/react';
import { activeTab } from '../../store/store';
import { ImportErrorDialog } from '../dialogs/ImportErrorDialog';
import { workflowMessages as m } from '../messages';

export function ExportImport() {
  const app = useApp();
  const actions = useActions();
  const workflowId = useAppState((s) => {
    const t = activeTab(s);
    return t?.kind === 'workflow' ? t.targetId : undefined;
  });
  const [error, setError] = useState<string | null>(null);

  function exportFile() {
    const state = app.store.getState();
    const workflow = workflowId ? state.workflows[workflowId] : undefined;
    if (!workflow) return;
    const used = new Set(workflow.graph.nodes.filter((n) => n.type.startsWith('composite:')).map((n) => n.type.slice(10)));
    const composites = Object.values(state.composites).filter((c) => used.has(c.id));
    const blob = new Blob([toJsonText(buildExport(workflow, composites, app.deps.now()))], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name}.dagflow.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const state = app.store.getState();
    const r = importExport(await file.text(), {
      workflows: state.workflows,
      composites: state.composites,
      newId: app.deps.newId,
      now: app.deps.now,
    });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    actions.addImported(r.workflow, r.composites);
    for (const n of r.notices) actions.notify('info', n);
  }

  return (
    <section className="export-import">
      <button type="button" disabled={!workflowId} onClick={exportFile}>
        {m.exportButton}
      </button>
      <label className="button-like">
        {m.importLabel}
        <input type="file" accept=".json,application/json" className="visually-hidden" onChange={(e) => void importFile(e)} />
      </label>
      {error && <ImportErrorDialog message={error} onClose={() => setError(null)} />}
    </section>
  );
}
