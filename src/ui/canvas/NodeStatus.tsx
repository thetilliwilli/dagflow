// Бейдж статуса нода и текст причины (FR-016…FR-018)
import type { NodeState } from '../../engine';
import { statusLabels } from '../messages';

const icons: Record<NodeState['status'], string> = {
  ok: '✓',
  computing: '…',
  waiting: '○',
  error: '✕',
  blocked: '⤓',
};

export function NodeStatusBadge({ state }: { state: NodeState | undefined }) {
  const status = state?.status ?? 'computing';
  return (
    <span className={`node-status node-status--${status}`} data-testid="node-status" title={statusLabels[status]}>
      <span aria-hidden="true">{icons[status]}</span> {statusLabels[status]}
    </span>
  );
}

export function NodeMessage({ state }: { state: NodeState | undefined }) {
  if (!state?.message || state.status === 'ok' || state.status === 'computing') return null;
  return (
    <div className={`node-message node-message--${state.status}`} data-testid="node-message">
      {state.message}
    </div>
  );
}
