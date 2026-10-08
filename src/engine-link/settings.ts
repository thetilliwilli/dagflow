// Цель вычисления и список серверов в IndexedDB браузера (FR-006, research R16). В файлы workflow не попадает
import { get, set } from 'idb-keyval';
import * as v from 'valibot';
import { rememberServer, MAX_RECENT } from './recent';
import type { EngineTarget, RecentServer } from './types';

export const ENGINE_SETTINGS_KEY = 'dagflow:engine';

export interface EngineSettings {
  version: 1;
  target: EngineTarget;
  recent: RecentServer[];
}

/** Доступ к хранилищу — переданный, чтобы тесты обходились без IndexedDB (как location.ts). */
export interface SettingsEnv {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export const browserSettingsEnv = (): SettingsEnv => ({ get, set });

const AddressSchema = v.pipe(v.string(), v.minLength(1));

const EngineSettingsSchema = v.object({
  version: v.literal(1),
  target: v.variant('kind', [
    v.object({ kind: v.literal('local') }),
    v.object({ kind: v.literal('worker') }),
    v.object({ kind: v.literal('server'), address: AddressSchema }),
  ]),
  recent: v.pipe(
    v.array(v.object({ address: AddressSchema, scheme: v.optional(v.picklist(['ws', 'wss'])) })),
    v.maxLength(MAX_RECENT),
  ),
});

const defaults = (): EngineSettings => ({ version: 1, target: { kind: 'local' }, recent: [] });

/** Прочитать один раз при старте окна; отсутствие или повреждение → по умолчанию (принцип III). */
export async function loadEngineSettings(env: SettingsEnv): Promise<EngineSettings> {
  let stored: unknown;
  try {
    stored = await env.get(ENGINE_SETTINGS_KEY);
  } catch {
    return defaults();
  }
  const parsed = v.safeParse(EngineSettingsSchema, stored);
  if (!parsed.success) return defaults();
  const settings = parsed.output as EngineSettings;
  // Инвариант: выбранный сервер есть в списке
  const { target } = settings;
  if (target.kind === 'server' && !settings.recent.some((r) => r.address === target.address)) {
    return { ...settings, recent: rememberServer(settings.recent, target.address) };
  }
  return settings;
}

/** Записать целиком: последнее изменение из любого окна побеждает (FR-006, US4 #10). */
export async function saveEngineSettings(
  env: SettingsEnv,
  settings: Pick<EngineSettings, 'target' | 'recent'>,
): Promise<void> {
  await env.set(ENGINE_SETTINGS_KEY, {
    version: 1,
    target: settings.target,
    recent: settings.recent,
  });
}
