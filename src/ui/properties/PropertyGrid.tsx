// Окно свойств выделенного нода: панели «Входы» и «Выходы», ручной ввод, источники,
// состояние и действия нода (US3, FR-012 – FR-017); строки — источники связывания (US4)
import { compositeIdOf, IO_INPUT, IO_OUTPUT } from '../../engine';
import { useActions, useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { useUi } from '../../store/ui';
import { IoPortsEditor } from '../canvas/IoPortsEditor';
import { NodeMessage, NodeStatusBadge } from '../canvas/NodeStatus';
import { ManagedWindow } from '../floating/ManagedWindow';
import { compositeMessages, propertiesMessages as m } from '../messages';
import { PortPanels } from './PortPanels';

export function PropertyGrid({ nodeId }: { nodeId: string }) {
  const actions = useActions();
  const graph = useAppState((s) => tabGraph(s, activeTab(s)));
  const registry = useAppState(registryOf);
  const state = useAppState((s) =>
    s.activeTabId ? s.nodeStates[s.activeTabId]?.[nodeId] : undefined,
  );
  const picking = useUi((s) => s.linking.kind === 'picking');
  const node = graph?.nodes.find((n) => n.id === nodeId);
  if (!graph || !node) return null;
  const def = registry.get(node.type);
  const compositeId = compositeIdOf(node.type);
  const isIo = node.type === IO_INPUT || node.type === IO_OUTPUT;

  return (
    <ManagedWindow id="properties" label={m.title} title={m.title} className="prop-grid">
      <div className="prop-grid__head">
        <span className="prop-grid__name" data-testid="prop-grid-name" title={node.name}>
          {node.name}
        </span>
        <span className="prop-grid__type" data-testid="prop-grid-type">
          {def?.title ?? compositeMessages.unknownNode}
        </span>
      </div>
      {picking && <p className="prop-grid__hint">{m.linkHint}</p>}
      <div className="prop-grid__status">
        <NodeStatusBadge state={state} />
        <NodeMessage state={state} />
        {!def && (
          <div className="node-message node-message--error">
            {compositeMessages.unknownType(node.type)}
          </div>
        )}
      </div>
      {compositeId && def && (
        <div className="prop-grid__actions">
          <button
            type="button"
            aria-label={compositeMessages.open(def.title)}
            onClick={() => actions.openComposite(compositeId)}
          >
            {compositeMessages.openButton}
          </button>
          <button
            type="button"
            aria-label={compositeMessages.expand(def.title)}
            onClick={() => actions.expandInstance(nodeId)}
          >
            {compositeMessages.expandButton}
          </button>
        </div>
      )}
      {isIo && (
        <IoPortsEditor
          nodeId={nodeId}
          ports={node.ports ?? []}
          withDefaults={node.type === IO_INPUT}
        />
      )}
      <PortPanels nodeId={nodeId} />
    </ManagedWindow>
  );
}
