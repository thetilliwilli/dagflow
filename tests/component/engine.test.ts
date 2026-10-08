import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '@dagflow/engine';
import type { Channel } from '@dagflow/protocol';
import { createInlineChannel } from '../../src/engine-link/channels/inline';
import type { Opening, OpenResult } from '../../src/engine-link/connection';
import { createActions } from '../../src/store/actions';
import { startEngine } from '../../src/store/engine';
import { activeTab } from '../../src/store/store';
import { manualScheduler, testStore } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const frames = manualScheduler();
  startEngine(app, { schedule: frames.schedule });
  const tabId = activeTab(app.store.getState())!.id;
  const state = (nodeId: string) => app.store.getState().nodeStates[tabId]?.[nodeId];
  const add = (type: string, values: Record<string, number> = {}) => {
    const r = actions.addNode(type, { x: 0, y: 0 });
    if (!r.ok) throw new Error(r.message);
    for (const [k, v] of Object.entries(values)) actions.setInputValue(r.id, k, v);
    return r.id;
  };
  return { app, actions, frames, state, add };
}

describe('связка стора и engine через протокол (Local)', () => {
  it('после старта цель Local готова и показывает версию engine', () => {
    const { app } = setup();
    expect(app.store.getState().engine.status).toEqual({
      kind: 'ready',
      engine: ENGINE_VERSION,
      encrypted: false,
    });
  });

  it('после изменения значения и кадра состояния обновлены (2 + 3 = 5 → 13)', () => {
    const { actions, frames, state, add } = setup();
    const n1 = add('builtin:number', { value: 2 });
    const n2 = add('builtin:number', { value: 3 });
    const sum = add('builtin:add');
    const show = add('builtin:show');
    actions.connect({ node: n1, port: 'value' }, { node: sum, port: 'a' });
    actions.connect({ node: n2, port: 'value' }, { node: sum, port: 'b' });
    actions.connect({ node: sum, port: 'result' }, { node: show, port: 'value' });
    frames.flushFrames();
    expect(state(show)).toMatchObject({ status: 'ok', inputs: { value: 5 } });

    actions.setInputValue(n1, 'value', 10);
    expect(state(show)!.status).toBe('computing');
    frames.flushFrames();
    expect(state(show)).toMatchObject({ status: 'ok', inputs: { value: 13 } });
  });

  it('добавление связи пересчитывает приёмник (US1 #2)', () => {
    const { actions, frames, state, add } = setup();
    const n = add('builtin:number', { value: 4 });
    const show = add('builtin:show');
    frames.flushFrames();
    expect(state(show)!.status).toBe('waiting');
    actions.connect({ node: n, port: 'value' }, { node: show, port: 'value' });
    frames.flushFrames();
    expect(state(show)).toMatchObject({ status: 'ok', inputs: { value: 4 } });
  });

  it('независимая ветка не пересчитывается (US1 #5)', () => {
    const { app, actions, frames, add } = setup();
    const a = add('builtin:number', { value: 1 });
    const b = add('builtin:number', { value: 2 });
    frames.flushFrames();
    const tabId = activeTab(app.store.getState())!.id;
    const before = app.store.getState().nodeStates[tabId]![b];
    actions.setInputValue(a, 'value', 5);
    frames.flushFrames();
    expect(app.store.getState().nodeStates[tabId]![b]).toBe(before);
  });

  it('при общем источнике приёмник обновляется один раз и согласованно (US1 #4)', () => {
    const { app, actions, frames, state, add } = setup();
    const src = add('builtin:number', { value: 1 });
    const left = add('builtin:add', { b: 1 });
    const right = add('builtin:add', { b: 2 });
    const sum = add('builtin:add');
    actions.connect({ node: src, port: 'value' }, { node: left, port: 'a' });
    actions.connect({ node: src, port: 'value' }, { node: right, port: 'a' });
    actions.connect({ node: left, port: 'result' }, { node: sum, port: 'a' });
    actions.connect({ node: right, port: 'result' }, { node: sum, port: 'b' });
    frames.flushFrames();
    const seen: number[] = [];
    app.store.subscribe((s) => {
      const st = Object.values(s.nodeStates)[0]?.[sum];
      if (st?.status === 'ok') seen.push(st.outputs.result as number);
    });
    actions.setInputValue(src, 'value', 10);
    frames.flushFrames();
    expect(state(sum)!.outputs).toEqual({ result: 23 });
    expect(seen).toEqual([23]);
  });

  it('быстрая серия правок в одном кадре даёт результат по последнему значению', () => {
    const { actions, frames, state, add } = setup();
    const n = add('builtin:number', { value: 1 });
    const show = add('builtin:show');
    actions.connect({ node: n, port: 'value' }, { node: show, port: 'value' });
    frames.flushFrames();
    for (const v of [1, 12, 123]) actions.setInputValue(n, 'value', v);
    expect(state(show)!.status).toBe('computing');
    frames.flushFrames();
    expect(state(show)).toMatchObject({ status: 'ok', inputs: { value: 123 } });
  });

  it('за кадр выполняется не больше одного flush', () => {
    const app = testStore();
    const actions = createActions(app);
    let scheduled = 0;
    const queue: Array<() => void> = [];
    startEngine(app, {
      schedule: (fn) => {
        scheduled += 1;
        queue.push(fn);
      },
    });
    actions.addNode('builtin:number', { x: 0, y: 0 });
    actions.addNode('builtin:number', { x: 0, y: 0 });
    expect(scheduled).toBe(1);
    queue.shift()!();
  });
});

describe('объём обмена с целью (FR-013a, US1 #9)', () => {
  it('растёт при правке, сохраняется при переподключении к той же цели, обнуляется при смене цели', async () => {
    const app = testStore();
    const actions = createActions(app);
    const frames = manualScheduler();
    const channels: Channel[] = [];
    startEngine(app, {
      schedule: frames.schedule,
      open: (): Opening => {
        // Любая цель — хост в окне за строковым каналом
        const channel = createInlineChannel(frames.schedule);
        channels.push(channel);
        const immediate: OpenResult = { ok: true, channel };
        return { immediate, result: Promise.resolve(immediate), cancel: () => {} };
      },
    });
    const traffic = () => app.store.getState().engine.traffic;
    const start = traffic();
    expect(start.tx).toBeGreaterThan(0);
    expect(start.rx).toBeGreaterThan(0);

    actions.addNode('builtin:number', { x: 0, y: 0 });
    frames.flushFrames();
    const afterEdit = traffic();
    expect(afterEdit.tx).toBeGreaterThan(start.tx);
    expect(afterEdit.rx).toBeGreaterThan(start.rx);

    // Обрыв и переподключение к той же цели — счёт продолжается
    channels.at(-1)!.onClose('closed');
    app.engine!.retryNow();
    frames.flushFrames();
    expect(traffic().tx).toBeGreaterThan(afterEdit.tx);

    // Другая цель — с нуля (только обмен с новой целью)
    app.engine!.select({ kind: 'worker' });
    frames.flushFrames();
    expect(traffic().tx).toBeLessThan(afterEdit.tx);
    expect(traffic().tx).toBeGreaterThan(0);
  });

  it('hello, отправленный пробой, учитывается в tx (FR-013a)', () => {
    const app = testStore();
    const frames = manualScheduler();
    const hello = JSON.stringify({ type: 'hello', protocol: 1, engine: '0.1.0' });
    const welcome = JSON.stringify({ type: 'welcome', protocol: 1, engine: '0.1.0' });
    startEngine(app, {
      schedule: frames.schedule,
      open: (target): Opening => {
        if (target.kind === 'local') {
          const immediate: OpenResult = { ok: true, channel: createInlineChannel(frames.schedule) };
          return { immediate, result: Promise.resolve(immediate), cancel: () => {} };
        }
        const channel: Channel = {
          onMessage: () => {},
          onClose: () => {},
          send: () => {},
          close: () => {},
        };
        const immediate: OpenResult = { ok: true, channel, engine: '0.1.0', welcome, hello };
        return { immediate, result: Promise.resolve(immediate), cancel: () => {} };
      },
    });
    app.engine!.select({ kind: 'worker' });
    const { tx, rx } = app.store.getState().engine.traffic;
    expect(rx).toBe(welcome.length);
    expect(tx).toBeGreaterThanOrEqual(hello.length);
  });
});
