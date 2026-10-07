// Минимальные объявления API Bun и Deno — только то, что используют адаптеры (research R10).
// Вместо пакетов @types/bun и типов Deno: Bun и Deno — среды на машине, не зависимости npm.

interface BunServerWebSocket<T> {
  data: T;
  send(text: string): void;
  close(code?: number): void;
}

interface BunServer {
  upgrade<T>(req: Request, options: { headers?: Record<string, string>; data: T }): boolean;
  requestIP(req: Request): { address: string; port: number } | null;
}

interface BunServeOptions<T> {
  port: number;
  hostname: string;
  fetch(req: Request, server: BunServer): Response | undefined | Promise<Response | undefined>;
  websocket: {
    maxPayloadLength: number;
    /** Секунды без активности до закрытия; с sendPings Bun сам шлёт ping. */
    idleTimeout: number;
    sendPings: boolean;
    open(ws: BunServerWebSocket<T>): void;
    message(ws: BunServerWebSocket<T>, message: string | Uint8Array): void;
    close(ws: BunServerWebSocket<T>, code: number): void;
  };
}

declare const Bun: {
  serve<T>(options: BunServeOptions<T>): unknown;
};

interface DenoServeInfo {
  remoteAddr: { hostname: string; port: number };
}

interface DenoWebSocket {
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(text: string): void;
  close(code?: number): void;
}

declare const Deno: {
  args: string[];
  exit(code: number): never;
  addSignalListener(signal: 'SIGINT' | 'SIGTERM', handler: () => void): void;
  serve(
    options: { port: number; hostname: string; onListen?: () => void },
    handler: (req: Request, info: DenoServeInfo) => Response,
  ): unknown;
  upgradeWebSocket(
    req: Request,
    options: { idleTimeout: number },
  ): {
    socket: DenoWebSocket;
    response: Response;
  };
  errors: { AddrInUse: new (...args: never[]) => Error };
};
