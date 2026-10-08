// Реестр типов нодов для текущего набора составных нодов (кэш по ссылке на composites)
import { createRegistry, type NodeRegistry } from '@dagflow/engine';
import type { AppState } from './store';

let cachedFor: AppState['composites'] | null = null;
let cached: NodeRegistry | null = null;

export function registryOf(state: AppState): NodeRegistry {
  if (cachedFor !== state.composites || !cached) {
    cached = createRegistry(Object.values(state.composites));
    cachedFor = state.composites;
  }
  return cached;
}
