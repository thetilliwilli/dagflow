// Связка стора: перезапуск фонового потока (US2 #2) и попытка по online/visibilitychange (FR-020)
import type { Channel } from '@dagflow/protocol';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Opening, OpenResult } from '../../src/engine-link/connection';
import { createInlineChannel } from '../../src/engine-link/channels/inline';
import { initialEngine } from '../../src/engine-link/types';
import { startEngine } from '../../src/store/engine';
import { AppProvider } from '../../src/store/react';
import { createAppStore } from '../../src/store/store';
import { Notifications } from '../../src/ui/layout/Notifications';
import { manualScheduler } from './helpers';

const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('связка стора с целью', () => {
  it('фоновый поток упал → новый поток и уведомление «The engine restarted after a failure.» (US2 #2)', async () => {
    const app = createAppStore(undefined, {
      engine: { ...initialEngine(), target: { kind: 'worker' } },
    });
    const frames = manualScheduler();
    const channels: Channel[] = [];
    startEngine(app, {
      schedule: frames.schedule,
      open: (): Opening => {
        // «Поток» — тот же хост в окне; падение имитируем закрытием канала с причиной crashed
        const channel = createInlineChannel(frames.schedule);
        channels.push(channel);
        const immediate: OpenResult = { ok: true, channel };
        return { immediate, result: Promise.resolve(immediate), cancel: () => {} };
      },
    });
    render(
      <AppProvider app={app}>
        <Notifications />
      </AppProvider>,
    );
    act(() => channels[0]!.onClose('crashed'));
    expect(channels).toHaveLength(2);
    expect(screen.getByText('The engine restarted after a failure.')).toBeInTheDocument();
    expect(app.store.getState().engine.status.kind).toBe('ready');
  });

  it.each(['online', 'visibilitychange'])(
    'без связи событие %s запускает попытку сразу (FR-020)',
    async (event) => {
      const app = createAppStore(undefined, {
        engine: { ...initialEngine(), target: { kind: 'server', address: 'localhost:1' } },
      });
      let opens = 0;
      startEngine(app, {
        open: () => {
          opens += 1;
          return {
            result: Promise.resolve({ ok: false, reason: 'unreachable' }),
            cancel: () => {},
          };
        },
      });
      await tick();
      expect(app.store.getState().engine.status.kind).toBe('offline');
      expect(opens).toBe(1);
      const target = event === 'online' ? window : document;
      act(() => {
        target.dispatchEvent(new Event(event));
      });
      expect(opens).toBe(2);
    },
  );
});
