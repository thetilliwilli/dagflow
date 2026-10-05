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
