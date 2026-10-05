# Contract: Каталог встроенных нодов (FR-010)

Нотация портов: `имя: тип` (`*` — обязательный, `= x` — значение по умолчанию).
Все ноды — чистые синхронные функции. «Ошибка» означает `NodeError` с указанным
текстом (принцип IV).

## Константы

| id | Название | Входы | Выходы | Поведение |
|---|---|---|---|---|
| `builtin:number` | Число | `value: number = 0` | `value: number` | возвращает значение входа |
| `builtin:text` | Текст | `value: text = ""` | `value: text` | — |
| `builtin:boolean` | Логическое | `value: boolean = false` | `value: boolean` | — |
| `builtin:json` | JSON-значение | `value: any = null` | `value: any` | значение вводится как JSON-текст; некорректный JSON не сохраняется, под полем — подсказка с ошибкой |

## Арифметика

| id | Название | Входы | Выходы | Поведение |
|---|---|---|---|---|
| `builtin:add` | Сложить | `a*: number`, `b*: number` | `result: number` | a + b |
| `builtin:subtract` | Вычесть | `a*`, `b*: number` | `result: number` | a − b |
| `builtin:multiply` | Умножить | `a*`, `b*: number` | `result: number` | a × b |
| `builtin:divide` | Разделить | `a*`, `b*: number` | `result: number` | b = 0 → ошибка «Деление на ноль: задайте ненулевой делитель» |

Результат, не являющийся конечным числом, → ошибка «Результат слишком большой».

## Текст

| id | Название | Входы | Выходы | Поведение |
|---|---|---|---|---|
| `builtin:concat` | Склеить | `a*: text`, `b*: text` | `result: text` | a + b |
| `builtin:text-length` | Длина текста | `text*: text` | `length: number` | число символов |
| `builtin:to-text` | В текст | `value*: any` | `text: text` | строка как есть, иначе компактный JSON |
| `builtin:to-number` | В число | `text*: text` | `value: number` | не число → ошибка «"&lt;text&gt;" не является числом» |

## Сравнение и логика

| id | Название | Входы | Выходы | Поведение |
|---|---|---|---|---|
| `builtin:equals` | Равно | `a*: any`, `b*: any` | `result: boolean` | глубокое сравнение JSON |
| `builtin:greater` | Больше | `a*`, `b*: number` | `result: boolean` | a > b |
| `builtin:less` | Меньше | `a*`, `b*: number` | `result: boolean` | a < b |
| `builtin:and` | И | `a*`, `b*: boolean` | `result: boolean` | — |
| `builtin:or` | Или | `a*`, `b*: boolean` | `result: boolean` | — |
| `builtin:not` | Не | `value*: boolean` | `result: boolean` | — |

## Условный выбор

| id | Название | Входы | Выходы | Поведение |
|---|---|---|---|---|
| `builtin:if` | Если | `condition*: boolean`, `then*: any`, `else*: any` | `result: any` | condition ? then : else |

## Массивы и объекты

| id | Название | Входы | Выходы | Поведение |
|---|---|---|---|---|
| `builtin:array-append` | Добавить в массив | `array: array = []`, `item*: any` | `array: array` | новый массив с элементом в конце |
| `builtin:array-get` | Элемент массива | `array*: any`, `index*: number` | `item: any` | не массив → ошибка «Ожидался массив, получено: &lt;вид&gt;» (FR-005b); индекс вне диапазона или не целый → ошибка |
| `builtin:array-length` | Длина массива | `array*: array` | `length: number` | — |
| `builtin:object-set` | Установить поле | `object: object = {}`, `key*: text`, `value*: any` | `object: object` | новый объект с полем |
| `builtin:object-get` | Поле объекта | `object*: any`, `key*: text` | `value: any` | не объект → ошибка «Ожидался объект, получено: &lt;вид&gt;»; нет поля → ошибка «Поле "&lt;key&gt;" не найдено» |

## Отображение

| id | Название | Входы | Выходы | Поведение |
|---|---|---|---|---|
| `builtin:show` | Показать | `value*: any` | — | крупно отображает значение; большие значения — компактно с раскрытием (FR-007a) |

## Служебные (только внутри составного нода, FR-021a)

| id | Название | Порты | Поведение |
|---|---|---|---|
| `builtin:input` | Вход | `ports` экземпляра становятся **выходами** этого нода внутри и **входами** составного нода снаружи | передаёт значения входов экземпляра внутрь |
| `builtin:output` | Выход | `ports` экземпляра становятся **входами** этого нода внутри и **выходами** составного нода снаружи | передаёт значения наружу |
