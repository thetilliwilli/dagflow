// Связка стора с целью вычисления через протокол (research R15). Единственный, кто пишет nodeStates.
import type { CompositeDef, NodeState } from '@dagflow/engine';
import {
  byteLength,
  createEngineClient,
  MAX_MESSAGE_BYTES,
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
import { isLocalHost } from '../engine-link/address';
import { probe, type ProbeDeps, type SocketLike } from '../engine-link/probe';
import { rememberServer } from '../engine-link/recent';
import { loadEngineSettings, saveEngineSettings, type SettingsEnv } from '../engine-link/settings';
import type { EngineTarget } from '../engine-link/types';
import { engineMessages } from '../ui/messages';
import { tabGraph, type AppState, type AppStore } from './store';

type Schedule = (fn: () => void) => void;

const defaultSchedule: Schedule = (fn) => requestAnimationFrame(() => fn());

/** Браузерные зависимости пробы: настоящий WebSocket и таймеры. */
/** Разрешение браузера на доступ к localhost / локальной сети (Chrome 147+, Firefox 154+; R8). */
async function lnaPermission(address: string) {
  const name = isLocalHost(address) ? 'loopback-network' : 'local-network';
  // Имена разрешений есть не во всех браузерах — неизвестное имя бросает TypeError
  const status = await navigator.permissions.query({ name } as unknown as PermissionDescriptor);
  return status.state === 'granted' || status.state === 'prompt' || status.state === 'denied'
    ? status.state
    : undefined;
}

function browserProbeDeps(): ProbeDeps {
  return {
    permission: globalThis.navigator?.permissions ? lnaPermission : undefined,
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
  /**
   * Хранилище настроек цели (IndexedDB, ключ dagflow:engine). Есть — цель и список читаются при
   * старте и сохраняются при каждом изменении; нет (тесты) — начальная цель из стора.
   */
  settings?: SettingsEnv;
}

export function startEngine(app: AppStore, options: EngineOptions = {}): () => void {
  const { store } = app;
  const schedule = options.schedule ?? defaultSchedule;
  let channel: Channel | null = null;
  let encrypted = false;
  /** Лимит 8 МБ — только у сервера; в окне и фоновом потоке размер не ограничен (FR-024, FR-002). */
  let limited = false;
  const client = createEngineClient({
    maxMessageBytes: () => (limited ? MAX_MESSAGE_BYTES : undefined),
  });

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
    for (const text of out.send) {
      if (!channel) continue;
      // Учёт до отправки: в Local ответ приходит синхронно, внутри send
      count('tx', text);
      channel.send(text);
    }
    if (traffic !== written) writeTraffic();
  }

  function apply(events: ClientEvent[]) {
    store.setState((draft: AppState) => {
      draft.engine.traffic = traffic;
      written = traffic;
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
            // Цель не смогла обработать запрос: уведомление «…Retrying.» — только если повтор
            // будет; повторный сбой на том же графе не шумит (повтор — при правке, FR-025)
            if (e.doc !== undefined && !e.retrying) break;
            draft.notifications.push({
              id: app.deps.newId(),
              kind: 'warning',
              text: e.retrying ? engineMessages.processFailed : engineMessages.processFailedNoRetry,
            });
            break;
          case 'resend':
            // Цель забыла вкладку — клиент молча передал её заново (FR-025)
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
  // Объём обмена с текущей целью (FR-013a): байты строк в канал и из канала. В стор пишется
  // вместе с событиями протокола (ответ хоста приходит на каждую отправку) — без лишних записей
  let traffic = { tx: 0, rx: 0 };
  let trafficTarget: EngineTarget | null = null;

  let written = traffic;

  function count(dir: 'tx' | 'rx', text: string) {
    traffic = { ...traffic, [dir]: traffic[dir] + byteLength(text) };
  }

  function writeTraffic() {
    written = traffic;
    store.setState((draft: AppState) => {
      draft.engine.traffic = traffic;
    });
  }

  function attach(next: Channel, welcome: string | undefined, info: AttachInfo) {
    channel = next;
    // Другая цель — счёт с нуля; переподключение к той же — продолжается
    if (!trafficTarget || !sameTarget(trafficTarget, info.target)) {
      trafficTarget = info.target;
      traffic = { tx: 0, rx: 0 };
      writeTraffic();
    }
    encrypted = info.encrypted;
    limited = info.target.kind === 'server';
    store.setState((draft: AppState) => {
      draft.engine.target = info.target;
      draft.engine.status = { kind: 'connecting' };
      draft.engine.tooLarge = { library: false, tabs: {} };
      if (info.target.kind === 'server') {
        draft.engine.recent = rememberServer(draft.engine.recent, info.target.address, info.scheme);
      }
    });
    // onClose канала ведёт подключение (переподключение, connection.ts)
    next.onMessage = (text) => {
      count('rx', text);
      handle(client.receive(text));
    };
    // Сначала сброс клиента, потом снимок (до welcome он только запоминается)
    const hello = client.start();
    client.sync(snapshot(store.getState()));
    if (welcome === undefined) handle({ events: [], send: hello });
    else {
      if (info.hello) count('tx', info.hello);
      count('rx', welcome);
      handle(client.receive(welcome));
    }
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
    cancelTrial: () => connection.cancelTrial(),
  };

  // Сеть вернулась или вкладка снова видна — попробовать сразу (FR-020; online — только подсказка, R7)
  const retrySoon = () => {
    if (globalThis.document?.visibilityState !== 'hidden') connection.retryNow();
  };
  globalThis.addEventListener?.('online', retrySoon);
  globalThis.document?.addEventListener('visibilitychange', retrySoon);

  let disposed = false;
  let saving: (() => void) | undefined;

  function begin() {
    const { target, recent } = store.getState().engine;
    const remembered =
      target.kind === 'server'
        ? recent.find((r) => r.address === target.address)?.scheme
        : undefined;
    connection.start(target, { remembered });
  }

  const settingsEnv = options.settings;
  if (settingsEnv) {
    // Окно читает настройки один раз и не перечитывает: окна независимы (FR-006, US4 #10)
    void loadEngineSettings(settingsEnv).then((settings) => {
      if (disposed) return;
      store.setState((draft: AppState) => {
        draft.engine.target = settings.target;
        draft.engine.recent = settings.recent;
      });
      begin();
      saving = store.subscribe((state, prev) => {
        const { target, recent } = state.engine;
        if (target !== prev.engine.target || recent !== prev.engine.recent) {
          void saveEngineSettings(settingsEnv, { target, recent }).catch(() => {});
        }
      });
    });
  } else begin();

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
    disposed = true;
    saving?.();
    globalThis.removeEventListener?.('online', retrySoon);
    globalThis.document?.removeEventListener('visibilitychange', retrySoon);
    unsubscribe();
    connection.dispose();
    channel = null;
    delete app.engine;
  };
}

const sameTarget = (a: EngineTarget, b: EngineTarget) =>
  a.kind === b.kind && (a.kind !== 'server' || (b.kind === 'server' && a.address === b.address));
