// Список workflow: создать, открыть, переименовать, дублировать, удалить (FR-031)
import { useState } from 'react';
import { useActions, useAppState } from '../../store/react';
import { activeTab } from '../../store/store';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import { workflowMessages as m } from '../messages';

export function WorkflowList() {
  const actions = useActions();
  const order = useAppState((s) => s.workflowOrder);
  const workflows = useAppState((s) => s.workflows);
  const unavailable = useAppState((s) => s.unavailable);
  const activeId = useAppState((s) => activeTab(s)?.targetId);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  function commitRename(id: string) {
    const r = actions.renameWorkflow(id, draft);
    if (!r.ok) actions.notify('error', r.message);
    setEditing(null);
  }

  const toDelete = deleting ? workflows[deleting] : undefined;

  return (
    <section className="workflow-list" data-testid="workflow-list">
      <div className="workflow-list__header">
        <h2>{m.list}</h2>
        <button type="button" onClick={() => actions.createWorkflow()}>
          {m.create}
        </button>
      </div>
      <ul>
        {order.map((id) => {
          const wf = workflows[id];
          if (!wf) return null;
          return (
            <li key={id} className={id === activeId ? 'active' : undefined}>
              {editing === id ? (
                <input
                  aria-label={m.nameInput}
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(id);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  onBlur={() => editing === id && commitRename(id)}
                />
              ) : (
                <button type="button" className="workflow-list__name" aria-label={m.open(wf.name)} title={wf.name} onClick={() => actions.openTab('workflow', id)}>
                  {wf.name}
                </button>
              )}
              <span className="workflow-list__actions">
                <button
                  type="button"
                  aria-label={m.rename(wf.name)}
                  title={m.rename(wf.name)}
                  onClick={() => {
                    setDraft(wf.name);
                    setEditing(id);
                  }}
                >
                  ✎
                </button>
                <button type="button" aria-label={m.duplicate(wf.name)} title={m.duplicate(wf.name)} onClick={() => actions.duplicateWorkflow(id)}>
                  ⧉
                </button>
                <button type="button" aria-label={m.remove(wf.name)} title={m.remove(wf.name)} onClick={() => setDeleting(id)}>
                  ✕
                </button>
              </span>
            </li>
          );
        })}
        {unavailable
          .filter((u) => u.kind === 'workflow')
          .map((u) => (
            <li key={`bad-${u.id}`} className="unavailable">
              <span>{m.unavailable(u.id)}</span>
              <small>{u.reason}</small>
            </li>
          ))}
      </ul>
      {toDelete && (
        <ConfirmDialog
          title={m.confirmDeleteTitle}
          text={m.confirmDelete(toDelete.name)}
          confirmLabel={m.deleteButton}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            actions.deleteWorkflow(toDelete.id);
            setDeleting(null);
          }}
        />
      )}
    </section>
  );
}
