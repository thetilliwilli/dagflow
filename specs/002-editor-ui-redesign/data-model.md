# Data Model: Новый облик редактора графов

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Модель фичи 001 ([data-model.md](../001-dag-workflow-editor/data-model.md))
сохраняется. Здесь — только изменения и новые сущности.

## NodeInstance — нод в графе (изменение)

| Поле | Тип | Описание |
|---|---|---|
| `name` | string | **новое, обязательное.** Имя экземпляра (FR-009); при создании равно названию типа (`NodeTypeDef.title`) |

Остальные поля (`id`, `type`, `position`, `values`, `ports?`) — без изменений.

**Правила** (`renameNode`, `normalizeNodeName`, R8):
- имя есть у каждого нода всегда: `addNode` — название типа, `collapse` — имя
  составного нода, `expand`, дублирование и импорт — имена копируются;
- новое имя обрезается по краям; пустое → отказ `empty-name`;
- длиннее 100 символов → отказ `name-too-long`;
- совпадение с названием типа допустимо; уникальность не требуется;
- переименование — шаг истории отмены с ключом `name:<nodeId>` (правки одного
  имени в пределах 500 мс объединяются, как правки значения);
- переименование составного нода в палитре имена его экземпляров не меняет;
- в файлах имя обязательно; файл с нодом без имени некорректен
  ([contracts/file-formats.md](./contracts/file-formats.md#файлы-без-имён-нодов)).

**Составные ноды**: имена внутренних нодов входят в «содержательное равенство»
определений при импорте (FR-029a фичи 001).

## Bundle — пучок связей (выводится, не хранится)

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | `bundle:<source>-><target>` |
| `source` | string | id нода-источника |
| `target` | string | id нода-получателя |
| `edges` | Edge[] | связи от `source` к `target` в порядке графа |

**Правила**: `bundleEdges(edges)` даёт ровно один пучок на упорядоченную пару
нодов; пучков B→A при наличии A→B не бывает (граф ациклический). Подпись —
строки `«<выход>→<вход>»` в порядке `edges`, не больше 5, затем строка
`«ещё N»` (FR-024).

## LinkCandidate — доступность параметра для связи (выводится)

`linkCandidates(graph, from, targetNodeId, registry)` → `Rejection` с кодом
`unknown-type`, если тип нода неизвестен; иначе для каждого порта нода
`targetNodeId` (`side`: `'in' | 'out'`, `port`):

- `{ ok: true, replaces?: string }` — связать можно (`replaces` — id связи,
  которую заменит новая на занятом входе);
- `Rejection` с кодом `same-side` | `same-node` | `type-mismatch` | `cycle` |
  `unknown-port` и понятным текстом.

`from = { node, port, side }` — параметр, с которого начато связывание. Связь
всегда «выход → вход»: при `side = 'out'` проверяется `canConnect({source: from,
target: порт B})`, при `side = 'in'` — `canConnect({source: порт B, target: from})`.

## UiState — состояние интерфейса (только в памяти, стор `src/store/ui.ts`)

| Поле | Тип | Описание |
|---|---|---|
| `selection` | string[] | id выделенных нодов активной вкладки |
| `windows` | `Record<WindowId, WindowState>` | открытые плавающие окна |
| `windowOrder` | WindowId[] | порядок по z (последний — сверху) |
| `paletteCategory` | string \| null | выбранная вкладка палитры |
| `edgeWindow` | `{source, target, at: {x, y}} \| null` | открытое окно связей |
| `linking` | LinkingState | состояние связывания |

`WindowId`: `'sidebar' | 'palette' | 'properties' | 'edges'`.
`WindowState`: `{ open: boolean, position: {x, y} | null }` — `null` означает
положение по умолчанию (R6). Положения живут до перезагрузки страницы.

**Правила**:
- окно свойств видно, только если `selection.length === 1` и нод существует;
- переключение вкладки workflow очищает `selection`, `edgeWindow` и `linking`;
- удаление нода из графа убирает его из `selection`; если он был источником
  связывания — связывание отменяется;
- окно связей закрывается, когда в его паре не осталось связей.

## LinkingState — машина связывания

```text
{ kind: 'idle' }
{ kind: 'pressed',  from, startAt: {x, y} }
{ kind: 'dragging', from, pointer: {x, y}, peek: nodeId | null }
{ kind: 'picking',  from, peek: nodeId | null }
```

`from = { node, port, side }`. Переходы — в [research R5](./research.md#r5-связывание-перетаскивание-и-режим-привязки)
и [contracts/ui-contract.md](./contracts/ui-contract.md#связывание). Все переходы —
чистые функции `src/store/ui-logic.ts`.

## Связи между сущностями

```text
Graph.edges ──bundleEdges──▶ Bundle[] ──▶ ребро React Flow (одно на пучок)
UiState.selection ──[1 нод]──▶ окно свойств ──строка──▶ LinkingState.from
LinkingState.peek ──▶ временное окно свойств ──linkCandidates──▶ затенение строк
```
