# DAG Flow

Учебный проект по **spec-driven development** (GitHub Spec Kit + Claude Code):
веб-редактор графов из нодов с реактивной средой выполнения.

Пользователь собирает граф на холсте, соединяя выходы одних нодов со входами других.
Граф всегда реактивен: любое изменение сразу пересчитывает зависимые ноды, и новые
значения видны в реальном времени. Группы нодов можно сворачивать в переиспользуемые
составные ноды. Работа автоматически сохраняется в рабочую папку на диске (Chrome, Edge)
или во внутреннее хранилище браузера; workflow можно выгружать в файл и загружать.

**Попробовать онлайн:** https://thetilliwilli.github.io/dagflow/ — собирается из `master`
и публикуется на GitHub Pages автоматически.

## Быстрый старт

Требуется Node.js 24 LTS.

```bash
npm install
npm run dev          # редактор на http://localhost:5173
```

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер |
| `npm run build` | проверка типов и production-сборка в `dist/` |
| `npm test` | unit- и компонентные тесты (Vitest) |
| `npm run test:e2e` | e2e-тесты (Playwright, Chromium); перед первым запуском: `npx playwright install chromium` |
| `npm run test:perf` | замеры критериев SC-002/SC-003 на графе из 100 нодов |
| `npm run typecheck` | TypeScript для приложения и отдельно для движка (без DOM) |
| `npm run lint` | ESLint (в том числе запрет импортов UI в движке) |

## Устройство

```text
src/
├── engine/    # чистый TypeScript: типы, встроенные ноды, проверки, составные ноды, реактивный вычислитель
├── model/     # форматы файлов, Valibot-схемы, импорт и слияние
├── storage/   # рабочая папка (File System Access API) / OPFS, автосохранение
├── store/     # Zustand: workflow, вкладки, история отмены, связка с вычислителем, хранение
└── ui/        # React + React Flow
```

Движок не зависит от браузера (это проверяет отдельный `tsconfig.engine.json`),
поэтому позже его можно будет запускать на сервере.

## Спецификация

Весь путь от идеи до кода — в [`specs/001-dag-workflow-editor/`](specs/001-dag-workflow-editor/):

- [spec.md](specs/001-dag-workflow-editor/spec.md) — что и зачем (user stories, требования, критерии успеха)
- [plan.md](specs/001-dag-workflow-editor/plan.md) — стек, структура, проверка по конституции
- [research.md](specs/001-dag-workflow-editor/research.md) — технические решения и их обоснования
- [data-model.md](specs/001-dag-workflow-editor/data-model.md), [contracts/](specs/001-dag-workflow-editor/contracts/) — модель данных и контракты
- [tasks.md](specs/001-dag-workflow-editor/tasks.md) — задачи реализации
- [quickstart.md](specs/001-dag-workflow-editor/quickstart.md) — сценарии ручной проверки

Принципы проекта — в [конституции](.specify/memory/constitution.md). Как пользоваться
Spec Kit — в [GUIDE-RU.md](GUIDE-RU.md).
