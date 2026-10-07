// Адаптер Bun — реализуется в US5 (T053); пока запуск в Bun сообщает, что он не готов
import type { RuntimeAdapter } from './runtime';

export const adapter: RuntimeAdapter = {
  args: () => [],
  exit: () => {
    throw new Error('Bun adapter is not implemented yet.');
  },
  onInterrupt: () => {},
  listen: () => Promise.reject(new Error('Bun adapter is not implemented yet.')),
};
