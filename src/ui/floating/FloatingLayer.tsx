// Слой плавающих окон поверх холста (FR-002). Один на приложение: окна попадают в него
// порталом, поэтому окна из разных частей интерфейса правильно перекрывают друг друга.
import { createContext, useContext, useState, type ReactNode } from 'react';

const LayerContext = createContext<HTMLElement | null>(null);

/** Элемент слоя, в который окна рендерятся порталом (null — слоя нет, окно рисуется на месте). */
export function useFloatingLayer(): HTMLElement | null {
  return useContext(LayerContext);
}

export function FloatingLayer({ children }: { children?: ReactNode }) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  return (
    <LayerContext.Provider value={layer}>
      {children}
      {/* Сам слой не перехватывает указатель — только окна в нём */}
      <div className="floating-layer" ref={setLayer} />
    </LayerContext.Provider>
  );
}
