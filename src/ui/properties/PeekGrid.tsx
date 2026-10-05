// Временное окно свойств нода под курсором при связывании (FR-018, FR-018a, FR-020):
// рядом с нодом, недоступные строки затенены, но остаются на своих местах
import { useCallback } from 'react';
import { linkCandidates } from '../../engine';
import { useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { useUi, useUiActions } from '../../store/ui';
import { FloatingWindow } from '../floating/FloatingWindow';
import { peekPosition, type Size } from '../floating/geometry';
import { propertiesMessages as m } from '../messages';
import { PortPanels } from './PortPanels';

/** Поверх остальных окон (их z-index — порядковый номер в windowOrder). */
const PEEK_Z = 100;

function nodeRect(id: string) {
  const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
  const r = el?.getBoundingClientRect();
  return r
    ? { x: r.left, y: r.top, width: r.width, height: r.height }
    : { x: 0, y: 0, width: 0, height: 0 };
}

export function PeekGrid() {
  const ui = useUiActions();
  const linking = useUi((s) => s.linking);
  const graph = useAppState((s) => tabGraph(s, activeTab(s)));
  const registry = useAppState(registryOf);
  const peek = linking.kind === 'dragging' || linking.kind === 'picking' ? linking.peek : null;
  const place = useCallback(
    (size: Size, viewport: Size) => peekPosition(nodeRect(peek ?? ''), size, viewport),
    [peek],
  );
  if (!peek || !graph || (linking.kind !== 'dragging' && linking.kind !== 'picking')) return null;
  const node = graph.nodes.find((n) => n.id === peek);
  if (!node) return null;
  const candidates = linkCandidates(graph, linking.from, peek, registry);
  const picking = linking.kind === 'picking';

  return (
    <FloatingWindow
      key={peek}
      label={m.peekTitle(node.name)}
      title={m.peekTitle(node.name)}
      className="prop-grid prop-grid--peek"
      data-peek-node={peek}
      position={null}
      place={place}
      onClose={() => ui.cancelLinking()}
      zIndex={PEEK_Z}
    >
      {picking && <p className="prop-grid__hint">{m.linkHint}</p>}
      {'inputs' in candidates ? (
        <PortPanels nodeId={peek} peek={{ candidates, picking }} />
      ) : (
        <p className="node-message node-message--error">{candidates.message}</p>
      )}
    </FloatingWindow>
  );
}
