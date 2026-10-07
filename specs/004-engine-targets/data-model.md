# Data Model: выполнение workflow на выбранном engine

Типы предметной области (`Graph`, `CompositeDef`, `NodeState`, `JsonValue`) не
меняются — см. [001/data-model.md](../001-dag-workflow-editor/data-model.md). Формат
файлов workflow и выгрузки не меняется (FR-006, US4 #9). Ниже — новые сущности.

## Цель вычисления (`EngineTarget`)

```ts
type EngineTarget = { kind: 'local' } | { kind: 'worker' } | { kind: 'server'; address: string };
```

- `address` — как ввёл пользователь, после нормализации (R9: хост в нижнем регистре, без
  схемы и завершающего `/`). Хост, необязательный порт, необязательный путь: `localhost:8080`,
  `domain.com`, `domain.com/dagflow`. Схема в адресе не хранится; если пользователь её
  ввёл, она переносится в `scheme` записи списка (FR-009).
- Равенство целей: `kind` и `address` (без учёта регистра хоста).

## Сервер в списке недавних (`RecentServer`)

```ts
interface RecentServer {
  address: string;
  scheme?: 'ws' | 'wss'; // способ, с которым подключение удалось в последний раз
}
```

## Настройки engine в браузере (`EngineSettings`)

Хранятся в IndexedDB через `idb-keyval`, ключ `dagflow:engine` — как `dagflow:folder`
(`src/storage/location.ts`). Не попадают в файлы workflow и выгрузку (FR-006).

```ts
interface EngineSettings {
  version: 1;
  target: EngineTarget; // по умолчанию { kind: 'local' }
  recent: RecentServer[]; // 0..5, последний использованный первым (FR-003, FR-004)
}
```

**Правила**:

- Читаются один раз при старте окна; повреждённые или отсутствующие → значения по
  умолчанию без ошибки (принцип III). Проверка — схема Valibot.
- Записываются целиком при каждом изменении цели или списка. Окна одного браузера
  независимы: окно не перечитывает настройки, последняя запись побеждает (FR-006,
  US4 #10).
- Успешное подключение к серверу ставит его первым; при 6-м удаляется последний (FR-004).
- «×» удаляет невыбранный сервер (FR-005); выбранный и локальные строки удалить нельзя.
- `target.kind === 'server'` ⇒ его адрес есть в `recent`.

## Состояние подключения (`ConnectionStatus`)

```ts
type ConnectionStatus =
  | { kind: 'connecting'; awaitingPermission?: boolean }
  | { kind: 'ready'; engine: string; encrypted: boolean }
  | { kind: 'offline'; attempt: number; retryAt: number } // retryAt — время по часам адаптера
  | { kind: 'incompatible'; host: { protocol: number; engine: string } }
  | { kind: 'failed' }; // фоновый поток упал 3 раза за минуту
```

```text
             старт / «Retry now» / таймер / online
                          │
                          ▼
  ┌──────────────► connecting ──welcome (protocol совпал)──► ready
  │                  │      │                                  │
  │  protocol другой │      │ нет связи / 3 с без welcome      │ обрыв
  │                  ▼      ▼                                  ▼
  │          incompatible   offline ◄──────────────────────────┘
  │          (без повторов)    │
  └────────────────────────────┘
                 worker: 3 падения за 60 с ──► failed (без повторов)
```

- `offline`: пауза перед попыткой `n` — `min(500 · 2^(n-1) · (1 ± 0,2), 10 000)` мс:
  разброс до ограничения, пауза не больше 10 с (FR-020, R7). Счётчик сбрасывается
  после `welcome`.
- `connecting` с `awaitingPermission: true` — браузер ждёт ответа пользователя на запрос
  разрешения Local Network Access: таймаут 3 с не идёт, индикатор показывает подсказку
  и «Use local engine» (FR-011, FR-012). Так же при подключении к сохранённой цели на
  старте.
- `incompatible`: приходит из `welcome` с другим `protocol`; закрытие соединения
  хостом после `version-mismatch` не переводит в `offline` (contracts/protocol.md).
- Для «Local» состояния `offline` не бывает. Исключение хоста — это ответ протокола
  `error internal` (уведомление и повторная передача вкладки), а не статус подключения.
- «Use local engine» (FR-022a) из `offline`, `incompatible`, `failed`: цель `local`,
  сохранить, закрыть прежнее подключение и таймеры.

## Пробное подключение (`Trial`)

```ts
interface Trial {
  target: EngineTarget;
  phase: 'probing'; // перебор схем ws/wss (R8)
  awaitingPermission?: boolean; // ждём ответа на запрос Local Network Access
  error?: string; // текст из ui-texts.md, показывается у поля или строки
}
```

- Одна попытка одновременно: новая отменяет прежнюю (FR-007).
- Пока идёт попытка, текущая цель работает как обычно.
- Успех: новая цель становится текущей, вкладки открываются на ней, старое подключение
  закрывается, настройки сохраняются.
- Неудача: `error` у поля или строки; текущая цель и её статус не меняются.

## Срез стора `engine` (Zustand)

```ts
interface EngineSlice {
  target: EngineTarget;
  recent: RecentServer[];
  status: ConnectionStatus;
  trial?: Trial;
  tooLarge: { library: boolean; tabs: Record<string /* tabId */, true> }; // FR-024
}
```

- `nodeStates` (существующий срез) пишет только связка с клиентом протокола
  (`src/store/engine.ts`, бывший `evaluation.ts`).
- «Приглушено» — производное, не хранится: `status.kind !== 'ready'`,
  `tooLarge.library` или `tooLarge.tabs[tabId]` (FR-019, FR-024). Это не новое состояние нода.

## Документ на клиенте (`DocMirror`, внутри `EngineClient`)

| Поле      | Тип               | Смысл                                             |
| --------- | ----------------- | ------------------------------------------------- |
| `doc`     | string            | id вкладки                                        |
| `rev`     | number            | последняя отправленная ревизия                    |
| `graph`   | Graph             | последний отправленный граф (сравнение по ссылке) |
| `pending` | Set&lt;string&gt; | ноды из последнего `pending`                      |

Плюс `composites` — последние отправленные определения. При новом подключении все
зеркала сбрасываются: отправляется полный снимок (R3).

## Документ на хосте (`HostDoc`, внутри `EngineHost`)

| Поле        | Тип       | Смысл                                   |
| ----------- | --------- | --------------------------------------- |
| `evaluator` | Evaluator | вычислитель вкладки                     |
| `rev`       | number    | последняя принятая ревизия              |
| `graph`     | Graph     | для повторного `setGraph` при `library` |

Живёт, пока открыто соединение; закрытие соединения освобождает всё (FR-018).

## Параметры сервера (`ServerOptions`)

| Параметр           | По умолчанию | Правило                                      |
| ------------------ | ------------ | -------------------------------------------- |
| `--port <number>`  | `8080`       | 1–65535, иначе ошибка запуска                |
| `--host <address>` | `127.0.0.1`  | не локальный адрес → предупреждение (FR-030) |
| `--verbose`        | выключен     | строка на каждое сообщение (FR-030a)         |

Локальные адреса: `localhost`, `*.localhost`, `127.0.0.0/8`, `::1`.
