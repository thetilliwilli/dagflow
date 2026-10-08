// Ответы на обычные HTTP-запросы и заголовки доступа (contracts/server-cli.md, FR-031)
import { ENGINE_VERSION } from '@dagflow/engine';
import { serverMessages } from './messages';

/** Доступ осознанно открыт для любого источника; защита — BACKLOG «Защита сервера выполнения». */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Private-Network': 'true',
};

export interface HttpReply {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Ответ на запрос без upgrade: OPTIONS → 204, остальное → 200 с версией. */
export function httpReply(method: string): HttpReply {
  if (method.toUpperCase() === 'OPTIONS') return { status: 204, headers: CORS_HEADERS, body: '' };
  return {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    body: serverMessages.httpBody(ENGINE_VERSION),
  };
}
