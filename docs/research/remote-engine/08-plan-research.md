# Исследования к plan 004 (2026-10-07)

Итог — в specs/004-engine-targets/research.md (R8, R10–R13). Здесь — сырые факты.

## Браузеры (веб-поиск, октябрь 2026)

- Chrome 147+ (апр. 2026) и Firefox 154+ (авг. 2026): Local Network Access для WebSocket —
  запрос разрешения при доступе публичной https-страницы к loopback и LAN. Разрешения
  Chrome: `loopback-network`, `local-network` (Permissions API). Отказ → `error`/`close 1006`.
- `Access-Control-Allow-Private-Network` устарел (PNA заменён LNA, preflight нет).
- `targetAddressSpace` для WebSocket не выпущен.
- Safari: `ws://localhost` со страницы https блокируется (WebKit 171934), LNA-запроса нет.
- Chrome 147: явные приватные IP освобождены от mixed content (при LNA-разрешении);
  `ws://domain.com` с https → синхронный SecurityError из конструктора.
- Причину неудачи рукопожатия скрипт не видит (спецификация запрещает); попытки ws/wss —
  последовательно (RFC 6455: одно CONNECTING-соединение на адрес).
- Не проверено: держит ли браузер рукопожатие до ответа на LNA-запрос; как Safari
  сообщает о блокировке.
- Module workers: Chrome 80, Firefox 114, Safari 15. Необработанное исключение в worker →
  `error` у Worker, worker продолжает жить. OOM в Chromium роняет вкладку.
- `navigator.onLine` ненадёжен; для localhost бесполезен.

## Прототип сервера (proto-server/)

Прототип (один файл сервера для Node/Bun/Deno, пробы лимита кадра, пинга и занятого
порта) не сохранён; ниже — его результаты.

- Один ESM-бандл (Vite 8 SSR, `ssr.noExternal: true`, `codeSplitting: false`) работает в
  Node 24.18 (+ws 8.22), Bun 1.4.2, Deno 2.9.6. ~124 КБ.
- Rolldown сам вставляет `createRequire` для CJS-зависимостей; код ws ленивый.
- Deno: только `--allow-net`. Node: нужен `.mjs`.
- EADDRINUSE: Node — событие error; Bun — throw (code EADDRINUSE); Deno — Deno.errors.AddrInUse.
- Лимит кадра: ws maxPayload (1009), Bun maxPayloadLength (1006), Deno — нет опции (~64 МиБ).
- Пинг: ws вручную; Bun idleTimeout+sendPings; Deno idleTimeout (баг 2.9.6: close дважды).
- npm `bun`/`deno`: бинарники optional-зависимостями (~76 + ~92 МБ).
