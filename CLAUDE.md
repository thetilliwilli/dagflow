# CLAUDE.md

DAG Flow — веб-редактор графов из нодов с реактивной средой выполнения
(TypeScript, React, React Flow, Zustand, Vite). Учебный проект по spec-driven
development на GitHub Spec Kit. Интерфейс и все тексты для пользователя — на русском.

**Язык общения**: отвечать пользователю на русском. По-английски — только термины
и устоявшиеся сочетания (property grid, drag-and-drop, e2e, commit), имена команд,
файлов и кода.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер на http://localhost:5173 |
| `npm test` | unit- и компонентные тесты (Vitest) |
| `npm run test:e2e` | e2e-тесты в Chromium (Playwright) |
| `npm run test:e2e:firefox` | e2e в Firefox (без сценариев выбора рабочей папки) |
| `npm run test:perf` | замеры SC-002/SC-003 на графе из 100 нодов |
| `npm run typecheck` | TypeScript для приложения и отдельно для движка (`tsconfig.engine.json`, без DOM) |
| `npm run lint` | ESLint |
| `npm run build` | проверка типов и production-сборка |

Перед тем как считать работу готовой: `typecheck`, `lint`, `npm test` и `test:e2e` зелёные.

## Устройство

- `src/engine/` — чистый TypeScript без зависимостей от UI, DOM и хранилища
  (это проверяют `tsconfig.engine.json` и правило ESLint). API среды вроде
  `structuredClone` в движке не использовать.
- `src/model/` — форматы файлов, схемы Valibot, импорт; `src/storage/` — рабочая папка /
  OPFS, автосохранение; `src/store/` — Zustand-стор, история, связка с вычислителем;
  `src/ui/` — React-компоненты.
- Тексты для пользователя — только в `src/ui/messages.ts` и `src/engine/errors.ts`.
- Код форматируется Prettier: `npx prettier --write <файлы>`.

## Зависимости

- Перед добавлением или обновлением пакета проверять совместимость: `npm view <пакет> peerDependencies`.
  TypeScript держим на 6.0.x: typescript-eslint пока поддерживает только `<6.1`.
- Каждая новая зависимость (включая dev) обосновывается в таблице plan.md
  (раздел «Ограничения» конституции).

## Тесты

- e2e-хелперы — `tests/e2e/helpers.ts` (`addNode`, `connect`). Ноды на холсте искать по
  содержимому или `data-id`, а не по `nth()`: порядок нодов меняется (например, после
  сворачивания в составной нод). Элементы палитры — через `.palette__item-title`:
  название нода может совпадать с заголовком категории («Текст»).
- e2e со сценариями рабочей папки запускаются через фикстуру `tests/e2e/persistent.ts`:
  Chromium падает при чтении сохранённого дескриптора папки в «инкогнито»-контексте.
- Перед `page.reload()` после правки ждать ~1 с: автосохранение срабатывает через 300 мс.
- WebKit (Safari) в этой среде не запускается (нет системных библиотек) — проверка в Safari
  только вручную.

## Spec Kit

- Принципы проекта — `.specify/memory/constitution.md`; фичи — `specs/NNN-…/`
  (spec, plan, research, data-model, contracts, tasks, quickstart).
- Артефакты — источник истины: если поведение меняется, сначала правится `spec.md`,
  затем plan/tasks, затем код (принцип V конституции).
- Порядок работы над новой фичей:
  1. При конфликте с конституцией — `/speckit-constitution`.
  2. `/speckit-specify` (что и зачем, без технологий) → `/speckit-clarify`.
  3. `/speckit-plan` (стек) → `/speckit-tasks` → `/speckit-analyze`, исправить CRITICAL/HIGH.
  4. `/speckit-implement` по фазам, начиная с MVP.
  5. `/speckit-converge` → реализовать дописанные задачи → повторять до «Converged».
  6. Ручная проверка по `quickstart.md`, `git merge --no-ff` в `master`.
- Изменение готовой фичи: правка её `spec.md` (и plan/research/контрактов при
  необходимости) → `/speckit-analyze` → `/speckit-converge` → `/speckit-implement`.
  **Не перезапускать `/speckit-plan` и `/speckit-tasks` на готовой фиче** —
  `setup-plan.sh` затирает `plan.md` шаблоном.
- Тесты обязательны для бизнес-логики, у каждого acceptance-сценария есть тест (принцип II);
  тесты пишутся до реализации.
- Отклонения от плана во время реализации (другая версия пакета, новый файл, изменённая
  сигнатура) сразу записывать в артефакты: research.md, дерево файлов в plan.md, контракты.
- В markdown-артефактах плейсхолдеры вида `<имя>` писать в обратных кавычках или как
  `&lt;имя&gt;`: иначе предпросмотр принимает их за HTML-теги (`<title>` скрывает весь
  текст после себя).

## Git

- Основная ветка — `master`; фичи — ветки `NNN-имя`, вливаются через `--no-ff`.
- Коммит — после каждого шага Spec Kit и каждой фазы реализации, по команде пользователя.
- Историю git не переписывать (`--amend`, `rebase`, `filter-branch` и т. п.) без явной просьбы.
