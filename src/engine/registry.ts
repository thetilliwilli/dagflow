// Реестр типов нодов: встроенные, служебные «Вход»/«Выход» и составные (T077)
import { builtinNodes } from './builtins';
import { COMPOSITE_CATEGORY, DEFAULT_COMPOSITE_DESCRIPTION } from './builtins/define';
import { ioNodes } from './builtins/io';
import { compositePorts } from './composite';
import type { CompositeDef, NodeRegistry, NodeTypeDef } from './types';

export { COMPOSITE_CATEGORY };

export function createRegistry(composites: CompositeDef[] = []): NodeRegistry {
  const map = new Map<string, NodeTypeDef>([...builtinNodes, ...ioNodes].map((d) => [d.id, d]));
  for (const c of composites) {
    const ports = compositePorts(c);
    map.set(`composite:${c.id}`, {
      id: `composite:${c.id}`,
      title: c.name,
      category: COMPOSITE_CATEGORY,
      description: c.description || DEFAULT_COMPOSITE_DESCRIPTION,
      inputs: ports.inputs,
      outputs: ports.outputs,
    });
  }
  return {
    get: (typeId) => map.get(typeId),
    list: () => [...map.values()],
  };
}
