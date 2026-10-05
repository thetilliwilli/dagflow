// Диалог ввода имени (сворачивание в составной нод, переименование) с подсказкой об ошибке (FR-023a)
import { useState, type FormEvent } from 'react';
import type { Result } from '../../store/actions';
import { workflowMessages } from '../messages';

interface Props {
  title: string;
  label: string;
  submitLabel: string;
  initial?: string;
  onSubmit: (name: string) => Result;
  onClose: () => void;
}

export function NameDialog({ title, label, submitLabel, initial = '', onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  function submit(e: FormEvent) {
    e.preventDefault();
    const r = onSubmit(name);
    if (r.ok) onClose();
    else setError(r.message);
  }
  return (
    <div className="modal-backdrop" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="name-dialog-title" onSubmit={submit}>
        <h2 id="name-dialog-title">{title}</h2>
        <label className="field">
          {label}
          <input autoFocus value={name} maxLength={100} aria-invalid={error ? true : undefined} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p className="field__error">{error}</p>}
        <div className="modal__actions">
          <button type="button" onClick={onClose}>
            {workflowMessages.cancel}
          </button>
          <button type="submit" className="primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
