# Contract: изменения API движка

Дополняет [engine-api.md фичи 001](../../001-dag-workflow-editor/contracts/engine-api.md).
Ограничения движка прежние: чистый TypeScript без DOM, React и хранилища.

## Типы

```ts
// types.ts
interface NodeInstance {
  id: string;
  type: string;
  name: string;               // новое, обязательное (FR-009); при создании = def.title
  position: { x: number; y: number };
  values: Record<string, JsonValue>;
  ports?: PortDef[];
}

type PortSide = 'in' | 'out';
interface LinkEnd { node: string; port: string; side: PortSide }
type LinkCandidate = { ok: true; replaces?: Edge } | Rejection;
```

## Функции

```ts
// validate.ts
/** Доступность каждого порта нода targetNode для связи с from (FR-019, FR-020). */
function linkCandidates(
  graph: Graph,
  from: LinkEnd,
  targetNode: string,
  registry: Registry,
): { inputs: Record<string, LinkCandidate>; outputs: Record<string, LinkCandidate> };

/** Проверка и нормализация нового имени (FR-009). */
function normalizeNodeName(name: string): { ok: true; name: string } | Rejection;
```

## Отказы (errors.ts)

| Код | Текст (`rejections.*`) |
|---|---|
| `same-side` | «Нельзя соединить вход со входом» / «Нельзя соединить выход с выходом» + «: связь идёт от выхода одного нода ко входу другого.» |
| `empty-name` | «Имя нода не может быть пустым. Введите хотя бы один символ.» |
| `name-too-long` | «Имя нода длиннее 100 символов. Сократите его.» |

## Гарантии (дополняют E1–E9)

- **E10**: `linkCandidates` возвращает запись для **каждого** порта целевого нода
  в порядке портов (`nodePorts`) — состав не зависит от `from` (основа «строки не
  прыгают», FR-020).
- **E11**: если `linkCandidates(...)[side][port].ok`, то соответствующий
  `canConnect` тоже `ok`, и наоборот, для всех портов противоположной стороны.
- **E12**: при `targetNode === from.node` все записи — `same-node`; иначе каждый
  порт той же стороны, что `from`, — `same-side`; остальные проверяются
  `canConnect` (тип, цикл).
- **E13**: `normalizeNodeName` — `trim`; пусто → `empty-name`; > 100 → `name-too-long`;
  иначе `{ ok: true, name: <обрезанное имя> }` (совпадение с названием типа
  допустимо).
- **E14**: у каждого нода любого графа, созданного движком, есть непустое `name`:
  `collapse` ставит экземпляру имя составного нода; `expand` сохраняет `name`
  внутренних нодов.
- **E15**: сообщения о нодах выше по графу (`blocked`) называют нод по `name`.
