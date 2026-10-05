// Имя нового составного нода при сворачивании выделения (T083)
import { useActions } from '../../store/react';
import { compositeMessages as m } from '../messages';
import { NameDialog } from './NameDialog';

export function CompositeNameDialog({ nodeIds, onClose }: { nodeIds: string[]; onClose: () => void }) {
  const actions = useActions();
  return (
    <NameDialog
      title={m.collapseTitle}
      label={m.nameLabel}
      submitLabel={m.collapseButton}
      onSubmit={(name) => actions.collapseSelection(nodeIds, name)}
      onClose={onClose}
    />
  );
}
