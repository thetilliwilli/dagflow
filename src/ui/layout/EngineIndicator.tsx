// Индикатор цели вычисления справа от вкладок (FR-013): всегда виден, щелчок открывает раздел «Engine»
import { useAppState } from '../../store/react';
import { useUiActions } from '../../store/ui';
import { engineMessages as m } from '../messages';
import { engineTone, indicatorText } from './engine-text';

export function EngineIndicator() {
  const engine = useAppState((s) => s.engine);
  const ui = useUiActions();
  const text = indicatorText(engine);
  return (
    <button
      type="button"
      className="engine-indicator"
      data-tone={engineTone(engine)}
      aria-label={m.indicatorLabel(text)}
      title={m.indicatorLabel(text)}
      onClick={() => ui.openWindow('sidebar')}
    >
      {text}
    </button>
  );
}
