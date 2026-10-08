# DAG Flow

Учебный проект по **spec-driven development** (GitHub Spec Kit + Claude Code):
веб-редактор графов из нодов с реактивной средой выполнения.

Пользователь собирает граф на холсте, соединяя выходы одних нодов со входами других.
Граф всегда реактивен: любое изменение сразу пересчитывает зависимые ноды, и новые
значения видны в реальном времени. Группы нодов можно сворачивать в переиспользуемые
составные ноды. Работа автоматически сохраняется в рабочую папку на диске (Chrome, Edge)
или во внутреннее хранилище браузера; workflow можно выгружать в файл и загружать.

Граф считается там, где выберет пользователь: в окне редактора, в фоновом потоке
браузера или на своём сервере выполнения — один и тот же engine в браузере, Node, Bun
и Deno. Данные остаются у пользователя: сервер держит граф только в памяти.

**Попробовать онлайн:** https://thetilliwilli.github.io/dagflow/ — собирается из `master`
и публикуется на GitHub Pages автоматически.

## Быстрый старт

Требуется Node.js 24 LTS (для проверки сервера в других средах — ещё Bun 1.4+ и Deno 2.9+).

```bash
npm install
npm run dev          # редактор на http://localhost:5173
```

### Сервер выполнения

```bash
npm run server -- --port 8080        # сборка и запуск в Node
npm run server:bun -- --port 8080    # в Bun
npm run server:deno -- --port 8080   # в Deno
```

В редакторе: Menu → Engine → `localhost:8080` → Connect. Сервер — один файл
`packages/server/dist/dagflow-server.mjs`: его можно скопировать на другую машину и
запустить `node dagflow-server.mjs --port 8080` (или `bun …`, `deno run --allow-net …`)
без копии проекта. По умолчанию сервер слушает только `127.0.0.1`; аутентификации нет.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер |
| `npm run build` | проверка типов и production-сборка в `dist/` |
| `npm run build:server` | сервер выполнения одним файлом |
| `npm test` | unit- и компонентные тесты (Vitest) |
| `npm run test:e2e` | e2e-тесты (Playwright, Chromium); перед первым запуском: `npx playwright install chromium` |
| `npm run test:e2e:bundle` | собранный редактор: вычисление в окне и в фоновом потоке |
| `npm run test:conformance` | собранный сервер в Node, Bun и Deno даёт те же результаты |
| `npm run test:perf` | замеры SC-002/SC-003 на графе из 100 нодов |
| `npm run typecheck` | TypeScript для приложения и каждого пакета |
| `npm run lint` | ESLint (в том числе запрет API среды в engine и protocol) |

## Устройство

```text
packages/
├── engine/    # @dagflow/engine: типы, встроенные ноды, проверки, составные ноды, реактивный вычислитель
├── protocol/  # @dagflow/protocol: протокол редактор ↔ engine, схемы Valibot, хост и клиент без ввода-вывода
└── server/    # @dagflow/server: сервер выполнения для Node, Bun, Deno (WebSocket)
src/           # редактор
├── engine-link/ # цель вычисления: окно, фоновый поток, сервер; подключение и переподключение
├── model/     # форматы файлов, импорт и слияние
├── storage/   # рабочая папка (File System Access API) / OPFS, автосохранение
├── store/     # Zustand: workflow, вкладки, история отмены, связка с engine, хранение
└── ui/        # React + React Flow
```

Engine и протокол не используют API конкретной среды (это проверяют их `tsconfig.json`
и ESLint), поэтому один и тот же код работает в браузере и на сервере.

## Спецификация

Весь путь от идеи до кода — в [`specs/`](specs/): по каталогу на фичу (001 — редактор,
004 — выполнение на выбранном engine). Например, [`specs/001-dag-workflow-editor/`](specs/001-dag-workflow-editor/):

- [spec.md](specs/001-dag-workflow-editor/spec.md) — что и зачем (user stories, требования, критерии успеха)
- [plan.md](specs/001-dag-workflow-editor/plan.md) — стек, структура, проверка по конституции
- [research.md](specs/001-dag-workflow-editor/research.md) — технические решения и их обоснования
- [data-model.md](specs/001-dag-workflow-editor/data-model.md), [contracts/](specs/001-dag-workflow-editor/contracts/) — модель данных и контракты
- [tasks.md](specs/001-dag-workflow-editor/tasks.md) — задачи реализации
- [quickstart.md](specs/001-dag-workflow-editor/quickstart.md) — сценарии ручной проверки

Принципы проекта — в [конституции](.specify/memory/constitution.md). Как пользоваться
Spec Kit — в [GUIDE-RU.md](GUIDE-RU.md).
