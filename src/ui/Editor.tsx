// Редактор вкладки: холст (в ErrorBoundary) и окна, которым нужен React Flow (палитра)
import { ReactFlowProvider } from '@xyflow/react';
import { useUi } from '../store/ui';
import { propertiesNodeId } from '../store/ui-logic';
import { Canvas } from './canvas/Canvas';
import { ErrorBoundary } from './ErrorBoundary';
import { Palette } from './palette/Palette';
import { PropertyGrid } from './properties/PropertyGrid';

export function Editor() {
  const paletteOpen = useUi((s) => s.windows.palette.open);
  const selectedNode = useUi(propertiesNodeId);
  return (
    <ReactFlowProvider>
      <div className="editor">
        <ErrorBoundary>
          <Canvas />
        </ErrorBoundary>
        {paletteOpen && <Palette />}
        {selectedNode && <PropertyGrid key={selectedNode} nodeId={selectedNode} />}
      </div>
    </ReactFlowProvider>
  );
}
