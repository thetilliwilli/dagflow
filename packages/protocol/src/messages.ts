// Сообщения протокола редактор ↔ engine, версия 1 (contracts/protocol.md)
import type { CompositeDef, Graph, NodeState } from '@dagflow/engine';

/** Целое; поднимается вручную при несовместимом изменении обмена (spec, Assumptions). */
export const PROTOCOL_VERSION = 1;

/** Лимит одного сообщения в байтах UTF-8 (FR-024). */
export const MAX_MESSAGE_BYTES = 8 * 1024 * 1024;

/** Документ = открытая вкладка редактора; id выбирает клиент. */
export type DocId = string;
/** Целое ≥ 1, растёт на каждое изменение документа на клиенте. */
export type Rev = number;

// ── Клиент → хост ─────────────────────────────────────────────
export interface Hello {
  type: 'hello';
  protocol: number;
  engine: string;
}
export interface SetLibrary {
  type: 'library';
  composites: CompositeDef[];
}
export interface OpenDoc {
  type: 'open';
  doc: DocId;
  rev: Rev;
  graph: Graph;
}
export interface UpdateDoc {
  type: 'update';
  doc: DocId;
  rev: Rev;
  graph: Graph;
}
export interface CloseDoc {
  type: 'close';
  doc: DocId;
}
export type ClientMessage = Hello | SetLibrary | OpenDoc | UpdateDoc | CloseDoc;

// ── Хост → клиент ─────────────────────────────────────────────
export interface Welcome {
  type: 'welcome';
  protocol: number;
  engine: string;
}
export interface Pending {
  type: 'pending';
  doc: DocId;
  rev: Rev;
  nodes: string[];
}
export interface States {
  type: 'states';
  doc: DocId;
  rev: Rev;
  states: Record<string, NodeState>;
}
export interface ProtocolError {
  type: 'error';
  code: ErrorCode;
  doc?: DocId;
  /** Техническая деталь для журнала; пользователю — текст клиента по code. */
  detail?: string;
}
export type HostMessage = Welcome | Pending | States | ProtocolError;

export type ErrorCode =
  | 'version-mismatch' // protocol в hello ≠ PROTOCOL_VERSION; хост закрывает соединение
  | 'invalid-message' // не JSON или не прошло схему
  | 'not-ready' // сообщение до hello
  | 'unknown-doc' // update/close по неоткрытому документу
  | 'too-large' // сообщение больше MAX_MESSAGE_BYTES
  | 'internal'; // исключение хоста при обработке
