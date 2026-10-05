// Редактор: палитра + холст активной вкладки
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './canvas/Canvas';
import { Palette } from './palette/Palette';

export function Editor() {
  return (
    <ReactFlowProvider>
      <div className="editor">
        <Palette />
        <Canvas />
      </div>
    </ReactFlowProvider>
  );
}
