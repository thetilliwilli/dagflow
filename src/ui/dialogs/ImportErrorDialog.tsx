// Ошибка загрузки файла (FR-030)
import { workflowMessages } from '../messages';

export function ImportErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-error-title">
        <h2 id="import-error-title">{workflowMessages.importErrorTitle}</h2>
        <p>{message}</p>
        <div className="modal__actions">
          <button type="button" autoFocus onClick={onClose}>
            {workflowMessages.close}
          </button>
        </div>
      </div>
    </div>
  );
}
