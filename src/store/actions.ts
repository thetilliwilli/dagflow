// Действия редактирования графа активной вкладки; проверки — через движок (FR-002…FR-007)
import {
  type CompositeDef,
  type Tab,
  type Viewport,
  type Workflow,
  canAddNode,
  canConnect,
  matchesType,
  nodePorts,
  type Graph,
  type JsonValue,
  type PortRef,
  type Position,
  type Rejection,
} from '../engine';
import { messages } from '../ui/messages';
import { registryOf } from './registry';
import {
  activeTab,
  DEFAULT_WORKFLOW_NAME,
  emptyGraph,
  type AppState,
  type AppStore,
  type NotificationKind,
} from './store';

const MAX_NAME = 100;

/** «Новый workflow», «Новый workflow 2», … — первое свободное имя. */
export function uniqueName(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export type Result<T = object> = ({ ok: true } & T) | Rejection;

export function createActions({ store, deps }: AppStore) {
  /** Изменяет граф активной вкладки внутри immer-черновика. */
  function editGraph(fn: (graph: Graph, state: AppState) => void) {
    store.setState((draft: AppState) => {
      const tab = activeTab(draft);
      if (!tab) return;
      if (tab.kind === 'workflow') {
        const wf = draft.workflows[tab.targetId];
        if (!wf) return;
        fn(wf.graph, draft);
        wf.updatedAt = deps.now();
      } else {
        const def = draft.composites[tab.targetId];
        if (!def) return;
        fn(def.graph, draft);
        def.updatedAt = deps.now();
      }
    });
  }

  function current(): { state: AppState; graph: Graph | undefined; insideComposite?: string } {
    const state = store.getState();
    const tab = activeTab(state);
    if (!tab) return { state, graph: undefined };
    if (tab.kind === 'workflow') return { state, graph: state.workflows[tab.targetId]?.graph };
    return { state, graph: state.composites[tab.targetId]?.graph, insideComposite: tab.targetId };
  }

  function openTabIn(draft: AppState, kind: Tab['kind'], targetId: string) {
    const existing = draft.tabs.find((t) => t.kind === kind && t.targetId === targetId);
    if (existing) {
      draft.activeTabId = existing.id;
      return;
    }
    const tab: Tab = { id: deps.newId(), kind, targetId, viewport: { x: 0, y: 0, zoom: 1 } };
    draft.tabs.push(tab);
    draft.activeTabId = tab.id;
  }

  function closeTabIn(draft: AppState, tabId: string) {
    const index = draft.tabs.findIndex((t) => t.id === tabId);
    if (index < 0) return;
    draft.tabs.splice(index, 1);
    delete draft.nodeStates[tabId];
    if (draft.activeTabId === tabId) draft.activeTabId = (draft.tabs[index] ?? draft.tabs[index - 1])?.id ?? null;
  }

  return {
    // --- Workflow и вкладки (FR-031, FR-031a) ---

    createWorkflow(): string {
      const id = deps.newId();
      const ts = deps.now();
      store.setState((draft: AppState) => {
        const name = uniqueName(DEFAULT_WORKFLOW_NAME, Object.values(draft.workflows).map((w) => w.name));
        draft.workflows[id] = { id, name, graph: emptyGraph(), createdAt: ts, updatedAt: ts };
        draft.workflowOrder.push(id);
        openTabIn(draft, 'workflow', id);
      });
      return id;
    },

    renameWorkflow(id: string, name: string): Result {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > MAX_NAME) {
        return { ok: false, code: 'unknown-port', message: messages.invalidName };
      }
      store.setState((draft: AppState) => {
        const wf = draft.workflows[id];
        if (!wf) return;
        wf.name = trimmed;
        wf.updatedAt = deps.now();
      });
      return { ok: true };
    },

    duplicateWorkflow(id: string): string | null {
      const source = store.getState().workflows[id];
      if (!source) return null;
      const copyId = deps.newId();
      const ts = deps.now();
      store.setState((draft: AppState) => {
        const name = `${source.name} (копия)`.slice(0, MAX_NAME);
        draft.workflows[copyId] = { id: copyId, name, graph: structuredClone(source.graph), createdAt: ts, updatedAt: ts };
        draft.workflowOrder.splice(draft.workflowOrder.indexOf(id) + 1, 0, copyId);
      });
      return copyId;
    },

    deleteWorkflow(id: string) {
      store.setState((draft: AppState) => {
        delete draft.workflows[id];
        draft.workflowOrder = draft.workflowOrder.filter((x) => x !== id);
        for (const t of draft.tabs.filter((t) => t.kind === 'workflow' && t.targetId === id)) closeTabIn(draft, t.id);
      });
    },

    openTab(kind: Tab['kind'], targetId: string) {
      store.setState((draft: AppState) => openTabIn(draft, kind, targetId));
    },

    closeTab(tabId: string) {
      store.setState((draft: AppState) => closeTabIn(draft, tabId));
    },

    switchTab(tabId: string) {
      store.setState((draft: AppState) => {
        if (draft.tabs.some((t) => t.id === tabId)) draft.activeTabId = tabId;
      });
    },

    setViewport(tabId: string, viewport: Viewport) {
      store.setState((draft: AppState) => {
        const tab = draft.tabs.find((t) => t.id === tabId);
        if (tab) tab.viewport = viewport;
      });
    },

    /** Добавить импортированный workflow и определения; открыть в новой вкладке (шаг 6 импорта). */
    addImported(workflow: Workflow, composites: CompositeDef[]) {
      store.setState((draft: AppState) => {
        for (const c of composites) draft.composites[c.id] = c;
        draft.workflows[workflow.id] = workflow;
        draft.workflowOrder.push(workflow.id);
        openTabIn(draft, 'workflow', workflow.id);
      });
    },

    /** Показать уведомление; возвращает его id. */
    notify(kind: NotificationKind, text: string): string {
      const id = deps.newId();
      store.setState((draft: AppState) => {
        draft.notifications.push({ id, kind, text });
      });
      return id;
    },

    dismiss(id: string) {
      store.setState((draft: AppState) => {
        draft.notifications = draft.notifications.filter((n) => n.id !== id);
      });
    },

    addNode(type: string, position: Position): Result<{ id: string }> {
      const { state, graph, insideComposite } = current();
      if (!graph) return { ok: false, code: 'unknown-type', message: 'Нет открытой вкладки' };
      const check = canAddNode(graph, type, { insideComposite }, registryOf(state), Object.values(state.composites));
      if (!check.ok) return check;
      const id = deps.newId();
      editGraph((g) => {
        g.nodes.push({ id, type, position, values: {} });
      });
      return { ok: true, id };
    },

    moveNode(id: string, position: Position) {
      editGraph((g) => {
        const n = g.nodes.find((x) => x.id === id);
        if (n) n.position = position;
      });
    },

    deleteNodes(ids: string[]) {
      const set = new Set(ids);
      editGraph((g) => {
        g.nodes = g.nodes.filter((n) => !set.has(n.id));
        g.edges = g.edges.filter((e) => !set.has(e.source.node) && !set.has(e.target.node));
      });
    },

    connect(source: PortRef, target: PortRef): Result {
      const { state, graph } = current();
      if (!graph) return { ok: false, code: 'unknown-port', message: 'Нет открытой вкладки' };
      const check = canConnect(graph, { source, target }, registryOf(state));
      if (!check.ok) return check;
      const id = deps.newId();
      editGraph((g) => {
        if (check.replaces) g.edges = g.edges.filter((e) => e.id !== check.replaces);
        g.edges.push({ id, source, target });
      });
      return { ok: true };
    },

    disconnect(edgeId: string) {
      editGraph((g) => {
        g.edges = g.edges.filter((e) => e.id !== edgeId);
      });
    },

    /** Задать вручную значение входа; `undefined` — очистить. */
    setInputValue(nodeId: string, port: string, value: JsonValue | undefined): Result {
      const { state, graph } = current();
      const node = graph?.nodes.find((n) => n.id === nodeId);
      const def = node && nodePorts(node, registryOf(state))?.inputs.find((p) => p.name === port);
      if (!node || !def) return { ok: false, code: 'unknown-port', message: `Порт «${port}» не найден.` };
      if (value !== undefined && !matchesType(value, def.type)) {
        return { ok: false, code: 'type-mismatch', message: messages.valueTypeMismatch(def.type) };
      }
      editGraph((g) => {
        const n = g.nodes.find((x) => x.id === nodeId)!;
        if (value === undefined) delete n.values[port];
        else n.values[port] = value;
      });
      return { ok: true };
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
