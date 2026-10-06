// T095: изменение одного значения перерисовывает только затронутые FlowNode
import { act, render } from '@testing-library/react';
import { Profiler, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createActions } from '../../src/store/actions';
import { startEvaluation } from '../../src/store/evaluation';
import { AppProvider } from '../../src/store/react';
import { manualScheduler, testStore } from './helpers';

const renders = new Map<string, number>();

vi.mock('../../src/ui/canvas/FlowNode', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/ui/canvas/FlowNode')>();
  const Original = mod.FlowNode;
  function Counted(props: ComponentProps<typeof Original>) {
    return (
      <Profiler id={props.id} onRender={(id) => renders.set(id, (renders.get(id) ?? 0) + 1)}>
        <Original {...props} />
      </Profiler>
    );
  }
  return { ...mod, FlowNode: Counted };
});

const { Editor } = await import('../../src/ui/Editor');

describe('перерисовки на графе из 100 нодов', () => {
  it('меняется значение одного нода — перерисовывается только он и его потомок', () => {
    const app = testStore();
    const actions = createActions(app);
    const frames = manualScheduler();
    startEvaluation(app, frames.schedule);
    const ids: string[] = [];
    for (let i = 0; i < 99; i++) {
      const r = actions.addNode('builtin:number', {
        x: (i % 10) * 220,
        y: Math.floor(i / 10) * 140,
      });
      if (r.ok) ids.push(r.id);
    }
    const show = actions.addNode('builtin:show', { x: 0, y: 1600 });
    if (!show.ok) throw new Error();
    actions.connect({ node: ids[0]!, port: 'value' }, { node: show.id, port: 'value' });
    render(
      <AppProvider app={app}>
        <Editor />
      </AppProvider>,
    );
    act(() => frames.flushFrames());
    renders.clear();

    act(() => {
      actions.setInputValue(ids[0]!, 'value', 42);
    });
    act(() => frames.flushFrames());

    const rerendered = [...renders.keys()].sort();
    expect(rerendered).toEqual([ids[0]!, show.id].sort());
  });
});
