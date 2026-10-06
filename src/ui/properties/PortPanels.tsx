// Панели «Входы» и «Выходы» нода — общие для окна свойств и временного окна, чтобы набор
// и порядок строк в них совпадали (FR-020)
import type { PointerEvent } from 'react';
import { nodePorts, type LinkCandidates, type PortDef, type PortSide } from '../../engine';
import { useActions, useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { useUi, useUiActions } from '../../store/ui';
import { linkingFrom } from '../../store/ui-logic';
import { ValueEditor } from '../canvas/ValueEditor';
import { ValueView } from '../canvas/ValueView';
import { propertiesMessages as m } from '../messages';
import { PropertyRow } from './PropertyRow';
import { useLinkTo } from './useLinking';

interface Props {
  nodeId: string;
  /** Временное окно: только значения, строки — цели связывания с затенением недоступных. */
  peek?: { candidates: LinkCandidates; picking: boolean };
}

export function PortPanels({ nodeId, peek }: Props) {
  const actions = useActions();
  const ui = useUiActions();
  const linkTo = useLinkTo();
  const graph = useAppState((s) => tabGraph(s, activeTab(s)));
  const registry = useAppState(registryOf);
  const state = useAppState((s) =>
    s.activeTabId ? s.nodeStates[s.activeTabId]?.[nodeId] : undefined,
  );
  const from = useUi(linkingFrom);
  const node = graph?.nodes.find((n) => n.id === nodeId);
  const ports = node && nodePorts(node, registry);
  if (!graph || !node || !ports) return null;
  const nameOf = (id: string) => graph.nodes.find((n) => n.id === id)?.name ?? id;
  const ok = state?.status === 'ok';

  const rowProps = (side: PortSide, p: PortDef) => {
    if (peek) {
      const c = (side === 'in' ? peek.candidates.inputs : peek.candidates.outputs)[p.name];
      return {
        disabled: !c?.ok,
        reason: c && !c.ok ? c.message : undefined,
        onPick: peek.picking ? () => linkTo({ node: nodeId, side, port: p.name }) : undefined,
      };
    }
    return {
      linking: !!from && from.node === nodeId && from.side === side && from.port === p.name,
      onPress: (e: PointerEvent, onMarker: boolean) =>
        ui.pressLink(
          { node: nodeId, side, port: p.name },
          { x: e.clientX, y: e.clientY },
          onMarker,
        ),
    };
  };

  const inputRow = (p: PortDef) => {
    const incoming = graph.edges.find((e) => e.target.node === nodeId && e.target.port === p.name);
    return (
      <PropertyRow key={p.name} side="in" port={p} linked={!!incoming} {...rowProps('in', p)}>
        {incoming ? (
          <>
            <ValueView value={state?.inputs[p.name]} />
            <span className="prop-source">
              {m.source(nameOf(incoming.source.node), incoming.source.port)}
            </span>
          </>
        ) : peek ? (
          <ValueView value={node.values[p.name] ?? p.default} />
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
      linked={graph.edges.some((e) => e.source.node === nodeId && e.source.port === p.name)}
      {...rowProps('out', p)}
    >
      <ValueView value={ok ? state.outputs[p.name] : undefined} />
    </PropertyRow>
  );

  return (
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
  );
}
