// Рабочая область: список workflow и хранилище слева, вкладки и редактор справа
import { useAppState } from '../store/react';
import { Editor } from './Editor';
import { ExportImport } from './layout/ExportImport';
import { FolderBanner } from './layout/FolderBanner';
import { Notifications } from './layout/Notifications';
import { StorageIndicator } from './layout/StorageIndicator';
import { TabBar } from './layout/TabBar';
import { WorkflowList } from './layout/WorkflowList';
import { workflowMessages } from './messages';

export function Workbench() {
  const activeTabId = useAppState((s) => s.activeTabId);
  return (
    <div className="workbench">
      <aside className="sidebar">
        <StorageIndicator />
        <WorkflowList />
        <ExportImport />
      </aside>
      <main className="main">
        <FolderBanner />
        <TabBar />
        {activeTabId ? <Editor key={activeTabId} /> : <div className="empty-state">{workflowMessages.noTabs}</div>}
      </main>
      <Notifications />
    </div>
  );
}
