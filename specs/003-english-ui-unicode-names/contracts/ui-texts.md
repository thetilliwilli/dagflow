# Contract: тексты интерфейса на английском

Источник истины для формулировок (FR-001 – FR-005). Тесты проверяют их дословно.
`<x>` — подставляемое значение; пользовательские имена вставляются как есть в
типографских кавычках `“…”`.

## Правила стиля

- Кнопки и заголовки — sentence case без точки: «Add port», «Delete link».
- Сообщения — полные предложения с точкой; ошибка называет причину и действие
  (принцип IV).
- Числа в тексте — после двоеточия, без склонения: `Links removed: 3`, `[items: 3]` (FR-005).
- Термины: node, workflow, composite node, port, input, output, link, palette,
  properties, working folder, browser storage.

## Встроенные ноды и категории (FR-002)

| id | Название | Описание |
|---|---|---|
| `builtin:number` | Number | Sets a number manually. |
| `builtin:text` | Text | Sets text manually. |
| `builtin:boolean` | Boolean | Sets a boolean: yes or no. |
| `builtin:json` | JSON value | Sets any JSON value: array, object, null, etc. |
| `builtin:add` | Add | a + b |
| `builtin:subtract` | Subtract | a − b |
| `builtin:multiply` | Multiply | a × b |
| `builtin:divide` | Divide | a ÷ b; the divisor must not be zero |
| `builtin:concat` | Concatenate | Joins two texts: a + b. |
| `builtin:text-length` | Text length | Number of characters in the text. |
| `builtin:to-text` | To text | Turns any value into text: text as is, everything else as JSON. |
| `builtin:to-number` | To number | Turns text into a number. |
| `builtin:equals` | Equals | Checks that a and b are equal (including nested arrays and objects). |
| `builtin:greater` | Greater than | a > b |
| `builtin:less` | Less than | a < b |
| `builtin:and` | And | True if both values are true. |
| `builtin:or` | Or | True if at least one value is true. |
| `builtin:not` | Not | Inverts a boolean. |
| `builtin:if` | If | Picks “then” if the condition is true, otherwise “else”. |
| `builtin:array-append` | Append to array | A new array with the item added at the end. |
| `builtin:array-get` | Array item | Array item by index (from zero). |
| `builtin:array-length` | Array length | Number of items in the array. |
| `builtin:object-set` | Set field | A new object with the field set. |
| `builtin:object-get` | Object field | Value of an object field by name. |
| `builtin:show` | Show | Shows the value in large type. |
| `builtin:input` | Input | Ports of this node become inputs of the composite node. Inside, it gives default values. |
| `builtin:output` | Output | Ports of this node become outputs of the composite node. |
| `builtin:passthrough` | Composite port | Passes values across the composite node boundary. |

Категории: Constants, Math, Text, Comparison & logic, Condition, Arrays & objects,
Display; составные — My composite nodes; интерфейс составного нода — Composite
interface. Описание составного нода по умолчанию — «Composite node».

## Типы, состояния, значения

| Тип | Полное название |
|---|---|
| number / text / boolean / array / object / any | number / text / boolean / array / object / any |

Краткие обозначения (num, str, bool, arr, obj, any) не меняются.

| Состояние | Подпись |
|---|---|
| ok | computed |
| computing | computing |
| waiting | waiting for inputs |
| error | error |
| blocked | not computed: upstream problem |

Виды значений (`describeKind`): array, number, text, boolean, object, null.
Компактный вид: `[items: 3]`, `{fields: 2}`. Раскрытие: «show», «hide».

## Сообщения вычисления (errors.ts)

| Где | Текст |
|---|---|
| незаполненный вход | Fill in input “<port>”. |
| выше по графу ждут | Node “<name>” upstream is waiting for inputs. |
| выше по графу ошибка | Node “<name>” upstream failed. |
| нет значения на выходе | No value on output “<port>” of node “<name>”. |
| неизвестный тип | Unknown node type: <type>. |
| внутренняя ошибка | Internal error in node “<title>”. |
| деление на ноль | Division by zero: set a non-zero divisor. |
| переполнение | The result is too large. |
| не массив / не объект | Expected an array, got: <kind>. / Expected an object, got: <kind>. |
| индекс не целый | The index must be an integer, got: <index>. |
| индекс вне диапазона | Index <i> is out of range: array length is <n>. |
| нет поля | Field “<key>” not found. |
| не число | “<text>” is not a number. |

## Отказы (errors.ts)

| Код | Текст |
|---|---|
| `cycle` | Cannot link: this connection would create a cycle, and the graph must stay acyclic. |
| `same-node` | Cannot link a node to itself. |
| `same-side` (вход) | Cannot link an input to an input: a link goes from an output of one node to an input of another. |
| `same-side` (выход) | Cannot link an output to an output: a link goes from an output of one node to an input of another. |
| `type-mismatch` | Incompatible types: <from> → <to>. Link ports of the same type or use a port of type “any”. |
| `unknown-port` | Port “<port>” not found. |
| `unknown-type` | Unknown node type: <type>. |
| `input-occupied` | Input “<port>” has more than one link. |
| `composite-recursion` | Cannot put composite node “<name>” inside itself (directly or through other composite nodes). |
| `io-node-outside-composite` | Input and Output nodes can only be added inside a composite node. |
| `empty-name` | The node name cannot be empty. Enter at least one character. |
| порт без имени | The port name cannot be empty. |
| порт-дубль | Port “<name>” already exists on another <Input/Output> node. Port names must be unique. |
| свернуть пустое | Select at least one node. |
| свернуть Input/Output | Input and Output nodes cannot be collapsed into a composite node. |

Отказ `name-too-long` удаляется вместе с ограничением длины (FR-007).

## Импорт и хранение

| Где | Текст |
|---|---|
| не JSON | The file is not valid JSON. |
| чужой формат | Unknown file format. |
| новая версия | The file was created by a newer version of the editor. |
| ошибка схемы | The file does not look like a workflow export: <path>. |
| неизвестные типы | The file contains unknown node types: <types>. |
| граф некорректен | The graph in the file is invalid: <reason>. |
| рекурсия при импорте | Composite node “<name>” in the file contains itself; a composite node cannot be inside itself (directly or through others). |
| конфликт имени | Composite node “<name>” already exists in the palette with different content — added as “<renamed>”. |
| путь «корень» | (root) |
| файл повреждён | The file is damaged: <detail> (invalid JSON — «invalid JSON»). |
| некорректный файл | Invalid <workflow / composite node / workspace> file: <path>. |
| нет записи | The browser does not support writing files. |
| хранилище не пусто | The target storage is not empty. |
| не удалось записать | Could not write the file. |
| папка вне хранилища браузера | The folder is outside browser storage. |

## Интерфейс (messages.ts)

| Ключ | Текст |
|---|---|
| palette / paletteHint | Palette / Click a node or drag it onto the canvas. |
| invalidJson | Invalid JSON: <reason> |
| valueTypeMismatch | The value does not match the port type “<type>”. |
| closeNotification | Close notification |
| nodeNotFound | Node “<id>” not found. |
| compositeNotFound / ioNodeNotFound / portNotFound | Composite node not found. / Input/Output node not found. / Port “<port>” not found. |
| invalidName | The name cannot be empty. |
| noOpenTab | No open tab. |
| renderFailed / reloadTab | Could not display the tab. Your data is safe — try reloading the tab. / Reload tab |
| storage: folder / browser / loading | Folder: <name> / Data is stored in the browser / Loading… |
| chooseFolder / changeFolder | Choose working folder / Change folder |
| firstRunHint | Choose a working folder on your disk — all your work will be saved there automatically. |
| browserReminder | Data is stored in the browser. To move your work to another computer, export workflows to a file. |
| copyToEmpty | Folder “<folder>” is empty. Move your current data there? |
| addFromBrowser | Folder “<folder>” already has data. [Workflows from the previous storage that are not in the folder: <n>.] [Different versions (will be added as “(from browser)” copies): <n>.] Add them to the folder? |
| move / dontMove / add / dontAdd / later / gotIt | Move / Don’t move / Add / Don’t add / Later / Got it |
| accessTitle / accessText | Restore access to the working folder / The browser asks you to confirm access to folder “<folder>” again. |
| restoreAccess / workInBrowser | Restore access / Work in the browser |
| workInBrowserNote | The browser keeps a separate set of data; the folder data stays untouched. |
| folderLost | Working folder “<folder>” is unavailable. Work continues and is saved in the browser. |
| saveFailed | Could not save changes: <reason> |
| copyName | <name> (from browser) |
| none / unavailable | Saving unavailable / Saving unavailable: the browser denied access to storage (<reason>). The editor works, but changes will be lost when you close it — export workflows to a file. |
| unavailableBanner | Saving unavailable: changes will be lost when you close the page. Export workflows to a file to keep your work. |
| operationFailed | Storage operation failed: <reason> |
| accessDenied | Access not granted: the browser did not allow working with folder “<folder>”. Try again or work in the browser. |
| storage region | Storage |
| workflow list | Workflows / Create workflow / Open “<name>” / Rename “<name>” / Duplicate “<name>” / Delete “<name>” / Workflow name |
| delete dialog | Delete workflow? / Workflow “<name>” will be deleted permanently. / Delete / Cancel |
| unavailable | Unavailable: <id> |
| tabs | Close tab “<name>” / Open a workflow from the list or create a new one |
| export/import | Export to file / Import from file / Could not load the file / Close |
| default names | New workflow / <name> (copy) / Composite node: <name> |
| composite | Collapse into composite node / Composite node name / Collapse / Rename composite node / Rename / Open composite node “<name>” / Open / Expand / Expand “<name>” / Rename composite node “<name>” / Delete composite node “<name>” / Delete composite node? |
| composite remove text | Instances in use: <n>. All instances of “<name>” will be removed with their links. / “<name>” will be removed from the palette. |
| composite misc | Name “<name>” is already taken by another composite node / Composite node ports changed. Links removed: <n> / Ports / Add port / Port name / Port type / Remove port “<name>” / Default: <port> |
| defaultHint | Default value: used when an instance input is not connected or filled; inside the composite node tab — for debugging |
| defaultTypeMismatch | The default value of port “<port>” does not match its type |
| unknownNode / unknownType | Unknown node / Type “<type>” not found: the composite node was deleted or its file is damaged. Delete the node or import the definition from a file. |
| history | Undo / Redo / Graph minimap |
| windows | Close / Menu / Workflows & storage / Workflows & storage: there is a message about data storage / github / Categories / No composite nodes yet: select nodes on the canvas and collapse them into a composite node. |
| properties | Properties / Inputs / Outputs / No inputs / No outputs / Link “<port>” / ← <node>.<port> / Pick a node and a property to link / Properties: <node> / <port> (<type>) / Node name |
| palette tooltip | Inputs: <list>. Outputs: <list>. |
| edges | +<n> more / Links: <A> → <B> / <out>→<in> / Delete link “<link>” |
