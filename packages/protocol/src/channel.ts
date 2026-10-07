// Канал между клиентом и хостом: строки JSON в обе стороны (contracts/protocol.md, research R4)

/** Упорядоченный дуплексный канал. Реализации — адаптеры среды (in-memory, Worker, WebSocket). */
export interface Channel {
  send(text: string): void;
  close(): void;
  onMessage: (text: string) => void;
  /** `crashed` — среда хоста упала (фоновый поток), `closed` — соединение закрыто. */
  onClose: (reason: 'closed' | 'crashed') => void;
}

/** Размер строки в байтах UTF-8 — без TextEncoder (ядро sans-IO). */
export function byteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}
