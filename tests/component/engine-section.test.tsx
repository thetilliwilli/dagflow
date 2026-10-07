// Раздел «Engine»: строки целей, поле адреса, ошибки пробной попытки (FR-003, FR-007, FR-008)
import { PROTOCOL_VERSION, type Channel } from '@dagflow/protocol';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Opening, OpenResult } from '../../src/engine-link/connection';
import { createInlineChannel } from '../../src/engine-link/channels/inline';
import type { EngineTarget } from '../../src/engine-link/types';
import { startEngine } from '../../src/store/engine';
import { AppProvider } from '../../src/store/react';
import { Workbench } from '../../src/ui/Workbench';
import { manualScheduler, openSidebar, testStore } from './helpers';

/** Открытия целей под контролем теста: сервер отвечает тем, что решит тест. */
function setup() {
  const app = testStore();
  const frames = manualScheduler();
  const pending: Array<{ target: EngineTarget; resolve: (r: OpenResult) => void }> = [];
  startEngine(app, {
    schedule: frames.schedule,
    open: (target): Opening => {
      if (target.kind === 'local') {
        const immediate = { ok: true as const, channel: createInlineChannel(frames.schedule) };
        return { immediate, result: Promise.resolve(immediate), cancel: () => {} };
      }
      let resolve!: (r: OpenResult) => void;
      const result = new Promise<OpenResult>((r) => (resolve = r));
      pending.push({ target, resolve });
      return { result, cancel: () => resolve({ ok: false, reason: 'cancelled' }) };
    },
  });
  render(
    <AppProvider app={app}>
      <Workbench />
    </AppProvider>,
  );
  const section = () => within(openSidebar()).getByRole('region', { name: 'Engine' });
  const connect = async (address: string) => {
    const s = section();
    fireEvent.change(
      within(s).getByRole('textbox', { name: 'Server address, e.g. localhost:8080' }),
      {
        target: { value: address },
      },
    );
    fireEvent.click(within(s).getByRole('button', { name: 'Connect' }));
  };
  return { app, frames, pending, section, connect };
}

/** Сервер-подделка в том же окне: хост протокола за строковым каналом. */
function serverChannel(schedule: (fn: () => void) => void): Channel {
  return createInlineChannel(schedule);
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('раздел «Engine»', () => {
  it('при первом запуске — две строки, выбрана «This tab · Local» (US4 #1)', () => {
    const { section } = setup();
    const rows = within(section()).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual(['This tabLocal', 'This browserWorker']);
    expect(within(rows[0]!).getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('пустой или недопустимый адрес → текст у поля, попытки нет (US4 #8, FR-008)', async () => {
    const { section, connect, pending } = setup();
    await connect('   ');
    expect(within(section()).getByRole('alert')).toHaveTextContent(
      'Enter a server address, for example localhost:8080.',
    );
    await connect('user@host');
    expect(pending).toHaveLength(0);
  });

  it('пробное подключение: «Connecting…», затем сервер выбран и первый в списке (US1 #1, US4 #2)', async () => {
    const { section, connect, pending, frames, app } = setup();
    await connect('LocalHost:8080');
    expect(within(section()).getByRole('button', { name: 'Connecting…' })).toBeDisabled();
    expect(pending[0]!.target).toEqual({ kind: 'server', address: 'localhost:8080' });
    await act(async () => {
      pending[0]!.resolve({
        ok: true,
        channel: serverChannel(frames.schedule),
        scheme: 'ws',
        engine: '0.1.0',
        encrypted: false,
        welcome: JSON.stringify({ type: 'welcome', protocol: PROTOCOL_VERSION, engine: '0.1.0' }),
      });
    });
    await settle();
    expect(app.store.getState().engine.target).toEqual({
      kind: 'server',
      address: 'localhost:8080',
    });
    const rows = within(section()).getAllByRole('listitem');
    expect(rows[2]).toHaveTextContent('localhost:8080Server');
    expect(within(rows[2]!).getByRole('button')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /^Engine: / })).toHaveTextContent(
      '● Server · localhost:8080 · engine 0.1.0',
    );
  });

  it('неудача → текст у поля, цель прежняя (US1 #6)', async () => {
    const { section, connect, pending, app } = setup();
    await connect('localhost:8081');
    await act(async () => pending[0]!.resolve({ ok: false, reason: 'unreachable' }));
    await settle();
    expect(within(section()).getByRole('alert')).toHaveTextContent(
      'Could not connect to localhost:8081. Check that the server is running and the address is correct.',
    );
    expect(app.store.getState().engine.target).toEqual({ kind: 'local' });
  });

  it('браузер запретил подключение → объяснение про wss (FR-011)', async () => {
    const { section, connect, pending } = setup();
    await connect('domain.com');
    await act(async () => pending[0]!.resolve({ ok: false, reason: 'blocked' }));
    await settle();
    expect(within(section()).getByRole('alert')).toHaveTextContent(
      'The browser blocks unencrypted connections from this page. The server at domain.com needs an encrypted (wss) address.',
    );
  });

  it('другая версия протокола → текст с версиями, цель прежняя (US6 #1)', async () => {
    const { section, connect, pending } = setup();
    await connect('localhost:8080');
    await act(async () =>
      pending[0]!.resolve({
        ok: false,
        reason: 'incompatible',
        host: { protocol: 2, engine: '0.9.0' },
      }),
    );
    await settle();
    expect(within(section()).getByRole('alert')).toHaveTextContent(
      'The server uses a different protocol version (server 2, editor 1). Update the server or the editor.',
    );
  });
});
