# Quickstart: проверка фичи 004

Сценарии из [spec.md](./spec.md); детали — [contracts/](./contracts/) и
[data-model.md](./data-model.md).

## Подготовка

```bash
# Node 24+, Bun 1.4+, Deno 2.9+ установлены на машине и доступны в PATH (research R12)
npm ci
npm run build:server         # packages/server/dist/dagflow-server.mjs
npm run dev                  # редактор на http://localhost:5173
```

## Автоматические проверки

```bash
npm run typecheck            # приложение и пакеты; engine и protocol — без DOM
npm run lint                 # в т. ч. sans-IO правила для engine и protocol
npm test                     # unit + component (пакеты и редактор)
npm run test:conformance     # бандл сервера в node, bun, deno из PATH = хост в процессе (SC-001, SC-007)
npm run test:e2e             # Chromium, с фикстурой сервера
npm run test:e2e:firefox
npm run test:e2e:bundle      # собранный редактор: Local и Worker = хост (SC-001), Chromium и Firefox
npm run test:perf            # SC-002: Local, Worker, Server
```

Ожидается: всё зелёное.

## Ручные сценарии

### 1. Сервер и подключение (US1, US5)

1. `npm run server -- --port 8080` → «DAG Flow engine 0.1.0 is listening on
   127.0.0.1:8080».
2. В редакторе: Menu → Engine → `localhost:8080` → Connect. Индикатор:
   «● Server · localhost:8080 · engine 0.1.0». Граф «2 + 3 → Show» показывает 5;
   правка входа пересчитывается.
3. В консоли сервера: «Connected: 127.0.0.1:… (connections: 1)». Значений графа в
   выводе нет.
4. Повторить с `npm run server:bun -- --port 8081` и `npm run server:deno -- --port 8082`.
5. Второй запуск на занятом порту → «Port 8080 is already in use…», без трассировки.
6. `--host 0.0.0.0` → предупреждение об отсутствии аутентификации.

### 2. Перенос сервера одним файлом (FR-029a, US5 #8)

1. Скопировать `packages/server/dist/dagflow-server.mjs` в пустую папку вне проекта.
2. `node dagflow-server.mjs --port 8080` (или `bun …`, `deno run --allow-net …`) —
   стартует, редактор подключается.

### 3. Обрыв и восстановление (US3)

1. Подключиться к серверу, остановить его (Ctrl+C) → за ≤ 2 с «◌ Offline — retrying in
   N s», значения приглушены, в «Properties» — «Last known value — engine offline».
2. Добавить нод и связь, поменять значение — всё работает.
3. Запустить сервер снова → за ≤ 15 с значения пересчитаны с учётом правок.
4. Остановить сервер, нажать «Use local engine» → выбрана «This tab · Local», после
   перезагрузки — тоже.

### 4. Worker и список целей (US2, US4)

1. Выбрать «This browser · Worker» → «● Worker», значения те же.
2. Подключиться к двум серверам, перезагрузить страницу → оба в списке, выбран
   последний; «×» у невыбранного убирает его.
3. Открыть редактор во втором окне, в первом переключиться на сервер → второе окно
   продолжает считать у себя; после его перезагрузки выбран сервер.

### 5. Версии и ошибки (US6)

Проверяются e2e с поддельными серверами (R17). Вручную — запустить старую сборку сервера
другой версии протокола, если она есть.

### 6. Только вручную: разрешение браузера (research R8)

1. **Local Network Access** (Chrome 147+, Firefox 154+): собрать и открыть редактор с
   публичного адреса по https (например, GitHub Pages), подключиться к `localhost:8080`.
   Ожидается: браузер спрашивает разрешение, рядом с «Connecting…» — подсказка «Allow
   local network access in the browser prompt.»; после «Allow» подключение проходит,
   даже если ответить позже 3 с. После «Block» — текст про настройки сайта.
   Записать в research.md, держит ли браузер рукопожатие до ответа.
