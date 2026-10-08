# CLAUDE.md

DAG Flow — веб-редактор графов из нодов с реактивной средой выполнения
(TypeScript, React, React Flow, Zustand, Vite). Учебный проект по spec-driven
development на GitHub Spec Kit. Интерфейс и все тексты для пользователя — на английском;
артефакты Spec Kit, комментарии и общение — на русском.

**Язык общения**: отвечать пользователю на русском. По-английски — только термины
и устоявшиеся сочетания (property grid, drag-and-drop, e2e, commit), имена команд,
файлов и кода.

## Команды

Нужны Node 24+, а для `test:conformance` и запуска сервера в других средах — Bun 1.4+ и
Deno 2.9+ в `PATH` (не зависимости npm: ставятся на машину, фича 004, research R12).

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер на http://localhost:5173 |
| `npm test` | unit- и компонентные тесты (Vitest, проекты `unit` и `component`) |
| `npm run test:e2e` | e2e-тесты в Chromium (Playwright); перед ними собирается сервер |
| `npm run test:e2e:firefox` | e2e в Firefox (без сценариев выбора рабочей папки) |
| `npm run test:e2e:bundle` | собранный редактор (`vite build` + `vite preview`): Local и Worker = хост протокола |
| `npm run test:conformance` | собранный сервер в Node, Bun, Deno = хост протокола; сценарии сервера |
| `npm run test:perf` | замеры SC-002/SC-003 на графе из 100 нодов (Local, Worker, Server) |
| `npm run typecheck` | TypeScript для приложения и отдельно для каждого пакета (`packages/*/tsconfig.json`) |
| `npm run lint` | ESLint, в том числе sans-IO правила для `packages/engine` и `packages/protocol` |
| `npm run build` | проверка типов и production-сборка редактора |
| `npm run build:server` | сервер выполнения одним файлом: `packages/server/dist/dagflow-server.mjs` |
| `npm run server -- --port 8080` | собрать и запустить сервер в Node (`server:bun`, `server:deno` — в Bun, Deno) |

Перед тем как считать работу готовой: `typecheck`, `lint`, `npm test`, `test:e2e`,
`test:e2e:bundle` и `test:conformance` зелёные.

## Устройство

Монорепо на npm workspaces: редактор — корневой пакет, рядом `packages/*` (фича 004).

- `packages/engine/` (`@dagflow/engine`) — модель графа и вычислитель. Чистый TypeScript
  без зависимостей от UI, DOM и хранилища, без ввода-вывода (sans-IO).
- `packages/protocol/` (`@dagflow/protocol`) — протокол редактор ↔ engine: сообщения,
  схемы Valibot (общие с форматами файлов), sans-IO хост и клиент.
- В `engine` и `protocol` нет API среды (`setTimeout`, `console`, `structuredClone`,
  `fetch`, `TextEncoder`…) и `Date.now`/`Math.random`/`new Date()`: это проверяют их
  `tsconfig.json` (`lib: ESNext`, `types: []`) и ESLint. Время, таймеры и случайность
  передаются извне.
- `packages/server/` (`@dagflow/server`) — сервер выполнения: адаптеры WebSocket для Node
  (`ws`), Bun и Deno, один собранный файл (Vite SSR). Тексты — `packages/server/src/messages.ts`.
- Пакеты отдают исходники TypeScript (`exports: ./src/index.ts`); тесты пакетов —
  `packages/*/test/`.
- `src/engine-link/` — связь редактора с целью вычисления (Local, Worker, Server): адрес,
  проба схем, подключение и переподключение, каналы, настройки `dagflow:engine`.
- `src/model/` — форматы файлов, импорт; `src/storage/` — рабочая папка / OPFS,
  автосохранение; `src/store/` — Zustand-стор, история; `src/store/engine.ts` — связка
  стора с клиентом протокола (единственный, кто пишет `nodeStates`); `src/ui/` — React.
- Тексты для пользователя — только в `src/ui/messages.ts`, `packages/engine/src/errors.ts`
  и `packages/server/src/messages.ts`.
- Числа в текстах — без склонения: число после двоеточия («Links removed: 3»,
  «[items: 3]»). Функций вроде `plural` не заводить, тестов на формы числа не писать.
- Код форматируется Prettier: `npx prettier --write <файлы>`.

## Зависимости

- Перед добавлением или обновлением пакета проверять совместимость: `npm view <пакет> peerDependencies`.
  TypeScript держим на 6.0.x: typescript-eslint пока поддерживает только `<6.1`.
- Каждая новая зависимость (включая dev) обосновывается в таблице plan.md
  (раздел «Ограничения» конституции).

## Тесты

- e2e-хелперы — `tests/e2e/helpers.ts`:
  - `addNode` — палитра по Пробелу, нужная вкладка категории, перетаскивание на холст;
    после броска палитра закрывается (её полоса внизу закрыла бы ноды);
  - `selectNode` (щелчок по `.flow-node__name`), `setInput`, `valueOf`, `inputField` —
    значения портов только в окне «Properties», на карточке нода их нет;
  - `connect` (перетаскивание строки окна свойств на нод → строка временного окна),
    `linkByClick` (режим привязки по маркеру);
  - `openSidebar`/`closeSidebar` — список workflow, хранилище, выгрузка и загрузка живут в
    левой панели за кнопкой «Menu»; `tabBar` — вкладки workflow (у палитры тоже есть `tab`).
- Ноды на холсте искать по содержимому или `data-id`, а не по `nth()`: порядок нодов
  меняется (например, после сворачивания в составной нод). Элементы палитры — через
  `.palette__item-title`: название нода может совпадать с названием категории («Text»).
- Компонентные тесты: `tests/component/helpers.tsx` — `UiProbe` (действия стора
  интерфейса: выделение, окна, связывание), `openSidebar`, `openPalette`. Модальные диалоги
  и плавающие окна — оба `role="dialog"`: искать по имени.
- Связывание в e2e: временное окно нода может закрыть соседний нод — к цели подводить
  курсор так, чтобы не задевать другие ноды (хелпер `connect` заходит сверху).
- e2e со сценариями рабочей папки запускаются через фикстуру `tests/e2e/persistent.ts`:
  Chromium падает при чтении сохранённого дескриптора папки в «инкогнито»-контексте.
- Перед `page.reload()` после правки ждать ~1 с: автосохранение срабатывает через 300 мс.
- Поддерживаемые браузеры — Chromium и Firefox; e2e гоняются в обоих.
- Сервер в e2e: фикстура `tests/e2e/engine-server.ts` — настоящий собранный сервер
  (`engineServer`: `stop()`/`start()` на том же порту) и поддельные серверы
  (`startFakeServer`: другой протокол, другой engine, неизвестный нод, сбои). Разные адреса
  одного сервера — пути (`localhost:N/1`): сервер принимает WebSocket на любом пути.
- Эталонные workflow для одинаковых результатов — `tests/conformance/fixtures/` (формат
  файла выгрузки); их используют `test:conformance` и `test:e2e:bundle`.

## Spec Kit

- Принципы проекта — `.specify/memory/constitution.md`; фичи — `specs/NNN-…/`
  (spec, plan, research, data-model, contracts, tasks, quickstart).
- Артефакты — источник истины: если поведение меняется, сначала правится `spec.md`,
  затем plan/tasks, затем код (принцип V конституции).
- Порядок работы над новой фичей:
  1. При конфликте с конституцией — `/speckit-constitution`.
  2. `/speckit-specify` (что и зачем, без технологий) → `/speckit-clarify`.
  3. `/speckit-plan` (стек) → `/speckit-tasks` → `/speckit-analyze`, исправить CRITICAL/HIGH.
  4. `/speckit-implement` по фазам, начиная с MVP.
  5. `/speckit-converge` → реализовать дописанные задачи → повторять до «Converged».
  6. Ручная проверка по `quickstart.md`, `git merge --no-ff` в `master`.
- Изменение готовой фичи: правка её `spec.md` (и plan/research/контрактов при
  необходимости) → `/speckit-analyze` → `/speckit-converge` → `/speckit-implement`.
  **Не перезапускать `/speckit-plan` и `/speckit-tasks` на готовой фиче** —
  `setup-plan.sh` затирает `plan.md` шаблоном.
- Отложенные фичи — `specs/BACKLOG.md` (соглашение проекта, не часть Spec Kit):
  - если в ходе фичи договорились вынести часть работы на потом, сразу добавить
    раздел в BACKLOG.md: откуда взялось, когда начинать, описание для
    `/speckit-specify`, заметки к плану; в spec.md текущей фичи записать, что
    это вне её рамок;
  - новую фичу начинать на `master`, сначала свериться с BACKLOG.md; её раздел
    удаляется в том же коммите, где появляется `spec.md` новой фичи;
  - две фичи, меняющие одни и те же файлы, не вести параллельно: следующая
    начинается после слияния предыдущей.
- Тесты обязательны для бизнес-логики, у каждого acceptance-сценария есть тест (принцип II);
  тесты пишутся до реализации.
- Отклонения от плана во время реализации (другая версия пакета, новый файл, изменённая
  сигнатура) сразу записывать в артефакты: research.md, дерево файлов в plan.md, контракты.
- В markdown-артефактах плейсхолдеры вида `<имя>` писать в обратных кавычках или как
  `&lt;имя&gt;`: иначе предпросмотр принимает их за HTML-теги (`<title>` скрывает весь
  текст после себя).

## Git

- Основная ветка — `master`; фичи — ветки `NNN-имя`, вливаются через `--no-ff`.
- Коммит — после каждого шага Spec Kit и каждой фазы реализации, по команде пользователя.
- Историю git не переписывать (`--amend`, `rebase`, `filter-branch` и т. п.) без явной просьбы.
