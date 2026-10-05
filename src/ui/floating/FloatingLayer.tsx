// Слой плавающих окон поверх холста: сам не перехватывает указатель, окна в нём — да (FR-002)
import type { ReactNode } from 'react';

export function FloatingLayer({ children }: { children: ReactNode }) {
  return <div className="floating-layer">{children}</div>;
}
