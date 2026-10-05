// Вкладки открытых workflow (FR-031a)
import { useActions, useAppState } from '../../store/react';
import { compositeMessages, workflowMessages as m } from '../messages';

export function TabBar() {
  const actions = useActions();
  const tabs = useAppState((s) => s.tabs);
  const activeTabId = useAppState((s) => s.activeTabId);
  const workflows = useAppState((s) => s.workflows);
  const composites = useAppState((s) => s.composites);

  return (
    <div className="tab-bar" role="tablist" data-testid="tab-bar">
      {tabs.map((t) => {
        const name = (t.kind === 'workflow' ? workflows[t.targetId]?.name : composites[t.targetId]?.name) ?? '…';
        const title = t.kind === 'composite' ? compositeMessages.tabTitle(name) : name;
        const selected = t.id === activeTabId;
        return (
          <div key={t.id} className={`tab ${selected ? 'tab--active' : ''}`}>
            <div role="tab" aria-selected={selected} tabIndex={0} className="tab__title" onClick={() => actions.switchTab(t.id)} onKeyDown={(e) => e.key === 'Enter' && actions.switchTab(t.id)}>
              {title}
            </div>
            <button type="button" className="tab__close" aria-label={m.closeTab(title)} onClick={() => actions.closeTab(t.id)}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
