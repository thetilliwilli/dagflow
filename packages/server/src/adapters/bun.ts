// Адаптер Bun: встроенный Bun.serve с WebSocket (research R10)
import { CORS_HEADERS, httpReply } from '../http';
import { TRANSPORT_LIMIT, type Connection } from '../session';
import { clientName, type RuntimeAdapter } from './runtime';

const IDLE_TIMEOUT_S = 30;

interface SocketData {
  client: string;
  connection?: Connection;
}

export const adapter: RuntimeAdapter = {
  args: () => process.argv.slice(2),
  exit: (code) => process.exit(code),
  onInterrupt: (fn) => {
    process.on('SIGINT', fn);
    process.on('SIGTERM', fn);
  },

  async listen(options, connections) {
    try {
      Bun.serve<SocketData>({
        port: options.port,
        hostname: options.host,
        fetch(req, server) {
          const ip = server.requestIP(req);
          const data: SocketData = { client: clientName(ip?.address, ip?.port) };
          // WebSocket — на любом пути и с любым Origin; заголовки доступа и на 101 (FR-031)
          if (server.upgrade(req, { headers: CORS_HEADERS, data })) return undefined;
          const reply = httpReply(req.method);
          return new Response(reply.body || null, { status: reply.status, headers: reply.headers });
        },
        websocket: {
          maxPayloadLength: TRANSPORT_LIMIT,
          idleTimeout: IDLE_TIMEOUT_S,
          sendPings: true,
          open(ws) {
            ws.data.connection = connections.open(
              { send: (text) => ws.send(text), close: (code) => ws.close(code) },
              ws.data.client,
            );
          },
          message(ws, message) {
            if (typeof message === 'string') ws.data.connection?.receive(message);
          },
          close(ws) {
            ws.data.connection?.close();
          },
        },
      });
      return { ok: true };
    } catch (e) {
      const code = (e as { code?: string }).code;
      return { ok: false, reason: code === 'EADDRINUSE' ? 'in-use' : 'cannot-listen' };
    }
  },
};
