// Адаптер Deno: Deno.serve + Deno.upgradeWebSocket (research R10). Запуск: deno run --allow-net
import { CORS_HEADERS, httpReply } from '../http';
import { clientName, type RuntimeAdapter } from './runtime';

const IDLE_TIMEOUT_S = 30;

export const adapter: RuntimeAdapter = {
  args: () => Deno.args,
  exit: (code) => Deno.exit(code),
  onInterrupt: (fn) => {
    Deno.addSignalListener('SIGINT', fn);
    Deno.addSignalListener('SIGTERM', fn);
  },

  async listen(options, connections) {
    try {
      Deno.serve(
        { port: options.port, hostname: options.host, onListen: () => {} },
        (req, info) => {
          if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
            const reply = httpReply(req.method);
            return new Response(reply.body || null, {
              status: reply.status,
              headers: reply.headers,
            });
          }
          // Адрес читаем до upgradeWebSocket: после него запрос закрыт
          const client = clientName(info.remoteAddr.hostname, info.remoteAddr.port);
          const { socket, response } = Deno.upgradeWebSocket(req, { idleTimeout: IDLE_TIMEOUT_S });
          for (const [name, value] of Object.entries(CORS_HEADERS))
            response.headers.set(name, value);
          socket.onopen = () => {
            const connection = connections.open(
              {
                send: (text) => socket.send(text),
                // WebSocket API Deno принимает только 1000 и 3000–4999: и превышение лимита
                // (1009 в Node) закрываем кодом 1000 — тесты проверяют факт закрытия (server-cli.md)
                close: () => socket.close(1000),
              },
              client,
            );
            socket.onmessage = (e) => {
              if (typeof e.data === 'string') connection.receive(e.data);
            };
            // Deno 2.9 после idleTimeout присылает close дважды — Connection.close идемпотентен
            socket.onclose = () => connection.close();
          };
          return response;
        },
      );
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        reason: e instanceof Deno.errors.AddrInUse ? 'in-use' : 'cannot-listen',
      };
    }
  },
};
