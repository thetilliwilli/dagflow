// Редактор вкладки: холст (в ErrorBoundary), окна вкладки (палитра, свойства, временное окно)
// и связывание параметров (US4)
import { ReactFlowProvider } from '@xyflow/react';
import { useAppState } from '../store/react';
import { useUi } from '../store/ui';
import { propertiesNodeId } from '../store/ui-logic';
import { Canvas } from './canvas/Canvas';
import { EdgeListWindow } from './canvas/EdgeListWindow';
import { ErrorBoundary } from './ErrorBoundary';
import { Palette } from './palette/Palette';
import { LinkGhost } from './properties/LinkGhost';
import { PeekGrid } from './properties/PeekGrid';
import { PropertyGrid } from './properties/PropertyGrid';
import { useLinking } from './properties/useLinking';
import { engineMessages } from './messages';

export function Editor() {
  const paletteOpen = useUi((s) => s.windows.palette.open);
  const selectedNode = useUi(propertiesNodeId);
  // Вкладка не передана цели из-за лимита 8 МБ (FR-024)
  const tooLarge = useAppState(
    (s) =>
      s.engine.tooLarge.library || (s.activeTabId ? s.engine.tooLarge.tabs[s.activeTabId] : false),
  );
  useLinking();
  return (
    <ReactFlowProvider>
      <div className="editor">
        {tooLarge && (
          <div className="editor__banner" role="alert">
            {engineMessages.tooLarge}
          </div>
        )}
        <ErrorBoundary>
          <Canvas />
        </ErrorBoundary>
        {paletteOpen && <Palette />}
        {selectedNode && <PropertyGrid key={selectedNode} nodeId={selectedNode} />}
        <EdgeListWindow />
        <PeekGrid />
        <LinkGhost />
      </div>
    </ReactFlowProvider>
  );
}
