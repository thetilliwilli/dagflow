# Implementation Plan: Английский интерфейс и имена без ограничений длины

**Branch**: `003-english-ui-unicode-names` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-english-ui-unicode-names/spec.md`

## Summary

Все тексты, которые видит пользователь, переводятся на английский. Это константы в
`src/ui/messages.ts` и `src/engine/errors.ts`, а также названия и описания встроенных
нодов. Тексты, разбросанные по движку, стору и UI, собираются туда же. Локализации и
выбора языка нет. Ограничения длины имён (100 и 40) снимаются: остаётся только запрет
пустого имени, а длинные имена в интерфейсе обрезаются многоточием с подсказкой.
Формат файлов не меняется. Новых зависимостей нет.

## Technical Context

**Language/Version**: TypeScript 6.0, ES2023; Node.js 24 LTS (как в 001, 002)

**Primary Dependencies**: без изменений (React 19.3, @xyflow/react 12.12, Zustand 5.0,
Immer 11.1, Valibot 1.5, idb-keyval 6.3; Vite 8.3)

**Storage**: без изменений; формат `version: 1`, схема имён только ослабляется

**Testing**: Vitest 5.0 + Testing Library; Playwright 1.63 (Chromium, Firefox, perf)

**Target Platform**: настольные браузеры (как в 001)

**Project Type**: SPA, только клиент

**Performance Goals**: без изменений (перф-тест фичи 002 зелёный)

**Constraints**: тексты для пользователя — только в `messages.ts`, `errors.ts`,
определениях встроенных нодов (`builtins/*`) и собственных сообщениях `model`/`storage`
(research R2); движок не импортирует UI

**Scale/Scope**: около 230 строк текста в ~20 модулях; около 40 тестовых файлов с
русскими строками; 3 user stories

Неизвестных нет: решения — в [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип / раздел | Проверка | До дизайна | После дизайна |
|---|---|---|---|
| I. Простота (YAGNI) | один язык, без локализации и переключателя; ограничения длины убираются, а не усложняются | ✅ | ✅ константы вместо словаря (R1); без подсчёта символов, RTL и шрифтов |
| II. Тесты для бизнес-логики | тексты отказов и ошибок проверяются дословно; снятие ограничений длины — unit-тесты схем и действий; каждый acceptance-сценарий → тест | ✅ | ✅ R8 |
| III. Только локальные данные | хранение не меняется; старые файлы читаются (схема только ослабляется) | ✅ | ✅ |
| IV. Понятные ошибки | перевод сохраняет «что случилось и что делать» | ✅ | ✅ [contracts/ui-texts.md](./contracts/ui-texts.md) |
| V. Учебная прозрачность | пометки «уточнено в 003» в 001/002; правило `CLAUDE.md` о языке | ✅ | ✅ R9 |
| Ограничения: зависимости | новых нет | ✅ | ✅ |

**Результат**: нарушений нет, Complexity Tracking не требуется.

## Project Structure

### Documentation (this feature)

```text
specs/003-english-ui-unicode-names/
├── plan.md
├── research.md          # R1–R9
├── data-model.md        # правила имён: только «не пусто»
├── quickstart.md
├── contracts/
│   └── ui-texts.md      # английские формулировки — источник истины для тестов
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

`~` — изменённый файл (новых файлов в `src/` нет).

```text
index.html                         # ~ lang="en"
src/
├── engine/
│   ├── ~ errors.ts                # английские тексты; plural(n, one, other); stateMessages, nodeErrors, kindNames;
│   │                              #   без name-too-long и MAX_NODE_NAME; отказы портов и сворачивания
│   ├── ~ values.ts                # describeKind/formatCompact — тексты из errors.ts
│   ├── ~ evaluator.ts             # сообщения состояний — из errors.ts
│   ├── ~ composite.ts             # отказы — из errors.ts; порт: только «не пусто»
│   ├── ~ validate.ts              # normalizeNodeName: только empty-name
│   ├── ~ registry.ts              # категория и описание составных — английские (из builtins/define.ts)
│   ├── ~ index.ts                 # экспорт без MAX_NODE_NAME
│   └── builtins/~ *.ts            # английские названия, описания, категории; тексты NodeError — из errors.ts
├── model/
│   ├── ~ schemas.ts               # без maxLength у имён
│   ├── ~ serialize.ts             # английские тексты ошибок чтения
│   └── ~ import.ts                # английские importMessages
├── storage/~ directory-storage.ts, opfs-writer.ts   # английские тексты
├── store/
│   ├── ~ actions.ts               # без MAX_NAME; тексты — из messages.ts; копия без обрезки
│   └── ~ store.ts                 # DEFAULT_WORKFLOW_NAME = 'New workflow'
└── ui/
    ├── ~ messages.ts              # все тексты на английском (contracts/ui-texts.md)
    ├── ~ palette/Palette.tsx      # подсказка «Inputs: … Outputs: …» — из messages.ts; многоточие у названий
    ├── ~ layout/FolderBanner.tsx  # aria-label «Storage» — из messages.ts
    ├── ~ layout/TabBar.tsx, WorkflowList.tsx      # многоточие + title у имён (FR-008); без maxLength
    ├── ~ dialogs/NameDialog.tsx, canvas/IoPortsEditor.tsx   # без maxLength
    └── ~ styles.css               # многоточие у вкладок, списка, палитры

tests/                             # ~ ожидаемые строки — на английском во всех unit, component, e2e
├── unit/engine/~ naming.test.ts, builtins.test.ts, validate.test.ts …
├── unit/model/~ serialize.test.ts, import.test.ts (тесты ограничений длины удаляются)
├── component/~ helpers.tsx (Menu, Palette … → английские имена)
└── e2e/~ helpers.ts; + ui-us1-english.spec.ts (SC-001), + names.spec.ts (US2, FR-008, SC-004), + legacy.spec.ts (US3, SC-005)
    └── + fixtures/legacy-002-export.json   # выгрузка формата 002 с русскими именами (US3; отклонение от плана, T034)
```

Кроме кода: `CLAUDE.md` (правило о языке, подсказка «Text»), пометки «уточнено в 003»
в спецификациях 001 и 002 (R9).

**Structure Decision**: структура не меняется; меняется содержимое строк и правила
имён. Тексты движка собираются в `errors.ts` (движок не зависит от UI).

## Порядок реализации (ориентир для /speckit-tasks)

1. **Фундамент**: отдельного нет; SC-002 проверяет `builtins.test.ts` по таблице
   контракта, SC-001 — e2e-обход (тест по исходникам не нужен).
2. **US2 (P2, но первым — маленький)**: снять ограничения длины (схемы, движок,
   действия, поля ввода), многоточие в вкладках/списке/палитре; старые тесты ограничений
   длины удаляются; тесты отображения длинных имён и имён на разных языках.
3. **US1 (P1)**: перевод `errors.ts` + движок + builtins → `model`/`storage` →
   `messages.ts` + UI → `index.html`; перевод ожидаемых строк в тестах слоями (unit →
   component → e2e); e2e обхода без кириллицы.
4. **US3 (P2)**: фикстура формата 002 с русскими именами — открывается и вычисляется.
5. **Сквозное**: `CLAUDE.md`, пометки в 001/002, перф и Firefox, quickstart вручную.

**Почему US2 первым**: снятие ограничений меняет тексты отказов (уходит
`name-too-long`), а перевод потом переводит уже финальный набор текстов — без двойной
работы.

## Complexity Tracking

Нарушений конституции нет.
