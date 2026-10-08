// Соединения сервера: сокет ↔ хост протокола, журнал и лимит (общий код для Node, Bun, Deno)
import {
  byteLength,
  createEngineHost,
  MAX_MESSAGE_BYTES,
  type HostMessage,
} from '@dagflow/protocol';
import { serverMessages } from './messages';

/** Лимит транспорта: чуть больше лимита протокола, чтобы на 8 МБ ответить too-large (research R10). */
export const TRANSPORT_LIMIT = MAX_MESSAGE_BYTES + 1024;

/** Сокет, каким его видит общий код: адаптер среды оборачивает свой WebSocket. */
export interface SessionSocket {
  send(text: string): void;
  close(code?: number): void;
}

export interface Connection {
  receive(text: string): void;
  /** Сокет закрыт: освободить хост и все документы (FR-018). Повторный вызов ничего не делает. */
  close(): void;
}

export interface ConnectionsOptions {
  log: (line: string) => void;
  verbose: boolean;
  /** Отложить пересчёт (адаптер: setTimeout 0). */
  schedule: (fn: () => void) => void;
}

/** Тип и вкладка сообщения — только для журнала --verbose; содержимое не печатается (FR-030a). */
function describe(text: string): { type: string; doc?: string } {
  try {
    const msg = JSON.parse(text) as { type?: unknown; doc?: unknown };
    return {
      type: typeof msg.type === 'string' ? msg.type : '?',
      doc: typeof msg.doc === 'string' ? msg.doc : undefined,
    };
  } catch {
    return { type: '?' };
  }
}

export function createConnections({ log, verbose, schedule }: ConnectionsOptions) {
  let count = 0;

  function open(socket: SessionSocket, client: string): Connection {
    let host: ReturnType<typeof createEngineHost> | null = createEngineHost();
    let scheduled = false;
    count += 1;
    log(serverMessages.connected(client, count));

    function send(replies: HostMessage[]) {
      for (const reply of replies) {
        const text = JSON.stringify(reply);
        if (verbose) {
          const doc = 'doc' in reply ? reply.doc : undefined;
          log(serverMessages.message(client, 'out', reply.type, doc, byteLength(text)));
        }
        if (reply.type === 'error') log(serverMessages.errorFrom(client, reply.code));
        socket.send(text);
      }
    }

    function planTick() {
      if (scheduled || !host?.needsTick()) return;
      scheduled = true;
      schedule(() => {
        scheduled = false;
        if (!host) return;
        send(host.tick());
      });
    }

    const connection: Connection = {
      receive(text) {
        if (!host) return;
        // Лимит транспорта — в байтах UTF-8, как у ws и Bun (Deno: лимит делает этот код)
        if (text.length > TRANSPORT_LIMIT || byteLength(text) > TRANSPORT_LIMIT) {
          socket.close(1009);
          return;
        }
        if (verbose) {
          const { type, doc } = describe(text);
          log(serverMessages.message(client, 'in', type, doc, byteLength(text)));
        }
        send(host.receive(text));
        if (host.closed) socket.close(1000);
        else planTick();
      },
      close() {
        if (!host) return;
        host = null;
        count -= 1;
        log(serverMessages.disconnected(client, count));
      },
    };
    return connection;
  }

  return { open, count: () => count };
}
