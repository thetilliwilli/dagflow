# Как это сделано у других (2026-10-10)

Проверка модели по зрелым системам. Для каждой: модель, что берём, источник.

| Система | Модель | Что берём или учитываем |
|---|---|---|
| **TouchDesigner** | Pull-система: оператор «cook»-ится только когда кто-то запросил его данные (нод ниже, viewer, export, явный `cook()`). Изменение параметра лишь помечает нод грязным. Каждый кадр рассматриваются ноды с видимыми viewers и ноды, питающие вывод. | Ленивые данные с политикой «кого тянуть» снаружи ядра. Риск: на форумах типичная жалоба «логика не обновляется», потому что никто не запросил cook. Отсюда умолчание «тянуть всё». |
| **Unreal Blueprints** | Pure-ноды (без exec-пинов) пересчитываются при каждом чтении выхода, кэша нет: один pure-нод на три пина считается трижды. Impure исполняются по exec. Latent-ноды (Delay) приостанавливают нить и возобновляют позже; одновременно одна latent-операция на нод. Циклы по exec естественны. | Разделение pure / exec / latent и интуиция пользователя. Берём с мемоизацией pure-нодов, которой в Unreal нет, и с очередью событий вместо стека. |
| **Rete.js v2** | `DataflowEngine`: нод реализует `data(inputs)`, `engine.fetch(id)` обходит предков (pull). `ControlFlowEngine`: нод реализует `execute(input, forward)`. Гибрид: порты с именем `exec` для управления, остальные для данных; из `execute` можно `fetchInputs`. | Прямое подтверждение двухслойной схемы. Rete тянет данные асинхронно: значит, асинхронный pull возможен, при наличии поколений. |
| **Vuo** | Один вид кабеля: событие, при нём могут быть данные. Правила: событие идёт только вперёд; события не обгоняют друг друга; событие может разделиться; при схождении нод ждёт все части и исполняется один раз; event walls и doors блокируют событие внутри нода; событие проходит по кабелю не больше одного раза, иначе ошибка бесконечной петли. Feedback loop через Hold Value с event wall. | Идентичность события (нужен `rootId`); альтернативная семантика схождения «один раз»; разрыв цикла не задержкой по времени, а «стеной». |
| **Flyde** | Ноды на TypeScript: `run(inputs, outputs, adv)`, выходы это Subject с `.next`, `adv.state`, `onCleanup`. Входы `queued` и `sticky`; `reactive inputs` перезапускают нод во время работы; `completion outputs` для явного завершения; вход Trigger; нод ждёт все обязательные входы. | Доказательство из практики, что единая сигнальная модель требует «семь ручек». Удобный паттерн записи нода. |
| **Ventuz** | Bindings (данные) с валидацией в начале каждого кадра и отсечением по равенству (`Generate()` возвращает true только при реальном изменении). Events и Methods (сигналы). Цикл по bindings только через Loop Breaker с задержкой в один кадр, иначе BindError. Глобальные часы 60 Гц. | Два вида связей; цикл через явный нод задержки; отсечение по равенству. Отличие: у нас нет сердцебиения, время двигают события. |
| **Max/MSP, Pure Data** | Всё сообщения; горячие и холодные входы; порядок справа налево; объект `trigger` для ручного порядка. | Антипример для данных: порядок ромба вручную в каждом разветвлении. |
| **Node-RED** | Чистый push сообщений: `node.on('input', (msg, send, done))`, `send` в любой момент, `done(err)` для завершения; контекст `node.context()`. Data-портов нет. Контракт стабилен много лет при смене рантайма. | Паттерн `send` / `done`; стабильность контракта нода при замене внутренностей. |
| **n8n** | Класс `INodeType`: `execute()` для обычных, `trigger()` с `emit` и функцией закрытия для триггеров, `poll()`, `webhook()`. Два стиля записи: декларативный (JSON-роутинг для REST) и программный. | Отдельный стиль для простых случаев поверх общего контракта. Это аргумент за слой «SDK → каноническая модель». |
| **ComfyUI** | PR #2666 «Execution Model Inversion» (открыт 2024-01, слит 2024-08): рекурсивное исполнение заменено топологическим порядком, добавлены ленивые входы (`check_lazy_status`), кэширование по `IS_CHANGED`, расширение графа нодом, статус `PENDING`. Существующие ноды сохранили `INPUT_TYPES`, `FUNCTION`; сломались расширения, патчившие внутренности. | Главный урок: внутренности движка заменяемы спустя полтора года и тысячи сторонних нодов, если контракт нода стабилен, а новое добавляется опционально. |
| **Rivet** (Ironclad) | Плагин: функция, получающая библиотеку Rivet; нод реализует `create`, `getInputDefinitions(data, connections, …)`, `getOutputDefinitions`, `getUIData`, `getEditors`, `process(data, inputData, context)`. Порты вычисляются из данных нода (динамические). | Образец контракта нода для npm-плагинов и динамических портов (на потом). |
| **Blender geometry nodes** | Lazy-function graph: вычисляется только нужное, что нужно определяется во время выполнения (Switch не считает неиспользуемую ветку); граф компилируется и кэшируется на группу. | Ленивость по входам как будущая оптимизация, не семантика. |
| **Lustre, Esterel** | Синхронные языки: цикл допустим только через явную задержку (`pre`, `pause`), проверяется анализом причинности до запуска. | Правило «в каждом сигнальном цикле нод с задержкой» и отказ в связи при его нарушении. |
| **DEVS, VHDL** | Очередь событий, упорядоченная по (время, порядок или дельта); время двигают события. | Ядро сигнального слоя и виртуальное время. |
| **Temporal** | Код workflow детерминирован, эффекты вынесены в activities, история воспроизводится replay'ем. | Та же граница: чистое ядро, эффекты через адаптер, детерминизм проверяется воспроизведением. |

## Выводы

1. Двухслойная схема (данные pull, сигналы очередь) не изобретение: Rete, Unreal, Unity,
   Ventuz. Единая сигнальная модель (Vuo, Flyde, Max) тоже жизнеспособна, но ценой
   дополнительных понятий на каждом ноде.
2. Ленивость данных проверена (TouchDesigner, Blender), но её UX требует осторожности.
3. Внутренности движка меняются позже без катастрофы (ComfyUI), контракт нода нет.
   Значит, лаба должна упереться в семантику и контракт, а не в реализацию.
4. Идентичность события и схождение путей (Vuo против Unreal) это развилка, которую не
   заметили ни в одной сессии; решена в 06.

## Источники

- TouchDesigner, Cook: https://derivative.ca/UserGuide/Cook
- Vuo, The rules of events: https://doc.vuo.org/2.4.4/manual/the-rules-of-events.xhtml
- Vuo, Event walls and doors: https://doc.vuo.org/2.4.4/manual/event-walls-and-doors.xhtml
- Vuo, Feedback loops: https://doc.vuo.org/2.4.4/manual/feedback-loops.xhtml
- Rete.js, Engine: https://retejs.org/docs/concepts/engine
- Flyde, Advanced concepts: https://www.flyde.dev/docs/advanced-concepts/
- Flyde, Custom nodes: https://www.flyde.dev/docs/custom-nodes/
- Ventuz, Loop Breaker: https://www.ventuz.com/support/help/latest/NodeLogicLoopBreaker.html
- Ventuz, Nodes and Bindings: https://www.ventuz.com/support/help/V3_02/NodesAndBindings.html
- Ventuz, Script node: https://www.ventuz.com/support/help/V5_04/NodeLogicScript.html
- ComfyUI, PR #2666: https://github.com/comfyanonymous/ComfyUI/pull/2666
- n8n, Choose a node building style: https://docs.n8n.io/connect/create-nodes/plan-your-node/choose-a-node-building-style
- Node-RED, JavaScript file: https://nodered.org/docs/creating-nodes/node-js
- Rivet, example plugin node: https://github.com/abrenneke/rivet-plugin-example/blob/main/src/nodes/ExamplePluginNode.ts
- Unreal, Blueprint evaluation: https://zomgmoz.tv/unreal/Blueprints/How-blueprint-evaluation-works
- Blender, lazy-function graph executor: https://projects.blender.org/archive/blender-archive/src/commit/697b447c2069bbbbaa9929aab0ea1f66ef8bf4d0/source/blender/functions/FN_lazy_function_graph_executor.hh
