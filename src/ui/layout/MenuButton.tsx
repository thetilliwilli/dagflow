// Кнопка меню ☰ в левом верхнем углу: показывает и скрывает левую панель (FR-004);
// точка — в панели есть сообщение о хранилище (FR-006a)
import { useUi, useUiActions } from '../../store/ui';
import { windowMessages } from '../messages';
import { useStorageNotice } from './FolderBanner';

export function MenuButton() {
  const ui = useUiActions();
  const open = useUi((s) => s.windows.sidebar.open);
  const attention = useStorageNotice() !== null;
  return (
    <button
      type="button"
      className="menu-button"
      aria-label={windowMessages.menu}
      aria-expanded={open}
      data-attention={attention || undefined}
      title={attention ? windowMessages.sidebarAttention : windowMessages.sidebar}
      onClick={() => ui.toggleWindow('sidebar')}
    >
      ☰{attention && <span className="menu-button__dot" aria-hidden="true" />}
    </button>
  );
}
