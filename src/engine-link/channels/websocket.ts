// Канал «Server»: текстовые кадры WebSocket (research R4)
import type { Channel } from '@dagflow/protocol';

/** То, что нужно от браузерного WebSocket (в тестах — подделка). */
export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(text: string): void;
  close(code?: number): void;
}

/** Обернуть уже открытый сокет. Закрытие соединения любой стороной → onClose('closed') один раз. */
export function createWebSocketChannel(socket: SocketLike): Channel {
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    channel.onClose('closed');
  };
  const channel: Channel = {
    onMessage: () => {},
    onClose: () => {},
    send(text) {
      if (!closed) socket.send(text);
    },
    close() {
      socket.close();
      finish();
    },
  };
  socket.onmessage = (e) => {
    if (!closed) channel.onMessage(String(e.data));
  };
  socket.onerror = null;
  socket.onclose = finish;
  return channel;
}
