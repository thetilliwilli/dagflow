// Ошибки движка и тексты для пользователя (принцип IV, FR-032)
import type { PortType } from './types';

/** Ошибка вычисления нода с текстом для пользователя. */
export class NodeError extends Error {
  constructor(public userMessage: string) {
    super(userMessage);
    this.name = 'NodeError';
  }
}

export type RejectCode =
  | 'cycle'
  | 'type-mismatch'
  | 'same-node'
  | 'unknown-port'
  | 'unknown-type'
  | 'input-occupied'
  | 'duplicate-port-name'
  | 'composite-recursion'
  | 'io-node-outside-composite'
  | 'same-side'
  | 'empty-name';

export type Rejection = { ok: false; code: RejectCode; message: string };

export const typeNames: Record<PortType, string> = {
  number: 'number',
  text: 'text',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
  any: 'any',
};

function reject(code: RejectCode, message: string): Rejection {
  return { ok: false, code, message };
}

export const rejections = {
  cycle: () =>
    reject(
      'cycle',
      'Cannot link: this connection would create a cycle, and the graph must stay acyclic.',
    ),
  sameNode: () => reject('same-node', 'Cannot link a node to itself.'),
  typeMismatch: (from: PortType, to: PortType) =>
    reject(
      'type-mismatch',
      `Incompatible types: ${typeNames[from]} → ${typeNames[to]}. Link ports of the same type or use a port of type “any”.`,
    ),
  unknownPort: (port: string) => reject('unknown-port', `Port “${port}” not found.`),
  unknownType: (typeId: string) => reject('unknown-type', `Unknown node type: ${typeId}.`),
  inputOccupied: (port: string) =>
    reject('input-occupied', `Input “${port}” has more than one link.`),
  compositeRecursion: (title: string) =>
    reject(
      'composite-recursion',
      `Cannot put composite node “${title}” inside itself (directly or through other composite nodes).`,
    ),
  ioOutsideComposite: () =>
    reject(
      'io-node-outside-composite',
      'Input and Output nodes can only be added inside a composite node.',
    ),
  sameSide: (side: 'in' | 'out') =>
    reject(
      'same-side',
      `${side === 'in' ? 'Cannot link an input to an input' : 'Cannot link an output to an output'}: a link goes from an output of one node to an input of another.`,
    ),
  emptyName: () =>
    reject('empty-name', 'The node name cannot be empty. Enter at least one character.'),
  emptyPortName: () => reject('duplicate-port-name', 'The port name cannot be empty.'),
  duplicatePort: (name: string, kind: 'input' | 'output') =>
    reject(
      'duplicate-port-name',
      `Port “${name}” already exists on another ${kind === 'input' ? 'Input' : 'Output'} node. Port names must be unique.`,
    ),
  emptySelection: () => reject('unknown-port', 'Select at least one node.'),
  collapseIo: () =>
    reject(
      'io-node-outside-composite',
      'Input and Output nodes cannot be collapsed into a composite node.',
    ),
};

/** Сообщения о состоянии нода при вычислении (FR-032 001). */
export const stateMessages = {
  fillInput: (port: string) => `Fill in input “${port}”.`,
  upstreamWaiting: (name: string) => `Node “${name}” upstream is waiting for inputs.`,
  upstreamFailed: (name: string) => `Node “${name}” upstream failed.`,
  noOutputValue: (port: string, name: string) => `No value on output “${port}” of node “${name}”.`,
  unknownType: (typeId: string) => `Unknown node type: ${typeId}.`,
  internalError: (title: string) => `Internal error in node “${title}”.`,
};

/** Виды значений для сообщений «got: <вид>». */
export const kindNames = {
  null: 'null',
  array: 'array',
  number: 'number',
  text: 'text',
  boolean: 'boolean',
  object: 'object',
};

/** Компактный вид массива и объекта на ноде: «[items: 3]», «{fields: 2}» (без склонения, FR-005). */
export const compactFormats = {
  array: (n: number) => `[items: ${n}]`,
  object: (n: number) => `{fields: ${n}}`,
};

/** Ошибки вычисления встроенных нодов. */
export const nodeErrors = {
  divisionByZero: 'Division by zero: set a non-zero divisor.',
  tooLarge: 'The result is too large.',
  expectedArray: (kind: string) => `Expected an array, got: ${kind}.`,
  expectedObject: (kind: string) => `Expected an object, got: ${kind}.`,
  indexNotInteger: (index: number) => `The index must be an integer, got: ${index}.`,
  indexOutOfRange: (index: number, n: number) =>
    `Index ${index} is out of range: array length is ${n}.`,
  fieldNotFound: (key: string) => `Field “${key}” not found.`,
  notANumber: (text: string) => `“${text}” is not a number.`,
};
