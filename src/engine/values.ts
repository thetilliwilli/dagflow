// Значения, типы портов и их совместимость (FR-005, FR-005a)
import { plural } from './errors';
import type { JsonValue, PortType } from './types';

export function isPlainObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function matchesType(value: JsonValue, type: PortType): boolean {
  switch (type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'text':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
    case 'any':
      return true;
  }
}

export function isCompatible(source: PortType, target: PortType): boolean {
  return source === target || source === 'any' || target === 'any';
}

export function deepEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]!));
  }
  if (isPlainObject(a)) {
    if (!isPlainObject(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => k in b && deepEqual(a[k]!, b[k]!));
  }
  return false;
}

/** Вид значения для сообщений «получено: <вид>». */
export function describeKind(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'массив';
  switch (typeof value) {
    case 'number':
      return 'число';
    case 'string':
      return 'текст';
    case 'boolean':
      return 'логическое значение';
    default:
      return 'объект';
  }
}

/** Короткое представление значения для отображения на ноде (FR-007a). */
export function formatCompact(value: JsonValue, maxLength = 40): string {
  if (Array.isArray(value)) {
    const json = JSON.stringify(value);
    if (json.length <= maxLength) return json;
    return `[${value.length} ${plural(value.length, 'элемент', 'элемента', 'элементов')}]`;
  }
  if (isPlainObject(value)) {
    const json = JSON.stringify(value);
    if (json.length <= maxLength) return json;
    const n = Object.keys(value).length;
    return `{${n} ${plural(n, 'поле', 'поля', 'полей')}}`;
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}
