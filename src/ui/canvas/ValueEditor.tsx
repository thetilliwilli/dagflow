// Редактор значения входа по типу порта (FR-007)
import { useEffect, useState } from 'react';
import type { JsonValue, PortDef } from '../../engine';
import type { Result } from '../../store/actions';
import { messages } from '../messages';

interface Props {
  port: PortDef;
  /** Вручную заданное значение или undefined. */
  value: JsonValue | undefined;
  onCommit: (value: JsonValue | undefined) => Result;
}

function toText(port: PortDef, value: JsonValue | undefined): string {
  if (value === undefined) return '';
  if (port.type === 'number' || port.type === 'text') return String(value);
  return JSON.stringify(value);
}

export function ValueEditor({ port, value, onCommit }: Props) {
  const [text, setText] = useState(() => toText(port, value));
  const [error, setError] = useState<string | null>(null);

  // Внешнее изменение значения (например, отмена) — обновить поле
  useEffect(() => {
    setText((prev) => (parse(port, prev).value === value ? prev : toText(port, value)));
  }, [port, value]);

  if (port.type === 'boolean') {
    const checked = (value ?? port.default ?? false) === true;
    return (
      <input
        className="value-editor nodrag"
        type="checkbox"
        aria-label={port.name}
        checked={checked}
        onChange={(e) => onCommit(e.target.checked)}
      />
    );
  }

  function change(next: string) {
    setText(next);
    const parsed = parse(port, next);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    const r = onCommit(parsed.value);
    setError(r.ok ? null : r.message);
  }

  const placeholder = port.default !== undefined ? toText(port, port.default) : '';
  const common = {
    className: `value-editor nodrag ${error ? 'invalid' : ''}`,
    'aria-label': port.name,
    'aria-invalid': error ? true : undefined,
    value: text,
    placeholder,
  };
  return (
    <span className="value-editor-wrap">
      {port.type === 'number' || port.type === 'text' ? (
        <input
          {...common}
          type="text"
          inputMode={port.type === 'number' ? 'decimal' : undefined}
          onChange={(e) => change(e.target.value)}
        />
      ) : (
        <textarea {...common} rows={1} onChange={(e) => change(e.target.value)} />
      )}
      {error && <span className="value-editor__error">{error}</span>}
    </span>
  );
}

function parse(port: PortDef, text: string): { value: JsonValue | undefined; error?: string } {
  if (port.type === 'text') return { value: text };
  if (text.trim() === '') return { value: undefined };
  if (port.type === 'number') {
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n)
      ? { value: n }
      : { value: undefined, error: messages.valueTypeMismatch('number') };
  }
  try {
    return { value: JSON.parse(text) as JsonValue };
  } catch (e) {
    return { value: undefined, error: messages.invalidJson((e as Error).message) };
  }
}
