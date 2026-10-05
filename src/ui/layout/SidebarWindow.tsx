// Левая панель — плавающее окно: хранилище, список workflow, выгрузка и загрузка (FR-004)
import { useUi } from '../../store/ui';
import { ManagedWindow } from '../floating/ManagedWindow';
import { windowMessages } from '../messages';
import { ExportImport } from './ExportImport';
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
        <StorageIndicator />
        <WorkflowList />
        <ExportImport />
      </div>
    </ManagedWindow>
  );
}
