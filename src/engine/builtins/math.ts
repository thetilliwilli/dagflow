import { NodeError } from '../errors';
import { categories, defineNode, out, req } from './define';

function finite(n: number): number {
  if (!Number.isFinite(n)) throw new NodeError('Результат слишком большой');
  return n;
}

function binary(id: string, title: string, description: string, op: (a: number, b: number) => number) {
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
  binary('builtin:add', 'Сложить', 'a + b', (a, b) => a + b),
  binary('builtin:subtract', 'Вычесть', 'a − b', (a, b) => a - b),
  binary('builtin:multiply', 'Умножить', 'a × b', (a, b) => a * b),
  binary('builtin:divide', 'Разделить', 'a ÷ b; делитель не может быть нулём', (a, b) => {
    if (b === 0) throw new NodeError('Деление на ноль: задайте ненулевой делитель');
    return a / b;
  }),
];
