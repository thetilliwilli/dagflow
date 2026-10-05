# Contract: Форматы файлов и раскладка хранилища

Все файлы — UTF-8 JSON с отступом 2 пробела (человекочитаемые, принцип III).
У каждого файла есть поля `format` и `version` для будущих миграций. Неизвестная
или более новая версия приводит к понятной ошибке, а не к попытке прочитать файл.

## Раскладка рабочего хранилища

Одинакова для папки пользователя и для OPFS:

```text
<root>/
├── workspace.json                     # порядок workflow, вкладки
├── workflows/
│   └── <workflow-id>.workflow.json    # один файл на workflow
└── composites/
    └── <composite-id>.composite.json  # один файл на определение составного нода
```

- Имена файлов — по id, а не по имени: переименование workflow не переименовывает
  файл.
- Удаление workflow или составного нода удаляет его файл.
- Посторонние файлы в папке игнорируются.
- Повреждённый файл не мешает остальным: workflow помечается как недоступный
  (edge case спеки).

### workspace.json

```json
{
  "format": "dagflow-workspace",
  "version": 1,
  "workflowOrder": ["3f1c…", "a9e2…"],
  "tabs": [
    { "id": "t1", "kind": "workflow", "targetId": "3f1c…", "viewport": { "x": 0, "y": 0, "zoom": 1 } }
  ],
  "activeTabId": "t1"
}
```

### <id>.workflow.json

```json
{
  "format": "dagflow-workflow",
  "version": 1,
  "id": "3f1c…",
  "name": "Пример",
  "createdAt": "2026-10-05T12:00:00.000Z",
  "updatedAt": "2026-10-05T12:05:00.000Z",
  "graph": {
    "nodes": [
      { "id": "n1", "type": "builtin:number", "position": { "x": 0, "y": 0 }, "values": { "value": 2 } },
      { "id": "n2", "type": "builtin:add", "position": { "x": 200, "y": 0 }, "values": { "b": 3 } },
      { "id": "n3", "type": "builtin:show", "position": { "x": 400, "y": 0 }, "values": {} }
    ],
    "edges": [
      { "id": "e1", "source": { "node": "n1", "port": "value" }, "target": { "node": "n2", "port": "a" } },
      { "id": "e2", "source": { "node": "n2", "port": "result" }, "target": { "node": "n3", "port": "value" } }
    ]
  }
}
```

### <id>.composite.json

```json
{
  "format": "dagflow-composite",
  "version": 1,
  "id": "c7d0…",
  "name": "Удвоенная сумма",
  "description": "",
  "createdAt": "…",
  "updatedAt": "…",
  "graph": {
    "nodes": [
      { "id": "i1", "type": "builtin:input", "position": { "x": 0, "y": 0 }, "values": {},
        "ports": [ { "name": "a", "type": "number", "required": true },
                   { "name": "b", "type": "number", "required": true } ] },
      { "id": "o1", "type": "builtin:output", "position": { "x": 600, "y": 0 }, "values": {},
        "ports": [ { "name": "result", "type": "number", "required": true } ] }
    ],
    "edges": []
  }
}
```

## Файл выгрузки (экспорт/импорт, FR-029)

Расширение `.dagflow.json`. Файл самодостаточен: содержит workflow и все
транзитивно используемые определения составных нодов.

```json
{
  "format": "dagflow-export",
  "version": 1,
  "exportedAt": "2026-10-05T12:10:00.000Z",
  "workflow": { "id": "…", "name": "…", "createdAt": "…", "updatedAt": "…", "graph": { "nodes": [], "edges": [] } },
  "composites": [ { "id": "…", "name": "…", "description": "", "createdAt": "…", "updatedAt": "…", "graph": { "nodes": [], "edges": [] } } ]
}
```

### Алгоритм импорта

1. Разобрать JSON. Ошибка → «Файл не является корректным JSON».
2. Проверить Valibot-схемой. Ошибка → «Файл не похож на выгрузку workflow:
   <путь к полю>».
3. Проверить `format`/`version`. Ошибка → «Файл создан более новой версией
   редактора» или «Неизвестный формат файла».
4. Семантическая проверка (`validateGraph` для workflow и каждого определения,
   рекурсия определений). Неизвестные типы нодов перечисляются в сообщении (edge
   case).
5. Слияние определений (FR-029a): для каждого определения из файла
   - есть определение с тем же каноническим содержимым → переиспользовать его id;
   - иначе есть определение с тем же именем → новое id, имя «<имя> (N)» с
     минимальным свободным N ≥ 2, уведомление;
   - иначе добавить как есть (с новым id, если id занят).
   Ссылки `composite:<id>` в workflow и во вложенных определениях переписываются.
6. Workflow получает новый id (чтобы не перезаписать существующий) и добавляется в
   список. Он открывается в новой вкладке.

Шаги 1–4 ничего не меняют. Изменения применяются только после успеха всех
проверок (FR-030).
