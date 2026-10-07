// Связка стора с целью вычисления через протокол (research R15). Единственный, кто пишет nodeStates.
import type { CompositeDef, NodeState } from '@dagflow/engine';
import {
  createEngineClient,
  type Channel,
  type ClientEvent,
  type ClientOutput,
  type Snapshot,
} from '@dagflow/protocol';
import { createInlineChannel } from '../engine-link/channels/inline';
import { openWorker, type WorkerLike } from '../engine-link/channels/worker';
import {
  createConnection,
  type AttachInfo,
  type ConnectionDeps,
  type Opening,
} from '../engine-link/connection';
import { probe, type ProbeDeps, type SocketLike } from '../engine-link/probe';
import type { EngineTarget } from '../engine-link/types';
import { engineMessages } from '../ui/messages';
import { tabGraph, type AppState, type AppStore } from './store';

type Schedule = (fn: () => void) => void;

const defaultSchedule: Schedule = (fn) => requestAnimationFrame(() => fn());

/** Браузерные зависимости пробы: настоящий WebSocket и таймеры. */
function browserProbeDeps(): ProbeDeps {
  return {
    pageSecure: globalThis.location?.protocol === 'https:',
    // Браузерный WebSocket совместим с SocketLike (обработчики получают событие, которое мы не читаем)
    createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}

export interface EngineOptions {
  /** Планировщик кадра: пересчёт в Local и запись в стор — не чаще раза за кадр. */
  schedule?: Schedule;
  /** Открытие целей; по умолчанию Local — в окне, Server — проба через WebSocket. */
  open?: ConnectionDeps['open'];
}

const MAX_RECENT = 5;

export function startEngine(app: AppStore, options: EngineOptions = {}): () => void {
  const { store } = app;
  const schedule = options.schedule ?? defaultSchedule;
  const client = createEngineClient();
  let channel: Channel | null = null;
  let encrypted = false;

  // Один и тот же массив определений, пока state.composites не изменился: клиент сравнивает по ссылке
  let compositesRecord: AppState['composites'] | undefined;
  let compositesList: CompositeDef[] = [];

  function snapshot(state: AppState): Snapshot {
    if (state.composites !== compositesRecord) {
      compositesRecord = state.composites;
      compositesList = Object.values(state.composites);
    }
    const tabs: Snapshot['tabs'] = [];
    for (const tab of state.tabs) {
      const graph = tabGraph(state, tab);
      if (graph) tabs.push({ doc: tab.id, graph });
    }
    return { tabs, composites: compositesList };
  }

  function handle(out: ClientOutput) {
    if (out.events.length > 0) apply(out.events);
    for (const text of out.send) channel?.send(text);
  }

  function apply(events: ClientEvent[]) {
    store.setState((draft: AppState) => {
      for (const e of events) {
        switch (e.kind) {
          case 'ready':
            draft.engine.status = { kind: 'ready', engine: e.engine, encrypted };
            break;
          case 'incompatible':
            // Закрытие соединения после этого — не обрыв: повторов нет (FR-023)
            connection.halt();
            draft.engine.status = { kind: 'incompatible', host: e.host };
            break;
          case 'pending':
            markComputing(draft, e.doc, e.nodes);
            break;
          case 'states': {
            const states = (draft.nodeStates[e.doc] ??= {});
            for (const [id, s] of Object.entries(e.states)) states[id] = s as NodeState;
            break;
          }
          case 'too-large':
            if (e.doc === undefined) draft.engine.tooLarge.library = true;
            else draft.engine.tooLarge.tabs[e.doc] = true;
            break;
          case 'sent':
            if (e.doc === undefined) draft.engine.tooLarge.library = false;
            else delete draft.engine.tooLarge.tabs[e.doc];
            break;
          case 'failed':
          case 'resend':
            // Уведомления — US6 (T076)
            break;
        }
      }
    });
  }

  function notify(kind: 'info' | 'warning' | 'error', text: string) {
    const id = app.deps.newId();
    store.setState((draft: AppState) => {
      draft.notifications.push({ id, kind, text });
    });
  }

  function markComputing(draft: AppState, tabId: string, nodes: string[]) {
    const states = (draft.nodeStates[tabId] ??= {});
    const graph = tabGraph(
      draft,
      draft.tabs.find((t) => t.id === tabId),
    );
    // Состояния удалённых нодов убираем: граф у редактора
    const alive = new Set(graph?.nodes.map((n) => n.id));
    for (const id of Object.keys(states)) if (!alive.has(id)) delete states[id];
    for (const id of nodes) {
      const prev = states[id];
      states[id] = {
        status: 'computing',
        inputs: prev?.inputs ?? {},
        outputs: prev?.outputs ?? {},
      };
    }
  }

  /** Новый текущий канал: полный снимок открытых вкладок (FR-015, FR-021). */
  function attach(next: Channel, welcome: string | undefined, info: AttachInfo) {
    channel = next;
    encrypted = info.encrypted;
    store.setState((draft: AppState) => {
      draft.engine.target = info.target;
      draft.engine.status = { kind: 'connecting' };
      draft.engine.tooLarge = { library: false, tabs: {} };
      if (info.target.kind === 'server') {
        const { address } = info.target;
        const others = draft.engine.recent.filter((r) => r.address !== address);
        draft.engine.recent = [{ address, scheme: info.scheme }, ...others].slice(0, MAX_RECENT);
      }
    });
    // onClose канала ведёт подключение (переподключение, connection.ts)
    next.onMessage = (text) => handle(client.receive(text));
    // Сначала сброс клиента, потом снимок (до welcome он только запоминается)
    const hello = client.start();
    client.sync(snapshot(store.getState()));
    if (welcome === undefined) handle({ events: [], send: hello });
    else handle(client.receive(welcome));
  }

  const open: ConnectionDeps['open'] =
    options.open ??
    ((target: EngineTarget, opts): Opening => {
      if (target.kind === 'server') return probe(target.address, opts, browserProbeDeps());
      if (target.kind === 'local') {
        const immediate = { ok: true as const, channel: createInlineChannel(schedule) };
        return { immediate, result: Promise.resolve(immediate), cancel: () => {} };
      }
      return openWorker(
        () =>
          new Worker(new URL('../engine-link/engine-worker.ts', import.meta.url), {
            type: 'module',
          }) as unknown as WorkerLike,
        {
          setTimer: (fn, ms) => setTimeout(fn, ms),
          clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
        },
      );
    });

  const connection = createConnection(
    {
      open,
      now: () => Date.now(),
      random: () => Math.random(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
    {
      attach,
      trial: (trial) =>
        store.setState((draft: AppState) => {
          draft.engine.trial = trial;
        }),
      status: (status) =>
        store.setState((draft: AppState) => {
          draft.engine.status = status;
        }),
      restarted: () => notify('warning', engineMessages.workerRestarted),
    },
  );

  app.engine = {
    select: (target, opts) => connection.select(target, opts ?? {}),
    retryNow: () => connection.retryNow(),
    useLocal: () => connection.useLocal(),
  };

  // Сеть вернулась или вкладка снова видна — попробовать сразу (FR-020; online — только подсказка, R7)
  const retrySoon = () => {
    if (globalThis.document?.visibilityState !== 'hidden') connection.retryNow();
  };
  globalThis.addEventListener?.('online', retrySoon);
  globalThis.document?.addEventListener('visibilitychange', retrySoon);

  const { target, recent } = store.getState().engine;
  const remembered =
    target.kind === 'server' ? recent.find((r) => r.address === target.address)?.scheme : undefined;
  connection.start(target, { remembered });
  const unsubscribe = store.subscribe((state, prev) => {
    if (
      state.workflows !== prev.workflows ||
      state.composites !== prev.composites ||
      state.tabs !== prev.tabs
    ) {
      handle(client.sync(snapshot(state)));
    }
  });

  return () => {
    globalThis.removeEventListener?.('online', retrySoon);
    globalThis.document?.removeEventListener('visibilitychange', retrySoon);
    unsubscribe();
    connection.dispose();
    channel = null;
    delete app.engine;
  };
}
