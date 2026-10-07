# Contract: протокол редактор ↔ engine, версия 1 (`@dagflow/protocol`)

Один протокол для всех целей: «Local» (тот же поток, in-memory канал), «Worker»
(`postMessage`) и «Server» (WebSocket). Типы `Graph`, `CompositeDef`, `NodeState`,
`JsonValue` — из `@dagflow/engine` без изменений ([data-model.md](../data-model.md)).

## Общие правила

- Сообщение — JSON-объект с дискриминатором `type`, передаётся **строкой** (один JSON =
  одно текстовое сообщение WebSocket / одна строка `postMessage` / одна строка
  in-memory канала). Строка — одинаково во всех каналах: нет общих ссылок, размер
  считается одинаково (R4).
- Канал упорядоченный и дуплексный. Ответа «на запрос» нет: связь ответа с правкой —
  через `rev`.
- Входящие сообщения обе стороны проверяют схемами Valibot до обработки (R5).
- Документ (`doc`) = открытая вкладка редактора; id выбирает клиент (id вкладки).
- Состояние хоста привязано к соединению: документы одного соединения не видны другим,
  закрытое соединение освобождает всю память (FR-018).
- Лимит размера одного сообщения — `MAX_MESSAGE_BYTES = 8 * 1024 * 1024` байт UTF-8
  (FR-024). Клиент проверяет до отправки, хост — при приёме.

## Версии

| Константа          | Где                 | Значение                                    | Правило                                                                                                                                                              |
| ------------------ | ------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROTOCOL_VERSION` | `@dagflow/protocol` | `1`                                         | целое; поднимается вручную при несовместимом изменении сообщений, формы `Graph`/`CompositeDef`/`NodeState` или правил совместимости типов портов (spec, Assumptions) |
| `ENGINE_VERSION`   | `@dagflow/engine`   | `version` из `packages/engine/package.json` | только для показа (FR-013); тест сверяет константу с `package.json` (R6)                                                                                             |

Сверяется только `protocol` (FR-023).

## Сообщения

```ts
type DocId = string;
type Rev = number; // целое ≥ 1, растёт на каждое изменение документа на клиенте

// ── Клиент → хост ─────────────────────────────────────────────
interface Hello {
  type: 'hello';
  protocol: number;
  engine: string;
}
interface SetLibrary {
  type: 'library';
  composites: CompositeDef[];
}
interface OpenDoc {
  type: 'open';
  doc: DocId;
  rev: Rev;
  graph: Graph;
}
interface UpdateDoc {
  type: 'update';
  doc: DocId;
  rev: Rev;
  graph: Graph;
}
interface CloseDoc {
  type: 'close';
  doc: DocId;
}
type ClientMessage = Hello | SetLibrary | OpenDoc | UpdateDoc | CloseDoc;

// ── Хост → клиент ─────────────────────────────────────────────
interface Welcome {
  type: 'welcome';
  protocol: number;
  engine: string;
}
interface Pending {
  type: 'pending';
  doc: DocId;
  rev: Rev;
  nodes: string[];
}
interface States {
  type: 'states';
  doc: DocId;
  rev: Rev;
  states: Record<string, NodeState>;
}
interface ProtocolError {
  type: 'error';
  code: ErrorCode;
  doc?: DocId;
  detail?: string;
}
type HostMessage = Welcome | Pending | States | ProtocolError;

type ErrorCode =
  | 'version-mismatch' // protocol в hello ≠ PROTOCOL_VERSION; хост закрывает соединение
  | 'invalid-message' // не JSON или не прошло схему
  | 'not-ready' // сообщение до hello
  | 'unknown-doc' // update/close по неоткрытому документу
  | 'too-large' // сообщение больше MAX_MESSAGE_BYTES
  | 'internal'; // исключение хоста при обработке
```

- `Pending.nodes` и ключи `States.states` — только ноды **верхнего уровня**; для
  экземпляра составного нода — сводное состояние (`Evaluator.state(id)`).
- `States` — дельта: только изменившиеся ноды. После `open` — все ноды документа.
  Удалённые ноды клиент убирает сам (граф у него).
- `ProtocolError.detail` — техническая деталь для журнала; пользователю показывается
  текст клиента по `code` ([ui-texts.md](./ui-texts.md)).
- `version-mismatch` несёт версию хоста: `detail` = `"<protocol>"` хоста, плюс хост
  перед ошибкой шлёт `welcome` со своими версиями, чтобы клиент показал обе (FR-023).

## Правила хоста (`createEngineHost`, sans-IO)

```ts
interface EngineHost {
  /** Принять одно сообщение (строку). Вернуть сообщения для отправки. */
  receive(raw: string): HostMessage[];
  /** Пересчитать накопленные изменения. Вернуть `states` по документам. */
  tick(): HostMessage[];
  /** Есть ли что пересчитывать — адаптер планирует `tick()` своим таймером. */
  needsTick(): boolean;
  /** Закрыть соединение после этого ответа (version-mismatch). */
  readonly closed: boolean;
}
function createEngineHost(): EngineHost;
```

| Вход            | Условие                                    | Ответ                                                                                                        |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| любая строка    | длина в байтах UTF-8 > `MAX_MESSAGE_BYTES` | `error too-large` без `doc` (строку не разбираем); клиент проверяет лимит до отправки, так что это страховка |
| любая строка    | не JSON / не прошла схему                  | `error invalid-message` (`detail` — путь и ожидание из Valibot)                                              |
| не `hello`      | `hello` ещё не было                        | `error not-ready`                                                                                            |
| `hello`         | `protocol` ≠ `PROTOCOL_VERSION`            | `welcome` + `error version-mismatch`, `closed = true`                                                        |
| `hello`         | версия совпала                             | `welcome`                                                                                                    |
| `library`       | —                                          | сохранить определения; для каждого открытого документа `setGraph` → `pending` (если есть грязные ноды)       |
| `open`          | документ не открыт                         | создать вычислитель, `setGraph` → `pending` со всеми нодами                                                  |
| `open`          | документ открыт                            | как `update` (идемпотентно, удобно при переподключении)                                                      |
| `update`        | документ не открыт                         | `error unknown-doc` с `doc`                                                                                  |
| `open`/`update` | `rev` ≤ последнего принятого               | игнорировать (нет ответа)                                                                                    |
| `update`        | —                                          | `setGraph` → `pending` с изменившимися нодами (может быть пустым — тогда ответа нет)                         |
| `close`         | документ не открыт                         | `error unknown-doc`                                                                                          |
| `close`         | —                                          | удалить вычислитель документа                                                                                |
| любое           | исключение при обработке                   | `error internal` (с `doc`, если известен); соединение продолжает работу                                      |
| `tick()`        | —                                          | для каждого документа с грязными нодами `flush` → один `states` с `rev` последнего принятого изменения       |

Некорректное сообщение не рвёт соединение и не влияет на другие документы (FR-026);
исключение — `version-mismatch`.

## Правила клиента (`createEngineClient`, sans-IO)

```ts
interface EngineClient {
  /** Соединение открыто: вернуть hello. */
  start(): ClientMessage[];
  /** Принять сообщение хоста. */
  receive(raw: string): ClientEvent[];
  /** Снимок редактора изменился: вернуть сообщения для отправки (open/update/close/library). */
  sync(snapshot: {
    tabs: { doc: DocId; graph: Graph }[];
    composites: CompositeDef[];
  }): ClientMessage[];
}
type ClientEvent =
  | { kind: 'ready'; protocol: number; engine: string }
  | { kind: 'incompatible'; host: { protocol: number; engine: string } }
  | { kind: 'pending'; doc: DocId; nodes: string[] }
  | { kind: 'states'; doc: DocId; states: Record<string, NodeState> }
  | { kind: 'too-large'; doc?: DocId }
  | { kind: 'failed'; code: 'invalid-message' | 'internal' | 'too-large'; doc?: DocId } // уведомление
  | { kind: 'resend'; doc: DocId }; // unknown-doc по открытой вкладке: молча open заново (FR-025)
```

- После `welcome`: `library` (все определения), затем `open` для каждой открытой вкладки
  в текущем виде (FR-015, FR-021).
- `sync` сравнивает снимок с последним отправленным по ссылкам (`graph !==`,
  `composites !==`), как сейчас `evaluation.ts`: новая вкладка → `open`, изменённая →
  `update` с `rev + 1`, исчезнувшая → `close`, изменённые определения → `library`.
- Перед отправкой — проверка размера; больше лимита → событие `too-large` по документу
  без отправки (FR-024: ноды вкладки приглушены, новая попытка при следующей правке).
  Слишком большой `library` → `too-large` без `doc`: приглушены все вкладки.
- `states` с `rev` меньше последнего отправленного применяется (это последнее
  известное), но ноды из последнего `pending` остаются `computing`.
- Входящие сообщения проверяются схемой; ошибка схемы → событие `failed` с кодом
  `invalid-message` (уведомление пользователю, деталь — в консоль адаптера).
- Сообщения до `welcome`, кроме `error`, игнорируются.
- `welcome` с `protocol` ≠ `PROTOCOL_VERSION` → событие `incompatible` (версии хоста —
  из `welcome`); последующий `error version-mismatch` и закрытие соединения клиент
  **не** считает обрывом: статус `incompatible`, без повторов (FR-023). Пробная
  попытка в этом случае неудачна с текстом о версии протокола.
- `error unknown-doc` → `resend`, только если вкладка ещё открыта у клиента (есть в
  зеркале); по закрытой вкладке (ответ на `close`) — игнорируется.
- `error invalid-message` / `internal` с `doc` → событие `failed` и повторный `open`
  этой вкладки **один раз на ревизию**: если повтор тоже не удался, следующая попытка —
  при следующей правке вкладки (новый `rev`), без цикла (FR-025). Без `doc` — только
  уведомление.
- `error too-large` от хоста (страховка: клиент проверяет лимит сам) → событие `failed`
  с кодом `too-large` без `doc`: уведомление, деталь — в консоль адаптера.

## Последовательности

Подключение и открытие вкладок:

```text
C: hello   {protocol:1, engine:"0.1.0"}
H: welcome {protocol:1, engine:"0.1.0"}
C: library {composites:[…]}
C: open    {doc:"tab-1", rev:1, graph}
H: pending {doc:"tab-1", rev:1, nodes:[…все ноды]}
H: states  {doc:"tab-1", rev:1, states:{…все ноды}}        ← после tick
```

Правка значения (несколько правок до тика — один пересчёт, FR-016):

```text
C: update  {doc:"tab-1", rev:2, graph}
H: pending {doc:"tab-1", rev:2, nodes:["a","b"]}
C: update  {doc:"tab-1", rev:3, graph}
H: pending {doc:"tab-1", rev:3, nodes:["a","b"]}
H: states  {doc:"tab-1", rev:3, states:{a, b}}
```

Правка составного нода:

```text
C: library {composites:[…]}
H: pending {doc:"tab-1", rev:3, nodes:["inst-1"]}      ← rev — текущая ревизия документа
H: pending {doc:"tab-2", rev:7, nodes:["inst-9"]}
H: states  … по каждому документу
```

Разные версии протокола:

```text
C: hello   {protocol:1, engine:"0.1.0"}
H: welcome {protocol:2, engine:"0.3.0"}
H: error   {code:"version-mismatch", detail:"2"}          → хост закрывает соединение
```

## Адаптеры каналов

| Цель   | Канал                                            | Где                                               | Планирование `tick()`             |
| ------ | ------------------------------------------------ | ------------------------------------------------- | --------------------------------- |
| Local  | in-memory пара, доставка в следующей макрозадаче | `src/engine-link/channels/inline.ts`              | `setTimeout(0)` при `needsTick()` |
| Worker | `postMessage(string)`                            | `src/engine-link/engine-worker.ts`                | `setTimeout(0)` в worker          |
| Server | WebSocket, текстовые кадры                       | `packages/server/src/adapters/{node,bun,deno}.ts` | `setTimeout(0)`                   |

Общий интерфейс канала на стороне клиента:

```ts
interface Channel {
  send(text: string): void;
  close(): void;
  onMessage: (text: string) => void;
  onClose: (reason: 'closed' | 'crashed') => void;
}
```
