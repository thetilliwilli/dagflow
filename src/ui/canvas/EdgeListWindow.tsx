// Окно связей между двумя нодами: список «выход→вход» с крестиками (FR-025, US5 #4 – #7)
import { useCallback } from 'react';
import { useActions, useAppState } from '../../store/react';
import { activeTab, tabGraph } from '../../store/store';
import { useUi, useUiActions } from '../../store/ui';
import { FloatingWindow } from '../floating/FloatingWindow';
import { clampToViewport, type Size } from '../floating/geometry';
import { edgeMessages as m } from '../messages';

export function EdgeListWindow() {
  const actions = useActions();
  const ui = useUiActions();
  const w = useUi((s) => s.edgeWindow);
  const z = useUi((s) => s.windowOrder.indexOf('edges'));
  const graph = useAppState((s) => tabGraph(s, activeTab(s)));
  // Рядом с точкой щелчка, в пределах экрана
  const place = useCallback(
    (size: Size, viewport: Size) =>
      clampToViewport({ x: (w?.at.x ?? 0) + 8, y: (w?.at.y ?? 0) + 8, ...size }, viewport),
    [w],
  );
  if (!w || !graph) return null;
  const links = graph.edges.filter((e) => e.source.node === w.source && e.target.node === w.target);
  if (links.length === 0) return null;
  const nameOf = (id: string) => graph.nodes.find((n) => n.id === id)?.name ?? id;
  const title = m.windowTitle(nameOf(w.source), nameOf(w.target));

  return (
    <FloatingWindow
      key={`${w.source}->${w.target}@${w.at.x},${w.at.y}`}
      label={title}
      title={title}
      className="edge-list"
      position={null}
      place={place}
      onClose={() => ui.closeWindow('edges')}
      onFocus={() => ui.focusWindow('edges')}
      zIndex={z + 1}
    >
      <ul>
        {links.map((e) => {
          const link = m.link(e.source.port, e.target.port);
          return (
            <li key={e.id}>
              <span className="edge-list__label" title={link}>
                {link}
              </span>
              <button
                type="button"
                aria-label={m.remove(link)}
                title={m.remove(link)}
                onClick={() => actions.disconnect(e.id)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </FloatingWindow>
  );
}
