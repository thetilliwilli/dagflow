// Контроллер хранения в React-контексте (необязателен: компонентные тесты работают без него)
import { createContext, createElement, useContext, type ReactNode } from 'react';
import type { Persistence } from './persistence';

const PersistenceContext = createContext<Persistence | null>(null);

export function PersistenceProvider({ persistence, children }: { persistence: Persistence; children: ReactNode }) {
  return createElement(PersistenceContext.Provider, { value: persistence }, children);
}

export function usePersistence(): Persistence | null {
  return useContext(PersistenceContext);
}
