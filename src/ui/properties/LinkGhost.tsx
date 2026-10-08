// Метка за курсором при перетаскивании параметра (US4 #1). Не перехватывает указатель —
// иначе elementFromPoint находил бы её вместо нода под курсором.
import { nodePorts } from '@dagflow/engine';
import { useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { useUi } from '../../store/ui';
import { propertiesMessages as m, typeLabels } from '../messages';

export function LinkGhost() {
  const linking = useUi((s) => s.linking);
  const graph = useAppState((s) => tabGraph(s, activeTab(s)));
  const registry = useAppState(registryOf);
  if (linking.kind !== 'dragging') return null;
  const { from, pointer } = linking;
  const node = graph?.nodes.find((n) => n.id === from.node);
  const ports = node && nodePorts(node, registry);
  const port = (from.side === 'in' ? ports?.inputs : ports?.outputs)?.find(
    (p) => p.name === from.port,
  );
  return (
    <div className="link-ghost" style={{ left: pointer.x + 12, top: pointer.y + 12 }}>
      {m.ghost(from.port, port ? typeLabels[port.type] : '')}
    </div>
  );
}
