# Implementation Plan: Выполнение workflow на выбранном engine

**Branch**: `004-engine-targets` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-engine-targets/spec.md`

## Summary

Редактор вычисляет workflow на одной из трёх целей: в своём окне (Local), в фоновом потоке
(Worker) или на сервере выполнения (Server). Engine один и тот же везде. Репозиторий
становится монорепо на npm workspaces: `src/engine` переезжает в `packages/engine`, рядом
появляются `packages/protocol` (сообщения, схемы Valibot, sans-IO хост и клиент) и
`packages/server` (один собранный файл, который запускается в Node, Bun и Deno).

Все три цели работают через один протокол по JSON-строкам: in-memory канал, `postMessage`,
WebSocket. Граф остаётся у редактора. При каждом подключении редактор передаёт полный
снимок открытых вкладок, хост держит производную копию в памяти соединения. В сторе
`evaluation.ts` заменяется связкой с клиентом протокола. UI по-прежнему читает только
`nodeStates`, добавляются раздел «Engine» в левой панели и индикатор в верхней панели.

Одинаковость результатов проверяется на собранном бандле сервера в трёх средах (Vitest
запускает `node`, `bun`, `deno` и сравнивает с хостом в процессе). Новая зависимость — `ws`
(сервер в Node). Node, Bun и Deno разработчик ставит сам (R12).

## Technical Context

**Language/Version**: TypeScript 6.0 (ESNext в исходниках пакетов); Node.js 24 LTS,
Bun 1.4, Deno 2.9 (сервер)

**Primary Dependencies**: без изменений для редактора (React 19.3, @xyflow/react 12.12,
Zustand 5.0, Immer 11.1, Valibot 1.5, idb-keyval 6.3; Vite 8.3). Новые: `ws` 8.22
(`@dagflow/server`), dev — `@types/ws` 8.18 (research R18). Bun и Deno — не зависимости
npm: установлены на машине, `engines` в `packages/server/package.json` (R12).

**Storage**: без изменений для workflow. Новая настройка браузера: IndexedDB, ключ
`dagflow:engine` (data-model.md). Сервер ничего не хранит.

**Testing**: Vitest 5.0 (unit, component и новый проект `conformance`); Playwright 1.63
(Chromium, Firefox, perf) с фикстурой сервера (research R13, R17).

**Target Platform**: настольные Chromium и Firefox. Сервер: Node 24, Bun 1.4, Deno 2.9
на Linux, macOS, Windows. Автоматически проверяется linux-x64.

**Project Type**: SPA + необязательный сервер выполнения; монорепо npm workspaces

**Performance Goals**: SC-002 — граф из 100 нодов: < 0,2 с для Local и Worker, < 0,5 с
для сервера на том же компьютере. SC-003 — «Offline» ≤ 2 с, пересчёт после запуска
сервера ≤ 15 с.

**Constraints**:

- `engine` и `protocol` — sans-IO: без API среды и без `Date`/`Math.random` (tsconfig и
  ESLint, R2).
- Сообщение не больше 8 МБ.
- Сервер по умолчанию слушает `127.0.0.1`; CORS открыт полностью (FR-031).
- Тексты для пользователя — в `src/ui/messages.ts`, `packages/engine/src/errors.ts` и
  `packages/server/src/messages.ts`.

**Scale/Scope**: 6 user stories, 31 FR + 4 уточнённых (a); 3 новых пакета; ~25 новых
модулей; перенос 8 тестовых файлов engine.

Неизвестных нет: решения — в [research.md](./research.md) (R1–R18). Вручную по
quickstart проверяется одно: держит ли браузер рукопожатие, пока пользователь отвечает
на запрос разрешения Local Network Access.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Принцип / раздел                                 | Проверка                                                                                                                    | До дизайна | После дизайна                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| I. Простота (YAGNI)                              | только требуемые цели; без очереди операций, патчей графа, каталога от сервера, TLS, подписок на внутренние ноды            | ✅         | ✅ снимки вместо очереди (R3); пакеты отдают исходники без сборки (R1); один хост на все цели (R4) |
| II. Тесты для бизнес-логики                      | хост, клиент, схемы, подключение, адрес, настройки — unit; каждый acceptance-сценарий → тест; conformance в трёх средах     | ✅         | ✅ R7, R13, R17; «Карта сценариев и тестов» ниже                                          |
| III. Данные у пользователя                       | граф у редактора; сервер в памяти, без файлов; единственное подключение — по адресу пользователя; обрыв обрабатывается явно | ✅         | ✅ R3; SC-007 — проверка в conformance; offline-состояние и приглушённые значения                  |
| IV. Понятные ошибки                              | тексты ошибок подключения, обмена и сервера; коды в протоколе, тексты на клиенте; без трассировок на сервере                | ✅         | ✅ [contracts/ui-texts.md](./contracts/ui-texts.md), [server-cli.md](./contracts/server-cli.md)    |
| V. Учебная прозрачность                          | путь FR → контракт → модуль; `CLAUDE.md` обновляется (структура, команды)                                                   | ✅         | ✅                                                                                                 |
| Огр.: зависимости                                | `ws`, `@types/ws` — таблица «Обоснование зависимостей» ниже; Bun и Deno — среды на машине, не пакеты                                                       | ✅         | ✅ R18                                                                                             |
| Огр.: продукт без сервера работает полностью     | Local по умолчанию; редактирование без связи                                                                                | ✅         | ✅                                                                                                 |
| Огр.: один пакет engine для всех сред            | `@dagflow/engine` в редакторе, worker и сервере                                                                             | ✅         | ✅ R1                                                                                              |
| Огр.: свежий TS, совместимость — сборкой         | исходники ESNext; сервер — сборка Vite SSR                                                                                  | ✅         | ✅ R11                                                                                             |
| Огр.: sans-IO ядра и хоста                       | хост и клиент протокола без таймеров и сокетов; адаптеры отдельно                                                           | ✅         | ✅ R2, R4                                                                                          |
| Огр.: проверка собранного бандла в каждой среде  | бандл сервера — в Node, Bun, Deno (conformance); собранный редактор — Local и Worker в Chromium и Firefox (Playwright `bundle`)                                                                | ✅         | ✅ R13                                                                                             |
| Огр.: отдельные пакеты монорепо                  | engine, protocol, server — пакеты; редактор — корневой пакет                                                                | ✅         | ✅ R1 (обоснование корня)                                                                          |
| Огр.: без аутентификации, localhost по умолчанию | `--host 127.0.0.1` по умолчанию, предупреждение для сети                                                                    | ✅         | ✅                                                                                                 |

**Результат**: нарушений нет, Complexity Tracking не требуется. Редактор в корне, а не в
`packages/editor`, — это не нарушение: корень — отдельный пакет `dagflow` с явными
зависимостями от пакетов (R1).

### Обоснование зависимостей

| Зависимость | Где | Задача | Почему не писать самим |
|---|---|---|---|
| `ws` 8.22.x | `@dagflow/server`, runtime | WebSocket-сервер в Node (FR-029) | в Node 24 нет встроенного WebSocket-сервера; своя реализация RFC 6455 — ~200 строк протокольного кода с тонкостями (фрагментация, маски, ping); в Bun и Deno используется встроенный сервер |
| `@types/ws` 8.18.x | корень, dev | типы `ws` для `tsc` | — |

Совместимость: `npm view ws peerDependencies` — `bufferutil`, `utf-8-validate`,
обе необязательные. Node, Bun и Deno — не пакеты npm: их ставит пользователь, требования
— в `engines` пакета `@dagflow/server` (research R12). Подробности — research R18.

## Project Structure

### Documentation (this feature)

```text
specs/004-engine-targets/
├── plan.md
├── research.md          # R1–R18
├── data-model.md        # цель, настройки, состояние подключения, срез стора, документы
├── quickstart.md
├── contracts/
│   ├── protocol.md      # протокол v1, правила хоста и клиента
│   ├── server-cli.md    # запуск, вывод, HTTP/WebSocket сервера
│   └── ui-texts.md      # тексты редактора и сервера
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

`+` — новый файл, `~` — изменённый, `-` — удалённый, `→` — перенос.

```text
~ package.json                       # workspaces: ["packages/*"]; scripts: build:server, server, server:bun,
                                     #   server:deno (deno run --allow-net), test:conformance, test:e2e:bundle;
                                     #   typecheck — tsc по корню и по каждому пакету; devDeps @types/ws
~ tsconfig.json                      # без src/engine; пути пакетов через workspaces
- tsconfig.engine.json               # → packages/engine/tsconfig.json
~ eslint.config.js                   # sans-IO правила для packages/engine и packages/protocol (R2)
~ vite.config.ts                     # проекты Vitest: unit (+ packages/*/test), component, conformance
~ playwright.config.ts               # globalSetup: сборка сервера
+ playwright.bundle.config.ts        # собранный редактор: vite build + preview, Chromium и Firefox (R13)
~ CLAUDE.md                          # структура (packages/*), команды, тексты в packages/engine/src/errors.ts,
                                     #   sans-IO, среды Node/Bun/Deno в PATH, «готово» += test:conformance, test:e2e:bundle
~ README.md                          # команды и структура (без tsconfig.engine.json)

packages/
├── engine/                          # @dagflow/engine
│   ├── + package.json               # version 0.1.0, exports ./src/index.ts, без зависимостей
│   ├── + tsconfig.json              # lib ESNext, types []
│   ├── src/ → из src/engine/**      # без изменений API
│   │   ├── + version.ts             # ENGINE_VERSION (R6)
│   │   └── ~ index.ts               # + ENGINE_VERSION
│   └── test/ → из tests/unit/engine/**   # + version.test.ts (константа = package.json)
├── protocol/                        # @dagflow/protocol
│   ├── + package.json               # deps: @dagflow/engine, valibot
│   ├── + tsconfig.json              # lib ESNext, types []
│   ├── src/
│   │   ├── + messages.ts            # типы сообщений, PROTOCOL_VERSION, MAX_MESSAGE_BYTES, ErrorCode
│   │   ├── + schemas.ts             # Graph/Composite/JsonValue/PortDef (из src/model) + NodeState + сообщения
│   │   ├── + host.ts                # createEngineHost (sans-IO)
│   │   ├── + client.ts              # createEngineClient (sans-IO)
│   │   ├── + channel.ts             # интерфейс Channel, байтовый размер строки
│   │   └── + index.ts
│   └── test/ + host.test.ts, client.test.ts, schemas.test.ts, host-client.test.ts (связка через in-memory)
└── server/                          # @dagflow/server
    ├── + package.json               # deps: @dagflow/protocol, @dagflow/engine, ws; engines: node, bun, deno
    ├── + tsconfig.json              # lib ESNext + типы node (адаптеры); Bun и Deno — свои объявления
    ├── + vite.config.ts             # SSR-сборка в dist/dagflow-server.mjs (R11)
    ├── src/
    │   ├── + main.ts                # выбор среды, запуск
    │   ├── + options.ts             # разбор --port/--host/--verbose (чистая функция)
    │   ├── + messages.ts            # тексты сервера (ui-texts.md)
    │   ├── + session.ts             # соединение ↔ хост: tick, журнал, лимит, учёт подключений (общий для сред)
    │   ├── + http.ts                # CORS-заголовки, ответы OPTIONS/GET
    │   └── adapters/ + runtime.ts (интерфейс адаптера, адрес клиента), node.ts, bun.ts, deno.ts,
    │                 + runtimes.d.ts  # минимальные типы Bun/Deno (R10)
    └── test/ + options.test.ts, session.test.ts (фейковый сокет и часы)

src/
├── engine/                          # → packages/engine/src (папка удаляется)
├── + engine-link/                   # связь редактора с целью вычисления (браузер)
│   ├── + types.ts                   # EngineTarget, ConnectionStatus, Trial, EngineSlice (data-model)
│   ├── + address.ts                 # разбор адреса, локальность, порядок схем (R8, R9)
│   ├── + recent.ts                  # операции со списком целей (до 5, «×», подъём наверх)
│   ├── + settings.ts                # dagflow:engine в IndexedDB, EngineSettingsSchema (R16)
│   ├── + connection.ts              # машина состояний подключения и пробной попытки (R7)
│   ├── + probe.ts                   # перебор схем ws/wss, таймауты, Local Network Access (R8)
│   ├── + engine-worker.ts           # хост в фоновом потоке
│   └── channels/ + inline.ts, worker.ts, websocket.ts
├── model/~ schemas.ts               # схемы графа импортируются из @dagflow/protocol
├── store/
│   ├── - evaluation.ts              # → engine.ts
│   ├── + engine.ts                  # клиент протокола ↔ стор, nodeStates, срез engine (R15)
│   ├── ~ store.ts                   # срез engine
│   └── ~ actions.ts                 # selectTarget, connectServer, removeServer, retryNow, useLocalEngine
├── ~ main.tsx                       # startEngine вместо startEvaluation, загрузка настроек
└── ui/
    ├── ~ messages.ts                # engineMessages (ui-texts.md)
    ├── layout/+ EngineSection.tsx   # раздел «Engine» в SidebarWindow
    ├── layout/+ EngineIndicator.tsx # индикатор в topbar
    ├── layout/+ engine-text.ts      # тексты индикатора и ошибок пробной попытки по причине (T038)
    ├── layout/~ SidebarWindow.tsx, ~ Workbench.tsx
    ├── ~ Editor.tsx                 # полоса над холстом: «too large» для вкладки (FR-024)
    ├── canvas/~ FlowNode.tsx        # приглушённый вид
    ├── properties/~ PortPanels.tsx  # приглушённые значения портов
    ├── properties/~ PropertyGrid.tsx  # пометка «Last known value — engine offline»
    └── ~ styles.css

tests/
├── unit/engine/ → packages/engine/test/
├── unit/engine-link/ + address.test.ts, recent.test.ts, settings.test.ts, connection.test.ts,
│                       probe.test.ts, worker-channel.test.ts, inline-channel.test.ts
├── unit/model/~ *.test.ts           # импорт хелперов из packages/engine/test
├── component/~ evaluation.test.ts → engine.test.ts; + engine-section.test.tsx, engine-indicator.test.tsx,
│                 stale-values.test.tsx
├── + conformance/                   # Vitest-проект: бандл сервера в node/bun/deno (R13)
│   ├── fixtures/*.json
│   ├── runtimes.ts                  # запуск среды, свободный порт, ожидание строки запуска
│   ├── equality.test.ts             # SC-001
│   └── server.test.ts               # US5, FR-030a, FR-031, SC-007
└── e2e/
    ├── + engine-server.ts           # фикстура: настоящий и поддельные серверы (R17)
    ├── + global-setup.ts            # сборка сервера
    ├── + engine-us1-server.spec.ts, engine-us2-worker.spec.ts, engine-us3-offline.spec.ts,
    │     engine-us4-targets.spec.ts, engine-us6-errors.spec.ts
    ├── + engine-conformance.spec.ts # проект bundle: Local и Worker на собранном редакторе (SC-001)
    └── ~ perf.spec.ts               # SC-002 для Worker и Server
```

**Structure Decision**: монорепо npm workspaces с редактором в корне и тремя пакетами в
`packages/` (R1). Браузерная часть связи с целью — `src/engine-link/` (она про браузер:
WebSocket, Worker, IndexedDB, Permissions API). В пакетах — только то, что работает в
любой среде (`engine`, `protocol`), и сервер.

## Порядок реализации (ориентир для /speckit-tasks)

1. **Фундамент — монорепо без изменения поведения**: workspaces; `src/engine` →
   `packages/engine` (импорты `@dagflow/engine`), тесты engine переезжают; tsconfig и
   ESLint пакета; все существующие тесты зелёные. Отдельный коммит: чистый перенос
   проще проверить.
2. **Фундамент — протокол**: `packages/protocol` (сообщения, схемы, перенос схем графа из
   `src/model`, хост, клиент); unit-тесты хоста и клиента по таблицам contracts/protocol.md.
3. **Local через протокол**: in-memory канал, `src/store/engine.ts` вместо
   `evaluation.ts`; компонентные и e2e-тесты 001–003 зелёные без изменений поведения;
   перф-тест SC-002 для Local.
4. **US1 (P1, MVP)**: сервер (`packages/server`, адаптер Node), сборка, адрес и перебор
   схем, пробное подключение, раздел «Engine» (минимум: поле и «Connect»), индикатор;
   e2e US1 с фикстурой сервера.
5. **US3**: переподключение, offline, приглушённые значения, «Retry now», «Use local
   engine»; e2e остановки и запуска сервера.
6. **US5**: адаптеры Bun и Deno, журнал и `--verbose`, проект `conformance` (SC-001,
   SC-007); проверка наличия `bun`, `deno` в PATH.
7. **US2**: worker, перезапуск после падения; e2e Worker; перф-тест для Worker.
8. **US4**: список целей, настройки в IndexedDB, «×», независимые окна.
9. **US6**: версии, неизвестный нод, `too-large`, `invalid-message`/`internal`,
   `unknown-doc`; поддельные серверы в фикстуре.
10. **Сквозное**: `CLAUDE.md`, перф для Server, Firefox, quickstart вручную (LNA).

**Почему так**: перенос в пакеты и Local через протокол меняют путь вычисления, но не
поведение — их проверяют существующие тесты. После этого каждая цель добавляется
адаптером к уже проверенному хосту.

## Карта сценариев и тестов

| Сценарии | Тесты |
|---|---|
| US1 #1–#8 | e2e `engine-us1-server.spec.ts` (фикстура: сервер, «не engine», «молчит»); unit `address.test.ts`, `probe.test.ts` (#7, перебор схем) |
| US2 #1, #4 | e2e `engine-us2-worker.spec.ts`; `engine-conformance.spec.ts` (значения = Local) |
| US2 #2, #3 | unit `worker-channel.test.ts`, `connection.test.ts` (фейковый `Worker` и часы) |
| US3 #1–#8 | e2e `engine-us3-offline.spec.ts` (остановка и запуск сервера, замер 2 с / 15 с — SC-003); unit `connection.test.ts` (паузы ≤ 10 с, «Retry now», `online`) |
| US4 #1–#10 | unit `recent.test.ts`, `settings.test.ts`; component `engine-section.test.tsx`, `engine-indicator.test.tsx`; e2e `engine-us4-targets.spec.ts` (#6, #9, #10 — два окна) |
| US5 #1–#8 | conformance `server.test.ts` в Node, Bun, Deno; unit `options.test.ts`, `session.test.ts` |
| US6 #1–#7 | e2e `engine-us6-errors.spec.ts` (поддельные серверы); unit `host.test.ts`, `client.test.ts` (unknown-doc, повтор один раз на ревизию, too-large) |
| Edge Cases | unit хоста и клиента (цикл, неизвестный тип, некорректное сообщение); `probe.test.ts` (схема в адресе, запрет браузера, ожидание разрешения LNA) |
| SC-001 | conformance `equality.test.ts` (сервер ×3 среды) + `engine-conformance.spec.ts` (браузер) |
| SC-002 | `perf.spec.ts` для Local, Worker, Server |
| SC-004 | e2e US3 (правки без связи сохраняются) |
| SC-005 | e2e US1 (подключение по короткому адресу) |
| SC-006 | тексты из `contracts/ui-texts.md` дословно в unit, component и e2e |
| SC-007 | conformance `server.test.ts` (сервер запущен в пустом временном каталоге — после работы в нём нет файлов) |

## Complexity Tracking

Нарушений конституции нет.
