// Адаптер Deno — реализуется в US5 (T054); пока запуск в Deno сообщает, что он не готов
import type { RuntimeAdapter } from './runtime';

export const adapter: RuntimeAdapter = {
  args: () => [],
  exit: () => {
    throw new Error('Deno adapter is not implemented yet.');
  },
  onInterrupt: () => {},
  listen: () => Promise.reject(new Error('Deno adapter is not implemented yet.')),
};
