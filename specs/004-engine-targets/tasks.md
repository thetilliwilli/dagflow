---

description: "Задачи фичи 004-engine-targets"
---

# Tasks: Выполнение workflow на выбранном engine

**Input**: `/specs/004-engine-targets/` — [spec.md](./spec.md), [plan.md](./plan.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/protocol.md](./contracts/protocol.md),
[contracts/server-cli.md](./contracts/server-cli.md),
[contracts/ui-texts.md](./contracts/ui-texts.md), [quickstart.md](./quickstart.md)

**Tests**: обязательны (принцип II конституции). У каждого acceptance-сценария есть тест
(«Карта сценариев и тестов» в plan.md). Тесты пишутся до реализации и сначала падают.
Тексты проверяются дословно по [contracts/ui-texts.md](./contracts/ui-texts.md)
(SC-006). Собранные бандлы проверяются в каждой среде: сервер — в Node, Bun, Deno
(`npm run test:conformance`), редактор — в Chromium и Firefox (`npm run test:e2e:bundle`).

**Порядок историй** — как в plan.md («Порядок реализации»): US1 (P1, MVP) → US3 → US5 →
US2 → US4 → US6. US3 идёт сразу за US1: без переподключения сервер в работе неудобен.

**Предусловие для разработки**: на машине установлены Node 24+, Bun 1.4+, Deno 2.9+ и
доступны в `PATH` (research R12). Без Bun и Deno не пройдёт только
`npm run test:conformance` (задачи US5).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (разные файлы, нет зависимости от незавершённых задач)
- **[Story]**: история из spec.md (US1–US6)

---

## Phase 1: Setup — монорепо без изменения поведения

**Purpose**: перенести engine в пакет и включить npm workspaces (research R1, R2). Поведение
редактора не меняется: все существующие тесты зелёные. Отдельный коммит.

- [X] T001 Включить npm workspaces: в `package.json` добавить `"workspaces": ["packages/*"]`; создать `packages/engine/package.json` (`"name": "@dagflow/engine"`, `"version": "0.1.0"`, `"type": "module"`, `"private": true`, `"exports": { ".": "./src/index.ts" }`, без зависимостей); добавить `"@dagflow/engine": "*"` в `dependencies` корневого `package.json`; `npm install` создаёт ссылку в `node_modules/@dagflow/engine`
- [X] T002 Перенести `src/engine/**` → `packages/engine/src/**` через `git mv` без изменения содержимого; `tsconfig.engine.json` → `packages/engine/tsconfig.json` (`lib: ["ESNext"]`, `types: []`, `include: ["src/**/*.ts"]`, остальные опции как были)
- [X] T003 Заменить импорты движка на `@dagflow/engine` во всех файлах `src/` (store, model, storage, ui — список в research R1 / отчёт Explore: `src/store/actions.ts`, `registry.ts`, `evaluation.ts`, `store.ts`, `history.ts`, `ui-logic.ts`, `ui.ts`, `persistence.ts`; `src/model/*.ts`; `src/storage/autosave.ts`, `directory-storage.ts`; `src/ui/**` — `messages.ts`, `ValueView.tsx`, `Palette.tsx`, `PeekGrid.tsx`, `useLinking.ts`, `PortPanels.tsx`, `LinkGhost.tsx`, `PropertyGrid.tsx`, `NodeStatus.tsx`, `IoPortsEditor.tsx`, `connection.ts`, `ValueEditor.tsx`, `bundles.ts`, `PropertyRow.tsx`)
- [X] T004 Перенести тесты движка: `git mv tests/unit/engine/* packages/engine/test/`; импорты в них — относительные `../src/...`; хелперы `helpers.ts` и `composite-fixtures.ts` остаются в `packages/engine/test/`, тесты `tests/unit/model/import-merge.test.ts`, `serialize.test.ts`, `tests/unit/storage/directory-storage.test.ts`, `tests/component/palette-tabs.test.tsx` и остальные, что импортируют движок или его хелперы, — на `@dagflow/engine` и `../../packages/engine/test/...`
- [X] T005 Обновить `vite.config.ts`: проект Vitest `unit` включает `tests/unit/**/*.test.ts` и `packages/*/test/**/*.test.ts`; `tsconfig.json` — `include` без `src/engine` (пакеты проверяются своими tsconfig); скрипт `typecheck` в `package.json` — `tsc -p tsconfig.json --noEmit && tsc -p packages/engine/tsconfig.json --noEmit`
- [X] T006 Обновить `eslint.config.js`: блок ограничений движка — для `packages/engine/src/**/*.ts`; добавить sans-IO правила (research R2): `no-restricted-globals` (`setTimeout`, `setInterval`, `queueMicrotask`, `console`, `structuredClone`, `fetch`, `crypto`, `performance`, `process`, `Deno`, `Bun`, `globalThis`, `self`, `window`), `no-restricted-properties` (`Date.now`, `Math.random`), `no-restricted-syntax` для `new Date()`; `no-restricted-imports` — как было (без UI, стора, хранилища, модели)
- [X] T007 Проверить перенос (скрипты `package.json`): `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` — зелёные без изменения ожиданий в тестах

**Checkpoint**: редактор работает как раньше, engine — пакет `@dagflow/engine`.

---

## Phase 2: Foundational — протокол и Local через протокол

**Purpose**: `@dagflow/protocol` (сообщения, схемы, sans-IO хост и клиент) и связка стора с
клиентом протокола вместо `evaluation.ts`. После фазы вычисление в окне идёт через
протокол по in-memory каналу; поведение для пользователя не меняется.

**⚠️ CRITICAL**: ни одна история не начинается до конца фазы.

### Пакет protocol

- [X] T008 Создать `packages/protocol/package.json` (`@dagflow/protocol`, `0.1.0`, `type: module`, `exports: ./src/index.ts`, `dependencies`: `@dagflow/engine`, `valibot` той же версии, что в корне), `packages/protocol/tsconfig.json` (`lib: ["ESNext"]`, `types: []`); добавить пакет в `dependencies` корня, в `typecheck` и в sans-IO блок `eslint.config.js` (плюс `no-restricted-imports` на `@dagflow/server` и `src/**`)
- [X] T009 [P] Добавить `ENGINE_VERSION` в `packages/engine/src/version.ts` (значение `'0.1.0'`) и экспорт в `packages/engine/src/index.ts`; тест `packages/engine/test/version.test.ts`: константа равна `version` из `packages/engine/package.json` (research R6)
- [X] T010 [P] Убрать явное `message: undefined` в `flatState` (`packages/engine/src/evaluator.ts`): для `computing` поле `message` не задаётся (research R5); тест в `packages/engine/test/evaluator.test.ts` — состояние `computing` не имеет ключа `message`
- [X] T011 Написать `packages/protocol/src/messages.ts` по [contracts/protocol.md](./contracts/protocol.md): типы `ClientMessage`, `HostMessage`, `ErrorCode`, `DocId`, `Rev`; константы `PROTOCOL_VERSION = 1`, `MAX_MESSAGE_BYTES = 8 * 1024 * 1024`; функция `byteLength(text)` (UTF-8, без `TextEncoder` — sans-IO) в `packages/protocol/src/channel.ts` вместе с интерфейсом `Channel` (`send`, `close`, `onMessage`, `onClose(reason: 'closed' | 'crashed')`)
- [X] T012 Тесты схем `packages/protocol/test/schemas.test.ts`: каждое сообщение из контракта проходит; лишний/неверный `type`, `rev` < 1 или дробный, `graph` без `nodes`, `NodeState` с неизвестным `status` — не проходят; схемы графа совпадают с поведением прежних схем файлов (`tests/unit/model/*` зелёные)
- [X] T013 Перенести `JsonValueSchema`, `PortDefSchema`, `GraphSchema`, `CompositeSchema` (и внутренние `PortTypeSchema`, `PositionSchema`, `PortRefSchema`, `NameSchema`) из `src/model/schemas.ts` в `packages/protocol/src/schemas.ts`; `src/model/schemas.ts` импортирует их из `@dagflow/protocol` и оставляет обёртки файлов; добавить `NodeStateSchema` (`status` — `ok|computing|waiting|error|blocked`, `inputs`/`outputs` — record JsonValue, `message?` — string), `ClientMessageSchema`, `HostMessageSchema` (`v.variant('type', …)`); экспорт в `packages/protocol/src/index.ts`
- [X] T014 Тесты хоста `packages/protocol/test/host.test.ts` — по таблице «Правила хоста» contracts/protocol.md, каждая строка отдельным тестом: `too-large` по байтовой длине (без `doc`), `invalid-message` (не JSON, не схема, `detail` есть), `not-ready` до `hello`, `version-mismatch` (ответ `welcome` + `error`, `closed === true`), `welcome`, `library` пересчитывает открытые документы, `open` нового и повторный `open` (= `update`), `update`/`close` неоткрытого → `unknown-doc` с `doc`, `rev` ≤ последнего игнорируется, `update` без изменений — без ответа, исключение → `internal`, `tick()` — один `states` на документ с `rev` последнего изменения и только ноды верхнего уровня (экземпляр составного — сводное состояние), `needsTick()`; несколько `update` до `tick` — один пересчёт (FR-016)
- [X] T015 Реализовать `createEngineHost()` в `packages/protocol/src/host.ts` (sans-IO): по `Evaluator` на документ (`createEvaluator((c) => createRegistry(c))`), `receive(raw)`, `tick()`, `needsTick()`, `closed`; ответы — объекты `HostMessage` (сериализует адаптер); `pending`/`states` — только верхний уровень (`id.split('/')[0]`, как в `src/store/evaluation.ts`)
- [X] T016 Тесты клиента `packages/protocol/test/client.test.ts` — по «Правилам клиента»: `start()` → `hello`; после `welcome` — `library` и `open` всех вкладок; `sync` по ссылкам (`open`/`update` с `rev + 1`/`close`/`library`); проверка размера до отправки → событие `too-large` по вкладке и без `doc` для `library`; `welcome` с другим `protocol` → `incompatible`; `unknown-doc` → `resend` только для открытой вкладки; `invalid-message`/`internal` с `doc` → `failed` и повторный `open` один раз на ревизию, без цикла; `too-large` от хоста → `failed` с кодом `too-large`; вкладка, закрытая без связи, после переподключения не передаётся; составной нод, изменённый без связи, приходит в `library` после переподключения (Edge Cases); `states` с меньшим `rev` применяется, ноды последнего `pending` остаются `computing`; невалидное сообщение хоста → `failed` `invalid-message`; сообщения до `welcome`, кроме `error`, игнорируются; новое подключение сбрасывает зеркала (полный снимок)
- [X] T017 Реализовать `createEngineClient()` в `packages/protocol/src/client.ts` (sans-IO): зеркала документов (`rev`, `graph`, `pending`), `start`, `receive`, `sync`, `reset()` для нового подключения
- [X] T018 Связка хоста и клиента через in-memory пару `packages/protocol/test/host-client.test.ts`: граф «2 + 3 → Show» даёт те же `NodeState`, что `Evaluator` напрямую (после JSON); правка составного нода пересчитывает экземпляры во всех вкладках

### Local через протокол

- [X] T019 [P] Канал Local `src/engine-link/channels/inline.ts`: пара каналов в одном потоке, строка доставляется в следующей макрозадаче (`setTimeout(0)`), на стороне хоста — `createEngineHost`, `tick()` по `setTimeout(0)` при `needsTick()`; исключение хоста → `error internal` (research R4); тест `tests/unit/engine-link/inline-channel.test.ts` на фейковых таймерах Vitest
- [X] T020 Добавить в `src/store/store.ts` срез `engine` по data-model.md («Срез стора engine»): `target` (`{ kind: 'local' }` по умолчанию), `recent: []`, `status: { kind: 'connecting' }`, `trial?`, `tooLarge: { library: false, tabs: {} }`; селектор `isStale(state, tabId)` — `status.kind !== 'ready'` или `tooLarge.library` или `tooLarge.tabs[tabId]`
- [X] T021 Переписать компонентный тест `tests/component/evaluation.test.ts` → `tests/component/engine.test.ts`: те же ожидания (пересчёт, `computing`, удаление состояний удалённых нодов, составные ноды), но через `startEngine` с каналом Local и `manualScheduler()` из `tests/component/helpers.tsx` (планировщик записи в стор и таймеры канала)
- [X] T022 Реализовать `src/store/engine.ts` (`startEngine(app, { channelFactory, schedule })`) вместо `src/store/evaluation.ts` (удалить): подписка на `workflows`, `composites`, `tabs` → `client.sync(snapshot)` (снимок — `tabGraph` открытых вкладок и `Object.values(composites)`); события клиента → `nodeStates` не чаще раза за кадр (rAF по умолчанию); `pending` → `computing` с прежними `inputs`/`outputs`; удаление состояний удалённых нодов — как в старом `evaluation.ts`; `ready` → `status: { kind: 'ready', engine, encrypted: false }`
- [X] T023 Подключить `startEngine` в `src/main.tsx` вместо `startEvaluation` (цель Local); прогнать `npm test`, `npm run test:e2e`, `npm run test:perf` (SC-002 для Local: < 0,2 с) — зелёные без изменения ожиданий

**Checkpoint**: Local идёт через протокол; хост готов для Worker и сервера.

---

## Phase 3: User Story 1 — Вычисление на своём сервере (Priority: P1) 🎯 MVP

**Goal**: сервер в Node, подключение по короткому адресу с пробной попыткой, вычисление
всех вкладок на сервере, индикатор цели. Исключение для запроса разрешения браузера
(FR-011, FR-012: Local Network Access) — в T078 (Polish): в MVP редактор открыт с
`localhost`, запроса нет.

**Independent Test**: запустить сервер на свободном порту, подключиться `localhost:N`,
граф «2 + 3 → Show» показывает 5, правка пересчитывается; значения и сообщения нодов —
как в окне.

### Tests for User Story 1 ⚠️

- [X] T024 [P] [US1] Тесты разбора адреса `tests/unit/engine-link/address.test.ts` таблицей (research R9): `localhost:8080`, `domain.com`, `domain.com/dagflow`, `Domain.COM/` → нормализация «хост в нижнем регистре, без схемы и завершающего `/`»; схема `ws|wss|http|https` → подсказка (`http` = `ws`, `https` = `wss`); пустой ввод, `user:pass@host`, `?query`, `#hash`, пробелы → ошибка; порт не подставляется; локальность: `localhost`, `*.localhost`, `127.0.0.0/8`, `[::1]` — да, `192.168.1.20`, `domain.com` — нет; порядок схем: локальный → `ws, wss`; остальной → `wss, ws`; страница `https:` и не локальный → только `wss`; запомненная или указанная схема — первой
- [X] T025 [P] [US1] Тесты перебора схем `tests/unit/engine-link/probe.test.ts` с фейковым `WebSocket` и часами: попытки строго по очереди (вторая — после `close()` первой); синхронное исключение конструктора → текст «The browser blocks unencrypted connections…» и следующая схема; нет открытия за 3 с → неудача; открытие без `welcome` за 3 с → неудача (FR-012); успех только после `welcome` с тем же `protocol`; ответ «другой протокол» → неудача с текстом о версии; отмена новой попыткой (FR-007); итоговый текст неудачи «Could not connect to `<address>`. Check that the server is running and the address is correct.»
- [X] T026 [P] [US1] Тесты сервера `packages/server/test/options.test.ts` и `packages/server/test/session.test.ts`: разбор `--port`/`--host`/`--verbose` (по умолчанию `8080`, `127.0.0.1`, выключен; ошибки «Invalid port», «Unknown option» — тексты ui-texts.md, коды выхода 2); локальность `--host`; `session` с фейковым сокетом и часами: строка → `host.receive` → ответы отправлены строками JSON, `tick` по таймеру при `needsTick()`, `closed` → закрытие сокета, строки журнала «Connected: …» / «Disconnected: …» / «Error from …: `<code>`» со счётчиком подключений, без содержимого графа и значений; закрытие сокета отпускает хост соединения со всеми документами, новое соединение начинает с чистого хоста (FR-018)
- [X] T027 [US1] Фикстура e2e `tests/e2e/engine-server.ts` и `tests/e2e/global-setup.ts` (research R17): `globalSetup` выполняет `npm run build:server`; фикстура находит свободный порт, запускает `node packages/server/dist/dagflow-server.mjs --port N`, ждёт строку «is listening», умеет `stop()`/`start()` на том же порту; поддельные серверы на `ws` в той же фикстуре: «не engine» (HTTP 200 без upgrade), «молчит» (нет `welcome`); подключить `globalSetup` в `playwright.config.ts`
- [X] T028 [US1] e2e `tests/e2e/engine-us1-server.spec.ts` — сценарии US1 #1–#8: подключение `localhost:N` → строка «localhost:N · Server» выбрана, индикатор «● Server · localhost:N · engine 0.1.0», значения от сервера (#1); правка → `computing` → новое значение (#2); деление на ноль и незаполненный вход — тот же текст, что в Local (#3); правка составного — пересчёт экземпляров во всех вкладках (#4); открытие/закрытие вкладки (#5); ничего не запущено на порту → текст ошибки у поля, вычисление на прежней цели (#6); адрес без порта не получает порт (#7, через unit T024 + проверка введённого адреса в ошибке); «не engine» и «молчит» → ошибка у поля, прежняя цель (#8); SC-005 — подключение за < 30 с одним вводом адреса

### Implementation for User Story 1

- [X] T029 [US1] Создать `packages/server/package.json` (`@dagflow/server`, `0.1.0`, `type: module`, `dependencies`: `@dagflow/protocol`, `@dagflow/engine`, `ws` `^8.22.0`; `"engines": { "node": ">=24", "bun": ">=1.4", "deno": ">=2.9" }`), `packages/server/tsconfig.json` (`lib: ["ESNext"]`, `types: ["node"]`); корень: devDependency `@types/ws` `^8.18.0` (перед установкой — `npm view ws peerDependencies`), `typecheck` += `packages/server`
- [X] T030 [P] [US1] `packages/server/src/messages.ts` — тексты сервера из раздела «Сервер» [contracts/ui-texts.md](./contracts/ui-texts.md) дословно (запуск, вторая строка, предупреждение, порт занят с буквальным `--port <number>`, неверный порт, неизвестный параметр, «Cannot listen on», журнал подключений и ошибок, формат `--verbose`)
- [X] T031 [US1] `packages/server/src/options.ts` (разбор аргументов, чистая функция; результат или ошибка с кодом выхода) и `packages/server/src/session.ts` (соединение ↔ `createEngineHost`, планирование `tick` через `setTimeout(0)`, проверка длины строки > `8 МБ + 1 КБ` → закрытие с 1009 для сред без лимита транспорта, журнал через переданный `log`, счётчик подключений) — чтобы прошли T026
- [X] T032 [US1] `packages/server/src/http.ts` (заголовки `Access-Control-Allow-Origin: *`, `-Methods: *`, `-Headers: *`, `-Private-Network: true`; `OPTIONS` → 204; другой запрос → `200 text/plain` «DAG Flow engine `<version>`») и адаптер Node `packages/server/src/adapters/node.ts`: `node:http` + `WebSocketServer` из `ws` (`noServer`, `maxPayload: 8 МБ + 1 КБ`), любой путь и `Origin`, заголовки на 101 через `wss.on('headers')`, `ws.on('error')` обязателен, адрес клиента `req.socket.remoteAddress:remotePort`, пинг `ws.ping()` каждые 30 с и `terminate()` без `pong`, `EADDRINUSE` из события `error` → текст «Port … is already in use…» и выход 1
- [X] T033 [US1] `packages/server/src/main.ts`: выбор среды (`globalThis.Deno` / `globalThis.Bun` / иначе Node — ветки Bun и Deno пока бросают «not implemented», реализуются в US5), разбор аргументов (`process.argv`), строки запуска, предупреждение для не локального `--host` (FR-030), Ctrl+C → выход 0; `packages/server/vite.config.ts` по research R11 (`ssr: { noExternal: true, target: 'node' }`, `build.ssr: 'src/main.ts'`, `rolldownOptions.output: { format: 'es', entryFileNames: 'dagflow-server.mjs', codeSplitting: false }`, без минификации); скрипты корня `build:server` (`vite build --config packages/server/vite.config.ts`) и `server` (`npm run build:server && node packages/server/dist/dagflow-server.mjs`)
- [X] T034 [P] [US1] `src/engine-link/address.ts` — разбор и нормализация адреса, локальность, порядок схем (research R9, R8) — чтобы прошли T024
- [X] T035 [US1] `src/engine-link/channels/websocket.ts` (канал поверх браузерного `WebSocket`, текстовые кадры, `onClose('closed')`) и `src/engine-link/probe.ts` — перебор схем по очереди, таймауты 3 с на открытие и на `welcome`, синхронное исключение → «браузер запрещает», результат: канал + схема + версии хоста или текст ошибки (research R8) — чтобы прошли T025
- [X] T036 [US1] `src/engine-link/connection.ts` — машина состояний подключения по data-model.md (часы, таймеры и случайность передаются): текущая цель + пробная попытка (`Trial`): одна попытка одновременно, новая отменяет прежнюю; пока идёт попытка, текущий канал работает; успех → новый канал становится текущим, клиент `reset()` и полный снимок, старый канал закрывается; неудача → `trial.error`, текущая цель не меняется (FR-007). Тест `tests/unit/engine-link/connection.test.ts` (пробная попытка: успех, неудача, отмена)
- [X] T037 [US1] Действия стора в `src/store/actions.ts`: `connectServer(address)` (проверка адреса → текст «Enter a server address, for example localhost:8080.» без попытки — FR-008), `selectTarget(target)` (Local — сразу), подключение `connection.ts` к `src/store/engine.ts`; `ready` → `status.ready` с версией engine хоста и `encrypted`; тексты в `src/ui/messages.ts` (`engineMessages`, раздел «Engine», индикатор, ошибки подключения — по ui-texts.md)
- [X] T038 [US1] UI: `src/ui/layout/EngineSection.tsx` (раздел «Engine» в `src/ui/layout/SidebarWindow.tsx` после `StorageIndicator`: строки «This tab · Local», «This browser · Worker» (пока без действия — US2), текущий сервер «`<address>` · Server»; поле «Server address, e.g. localhost:8080» + «Connect» / «Connecting…»; ошибка попытки у поля) и `src/ui/layout/EngineIndicator.tsx` в `header.topbar` (`src/ui/Workbench.tsx`) после `TabBar`: «● Local», «● Server · `<address>` · engine `<version>`» (при разных версиях — «(editor `<editor>`)»), «· not encrypted», «Connecting…»; щелчок открывает левую панель; aria-label «Engine: `<текст>`. Open engine settings.»; стили и переменные цвета `--engine-ready`/`--engine-pending`/`--engine-offline`/`--engine-problem` в `src/ui/styles.css`
- [X] T039 [P] [US1] Компонентные тесты `tests/component/engine-indicator.test.tsx` и `tests/component/engine-section.test.tsx` (минимум US1): тексты индикатора для Local и Server (одна и разные версии engine, not encrypted), «Connecting…», ошибка у поля, щелчок по индикатору открывает раздел (US4 #7)
- [X] T040 [US1] Прогнать T024–T028, T039, все существующие тесты; `npm run server -- --port 8080` и ручной сценарий 1 из quickstart.md

**Checkpoint**: MVP — вычисление на сервере в Node по короткому адресу.

---

## Phase 4: User Story 3 — Работа без связи и восстановление (Priority: P2)

**Goal**: обрыв не мешает редактированию; приглушённые значения; автоматическое
переподключение; «Retry now»; «Use local engine».

**Independent Test**: подключиться, остановить сервер, поправить граф, запустить сервер —
«Offline» → «Server», значения пересчитаны с учётом правок.

### Tests for User Story 3 ⚠️

- [X] T041 [P] [US3] Тесты машины состояний в `tests/unit/engine-link/connection.test.ts`: обрыв → `offline { attempt, retryAt }`; пауза `min(500 · 2^(n-1) · (1 ± 0,2), 10 000)` мс — на крайних значениях случайности никогда не больше 10 000 (FR-020); бесконечные попытки; сброс счётчика после `welcome`; «Retry now» и событие `online` / `visibilitychange: visible` → попытка сразу; успешная попытка → полный снимок вкладок (FR-021); `useLocalEngine` из `offline`, `incompatible`, `failed` → цель Local сразу (без пробной попытки), таймеры и канал закрыты, сервер остаётся в `recent` (FR-022a); смена цели во время `offline` → пробная попытка, при успехе попытки к старой прекращаются (Edge Cases)
- [X] T042 [P] [US3] Компонентные тесты: `tests/component/engine-indicator.test.tsx` — «◌ Offline — retrying in `<n>` s» с кнопками «Retry now» и «Use local engine»; `tests/component/stale-values.test.tsx` — при `status !== ready` ноды приглушены (`FlowNode`, `PortPanels`), в окне «Properties» — «Last known value — engine offline»; редактирование не заблокировано; стор в состоянии «цель — сервер, `offline`» на старте → редактор работает, индикатор «Offline» и «Use local engine» (US3 #7, FR-022)
- [X] T043 [US3] e2e `tests/e2e/engine-us3-offline.spec.ts` — US3 #1–#8: остановка сервера → «Offline» не позже чем через 2 с (замер, SC-003), приглушение и пометка (#1); добавление нодов и связей, правка значений, отмена, переключение вкладок без связи (#2, SC-004); «Retry now» (#4); запуск сервера → значения с правками не позже чем через 15 с (#5, SC-003); перезапущенный сервер без данных (#6); старт редактора с недоступным сохранённым сервером → редактор работает, «Offline», «Use local engine» (#7 — здесь компонентным тестом T042; e2e с перезагрузкой — в US4, T066); «Use local engine» → «This tab · Local», пересчёт в окне (#8; часть «после перезагрузки» — в US4, T066)

### Implementation for User Story 3

- [X] T044 [US3] Переподключение в `src/engine-link/connection.ts`: статус `offline`, паузы по формуле data-model.md, таймеры через переданный планировщик, `retryNow()`, обработчики `online` и `visibilitychange` (подключаются в `src/store/engine.ts`), полный снимок после `welcome` — чтобы прошли T041
- [X] T045 [US3] Действия `retryNow`, `useLocalEngine` в `src/store/actions.ts`; обратный отсчёт «retrying in `<n>` s» в `EngineIndicator.tsx` (обновление раз в секунду из UI, не из стора)
- [X] T046 [US3] Приглушённый вид: `src/ui/canvas/FlowNode.tsx`, `src/ui/properties/PortPanels.tsx` (класс по селектору `isStale`), пометка «Last known value — engine offline» в `src/ui/properties/PropertyGrid.tsx`; стили в `src/ui/styles.css`; это не новое состояние нода (FR-019)
- [X] T047 [US3] Прогнать T041–T043; ручной сценарий 3 из quickstart.md

**Checkpoint**: сервер можно останавливать и запускать — работа не теряется.

---

## Phase 5: User Story 5 — Сервер в Node, Bun или Deno (Priority: P2)

**Goal**: один собранный файл запускается в трёх средах; журнал и `--verbose`; одинаковые
результаты (SC-001) и отсутствие файлов на диске (SC-007).

**Independent Test**: `npm run test:conformance` — бандл в `node`, `bun`, `deno` даёт те же
состояния, что хост в процессе; сценарии сервера проходят во всех трёх.

### Tests for User Story 5 ⚠️

- [ ] T048 [US5] Каркас проекта Vitest `conformance` в `vite.config.ts` (`include: tests/conformance/**/*.test.ts`, среда node, не входит в `npm test`) и скрипт `test:conformance` (`npm run build:server && vitest run --project conformance`); `tests/conformance/runtimes.ts`: команды сред (`node`, `bun`, `deno run --allow-net`) из `PATH`; если среды нет — тест **падает** с текстом «`<Runtime>` is not installed or not in PATH. Install `<Runtime>` `<min version>`+ and run again.» (research R12); запуск бандла в пустом временном каталоге на свободном порту, ожидание строки «is listening», сбор вывода
- [ ] T049 [P] [US5] Эталонные workflow `tests/conformance/fixtures/*.json`: все встроенные ноды, составные (вложенные), ошибки нодов (деление на ноль, неверный тип), ожидание входов, неизвестный тип нода, цикл (импорт старых данных) — в формате файла выгрузки (`ExportFileSchema`: `format`, `version`, `exportedAt`, `workflow`, `composites`), чтобы те же файлы загружались в редактор в e2e
- [ ] T050 [US5] `tests/conformance/equality.test.ts` (SC-001, FR-017, US5 #4): для каждой среды и каждого эталона — `open` по WebSocket-клиенту Node, ожидание `states`, сравнение (`toEqual`) с хостом `createEngineHost` в процессе после JSON
- [ ] T051 [US5] `tests/conformance/server.test.ts` для каждой среды: строка запуска «DAG Flow engine 0.1.0 is listening on 127.0.0.1:`<port>`» и вторая строка (US5 #1); порт занят → текст, код выхода 1, без трассировки (#2); `--host 0.0.0.0` → предупреждение (#3); любой `Origin` принимается, CORS-заголовки на `OPTIONS` (204), `GET` (200) и 101 (#5, FR-031); два подключения изолированы (#6); строки журнала подключения/отключения/ошибки и `--verbose` — без значений из эталонного workflow в выводе (#7, FR-030a); сообщение 8 МБ < размер ≤ 8 МБ + 1 КБ → `error too-large`, соединение живо; больше → соединение закрыто (код не проверяется); некорректное сообщение → `invalid-message`, соединение живо; после работы во временном каталоге нет файлов (SC-007); бандл скопирован в пустой каталог без `node_modules` и запускается (#8, FR-029a)

### Implementation for User Story 5

- [ ] T052 [P] [US5] `packages/server/src/adapters/runtimes.d.ts` — минимальные объявления только используемых API: `Bun.serve` (`fetch`, `websocket` с `open`/`message`/`close`, `maxPayloadLength`, `idleTimeout`, `sendPings`), `server.upgrade(req, { headers, data })`, `server.requestIP(req)`; `Deno.serve`, `Deno.upgradeWebSocket(req, { idleTimeout })`, `Deno.args`, `Deno.errors.AddrInUse`, `info.remoteAddr` (research R10)
- [ ] T053 [US5] Адаптер Bun `packages/server/src/adapters/bun.ts`: `Bun.serve` с `websocket`, `maxPayloadLength: 8 МБ + 1 КБ`, `idleTimeout: 30`, `sendPings: true`, CORS на 101 через `upgrade({ headers })`, адрес клиента через `server.requestIP(req)`, `EADDRINUSE` — синхронное исключение из `Bun.serve` → текст и выход 1
- [ ] T054 [US5] Адаптер Deno `packages/server/src/adapters/deno.ts`: `Deno.serve` + `Deno.upgradeWebSocket(req, { idleTimeout: 30 })`, адрес — `info.remoteAddr` до `upgradeWebSocket`, CORS через `response.headers.set`, лимит — проверка длины строки в `session.ts` (закрытие 1009), отключение считается один раз (двойной `close` в Deno 2.9.6), `Deno.errors.AddrInUse` → текст и выход 1; аргументы — `Deno.args`
- [ ] T055 [US5] `--verbose` в `session.ts`: строка на каждое сообщение в обе стороны `<client> <in|out> <type> <doc|-> <bytes> B`; скрипты `server:bun` (`npm run build:server && bun packages/server/dist/dagflow-server.mjs`) и `server:deno` (`npm run build:server && deno run --allow-net packages/server/dist/dagflow-server.mjs`) в `package.json`
- [ ] T056 [US5] Прогнать `npm run test:conformance` (все три среды зелёные); ручные сценарии 1 (шаги 4–6) и 2 из quickstart.md

**Checkpoint**: один файл сервера работает в Node, Bun и Deno с одинаковыми результатами.

---

## Phase 6: User Story 2 — Вычисление в фоновом потоке (Priority: P2)

**Goal**: цель «Worker» — тот же хост в модульном worker; перезапуск после падения.

**Independent Test**: выбрать «This browser · Worker» — «● Worker», значения те же, что в
окне.

### Tests for User Story 2 ⚠️

- [ ] T057 [P] [US2] Тесты канала worker `tests/unit/engine-link/worker-channel.test.ts` с фейковым `Worker` и часами: строки в обе стороны; событие `error` у `Worker` → `onClose('crashed')`, `terminate()`, новый worker, повторная передача вкладок, уведомление «The engine restarted after a failure.» (US2 #2); третье падение за 60 с → статус `failed`, без перезапуска, индикатор «The background engine keeps failing.» + «Use local engine» (US2 #3); нет `Worker` в браузере → пробная попытка неудачна с текстом «This browser cannot run the engine in the background.» (Edge Cases)
- [ ] T058 [US2] e2e `tests/e2e/engine-us2-worker.spec.ts`: выбор строки «Worker» → «● Worker», значения всех вкладок те же (US2 #1); возврат на «This tab · Local» без потери значений (#4)
- [ ] T059 [US2] e2e `tests/e2e/engine-conformance.spec.ts` для проекта Playwright `bundle` (research R13): эталоны `tests/conformance/fixtures/*.json` загружаются через «Import» в левой панели (`setInputFiles`), в Local и в Worker состояния всех нодов совпадают с хостом `@dagflow/protocol`, вычисленным в процессе теста (SC-001 для браузера; после T049 — эталоны из US5)

### Implementation for User Story 2

- [ ] T060 [US2] Хост в worker `src/engine-link/engine-worker.ts` (`createEngineHost`, `postMessage(string)`, `tick` по `setTimeout(0)`, исключения хоста → `error internal`) и канал `src/engine-link/channels/worker.ts` (`new Worker(new URL('../engine-worker.ts', import.meta.url), { type: 'module' })`, учёт падений по часам адаптера) — чтобы прошли T057
- [ ] T061 [US2] Строка «This browser · Worker» в `EngineSection.tsx` выбирает Worker через пробную попытку (`welcome` от worker); индикатор «● Worker»; статус `failed` и уведомление в `src/store/engine.ts`
- [ ] T062 [US2] Проект Playwright `bundle` в `playwright.config.ts`: `webServer` — `npm run build && npx vite preview --port 4173 --strictPort`, `baseURL: http://localhost:4173/dagflow/`, `testMatch: /engine-conformance\.spec\.ts/`, Chromium и Firefox; основной проект `chromium`/`firefox` этот файл игнорирует; скрипт `test:e2e:bundle` в `package.json`
- [ ] T063 [US2] Прогнать T057–T059 (`npm run test:e2e:bundle`); ручной сценарий 4 (шаг 1) из quickstart.md

**Checkpoint**: три цели — Local, Worker, Server — работают через один хост.

---

## Phase 7: User Story 4 — Список целей и запоминание выбора (Priority: P2)

**Goal**: плоский список целей, до 5 серверов, «×», сохранение в браузере, независимые окна.

**Independent Test**: подключиться к двум серверам, перезагрузить — оба в списке, выбран
последний; «×» убирает невыбранный; щелчок по «Local» — вычисление в окне.

### Tests for User Story 4 ⚠️

- [ ] T064 [P] [US4] Тесты списка `tests/unit/engine-link/recent.test.ts` по data-model.md: успешное подключение ставит сервер первым («последний использованный первым»); при 6-м удаляется использованный давнее всех («0..5»); повторный адрес поднимается наверх без дубля (равенство без учёта регистра хоста); «×» удаляет невыбранный; выбранный и локальные строки удалить нельзя; найденная схема запоминается у адреса
- [ ] T065 [P] [US4] Тесты настроек `tests/unit/engine-link/settings.test.ts` с фейковым env (как `tests/unit/storage/location.test.ts`): ключ `dagflow:engine`, формат `EngineSettings` (`version: 1`, `target`, `recent`); отсутствующие или повреждённые настройки → по умолчанию Local и пустой список, без ошибки; инвариант «`target.kind === 'server'` ⇒ адрес есть в `recent`»
- [ ] T066 [US4] e2e `tests/e2e/engine-us4-targets.spec.ts` — US4 #1–#10: первый запуск — две строки, «● Local» (#1); новый сервер первым и выбран (#2); шестой сервер вытесняет самый старый (#3); щелчок по строке сервера — пробная попытка (#4); «×» у невыбранного, у выбранного и локальных нет (#5); перезагрузка — та же цель и список (#6, и US3 #8 «после перезагрузки — Local»); щелчок по индикатору открывает раздел (#7); сохранённый сервер недоступен при загрузке → «Offline» и «Use local engine» (US3 #7, FR-022); пустой и недопустимый адрес → текст у поля без попытки (#8); выгруженный файл workflow без сведений о цели (#9); два окна: смена цели в первом не меняет второе, после перезагрузки второго — выбран сервер (#10)
- [ ] T067 [P] [US4] Компонентный тест `tests/component/engine-section.test.tsx`: строки списка с типами «Local»/«Worker»/«Server», точка выбранной строки повторяет состояние индикатора (FR-014), «×» только у невыбранных серверов, aria-label «Remove `<address>` from the list»

### Implementation for User Story 4

- [ ] T068 [P] [US4] `src/engine-link/recent.ts` — операции со списком — чтобы прошли T064
- [ ] T069 [P] [US4] `src/engine-link/settings.ts` — `loadEngineSettings`/`saveEngineSettings` через `idb-keyval` (`get`/`set`, ключ `dagflow:engine`), env для тестов, схема Valibot `EngineSettingsSchema` — чтобы прошли T065
- [ ] T070 [US4] Загрузка настроек при старте в `src/main.tsx` (до `startEngine`; сохранённая цель-сервер → подключение без пробной попытки, недоступна → `offline` и «Use local engine» — FR-022); сохранение при каждом изменении цели и списка в `src/store/actions.ts`; `removeServer(address)`; окна не перечитывают настройки (FR-006)
- [ ] T071 [US4] Полный список в `EngineSection.tsx`: до 5 серверов «`<address>` · Server», «×», подпись с двумя версиями engine у выбранного сервера («engine `<server>` (editor `<editor>`)»), щелчок по строке — пробная попытка — чтобы прошли T066, T067
- [ ] T072 [US4] Прогнать T064–T067; ручной сценарий 4 (шаги 2–3) из quickstart.md

**Checkpoint**: выбор цели переживает перезагрузку, список удобен.

---

## Phase 8: User Story 6 — Несовместимая версия и ошибки обмена (Priority: P3)

**Goal**: понятные сообщения о версии протокола, неизвестном ноде, лимите и сбоях; редактор
восстанавливается сам.

**Independent Test**: поддельный сервер с `protocol: 2` → понятное сообщение и «Use local
engine»; другая версия engine → подключение работает, видны обе версии; большой workflow →
сообщение о лимите.

### Tests for User Story 6 ⚠️

- [ ] T073 [US6] Поддельные серверы в `tests/e2e/engine-server.ts`: «другой протокол» (`welcome` с `protocol: 2`, затем `error version-mismatch` и закрытие), «другой engine» (настоящий хост, `welcome.engine = '0.0.9'`), «не знает нод» (хост с реестром без одного встроенного нода), «сбоит» (отвечает `error internal` с `doc`)
- [ ] T074 [US6] e2e `tests/e2e/engine-us6-errors.spec.ts` — US6 #1–#7: ручное подключение к «другому протоколу» → «The server uses a different protocol version (server 2, editor 1). Update the server or the editor.», прежняя цель (#1); сохранённая цель стала «другим протоколом» → индикатор «Protocol version differs (server 2, editor 1)» + «Use local engine», повторов нет (#2); «другой engine» → подключение работает, индикатор и раздел показывают обе версии (#3); «не знает нод» → у этого нода ошибка неизвестного типа, остальные считаются (#4, FR-023a); workflow > 8 МБ → на вкладке «This workflow is too large for the server (limit: 8 MB).», ноды приглушены, после правки, уменьшившей граф, — снова считается (#5); «сбоит» → уведомление «The engine could not process the workflow. Retrying.» и один повтор на ревизию (#6); сервер «забыл» вкладку → молча передаётся заново (#7)

### Implementation for User Story 6

- [ ] T075 [US6] Статус `incompatible` в `connection.ts` и `src/store/engine.ts` (из события клиента; закрытие после `version-mismatch` — не обрыв); тексты у поля и в индикаторе — по ui-texts.md
- [ ] T076 [US6] Обработка событий клиента в `src/store/engine.ts`: `too-large` → `tooLarge.tabs[doc]` / `tooLarge.library` (сброс при следующей успешной отправке), полоса «This workflow is too large…» над холстом в `src/ui/Editor.tsx`; `failed` → уведомление `notify('warning', …)` и повтор по правилам клиента; `resend` — без уведомления
- [ ] T077 [US6] Прогнать T073–T074 и unit-тесты клиента (T016) по ошибкам обмена

**Checkpoint**: все ошибки обмена понятны пользователю и не теряют работу.

---

## Phase 9: Polish & Cross-Cutting

- [ ] T078 [P] Обработка разрешения Local Network Access в `src/engine-link/probe.ts` (research R8 п. 4): `navigator.permissions.query({ name: 'loopback-network' })` для локальных адресов и `'local-network'` для остальных в `try`; состояние `prompt` → таймаут открытия не идёт, `awaitingPermission: true`, подсказка «Allow local network access in the browser prompt.» рядом с «Connecting…» и «Use local engine» в индикаторе (в т. ч. при подключении на старте); `denied` → текст «The browser blocks access to the local network for this page. Allow it in the site settings and try again.» (FR-011, FR-012); тесты в `tests/unit/engine-link/probe.test.ts` с фейковым Permissions API
- [ ] T079 [P] Перф `tests/e2e/perf.spec.ts`: SC-002 для Worker (< 0,2 с) и для сервера на том же компьютере (< 0,5 с) через фикстуру сервера
- [ ] T080 [P] `CLAUDE.md`: команды (`build:server`, `server`, `server:bun`, `server:deno`, `test:conformance`, `test:e2e:bundle`), «готово» += `test:conformance` и `test:e2e:bundle`; «Устройство» — `packages/engine` (sans-IO: tsconfig без DOM и ESLint), `packages/protocol`, `packages/server`, `src/engine-link`, `src/store/engine.ts`; тексты — `src/ui/messages.ts`, `packages/engine/src/errors.ts`, `packages/server/src/messages.ts`; предусловие — Node 24+, Bun 1.4+, Deno 2.9+ в `PATH`; `typecheck` — по корню и пакетам
- [ ] T081 [P] `README.md`: команды и структура пакетов (без `tsconfig.engine.json`), запуск сервера (`npm run server`, перенос `dagflow-server.mjs` в другую папку)
- [ ] T082 Прогнать всё: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:conformance`, `npm run test:e2e`, `npm run test:e2e:firefox`, `npm run test:e2e:bundle`, `npm run test:perf`, `npm run build` — зелёные; ручная проверка по quickstart.md, включая раздел 6 (Local Network Access) — результат записать в research.md R8

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → истории.
- **US1 (Phase 3)** зависит от Phase 2.
- **US3 (Phase 4)** зависит от US1 (сервер, `connection.ts`, индикатор).
- **US5 (Phase 5)** зависит от US1 (сервер, сборка); с US3 не пересекается — можно
  параллельно с US3.
- **US2 (Phase 6)** зависит от Phase 2 и пробной попытки из US1 (`connection.ts`); T059 —
  от эталонов T049 (US5).
- **US4 (Phase 7)** зависит от US1 (`EngineSection`, `connectServer`); T066 #6 закрывает
  часть US3 #8.
- **US6 (Phase 8)** зависит от US1 и фикстуры T027; статус `incompatible` использует
  «Use local engine» из US3.
- **Polish** — после нужных историй (T078 — после US1, T079 — после US2 и US1).

### Within Each Story

- Тесты сначала и падают → реализация → прогон.
- Пакет и чистые модули (address, recent, settings, options) → каналы и машина
  состояний → стор → UI.

### Parallel Opportunities

- Phase 2: T009, T010 параллельно с T011–T013; T019 — после T015.
- US1: T024, T025, T026 — одновременно; T030, T034 — параллельно с адаптером Node.
- US3 и US5 — параллельно (разные файлы: `src/engine-link`/UI против `packages/server`
  и `tests/conformance`).
- US4: T064, T065, T067, T068, T069 — одновременно.
- Polish: T078–T081 — одновременно.

---

## Parallel Example: User Story 1

```bash
# Тесты US1 одновременно:
Task: "T024 tests/unit/engine-link/address.test.ts"
Task: "T025 tests/unit/engine-link/probe.test.ts"
Task: "T026 packages/server/test/options.test.ts, session.test.ts"
# Реализация, не зависящая друг от друга:
Task: "T030 packages/server/src/messages.ts"
Task: "T034 src/engine-link/address.ts"
```

## Parallel Example: US3 и US5

```bash
# Разные части кода — одновременно после US1:
Task: "T041–T046 переподключение и приглушение (src/engine-link, src/ui)"
Task: "T048–T055 conformance и адаптеры Bun/Deno (tests/conformance, packages/server)"
```

---

## Implementation Strategy

### MVP

Phase 1 → Phase 2 → US1 → **STOP and VALIDATE**: `engine-us1-server.spec.ts`, ручной
сценарий 1 quickstart (Node). Коммит после каждой фазы.

### Incremental Delivery

1. Setup → монорепо; коммит (чистый перенос).
2. Foundational → Local через протокол; коммит.
3. US1 → сервер в Node (MVP); коммит.
4. US3 → обрыв и восстановление; коммит.
5. US5 → Bun, Deno, conformance; коммит.
6. US2 → Worker и проверка собранного редактора; коммит.
7. US4 → список целей и настройки; коммит.
8. US6 → версии и ошибки обмена; коммит.
9. Polish → LNA, перф, `CLAUDE.md`, README, полный прогон; коммит.

---

## Notes

- Отклонения от плана (другая версия пакета, новый файл, изменённая сигнатура) сразу
  записывать в `plan.md`, `research.md`, контракты.
- Тексты для пользователя — только в `src/ui/messages.ts`, `packages/engine/src/errors.ts`,
  `packages/server/src/messages.ts`.
- `packages/engine` и `packages/protocol` — без API среды и без `Date`/`Math.random`
  (tsconfig и ESLint проверяют).
- Коммит — после каждой фазы, по команде пользователя.
