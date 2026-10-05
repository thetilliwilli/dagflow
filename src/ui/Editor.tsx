// Редактор вкладки: холст (в ErrorBoundary), окна вкладки (палитра, свойства, временное окно)
// и связывание параметров (US4)
import { ReactFlowProvider } from '@xyflow/react';
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

export function Editor() {
  const paletteOpen = useUi((s) => s.windows.palette.open);
  const selectedNode = useUi(propertiesNodeId);
  useLinking();
  return (
    <ReactFlowProvider>
      <div className="editor">
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
