// Адрес сервера выполнения: короткий ввод пользователя → нормализованный адрес и порядок схем (R8, R9)

export type Scheme = 'ws' | 'wss';

export type ParsedAddress = { ok: true; address: string; hint?: Scheme } | { ok: false };

const SCHEME_HINTS: Record<string, Scheme> = { ws: 'ws', wss: 'wss', http: 'ws', https: 'wss' };

/**
 * `localhost:8080`, `domain.com/path`, `[::1]:8080`, необязательно со схемой ws/wss/http/https.
 * Порт берётся ровно как введён (URL отбрасывает «стандартный» порт схемы — поэтому разбираем сами).
 */
const ADDRESS = /^(?:([a-z]+):\/\/)?(\[[0-9a-f:.]+\]|[^/:[\]?#]+)(?::(\d+))?(\/[^?#]*)?$/i;

export function parseAddress(input: string): ParsedAddress {
  const text = input.trim();
  if (text === '' || /\s|@/.test(text)) return { ok: false };
  const m = ADDRESS.exec(text);
  if (!m) return { ok: false };
  const [, scheme, rawHost, port, path] = m;
  let hint: Scheme | undefined;
  if (scheme) {
    hint = SCHEME_HINTS[scheme.toLowerCase()];
    if (!hint) return { ok: false };
  }
  if (port !== undefined) {
    const n = Number(port);
    if (n < 1 || n > 65535) return { ok: false };
  }
  const host = rawHost!.toLowerCase();
  // Проверка допустимых символов хоста стандартным парсером
  try {
    if (new URL(`http://${host}`).host === '') return { ok: false };
  } catch {
    return { ok: false };
  }
  const tail = (path ?? '').replace(/\/+$/, '');
  const address = `${host}${port !== undefined ? `:${port}` : ''}${tail}`;
  return hint ? { ok: true, address, hint } : { ok: true, address };
}

function hostOf(address: string): string {
  const m = /^(\[[^\]]+\]|[^/:]+)/.exec(address);
  return (m?.[1] ?? '').toLowerCase();
}

/** Адрес этого компьютера: localhost, *.localhost, 127.0.0.0/8, [::1] (spec, Assumptions). */
export function isLocalHost(address: string): boolean {
  const host = hostOf(address);
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    /^127\.\d+\.\d+\.\d+$/.test(host) ||
    /^\[::ffff:127\.\d+\.\d+\.\d+\]$/.test(host) ||
    host === '[::1]'
  );
}

/**
 * Адрес локальной сети (не этого компьютера): частные IPv4, link-local, ULA и link-local IPv6,
 * IPv4 внутри IPv6, односложные имена и `*.local`, `*.lan`, `*.home.arpa`, `*.internal` — к ним
 * браузер может спрашивать разрешение Local Network Access (R8). Имя, которое браузер сам
 * разрешит в частный адрес, отсюда не видно — принятое ограничение (research R8).
 */
export function isPrivateHost(address: string): boolean {
  if (isLocalHost(address)) return false; // этот компьютер — не локальная сеть
  const host = hostOf(address);
  const mapped = /^\[::ffff:(\d+\.\d+\.\d+\.\d+)\]$/.exec(host);
  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(mapped?.[1] ?? host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  if (host.startsWith('[')) return /^\[(f[cd]|fe[89ab])/i.test(host);
  return (
    !host.includes('.') ||
    ['.local', '.lan', '.home.arpa', '.internal'].some((suffix) => host.endsWith(suffix))
  );
}

/**
 * Порядок попыток (FR-009, FR-011): локальный адрес — ws, wss; остальные — wss, ws; со страницы
 * по https к не локальному адресу — только wss. Указанная пользователем схема — первой (даже если
 * браузер её запретит: тогда пользователь увидит объяснение), запомненная — первой из разрешённых.
 */
export function schemeOrder(
  address: string,
  opts: { pageSecure: boolean; hint?: Scheme; remembered?: Scheme },
): Scheme[] {
  const local = isLocalHost(address);
  const allowed: Scheme[] =
    opts.pageSecure && !local ? ['wss'] : local ? ['ws', 'wss'] : ['wss', 'ws'];
  const first =
    opts.hint ??
    (opts.remembered && allowed.includes(opts.remembered) ? opts.remembered : undefined);
  if (!first) return allowed;
  const rest = (local ? ['ws', 'wss'] : ['wss', 'ws']).filter((s) => s !== first) as Scheme[];
  return opts.hint ? [first, ...rest] : [first, ...allowed.filter((s) => s !== first)];
}

export function toUrl(address: string, scheme: Scheme): string {
  return `${scheme}://${address}`;
}
