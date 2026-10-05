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
  | 'io-node-outside-composite';

export type Rejection = { ok: false; code: RejectCode; message: string };

export const typeNames: Record<PortType, string> = {
  number: 'число',
  text: 'текст',
  boolean: 'логическое',
  array: 'массив',
  object: 'объект',
  any: 'любое',
};

function reject(code: RejectCode, message: string): Rejection {
  return { ok: false, code, message };
}

export const rejections = {
  cycle: () => reject('cycle', 'Нельзя соединить: связь образует цикл, а граф должен оставаться без циклов.'),
  sameNode: () => reject('same-node', 'Нельзя соединить нод с самим собой.'),
  typeMismatch: (from: PortType, to: PortType) =>
    reject(
      'type-mismatch',
      `Несовместимые типы: ${typeNames[from]} → ${typeNames[to]}. Соедините порты одного типа или используйте порт типа «любое».`,
    ),
  unknownPort: (port: string) => reject('unknown-port', `Порт «${port}» не найден.`),
  unknownType: (typeId: string) => reject('unknown-type', `Неизвестный тип нода: ${typeId}.`),
  inputOccupied: (port: string) => reject('input-occupied', `К входу «${port}» подключено больше одной связи.`),
  compositeRecursion: (title: string) =>
    reject('composite-recursion', `Нельзя поместить составной нод «${title}» внутрь самого себя (напрямую или через другие составные ноды).`),
  ioOutsideComposite: () =>
    reject('io-node-outside-composite', 'Ноды «Вход» и «Выход» можно добавлять только внутри составного нода.'),
};

export function internalErrorMessage(title: string): string {
  return `Внутренняя ошибка нода "${title}"`;
}

/** Склонение по числу: plural(1, 'элемент', 'элемента', 'элементов'). */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
