// Редактор вкладки: холст (в ErrorBoundary) и окна, которым нужен React Flow (палитра)
import { ReactFlowProvider } from '@xyflow/react';
import { useUi } from '../store/ui';
import { Canvas } from './canvas/Canvas';
import { ErrorBoundary } from './ErrorBoundary';
import { Palette } from './palette/Palette';

export function Editor() {
  const paletteOpen = useUi((s) => s.windows.palette.open);
  return (
    <ReactFlowProvider>
      <div className="editor">
        <ErrorBoundary>
          <Canvas />
        </ErrorBoundary>
        {paletteOpen && <Palette />}
      </div>
    </ReactFlowProvider>
  );
}
