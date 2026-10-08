# Contract: тексты интерфейса и сервера (фича 004)

Источник истины для формулировок. Тесты проверяют их дословно (SC-006, принцип IV).
Стиль — как в [003/contracts/ui-texts.md](../../003-english-ui-unicode-names/contracts/ui-texts.md):
кнопки без точки, сообщения — полные предложения, числа после двоеточия.
`` `<x>` `` — подставляемое значение.

Тексты редактора — в `src/ui/messages.ts` (`engineMessages`); тексты сервера — в
`packages/server/src/messages.ts`. Хост протокола текстов не содержит: только коды
ошибок ([protocol.md](./protocol.md)).

## Раздел «Engine» в левой панели (FR-003 – FR-005, FR-008)

| Ключ                      | Текст                                               |
| ------------------------- | --------------------------------------------------- |
| `section`                 | Engine                                              |
| `localRow`                | This tab                                            |
| `workerRow`               | This browser                                        |
| `kindLocal`               | Local                                               |
| `kindWorker`              | Worker                                              |
| `kindServer`              | Server                                              |
| `addressPlaceholder`      | Server address, e.g. localhost:8080                 |
| `connect`                 | Connect                                             |
| `connecting`              | Connecting…                                         |
| `remove` (aria-label «×») | Remove `<address>` from the list                    |
| `invalidAddress`          | Enter a server address, for example localhost:8080. |
| строка выбранного сервера, версии engine разные (US6 #3) | engine `<server>` (editor `<editor>`) — подпись под адресом |

## Индикатор в верхней панели (FR-013, FR-013a, FR-014)

Справа от состояния, в той же строке, — объём обмена с текущей целью (FR-013a):
`tx <переданные> / rx <принятые>`, например `tx 0 B / rx 0 B`, `tx 12.4 KB / rx 3.1 MB`.
Единицы: `B` (целое), `KB`, `MB`, `GB` (одна цифра после точки, 1 KB = 1024 B).

| Состояние                                 | Текст                                                          |
| ----------------------------------------- | -------------------------------------------------------------- |
| Local, готов                              | ● Local                                                        |
| Worker, готов                             | ● Worker                                                       |
| Server, готов, версии engine совпадают    | ● Server · `<address>` · engine `<version>`                    |
| Server, готов, версии engine разные       | ● Server · `<address>` · engine `<server>` (editor `<editor>`) |
| Server без шифрования, не локальный адрес | … · not encrypted (добавляется к строке выше)                  |
| Подключение                               | Connecting…                                                    |
| Нет связи                                 | ◌ Offline — retrying in `<n>` s                                |
| Кнопки                                    | Retry now · Use local engine                                   |
| Другая версия протокола                   | Protocol version differs (server `<x>`, editor `<y>`)          |
| Сбой фонового потока (3 за минуту)        | The background engine keeps failing.                           |
| Кнопка (другая версия, сбой потока)       | Use local engine                                               |
| aria-label индикатора                     | Engine: `<текст состояния>`. Open engine settings.             |

Цвет точки индикатора и выбранной строки (FR-014) — переменные CSS:
`--engine-ready` (зелёный) — готов; `--engine-pending` (жёлтый) — подключение;
`--engine-offline` (серый) — нет связи; `--engine-problem` (красный) — другая версия
протокола или сбой фонового потока. Состояние всегда дублируется текстом.

## Ошибки подключения у поля или строки (FR-007, FR-011, FR-012, FR-023)

| Ситуация                                                                             | Текст                                                                                                                  |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Нет ответа / отказ / не engine / нет `welcome` за 3 с                                | Could not connect to `<address>`. Check that the server is running and the address is correct.                         |
| Браузер запретил подключение без шифрования (страница по https, адрес не локальный)  | The browser blocks unencrypted connections from this page. The server at `<address>` needs an encrypted (wss) address. |
| Доступ к локальной сети запрещён в настройках сайта (Local Network Access, `denied`) | The browser blocks access to the local network for this page. Allow it in the site settings and try again.             |
| Ждём ответа на запрос разрешения браузера (рядом с «Connecting…»)                    | Allow local network access in the browser prompt.                                                                      |
| Другая версия протокола (ручное подключение)                                         | The server uses a different protocol version (server `<x>`, editor `<y>`). Update the server or the editor.            |
| Фоновый поток недоступен в браузере                                                  | This browser cannot run the engine in the background.                                                                  |

## Ноды и вкладки (FR-019, FR-024)

| Ключ                             | Текст                                                    |
| -------------------------------- | -------------------------------------------------------- |
| `staleValue` (окно «Properties») | Last known value — engine offline                        |
| `tooLarge` (на вкладке)          | This workflow is too large for the server (limit: 8 MB). |

## Уведомления (FR-025, FR-027)

| Ситуация                               | Вид     | Текст                                                |
| -------------------------------------- | ------- | ---------------------------------------------------- |
| `invalid-message` / `internal` от цели | warning | The engine could not process the workflow. Retrying. |
| `too-large` от цели без вкладки (страховка) | warning | The engine could not process the workflow. Retrying. |
| Фоновый поток упал и перезапущен       | warning | The engine restarted after a failure.                |

## Сервер (FR-030, FR-030a; `packages/server/src/messages.ts`)

| Ситуация                           | Текст                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Запуск                             | DAG Flow engine `<version>` is listening on `<host>:<port>`                                  |
| Запуск, вторая строка              | Protocol version: `<n>`. Press Ctrl+C to stop.                                               |
| Адрес для сети                     | The engine has no authentication. Anyone who can reach this address can run workflows on it. |
| Порт занят                         | Port `<port>` is already in use. Start the server with another port: --port &lt;number&gt;. (`&lt;number&gt;` — буквально) |
| Неверный порт                      | Invalid port “`<value>`”. Use a number from 1 to 65535.                                      |
| Неизвестный параметр               | Unknown option “`<name>`”. Options: --port `<number>`, --host `<address>`, --verbose.        |
| `--host` без значения | Option --host needs an address, for example --host 127.0.0.1. |
| Адрес недоступен для прослушивания | Cannot listen on `<host>`. Check the --host address.                                         |
| Подключение                        | Connected: `<client>` (connections: `<n>`)                                                   |
| Отключение                         | Disconnected: `<client>` (connections: `<n>`)                                                |
| Ошибка обмена                      | Error from `<client>`: `<code>`                                                              |
| `--verbose`, сообщение             | `<client>` `<in\|out>` `<type>` `<doc\|->` `<bytes>` B                                       |

В выводе сервера никогда нет графа, определений составных нодов и значений нодов
(FR-030a) — тест проверяет вывод на отсутствие значений из тестового workflow.
