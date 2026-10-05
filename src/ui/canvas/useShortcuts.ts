// Горячие клавиши отмены/повтора (FR-009). Delete/Backspace обрабатывает React Flow (onDelete).
import { useEffect } from 'react';
import type { Actions } from '../../store/actions';

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function useShortcuts(actions: Actions) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditable(e.target) || !(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        actions.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        actions.redo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions]);
}
