// Карточка нода (фича 002, US2): серый тип слева вверху, имя по центру (переименование),
// значок состояния и строка проблемы. Порты и значения — в окне свойств (FR-007, FR-008, FR-011)
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useActions, useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, isStale, tabGraph } from '../../store/store';
import { compositeMessages } from '../messages';
import { NodeNameEditor } from './NodeNameEditor';
import { NodeStatusBadge } from './NodeStatus';

const PROBLEM_STATUSES = new Set(['waiting', 'error', 'blocked']);

export const FlowNode = memo(function FlowNode({ id, selected }: NodeProps) {
  const actions = useActions();
  const node = useAppState((s) => tabGraph(s, activeTab(s))?.nodes.find((n) => n.id === id));
  const def = useAppState((s) => (node ? registryOf(s).get(node.type) : undefined));
  const state = useAppState((s) => (s.activeTabId ? s.nodeStates[s.activeTabId]?.[id] : undefined));
  // Связи с целью нет — последние известные значения, приглушённо (FR-019)
  const stale = useAppState((s) => (s.activeTabId ? isStale(s, s.activeTabId) : false));
  if (!node) return null;
  // Тип не найден (составной нод удалён или файл повреждён) — нод не должен молча исчезать
  const typeTitle = def?.title ?? compositeMessages.unknownNode;
  const problem = !def
    ? compositeMessages.unknownType(node.type)
    : state && PROBLEM_STATUSES.has(state.status)
      ? state.message
      : undefined;
  const status = def ? (state?.status ?? 'computing') : 'error';

  return (
    <div
      className={`flow-node status-${status}${selected ? ' is-selected' : ''}${stale ? ' is-stale' : ''}`}
    >
      {/* Служебные невидимые «ручки»: без них React Flow не рисует линию (research R3) */}
      <Handle
        type="target"
        position={Position.Left}
        className="flow-node__anchor"
        isConnectable={false}
      />
      <span className="flow-node__type" title={typeTitle}>
        {typeTitle}
      </span>
      <NodeNameEditor
        className="flow-node__name"
        name={node.name}
        onRename={(name) => actions.renameNode(id, name)}
      />
      <span className="flow-node__status">
        <NodeStatusBadge state={state} />
      </span>
      {problem && (
        <div className="flow-node__problem" data-testid="node-message" title={problem}>
          {problem}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="flow-node__anchor"
        isConnectable={false}
      />
    </div>
  );
});
