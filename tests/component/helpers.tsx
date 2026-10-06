import { fireEvent, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { useUiActions, type UiActions } from '../../src/store/ui';
import { createAppStore, type AppStore } from '../../src/store/store';

/** Планировщик кадров для тестов: вместо requestAnimationFrame копит колбэки до flushFrames(). */
export function manualScheduler() {
  const queue: Array<() => void> = [];
  return {
    schedule: (fn: () => void) => {
      queue.push(fn);
    },
    flushFrames: () => {
      while (queue.length > 0) queue.shift()!();
    },
  };
}

/** Стор с предсказуемыми id и временем. */
export function testStore(): AppStore {
  let seq = 0;
  return createAppStore({ newId: () => `id${++seq}`, now: () => '2026-10-05T00:00:00.000Z' });
}

/** Открывает левую панель кнопкой меню (фича 002: панель — плавающее окно за кнопкой ☰). */
export function openSidebar() {
  const button = screen.getByRole('button', { name: 'Menu' });
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button);
  return screen.getByRole('dialog', { name: 'Workflows & storage' });
}

/** Открывает палитру Пробелом и, если задано, вкладку категории (фича 002). */
export function openPalette(category?: string) {
  if (!screen.queryByRole('dialog', { name: 'Palette' })) {
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
  }
  const palette = screen.getByRole('dialog', { name: 'Palette' });
  if (category) fireEvent.click(within(palette).getByRole('tab', { name: category }));
  return palette;
}

/** Отдаёт тесту действия стора интерфейса (выделение, окна) — рендерится внутри AppProvider. */
export function UiProbe({ onReady }: { onReady: (ui: UiActions) => void }) {
  const ui = useUiActions();
  useEffect(() => {
    onReady(ui);
  }, [ui, onReady]);
  return null;
}
