// Настройки цели в браузере: ключ dagflow:engine (FR-006, data-model «Настройки engine»)
import { describe, expect, it } from 'vitest';
import {
  ENGINE_SETTINGS_KEY,
  loadEngineSettings,
  saveEngineSettings,
  type SettingsEnv,
} from '../../../src/engine-link/settings';

function fakeEnv(initial?: unknown) {
  const data = new Map<string, unknown>();
  if (initial !== undefined) data.set(ENGINE_SETTINGS_KEY, initial);
  const env: SettingsEnv = {
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, value),
  };
  return { env, data };
}

const DEFAULTS = { version: 1, target: { kind: 'local' }, recent: [] };

describe('настройки engine', () => {
  it('ключ — dagflow:engine', () => {
    expect(ENGINE_SETTINGS_KEY).toBe('dagflow:engine');
  });

  it('настроек нет → по умолчанию Local и пустой список', async () => {
    expect(await loadEngineSettings(fakeEnv().env)).toEqual(DEFAULTS);
  });

  it.each([
    ['не объект', 'oops'],
    ['другая версия', { version: 2, target: { kind: 'local' }, recent: [] }],
    ['неизвестная цель', { version: 1, target: { kind: 'cloud' }, recent: [] }],
    [
      'больше 5 серверов',
      {
        version: 1,
        target: { kind: 'local' },
        recent: Array.from({ length: 6 }, (_, i) => ({ address: `a:${i}` })),
      },
    ],
    [
      'неверная схема',
      { version: 1, target: { kind: 'local' }, recent: [{ address: 'a:1', scheme: 'http' }] },
    ],
  ])('повреждённые (%s) → по умолчанию, без ошибки', async (_name, stored) => {
    expect(await loadEngineSettings(fakeEnv(stored).env)).toEqual(DEFAULTS);
  });

  it('ошибка чтения IndexedDB → по умолчанию', async () => {
    const env: SettingsEnv = {
      get: () => Promise.reject(new Error('blocked')),
      set: async () => {},
    };
    expect(await loadEngineSettings(env)).toEqual(DEFAULTS);
  });

  it('сохранённое читается как есть', async () => {
    const stored = {
      version: 1,
      target: { kind: 'server', address: 'localhost:8080' },
      recent: [{ address: 'localhost:8080', scheme: 'ws' }, { address: 'domain.com' }],
    };
    expect(await loadEngineSettings(fakeEnv(stored).env)).toEqual(stored);
  });

  it('цель-сервер, которого нет в списке, добавляется в конец (инвариант data-model)', async () => {
    const stored = {
      version: 1,
      target: { kind: 'server', address: 'x:1' },
      recent: [{ address: 'y:2' }],
    };
    expect((await loadEngineSettings(fakeEnv(stored).env)).recent).toEqual([
      { address: 'y:2' },
      { address: 'x:1' },
    ]);
  });

  it('save записывает настройки целиком под ключом', async () => {
    const { env, data } = fakeEnv();
    await saveEngineSettings(env, { target: { kind: 'worker' }, recent: [{ address: 'a:1' }] });
    expect(data.get('dagflow:engine')).toEqual({
      version: 1,
      target: { kind: 'worker' },
      recent: [{ address: 'a:1' }],
    });
  });
});
