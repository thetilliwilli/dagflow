// Реестр типов нодов: встроенные (+ составные — в US4, T077)
import { builtinNodes } from './builtins';
import type { CompositeDef, NodeRegistry, NodeTypeDef } from './types';

export function createRegistry(_composites: CompositeDef[] = []): NodeRegistry {
  const map = new Map<string, NodeTypeDef>(builtinNodes.map((d) => [d.id, d]));
  return {
    get: (typeId) => map.get(typeId),
    list: () => [...map.values()],
  };
}
