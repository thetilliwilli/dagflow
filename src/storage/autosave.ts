// Автосохранение: запись изменённых файлов через 300 мс после последнего изменения (research R7, FR-028, SC-008)
import type { CompositeDef, Workflow, Workspace } from '@dagflow/engine';
import type { AppState, AppStoreApi } from '../store/store';

export interface AutosaveTarget {
  saveWorkflow(wf: Workflow): Promise<void>;
  deleteWorkflow(id: string): Promise<void>;
  saveComposite(def: CompositeDef): Promise<void>;
  deleteComposite(id: string): Promise<void>;
  saveWorkspace(ws: Workspace): Promise<void>;
}

export interface AutosaveOptions {
  delay?: number;
  onError?: (error: unknown) => void;
  /** Источник событий pagehide/visibilitychange (по умолчанию window). */
  events?: EventTarget;
  isHidden?: () => boolean;
}

interface Snapshot {
  workflows: AppState['workflows'];
  composites: AppState['composites'];
  workflowOrder: AppState['workflowOrder'];
  tabs: AppState['tabs'];
  activeTabId: AppState['activeTabId'];
}

function snapshot(s: AppState): Snapshot {
  return {
    workflows: s.workflows,
    composites: s.composites,
    workflowOrder: s.workflowOrder,
    tabs: s.tabs,
    activeTabId: s.activeTabId,
  };
}

export function workspaceOf(
  s: Pick<AppState, 'workflowOrder' | 'tabs' | 'activeTabId'>,
): Workspace {
  return { workflowOrder: s.workflowOrder, tabs: s.tabs, activeTabId: s.activeTabId };
}

export function createAutosave(
  store: AppStoreApi,
  getTarget: () => AutosaveTarget | null,
  opts: AutosaveOptions = {},
) {
  const delay = opts.delay ?? 300;
  const events = opts.events ?? (typeof window !== 'undefined' ? window : undefined);
  const isHidden =
    opts.isHidden ??
    (() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  let baseline = snapshot(store.getState());
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> = Promise.resolve();

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), delay);
  }

  async function write(target: AutosaveTarget, from: Snapshot, to: Snapshot) {
    for (const [id, wf] of Object.entries(to.workflows))
      if (from.workflows[id] !== wf) await target.saveWorkflow(wf);
    for (const id of Object.keys(from.workflows))
      if (!to.workflows[id]) await target.deleteWorkflow(id);
    for (const [id, c] of Object.entries(to.composites))
      if (from.composites[id] !== c) await target.saveComposite(c);
    for (const id of Object.keys(from.composites))
      if (!to.composites[id]) await target.deleteComposite(id);
    if (
      from.workflowOrder !== to.workflowOrder ||
      from.tabs !== to.tabs ||
      from.activeTabId !== to.activeTabId
    ) {
      await target.saveWorkspace(workspaceOf(to));
    }
  }

  function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    running = running.then(async () => {
      const target = getTarget();
      if (!target) return;
      const next = snapshot(store.getState());
      try {
        await write(target, baseline, next);
        baseline = next; // при ошибке baseline не двигается — изменения запишутся при следующем flush
      } catch (e) {
        opts.onError?.(e);
      }
    });
    return running;
  }

  const unsubscribe = store.subscribe((s, prev) => {
    if (
      s.workflows !== prev.workflows ||
      s.composites !== prev.composites ||
      s.workflowOrder !== prev.workflowOrder ||
      s.tabs !== prev.tabs ||
      s.activeTabId !== prev.activeTabId
    ) {
      schedule();
    }
  });
  const onPageHide = () => void flush();
  const onVisibility = () => {
    if (isHidden()) void flush();
  };
  events?.addEventListener('pagehide', onPageHide);
  events?.addEventListener('visibilitychange', onVisibility);

  return {
    flush,
    /** Считать текущее состояние сохранённым (после загрузки из хранилища). */
    resetBaseline() {
      if (timer) clearTimeout(timer);
      timer = null;
      baseline = snapshot(store.getState());
    },
    /** Считать сохранённым пустое состояние: следующий flush запишет всё. */
    markAllDirty() {
      baseline = { workflows: {}, composites: {}, workflowOrder: [], tabs: [], activeTabId: null };
      schedule();
    },
    stop() {
      if (timer) clearTimeout(timer);
      unsubscribe();
      events?.removeEventListener('pagehide', onPageHide);
      events?.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

export type Autosave = ReturnType<typeof createAutosave>;
