// Компактное отображение JSON-значения с раскрытием (FR-007a)
import { useState } from 'react';
import { formatCompact, type JsonValue } from '@dagflow/engine';
import { messages } from '../messages';

function full(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function ValueView({
  value,
  testId,
  className,
}: {
  value: JsonValue | undefined;
  testId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (value === undefined) {
    return (
      <span className={`value-view empty ${className ?? ''}`} data-testid={testId}>
        {messages.noValue}
      </span>
    );
  }
  const compact = formatCompact(value);
  const expandable = compact !== full(value);
  return (
    <span className={`value-view ${className ?? ''}`} data-testid={testId}>
      <span className="value-view__compact">{compact}</span>
      {expandable && (
        <button type="button" className="value-view__toggle nodrag" onClick={() => setOpen(!open)}>
          {open ? messages.showLess : messages.showMore}
        </button>
      )}
      {open && <pre className="value-view__full nodrag nowheel">{full(value)}</pre>}
    </span>
  );
}
