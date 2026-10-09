# Протокол v1: схема сообщений (черновик, 2026-10-07)

## Общие правила

- Сообщение — JSON-объект с полем-дискриминатором `type`. Без JSON-RPC: команды
  не требуют ответа «на запрос», связь ответа с изменением — через `rev`.
- Канал упорядоченный и дуплексный (in-memory / postMessage / WebSocket).
  WebSocket: одно текстовое сообщение = один JSON. postMessage / in-memory — объект.
- Все данные — только `JsonValue` (тот же тип, что в engine).
- Входящие сообщения на обеих сторонах проверяются схемами Valibot до обработки.
- Состояние хоста привязано к соединению: документы одного соединения не видны
  другим; закрыто соединение — память освобождена (принцип III).

## Типы (TypeScript)

```ts
type DocId = string;     // выбирает клиент; сейчас = id вкладки
type Rev = number;       // целое ≥ 1, растёт на каждое изменение документа

// ── Клиент → хост ────────────────────────────────────────────
interface Hello        { type: 'hello'; protocol: 1; engine: string }
interface SetLibrary   { type: 'library'; composites: CompositeDef[] }
interface OpenDoc      { type: 'open'; doc: DocId; rev: Rev; graph: Graph }
interface UpdateDoc    { type: 'update'; doc: DocId; rev: Rev; graph: Graph }
interface CloseDoc     { type: 'close'; doc: DocId }

type ClientMessage = Hello | SetLibrary | OpenDoc | UpdateDoc | CloseDoc;

// ── Хост → клиент ────────────────────────────────────────────
interface Welcome      { type: 'welcome'; protocol: 1; engine: string }
interface Pending      { type: 'pending'; doc: DocId; rev: Rev; nodes: string[] }
interface States       { type: 'states'; doc: DocId; rev: Rev; states: Record<string, NodeState> }
interface ProtocolError {
  type: 'error';
  code: ErrorCode;
  doc?: DocId;
  /** Техническая деталь для журнала; пользователю показывается текст клиента по code. */
  detail?: string;
}

type ErrorCode =
  | 'version-mismatch'  // разные protocol/engine — соединение закрывается
  | 'invalid-message'   // не JSON / не прошло схему
  | 'not-ready'         // команда до hello
  | 'unknown-doc'       // update/close по неоткрытому документу
  | 'too-large'         // сообщение больше лимита
  | 'internal';         // непредвиденный сбой хоста

type HostMessage = Welcome | Pending | States | ProtocolError;
```

`Graph`, `CompositeDef`, `NodeState` — типы engine без изменений.

## Почему так

| Решение | Причина |
|---|---|
| `library` отдельно от документов | Составные ноды общие для всех вкладок. Правка определения — одно сообщение, хост пересчитывает затронутые документы (как сейчас `entry.composites !== state.composites`). Нет дублирования определений в каждом `update`. |
| Нет `setValue` | Стор его не использует: правка значения = новый граф, `setGraph` находит изменения по сигнатурам. Для экземпляров составных нодов `setValue` вообще не работает (их id исчезают при разворачивании). Вернём, если замеры SC-003 потребуют. |
| `open` и `update` отдельно | `update` по неоткрытому документу — явная ошибка клиента (`unknown-doc`), а не тихое создание. |
| `states` — только ноды верхнего уровня, дельта | Как сейчас в `evaluation.ts`: `state(id)` для экземпляра — сводное состояние. Удалённые ноды клиент убирает сам: граф у него. |
| Ошибки — коды, тексты на клиенте | Тексты для пользователя живут в `src/ui/messages.ts` (CLAUDE.md). Хост может быть другой версии сборки, но код стабилен. |
| `NodeState.message` — текст от engine | Ошибки нодов генерирует engine (`errors.ts`); версии engine у клиента и хоста совпадают (проверка в hello), так что тексты совпадут. |
| Без ping на уровне протокола | Браузерный WebSocket не шлёт ping-кадры, но обрыв виден по `close`. `ws` на сервере пингует сам. Добавим, если появятся «зависшие» соединения. |

## Последовательности

### Подключение и открытие вкладок
```
C: hello {protocol:1, engine:"0.2.0"}
H: welcome {protocol:1, engine:"0.2.0"}
C: library {composites:[...]}
C: open {doc:"tab-1", rev:1, graph}
H: pending {doc:"tab-1", rev:1, nodes:[все ноды]}
H: states  {doc:"tab-1", rev:1, states:{...все ноды}}      ← после tick
```

### Правка значения (тянем слайдер)
```
C: update {doc:"tab-1", rev:2, graph}
H: pending {doc:"tab-1", rev:2, nodes:["a","b"]}
C: update {doc:"tab-1", rev:3, graph}
H: pending {doc:"tab-1", rev:3, nodes:["a","b"]}
H: states  {doc:"tab-1", rev:3, states:{a, b}}             ← один tick на rev 2–3
```

### Правка составного нода
```
C: library {composites:[...]}       ← хост пересчитывает все документы, где он используется
H: pending {doc:"tab-1", rev:3, nodes:["inst-1"]}
H: pending {doc:"tab-2", rev:7, nodes:["inst-9"]}
H: states  ... по каждому документу
```
`rev` в ответе на `library` — текущая ревизия документа (сама библиотека ревизий не имеет).

### Несовпадение версий
```
C: hello {protocol:1, engine:"0.2.0"}
H: error {code:"version-mismatch", detail:"host engine 0.3.0"}   → хост закрывает соединение
```

## Правила хоста (машина состояний, sans-IO)

- `receive(msg) → HostMessage[]`, `tick() → HostMessage[]`, `needsTick(): boolean`.
  Адаптер вызывает `tick()` по своему таймеру, когда `needsTick()`.
- До `hello` любое другое сообщение → `not-ready`.
- `open` для уже открытого документа = `update` (идемпотентно — удобно при
  переподключении).
- Сообщение с `rev` не больше текущего для документа — игнорируется (защита от
  повторов).
- Невалидное сообщение не рвёт соединение (кроме `version-mismatch`): ответ
  `invalid-message`, остальная работа продолжается (принцип IV).

## Правила клиента

- Срез `nodeStates` пишет только клиент протокола.
- `states` с `rev` меньше последнего отправленного всё равно применяется (это
  последнее, что известно), но ноды из последнего `pending` остаются `computing`.
- In-memory канал делает JSON-копию сообщения (`JSON.parse(JSON.stringify(...))`),
  чтобы поведение совпадало с сетью: никаких общих ссылок, только JSON-данные. Это
  код адаптера браузера, не ядра.

## Где живут схемы

- Valibot-схемы `Graph`, `CompositeDef`, `NodeState` сейчас в `src/model/schemas.ts`
  (форматы файлов). Переносятся в `@dagflow/protocol`; `src/model` импортирует их
  оттуда и добавляет свои обёртки файлов.
- Engine от Valibot не зависит.

## Открытые вопросы

1. Лимит размера сообщения (`too-large`): предложение — 8 МБ (ws по умолчанию 100 МБ).
2. `NodeState.inputs` дублирует данные (входы = выходы соседей). Сейчас нужен окну
   «Properties». Оставить как есть; оптимизировать по замерам.
3. Номер версии engine: из `package.json` пакета `@dagflow/engine` при сборке.
