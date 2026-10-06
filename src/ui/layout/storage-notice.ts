// Какое сообщение о хранилище показать вверху левой панели (FR-006a). Та же функция решает,
// гореть ли точке на кнопке меню.
import type { StorageHint } from '../../store/ui-logic';

export type StorageNotice =
  'copy-to-empty' | 'add-from-browser' | 'unavailable' | 'hint' | 'reminder';

export interface StorageNoticeInput {
  /** Есть контроллер хранения (в части компонентных тестов его нет). */
  hasPersistence: boolean;
  prompt: { kind: string } | null;
  location: { kind: string } | null;
  folderSupported: boolean;
}

export function storageNotice(input: StorageNoticeInput, stage: StorageHint): StorageNotice | null {
  if (!input.hasPersistence) return null;
  if (input.prompt?.kind === 'copy-to-empty') return 'copy-to-empty';
  if (input.prompt?.kind === 'add-from-browser') return 'add-from-browser';
  if (input.location?.kind === 'none') return 'unavailable';
  if (stage === 'hidden' || input.location?.kind !== 'browser') return null;
  // Подсказка о папке → напоминание о выгрузке → скрыто (US3 #2 фичи 001)
  return input.folderSupported && stage === 'hint' ? 'hint' : 'reminder';
}
