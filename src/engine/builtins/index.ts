import type { NodeTypeDef } from '../types';
import { collectionNodes } from './collections';
import { constantNodes } from './constants';
import { logicNodes } from './logic';
import { mathNodes } from './math';
import { displayNodes } from './show';
import { textNodes } from './text';

export { categories } from './define';

/** Встроенные ноды в порядке палитры (contracts/builtin-nodes.md). */
export const builtinNodes: NodeTypeDef[] = [
  ...constantNodes,
  ...mathNodes,
  ...textNodes,
  ...logicNodes,
  ...collectionNodes,
  ...displayNodes,
];
