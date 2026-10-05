// Действия редактирования графа активной вкладки; проверки — через движок (FR-002…FR-007)
import {
  type CompositeDef,
  type PortDef,
  type Tab,
  type Viewport,
  type Workflow,
  canAddNode,
  collapse,
  compositeIdOf,
  compositePorts,
  expand,
  IO_INPUT,
  IO_OUTPUT,
  validateIoPorts,
  canConnect,
  matchesType,
  nodePorts,
  type Graph,
  type JsonValue,
  type PortRef,
  type Position,
  type Rejection,
} from '../engine';
import { compositeMessages, messages } from '../ui/messages';
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
  /** Все графы: workflow и определения составных нодов. */
  function allGraphs(draft: AppState): Graph[] {
    return [...Object.values(draft.workflows).map((w) => w.graph), ...Object.values(draft.composites).map((c) => c.graph)];
  }

  /** После правки определения: связи экземпляров с исчезнувшими портами удаляются с уведомлением (edge case). */
  function cleanupRemovedPorts(draft: AppState, defId: string, before: { inputs: PortDef[]; outputs: PortDef[] }) {
    const after = compositePorts(draft.composites[defId]!);
    const removedIn = new Set(before.inputs.map((p) => p.name).filter((n) => !after.inputs.some((p) => p.name === n)));
    const removedOut = new Set(before.outputs.map((p) => p.name).filter((n) => !after.outputs.some((p) => p.name === n)));
    if (removedIn.size === 0 && removedOut.size === 0) return;
    let removed = 0;
    for (const g of allGraphs(draft)) {
      const instances = new Set(g.nodes.filter((n) => compositeIdOf(n.type) === defId).map((n) => n.id));
      if (instances.size === 0) continue;
      for (const n of g.nodes) if (instances.has(n.id)) for (const p of removedIn) delete n.values[p];
      const kept = g.edges.filter(
        (e) => !(instances.has(e.target.node) && removedIn.has(e.target.port)) && !(instances.has(e.source.node) && removedOut.has(e.source.port)),
      );
      removed += g.edges.length - kept.length;
      g.edges = kept;
    }
    if (removed > 0) draft.notifications.push({ id: deps.newId(), kind: 'warning', text: compositeMessages.edgesRemoved(removed) });
  }

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
        const before = compositePorts(def);
        fn(def.graph, draft);
        def.updatedAt = deps.now();
        cleanupRemovedPorts(draft, def.id, before);
      }
    });
  }

  function checkCompositeName(name: string, exceptId?: string): Rejection | null {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_NAME) return { ok: false, code: 'unknown-port', message: messages.invalidName };
    const taken = Object.values(store.getState().composites).some((c) => c.id !== exceptId && c.name === trimmed);
    return taken ? { ok: false, code: 'unknown-port', message: compositeMessages.nameTaken(trimmed) } : null;
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
        const node: Graph['nodes'][number] = { id, type, position, values: {} };
        if (type === IO_INPUT || type === IO_OUTPUT) {
          // Новый нод «Вход»/«Выход» — с одним портом и уникальным именем (FR-021c)
          const taken = g.nodes.filter((n) => n.type === type).flatMap((n) => (n.ports ?? []).map((p) => p.name));
          node.ports = [{ name: uniqueName(type === IO_INPUT ? 'in' : 'out', taken).replace(' ', '_'), type: 'any', required: true }];
        }
        g.nodes.push(node);
      });
      return { ok: true, id };
    },

    // --- Составные ноды (US4) ---

    /** Свернуть выделенные ноды в составной нод (FR-021, FR-022, FR-023a). */
    collapseSelection(nodeIds: string[], name: string): Result<{ compositeId: string; instanceId: string }> {
      const bad = checkCompositeName(name);
      if (bad) return bad;
      const { state, graph } = current();
      if (!graph) return { ok: false, code: 'unknown-port', message: 'Нет открытой вкладки' };
      const r = collapse(graph, nodeIds, name.trim(), registryOf(state), deps.newId);
      if ('code' in r) return r;
      const ts = deps.now();
      store.setState((draft: AppState) => {
        draft.composites[r.composite.id] = { ...r.composite, createdAt: ts, updatedAt: ts };
      });
      editGraph((g) => {
        g.nodes = r.graph.nodes;
        g.edges = r.graph.edges;
      });
      return { ok: true, compositeId: r.composite.id, instanceId: r.instanceId };
    },

    renameComposite(id: string, name: string): Result {
      const bad = checkCompositeName(name, id);
      if (bad) return bad;
      store.setState((draft: AppState) => {
        const def = draft.composites[id];
        if (!def) return;
        def.name = name.trim();
        def.updatedAt = deps.now();
      });
      return { ok: true };
    },

    /** Развернуть экземпляр обратно в ноды (FR-025). */
    expandInstance(nodeId: string): Result {
      const { state, graph } = current();
      const node = graph?.nodes.find((n) => n.id === nodeId);
      const defId = node ? compositeIdOf(node.type) : null;
      const def = defId ? state.composites[defId] : undefined;
      if (!graph || !def) return { ok: false, code: 'unknown-type', message: 'Составной нод не найден' };
      const next = expand(graph, nodeId, def, deps.newId);
      editGraph((g) => {
        g.nodes = next.nodes;
        g.edges = next.edges;
      });
      return { ok: true };
    },

    openComposite(id: string) {
      store.setState((draft: AppState) => openTabIn(draft, 'composite', id));
    },

    /** Сколько экземпляров составного нода во всех workflow и определениях. */
    compositeUsage(id: string): number {
      const s = store.getState();
      const graphs = [...Object.values(s.workflows).map((w) => w.graph), ...Object.values(s.composites).map((c) => c.graph)];
      return graphs.reduce((sum, g) => sum + g.nodes.filter((n) => compositeIdOf(n.type) === id).length, 0);
    },

    /** Удалить составной нод из палитры вместе со всеми экземплярами (FR-027; подтверждение — в UI). */
    deleteComposite(id: string) {
      store.setState((draft: AppState) => {
        delete draft.composites[id];
        for (const g of allGraphs(draft)) {
          const gone = new Set(g.nodes.filter((n) => compositeIdOf(n.type) === id).map((n) => n.id));
          if (gone.size === 0) continue;
          g.nodes = g.nodes.filter((n) => !gone.has(n.id));
          g.edges = g.edges.filter((e) => !gone.has(e.source.node) && !gone.has(e.target.node));
        }
        for (const t of draft.tabs.filter((t) => t.kind === 'composite' && t.targetId === id)) closeTabIn(draft, t.id);
      });
    },

    /** Изменить порты нода «Вход»/«Выход» (FR-021a, FR-021c). */
    editIoPorts(nodeId: string, ports: PortDef[]): Result {
      const { graph } = current();
      const node = graph?.nodes.find((n) => n.id === nodeId);
      if (!graph || !node || (node.type !== IO_INPUT && node.type !== IO_OUTPUT)) {
        return { ok: false, code: 'unknown-port', message: 'Нод «Вход»/«Выход» не найден' };
      }
      const cleaned = ports.map((p) => ({ ...p, name: p.name.trim() }));
      const candidate = { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, ports: cleaned } : n)) };
      const bad = validateIoPorts(candidate);
      if (bad) return bad;
      const names = new Set(cleaned.map((p) => p.name));
      editGraph((g) => {
        g.nodes.find((n) => n.id === nodeId)!.ports = cleaned;
        g.edges = g.edges.filter((e) =>
          node.type === IO_INPUT ? !(e.source.node === nodeId && !names.has(e.source.port)) : !(e.target.node === nodeId && !names.has(e.target.port)),
        );
      });
      return { ok: true };
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
