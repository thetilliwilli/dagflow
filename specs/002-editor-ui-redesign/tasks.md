---

description: "Task list for 002-editor-ui-redesign"
---

# Tasks: Новый облик редактора графов

**Input**: Design documents from `/specs/002-editor-ui-redesign/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: включены. Принцип II конституции требует тестов для всей бизнес-логики
и хотя бы одного теста на каждый acceptance-сценарий. Тесты каждой фазы пишутся
**до** реализации и должны сначала падать.

**Organization**: задачи сгруппированы по user stories. Фазы идут в **порядке
реализации из plan.md** (US1 → US3 → US4 → US2 → US5), а не по приоритету:
карточка US2 убирает порты, через которые работают e2e-тесты фичи 001, поэтому
она меняется только после того, как тесты переведены на окно свойств и новое
связывание (US3, US4). Так после каждой фазы все тесты зелёные.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: к какой user story относится задача (US1…US5)
- Пути — относительно корня репозитория (single project, см. plan.md)
- Тексты для пользователя — только в `src/ui/messages.ts` и `src/engine/errors.ts`, на русском

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: зафиксировать исходное состояние; новых зависимостей нет (research R1)

- [X] T001 Убедиться, что на ветке `002-editor-ui-redesign` зелёные `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`; создать каталоги `tests/unit/ui/` и `tests/unit/store/` и проверить, что проект `unit` в `vite.config.ts` (`tests/unit/**/*.test.ts`) их подхватывает без изменения конфига

**Checkpoint**: исходное состояние зелёное, есть куда класть новые unit-тесты

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: обязательное имя нода, стор интерфейса и плавающее окно — на них
стоят все истории

**⚠️ CRITICAL**: работа над user stories не начинается до завершения этой фазы

### Тесты фундамента (писать первыми, должны падать)

- [X] T002 [P] Написать `tests/unit/engine/naming.test.ts` по [contracts/engine-api.md](./contracts/engine-api.md): E13 — `normalizeNodeName` обрезает пробелы; `""` и `"   "` → отказ `empty-name` с текстом «Имя нода не может быть пустым. Введите хотя бы один символ.»; 101 символ → `name-too-long` с текстом «Имя нода длиннее 100 символов. Сократите его.»; ровно 100 символов и имя, совпадающее с названием типа, — `{ ok: true }`; E14 — `collapse` ставит экземпляру `name` = имя составного нода, автоматически созданным нодам «Вход»/«Выход» — названия их типов, `expand` сохраняет `name` внутренних нодов; E15 — сообщение `blocked` у потомка называет нод выше по графу по его `name` (переименованный «Число» → «Нод «Итого» выше по графу ожидает входов»)
- [X] T003 [P] Дополнить `tests/unit/model/serialize.test.ts` и `tests/unit/model/import.test.ts` по [contracts/file-formats.md](./contracts/file-formats.md): нод сериализуется с ключами в порядке `id`, `type`, `name`, `position`, `values`, `ports`; файл, где у нода нет `name`, с пустым `name` или длиннее 100 символов, отклоняется ошибкой схемы с путём к полю (`graph.nodes[0].name`), список workflow не меняется; выгрузка → загрузка сохраняет имена (SC-007); дополнить `tests/unit/storage/directory-storage.test.ts`: workflow-файл в папке с нодом без `name` помечается недоступным с понятной причиной, остальные workflow загружаются
- [X] T004 [P] Написать `tests/unit/store/ui-logic.test.ts` (окна и выделение) по [data-model.md](./data-model.md) (UiState): `openWindow`/`closeWindow`/`toggleWindow` для `'sidebar' | 'palette' | 'properties' | 'edges'`; открытие и `focusWindow` поднимают окно в конец `windowOrder`; `position` по умолчанию `null`, `setWindowPosition` запоминает положение; `setSelection`; селектор `propertiesNodeId` возвращает id только при `selection.length === 1`; `escape()` закрывает верхнее открытое окно, а для `'properties'` — очищает `selection`; `resetForTab()` очищает `selection`, `edgeWindow`, `linking`; `pruneMissing(nodeIds)` убирает удалённые ноды из `selection` и закрывает окно связей, если его пары больше нет
- [X] T005 [P] Написать `tests/unit/ui/floating-geometry.test.ts`: `clampToViewport(rect, viewport)` возвращает окно внутрь при выходе за правый, нижний, левый и верхний край; окно больше вьюпорта прижимается к левому верхнему углу; `defaultPosition(windowId, viewport)` — левая панель у левого края под кнопкой меню, палитра по центру, окно свойств у правого края под полосой вкладок
- [X] T006 [P] Написать `tests/component/floating-window.test.tsx`: `FloatingWindow` рендерит `section.floating[role="dialog"][aria-modal="false"][aria-label]`, кнопка `aria-label="Закрыть"` вызывает `onClose`; перетаскивание `.floating__header` указателем меняет положение с ограничением по `clampToViewport`; `pointerdown` по окну поднимает его в `windowOrder`; слой `FloatingLayer` имеет `pointer-events: none`, окно — `auto`

### Реализация фундамента

- [X] T007 Изменить `src/engine/types.ts` по [contracts/engine-api.md](./contracts/engine-api.md): `NodeInstance.name: string` — «обязательное (FR-009); при создании = def.title»; добавить `PortSide = 'in' | 'out'`, `LinkEnd { node; port; side }`, `LinkCandidate = { ok: true; replaces?: Edge } | Rejection`
- [X] T008 [P] Добавить в `src/engine/errors.ts` коды `same-side`, `empty-name`, `name-too-long` в `RejectCode` и конструкторы `rejections.sameSide(side)`, `rejections.emptyName()`, `rejections.nameTooLong()` с текстами из [contracts/engine-api.md](./contracts/engine-api.md#отказы-errorsts)
- [X] T009 Реализовать `normalizeNodeName(name)` в `src/engine/validate.ts` («после `trim` 1–100 символов»; совпадение с названием типа допустимо) и экспортировать из `src/engine/index.ts`
- [X] T010 В `src/engine/composite.ts` задавать `name` всем создаваемым нодам: экземпляру при `collapse` — имя составного нода; автоматически созданным нодам «Вход»/«Выход» — названия их типов; `expand` копирует `name` как есть. В `src/engine/evaluator.ts` сообщения о нодах выше по графу строить по `node.name` (E15); T002 зелёный
- [X] T011 В `src/store/actions.ts` `addNode` ставит `name = def.title` (включая ноды «Вход»/«Выход» внутри составного); дублирование workflow и вставка из составного нода копируют `name`
- [X] T012 В `src/model/schemas.ts` добавить в схему нода обязательное `name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100))`; в `src/model/serialize.ts` обеспечить порядок ключей нода `id`, `type`, `name`, `position`, `values`, `ports`; T003 зелёный
- [X] T013 Добавить `name` во все литералы нодов в тестах: `tests/unit/engine/helpers.ts`, `tests/unit/engine/composite-fixtures.ts`, `tests/unit/engine/evaluator.perf.test.ts`, `tests/unit/model/fixtures.ts`, `tests/component/helpers.ts`, `tests/component/store-actions.test.ts`, `tests/component/convergence.test.tsx`, `tests/e2e/perf.spec.ts`; `npm run typecheck` и `npm test` зелёные
- [X] T014 Создать `src/store/ui-logic.ts` (чистые редьюсеры окон, выделения, `escape`, `resetForTab`, `pruneMissing`; `linking` пока только `{ kind: 'idle' }`) и `src/store/ui.ts` (Zustand vanilla `createUiStore()`, хуки `useUi(selector)` и `useUiActions()`, провайдер `UiProvider`); подключить провайдер в `src/ui/App.tsx`; подписка на основной стор: смена `activeTabId` → `resetForTab`, изменение графа вкладки → `pruneMissing`; T004 зелёный
- [X] T015 [P] Создать `src/ui/floating/geometry.ts` (`clampToViewport`, `defaultPosition`); T005 зелёный
- [X] T016 Создать `src/ui/floating/FloatingWindow.tsx` и `src/ui/floating/FloatingLayer.tsx` по [contracts/ui-contract.md](./contracts/ui-contract.md#плавающие-окна-fr-002-fr-003): заголовок, «Закрыть», перетаскивание за заголовок, z-порядок из `windowOrder`, повторное ограничение при `resize` окна браузера; стили `.floating`, `.floating__header`, слоя — в `src/ui/styles.css`; T006 зелёный

**Checkpoint**: имя нода обязательно в модели, файлах и тестах; стор интерфейса и
окно готовы; интерфейс ещё прежний, все тесты (включая e2e фичи 001) зелёные

---

## Phase 3: User Story 1 — Холст во весь экран и плавающие окна (Priority: P1) 🎯 MVP

**Goal**: вкладки и холст занимают всё окно; левая панель — по кнопке ☰, палитра —
по Пробелу, обе плавающие и неблокирующие

**Independent Test**: открыть редактор — холст на всё окно; ☰ открывает панель
поверх холста, холст при этом двигается; Пробел открывает палитру с вкладками,
щелчок по ноду добавляет его

### Тесты US1 (писать первыми)

- [X] T017 [P] [US1] Написать `tests/component/palette-tabs.test.tsx`: палитра — плавающее окно «Палитра»; `role="tablist" aria-label="Категории"` с вкладками в порядке `categories` движка и «Мои составные ноды»; «Интерфейс составного нода» — только во вкладке составного нода; переключение вкладки показывает только её ноды (название, описание, строка портов) (US1 #4); одиночный щелчок по `.palette__item` вызывает `addNode` в центре видимой области, палитра остаётся открытой (US1 #5, FR-006); выбранная вкладка запоминается в сторе интерфейса
- [X] T018 [P] [US1] Написать `tests/component/global-keys.test.tsx` для `useGlobalKeys`: Пробел при фокусе на `body` или холсте переключает палитру (US1 #3); в `input`, `textarea`, `select`, `[contenteditable]` — не переключает (US1 #8); при связывании (`linking.kind !== 'idle'`) — не переключает (граничный случай «Пробел во время перетаскивания»; проверка перенесена в T037 — машина связывания появляется в US4, условие уже есть в `useGlobalKeys`); Escape закрывает верхнее окно — последнее открытое или поднятое щелчком (FR-003); Escape в поле ввода окно не закрывает
- [X] T019 [P] [US1] Написать `tests/e2e/ui-us1-layout.spec.ts`: US1 #1 и SC-001 — холст занимает окно за вычетом верхней полосы, бокового столбца нет, кнопка `aria-label="Меню"` в левом верхнем углу; #2 — ☰ открывает окно «Workflow и хранилище» (`aria-expanded="true"`), повторный ☰, «Закрыть» и Escape его закрывают; #6 — при открытой панели холст панорамируется колёсиком и перетаскиванием, нод вне окна выделяется; #3 и #4 — Пробел открывает палитру, вкладка «Арифметика» показывает «Сложить»; #5 — щелчок добавляет нод, перетаскивание «Число» кладёт нод в точку броска, палитра открыта; #7 — палитра, перетащенная за заголовок за край, остаётся в окне; #8 — Пробел в поле переименования workflow в левой панели вводит пробел, палитра не открывается

### Реализация US1

- [X] T020 [US1] Создать `src/ui/floating/useGlobalKeys.ts` (Пробел — палитра по R7, Escape — по приоритету из R6) и подключить в `src/ui/Editor.tsx`; T018 зелёный
- [X] T021 [P] [US1] Создать `src/ui/layout/MenuButton.tsx` (☰, `aria-label="Меню"`, `aria-expanded`) и `src/ui/layout/SidebarWindow.tsx` (окно «Workflow и хранилище» с `StorageIndicator`, `WorkflowList`, `ExportImport`)
- [X] T022 [US1] Переделать `src/ui/Workbench.tsx`: верхняя полоса (`MenuButton` + `TabBar`), холст на остальную высоту, `SidebarWindow` в слое окон, `FolderBanner` и `Notifications` — неблокирующие плашки поверх холста (FR-006a); убрать `aside.sidebar`
- [X] T023 [US1] Переделать `src/ui/Editor.tsx`: внутри `ReactFlowProvider` — `Canvas` и `FloatingLayer`; палитра рендерится как окно только когда открыта
- [X] T024 [US1] Переделать `src/ui/palette/Palette.tsx` по R11: плавающее окно «Палитра» (после ручной проверки US1 — горизонтальная полоса внизу по центру, уточнение пользователя; хелпер e2e `addNode` закрывает палитру после броска), вкладки по категориям, одиночный щелчок вместо двойного добавляет нод в центр, перетаскивание как раньше, действия составных нодов (открыть, переименовать, удалить) — во вкладке «Мои составные ноды»; T017 зелёный
- [X] T025 [US1] В `src/ui/canvas/Canvas.tsx` отключить панорамирование по Пробелу (`panActivationKeyCode={null}`); панель инструментов (отменить, повторить, свернуть) — в левом верхнем углу холста
- [X] T026 [US1] Обновить `src/ui/styles.css`: `.workbench` — верхняя полоса + холст, убрать колонки `.workbench` и `.editor`, стили кнопки меню и вкладок палитры; тексты окон — в `src/ui/messages.ts`
- [X] T027 [US1] Перевести тесты на новую раскладку: в `tests/e2e/helpers.ts` `addNode` открывает палитру Пробелом (если закрыта), находит вкладку с `.palette__item-title` нужного нода и перетаскивает его на холст; новый хелпер `openSidebar(page)`; обновить обращения к списку workflow, хранилищу и «Загрузить из файла» в `tests/e2e/us1-…us5-*.spec.ts`, `autosave-durability.spec.ts`, `opfs-fallback.spec.ts`, `perf.spec.ts` и в `tests/component/convergence.test.tsx`, `phase10.test.tsx`, `workflows-tabs.test.tsx`; T019 и все e2e зелёные

**Checkpoint**: US1 работает; карточки нодов и связывание пока прежние

---

## Phase 4: User Story 3 — Property grid выделенного нода (Priority: P1)

**Goal**: при выделении одного нода у правого края — окно «Свойства» с панелями
«Входы» и «Выходы», ручным вводом, источниками и действиями нода

**Independent Test**: собрать «Число 2» → «Сложить» ← «Число 3», выделить «Сложить» —
`a = 2`, `b = 3`, `result = 5`; изменить 2 на 10 в окне «Число» — у «Сложить» 13

### Тесты US3 (писать первыми)

- [X] T028 [P] [US3] Написать `tests/component/property-grid.test.tsx`: #1 — окно «Свойства» с именем и типом нода, `section[aria-label="Входы"]` и `section[aria-label="Выходы"]`, строки `li.prop-row[data-side][data-port]` в порядке портов из `[маркер] [тип] [имя] [значение]`, тип — `num`/`str`/`bool`/`arr`/`obj`/`any` с полным названием в `title` (FR-013b); маркер `.is-linked`, если у порта есть хотя бы одна связь (вход и выход), иначе без него (FR-013a, SC-009); #2 — значение в окне меняется после пересчёта без повторного выделения; #3 — у неподключённого входа `ValueEditor` с `aria-label=<порт>`, ввод пересчитывает граф; #4 — у подключённого входа `ValueView` и «← &lt;имя нода&gt;.&lt;выход&gt;», поля ввода нет; #5 — «Нет входов» / «Нет выходов»; #7 — при двух выделенных нодах окна нет; #8 — у экземпляра составного нода кнопки «Открыть» и «Развернуть», у нода «Вход»/«Выход» — редактор портов; #9 — у нода в `waiting`/`error` — состояние и понятный текст проблемы
- [X] T029 [P] [US3] Написать `tests/e2e/ui-us3-properties.spec.ts`: #1–#5, #7–#9 сквозным сценарием; #6 — щелчок по пустому холсту и Escape скрывают окно, выделение другого нода показывает его свойства; Clarifications — окно у правого края не двигается при панорамировании и масштабировании холста; передвинутое за заголовок окно остаётся на новом месте при выделении другого нода

### Реализация US3

- [X] T030 [US3] В `src/ui/canvas/Canvas.tsx` передавать выделение в стор интерфейса (реализовано через изменения `select` в `onNodesChange`, а флаг `selected` нодов React Flow берётся из стора — стор интерфейса единственный источник выделения, иначе React Flow перетирал бы выделение, заданное извне); кнопка «Свернуть в составной нод» берёт выделение из стора интерфейса
- [X] T031 [P] [US3] Создать `src/ui/properties/PropertyRow.tsx` по [contracts/ui-contract.md](./contracts/ui-contract.md#окно-свойств-fr-012--fr-017): маркер `button.prop-marker[aria-label="Связать «<имя>»"][aria-pressed]` с `.is-linked`, `span.prop-type[title]`, `span.prop-name`, значение (`ValueEditor` / `ValueView` + источник); пропсы `disabled` и `reason` для US4 пока не используются
- [X] T032 [US3] Создать `src/ui/properties/PropertyGrid.tsx`: `FloatingWindow` «Свойства» с положением по умолчанию у правого края; заголовок (имя, тип), `NodeStatusBadge` и `NodeMessage`, действия составного нода и `IoPortsEditor` для «Вход»/«Выход», панели «Входы»/«Выходы»; «Закрыть» очищает выделение; рендерить из `FloatingLayer` при `propertiesNodeId`; T028 зелёный
- [X] T033 [P] [US3] Добавить в `src/ui/messages.ts` тексты окна свойств («Свойства», «Входы», «Выходы», «Нет входов», «Нет выходов», формат источника) и `typeAbbr: Record<PortType, string>` = num, str, bool, arr, obj, any
- [X] T034 [P] [US3] Стили строк свойств в `src/ui/styles.css`: сетка `[маркер] [тип] [имя] [значение]`, маркер — квадрат с рамкой, заливка `--linked` (зелёная) или серая, тип — приглушённый
- [X] T035 [US3] Добавить в `tests/e2e/helpers.ts` хелпер `setInput(page, node, port, value)`: выделить нод, заполнить поле строки входа в окне «Свойства»; T029 зелёный

**Checkpoint**: окно свойств работает рядом с прежней карточкой; e2e фичи 001 зелёные

### Уточнение FR-006a (после ручной проверки US3)

Плашку хранилища в правом верхнем углу закрывало окно свойств. Решение пользователя:
сообщения о хранилище — вверху левой панели, точка на кнопке меню.

- [X] T077 [US1] Перенести `FolderBanner` вверх `src/ui/layout/SidebarWindow.tsx`, этап подсказки — в стор интерфейса (`storageHint`, `src/store/ui-logic.ts`), выбор сообщения — чистая `storageNotice()` в `src/ui/layout/storage-notice.ts`, точка на `MenuButton` (`data-attention`); тесты: `tests/unit/ui/storage-notice.test.ts`, `tests/unit/store/ui-logic.test.ts`, `tests/component/convergence.test.tsx` (T101), e2e `ui-us1-layout.spec.ts` (FR-006a); e2e `us3-storage-tabs`, `autosave-durability` — кнопки хранилища через `openSidebar`

---

## Phase 5: User Story 4 — Связывание свойств перетаскиванием (Priority: P2)

**Goal**: связи создаются перетаскиванием строки окна свойств на другой нод или
режимом привязки по маркеру; недоступные параметры затенены заранее

**Independent Test**: перетащить `value` «Число 2» на «Сложить» → бросить на `a` —
связь есть; с выходом «Текст» входы «Сложить» серые, бросок даёт объяснение

### Тесты US4 (писать первыми)

- [X] T036 [P] [US4] Дополнить `tests/unit/engine/validate.test.ts` гарантиями E10–E12 для `linkCandidates`: запись для каждого порта целевого нода в порядке `nodePorts` независимо от `from` (E10); при `from.side = 'out'` выходы цели — `same-side`, совместимый вход — `ok`, несовместимый — `type-mismatch`, вход, дающий цикл, — `cycle`, занятый вход — `ok` с `replaces`; при `from.side = 'in'` входы цели — `same-side`, выходы проверяются как источник; `targetNode === from.node` — все `same-node`; нод неизвестного типа (удалённый составной) — `Rejection` с кодом `unknown-type` и текстом «Неизвестный тип нода: &lt;id&gt;.» (E12); E11 — совпадение с `canConnect` для всех портов противоположной стороны на графе-образце; **тексты отказов проверяются дословно** (принцип IV): `same-side` от выхода — «Нельзя соединить выход с выходом: связь идёт от выхода одного нода ко входу другого.», от входа — «Нельзя соединить вход со входом: связь идёт от выхода одного нода ко входу другого.», `same-node` — «Нельзя соединить нод с самим собой.», `type-mismatch` и `cycle` — тексты из `src/engine/errors.ts`
- [X] T037 [P] [US4] Дополнить `tests/unit/store/ui-logic.test.ts` машиной связывания по research R5: `idle → pressed` (нажатие на строку); `pressed → dragging` при сдвиге больше 4 px; `pressed → picking` при отпускании без сдвига на маркере; отпускание без сдвига на имени — `idle`; `peek` задаётся и переключается при наведении на другой нод (US4 #8); отпускание/щелчок на доступной строке → намерение `connect` и `idle`; на недоступной → намерение `notify` с `Rejection.message` этой строки (текст проверяется), `dragging → idle`, `picking` остаётся (US4 #11); Escape, щелчок по пустому холсту, повторный щелчок по маркеру → `idle` (US4 #12); начало перетаскивания в `picking` → `dragging`; `resetForTab` и удаление нода-источника → `idle`; `escape()` сначала отменяет связывание, потом закрывает окна; Пробел при `linking.kind !== 'idle'` не открывает палитру (перенесено из T018)
- [X] T038 [P] [US4] Дополнить `tests/unit/ui/floating-geometry.test.ts` функцией `peekPosition(nodeRect, windowSize, viewport)`: окно рядом с нодом со стороны, где больше места, нод не перекрыт, окно внутри вьюпорта
- [X] T039 [P] [US4] Написать `tests/component/peek-grid.test.tsx`: `PeekGrid` нода B показывает тот же набор и порядок строк, что `PropertyGrid` B (FR-020); недоступные строки — `.is-disabled`, `aria-disabled="true"`, `title` = текст отказа; затенение не меняет число и порядок строк; в режиме привязки маркер источника `aria-pressed="true"`, строка `.is-linking`, видна подсказка «Выберите нод и параметр для связи» (US4 #9); для нода неизвестного типа вместо строк — текст причины «Неизвестный тип нода: &lt;id&gt;.»
- [X] T040 [P] [US4] Написать `tests/e2e/ui-us4-linking.spec.ts`: #1 — за курсором метка `.link-ghost`, холст не двигается; #2 и SC-003 — над нодом B временное окно, выходы B и несовместимые входы серые, координаты строк до и во время перетаскивания совпадают; #3 — бросок на совместимый вход создаёт связь, B пересчитан, выделен A; #4 — перетаскивание входа на выход B создаёт связь B → A; #5 — бросок на серую строку: связи нет, уведомление с **дословным** текстом причины (принцип IV) для трёх случаев — «Несовместимые типы: текст → число. …», «Нельзя соединить выход с выходом: …», «Нельзя соединить: связь образует цикл…»; бросок на нод неизвестного типа (составной нод удалён из палитры) — связи нет, уведомление «Неизвестный тип нода: …» (граничный случай); #6 — бросок на пустой холст и Escape ничего не меняют; #7 — бросок на занятый вход заменяет связь, Ctrl+Z возвращает прежнюю; #8 — переход курсора с B на C меняет окно; #9–#12 — режим привязки щелчком по маркеру; #13 — маркеры источника и цели становятся зелёными, после удаления последней связи — серыми

### Реализация US4

- [X] T041 [US4] Реализовать `linkCandidates(graph, from, targetNode, registry)` в `src/engine/validate.ts` по [contracts/engine-api.md](./contracts/engine-api.md) (неизвестный тип цели → `rejections.unknownType`; проверка стороны первой, затем `canConnect`) и экспортировать из `src/engine/index.ts`; T036 зелёный
- [X] T042 [US4] Добавить переходы `LinkingState` (`idle`, `pressed`, `dragging`, `picking`) в `src/store/ui-logic.ts` и действия в `src/store/ui.ts`; T037 зелёный
- [X] T043 [P] [US4] Добавить `peekPosition` в `src/ui/floating/geometry.ts`; T038 зелёный
- [X] T044 [US4] Добавить в `src/ui/canvas/connection.ts` функцию `tryLink(actions, from: LinkEnd, to: LinkEnd)`: строит связь «выход → вход», вызывает `connect`, при отказе — уведомление с `Rejection.message`
- [X] T045 [US4] Создать `src/ui/properties/useLinking.ts`: `pointerdown` на маркере или имени строки, `pointermove`/`pointerup` на `document`, поиск цели через `document.elementFromPoint` → `.react-flow__node[data-id]` или `[data-peek-node]`, порог 4 px, щелчок по ноду в `picking` задаёт `peek`; подключить к `PropertyRow`
- [X] T046 [P] [US4] Создать `src/ui/properties/PeekGrid.tsx`: `FloatingWindow` «Свойства: &lt;имя нода&gt;» с `data-peek-node`, положение — `peekPosition`, строки — `PropertyRow` с `disabled`/`reason` из `linkCandidates`; если `linkCandidates` вернул `Rejection` — вместо строк текст причины, бросок или щелчок по окну показывает её уведомлением; T039 зелёный
- [X] T047 [P] [US4] Создать `src/ui/properties/LinkGhost.tsx`: метка `.link-ghost` «&lt;имя&gt; (&lt;тип&gt;)» у курсора во время `dragging`
- [X] T048 [US4] В `src/ui/canvas/Canvas.tsx` во время связывания `nodesDraggable={false}` и `elementsSelectable={false}`; щелчок по пустому холсту в `picking` отменяет связывание; нод под курсором получает класс `.is-link-target`; подсказка и стили `.is-disabled`, `.is-linking` — в `src/ui/messages.ts` и `src/ui/styles.css`
- [X] T049 [US4] Перевести e2e на новое связывание: в `tests/e2e/helpers.ts` `connect(page, from, out, to, input)` — выделить `from`, перетащить строку `out` из окна «Свойства» на `to`, бросить на строку `input` временного окна; новый хелпер `linkByClick`; заменить ввод значений на карточке (`node.getByLabel(...)`) на `setInput` в `tests/e2e/us1-…us5-*.spec.ts`, `autosave-durability.spec.ts`, `opfs-fallback.spec.ts`, `perf.spec.ts`; T040 и все e2e зелёные

**Checkpoint**: связи создаются только через окна свойств; e2e фичи 001 больше не
зависят от портов и полей на карточке

---

## Phase 6: User Story 2 — Новый вид нодов и выделение (Priority: P1)

**Goal**: нод — прямоугольник с серым типом и именем экземпляра, переименование,
синяя рамка выделения, значок состояния и строка проблемы

**Independent Test**: «Сложить» → серым «Сложить» слева вверху, «Сложить» по
центру; переименовать в «Итого», перезагрузить — имя на месте; выделение — синяя
рамка

### Тесты US2 (писать первыми)

- [X] T050 [P] [US2] Переписать `tests/component/FlowNode.test.tsx`: #1 — `.flow-node__type` = название типа, `.flow-node__name` = `node.name`, у обоих `title` с полным текстом; на карточке нет видимых портов, значений и полей ввода; значок состояния всегда, `.flow-node__problem` только для `waiting`/`error`/`blocked` (FR-008); #6 — `.is-selected` у выделенного нода; класс состояния `status-*` не задаёт цвет рамки (FR-011); нод неизвестного типа — тип «Неизвестный нод» и его имя
- [X] T051 [P] [US2] Написать `tests/component/node-rename.test.tsx` для `NodeNameEditor`: #2 — двойной щелчок по имени открывает поле, Enter и потеря фокуса вызывают `renameNode`; #4 — Escape и пустое имя не меняют имя, пустое показывает текст отказа `empty-name` под полем; 101 символ — `name-too-long`; тот же редактор в заголовке окна «Свойства» (FR-009)
- [X] T052 [P] [US2] Дополнить `tests/component/history.test.ts`: #3 — `renameNode` отменяется и повторяется; правки одного имени быстрее 500 мс объединяются в один шаг (ключ `name:<id>`)
- [X] T053 [P] [US2] Написать `tests/e2e/ui-us2-node.spec.ts`: #1 — `border-radius` 0, тип серый и меньше имени; FR-007a — нод с коротким именем шириной около 20 символов, с именем из 90 символов — не шире 40 символов, имя в 3 строки с многоточием, высота такая же, как у короткого; #2 и #5 — переименование, ожидание ~1 с, `page.reload()` — имя на месте; выгрузка и загрузка сохраняют имя (SC-007); #6 — у выделенного нода синяя рамка (вычисленный стиль), без выделения — чёрная, при множественном выделении — у каждого; #7 — нод в `waiting` показывает значок и строку проблемы, отличимые от выделения

### Реализация US2

- [X] T054 [US2] Добавить `renameNode(nodeId, name): Result` в `src/store/actions.ts` через `normalizeNodeName` («после `trim` 1–100 символов»), шаг истории с ключом `name:<id>`; T052 зелёный
- [X] T055 [P] [US2] Создать `src/ui/canvas/NodeNameEditor.tsx` (поле переименования с текстом отказа под полем, класс `nodrag`); T051 зелёный
- [X] T056 [US2] Переписать `src/ui/canvas/FlowNode.tsx` по [contracts/ui-contract.md](./contracts/ui-contract.md#карточка-нода-fr-007-fr-007a-fr-008-fr-011): тип, имя (`NodeNameEditor` по двойному щелчку), `NodeStatusBadge`, строка проблемы, две скрытые служебные «ручки» React Flow (`.flow-node__anchor`, research R3); убрать порты, значения, `IoPortsEditor` и кнопки составного нода (они в окне свойств); T050 зелёный
- [X] T057 [US2] Удалить `src/ui/canvas/PortHandle.tsx` и его использование; в `src/ui/canvas/Canvas.tsx` — `nodesConnectable={false}`, убрать `isValidConnection`, `onConnect`, `onConnectEnd`
- [X] T058 [US2] Подключить `NodeNameEditor` в заголовок `src/ui/properties/PropertyGrid.tsx`
- [X] T059 [US2] Стили карточки в `src/ui/styles.css` по research R9: `border-radius: 0`, чёрная рамка 2 px, `.is-selected` — `--selected` (синий); `width: fit-content; min-width: 20ch; max-width: 40ch`, высота `--node-height` (строка типа + 3 строки имени + строка проблемы), моноширинный шрифт; имя — `-webkit-line-clamp: 3`, `overflow-wrap: anywhere`; тип и проблема — 1 строка с многоточием; служебные ручки — `opacity: 0; pointer-events: none`; удалить стили `.port-handle`, `.port-row` и цвета рамок по статусам
- [X] T060 [US2] Заменить в e2e обращения к `.flow-node__title` на `.flow-node__name` (а чтение значений `show-value`/`out-result` с карточки — на хелпер `valueOf` через окно свойств; перф-тест — в T071) (`tests/e2e/us4-composite.spec.ts`, `perf.spec.ts`); T053 и все e2e зелёные

**Checkpoint**: новый вид нодов; на карточке нет портов и значений

---

## Phase 7: User Story 5 — Одна линия между нодами с подписями связей (Priority: P2)

**Goal**: одна прямая линия со стрелкой на пару нодов, подпись «выход→вход», окно
связей с удалением крестиком

**Independent Test**: связать `result` A со входами `день` и `запуск` B — одна
линия и подпись из 2 строк; удалить «результат→запуск» крестиком — 1 строка

### Тесты US5 (писать первыми)

- [X] T061 [P] [US5] Написать `tests/unit/ui/bundles.test.ts`: `bundleEdges` даёт один пучок на упорядоченную пару, `id` = `bundle:<source>-><target>`, связи в порядке графа (SC-004); `bundleLabel` — строки «&lt;выход&gt;→&lt;вход&gt;», не больше 5, затем «ещё N» (FR-024)
- [X] T062 [P] [US5] Написать `tests/unit/ui/edge-geometry.test.ts`: `borderPoint(rect, toward)` лежит на рамке прямоугольника для целей справа, слева, сверху, снизу и по диагонали, на линии между центрами
- [X] T063 [P] [US5] Написать `tests/component/edge-list.test.tsx`: окно «Связи: &lt;A&gt; → &lt;B&gt;», `li` на каждую связь, крестик `aria-label="Удалить связь «выход→вход»"` удаляет только её (#5); список обновляется, если связь удалена извне; окно закрывается, когда связей не осталось
- [X] T064 [P] [US5] Написать `tests/e2e/ui-us5-edges.spec.ts`: #1 — одна `.react-flow__edge` на пару со стрелкой к получателю; #2 — подпись из 2 строк; #3 — после перемещения нода линия прямая (путь `M … L …`), подпись едет; #4 — щелчок по линии и по подписи открывает окно связей; #5 и SC-006 — удаление крестиком за 2 щелчка, получатель пересчитан; #6 — Ctrl+Z возвращает связь; #7 — щелчок по пустому холсту, Escape, «Закрыть»; #8 — при масштабе 0,4 подписей нет, щелчок по линии работает, при 0,5 и больше подписи возвращаются; выделенная линия + Delete удаляет все связи пучка одним шагом отмены

### Реализация US5

- [X] T065 [P] [US5] Создать `src/ui/canvas/bundles.ts` (`bundleEdges`, `bundleLabel`); T061 зелёный
- [X] T066 [P] [US5] Создать `src/ui/canvas/edge-geometry.ts` (`borderPoint`); T062 зелёный
- [X] T067 [US5] Создать `src/ui/canvas/BundleEdge.tsx` по research R2, R10: концы через `useInternalNode` и `borderPoint`, `getStraightPath`, `BaseEdge` с `markerEnd` `MarkerType.ArrowClosed`, `interactionWidth` 12; подпись `.bundle-label` через `EdgeLabelRenderer`, скрыта при `transform[2] < LABEL_MIN_ZOOM` (0.5); `data-testid="bundle-<A>-><B>"`
- [X] T068 [US5] В `src/ui/canvas/Canvas.tsx` строить рёбра из `bundleEdges`, `edgeTypes = { bundle: BundleEdge }`; `onEdgeClick` → открыть окно связей у точки щелчка; щелчок по пустому холсту закрывает его; удаление выделенного пучка — все его связи одним шагом через `deleteElements`
- [X] T069 [US5] Создать `src/ui/canvas/EdgeListWindow.tsx` (`FloatingWindow` у точки щелчка, крестики → `actions.disconnect`), рендерить из `FloatingLayer` при `edgeWindow`; тексты — в `src/ui/messages.ts`, стили линии и `.bundle-label` — в `src/ui/styles.css`; T063 зелёный
- [X] T070 [US5] Обновить подсчёт `.react-flow__edge` в `tests/e2e/us5-editing.spec.ts` под пучки (правка не понадобилась: в тесте одна связь — один пучок); T064 и все e2e зелёные

**Checkpoint**: все пять историй работают независимо

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T071 Добавить в `tests/e2e/perf.spec.ts` замер SC-005 на графе из 100 нодов: от выделения до видимого окна «Свойства» и от наведения во время перетаскивания до временного окна — меньше 100 мс; проверить, что замеры SC-002/SC-003 фичи 001 проходят (SC-008), `npm run test:perf`
- [X] T072 [P] Прогнать `npm run test:e2e:firefox` (перетаскивание указателем, `elementFromPoint`) и исправить расхождения
- [X] T073 [P] Поставить пометки «уточнено в 002» со ссылкой на раздел «Связь с фичей 001» спеки 002 у FR-001, FR-003, FR-006, FR-007, FR-007a, FR-015, FR-016, FR-018, FR-031 и SC-006 в `specs/001-dag-workflow-editor/spec.md`; у `NodeInstance` в `specs/001-dag-workflow-editor/data-model.md` и в `specs/001-dag-workflow-editor/contracts/file-formats.md` — ссылку на обязательное поле `name` из `specs/002-editor-ui-redesign/contracts/file-formats.md` (research R14)
- [X] T074 [P] Обновить раздел «Тесты» в `CLAUDE.md`: хелперы `addNode` (палитра по Пробелу и вкладки), `connect`, `linkByClick`, `setInput`, `openSidebar`; ноды искать по `.flow-node__name` или `data-id`
- [X] T075 Удалить мёртвый код и стили (поля значений на карточке, `.port-*`, старые классы раскладки) в `src/ui/`; `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` зелёные
- [ ] T076 Пройти [quickstart.md](./quickstart.md) вручную (включая SC-002 — новый пользователь связывает два нода за ≤ 15 с); отклонения от плана записать в research.md, дерево файлов plan.md и контракты

---

## Покрытие acceptance-сценариев тестами (принцип II)

| Сценарий | Тесты |
|---|---|
| US1 #1 | T019 |
| US1 #2 | T019 |
| US1 #3 | T018, T019 |
| US1 #4 | T017, T019 |
| US1 #5 | T017, T019 |
| US1 #6 | T019 |
| US1 #7 | T005, T006, T019 |
| US1 #8 | T018, T019 |
| US2 #1 | T050, T053 |
| US2 #2 | T051, T053 |
| US2 #3 | T052 |
| US2 #4 | T002, T051 |
| US2 #5 | T003, T053 |
| US2 #6 | T050, T053 |
| US2 #7 | T050, T053 |
| US3 #1 | T028, T029 |
| US3 #2 | T028, T029 |
| US3 #3 | T028, T029 |
| US3 #4 | T028, T029 |
| US3 #5 | T028 |
| US3 #6 | T004, T029 |
| US3 #7 | T004, T028 |
| US3 #8 | T028, T029 |
| US3 #9 | T028, T029 |
| US4 #1 | T040 |
| US4 #2 | T036, T039, T040 |
| US4 #3 | T037, T040 |
| US4 #4 | T036, T040 |
| US4 #5 | T036, T037, T040 |
| US4 #6 | T037, T040 |
| US4 #7 | T036, T040 |
| US4 #8 | T037, T040 |
| US4 #9 | T037, T039, T040 |
| US4 #10 | T037, T040 |
| US4 #11 | T037, T040 |
| US4 #12 | T037, T040 |
| US4 #13 | T028, T040 |
| US5 #1 | T061, T064 |
| US5 #2 | T061, T064 |
| US5 #3 | T062, T064 |
| US5 #4 | T064 |
| US5 #5 | T063, T064 |
| US5 #6 | T064 |
| US5 #7 | T004, T063, T064 |
| US5 #8 | T064 |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → истории.
- **US1 (Phase 3)**: после Foundational.
- **US3 (Phase 4)**: после US1 (окно свойств живёт в слое окон и в новой раскладке).
- **US4 (Phase 5)**: после US3 (тащат строки окна свойств).
- **US2 (Phase 6)**: после US4 — карточка убирает порты и поля, через которые
  работали e2e; к этому моменту тесты переведены на окно свойств (T035, T049).
- **US5 (Phase 7)**: после US2 (ребро-пучок опирается на скрытые служебные ручки
  карточки, T056); по коду независим от US3/US4.
- **Polish (Phase 8)**: после всех историй.

### Внутри каждой фазы

- Тесты пишутся первыми и падают.
- Чистая логика (engine, `ui-logic`, `geometry`, `bundles`) → компоненты → подключение
  в `Canvas`/`Workbench` → перевод существующих тестов.
- `src/ui/styles.css`, `src/ui/messages.ts`, `src/ui/canvas/Canvas.tsx` и
  `tests/e2e/helpers.ts` правятся во многих задачах — такие задачи последовательны.

### User Story Dependencies

US1 → US3 → US4 → US2 → US5 — линейная цепочка из-за общей раскладки и перевода
e2e-тестов (см. plan.md, «Почему US2 после US3–US4»). Каждая история после своей
фазы проверяется независимо по своему Independent Test.

### Parallel Opportunities

- Phase 2: тесты T002–T006 параллельно; T008 и T015 параллельно с T007/T009.
- Внутри историй: все задачи тестов `[P]`; новые файлы компонентов
  (`MenuButton`/`SidebarWindow`, `PropertyRow`, `PeekGrid`, `LinkGhost`,
  `NodeNameEditor`, `bundles`, `edge-geometry`) — параллельно.
- Polish: T072–T074 параллельно.

---

## Parallel Example: Foundational

```text
# Тесты фундамента — одновременно:
T002 tests/unit/engine/naming.test.ts
T003 tests/unit/model/serialize.test.ts, import.test.ts, tests/unit/storage/directory-storage.test.ts
T004 tests/unit/store/ui-logic.test.ts
T005 tests/unit/ui/floating-geometry.test.ts
T006 tests/component/floating-window.test.tsx
```

## Parallel Example: User Story 4

```text
# Тесты US4 — одновременно:
T036 tests/unit/engine/validate.test.ts (linkCandidates)
T037 tests/unit/store/ui-logic.test.ts (машина связывания)
T038 tests/unit/ui/floating-geometry.test.ts (peekPosition)
T039 tests/component/peek-grid.test.tsx
T040 tests/e2e/ui-us4-linking.spec.ts

# Новые компоненты — одновременно (после T041–T043):
T046 src/ui/properties/PeekGrid.tsx
T047 src/ui/properties/LinkGhost.tsx
```

---

## Implementation Strategy

### MVP First

1. Phase 1: Setup
2. Phase 2: Foundational — имя нода, стор интерфейса, плавающее окно
3. Phase 3–5: US1 → US3 → US4. Без US4 в новом интерфейсе нельзя собрать граф,
   поэтому MVP — это US1 + US3 + US4 (plan.md)
4. **STOP and VALIDATE**: сценарии US1, US3, US4 из quickstart; e2e фичи 001 зелёные
5. Демонстрация MVP

### Incremental Delivery

1. Setup + Foundational → модель и каркас окон готовы
2. US1 → холст на весь экран, палитра и панель — окна
3. US3 → окно свойств
4. US4 → новое связывание (MVP)
5. US2 → новый вид нодов и переименование
6. US5 → пучки связей и окно связей
7. Polish → перф, Firefox, артефакты 001, CLAUDE.md

Каждая фаза — отдельный коммит (по команде пользователя); после каждой фазы все
тесты зелёные.

---

## Notes

- [P] — разные файлы, нет зависимостей от незавершённых задач
- [USn] связывает задачу с user story для трассируемости
- Тесты должны падать до реализации
- На любом checkpoint можно остановиться и проверить историю независимо
- Отклонения от плана (новый файл, другая сигнатура) сразу записывать в research.md,
  дерево файлов plan.md и контракты
- Файлы, сохранённые до фичи 002, не открываются — это ожидаемо (spec, Clarifications)
