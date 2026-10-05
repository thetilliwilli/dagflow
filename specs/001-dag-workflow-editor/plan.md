# Implementation Plan: Визуальный редактор и реактивная среда выполнения DAG-workflow

**Branch**: `001-dag-workflow-editor` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-dag-workflow-editor/spec.md`

## Summary

Веб-приложение в браузере: визуальный редактор графов из нодов на React Flow и
собственный реактивный движок, который при любом изменении пересчитывает только
затронутые ноды в топологическом порядке, без глитчей. Составные ноды перед
вычислением разворачиваются в плоский DAG. Несколько workflow открываются во
вкладках. Все данные автоматически сохраняются в рабочую папку пользователя (File
System Access API), а без неё — в OPFS; перенос между машинами делается через
выгрузку и загрузку JSON-файлов. Движок — модуль на чистом TypeScript без
зависимостей от UI и DOM (основа для будущего серверного выполнения и для тестов).

## Technical Context

**Language/Version**: TypeScript 7.0, ES2023; Node.js 24 LTS для разработки

**Primary Dependencies**: React 19.3, @xyflow/react 12.12, Zustand 5.0, Immer 11.1,
Valibot 1.5, idb-keyval 6.3; сборка Vite 8.3 + @vitejs/plugin-react 6.1

**Storage**: File System Access API (рабочая папка; дескриптор в IndexedDB через
idb-keyval) → OPFS (запасной вариант); экспорт/импорт `.dagflow.json`. Без
бэкенда

**Testing**: Vitest 5.0 (node и jsdom), @testing-library/react 16.3,
@playwright/test 1.63 (Chromium)

**Target Platform**: настольные браузеры последних двух версий. Chromium — полный
функционал; Firefox и Safari — без рабочей папки (OPFS + файлы)

**Project Type**: одностраничное веб-приложение (SPA), только клиент

**Performance Goals**: отклик на правку < 100 мс на графе из 100 нодов (SC-002);
распространение изменения < 200 мс на 100 нодах (SC-003); автосохранение
< 1 с (SC-008)

**Constraints**: работает офлайн после загрузки; никаких сетевых запросов, кроме
загрузки самого приложения; JSON-значения до сотен КБ

**Scale/Scope**: 1 пользователь; графы до ~100 нодов (без деградации), десятки
workflow и составных нодов; около 30 встроенных типов нодов; 5 user stories

Неизвестных (NEEDS CLARIFICATION) нет: все решения приняты в [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип / раздел | Проверка | До дизайна | После дизайна |
|---|---|---|---|
| I. Простота (YAGNI) | только требования спеки; каждая зависимость обоснована (таблица ниже); без асинхронных нодов, нодов с переменным числом портов и серверной части | ✅ | ✅ одна реализация хранилища на оба бэкенда (R7), снапшоты вместо патчей (R5) |
| II. Тесты для бизнес-логики | движок, проверки, составные ноды, импорт — чистые модули с unit-тестами; каждый acceptance-сценарий → тест | ✅ | ✅ гарантии E1–E8 в [engine-api](./contracts/engine-api.md); матрица сценариев будет в tasks.md |
| III. Только локальные данные | FS Access / OPFS / IndexedDB — локальные; сторонних сервисов, CDN и аналитики нет | ✅ | ✅ шрифты и ресурсы собираются в бандл |
| IV. Понятные ошибки | все отказы и ошибки нодов — тексты для пользователя на русском; ошибка показывается на ноде, связи или поле; приложение не падает | ✅ | ✅ `Rejection.message`, `NodeError.userMessage`, тексты проверяются тестами |
| V. Учебная прозрачность | структура `src/` повторяет разделы спеки; FR-номера упоминаются в контрактах и тестах | ✅ | ✅ |
| Ограничения: веб, без бэкенда | SPA без сервера | ✅ | ✅ |
| Ограничения: зависимости обоснованы | см. таблицу | ✅ | ✅ |

### Обоснование зависимостей

| Зависимость | Задача | Почему не писать самим |
|---|---|---|
| React | UI-компоненты | выбран пользователем; основа React Flow |
| @xyflow/react | холст, ноды, связи, зум, выделение | месяцы работы и множество граничных случаев взаимодействия |
| Zustand | стор приложения | ~1 КБ, им пользуется сам React Flow; самописный стор с подписками и селекторами — то же самое, только хуже |
| Immer | неизменяемые правки документа | без него много шаблонного кода и ошибок при вложенных обновлениях |
| Valibot | проверка импортируемых файлов | типобезопасные схемы с путями ошибок; руками — много хрупкого кода |
| idb-keyval | хранить дескриптор папки в IndexedDB | сырой IndexedDB API многословен; библиотека ~600 байт |
| Vite, Vitest, Testing Library, Playwright | сборка и тесты (dev-зависимости) | стандартный инструментарий |

**Результат**: нарушений нет, Complexity Tracking не требуется.

## Project Structure

### Documentation (this feature)

```text
specs/001-dag-workflow-editor/
├── plan.md              # этот файл
├── research.md          # Phase 0: решения R1–R10
├── data-model.md        # Phase 1: сущности, правила, состояния нодов
├── quickstart.md        # Phase 1: запуск и сценарии проверки
├── contracts/
│   ├── engine-api.md    # API движка и его гарантии
│   ├── file-formats.md  # раскладка хранилища, форматы, алгоритм импорта
│   └── builtin-nodes.md # каталог встроенных нодов
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json
vite.config.ts
tsconfig.json              # приложение (DOM)
tsconfig.engine.json       # только src/engine, без lib DOM — гарантирует независимость движка
playwright.config.ts
index.html

src/
├── engine/                # чистый TS: ни React, ни DOM, ни хранилища
│   ├── types.ts           # JsonValue, PortType, PortDef, NodeTypeDef, Graph, NodeState…
│   ├── values.ts          # проверка значения по типу, совместимость типов, глубокое равенство
│   ├── registry.ts        # реестр типов нодов (встроенные + составные)
│   ├── validate.ts        # canConnect, canAddNode, validateGraph, поиск циклов
│   ├── composite.ts       # collapse, expand, compositePorts, зависимости, разворачивание
│   ├── evaluator.ts       # реактивное инкрементальное вычисление
│   ├── errors.ts          # NodeError, Rejection, тексты сообщений
│   ├── builtins/          # constants.ts, math.ts, text.ts, logic.ts, collections.ts, show.ts, io.ts
│   └── index.ts           # публичный API движка
├── model/
│   ├── schemas.ts         # Valibot-схемы файлов
│   ├── serialize.ts       # Workflow/CompositeDef/Workspace ↔ JSON
│   └── import.ts          # проверка и слияние при импорте (FR-029a)
├── storage/
│   ├── directory-storage.ts  # чтение/запись раскладки поверх FileSystemDirectoryHandle
│   ├── location.ts        # выбор папки, OPFS, восстановление доступа, idb-keyval
│   └── autosave.ts        # debounce 300 мс + сброс на pagehide
├── store/
│   ├── store.ts           # Zustand: workspace, tabs, history, nodeStates
│   ├── actions.ts         # правки графа через engine-проверки
│   ├── history.ts         # снапшоты, объединение правок значения
│   └── evaluation.ts      # связка стор ↔ Evaluator ↔ requestAnimationFrame
├── ui/
│   ├── App.tsx
│   ├── layout/            # WorkflowList, TabBar, StorageIndicator, баннеры
│   ├── canvas/            # Canvas (ReactFlow), FlowNode, PortHandle, ValueView, ValueEditor
│   ├── palette/           # Palette
│   ├── dialogs/           # подтверждения, ошибки импорта, имя составного нода
│   └── messages.ts        # тексты UI
└── main.tsx

tests/
├── unit/                  # Vitest (node): engine/*, model/*, storage/* (фейковый DirectoryHandle)
├── component/             # Vitest (jsdom) + Testing Library: store, FlowNode, Palette, TabBar
└── e2e/                   # Playwright: us1-…us5-*.spec.ts, perf.spec.ts
```

**Structure Decision**: один Vite-проект в корне репозитория. Слои зависят только
сверху вниз: `ui → store → engine/model/storage`, `model → engine`. Движок
изолирован отдельным tsconfig без DOM. Будущая серверная часть сможет импортировать
`src/engine` (и при необходимости `src/model`) без изменений; выделять пакеты или
монорепозиторий сейчас не нужно (принцип I).

## Порядок реализации (ориентир для /speckit-tasks)

1. **Каркас**: Vite + TS + два tsconfig + Vitest + Playwright + линтер.
2. **Движок (фундамент US1/US2)**: types → values → registry + встроенные ноды →
   validate → evaluator. Тесты пишутся первыми (E1–E7).
3. **US1**: стор, связка с вычислением, Canvas/FlowNode/Palette. Значения в
   реальном времени.
4. **US2**: отказы при соединении с подсказками, статусы waiting/error/blocked на
   нодах.
5. **US3**: model (схемы, сериализация, импорт), storage (DirectoryStorage,
   location, autosave), список workflow, вкладки, экспорт и импорт.
6. **US4**: composite (collapse/expand/ports/разворачивание, E8), вкладка
   составного нода, палитра составных нодов, слияние при импорте.
7. **US5**: undo/redo, групповое выделение и удаление, навигация по холсту.
8. **Сквозное**: e2e по quickstart, перф-тесты SC-002/SC-003, проверка Safari
   OPFS `createWritable` (риск R7).

## Complexity Tracking

Нарушений конституции нет.
