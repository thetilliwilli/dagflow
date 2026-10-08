// Контроллер связывания (US4, research R5): указатель на документе → переходы машины связывания
// в сторе интерфейса; цель под курсором ищется через document.elementFromPoint.
import { useCallback, useEffect } from 'react';
import { linkCandidates, type LinkEnd, type PortSide } from '@dagflow/engine';
import { useActions, useApp } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { useUi, useUiActions, useUiStore } from '../../store/ui';
import { tryLink } from '../canvas/connection';

function elementAt(x: number, y: number): Element | null {
  // В jsdom elementFromPoint нет — там связывание проверяется через стор интерфейса
  return typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null;
}

/** Нод холста под курсором (временное окно над ним не считается — оно лишь показывает нод). */
function nodeAt(x: number, y: number): string | null {
  return elementAt(x, y)?.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
}

/** Запас вокруг нода и его временного окна: окно не пропадает, пока курсор пересекает зазор. */
const PEEK_MARGIN = 24;

/**
 * Курсор ушёл и с нода, и с его временного окна (contracts/ui-contract.md, «Связывание») —
 * окно закрывается, чтобы не загораживать соседние ноды.
 */
function leftPeek(peek: string, x: number, y: number): boolean {
  const boxes = [
    document.querySelector(`.react-flow__node[data-id="${peek}"]`),
    document.querySelector(`[data-peek-node="${peek}"]`),
  ].map((el) => el?.getBoundingClientRect());
  return boxes.every(
    (r) =>
      !r ||
      x < r.left - PEEK_MARGIN ||
      x > r.right + PEEK_MARGIN ||
      y < r.top - PEEK_MARGIN ||
      y > r.bottom + PEEK_MARGIN,
  );
}

/** Строка временного окна под курсором. */
function rowAt(x: number, y: number): LinkEnd | null {
  const row = elementAt(x, y)?.closest('[data-peek-node] li.prop-row');
  const node = row?.closest('[data-peek-node]')?.getAttribute('data-peek-node');
  const side = row?.getAttribute('data-side') as PortSide | null | undefined;
  const port = row?.getAttribute('data-port');
  return node && side && port ? { node, side, port } : null;
}

/** Связать с параметром временного окна: проверить по linkCandidates, затем связать или объяснить. */
export function useLinkTo(): (to: LinkEnd) => void {
  const app = useApp();
  const actions = useActions();
  const ui = useUiActions();
  const store = useUiStore();
  return useCallback(
    (to: LinkEnd) => {
      const l = store.getState().linking;
      if (l.kind !== 'dragging' && l.kind !== 'picking') return;
      const state = app.store.getState();
      const graph = tabGraph(state, activeTab(state));
      if (!graph) return;
      const all = linkCandidates(graph, l.from, to.node, registryOf(state));
      const c = 'inputs' in all ? (to.side === 'in' ? all.inputs : all.outputs)[to.port] : all;
      const check = !c ? { ok: false as const, message: '' } : c.ok ? { ok: true as const } : c;
      const intent = ui.linkTo(to, check);
      if (intent?.kind === 'connect') tryLink(actions, intent.from, intent.to);
      else if (intent?.kind === 'notify' && intent.message) actions.notify('error', intent.message);
    },
    [app, actions, ui, store],
  );
}

/** Подключается в редакторе: ведёт связывание, пока оно не idle. */
export function useLinking() {
  const ui = useUiActions();
  const store = useUiStore();
  const linkTo = useLinkTo();
  const kind = useUi((s) => s.linking.kind);

  useEffect(() => {
    if (kind === 'idle') return;
    const onMove = (e: PointerEvent) => {
      ui.movePointer({ x: e.clientX, y: e.clientY });
      const l = store.getState().linking;
      if (l.kind !== 'dragging' && l.kind !== 'picking') return;
      const node = nodeAt(e.clientX, e.clientY);
      if (node) ui.setPeek(node);
      else if (l.peek && leftPeek(l.peek, e.clientX, e.clientY)) ui.setPeek(null);
    };
    const onUp = (e: PointerEvent) => {
      const l = store.getState().linking;
      if (l.kind === 'pressed') ui.releasePointer();
      else if (l.kind === 'dragging') {
        const row = rowAt(e.clientX, e.clientY);
        if (row) linkTo(row);
        else ui.cancelLinking(); // бросок мимо строк — ничего не меняется (FR-021)
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [kind, ui, store, linkTo]);
}
