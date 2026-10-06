// Имя нода с переименованием двойным щелчком (US2 #2, #4; FR-009): Enter или потеря фокуса —
// сохранить, Escape — отменить; отказ показывается под полем
import { useRef, useState, type KeyboardEvent } from 'react';
import type { Result } from '../../store/actions';
import { propertiesMessages as m } from '../messages';

interface Props {
  name: string;
  onRename: (name: string) => Result;
  className: string;
  testId?: string;
}

export function NodeNameEditor({ name, onRename, className, testId }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Редактирование уже закрыто (Enter/Escape) — blur при удалении поля ничего не сохраняет. */
  const closed = useRef(false);

  const stop = () => {
    closed.current = true;
    setDraft(null);
    setError(null);
  };
  const commit = (cancelOnError: boolean) => {
    if (draft === null || closed.current) return;
    const r = onRename(draft);
    if (r.ok) stop();
    else if (cancelOnError) stop();
    else setError(r.message);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation(); // Escape и Пробел — полю, а не горячим клавишам редактора
    if (e.key === 'Enter') commit(false);
    else if (e.key === 'Escape') stop();
  };

  if (draft === null) {
    return (
      <span
        className={className}
        data-testid={testId}
        title={name}
        onDoubleClick={(e) => {
          e.stopPropagation();
          closed.current = false;
          setDraft(name);
        }}
      >
        {name}
      </span>
    );
  }
  return (
    <span className={`${className} node-name-editor`}>
      <input
        className="nodrag"
        aria-label={m.nodeNameLabel}
        aria-invalid={error ? true : undefined}
        value={draft}
        autoFocus
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => commit(true)}
      />
      {error && (
        <span className="node-name-editor__error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
