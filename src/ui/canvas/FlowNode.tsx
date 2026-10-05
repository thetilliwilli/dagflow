// Нод на холсте: заголовок, порты, значения в реальном времени (FR-007, FR-015)
import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useActions, useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { NodeMessage, NodeStatusBadge } from './NodeStatus';
import { PortHandle } from './PortHandle';
import { ValueEditor } from './ValueEditor';
import { ValueView } from './ValueView';

export const FlowNode = memo(function FlowNode({ id }: NodeProps) {
  const actions = useActions();
  const node = useAppState((s) => tabGraph(s, activeTab(s))?.nodes.find((n) => n.id === id));
  const def = useAppState((s) => (node ? registryOf(s).get(node.type) : undefined));
  const state = useAppState((s) => (s.activeTabId ? s.nodeStates[s.activeTabId]?.[id] : undefined));
  const connected = useAppState((s) =>
    (tabGraph(s, activeTab(s))?.edges ?? [])
      .filter((e) => e.target.node === id)
      .map((e) => e.target.port)
      .sort()
      .join('\u0000'),
  );
  if (!node || !def) return null;
  const connectedSet = new Set(connected.split('\u0000'));
  const ok = state?.status === 'ok';

  return (
    <div className={`flow-node status-${state?.status ?? 'computing'}`}>
      <div className="flow-node__header">
        <span className="flow-node__title">{def.title}</span>
        <NodeStatusBadge state={state} />
      </div>
      <NodeMessage state={state} />
      {def.inputs.map((p) => {
        const isConnected = connectedSet.has(p.name);
        const missing =
          p.required &&
          !isConnected &&
          node.values[p.name] === undefined &&
          p.default === undefined;
        return (
          <div
            className={`port-row port-row--in ${missing ? 'port-row--missing' : ''}`}
            key={`in-${p.name}`}
            data-testid={`port-in-${p.name}`}
          >
            <PortHandle port={p} kind="in" />
            {isConnected ? (
              <ValueView testId={`in-${p.name}`} value={state?.inputs[p.name]} />
            ) : (
              <ValueEditor
                port={p}
                value={node.values[p.name]}
                onCommit={(v) => actions.setInputValue(id, p.name, v)}
              />
            )}
          </div>
        );
      })}
      {def.outputs.map((p) => (
        <div className="port-row port-row--out" key={`out-${p.name}`}>
          <ValueView testId={`out-${p.name}`} value={ok ? state.outputs[p.name] : undefined} />
          <PortHandle port={p} kind="out" />
        </div>
      ))}
      {node.type === 'builtin:show' && (
        <ValueView
          className="show-value"
          testId="show-value"
          value={ok ? state.inputs.value : undefined}
        />
      )}
    </div>
  );
});
