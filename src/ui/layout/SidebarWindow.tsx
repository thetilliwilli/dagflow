// Левая панель — плавающее окно: хранилище, цель вычисления (фича 004), список workflow, выгрузка и загрузка,
// внизу — ссылка на репозиторий проекта (FR-004)
import { useUi } from '../../store/ui';
import { ManagedWindow } from '../floating/ManagedWindow';
import { windowMessages } from '../messages';
import { EngineSection } from './EngineSection';
import { ExportImport } from './ExportImport';
import { FolderBanner } from './FolderBanner';
import { StorageIndicator } from './StorageIndicator';
import { WorkflowList } from './WorkflowList';

export function SidebarWindow() {
  const open = useUi((s) => s.windows.sidebar.open);
  if (!open) return null;
  return (
    <ManagedWindow
      id="sidebar"
      label={windowMessages.sidebar}
      title={windowMessages.sidebar}
      className="sidebar-window"
    >
      <div className="sidebar">
        {/* Сообщения о хранилище — вверху панели (FR-006a) */}
        <FolderBanner />
        <StorageIndicator />
        <EngineSection />
        <WorkflowList />
        <ExportImport />
        {/* Переход по ссылке — действие пользователя, приложение само в сеть не ходит (принцип III) */}
        <a
          className="sidebar__repo"
          href={windowMessages.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {windowMessages.repoLink}
        </a>
      </div>
    </ManagedWindow>
  );
}
