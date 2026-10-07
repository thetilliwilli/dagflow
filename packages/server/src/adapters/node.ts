// Адаптер Node: node:http + ws (в Node 24 нет встроенного WebSocket-сервера, research R10)
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { CORS_HEADERS, httpReply } from '../http';
import { TRANSPORT_LIMIT } from '../session';
import { clientName, type RuntimeAdapter } from './runtime';

const PING_INTERVAL_MS = 30_000;

export const adapter: RuntimeAdapter = {
  args: () => process.argv.slice(2),
  exit: (code) => process.exit(code),
  onInterrupt: (fn) => {
    process.on('SIGINT', fn);
    process.on('SIGTERM', fn);
  },

  listen(options, connections) {
    return new Promise((resolve) => {
      const wss = new WebSocketServer({ noServer: true, maxPayload: TRANSPORT_LIMIT });
      // Заголовки доступа и на ответе 101 (FR-031)
      wss.on('headers', (headers) => {
        for (const [name, value] of Object.entries(CORS_HEADERS)) headers.push(`${name}: ${value}`);
      });

      const server = createServer((req, res) => {
        const reply = httpReply(req.method ?? 'GET');
        res.writeHead(reply.status, reply.headers);
        res.end(reply.body);
      });
      // WebSocket — на любом пути и с любым Origin
      server.on('upgrade', (req, socket, head) => {
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
      });

      wss.on('connection', (ws, req) => {
        const client = clientName(req.socket.remoteAddress, req.socket.remotePort);
        const connection = connections.open(
          { send: (text) => ws.send(text), close: (code) => ws.close(code) },
          client,
        );
        let alive = true;
        ws.on('pong', () => (alive = true));
        const ping = setInterval(() => {
          if (!alive) return ws.terminate();
          alive = false;
          ws.ping();
        }, PING_INTERVAL_MS);
        ws.on('message', (data, isBinary) => {
          if (!isBinary) connection.receive(data.toString());
        });
        // Без обработчика превышение maxPayload роняет процесс (research R10)
        ws.on('error', () => {});
        ws.on('close', () => {
          clearInterval(ping);
          connection.close();
        });
      });

      server.once('error', (e: NodeJS.ErrnoException) =>
        resolve({ ok: false, reason: e.code === 'EADDRINUSE' ? 'in-use' : 'cannot-listen' }),
      );
      server.listen(options.port, options.host, () => resolve({ ok: true }));
    });
  },
};
