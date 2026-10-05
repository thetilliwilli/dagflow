// Модальное подтверждение (удаление, замена)
import { useEffect, useRef } from 'react';
import { workflowMessages } from '../messages';

interface Props {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);
  return (
    <div className="modal-backdrop" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        <p>{text}</p>
        <div className="modal__actions">
          <button type="button" ref={cancelRef} onClick={onCancel}>
            {workflowMessages.cancel}
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
