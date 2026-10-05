// Связка стора с движком: по Evaluator на вкладку, пересчёт не чаще раза за кадр (research R2, T032)
import { createEvaluator, type Evaluator, type Graph, type NodeState } from '../engine';
import { registryOf } from './registry';
import { tabGraph, type AppState, type AppStore } from './store';

type Schedule = (fn: () => void) => void;

const defaultSchedule: Schedule = (fn) => requestAnimationFrame(() => fn());

export function startEvaluation({ store }: AppStore, schedule: Schedule = defaultSchedule): () => void {
  const evaluators = new Map<string, { ev: Evaluator; graph: Graph | undefined; composites: AppState['composites'] }>();
  let scheduled = false;

  function flush() {
    scheduled = false;
    const updates: Record<string, Map<string, NodeState>> = {};
    for (const [tabId, entry] of evaluators) {
      if (entry.ev.pending().size === 0) continue;
      updates[tabId] = entry.ev.flush();
    }
    if (Object.keys(updates).length === 0) return;
    store.setState((draft: AppState) => {
      for (const [tabId, changed] of Object.entries(updates)) {
        const states = (draft.nodeStates[tabId] ??= {});
        for (const [nodeId, s] of changed) states[nodeId] = s;
      }
    });
  }

  function sync(state: AppState) {
    const markComputing: Record<string, string[]> = {};
    const openTabs = new Set(state.tabs.map((t) => t.id));
    for (const tabId of evaluators.keys()) if (!openTabs.has(tabId)) evaluators.delete(tabId);

    for (const tab of state.tabs) {
      const graph = tabGraph(state, tab);
      let entry = evaluators.get(tab.id);
      if (!entry) {
        entry = { ev: createEvaluator(registryOf(state)), graph: undefined, composites: state.composites };
        evaluators.set(tab.id, entry);
      }
      if (entry.composites !== state.composites) {
        entry.ev = createEvaluator(registryOf(state));
        entry.graph = undefined;
        entry.composites = state.composites;
      }
      if (graph && graph !== entry.graph) {
        entry.graph = graph;
        entry.ev.setGraph(graph, Object.values(state.composites));
        const pending = [...entry.ev.pending()];
        if (pending.length > 0) markComputing[tab.id] = pending;
      }
    }

    const tabIds = Object.keys(markComputing);
    if (tabIds.length === 0) return;
    store.setState((draft: AppState) => {
      for (const tabId of tabIds) {
        const states = (draft.nodeStates[tabId] ??= {});
        const graph = tabGraph(draft, draft.tabs.find((t) => t.id === tabId));
        const alive = new Set(graph?.nodes.map((n) => n.id));
        for (const id of Object.keys(states)) if (!alive.has(id)) delete states[id];
        for (const id of markComputing[tabId]!) {
          const prev = states[id];
          states[id] = { status: 'computing', inputs: prev?.inputs ?? {}, outputs: prev?.outputs ?? {} };
        }
      }
    });
    if (!scheduled) {
      scheduled = true;
      schedule(flush);
    }
  }

  sync(store.getState());
  return store.subscribe((state, prev) => {
    if (state.workflows !== prev.workflows || state.composites !== prev.composites || state.tabs !== prev.tabs) {
      sync(state);
    }
  });
}
