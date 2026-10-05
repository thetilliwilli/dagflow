// Рабочая область (фича 002, FR-001): сверху кнопка меню и вкладки, ниже холст на всю высоту;
// левая панель, палитра и другие окна — плавающие поверх холста
import { useAppState } from '../store/react';
import { Editor } from './Editor';
import { FloatingLayer } from './floating/FloatingLayer';
import { useGlobalKeys } from './floating/useGlobalKeys';
import { FolderBanner } from './layout/FolderBanner';
import { MenuButton } from './layout/MenuButton';
import { Notifications } from './layout/Notifications';
import { SidebarWindow } from './layout/SidebarWindow';
import { TabBar } from './layout/TabBar';
import { workflowMessages } from './messages';

export function Workbench() {
  const activeTabId = useAppState((s) => s.activeTabId);
  useGlobalKeys();
  return (
    <FloatingLayer>
      <div className="workbench">
        <header className="topbar">
          <MenuButton />
          <TabBar />
        </header>
        <main className="main">
          {/* Предложения о хранилище — неблокирующие плашки поверх холста (FR-006a) */}
          <div className="main__banners">
            <FolderBanner />
          </div>
          {activeTabId ? (
            <Editor key={activeTabId} />
          ) : (
            <div className="empty-state">{workflowMessages.noTabs}</div>
          )}
        </main>
        <SidebarWindow />
        <Notifications />
      </div>
    </FloatingLayer>
  );
}
