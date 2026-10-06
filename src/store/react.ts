// Привязка стора к React: провайдер, селекторы, действия
import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createActions, type Actions } from './actions';
import type { AppState, AppStore } from './store';
import { UiProvider } from './ui';

const AppContext = createContext<AppStore | null>(null);

/** Основной стор и стор интерфейса (фича 002) — один провайдер на приложение. */
export function AppProvider({ app, children }: { app: AppStore; children: ReactNode }) {
  return createElement(
    AppContext.Provider,
    { value: app },
    createElement(UiProvider, { app, children }),
  );
}

export function useApp(): AppStore {
  const app = useContext(AppContext);
  if (!app) throw new Error('AppProvider не найден');
  return app;
}

export function useAppState<T>(selector: (state: AppState) => T): T {
  return useStore(useApp().store, selector);
}

export function useActions(): Actions {
  const app = useApp();
  return useMemo(() => createActions(app), [app]);
}
