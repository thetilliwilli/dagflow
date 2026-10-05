// Кнопка меню ☰ в левом верхнем углу: показывает и скрывает левую панель (FR-004)
import { useUi, useUiActions } from '../../store/ui';
import { windowMessages } from '../messages';

export function MenuButton() {
  const ui = useUiActions();
  const open = useUi((s) => s.windows.sidebar.open);
  return (
    <button
      type="button"
      className="menu-button"
      aria-label={windowMessages.menu}
      aria-expanded={open}
      title={windowMessages.sidebar}
      onClick={() => ui.toggleWindow('sidebar')}
    >
      ☰
    </button>
  );
}
