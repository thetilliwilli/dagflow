// Действия редактирования графа активной вкладки; проверки — через движок (FR-002…FR-007)
import {
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
import { activeTab, type AppState, type AppStore, type NotificationKind } from './store';

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

  return {
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
