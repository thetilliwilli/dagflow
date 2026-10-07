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
import { tabGraph, type AppState, type AppStore } from './store';

type Schedule = (fn: () => void) => void;

const defaultSchedule: Schedule = (fn) => requestAnimationFrame(() => fn());

export interface EngineOptions {
  /** Планировщик кадра: пересчёт в Local и запись в стор — не чаще раза за кадр. */
  schedule?: Schedule;
}

export function startEngine(app: AppStore, options: EngineOptions = {}): () => void {
  const { store } = app;
  const schedule = options.schedule ?? defaultSchedule;
  const client = createEngineClient();
  let channel: Channel = createInlineChannel(schedule);

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
    for (const text of out.send) channel.send(text);
  }

  function apply(events: ClientEvent[]) {
    store.setState((draft: AppState) => {
      for (const e of events) {
        switch (e.kind) {
          case 'ready':
            draft.engine.status = { kind: 'ready', engine: e.engine, encrypted: false };
            break;
          case 'incompatible':
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
            // Уведомления и повтор — US6 (T076)
            break;
        }
      }
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

  function connect(next: Channel) {
    channel = next;
    channel.onMessage = (text) => handle(client.receive(text));
    channel.onClose = () => {
      // Переподключение — US3 (T044)
    };
    // Сначала сброс клиента, потом снимок (до welcome он только запоминается), потом hello
    const hello = client.start();
    client.sync(snapshot(store.getState()));
    handle({ events: [], send: hello });
  }

  connect(channel);
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
    unsubscribe();
    channel.close();
  };
}
