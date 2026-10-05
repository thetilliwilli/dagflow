// Служебные ноды составного нода (FR-021a): «Вход», «Выход» и сквозной нод для вычисления экземпляров
import type { NodeTypeDef } from '../types';

export const IO_INPUT = 'builtin:input';
export const IO_OUTPUT = 'builtin:output';
/** Во что превращаются «Вход»/«Выход» экземпляра при разворачивании (research R3). Не виден в палитре. */
export const PASSTHROUGH = 'builtin:passthrough';

export const compositeCategory = 'Интерфейс составного нода';

export const ioNodes: NodeTypeDef[] = [
  {
    id: IO_INPUT,
    title: 'Вход',
    category: compositeCategory,
    description: 'Порты этого нода становятся входами составного нода. Внутри отдаёт значения по умолчанию.',
    inputs: [],
    outputs: [],
    paletteScope: 'composite',
  },
  {
    id: IO_OUTPUT,
    title: 'Выход',
    category: compositeCategory,
    description: 'Порты этого нода становятся выходами составного нода.',
    inputs: [],
    outputs: [],
    compute: () => ({}),
    paletteScope: 'composite',
  },
  {
    id: PASSTHROUGH,
    title: 'Порт составного нода',
    category: compositeCategory,
    description: 'Передаёт значения через границу составного нода.',
    inputs: [],
    outputs: [],
    compute: (inputs) => ({ ...inputs }),
    paletteScope: 'hidden',
  },
];
