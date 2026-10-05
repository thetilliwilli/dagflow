// Редактор: палитра + холст активной вкладки
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './canvas/Canvas';
import { ErrorBoundary } from './ErrorBoundary';
import { Palette } from './palette/Palette';

export function Editor() {
  return (
    <ReactFlowProvider>
      <div className="editor">
        <Palette />
        <ErrorBoundary>
          <Canvas />
        </ErrorBoundary>
      </div>
    </ReactFlowProvider>
  );
}
