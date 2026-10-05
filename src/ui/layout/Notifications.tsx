// Короткие уведомления с автоскрытием через 5 с (T043)
import { useEffect } from 'react';
import { useActions, useAppState } from '../../store/react';
import type { Notification } from '../../store/store';
import { messages } from '../messages';

const AUTO_HIDE_MS = 5000;

function Item({ n, onClose }: { n: Notification; onClose: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onClose(n.id), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [n.id, onClose]);
  return (
    <div className={`notification notification--${n.kind}`} role={n.kind === 'error' ? 'alert' : 'status'}>
      <span>{n.text}</span>
      <button type="button" aria-label={messages.closeNotification} onClick={() => onClose(n.id)}>
        ×
      </button>
    </div>
  );
}

export function Notifications() {
  const actions = useActions();
  const items = useAppState((s) => s.notifications);
  return (
    <div className="notifications">
      {items.map((n) => (
        <Item key={n.id} n={n} onClose={actions.dismiss} />
      ))}
    </div>
  );
}
