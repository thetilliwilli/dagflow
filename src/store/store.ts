// Стор приложения (research R5). Создаётся фабрикой, чтобы тесты получали свежий экземпляр.
import { createStore } from 'zustand/vanilla';
import { immer } from 'zustand/middleware/immer';
import type { CompositeDef, Graph, NodeState, Tab, Workflow } from '@dagflow/engine';
import type { UnavailableItem } from '../storage/directory-storage';
import type { TabHistory } from './history';
import type { StorageLocation } from '../storage/location';
import { messages } from '../ui/messages';
import { initialEngine, type EngineSlice, type EngineTarget } from '../engine-link/types';

export type NotificationKind = 'info' | 'warning' | 'error';

export interface Notification {
  id: string;
  kind: NotificationKind;
  text: string;
}

/** Предложение пользователю при смене хранилища (FR-028c). */
export type StoragePrompt =
  | { kind: 'copy-to-empty'; folderName: string }
  | { kind: 'add-from-browser'; folderName: string; add: Workflow[]; copies: Workflow[] };

export interface AppState {
  workflows: Record<string, Workflow>;
  workflowOrder: string[];
  composites: Record<string, CompositeDef>;
  tabs: Tab[];
  activeTabId: string | null;
  /** Состояния вычисления: tabId → nodeId → NodeState. В историю и хранилище не попадают. */
  nodeStates: Record<string, Record<string, NodeState>>;
  /** Короткие уведомления (отказы, импорт, изменения портов). */
  notifications: Notification[];
  /** null — хранилище ещё не определено (идёт загрузка). */
  storageLocation: StorageLocation | null;
  storagePrompt: StoragePrompt | null;
  /** Есть ли в браузере выбор рабочей папки. */
  folderSupported: boolean;
  /** Файлы, которые не удалось прочитать. */
  unavailable: UnavailableItem[];
  /** История отмены: tabId → снапшоты графа. Не сохраняется между сессиями. */
  history: Record<string, TabHistory>;
  /** Цель вычисления и состояние подключения (фича 004). В файлы workflow не попадает. */
  engine: EngineSlice;
}

export interface StoreDeps {
  newId: () => string;
  now: () => string;
  /** Миллисекунды для объединения правок в истории; по умолчанию Date.now. */
  nowMs?: () => number;
}

function makeStore(initial?: Partial<AppState>) {
  return createStore<AppState>()(
    immer(() => ({
      workflows: {},
      workflowOrder: [],
      composites: {},
      tabs: [],
      activeTabId: null,
      nodeStates: {},
      notifications: [],
      storageLocation: null,
      storagePrompt: null,
      folderSupported: false,
      unavailable: [],
      history: {},
      engine: initialEngine(),
      ...initial,
    })),
  );
}

/** Zustand-стор с immer: setState принимает функцию, изменяющую черновик. */
export type AppStoreApi = ReturnType<typeof makeStore>;

export interface AppStore {
  store: AppStoreApi;
  deps: StoreDeps;
  /** Управление целью вычисления; появляется после startEngine (src/store/engine.ts). */
  engine?: EngineControl;
}

/** Действия с целью вычисления, которые выполняет связка с протоколом. */
export interface EngineControl {
  select(target: EngineTarget, opts?: { hint?: 'ws' | 'wss'; remembered?: 'ws' | 'wss' }): void;
  retryNow(): void;
  useLocal(): void;
  cancelTrial(): void;
}

export const defaultDeps: StoreDeps = {
  newId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

export function emptyGraph(): Graph {
  return { nodes: [], edges: [] };
}

export const DEFAULT_WORKFLOW_NAME = messages.defaultWorkflowName;

/** Начальное состояние: один пустой workflow, открытый во вкладке. */
export function freshWorkspace(
  deps: StoreDeps,
): Pick<AppState, 'workflows' | 'workflowOrder' | 'tabs' | 'activeTabId'> {
  const ts = deps.now();
  const workflow: Workflow = {
    id: deps.newId(),
    name: DEFAULT_WORKFLOW_NAME,
    graph: emptyGraph(),
    createdAt: ts,
    updatedAt: ts,
  };
  const tab: Tab = {
    id: deps.newId(),
    kind: 'workflow',
    targetId: workflow.id,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  return {
    workflows: { [workflow.id]: workflow },
    workflowOrder: [workflow.id],
    tabs: [tab],
    activeTabId: tab.id,
  };
}

/** Создаёт стор; если workflow нет, создаёт «Новый workflow» и открывает его во вкладке. */
export function createAppStore(
  deps: StoreDeps = defaultDeps,
  initial?: Partial<AppState>,
): AppStore {
  const store = makeStore(initial);
  if (store.getState().workflowOrder.length === 0) store.setState(freshWorkspace(deps));
  return { store, deps };
}

export function activeTab(state: AppState): Tab | undefined {
  return state.tabs.find((t) => t.id === state.activeTabId);
}

/** Граф, который редактируется во вкладке. */
export function tabGraph(state: AppState, tab: Tab | undefined): Graph | undefined {
  if (!tab) return undefined;
  return tab.kind === 'workflow'
    ? state.workflows[tab.targetId]?.graph
    : state.composites[tab.targetId]?.graph;
}

/** Связи с целью нет — пометка «Last known value — engine offline» (FR-019). */
export function isOffline(state: AppState): boolean {
  return state.engine.status.kind !== 'ready';
}

/** Значения вкладки устарели: связи с целью нет или вкладка не передана из-за лимита (FR-019, FR-024). */
export function isStale(state: AppState, tabId: string): boolean {
  const { status, tooLarge } = state.engine;
  return status.kind !== 'ready' || tooLarge.library || tooLarge.tabs[tabId] === true;
}
