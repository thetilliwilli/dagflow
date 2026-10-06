---

description: "Задачи фичи 003-english-ui-unicode-names"
---

# Tasks: Английский интерфейс и имена без ограничений длины

**Input**: `/specs/003-english-ui-unicode-names/` — [spec.md](./spec.md), [plan.md](./plan.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/ui-texts.md](./contracts/ui-texts.md), [quickstart.md](./quickstart.md)

**Tests**: обязательны (принцип II конституции, R8): у каждого acceptance-сценария есть
тест; тесты пишутся до реализации и сначала падают. Тексты сообщений проверяются
дословно по [contracts/ui-texts.md](./contracts/ui-texts.md) (принцип IV). Отсутствие
ограничений длины отдельными тестами не проверяется: старые тесты ограничений удаляются
(SC-003).

**Порядок историй**: US2 (P2) выполняется раньше US1 (P1) — так в плане («Порядок
реализации»): снятие ограничений меняет набор текстов отказов (уходит `name-too-long`),
и перевод потом делается один раз по финальному набору. US2 при этом независима от US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (разные файлы, нет зависимости от незавершённых задач)
- **[Story]**: история из spec.md (US1, US2, US3)

## Общие правила перевода тестов (для всех задач «перевести ожидаемые строки»)

- Ожидаемые тексты интерфейса, сообщения, `aria-label`, имена ролей, названия встроенных
  нодов и категорий — на английском, дословно по контракту.
- Названия тестов (`describe`/`it`/`test`) и комментарии остаются на русском.
- Пользовательские данные в тестах (имена нодов, workflow, составных нодов, введённые
  пользователем) можно оставить русскими — это данные, а не интерфейс (FR-010). Имена по
  умолчанию (`'Сложить'`, `'Новый workflow'`, `'Число'`…) меняются на английские
  (`'Add'`, `'New workflow'`, `'Number'`).
- `playwright.config.ts`: `grepInvert: /рабочая папка|требует подтверждения/` опирается
  на русские названия тестов — не менять.

---

## Phase 1: Setup

**Purpose**: зафиксировать исходное состояние; новых зависимостей нет (plan.md).
Отдельной фазы Foundational нет: общих блокирующих задач у историй нет.

- [X] T001 Убедиться, что на ветке `003-english-ui-unicode-names` зелёные `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` (базовая линия до правок); при падениях — записать их в заметки к задаче и не смешивать с работой фичи

---

## Phase 2: User Story 2 — Имена без ограничений длины (Priority: P2)

**Goal**: имена нода, workflow, составного нода и порта «Input»/«Output» не ограничены по
длине (FR-007); отклоняется только пустое после `trim` (для порта — пустое); длинные имена
показываются с многоточием и полностью в подсказке (FR-008); имена на любом языке
сохраняются без искажений (FR-009).

**Independent Test**: назвать нод фразой из 300 символов, workflow — из 200, составной
нод — из 150, порт нода «Input» — из 80; карточка не шире предела, вкладка, список и
палитра — с многоточием и `title`; после выгрузки, загрузки и перезагрузки имена на разных
языках те же; пустое имя отклоняется.

### Tests for User Story 2 ⚠️ (сначала)

- [X] T002 [P] [US2] `tests/unit/model/serialize.test.ts`: удалить тест «имя длиннее 100 символов отклоняется»; добавить (US2 #3, SC-004): имена `'Итого'`, `'合計'`, `'日本語の名前'`, `'مجموع'`, `'Résumé 📈'`, `'👨‍👩‍👧 семья'` у нода, workflow, составного нода и порта после `serialize` → `parse` совпадают посимвольно (`toBe`)
- [X] T003 [P] [US2] Удалить тесты ограничения длины имени нода: в `tests/unit/engine/naming.test.ts` — «100 символов — можно, 101 — отказ name-too-long», в `tests/component/node-rename.test.tsx` — «имя длиннее 100 символов — отказ name-too-long»; тесты пустого имени остаются
- [X] T004 [P] [US2] `tests/unit/engine/composite.test.ts` (US2 #4): порт нода «Input» с пустым именем → отказ с текстом `The port name cannot be empty.` (контракт, раздел «Отказы», «порт без имени»); тесты уникальности портов не меняются
- [X] T005 [P] [US2] `tests/component/workflows-tabs.test.tsx` (FR-008): workflow с именем из 300 символов — у вкладки в `TabBar` и у строки в `WorkflowList` есть `title`, равный полному имени
- [X] T006 [P] [US2] `tests/component/palette-tabs.test.tsx` (FR-008, edge case «длинное имя составного нода»): у составного нода с именем из 150 символов `.palette__item-title` имеет `title` с полным именем
- [X] T007 [US2] Создать e2e `tests/e2e/names.spec.ts` (US2 #1–#5; FR-008, SC-004) через хелперы `tests/e2e/helpers.ts`: (1) нод с именем из 300 символов — ширина карточки не больше, чем у нода с коротким именем (`boundingBox().width`), полное имя — в `title` `.flow-node__name` и в окне свойств; (2) workflow с именем из 200 символов, составной нод — из 150, порт нода «Input» внутри составного нода — из 80: у вкладки, строки списка и элемента палитры — `title` с полным именем, раскладка не ломается; (3) пустое имя и одни пробелы — отказ с понятным сообщением; (4) имена `'Итого'`, `'合計'`, `'مجموع'`, `'Résumé 📈'` у нодов и workflow → выгрузить в файл, удалить workflow, загрузить файл, `page.reload()` (подождать ~1 с после правок — автосохранение) → имена совпадают посимвольно. Тексты интерфейса в этом файле пока русские; переводятся в T024

### Implementation for User Story 2

- [X] T008 [US2] `src/model/schemas.ts`: убрать `v.maxLength(...)` у имён — `name` нода `v.pipe(v.string(), v.trim(), v.minLength(1))`; `NameSchema` (workflow, составной нод) `v.pipe(v.string(), v.trim(), v.minLength(1))`; `PortDefSchema.name` `v.pipe(v.string(), v.minLength(1))` (data-model: «после `trim` не пустое»; для порта — «не пустое», без `trim`, как раньше); формат файлов остаётся `version: 1`
- [X] T009 [US2] `src/engine/errors.ts`, `src/engine/validate.ts`, `src/engine/index.ts`, `src/engine/types.ts`: удалить код отказа `'name-too-long'`, константу `MAX_NODE_NAME` и `rejections.nameTooLong`; `normalizeNodeName` проверяет только «не пусто после `trim`» (`empty-name`); убрать `MAX_NODE_NAME` из экспорта `index.ts`; в комментарии `PortDef.name` в `types.ts` убрать «1–40 символов»
- [X] T010 [US2] `src/engine/errors.ts` и `src/engine/composite.ts`: добавить в `rejections` отказ пустого имени порта с текстом `The port name cannot be empty.` (код `duplicate-port-name`, как сейчас); в `validateIoPorts` заменить проверку `name.length < 1 || name.length > 40` на «имя не пустое» с этим отказом; обновить комментарий над функцией («уникальность и непустота»)
- [X] T011 [US2] `src/store/actions.ts` и `src/ui/messages.ts`: удалить `MAX_NAME = 100`; в переименовании workflow и составного нода — только проверка «не пусто после `trim`»; у копии workflow убрать `.slice(0, MAX_NAME)`; в `messages.ts` у `copyName` убрать `.slice(0, 100)`, `invalidName` → `The name cannot be empty.` (контракт, «Интерфейс»)
- [X] T012 [P] [US2] Убрать атрибуты `maxLength` у полей имён: `src/ui/dialogs/NameDialog.tsx` (`maxLength={100}`), `src/ui/layout/WorkflowList.tsx` (`maxLength={100}`), `src/ui/canvas/IoPortsEditor.tsx` (`maxLength={40}`)
- [X] T013 [US2] Многоточие и полный текст в подсказке (FR-008, R5): в `src/ui/layout/TabBar.tsx` у названия вкладки и в `src/ui/layout/WorkflowList.tsx` у `.workflow-list__name` — `title={name}`; в `src/ui/palette/Palette.tsx` у `.palette__item-title` — `title` с полным названием (если подсказка элемента уже занята списком портов — `title` у самого названия); в `src/ui/styles.css` у названия вкладки, `.workflow-list__name` и `.palette__item-title` — `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0`. Убедиться, что уже есть и не сломаны: карточка нода — 3 строки и многоточие (FR-007a 002), заголовки окон (T081 002), подписи линий и окно связей (T080 002), `.prop-name`
- [X] T014 [US2] Прогнать `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test tests/e2e/names.spec.ts`; всё зелёное

**Checkpoint**: US2 работает и проверена независимо: ограничений длины нет, пустые имена отклоняются, длинные имена не ломают раскладку, Unicode-имена переживают выгрузку и перезагрузку.

---

## Phase 3: User Story 1 — Весь интерфейс на английском (Priority: P1) 🎯 MVP

**Goal**: все тексты, которые видит пользователь, — на английском (FR-001 – FR-006) по
[contracts/ui-texts.md](./contracts/ui-texts.md); тексты движка собраны в
`src/engine/errors.ts`, тексты стора и UI — в `src/ui/messages.ts` (R2).

**Independent Test**: открыть редактор без пользовательских данных, пройти рабочую
область, левую панель, палитру, окно свойств, окно связей, диалоги, вызвать цикл,
несовместимые типы, пустое имя, деление на ноль, загрузку некорректного файла — ни одного
русского текста.

### Tests for User Story 1 ⚠️ (сначала, должны падать)

Перевод ожидаемых строк — по «Общим правилам перевода тестов» в начале файла.

- [X] T015 [US1] Перевести хелперы: `tests/e2e/helpers.ts` (`addNode` — палитра и вкладки категорий по английским названиям: «Constants», «Math», «Text», «Comparison & logic», «Condition», «Arrays & objects», «Display», «My composite nodes»; `selectNode`, `setInput`, `valueOf`, `inputField`, `connect`, `linkByClick`, `openSidebar`/`closeSidebar` («Menu», «Workflows & storage»), `tabBar` — по английским `aria-label` и именам ролей контракта), `tests/e2e/persistent.ts` (если есть строки интерфейса), `tests/component/helpers.tsx` (`openSidebar`, `openPalette`, `UiProbe`), `tests/component/setup.ts`
- [X] T016 [P] [US1] Перевести ожидаемые строки в тестах движка: `tests/unit/engine/builtins.test.ts` (SC-002: название, описание и категория каждого встроенного нода сравниваются дословно с таблицей «Встроенные ноды и категории» контракта, включая `builtin:input`, `builtin:output`, `builtin:passthrough`, категории `My composite nodes`, `Composite interface` и описание по умолчанию `Composite node`; тексты ошибок нодов — «Сообщения вычисления»: `Division by zero: set a non-zero divisor.`, `The result is too large.`, `Expected an array, got: <kind>.`, `The index must be an integer, got: <index>.`, `Index <i> is out of range: the array has 1 item.` / `… 3 items.`, `Field “<key>” not found.`, `“<text>” is not a number.`), `tests/unit/engine/naming.test.ts` (имя нода по умолчанию = английское название типа), `tests/unit/engine/validate.test.ts` (все отказы раздела «Отказы» дословно, включая оба варианта `same-side` и `type-mismatch` с полными названиями типов `number`/`text`/…/`any`), `tests/unit/engine/evaluator.test.ts` и `tests/unit/engine/evaluator-composite.test.ts` (`Fill in input “a”.`, `Node “<name>” upstream is waiting for inputs.`, `Node “<name>” upstream failed.`, `No value on output “<port>” of node “<name>”.`, `Unknown node type: <type>.`, `Internal error in node “<title>”.`), `tests/unit/engine/values.test.ts` (`describeKind`: array, number, text, boolean, object, null; `formatCompact`: `[0 items]`, `[1 item]`, `[3 items]`, `{1 field}`, `{2 fields}`), `tests/unit/engine/composite.test.ts` (`Port “<name>” already exists on another Input node. Port names must be unique.`, то же для Output, `Select at least one node.`, `Input and Output nodes cannot be collapsed into a composite node.`, `Cannot put composite node “<name>” inside itself (directly or through other composite nodes).`), `tests/unit/engine/composite-fixtures.ts`, `tests/unit/engine/helpers.ts`, `tests/unit/engine/evaluator.perf.test.ts`
- [X] T017 [P] [US1] Перевести ожидаемые строки в тестах модели: `tests/unit/model/serialize.test.ts`, `tests/unit/model/import.test.ts`, `tests/unit/model/import-merge.test.ts`, `tests/unit/model/fixtures.ts` — тексты раздела «Импорт и хранение»: `The file is not valid JSON.`, `Unknown file format.`, `The file was created by a newer version of the editor.`, `The file does not look like a workflow export: <path>.`, `The file contains unknown node types: <types>.`, `The graph in the file is invalid: <reason>.`, рекурсия при импорте, конфликт имени (`… — added as “<renamed>”.`), путь `(root)`, `Invalid <workflow / composite node / workspace> file: <path>.`; копия при слиянии — `<name> (from browser)`
- [X] T018 [P] [US1] Перевести ожидаемые строки в тестах хранилища: `tests/unit/storage/directory-storage.test.ts` (`The file is damaged: invalid JSON`, `The file is damaged: <detail>`, `The browser does not support writing files.`, `The target storage is not empty.`), `tests/unit/storage/switch-storage.test.ts` (тексты `copyToEmpty`, `addFromBrowser`, `folderLost`, `accessDenied`, `copyName`), `tests/unit/storage/autosave.test.ts`, `tests/unit/storage/location.test.ts`, `tests/unit/storage/fake-directory.ts`, `tests/unit/storage/env.ts`
- [X] T019 [P] [US1] Перевести ожидаемые строки в `tests/unit/store/ui-logic.test.ts`, `tests/unit/ui/storage-notice.test.ts`, `tests/unit/ui/bundles.test.ts` (`+<n> more`), `tests/unit/ui/edge-geometry.test.ts`, `tests/unit/ui/floating-geometry.test.ts`
- [X] T020 [P] [US1] Перевести ожидаемые строки в компонентных тестах окон и свойств: `tests/component/property-grid.test.tsx`, `tests/component/peek-grid.test.tsx`, `tests/component/floating-window.test.tsx`, `tests/component/global-keys.test.tsx`, `tests/component/connection-feedback.test.tsx`, `tests/component/edge-list.test.tsx` (`Links: <A> → <B>`, `Delete link “<link>”`) — раздел контракта «Интерфейс»: Properties, Inputs, Outputs, No inputs, No outputs, `Link “<port>”`, `Properties: <node>`, `<port> (<type>)`, Node name, Close, Pick a node and a property to link
- [X] T021 [P] [US1] Перевести ожидаемые строки в компонентных тестах нодов и палитры: `tests/component/FlowNode.test.tsx` (полные названия типов в подсказках, `Unknown node`, `Type “<type>” not found: …`), `tests/component/node-status.test.tsx` (computed, computing, waiting for inputs, error, `not computed: upstream problem`), `tests/component/node-rename.test.tsx`, `tests/component/palette-tabs.test.tsx` (категории, `Palette`, `Click a node or drag it onto the canvas.`, `Inputs: <list>. Outputs: <list>.`, `No composite nodes yet: …`)
- [X] T022 [P] [US1] Перевести ожидаемые строки в компонентных тестах workflow, составных нодов и хранилища: `tests/component/workflows-tabs.test.tsx` (`New workflow`, `<name> (copy)`, `Create workflow`, `Open/Rename/Duplicate/Delete “<name>”`, `Delete workflow?`, `Close tab “<name>”`, `Open a workflow from the list or create a new one`), `tests/component/composite-actions.test.tsx` (`Collapse into composite node`, `Composite node: <name>`, `Used in 1 place.` / `Used in 3 places.`, `Delete composite node?`, `Composite node ports changed. Links removed: <n>`), `tests/component/store-actions.test.ts` (`No open tab.`, `Node “<id>” not found.`, `The name cannot be empty.`, суффикс копии `(copy)`), `tests/component/history.test.ts` (Undo, Redo), `tests/component/convergence.test.tsx`, `tests/component/phase10.test.tsx`, `tests/component/evaluation.test.ts`, `tests/component/error-boundary.test.tsx` (`Could not display the tab. …`, `Reload tab`), `tests/component/sidebar-link.test.tsx`, `tests/component/rerender.test.tsx`
- [X] T023 [P] [US1] Перевести ожидаемые строки и локаторы в e2e фичи 001: `tests/e2e/us1-reactive-graph.spec.ts`, `tests/e2e/us2-validation-errors.spec.ts`, `tests/e2e/us3-storage-tabs.spec.ts`, `tests/e2e/us4-composite.spec.ts`, `tests/e2e/us5-editing.spec.ts`, `tests/e2e/autosave-durability.spec.ts`, `tests/e2e/opfs-fallback.spec.ts` (`Saving unavailable…`)
- [X] T024 [P] [US1] Перевести ожидаемые строки и локаторы в e2e фичи 002 и US2: `tests/e2e/ui-us1-layout.spec.ts`, `tests/e2e/ui-us2-node.spec.ts`, `tests/e2e/ui-us3-properties.spec.ts`, `tests/e2e/ui-us4-linking.spec.ts`, `tests/e2e/ui-us5-edges.spec.ts`, `tests/e2e/perf.spec.ts`, `tests/e2e/names.spec.ts` (T007)
- [X] T025 [US1] Создать e2e `tests/e2e/ui-us1-english.spec.ts` (US1 #1–#7, SC-001): в чистом профиле без пользовательских данных пройти — рабочая область (вкладка `New workflow`, `Undo`/`Redo`, миникарта), левая панель (`Workflows & storage`, сообщение о хранилище, `Create workflow`, `Export to file`, `Import from file`, `github`), палитра по Пробелу (все вкладки категорий; `Add` с описанием `a + b`), добавить ноды `Add` и `Number` — имя на карточке `Add`, окно свойств (`Properties`, `Inputs`, `Outputs`, `waiting for inputs`, `Fill in input “a”.`), ошибки: цикл (`Cannot link: this connection would create a cycle, …`), `Text` → вход `Add` (`Incompatible types: text → number. …`), деление на ноль, пустое имя нода (`The node name cannot be empty. Enter at least one character.`), загрузка текстового файла (`Could not load the file`, `The file is not valid JSON.`), окно связей (`Links: … → …`, `Delete link “…”`), диалог `Delete workflow?`; после каждого шага `document.body.textContent` и все атрибуты `title`/`aria-label`/`placeholder` не содержат `/[А-Яа-яЁё]/`; `document.title === 'DAG Flow'`, `document.documentElement.lang === 'en'`. Экран восстановления доступа к папке (US1 #6) проверяется дословно в `tests/e2e/us3-storage-tabs.spec.ts` (T023) на фикстуре `tests/e2e/persistent.ts`

### Implementation for User Story 1

- [X] T026 [US1] `src/engine/errors.ts` (R2, R3; контракт «Типы, состояния, значения», «Сообщения вычисления», «Отказы»): `typeNames` → number/text/boolean/array/object/any; `plural(n, one, other)` вместо русской трёхформенной (`1 item`, `0 items`, `3 items`); все `rejections` на английском (включая оба варианта `same-side`, `type-mismatch` с текстом `Incompatible types: <from> → <to>. Link ports of the same type or use a port of type “any”.`, `empty-name` — `The node name cannot be empty. Enter at least one character.`); добавить `stateMessages` (fill input, upstream waiting, upstream failed, no output value, unknown type, internal error), `nodeErrors` (деление на ноль, переполнение, не массив/не объект, индекс, нет поля, не число), `kindNames` (array, number, text, boolean, object, null) и форматы компактного вида (`[n items]`, `{n fields}`); добавить отказы сворачивания (`Select at least one node.`, `Input and Output nodes cannot be collapsed into a composite node.`) и дубля порта (`Port “<name>” already exists on another <Input/Output> node. Port names must be unique.`)
- [X] T027 [US1] Движок использует тексты из `errors.ts`: `src/engine/values.ts` (`describeKind` → `kindNames`, `formatCompact` → английская `plural`), `src/engine/evaluator.ts` (строки 88, 89, 97, 109, 126 → `stateMessages`), `src/engine/composite.ts` (отказы `validateIoPorts` и сворачивания → `rejections`); экспорт новых объектов из `src/engine/index.ts`, если их использует UI
- [X] T028 [US1] Встроенные ноды на английском (контракт «Встроенные ноды и категории»): `src/engine/builtins/define.ts` (`categories`: Constants, Math, Text, Comparison & logic, Condition, Arrays & objects, Display; сюда же категории `My composite nodes`, `Composite interface` и описание по умолчанию `Composite node`), `src/engine/builtins/constants.ts`, `math.ts`, `text.ts`, `logic.ts`, `collections.ts`, `show.ts`, `io.ts` (Input, Output, Composite port; `compositeCategory` — из `define.ts`; имена портов нового нода «Input»/«Output» (FR-003) уже латинские — `p1`, `p2`… в `src/ui/canvas/IoPortsEditor.tsx`, менять не нужно) — названия и описания дословно по таблице; тексты `NodeError` → `nodeErrors` из `errors.ts`; `src/engine/registry.ts`: `COMPOSITE_CATEGORY` и описание по умолчанию — из `define.ts`
- [X] T029 [P] [US1] Тексты модели (контракт «Импорт и хранение»): `src/model/import.ts` (`importMessages` на английском), `src/model/serialize.ts` (`(root)`, `Invalid workflow file: <path>.`, `Invalid composite node file: <path>.`, `Invalid workspace file: <path>.`)
- [X] T030 [P] [US1] Тексты хранилища: `src/storage/directory-storage.ts` (`The browser does not support writing files.`, `The file is damaged: <detail>` с `invalid JSON`, `The target storage is not empty.`), `src/storage/opfs-writer.ts` (`Could not write the file.`; `'Папка вне хранилища браузера'` → `The folder is outside browser storage.`)
- [X] T031 [US1] `src/ui/messages.ts` — все тексты на английском дословно по разделу контракта «Интерфейс (messages.ts)», включая подписи состояний нодов (строки 5–9: `computed`, `computing`, `waiting for inputs`, `error`, `not computed: upstream problem` — контракт «Типы, состояния, значения»), счётные формы `Used in 1 place.`/`3 places.` через `plural`, `<name> (from browser)`, `<name> (copy)`, `New workflow`, `Composite node: <name>`, `Storage`, `Inputs: <list>. Outputs: <list>.`; добавить ключи для текстов стора: `noOpenTab` (`No open tab.`), `nodeNotFound` (`Node “<id>” not found.`), не найден составной нод, не найден нод «Input»/«Output», `Port “<port>” not found.`, суффикс копии; затем `src/store/actions.ts` (строки 253, 323, 364, 397, 445, 529, 550 — тексты из `messages.ts`; комментарий над генератором имён — «New workflow», «New workflow 2») и `src/store/store.ts` (`DEFAULT_WORKFLOW_NAME = 'New workflow'`, из `messages.ts`)
- [X] T032 [US1] UI: `src/ui/palette/Palette.tsx` (подсказка «Inputs: … Outputs: …» — из `messages.ts`), `src/ui/layout/FolderBanner.tsx` (5 × `aria-label="Хранилище"` → ключ `messages.ts` со значением `Storage`); `index.html` — `lang="en"`, `<title>DAG Flow</title>`
- [X] T033 [US1] Проверка: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` зелёные; `npx prettier --write` по изменённым файлам

**Checkpoint**: интерфейс полностью английский; US2 по-прежнему зелёная.

---

## Phase 4: User Story 3 — Работа, сохранённая раньше, продолжает работать (Priority: P2)

**Goal**: рабочие папки и выгрузки, сохранённые до фичи 003, открываются и вычисляются;
имена пользователя (включая русские имена по умолчанию из 002) не меняются (FR-010, R6).

**Independent Test**: открыть выгрузку и рабочую папку в формате 002 с русскими именами —
workflow вычисляются с теми же значениями, нод «Сложить» сохраняет имя, тип в углу — «Add».

### Tests for User Story 3 ⚠️

- [X] T034 [P] [US3] Создать фикстуру `tests/e2e/fixtures/legacy-002-export.json` — выгрузка в формате фичи 002 (`version: 1`): workflow «Расчёт» с нодами `builtin:number` (имя «Число», значение 2), `builtin:number` (имя «Число», 3), `builtin:add` (имя «Сложить»), `builtin:show` (имя «Показать»), экземпляр составного нода «Удвоить» (внутри `builtin:input` с портом «x», `builtin:add`, `builtin:output` с портом «результат»); записать новый файл в дерево `tests/` в `plan.md` (отклонение от плана)
- [X] T035 [US3] Создать e2e `tests/e2e/legacy.spec.ts` (US3 #1, #2; SC-005): загрузить `tests/e2e/fixtures/legacy-002-export.json` через `Import from file` → workflow открыт, значения вычислены те же, что до фичи (`valueOf`), карточка нода «Сложить» показывает имя «Сложить» и тип `Add`; составной нод «Удвоить» — в палитре на вкладке `My composite nodes`, порты «x» и «результат» на месте; переименование «Сложить» → «Sum» работает
- [X] T036 [P] [US3] В `tests/unit/storage/directory-storage.test.ts` (US3 #1, SC-005): фальшивая рабочая папка (`tests/unit/storage/fake-directory.ts`) с файлами workflow, составного нода и `workspace.json` в формате 002 с русскими именами («Сложить», «Новый workflow», «Удвоить», порт «результат») читается без `unavailable`; имена совпадают посимвольно; вычисление графа через `createEvaluator` из `src/engine` (или хелпер из `tests/unit/engine/helpers.ts`) даёт те же значения

### Implementation for User Story 3

- [X] T037 [US3] Прогнать T035 и T036; реализация не ожидается (R6: формат не меняется, схема только ослаблена). Если тест падает — исправить причину в `src/model/` или `src/storage/` и записать отклонение в `research.md`

**Checkpoint**: все три истории зелёные независимо.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T038 [P] `CLAUDE.md` (R9): «Интерфейс и все тексты для пользователя — на русском» → «Интерфейс и все тексты для пользователя — на английском; артефакты Spec Kit, комментарии и общение — на русском»; в разделе «Тесты» подсказка про палитру: название нода может совпадать с названием категории («Text»)
- [X] T039 [P] Пометки «уточнено в 003» (R9, принцип V): `specs/001-dag-workflow-editor/spec.md` (Assumptions «Язык интерфейса — русский»), `specs/001-dag-workflow-editor/data-model.md` (имена workflow и составного нода 1–100, порта 1–40 → «ограничение снято в 003, только непустое»), `specs/002-editor-ui-redesign/spec.md` (Assumptions о языке, FR-009 — «до 100 символов» снято); в `specs/BACKLOG.md` убедиться, что раздела этой фичи нет
- [X] T040 Прогнать `npm run test:e2e:firefox` и `npm run test:perf` (SC-002/SC-003 фичи 002 — без регрессий); фильтр Firefox в `playwright.config.ts` по-прежнему отсекает сценарии рабочей папки
- [X] T041 Финальная проверка: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` зелёные; `npx prettier --check` по изменённым файлам
- [ ] T042 Ручная проверка по [quickstart.md](./quickstart.md) (US1 1–7, US2 1–4, US3 1; SC-006 — формулировки ошибок сверить с контрактом)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **US2 (Phase 2)** → **US1 (Phase 3)** → **US3 (Phase 4)** → **Polish (Phase 5)**.
- US2 перед US1 — решение плана (меньше двойной работы с текстами отказов). Технически
  US1 можно сделать и без US2: тогда в T026 перевести и `name-too-long`, а T009–T011
  удалят его позже.
- US3 зависит только от Setup, но её e2e (T035) использует английские локаторы —
  удобнее после US1; T036 (unit) можно делать в любой момент.

### Within Each User Story

- Тесты (T002–T007; T015–T025; T034–T036) — до реализации.
- US2: T008 → T009 → T010 (оба меняют `errors.ts`) → T011; T012 и T013 независимы от движка.
- US1: T015 (хелперы) раньше T020–T025; T026 → T027 → T028 (движок: сначала `errors.ts`);
  T029 и T030 независимы от движка; T031 → T032; T033 — последней.

### Parallel Opportunities

- US2: T002–T006 — разные файлы, параллельно; T012 параллельно с T008–T011.
- US1: T016–T024 — разные файлы, параллельно (после T015 для e2e и компонентных); T029 и T030 параллельно с T026–T028.
- US3: T034 и T036 параллельно.
- Polish: T038 и T039 параллельно.

---

## Parallel Example: User Story 2

```bash
# Тесты US2 одновременно (разные файлы):
Task: "T002 Unicode-имена в tests/unit/model/serialize.test.ts"
Task: "T003 удалить тесты name-too-long"
Task: "T004 пустое имя порта в tests/unit/engine/composite.test.ts"
Task: "T005 title у вкладки и строки списка в tests/component/workflows-tabs.test.tsx"
```

## Parallel Example: User Story 1

```bash
# После T015 (хелперы) — перевод тестов слоями одновременно:
Task: "T016 тесты движка tests/unit/engine/*"
Task: "T017 тесты модели tests/unit/model/*"
Task: "T018 тесты хранилища tests/unit/storage/*"
Task: "T023 e2e фичи 001"
Task: "T024 e2e фичи 002"
# Реализация вне движка — параллельно с T026–T028:
Task: "T029 src/model/import.ts, serialize.ts"
Task: "T030 src/storage/directory-storage.ts, opfs-writer.ts"
```

---

## Implementation Strategy

### MVP

MVP фичи — US1 (английский интерфейс, основная цель). По плану перед ней делается
небольшая US2, поэтому практический первый релиз: Phase 1 → US2 → US1 →
**STOP and VALIDATE** (`ui-us1-english.spec.ts`, quickstart US1).

### Incremental Delivery

1. Setup → базовая линия.
2. US2 → имена без ограничений; коммит фазы.
3. US1 → английский интерфейс; коммит фазы (MVP).
4. US3 → проверка совместимости; коммит фазы.
5. Polish → `CLAUDE.md`, пометки в 001/002, Firefox/perf, quickstart; коммит.

---

## Notes

- Отклонения от плана (новые файлы вроде `tests/e2e/fixtures/legacy-002-export.json`,
  другие ключи в `messages.ts`) сразу записывать в `plan.md`/`research.md`/контракт.
- Тексты для пользователя — только в `src/ui/messages.ts`, `src/engine/errors.ts`,
  определениях встроенных нодов и сообщениях `src/model`/`src/storage` (R2).
- Коммит — после каждой фазы, по команде пользователя.

---

## Phase 6: Уточнение — числа без склонения

Вместо задачи convergence о тесте форм «place/places» (FR-005 уточнён: склонения нет).

- [X] T043 Убрать склонение по числу per FR-005: удалить `plural` из `src/engine/errors.ts` и `src/engine/index.ts`; тексты с числом — в нейтральной форме по контракту (`[items: 3]`, `{fields: 2}`, `Index <i> is out of range: array length is <n>.`, `Instances in use: <n>. …` в `src/ui/messages.ts`); удалить тесты на формы числа в `tests/unit/engine/values.test.ts`, `tests/unit/engine/builtins.test.ts`, обновить ожидания в `tests/component/property-grid.test.tsx`, `tests/component/composite-actions.test.tsx`
