---

description: "Task list for 001-dag-workflow-editor"
---

# Tasks: Визуальный редактор и реактивная среда выполнения DAG-workflow

**Input**: Design documents from `/specs/001-dag-workflow-editor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: включены. Принцип II конституции требует тестов для всей бизнес-логики
и хотя бы одного теста на каждый acceptance-сценарий. Тесты каждой фазы пишутся
**до** реализации и должны сначала падать.

**Organization**: задачи сгруппированы по user stories; каждая история — отдельный
проверяемый инкремент.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: к какой user story относится задача (US1…US5)
- Пути — относительно корня репозитория (single project, см. plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: инициализация проекта и инструментов

- [X] T001 Создать `package.json` (name `dagflow`, `"type": "module"`, `"private": true`) с зависимостями react@^19.3, react-dom@^19.3, @xyflow/react@^12.12, zustand@^5.0, immer@^11.1, valibot@^1.5, idb-keyval@^6.3 и dev-зависимостями typescript@~6.0, vite@^8.3, @vitejs/plugin-react@^6.1, vitest@^5.0, jsdom, @testing-library/react@^16.3, @testing-library/user-event, @testing-library/jest-dom, @playwright/test@^1.63, @types/react, @types/react-dom, eslint, typescript-eslint, eslint-plugin-react-hooks, prettier; скрипты `dev`, `build`, `preview`, `test` (vitest run), `test:watch`, `test:e2e` (playwright test), `typecheck` (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.engine.json --noEmit`), `lint`; выполнить `npm install`
- [X] T002 [P] Создать `tsconfig.json` (strict, `noUncheckedIndexedAccess`, target ES2023, lib `["ES2023","DOM","DOM.Iterable"]`, jsx `react-jsx`, include `src`, `tests`) и `tsconfig.engine.json` (include только `src/engine/**/*.ts`, lib `["ES2023"]` **без DOM**, `types: []`) — гарантирует независимость движка от браузера
- [X] T003 [P] Создать `vite.config.ts` с @vitejs/plugin-react и конфигом Vitest из двух проектов: `unit` (environment `node`, include `tests/unit/**/*.test.ts`) и `component` (environment `jsdom`, include `tests/component/**/*.test.{ts,tsx}`, setupFiles `tests/component/setup.ts`)
- [X] T004 [P] Создать `playwright.config.ts`: только Chromium, testDir `tests/e2e`, `webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: true }`
- [X] T005 [P] Создать `eslint.config.js` (typescript-eslint, react-hooks) с правилом `no-restricted-imports` для `src/engine/**`: запрещены `react`, `react-dom`, `@xyflow/*`, `zustand`, `immer`, `idb-keyval`, а также пути `../ui`, `../store`, `../storage`, `../model`; создать `.prettierrc` (singleQuote, printWidth 100)
- [X] T006 [P] Создать `index.html` (lang `ru`, `<div id="root">`), `src/main.tsx` (рендер `<App/>`), заглушку `src/ui/App.tsx`, `src/ui/styles.css`; дополнить `.gitignore`: `node_modules/`, `dist/`, `test-results/`, `playwright-report/`
- [X] T007 [P] Создать `tests/component/setup.ts` (импорт `@testing-library/jest-dom/vitest`, cleanup после каждого теста, мок `requestAnimationFrame` через fake timers-хелпер `flushFrames()`), проверить, что `npm test`, `npm run typecheck`, `npm run lint` проходят на пустом проекте

**Checkpoint**: проект собирается, тестовые раннеры запускаются

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ядро движка и каркас стора, на которых стоят все истории

**⚠️ CRITICAL**: работа над user stories не начинается до завершения этой фазы

### Тесты фундамента (писать первыми, должны падать)

- [X] T008 [P] Написать `tests/unit/engine/values.test.ts`: проверка значения по типу по правилам data-model — «`number` — конечное число (без NaN и Infinity), `text` — строка, `boolean` — логическое, `array` — массив, `object` — объект (не массив и не null), `any` — любое JsonValue, включая null»; матрица совместимости 6×6 по правилу `a === b || a === 'any' || b === 'any'`; глубокое равенство JSON (порядок ключей объекта не важен, порядок элементов массива важен)
- [X] T009 [P] Написать `tests/unit/engine/validate.test.ts` по [contracts/engine-api.md](./contracts/engine-api.md): `canConnect` отклоняет связь C → A в цепочке A → B → C с кодом `cycle`; связь нода с самим собой — `same-node`; text → number — `type-mismatch` с сообщением, содержащим оба типа по-русски; любой тип ↔ `any` разрешён; связь на занятый вход возвращает `{ok: true, replaces: <id старой связи>}`; несуществующий порт — `unknown-port`; `validateGraph` находит цикл, неизвестный тип нода и несовместимую связь в загруженном графе; ноды `builtin:input`/`builtin:output` вне составного нода — `io-node-outside-composite`
- [X] T010 [P] Написать `tests/unit/engine/evaluator.test.ts` с гарантиями E1–E7 из [contracts/engine-api.md](./contracts/engine-api.md): E1 — после `setValue` пересчитываются только потомки (счётчик вызовов `compute` на тестовых нодах); E2 — «ромб» A→B, A→C, B→D, C→D: D вычисляется ровно один раз и только после B и C; E3 — разный порядок `setValue` в пакете даёт одинаковый результат; E4 — незаполненный обязательный вход (нет связи, нет значения в `values`, нет `default`) → `waiting` с именем входа в `message`, а `null`, пришедший по связи, считается значением; E5 — `NodeError` → `error`, потомки → `blocked`, независимая ветка → `ok`; E6 — исправление значения возвращает всю цепочку в `ok` одним `flush()`; E7 — значение не того вида по порту `any` → `error` с понятным текстом; исключение, не являющееся `NodeError`, → `error` с текстом «Внутренняя ошибка нода "&lt;title&gt;"» без трассировки; `pending()` содержит грязные ноды до `flush()`
- [X] T011 [P] Написать `tests/unit/engine/builtins.test.ts`: каждый нод из [contracts/builtin-nodes.md](./contracts/builtin-nodes.md) — порты (имена, типы, обязательность, значения по умолчанию) и поведение, включая точные тексты ошибок: «Деление на ноль: задайте ненулевой делитель», «Результат слишком большой», «"&lt;text&gt;" не является числом», «Ожидался массив, получено: &lt;вид&gt;», «Ожидался объект, получено: &lt;вид&gt;», «Поле "&lt;key&gt;" не найдено», индекс вне диапазона и нецелый индекс у `builtin:array-get`

### Реализация фундамента

- [X] T012 [P] Создать `src/engine/types.ts`: `JsonValue`, `PortType`, `PortDef` (`name` — «уникально среди входов (или среди выходов) нода; 1–40 символов», `type`, `required`, `default?`), `NodeTypeDef`, `NodeInstance` (`id`, `type`, `position`, `values`, `ports?`), `Edge`, `Graph`, `Workflow` (`name` — «1–100 символов»), `CompositeDef`, `Workspace`, `Tab`, `NodeStatus = 'ok' | 'computing' | 'waiting' | 'error' | 'blocked'`, `NodeState` — строго по [data-model.md](./data-model.md)
- [X] T013 [P] Создать `src/engine/errors.ts`: класс `NodeError` (`userMessage`), тип `Rejection`, `RejectCode` (`cycle`, `type-mismatch`, `same-node`, `unknown-port`, `duplicate-port-name`, `composite-recursion`, `io-node-outside-composite`), функции-конструкторы русских сообщений и словарь русских названий типов (`number` → «число», `text` → «текст», …)
- [X] T014 Реализовать `src/engine/values.ts`: `matchesType(value, type)`, `isCompatible(a, b)`, `deepEqual(a, b)`, `describeKind(value)` (для сообщений «получено: &lt;вид&gt;»), `formatCompact(value)`; T008 зелёный
- [X] T015 [P] Реализовать `src/engine/builtins/constants.ts` (`builtin:number`, `builtin:text`, `builtin:boolean`, `builtin:json`)
- [X] T016 [P] Реализовать `src/engine/builtins/math.ts` (`builtin:add`, `builtin:subtract`, `builtin:multiply`, `builtin:divide`; проверка конечности результата)
- [X] T017 [P] Реализовать `src/engine/builtins/text.ts` (`builtin:concat`, `builtin:text-length`, `builtin:to-text`, `builtin:to-number`)
- [X] T018 [P] Реализовать `src/engine/builtins/logic.ts` (`builtin:equals`, `builtin:greater`, `builtin:less`, `builtin:and`, `builtin:or`, `builtin:not`, `builtin:if`)
- [X] T019 [P] Реализовать `src/engine/builtins/collections.ts` (`builtin:array-append`, `builtin:array-get`, `builtin:array-length`, `builtin:object-set`, `builtin:object-get`)
- [X] T020 [P] Реализовать `src/engine/builtins/show.ts` (`builtin:show`, без выходов) и `src/engine/builtins/index.ts` (массив всех встроенных `NodeTypeDef` с категориями «Константы», «Арифметика», «Текст», «Сравнение и логика», «Условие», «Массивы и объекты», «Отображение»); T011 зелёный
- [X] T021 Реализовать `src/engine/registry.ts`: `createRegistry(composites)` с методами `get`, `list` (пока только встроенные ноды; поддержка составных — T081)
- [X] T022 Реализовать `src/engine/validate.ts`: `canConnect` (существование портов, направление, совместимость, поиск цикла DFS от target к source, замена занятого входа), `canAddNode`, `validateGraph`; T009 зелёный
- [X] T023 Реализовать `src/engine/evaluator.ts` по research R2: `setGraph`, `setValue`, `pending`, `flush` (грязные = изменённые + потомки; алгоритм Кана на подграфе грязных, стабильный порядок по позиции в `graph.nodes`), `state`; правила статусов `waiting`/`error`/`blocked`; оборачивание исключений из `compute`; T010 зелёный
- [X] T024 Создать `src/engine/index.ts` — публичный API движка (реэкспорт типов, `createRegistry`, `canConnect`, `canAddNode`, `validateGraph`, `createEvaluator`, `NodeError`); `npm run typecheck` проходит для `tsconfig.engine.json`
- [X] T025 Создать каркас стора `src/store/store.ts` (Zustand + Immer middleware): срезы `workspace` (`workflows: Record<id, Workflow>`, `workflowOrder`, `composites: Record<id, CompositeDef>`), `tabs`, `activeTabId`, `nodeStates: Record<tabId, Record<nodeId, NodeState>>`; генератор id (`crypto.randomUUID`) и часы передаются при создании стора (для тестов); при пустом workspace создаётся workflow «Новый workflow» и открывается во вкладке
- [X] T026 [P] Создать `src/ui/messages.ts` — все тексты интерфейса на русском (заголовки, кнопки, статусы нодов: «вычислен», «вычисляется», «ожидает входов», «ошибка», «не вычислен: проблема выше по графу»)

**Checkpoint**: движок полностью покрыт тестами и работает без UI; стор создаётся

---

## Phase 3: User Story 1 — Собрать граф и видеть результат в реальном времени (Priority: P1) 🎯 MVP

**Goal**: пользователь собирает граф из встроенных нодов на холсте, и значения пересчитываются и отображаются в реальном времени

**Independent Test**: граф «Число 2» → «Сложить» ← «Число 3» → «Показать» показывает 5; замена 2 на 10 сразу даёт 13

### Тесты US1 (писать первыми)

- [X] T027 [P] [US1] Написать `tests/component/store-actions.test.ts`: `addNode` (нод появляется с портами типа), `moveNode`, `deleteNode` удаляет все его связи (FR-002), `connect` (один выход → несколько входов, повторная связь на вход заменяет старую — FR-003), `disconnect` (FR-006), `setInputValue` принимает только значение, соответствующее типу порта (FR-007)
- [X] T028 [P] [US1] Написать `tests/component/evaluation.test.ts`: после `setInputValue` и `flushFrames()` состояния нодов в сторе обновлены; ноды независимой ветки не пересчитывались (acceptance US1 #5); при общем источнике нод-приёмник обновлён один раз (#4); добавление связи пересчитывает приёмник (#2); быстрая серия правок в одном кадре даёт состояние по последнему значению (edge case); правка во время ожидания `flush()` не показывает результатов для предыдущего значения (FR-020)
- [X] T029 [P] [US1] Написать `tests/component/FlowNode.test.tsx`: нод показывает заголовок, входы и выходы с типами и текущими значениями (FR-015, acceptance #1); неподключённый вход редактируется прямо на ноде, подключённый — только для чтения (FR-007); значение-массив из 50 элементов показывается компактно и раскрывается по клику (FR-007a)
- [X] T030 [P] [US1] Написать `tests/e2e/us1-reactive-graph.spec.ts`: сценарий из Independent Test (2 + 3 = 5 → 10 + 3 = 13) и цепочка A → B → C, где изменение входа A обновляет C без дополнительных действий (acceptance #3)

### Реализация US1

- [X] T031 [US1] Реализовать `src/store/actions.ts`: `addNode`, `moveNode`, `deleteNodes`, `connect` (через `canConnect`, при `replaces` удаляет старую связь), `disconnect`, `setInputValue` (проверка `matchesType`) для графа активной вкладки
- [X] T032 [US1] Реализовать `src/store/evaluation.ts`: по одному `Evaluator` на открытую вкладку; изменение структуры → `setGraph`, изменение значения → `setValue`; планирование `flush()` через `requestAnimationFrame` (не больше одного за кадр); ноды из `pending()` получают статус `computing`; результат записывается в `nodeStates`; T027, T028 зелёные
- [X] T033 [P] [US1] Создать `src/ui/canvas/ValueView.tsx`: компактное отображение JsonValue (обрезка длинного текста, «[50 элементов]», «{3 поля}») с раскрытием полного значения в поповере (FR-007a)
- [X] T034 [P] [US1] Создать `src/ui/canvas/ValueEditor.tsx`: редактор значения по типу порта — число (`<input type=number>`, отклоняет NaN), текст, переключатель для логического, textarea с JSON для `array`/`object`/`any` (некорректный JSON не применяется, под полем подсказка с текстом ошибки разбора)
- [X] T035 [P] [US1] Создать `src/ui/canvas/PortHandle.tsx`: `Handle` из @xyflow/react с `id` = имя порта, подписью «имя: тип», цветом по типу и `ValueView` текущего значения
- [X] T036 [US1] Создать `src/ui/canvas/FlowNode.tsx`: кастомный нод React Flow (`React.memo`, селектор Zustand только на `nodeStates[tab][nodeId]` и сам нод), порты через `PortHandle`, `ValueEditor` для неподключённых входов; T029 зелёный
- [X] T037 [US1] Создать `src/ui/canvas/Canvas.tsx`: `ReactFlow` в управляемом режиме (nodes/edges выводятся из графа активной вкладки), `nodeTypes = { flow: FlowNode }`, `onNodesChange`/`onEdgesChange`/`onConnect` → действия стора, приём перетаскивания из палитры (drop → `addNode` в координатах холста)
- [X] T038 [P] [US1] Создать `src/ui/palette/Palette.tsx`: список типов из `registry.list()` по категориям, у каждого — название и описание назначения, входов и выходов (FR-001); перетаскивание на холст и добавление по двойному клику
- [X] T039 [US1] Собрать `src/ui/App.tsx`: палитра слева, холст справа, работа с единственным workflow активной вкладки; T030 зелёный

**Checkpoint**: MVP — граф собирается и считается в реальном времени

---

## Phase 4: User Story 2 — Защита от некорректных графов и понятные ошибки (Priority: P2)

**Goal**: недопустимые связи отклоняются сразу с объяснением, а проблемные ноды показывают, что не так, и восстанавливаются сами

**Independent Test**: связь C → A в цепочке A → B → C отклонена с сообщением о цикле; деление на ноль показывает ошибку на нужном ноде, и она исчезает после исправления делителя

### Тесты US2 (писать первыми)

- [X] T040 [P] [US2] Написать `tests/component/connection-feedback.test.tsx`: попытка создать цикл и попытка соединить text → number не создают связь и показывают уведомление с текстом из `Rejection.message` (acceptance US2 #1, #2; SC-004)
- [X] T041 [P] [US2] Написать `tests/component/node-status.test.tsx`: нод с пустым обязательным входом показывает «ожидает входов» и подсвечивает этот вход (#3); `error` показывает текст ошибки без трассировки (#6); потомки показывают «не вычислен: проблема выше по графу» (#4), в том числе когда нод выше по графу в состоянии «ожидает входов»; после исправления значения статусы возвращаются к «вычислен» (#5)
- [X] T042 [P] [US2] Написать `tests/e2e/us2-validation-errors.spec.ts`: сценарии Independent Test (цикл; деление на ноль → исправление → ошибка исчезла; независимая ветка продолжает работать)

### Реализация US2

- [X] T043 [P] [US2] Создать `src/ui/layout/Notifications.tsx` и срез `notifications` в `src/store/store.ts`: короткие уведомления (info/warning/error) с автоскрытием через 5 с; используются для отказов, импорта и изменений портов
- [X] T044 [US2] В `src/ui/canvas/Canvas.tsx` подключить `isValidConnection` → `canConnect` (подсветка недопустимого порта при перетаскивании связи) и при отпускании на недопустимый порт показывать уведомление с `Rejection.message`; T040 зелёный
- [X] T045 [P] [US2] Создать `src/ui/canvas/NodeStatus.tsx`: бейдж и рамка нода по статусу (цвет + иконка + текст из `messages.ts`), текст `NodeState.message` под заголовком для `waiting`/`error`/`blocked`
- [X] T046 [US2] Встроить `NodeStatus` в `src/ui/canvas/FlowNode.tsx` и подсветку незаполненного обязательного входа в `src/ui/canvas/PortHandle.tsx`; T041 зелёный
- [X] T047 [P] [US2] Создать `src/ui/ErrorBoundary.tsx` и обернуть им холст в `src/ui/App.tsx`: непредвиденная ошибка отрисовки показывает понятное сообщение и кнопку «Перезагрузить вкладку», данные не теряются (принцип IV); T042 зелёный

**Checkpoint**: US1 и US2 работают; некорректные действия объясняются

---

## Phase 5: User Story 3 — Несколько workflow, рабочая папка и перенос (Priority: P3)

**Goal**: список workflow, вкладки, автосохранение в рабочую папку или хранилище браузера, выгрузка и загрузка файлов

**Independent Test**: выбрать папку, создать два workflow, открыть оба во вкладках, перезагрузить — всё на месте и вычислено, в папке лежат файлы; выгрузка → загрузка даёт идентичный граф

### Тесты US3 (писать первыми)

- [X] T048 [P] [US3] Написать `tests/unit/model/serialize.test.ts`: workflow → JSON → workflow даёт глубоко равный объект (SC-005); формат соответствует примерам [contracts/file-formats.md](./contracts/file-formats.md) (`format`, `version: 1`, отступ 2 пробела); `workspace.json` сериализуется и читается
- [X] T049 [P] [US3] Написать `tests/unit/model/import.test.ts` по алгоритму импорта: некорректный JSON → «Файл не является корректным JSON»; ошибка схемы → сообщение с путём к полю; `version: 2` → «Файл создан более новой версией редактора»; чужой `format` → «Неизвестный формат файла»; неизвестные типы нодов перечислены в сообщении; цикл в графе файла отклоняется; при любой ошибке входное состояние не изменено (FR-030); успешный импорт выдаёт workflow с **новым** id
- [X] T050 [P] [US3] Создать фейк `tests/unit/storage/fake-directory.ts` (in-memory `FileSystemDirectoryHandle`: `getDirectoryHandle`, `getFileHandle`, `removeEntry`, `values()`, `createWritable`) и написать `tests/unit/storage/directory-storage.test.ts`: раскладка `workspace.json`, `workflows/<id>.workflow.json`, `composites/<id>.composite.json`; запись, чтение, удаление; посторонние файлы игнорируются; повреждённый файл workflow даёт запись «недоступен» с причиной, остальные читаются
- [X] T051 [P] [US3] Написать `tests/unit/storage/autosave.test.ts`: запись через 300 мс после последнего изменения (серия изменений → одна запись); `pagehide`/`visibilitychange` сбрасывают отложенную запись немедленно; ошибка записи не теряет изменения и повторяется при следующем изменении
- [X] T052 [P] [US3] Написать `tests/unit/storage/location.test.ts` (моки `showDirectoryPicker`, `navigator.storage.getDirectory`, idb-keyval): API нет → `{kind: 'browser'}` (FR-028b); сохранённый дескриптор с `queryPermission` = `granted` → `folder`; `prompt` → `folder-pending`, при этом ни одного чтения и записи данных до `restoreAccess()` (FR-028d); явный выбор «Работать в браузере» из `folder-pending` → `browser`, файлы папки не тронуты; отказ в диалоге выбора → `browser`; папка стала недоступна во время работы → переход в `browser` с уведомлением без потери данных (edge case)
- [X] T053 [P] [US3] Написать `tests/unit/storage/switch-storage.test.ts` (на `fake-directory.ts`): выбор пустой папки → по подтверждению все файлы текущего хранилища скопированы; выбор папки с данными редактора → загружены данные папки, предложены к добавлению только workflow, которых нет в папке (по id), они добавлены в конец `workflowOrder`; workflow с тем же id, но другим содержимым предложен копией «&lt;имя&gt; (из браузера)» с новым id; составные ноды слиты по FR-029a; ни один существующий файл папки не перезаписан (FR-028c, edge cases)
- [X] T054 [P] [US3] Написать `tests/component/workflows-tabs.test.tsx`: создать, переименовать, дублировать workflow (FR-031); открытие двух workflow → две вкладки, переключение сохраняет граф каждой (acceptance US3 #4); повторное открытие открытого workflow переключает на его вкладку (FR-031a); закрытие вкладки не удаляет workflow; удаление требует подтверждения и закрывает вкладку (#8)
- [X] T055 [P] [US3] Написать `tests/e2e/us3-storage-tabs.spec.ts`: `page.addInitScript` подменяет `showDirectoryPicker` на подпапку OPFS; выбрать папку → создать два workflow → перезагрузить → оба на месте и вычислены, файлы в папке есть (#1, #3); выгрузка → загрузка даёт идентичный граф (#6); загрузка `.txt` показывает ошибку, список не изменился (#7); сценарий без поддержки папок (API удалён через `addInitScript`) показывает индикатор «Данные хранятся в браузере» (#2); при `queryPermission` = `prompt` (подмена в `addInitScript`) показывается экран восстановления доступа, после нажатия данные загружены (#3)

### Реализация US3

- [X] T056 [P] [US3] Реализовать `src/model/schemas.ts`: Valibot-схемы `workspace`, `workflow`, `composite`, `export` по [contracts/file-formats.md](./contracts/file-formats.md) с ограничениями data-model: имя workflow «1–100 символов», имя составного нода «1–100 символов», имя порта «1–40 символов», `type` из перечисления `PortType`, `version` — целое ≥ 1
- [X] T057 [US3] Реализовать `src/model/serialize.ts`: `workflowToFile`, `fileToWorkflow`, `compositeToFile`, `fileToComposite`, `workspaceToFile`, `fileToWorkspace`, `buildExport(workflow, composites)` (пока все переданные определения; сбор транзитивных — T084); T048 зелёный
- [X] T058 [US3] Реализовать `src/model/import.ts`, шаги 1–4 и 6 алгоритма импорта (шаг 5 — слияние составных нодов — T084): возвращает `{ok: true, workflow, composites}` или `{ok: false, message}` и никогда не мутирует входное состояние; T049 зелёный
- [X] T059 [P] [US3] Реализовать `src/storage/directory-storage.ts`: класс `DirectoryStorage(handle)` — `loadAll()`, `saveWorkflow`, `deleteWorkflow`, `saveComposite`, `deleteComposite`, `saveWorkspace`, `hasData()`, `copyTo(other)` (только в пустое хранилище); запись через `createWritable()`; T050 зелёный
- [X] T060 [P] [US3] Реализовать `src/storage/location.ts`: `detectLocation()`, `pickFolder()`, `restoreAccess()` (вызов из обработчика клика; до него в состоянии `folder-pending` данные не читаются и не пишутся), `useBrowserStorage()` (явное переключение, в том числе из `folder-pending`) (OPFS `navigator.storage.getDirectory()`), хранение дескриптора в IndexedDB через idb-keyval (ключ `dagflow:folder`); T052 зелёный
- [X] T061 [US3] Реализовать `src/storage/autosave.ts`: подписка на изменения workspace, debounce 300 мс, запись только изменённых файлов, сброс на `pagehide`/`visibilitychange`; T051 зелёный
- [X] T062 [US3] Расширить `src/store/store.ts` и `src/store/actions.ts`: `createWorkflow`, `renameWorkflow`, `duplicateWorkflow`, `deleteWorkflow`, `openTab`, `closeTab`, `switchTab`, `setViewport`; состояние `storageLocation`
- [X] T063 [US3] Создать `src/store/persistence.ts`: загрузка workspace из хранилища при старте (повреждённые workflow помечаются недоступными; в `folder-pending` загрузка откладывается до восстановления доступа), подключение autosave; `switchStorage(target)` — пустая папка: копирование по подтверждению; папка с данными: загрузка данных папки + предложение добавить отсутствующие workflow в конец списка и отличающиеся (тот же id, другое содержимое) — копией «&lt;имя&gt; (из браузера)» + слияние составных нодов через функцию слияния из `src/model/import.ts` (до US4 — workflow без составных нодов), без перезаписи файлов папки (FR-028c); T053 зелёный
- [X] T064 [P] [US3] Создать `src/ui/layout/WorkflowList.tsx`: список workflow в порядке `workflowOrder` с действиями «Создать», «Открыть», «Переименовать», «Дублировать», «Удалить»; недоступные workflow показаны с причиной
- [X] T065 [P] [US3] Создать `src/ui/layout/TabBar.tsx`: вкладки открытых workflow, переключение, закрытие
- [X] T066 [P] [US3] Создать `src/ui/layout/StorageIndicator.tsx`, `src/ui/layout/AccessScreen.tsx` и `src/ui/layout/FolderBanner.tsx`: индикатор текущего хранилища («Папка: &lt;имя&gt;» / «Данные хранятся в браузере»); `AccessScreen` — полноэкранный экран для `folder-pending` с кнопкой «Восстановить доступ» и ссылкой «Работать в браузере» с пояснением «В браузере хранится отдельный набор данных; данные папки останутся нетронутыми» (FR-028d); `FolderBanner` — предложение выбрать папку при первом запуске, предложение перенести данные или добавить workflow при смене папки, напоминание о выгрузке в файл в режиме браузера
- [X] T067 [P] [US3] Создать `src/ui/dialogs/ConfirmDialog.tsx` (подтверждение удаления и замены) и `src/ui/dialogs/ImportErrorDialog.tsx`
- [X] T068 [US3] Создать `src/ui/layout/ExportImport.tsx`: «Выгрузить в файл» (Blob + скачивание `<имя>.dagflow.json`) и «Загрузить из файла» (`<input type="file" accept=".json">` → `import.ts` → новый workflow в новой вкладке или диалог ошибки)
- [X] T069 [US3] Интегрировать в `src/ui/App.tsx`: боковая панель со списком workflow и индикатором хранилища, панель вкладок, холст активной вкладки, отдельный Evaluator на каждую вкладку; T054, T055 зелёные

**Checkpoint**: US1–US3 работают; работа сохраняется и переносится

---

## Phase 6: User Story 4 — Составные ноды (Priority: P4)

**Goal**: свернуть группу нодов в переиспользуемый составной нод, редактировать его интерфейс через ноды «Вход»/«Выход», использовать в любых workflow

**Independent Test**: «(a + b) × 2» свёрнут в «Удвоенная сумма», два экземпляра считают верно, изменение внутренностей пересчитывает оба

### Тесты US4 (писать первыми)

- [X] T070 [P] [US4] Написать `tests/unit/engine/composite.test.ts`: `compositePorts` — один нод «Вход» с портами a, b даёт два входа; порядок «порядок нодов "Вход"/"Выход" в `graph.nodes`, затем порядок `ports` внутри нода» (FR-021b); дубль имени порта среди всех нодов «Вход» — `duplicate-port-name` (FR-021c); `collapse` создаёт «Вход»/«Выход» для внешних связей и сохраняет внешние связи на портах экземпляра (FR-021); `expand` восстанавливает ноды и связи (FR-025); прямое и косвенное включение в себя — `composite-recursion` (FR-026); `compositeDependencies` возвращает транзитивные зависимости
- [X] T071 [P] [US4] Написать `tests/unit/engine/evaluator-composite.test.ts`: E8 — выходы экземпляра равны выходам развёрнутой группы; вложенный составной нод вычисляется; изменение определения (`setGraph` с новыми composites) пересчитывает все экземпляры; `stateAt('instance/inner')` возвращает состояние внутреннего нода; E9 — сводный статус экземпляра по приоритету error > waiting > blocked > computing > ok (первопричина важнее следствий): ошибка внутри → `error`, ошибка снаружи на входе экземпляра → `blocked`, незаполненный вход экземпляра → `waiting`
- [X] T072 [P] [US4] Написать `tests/unit/model/import-merge.test.ts` по FR-029a: определение с тем же каноническим содержимым переиспользуется; то же имя, другое содержимое → копия «&lt;имя&gt; (2)» с новым id, при занятом «(2)» — «(3)»; ссылки `composite:<id>` в workflow и во вложенных определениях переписаны; существующие определения никогда не изменяются; уведомление на каждый конфликт; `buildExport` включает транзитивно используемые определения (FR-029)
- [X] T073 [P] [US4] Написать `tests/component/composite-actions.test.tsx`: свернуть выделение → экземпляр на месте группы, значения не изменились (FR-022); составной нод появился в палитре (#2); открытие составного нода — вкладка вида `composite`; правка внутри применяется к экземплярам во всех вкладках (FR-031b); добавление нода «Вход» с портами c, d добавляет входы всем экземплярам, удаление — убирает (#5); связи экземпляров с удалёнными портами удаляются с уведомлением (edge case); удаление используемого составного нода показывает число экземпляров и требует подтверждения (FR-027); сворачивание и переименование с занятым именем отклоняются с подсказкой (FR-023a); ноды «Вход»/«Выход» недоступны в палитре вне составного нода
- [X] T074 [P] [US4] Написать `tests/e2e/us4-composite.spec.ts`: сценарии 1–5 из quickstart US4 (свернуть, второй экземпляр, правка ×2 → ×3, отказ рекурсии, выгрузка → удаление → загрузка восстанавливает нод)

### Реализация US4

- [X] T075 [P] [US4] Реализовать `src/engine/builtins/io.ts`: `builtin:input` и `builtin:output` — сквозные ноды с портами из `NodeInstance.ports`; зарегистрировать в `src/engine/builtins/index.ts` с пометкой «только внутри составного нода»
- [X] T076 [US4] Реализовать `src/engine/composite.ts`: `compositePorts`, `compositeDependencies`, `collapse`, `expand`, проверка уникальности имён портов и рекурсии; функция `flatten(graph, composites)` — разворачивание экземпляров в плоский граф с id `instanceId/innerNodeId` (research R3); T070 зелёный
- [X] T077 [US4] Расширить `src/engine/registry.ts`: составные ноды как `NodeTypeDef` с id `composite:<id>` и портами из `compositePorts`; `canAddNode` в `src/engine/validate.ts` проверяет рекурсию и запрет «Вход»/«Выход» вне составного нода
- [X] T078 [US4] Расширить `src/engine/evaluator.ts`: `setGraph` строит плоский граф через `flatten` (только при изменении структуры), `state(instanceId)` агрегирует статусы внутренних нодов по приоритету: есть `error` → `error`, иначе есть `waiting` → `waiting`, иначе есть `blocked` → `blocked`, иначе есть `computing` → `computing`, иначе `ok` (E9), `stateAt(path)`; T071 зелёный
- [X] T079 [US4] Расширить `src/store/actions.ts`: `collapseSelection(name)` и `renameComposite` с проверкой уникальности имени в палитре (FR-023a: «1–100 символов», занятое имя → отказ с подсказкой), `expandInstance`, `openComposite` (вкладка `kind: 'composite'`), `deleteComposite` (с подсчётом экземпляров во всех workflow), `editIoPorts`; при изменении портов определения — удаление связей экземпляров с исчезнувшими портами и уведомление
- [X] T080 [US4] Обновить `src/store/evaluation.ts`: изменение определения составного нода вызывает `setGraph` во всех вкладках, где он используется (прямо или вложенно)
- [X] T081 [P] [US4] Обновить `src/ui/palette/Palette.tsx`: раздел «Мои составные ноды» с действиями «Переименовать» и «Удалить»; во вкладке составного нода — раздел «Интерфейс» с нодами «Вход» и «Выход»
- [X] T082 [P] [US4] Создать `src/ui/canvas/IoPortsEditor.tsx`: редактор портов нода «Вход»/«Выход» (добавить, удалить, переименовать, выбрать тип) с отказом при дубле имени
- [X] T083 [US4] Создать `src/ui/dialogs/CompositeNameDialog.tsx` (с подсказкой о занятом имени) и обновить `src/ui/canvas/Canvas.tsx` и `src/ui/canvas/FlowNode.tsx`: команда «Свернуть в составной нод» для выделения, действия «Открыть» и «Развернуть» на экземпляре, заголовок вкладки составного нода «Составной нод: &lt;имя&gt;»; T073 зелёный
- [X] T084 [US4] Дополнить `src/model/import.ts` шагом 5 (слияние определений по FR-029a, канонический JSON с отсортированными ключами полей `name`, `description`, `graph`) и `src/model/serialize.ts` — `buildExport` собирает транзитивно используемые определения через `compositeDependencies`; T072, T074 зелёные

**Checkpoint**: US1–US4 работают; логику можно собирать из переиспользуемых блоков

---

## Phase 7: User Story 5 — Удобное редактирование больших графов (Priority: P5)

**Goal**: навигация по холсту, групповые операции, отмена и повтор

**Independent Test**: граф из 20+ нодов: удалить группу, отменить — ноды, связи и значения вернулись

### Тесты US5 (писать первыми)

- [ ] T085 [P] [US5] Написать `tests/component/history.test.ts`: каждое действие редактирования — шаг истории; undo/redo восстанавливают граф и (после `flushFrames()`) вычисленные значения (acceptance US5 #3); правки одного поля значения с интервалом меньше 500 мс объединяются в один шаг; история «≤ 100» шагов (101-й вытесняет первый); история отдельная для каждой вкладки (FR-009, FR-031a); новое действие после undo очищает redo; отмена сворачивания возвращает группу нодов, а определение остаётся в палитре; переименование и удаление составного нода в историю не попадают (FR-009)
- [ ] T086 [P] [US5] Написать `tests/e2e/us5-editing.spec.ts`: граф из 20+ нодов, выделение рамкой, Delete удаляет ноды со связями (#2), Ctrl+Z возвращает, Ctrl+Shift+Z повторяет (#3), прокрутка и масштаб холста (#1)

### Реализация US5

- [ ] T087 [US5] Реализовать `src/store/history.ts`: стек снапшотов `Graph` на вкладку (максимум 100; только граф вкладки, не палитра; не сохраняется между сессиями), `push`, `undo`, `redo`, объединение правок значения одного входа одного нода в пределах 500 мс
- [ ] T088 [US5] Подключить историю ко всем действиям редактирования в `src/store/actions.ts` (включая действия составных нодов во вкладке составного нода); undo/redo вызывают `setGraph` у Evaluator; T085 зелёный
- [ ] T089 [P] [US5] Создать `src/ui/canvas/useShortcuts.ts`: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Delete/Backspace (кроме фокуса в поле ввода)
- [ ] T090 [US5] Обновить `src/ui/canvas/Canvas.tsx`: выделение рамкой и Shift+клик, групповое удаление, панорамирование и масштаб, `Controls` и `MiniMap` из @xyflow/react (мини-карта с переходом по клику — FR-008), кнопки «Отменить»/«Повторить» в панели; T086 зелёный

**Checkpoint**: все пять историй работают

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: критерии успеха, риски и проверка по quickstart

- [ ] T091 [P] Написать `tests/unit/engine/evaluator.perf.test.ts`: цепочка и «широкий» граф по 100 нодов — `setValue` + `flush` укладываются в 20 мс без UI (запас для SC-003)
- [ ] T092 [P] Написать `tests/e2e/perf.spec.ts` (замеры внутри страницы через `performance.mark`/`measure`, отдельный Playwright-проект `perf`, не входит в основной прогон): граф из 100 нодов — добавление и перемещение нода отражаются меньше чем за 100 мс (SC-002), изменение входа доходит до последнего нода меньше чем за 200 мс (SC-003)
- [ ] T093 [P] Написать `tests/e2e/autosave-durability.spec.ts`: изменение → ожидание 1 с → перезагрузка → изменение на месте, и в режиме папки, и в режиме браузера (SC-008)
- [ ] T094 Проверить `createWritable()` для OPFS в актуальном Safari (риск R7); при отсутствии поддержки добавить запасной путь записи через Web Worker и `createSyncAccessHandle()` в `src/storage/opfs-write-worker.ts` и использовать его в `src/storage/directory-storage.ts`
- [ ] T095 [P] Профилировать перерисовки на графе из 100 нодов (React DevTools Profiler): изменение одного значения перерисовывает только затронутые `FlowNode`; при необходимости уточнить селекторы в `src/ui/canvas/FlowNode.tsx`
- [ ] T096 [P] Создать `README.md`: что это за проект, команды из [quickstart.md](./quickstart.md), ссылки на спеку и план
- [ ] T097 Прогнать `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` — всё зелёное; пройти вручную сценарии [quickstart.md](./quickstart.md) в Chromium и Firefox

---

## Покрытие acceptance-сценариев тестами (принцип II)

| Сценарий | Тест |
|---|---|
| US1 #1 | T029 |
| US1 #2 | T028 |
| US1 #3 | T030, T010 (E2) |
| US1 #4 | T028, T010 (E2) |
| US1 #5 | T028, T010 (E1) |
| US2 #1, #2 | T009, T040, T042 |
| US2 #3 | T010 (E4), T041 |
| US2 #4 | T010 (E5), T041, T042 |
| US2 #5 | T010 (E6), T041, T042 |
| US2 #6 | T010, T041 |
| US3 #1, #3 | T055, T052, T053 |
| US3 #2 | T052, T055 |
| US3 #4 | T054 |
| US3 #5 | T073 |
| US3 #6 | T048, T055 |
| US3 #7 | T049, T055 |
| US3 #8 | T054 |
| US4 #1 | T070, T071, T073, T074 |
| US4 #2 | T073, T074 |
| US4 #3 | T071, T073, T074 |
| US4 #4 | T070 |
| US4 #5 | T070, T073 |
| US4 #6 | T070, T074 |
| US4 #7 | T072, T074 |
| US5 #1, #2 | T086 |
| US5 #3 | T085, T086 |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей
- **Foundational (Phase 2)**: после Setup; **блокирует все истории**
- **US1 (Phase 3)**: после Foundational
- **US2 (Phase 4)**: после US1 (дорабатывает Canvas, FlowNode, PortHandle)
- **US3 (Phase 5)**: после US1; от US2 не зависит (кроме общего `Notifications` из T043 — при реализации US3 раньше US2 сначала выполнить T043)
- **US4 (Phase 6)**: после US1 и US3 (палитра, вкладки, импорт/экспорт)
- **US5 (Phase 7)**: после US1; с US4 пересекается только в T088 (история для действий составных нодов) — если US4 ещё нет, эта часть T088 выполняется позже
- **Polish (Phase 8)**: после всех нужных историй

### Внутри каждой фазы

- тесты пишутся первыми и падают
- engine → model/storage → store → ui
- задача, помеченная «TNNN зелёный», завершена только когда указанный тест проходит

### User Story Dependencies

```text
Setup → Foundational → US1 ─┬─▶ US2
                            ├─▶ US3 ──▶ US4
                            └─▶ US5
```

### Parallel Opportunities

- Setup: T002–T007 параллельно после T001
- Foundational: тесты T008–T011 параллельно; T012, T013 параллельно; встроенные ноды T015–T020 параллельно после T014
- US1: тесты T027–T030 параллельно; T033–T035 и T038 параллельно
- US3: тесты T048–T055 параллельно; T056, T059, T060 параллельно; UI T064–T067 параллельно
- US4: тесты T070–T074 параллельно; T075, T081, T082 параллельно
- После US1 истории US2, US3 и US5 можно вести параллельно разными исполнителями

---

## Parallel Example: Foundational

```bash
# Тесты движка одновременно:
Task: "Написать tests/unit/engine/values.test.ts"
Task: "Написать tests/unit/engine/validate.test.ts"
Task: "Написать tests/unit/engine/evaluator.test.ts"
Task: "Написать tests/unit/engine/builtins.test.ts"

# Встроенные ноды одновременно (после values.ts):
Task: "Реализовать src/engine/builtins/math.ts"
Task: "Реализовать src/engine/builtins/text.ts"
Task: "Реализовать src/engine/builtins/logic.ts"
Task: "Реализовать src/engine/builtins/collections.ts"
```

## Parallel Example: User Story 1

```bash
Task: "Написать tests/component/store-actions.test.ts"
Task: "Написать tests/component/evaluation.test.ts"
Task: "Написать tests/component/FlowNode.test.tsx"
Task: "Написать tests/e2e/us1-reactive-graph.spec.ts"

Task: "Создать src/ui/canvas/ValueView.tsx"
Task: "Создать src/ui/canvas/ValueEditor.tsx"
Task: "Создать src/ui/canvas/PortHandle.tsx"
Task: "Создать src/ui/palette/Palette.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational — движок с полным набором тестов
3. Phase 3: US1
4. **STOP and VALIDATE**: сценарий US1 из quickstart
5. Демонстрация MVP

### Incremental Delivery

1. Setup + Foundational → движок готов и протестирован
2. US1 → граф в реальном времени (MVP)
3. US2 → защита и понятные ошибки
4. US3 → сохранение, вкладки, перенос
5. US4 → составные ноды
6. US5 → удобство
7. Polish → критерии успеха и риски

Каждый шаг — отдельный коммит или группа коммитов; после каждой фазы все тесты
зелёные.

---

## Notes

- [P] — разные файлы, нет зависимостей от незавершённых задач
- [USn] связывает задачу с user story для трассируемости
- Тесты должны падать до реализации
- Коммит после каждой задачи или логической группы
- На любом checkpoint можно остановиться и проверить историю независимо
- Тексты для пользователя — только из `src/ui/messages.ts` и `src/engine/errors.ts`
