import { NodeError, nodeErrors } from '../errors';
import { categories, defineNode, out, req } from './define';

function finite(n: number): number {
  if (!Number.isFinite(n)) throw new NodeError(nodeErrors.tooLarge);
  return n;
}

function binary(
  id: string,
  title: string,
  description: string,
  op: (a: number, b: number) => number,
) {
  return defineNode({
    id,
    title,
    category: categories.math,
    description,
    inputs: [req('a', 'number'), req('b', 'number')],
    outputs: [out('result', 'number')],
    compute: (i) => ({ result: finite(op(i.a as number, i.b as number)) }),
  });
}

export const mathNodes = [
  binary('builtin:add', 'Add', 'a + b', (a, b) => a + b),
  binary('builtin:subtract', 'Subtract', 'a − b', (a, b) => a - b),
  binary('builtin:multiply', 'Multiply', 'a × b', (a, b) => a * b),
  binary('builtin:divide', 'Divide', 'a ÷ b; the divisor must not be zero', (a, b) => {
    if (b === 0) throw new NodeError(nodeErrors.divisionByZero);
    return a / b;
  }),
];
