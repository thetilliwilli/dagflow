# Contract: Engine API (`src/engine`)

Движок — чистый TypeScript без зависимостей от DOM, React и хранилища. Это
единственный модуль, через который UI и стор работают с графами. Типы — см.
[data-model.md](../data-model.md).

## Ограничения модуля

- Не импортирует ничего из `src/ui`, `src/store`, `src/storage`, а также DOM API.
  Это проверяется отдельным `tsconfig.engine.json` без `lib: ["DOM"]`.
- Все функции детерминированы. Время и uuid передаются извне (генератор id —
  параметр), чтобы тесты были воспроизводимыми.

## Реестр типов нодов

```ts
interface NodeRegistry {
  get(typeId: string): NodeTypeDef | undefined;
  list(): NodeTypeDef[];                          // для палитры (FR-001)
}

function createRegistry(composites: CompositeDef[]): NodeRegistry;
// встроенные ноды + составные (порты составных вычисляются из нодов «Вход»/«Выход»)
```

## Проверка правок

```ts
type Rejection = { ok: false; code: RejectCode; message: string };   // message — для пользователя (FR-032)
type RejectCode =
  | 'cycle' | 'type-mismatch' | 'same-node' | 'unknown-port' | 'unknown-type' | 'input-occupied'
  | 'duplicate-port-name' | 'composite-recursion' | 'io-node-outside-composite';

function canConnect(graph: Graph, edge: Omit<Edge, 'id'>, registry: NodeRegistry):
  { ok: true; replaces?: string /* id связи, занимавшей вход */ } | Rejection;

function canAddNode(graph: Graph, typeId: string, ctx: { insideComposite?: string },
  registry: NodeRegistry, composites: CompositeDef[]): { ok: true } | Rejection;

function validateGraph(graph: Graph, registry: NodeRegistry): Rejection[];
// полная проверка (используется при импорте): циклы, типы, неизвестные типы и порты
```

## Составные ноды

```ts
function collapse(graph: Graph, nodeIds: string[], name: string, newId: () => string):
  { graph: Graph; composite: CompositeDef } | Rejection;
// FR-021: создаёт определение с нодами «Вход»/«Выход» для внешних связей
// и заменяет группу экземпляром; вычисленные значения не меняются (FR-022)

function expand(graph: Graph, instanceId: string, def: CompositeDef, newId: () => string): Graph;
// FR-025

function compositePorts(def: CompositeDef): { inputs: PortDef[]; outputs: PortDef[] };
// FR-021a/b

function compositeDependencies(defs: CompositeDef[]): Map<string, Set<string>>;
// для проверки рекурсии (FR-026) и сбора определений при выгрузке (FR-029)
```

## Реактивное вычисление

```ts
interface Evaluator {
  /** Заменить структуру (ноды/связи/определения). Перестраивает развёрнутый граф. */
  setGraph(graph: Graph, composites: CompositeDef[]): void;
  /** Изменить значение входа без перестройки структуры. */
  setValue(nodeId: string, port: string, value: JsonValue): void;
  /** Ноды, которые будут пересчитаны при следующем flush, — статус 'computing'. */
  pending(): ReadonlySet<string>;
  /** Пересчитать грязные ноды в топологическом порядке; вернуть изменившиеся состояния. */
  flush(): Map<string, NodeState>;
  /** Текущее состояние нода верхнего уровня (для составных — агрегированное). */
  state(nodeId: string): NodeState;
  /** Состояние внутреннего нода экземпляра составного нода (путь instanceId/.../nodeId). */
  stateAt(path: string): NodeState;
}

function createEvaluator(registry: NodeRegistry): Evaluator;
```

**Гарантии** (покрываются тестами):

| # | Гарантия | Требование |
|---|---|---|
| E1 | `flush()` пересчитывает только ноды, достижимые от изменённых | FR-012 |
| E2 | каждый грязный нод вычисляется ровно один раз за `flush()` и после всех своих источников | FR-013 |
| E3 | результат `flush()` не зависит от порядка вызовов `setValue` в пакете | FR-014 |
| E4 | незаполненный обязательный вход (нет связи, значения и default) → `waiting` с именем входа; `null` по связи — обычное значение | FR-017 |
| E5 | `NodeError` → `error`; потомки → `blocked`; независимые ветки → `ok` | FR-018 |
| E6 | после исправления причины статус возвращается к `ok` без дополнительных вызовов | FR-019 |
| E7 | значение по порту `any`, не подходящее ноду, → `error` с понятным сообщением | FR-005b |
| E8 | экземпляр составного нода даёт те же выходы, что развёрнутая группа | FR-022 |
| E9 | сводный статус экземпляра: error > waiting > blocked > computing > ok по внутренним нодам (первопричина важнее следствий) | FR-016, FR-017, FR-018 |

## Ошибки нодов

```ts
class NodeError extends Error {
  constructor(public userMessage: string) { super(userMessage); }
}
// любое другое исключение из compute превращается в
// error с message «Внутренняя ошибка нода "<title>"», без трассировки (FR-032)
```

## Связь с UI (кто кого вызывает)

```text
UI событие ──▶ store action ──▶ engine.canConnect / canAddNode ──▶ (ok) обновить Graph
                                                                 └─(rejection) показать message
Graph изменился ──▶ evaluator.setGraph / setValue ──▶ rAF ──▶ evaluator.flush() ──▶ NodeState в стор ──▶ ноды перерисованы
```
