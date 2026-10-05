import type { NodeTypeDef, PortDef, PortType } from '../types';

export const categories = {
  constants: 'Константы',
  math: 'Арифметика',
  text: 'Текст',
  logic: 'Сравнение и логика',
  condition: 'Условие',
  collections: 'Массивы и объекты',
  display: 'Отображение',
} as const;

/** Обязательный вход. */
export function req(name: string, type: PortType): PortDef {
  return { name, type, required: true };
}

/** Выход. */
export function out(name: string, type: PortType): PortDef {
  return { name, type };
}

export function defineNode(def: NodeTypeDef): NodeTypeDef {
  return def;
}
