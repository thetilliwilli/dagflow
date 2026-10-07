import type { NodeTypeDef, PortDef, PortType } from '../types';

export const categories = {
  constants: 'Constants',
  math: 'Math',
  text: 'Text',
  logic: 'Comparison & logic',
  condition: 'Condition',
  collections: 'Arrays & objects',
  display: 'Display',
} as const;

/** Категория составных нодов пользователя в палитре. */
export const COMPOSITE_CATEGORY = 'My composite nodes';
/** Категория нодов «Input»/«Output» — видна только во вкладке составного нода. */
export const compositeCategory = 'Composite interface';
/** Описание составного нода, если пользователь его не задал. */
export const DEFAULT_COMPOSITE_DESCRIPTION = 'Composite node';

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
