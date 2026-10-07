# Contract: сервер выполнения (`@dagflow/server`)

Один собранный файл `packages/server/dist/dagflow-server.mjs` запускается в Node, Bun и
Deno без копии проекта и `node_modules` (FR-029, FR-029a; research R10, R11). Тексты —
[ui-texts.md](./ui-texts.md#сервер-fr-030-fr-030a-packagesserversrcmessagests).

## Запуск

```text
node dagflow-server.mjs [--port <number>] [--host <address>] [--verbose]
bun  dagflow-server.mjs [--port <number>] [--host <address>] [--verbose]
deno run --allow-net dagflow-server.mjs [--port <number>] [--host <address>] [--verbose]
```

Из папки проекта (сборка + запуск):

```text
npm run server -- --port 8080
npm run server:bun -- --port 8080
npm run server:deno -- --port 8080
```

| Параметр    | По умолчанию | Ошибка                                                |
| ----------- | ------------ | ----------------------------------------------------- |
| `--port`    | `8080`       | не целое 1–65535 → текст «Invalid port», код выхода 2 |
| `--host`    | `127.0.0.1`  | не удалось слушать → «Cannot listen on», код выхода 1 |
| `--verbose` | выключен     | —                                                     |
| другое      | —            | «Unknown option», код выхода 2                        |

Коды выхода: `0` — остановлен пользователем (Ctrl+C), `1` — не удалось запуститься
(порт занят, адрес недоступен), `2` — неверные параметры. Трассировки не печатаются.

## Вывод

```text
DAG Flow engine 0.1.0 is listening on 127.0.0.1:8080
Protocol version: 1. Press Ctrl+C to stop.
Connected: 127.0.0.1:53122 (connections: 1)
Error from 127.0.0.1:53122: invalid-message
Disconnected: 127.0.0.1:53122 (connections: 0)
```

- `--host`, не являющийся локальным адресом (`0.0.0.0`, `::`, адрес сети), → после
  строки запуска предупреждение об отсутствии аутентификации (FR-030).
- `--verbose` — строка на каждое сообщение обмена в обе стороны:
  `127.0.0.1:53122 in update tab-1 2048 B`, `127.0.0.1:53122 out states tab-1 512 B`.
- В выводе никогда нет графа, определений составных нодов и значений (FR-030a).
- Журнал пишет адаптер среды (`console`), не хост протокола (sans-IO).

## HTTP и WebSocket

| Запрос                                            | Ответ                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| WebSocket-рукопожатие, любой путь, любой `Origin` | `101`; дальше — протокол из [protocol.md](./protocol.md), один хост на соединение |
| `OPTIONS` любой путь                              | `204`                                                                             |
| другой HTTP-запрос                                | `200 text/plain` «DAG Flow engine `<version>`»                                    |

Все ответы, включая `101`, несут заголовки (FR-031):

```text
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: *
Access-Control-Allow-Headers: *
Access-Control-Allow-Private-Network: true
```

## Соединение

- Сообщение больше 8 МБ (до 8 МБ + 1 КБ) → `error too-large`, соединение живо; больше
  8 МБ + 1 КБ → соединение закрывается во всех средах: в Node (1009) и Bun (обрыв, 1006)
  это делает опция транспорта, в Deno опции нет — адаптер сам закрывает (кодом 1000: WebSocket API Deno не принимает 1009) по длине
  строки (R10). Тесты проверяют факт закрытия, а не код.
- Пинг каждые 30 с; нет ответа → соединение закрывается, его документы освобождаются.
- Закрытие соединения освобождает все его документы (FR-018). Сервер ничего не пишет
  на диск (SC-007).
