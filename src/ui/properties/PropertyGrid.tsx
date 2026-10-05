// Окно свойств выделенного нода: панели «Входы» и «Выходы», ручной ввод, источники,
// состояние и действия нода (US3, FR-012 – FR-017)
import { compositeIdOf, IO_INPUT, IO_OUTPUT, nodePorts, type PortDef } from '../../engine';
import { useActions, useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { IoPortsEditor } from '../canvas/IoPortsEditor';
import { NodeMessage, NodeStatusBadge } from '../canvas/NodeStatus';
import { ValueEditor } from '../canvas/ValueEditor';
import { ValueView } from '../canvas/ValueView';
import { ManagedWindow } from '../floating/ManagedWindow';
import { compositeMessages, propertiesMessages as m } from '../messages';
import { PropertyRow } from './PropertyRow';

export function PropertyGrid({ nodeId }: { nodeId: string }) {
  const actions = useActions();
  const graph = useAppState((s) => tabGraph(s, activeTab(s)));
  const registry = useAppState(registryOf);
  const state = useAppState((s) =>
    s.activeTabId ? s.nodeStates[s.activeTabId]?.[nodeId] : undefined,
  );
  const node = graph?.nodes.find((n) => n.id === nodeId);
  if (!graph || !node) return null;
  const def = registry.get(node.type);
  const ports = nodePorts(node, registry);
  const edges = graph.edges;
  const nameOf = (id: string) => graph.nodes.find((n) => n.id === id)?.name ?? id;
  const compositeId = compositeIdOf(node.type);
  const isIo = node.type === IO_INPUT || node.type === IO_OUTPUT;
  const ok = state?.status === 'ok';

  const inputRow = (p: PortDef) => {
    const incoming = edges.find((e) => e.target.node === nodeId && e.target.port === p.name);
    return (
      <PropertyRow key={p.name} side="in" port={p} linked={!!incoming}>
        {incoming ? (
          <>
            <ValueView value={state?.inputs[p.name]} />
            <span className="prop-source">
              {m.source(nameOf(incoming.source.node), incoming.source.port)}
            </span>
          </>
        ) : (
          <ValueEditor
            key={`${nodeId}:${p.name}`}
            port={p}
            value={node.values[p.name]}
            onCommit={(v) => actions.setInputValue(nodeId, p.name, v)}
          />
        )}
      </PropertyRow>
    );
  };

  const outputRow = (p: PortDef) => (
    <PropertyRow
      key={p.name}
      side="out"
      port={p}
      linked={edges.some((e) => e.source.node === nodeId && e.source.port === p.name)}
    >
      <ValueView value={ok ? state.outputs[p.name] : undefined} />
    </PropertyRow>
  );

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
      {ports && (
        <>
          <section className="prop-grid__panel" aria-label={m.inputs}>
            <h3>{m.inputs}</h3>
            {ports.inputs.length > 0 ? (
              <ul>{ports.inputs.map(inputRow)}</ul>
            ) : (
              <p className="prop-grid__empty">{m.noInputs}</p>
            )}
          </section>
          <section className="prop-grid__panel" aria-label={m.outputs}>
            <h3>{m.outputs}</h3>
            {ports.outputs.length > 0 ? (
              <ul>{ports.outputs.map(outputRow)}</ul>
            ) : (
              <p className="prop-grid__empty">{m.noOutputs}</p>
            )}
          </section>
        </>
      )}
    </ManagedWindow>
  );
}
