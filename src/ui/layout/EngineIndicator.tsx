// Индикатор цели вычисления справа от вкладок (FR-013): всегда виден, щелчок открывает раздел «Engine».
// Без связи — отсчёт до повтора и «Retry now»; без связи, другая версия, сбой потока — «Use local engine»
import { useEffect, useState } from 'react';
import { useActions, useAppState } from '../../store/react';
import { useUiActions } from '../../store/ui';
import { engineMessages as m } from '../messages';
import { engineTone, indicatorText } from './engine-text';

/** Секунды до следующей попытки; обновляется раз в секунду, пока нет связи. */
function useSecondsLeft(retryAt: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (retryAt === undefined) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [retryAt]);
  return retryAt === undefined ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));
}

export function EngineIndicator() {
  const engine = useAppState((s) => s.engine);
  const actions = useActions();
  const ui = useUiActions();
  const { status } = engine;
  const secondsLeft = useSecondsLeft(status.kind === 'offline' ? status.retryAt : undefined);
  const text = indicatorText(engine, secondsLeft);
  const canUseLocal =
    engine.target.kind !== 'local' &&
    (status.kind === 'offline' || status.kind === 'incompatible' || status.kind === 'failed');
  return (
    <div className="engine-indicator" data-tone={engineTone(engine)}>
      <button
        type="button"
        className="engine-indicator__state"
        aria-label={m.indicatorLabel(text)}
        title={m.indicatorLabel(text)}
        onClick={() => ui.openWindow('sidebar')}
      >
        {text}
      </button>
      {status.kind === 'offline' && (
        <button type="button" onClick={() => actions.retryNow()}>
          {m.retryNow}
        </button>
      )}
      {canUseLocal && (
        <button type="button" onClick={() => actions.useLocalEngine()}>
          {m.useLocal}
        </button>
      )}
    </div>
  );
}
