# Implementation Plan: Новый облик редактора графов

**Branch**: `002-editor-ui-redesign` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-editor-ui-redesign/spec.md`

## Summary

Редактор из фичи 001 получает новый облик и новый способ работы, а движок,
хранение и вычисление остаются прежними:
- холст с вкладками занимает весь экран;
- левая панель, палитра (по Пробелу, с вкладками категорий), окно свойств
  выделенного нода и окно связей становятся неблокирующими плавающими окнами;
- ноды — прямоугольники с серым типом и переименуемым именем экземпляра, синей
  рамкой выделения, значком состояния и строкой проблемы;
- связи создаются перетаскиванием строк окна свойств на другой нод или режимом
  привязки по маркеру; все связи между парой нодов рисуются одной прямой линией
  со стрелкой и подписью «выход→вход».

Английский интерфейс и имена на любом языке (Unicode) вынесены в отдельную
фичу 003.

Технически изменения такие:
- модель: обязательное поле `name` у нода (без совместимости со старыми
  файлами — миграции не входят в фичу);
- движок: функция `linkCandidates` и три новых отказа;
- новый сессионный стор интерфейса с чистыми редьюсерами;
- свой тип ребра React Flow для пучков связей;
- общий компонент плавающего окна.

Новых зависимостей нет.

## Technical Context

**Language/Version**: TypeScript 6.0, ES2023; Node.js 24 LTS для разработки (как в 001)

**Primary Dependencies**: без изменений — React 19.3, @xyflow/react 12.12, Zustand 5.0,
Immer 11.1, Valibot 1.5, idb-keyval 6.3; Vite 8.3. Новых пакетов нет (research R1)

**Storage**: без изменений (рабочая папка / OPFS); в формат нода добавляется
обязательное поле `name`, `version` остаётся 1; старые файлы без имён
считаются некорректными ([contracts/file-formats.md](./contracts/file-formats.md))

**Testing**: Vitest 5.0 (unit — node, компонентные — jsdom) + Testing Library;
Playwright 1.63 (Chromium, Firefox без сценариев папки, perf)

**Target Platform**: настольные браузеры последних двух версий (как в 001)

**Project Type**: одностраничное веб-приложение (SPA), только клиент

**Performance Goals**: окно свойств и временное окно появляются < 100 мс на графе из
100 нодов (SC-005); отклик правки < 100 мс и пересчёт < 200 мс сохраняются (SC-008)

**Constraints**: окна неблокирующие; при связывании строки окна не меняют состав,
порядок и размеры (FR-020); тексты только в `src/ui/messages.ts` и
`src/engine/errors.ts`; движок без DOM

**Scale/Scope**: 5 user stories, около 15 новых и 15 изменённых файлов `src/ui`,
небольшие правки `engine`, `model`, `store`; перевод e2e-тестов фичи 001 на новые
хелперы

Неизвестных (NEEDS CLARIFICATION) нет: решения — в [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип / раздел | Проверка | До дизайна | После дизайна |
|---|---|---|---|
| I. Простота (YAGNI) | только требования спеки; без новых зависимостей; без изменения размера окон, клавиатурного связывания, сохранения положения окон | ✅ | ✅ своё окно (~80 строк) вместо библиотеки (R1, R6); стор интерфейса — один маленький модуль (R4); `name` — одно обязательное поле, без миграций (R8) |
| II. Тесты для бизнес-логики | группировка связей, геометрия, ограничение окон, машина связывания, `linkCandidates`, переименование — чистые функции с unit-тестами; каждый acceptance-сценарий → тест | ✅ | ✅ гарантии E10–E15 в [contracts/engine-api.md](./contracts/engine-api.md); матрица тестов в R13 |
| III. Только локальные данные | хранение не меняется; новое поле — в тех же человекочитаемых JSON; старые файлы читаются | ✅ | ✅ [contracts/file-formats.md](./contracts/file-formats.md) |
| IV. Понятные ошибки | отказ при связывании виден до броска (затенение + подсказка) и после (уведомление); отказы переименования — под полем; новые тексты в `errors.ts`, проверяются тестами | ✅ | ✅ `same-side`, `empty-name`, `name-too-long` |
| V. Учебная прозрачность | связь с требованиями 001 описана в спеке; пометки «уточнено в 002» в артефактах 001 (R14); FR-номера в контрактах и тестах | ✅ | ✅ |
| Ограничения: веб, без бэкенда | SPA без сервера | ✅ | ✅ |
| Ограничения: зависимости обоснованы | новых нет; таблица фичи 001 действует | ✅ | ✅ |

### Обоснование зависимостей

Новых зависимостей нет. Используются уже обоснованные в
[plan.md фичи 001](../001-dag-workflow-editor/plan.md#обоснование-зависимостей):
React Flow (`getStraightPath`, `BaseEdge`, `EdgeLabelRenderer`, `useInternalNode`,
`MarkerType`), Zustand (стор интерфейса), Testing Library, Playwright.

**Результат**: нарушений нет, Complexity Tracking не требуется.

## Project Structure

### Documentation (this feature)

```text
specs/002-editor-ui-redesign/
├── plan.md              # этот файл
├── research.md          # Phase 0: решения R1–R14
├── data-model.md        # Phase 1: name у нода, Bundle, LinkCandidate, UiState, LinkingState
├── quickstart.md        # Phase 1: сценарии проверки
├── contracts/
│   ├── engine-api.md    # linkCandidates, normalizeNodeName, новые отказы, E10–E15
│   ├── file-formats.md  # обязательное поле name у нода; файлы без имён некорректны
│   └── ui-contract.md   # окна, триггеры, клавиши, разметка для тестов
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Изменения относительно дерева [фичи 001](../001-dag-workflow-editor/plan.md#source-code-repository-root):
`+` новый файл, `~` изменённый, `−` удалённый.

```text
src/
├── engine/
│   ├── ~ types.ts           # NodeInstance.name (обязательное), PortSide, LinkEnd, LinkCandidate
│   ├── ~ validate.ts        # linkCandidates, normalizeNodeName
│   ├── ~ errors.ts          # same-side, empty-name, name-too-long; MAX_NODE_NAME
│   ├── ~ composite.ts       # collapse: имя экземпляра = имя составного нода
│   ├── ~ evaluator.ts       # сообщения о нодах выше по графу — по отображаемому имени
│   └── ~ index.ts           # экспорт новых функций и типов
├── model/
│   └── ~ schemas.ts         # name: обязательное, trim, 1..100
├── store/
│   ├── ~ actions.ts         # renameNode, disconnectMany (удаление пучка одним шагом); addNode ставит name
│   ├── ~ react.ts           # AppProvider оборачивает UiProvider: стор интерфейса есть везде, где есть основной (и в компонентных тестах)
│   ├── + ui.ts              # стор интерфейса (Zustand vanilla) + UiProvider, useUi/useUiActions, bindUiToApp
│   └── + ui-logic.ts        # чистые редьюсеры: окна, z-порядок, Escape, выделение, связывание
├── ui/
│   ├── ~ Workbench.tsx      # полоса (☰ + TabBar) + холст; SidebarWindow; плашки поверх холста
│   ├── ~ Editor.tsx         # холст + слой плавающих окон внутри ReactFlowProvider
│   ├── ~ messages.ts        # typeAbbr, подписи окон, подсказки связывания, «ещё N»
│   ├── ~ styles.css         # новая раскладка, карточка без скруглений, окна, строки свойств
│   ├── floating/
│   │   ├── + FloatingWindow.tsx  # заголовок, закрытие, перетаскивание, z-порядок
│   │   ├── + FloatingLayer.tsx   # слой окон поверх холста (pointer-events: none)
│   │   ├── + geometry.ts         # clampToViewport, defaultPosition, peekPosition
│   │   └── + useGlobalKeys.ts    # Пробел (палитра), Escape (приоритет)
│   ├── canvas/
│   │   ├── ~ Canvas.tsx          # пучки, nodesConnectable=false, panActivationKeyCode=null, onSelectionChange, onEdgeClick
│   │   ├── ~ FlowNode.tsx        # тип, имя (переименование), значок, строка проблемы, скрытые ручки
│   │   ├── + BundleEdge.tsx      # прямая линия со стрелкой и подписью
│   │   ├── + bundles.ts          # bundleEdges, bundleLabel
│   │   ├── + edge-geometry.ts    # borderPoint
│   │   ├── + EdgeListWindow.tsx  # окно связей с крестиками
│   │   ├── + NodeNameEditor.tsx  # поле переименования (карточка и окно свойств)
│   │   ├── ~ connection.ts       # tryConnect для LinkEnd → Edge
│   │   ├── − PortHandle.tsx      # порты на карточке больше не нужны
│   │   └── ~ useShortcuts.ts     # без изменений по клавишам отмены
│   ├── properties/
│   │   ├── + PropertyGrid.tsx    # окно свойств выделенного нода
│   │   ├── + PeekGrid.tsx        # временное окно при связывании
│   │   ├── + PropertyRow.tsx     # [маркер][тип][имя][значение], затенение
│   │   ├── + LinkGhost.tsx       # метка за курсором при перетаскивании
│   │   └── + useLinking.ts       # указатель → переходы машины связывания, elementFromPoint
│   ├── palette/
│   │   └── ~ Palette.tsx         # плавающее окно с вкладками; щелчок добавляет
│   └── layout/
│       ├── + MenuButton.tsx      # ☰
│       └── + SidebarWindow.tsx   # StorageIndicator + WorkflowList + ExportImport в окне

tests/
├── unit/
│   ├── engine/ ~ validate.test.ts (linkCandidates, E10–E12), + naming.test.ts (E13–E15)
│   ├── model/  ~ serialize.test.ts, import.test.ts (name; файл без имён отклоняется)
│   ├── store/  + ui-logic.test.ts
│   └── ui/     + bundles.test.ts, edge-geometry.test.ts, floating-geometry.test.ts
├── component/  ~ FlowNode.test.tsx, phase10.test.tsx, convergence.test.tsx, workflows-tabs.test.tsx;
│               + property-grid.test.tsx, palette-tabs.test.tsx, floating-window.test.tsx, edge-list.test.tsx
└── e2e/        ~ helpers.ts (addNode, connect, linkByClick, setInput, openSidebar), us1–us5, perf, autosave, opfs;
                + ui-us1-layout, ui-us2-node, ui-us3-properties, ui-us4-linking, ui-us5-edges
```

Кроме кода: пометки «уточнено в 002» в `specs/001-dag-workflow-editor/` (R14) и
обновление подсказок по e2e в `CLAUDE.md` (новые хелперы, окно свойств).

**Structure Decision**: один Vite-проект, слои прежние (`ui → store →
engine/model/storage`). Новые папки `src/ui/floating/` и `src/ui/properties/`
повторяют разделы спеки («Рабочая область и плавающие окна», «Property grid»).
Чистая логика интерфейса лежит рядом с компонентами (`bundles.ts`,
`edge-geometry.ts`, `geometry.ts`) и в `src/store/ui-logic.ts`, а её unit-тесты — в
`tests/unit/ui` и `tests/unit/store`.

## Порядок реализации (ориентир для /speckit-tasks)

1. **Фундамент**:
   - `NodeInstance.name`, схема с обязательным `name`, `normalizeNodeName`,
     `linkCandidates`, новые отказы (тесты E10–E15 пишутся первыми);
   - стор интерфейса и `ui-logic` с тестами;
   - `FloatingWindow` и `geometry`.
2. **US1 (P1)**: каркас `Workbench` (☰, вкладки, холст на весь экран),
   `SidebarWindow`, палитра-окно с вкладками, Пробел и Escape, плашки поверх
   холста. Хелпер `addNode` и обращения к боковой панели в e2e переводятся здесь.
3. **US3 (P1)**: `PropertyGrid` и `PropertyRow` (ручной ввод, источник, действия
   составного нода и нода Вход/Выход). Карточка пока прежняя.
4. **US4 (P2)**: машина связывания, `useLinking`, `PeekGrid`, `LinkGhost`,
   затенение. Хелперы `connect`, `linkByClick`, `setInput` переходят на окно
   свойств, и e2e фичи 001 переводятся на них.
5. **US2 (P1)**: новая карточка `FlowNode` (тип, имя, значок, строка проблемы,
   размеры, скрытые ручки), переименование, синяя рамка. Порты и значения уходят
   с карточки.
6. **US5 (P2)**: `bundleEdges`, `BundleEdge`, подписи и порог масштаба,
   `EdgeListWindow`, удаление пучка.
7. **Сквозное**: перф SC-005/SC-008, пометки в артефактах 001, `CLAUDE.md`,
   ручная проверка по quickstart.

**Почему US2 после US3–US4**: карточка US2 убирает порты и значения, через которые
работают e2e-тесты фичи 001. Сначала появляются окно свойств и новое связывание,
тесты переводятся на них, и только потом меняется карточка. Так e2e остаются
зелёными после каждой фазы. Приоритеты историй это не меняет: MVP — US1–US3
вместе с US4, поскольку без связывания в новом интерфейсе нельзя собрать граф.

## Complexity Tracking

Нарушений конституции нет.
