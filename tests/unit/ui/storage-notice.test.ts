// Какое сообщение о хранилище показать в левой панели и нужна ли точка на кнопке меню (FR-006a)
import { describe, expect, it } from 'vitest';
import { storageNotice, type StorageNoticeInput } from '../../../src/ui/layout/storage-notice';

const base: StorageNoticeInput = {
  hasPersistence: true,
  prompt: null,
  location: { kind: 'browser' },
  folderSupported: true,
};

describe('storageNotice', () => {
  it('без контроллера хранения — ничего', () => {
    expect(storageNotice({ ...base, hasPersistence: false }, 'hint')).toBeNull();
  });

  it('предложения после выбора папки важнее подсказок', () => {
    expect(storageNotice({ ...base, prompt: { kind: 'copy-to-empty' } }, 'hidden')).toBe(
      'copy-to-empty',
    );
    expect(storageNotice({ ...base, prompt: { kind: 'add-from-browser' } }, 'hidden')).toBe(
      'add-from-browser',
    );
  });

  it('хранение недоступно — предупреждение, даже если подсказки скрыты', () => {
    expect(storageNotice({ ...base, location: { kind: 'none' } }, 'hidden')).toBe('unavailable');
  });

  it('данные в браузере: подсказка о папке → напоминание о выгрузке → ничего', () => {
    expect(storageNotice(base, 'hint')).toBe('hint');
    expect(storageNotice(base, 'reminder')).toBe('reminder');
    expect(storageNotice(base, 'hidden')).toBeNull();
  });

  it('браузер без поддержки папок — сразу напоминание о выгрузке', () => {
    expect(storageNotice({ ...base, folderSupported: false }, 'hint')).toBe('reminder');
  });

  it('данные в папке — сообщений нет', () => {
    expect(storageNotice({ ...base, location: { kind: 'folder' } }, 'hint')).toBeNull();
  });
});
