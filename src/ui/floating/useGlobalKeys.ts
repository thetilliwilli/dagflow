// Пробел — палитра (FR-005, research R7), Escape — верхнее окно (FR-003, research R6)
import { useEffect } from 'react';
import { useUiActions, useUiStore } from '../../store/ui';
import { isEditable } from '../canvas/useShortcuts';

export function useGlobalKeys() {
  const ui = useUiActions();
  const store = useUiStore();
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // В полях ввода клавиши остаются полю: Пробел вводит пробел, Escape отменяет ввод
      if (e.defaultPrevented || isEditable(e.target)) return;
      if (e.key === 'Escape') {
        ui.escape();
        return;
      }
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (store.getState().linking.kind !== 'idle') return;
      e.preventDefault();
      ui.toggleWindow('palette');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ui, store]);
}
