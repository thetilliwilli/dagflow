// Служебные ноды составного нода (FR-021a): «Вход», «Выход» и сквозной нод для вычисления экземпляров
import type { NodeTypeDef } from '../types';
import { compositeCategory } from './define';

export const IO_INPUT = 'builtin:input';
export const IO_OUTPUT = 'builtin:output';
/** Во что превращаются «Вход»/«Выход» экземпляра при разворачивании (research R3). Не виден в палитре. */
export const PASSTHROUGH = 'builtin:passthrough';

export const ioNodes: NodeTypeDef[] = [
  {
    id: IO_INPUT,
    title: 'Input',
    category: compositeCategory,
    description: 'Ports of this node become inputs of the composite node. Inside, it gives default values.',
    inputs: [],
    outputs: [],
    paletteScope: 'composite',
  },
  {
    id: IO_OUTPUT,
    title: 'Output',
    category: compositeCategory,
    description: 'Ports of this node become outputs of the composite node.',
    inputs: [],
    outputs: [],
    compute: () => ({}),
    paletteScope: 'composite',
  },
  {
    id: PASSTHROUGH,
    title: 'Composite port',
    category: compositeCategory,
    description: 'Passes values across the composite node boundary.',
    inputs: [],
    outputs: [],
    compute: (inputs) => ({ ...inputs }),
    paletteScope: 'hidden',
  },
];
