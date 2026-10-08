// Стор интерфейса (research R4): живёт в памяти, не сохраняется и не попадает в историю отмены
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { activeTab, tabGraph, type AppStore } from './store';
import * as logic from './ui-logic';
import type { LinkEnd } from '@dagflow/engine';
import type { LinkIntent, Point, StorageHint, UiState, WindowId } from './ui-logic';

export type UiStoreApi = StoreApi<UiState>;

export function createUiStore(): UiStoreApi {
  return createStore<UiState>(() => logic.initialUiState());
}

/** Смена вкладки сбрасывает выделение и окна вкладки; правка графа убирает исчезнувшие ноды. */
export function bindUiToApp(ui: UiStoreApi, app: AppStore): () => void {
  return app.store.subscribe((state, prev) => {
    if (state.activeTabId !== prev.activeTabId) {
      ui.setState(logic.resetForTab(ui.getState()), true);
      return;
    }
    const graph = tabGraph(state, activeTab(state));
    if (graph && graph !== tabGraph(prev, activeTab(prev)))
      ui.setState(logic.pruneMissing(ui.getState(), graph), true);
  });
}

export interface UiActions {
  openWindow(id: WindowId): void;
  closeWindow(id: WindowId): void;
  toggleWindow(id: WindowId): void;
  focusWindow(id: WindowId): void;
  setWindowPosition(id: WindowId, position: Point): void;
  setPaletteCategory(category: string): void;
  setStorageHint(stage: StorageHint): void;
  setSelection(selection: string[]): void;
  openEdgeWindow(source: string, target: string, at: Point): void;
  escape(): void;
  pressLink(from: LinkEnd, at: Point, onMarker: boolean): void;
  movePointer(at: Point): void;
  releasePointer(): void;
  setPeek(peek: string | null): void;
  /** Бросок/щелчок по строке временного окна; возвращает, что сделать (связать или объяснить). */
  linkTo(to: LinkEnd, check: { ok: true } | { ok: false; message: string }): LinkIntent;
  cancelLinking(): void;
}

export function createUiActions(ui: UiStoreApi): UiActions {
  const apply = (next: UiState) => {
    if (next !== ui.getState()) ui.setState(next, true);
  };
  const s = () => ui.getState();
  return {
    openWindow: (id) => apply(logic.openWindow(s(), id)),
    closeWindow: (id) => apply(logic.closeWindow(s(), id)),
    toggleWindow: (id) => apply(logic.toggleWindow(s(), id)),
    focusWindow: (id) => apply(logic.focusWindow(s(), id)),
    setWindowPosition: (id, position) => apply(logic.setWindowPosition(s(), id, position)),
    setPaletteCategory: (category) => apply(logic.setPaletteCategory(s(), category)),
    setStorageHint: (stage) => apply(logic.setStorageHint(s(), stage)),
    setSelection: (selection) => apply(logic.setSelection(s(), selection)),
    openEdgeWindow: (source, target, at) => apply(logic.openEdgeWindow(s(), source, target, at)),
    escape: () => apply(logic.escape(s())),
    pressLink: (from, at, onMarker) => apply(logic.pressLink(s(), from, at, onMarker)),
    movePointer: (at) => apply(logic.movePointer(s(), at)),
    releasePointer: () => apply(logic.releasePointer(s())),
    setPeek: (peek) => apply(logic.setPeek(s(), peek)),
    linkTo: (to, check) => {
      const r = logic.linkTo(s(), to, check);
      apply(r.state);
      return r.intent;
    },
    cancelLinking: () => apply(logic.cancelLinking(s())),
  };
}

const UiContext = createContext<UiStoreApi | null>(null);

/** Создаёт стор интерфейса для приложения и связывает его с основным стором. */
export function UiProvider({ app, children }: { app: AppStore; children: ReactNode }) {
  const [ui] = useState(createUiStore);
  useEffect(() => bindUiToApp(ui, app), [ui, app]);
  return createElement(UiContext.Provider, { value: ui }, children);
}

export function useUiStore(): UiStoreApi {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('UiProvider не найден');
  return ui;
}

export function useUi<T>(selector: (state: UiState) => T): T {
  return useStore(useUiStore(), selector);
}

export function useUiActions(): UiActions {
  const ui = useUiStore();
  return useMemo(() => createUiActions(ui), [ui]);
}
