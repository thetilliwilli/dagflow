// Индикатор цели вычисления в верхней панели (FR-013, FR-014; contracts/ui-texts.md)
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../src/store/react';
import type { AppStore } from '../../src/store/store';
import type { EngineSlice } from '../../src/engine-link/types';
import { Workbench } from '../../src/ui/Workbench';
import { testStore } from './helpers';

function setup() {
  const app = testStore();
  render(
    <AppProvider app={app}>
      <Workbench />
    </AppProvider>,
  );
  return app;
}

function setEngine(app: AppStore, patch: Partial<EngineSlice>) {
  act(() => app.store.setState((d) => void Object.assign(d.engine, patch)));
}

const indicator = () => screen.getByRole('button', { name: /^Engine: / });

describe('индикатор цели', () => {
  it('Local готов → «● Local»', () => {
    const app = setup();
    setEngine(app, { status: { kind: 'ready', engine: '0.1.0', encrypted: false } });
    expect(indicator()).toHaveTextContent('● Local');
    expect(indicator().closest('.engine-indicator')).toHaveAttribute('data-tone', 'ready');
  });

  it('сервер, та же версия engine → адрес и версия', () => {
    const app = setup();
    setEngine(app, {
      target: { kind: 'server', address: 'localhost:8080' },
      status: { kind: 'ready', engine: '0.1.0', encrypted: false },
    });
    expect(indicator()).toHaveTextContent('● Server · localhost:8080 · engine 0.1.0');
    expect(indicator()).toHaveAccessibleName(
      'Engine: ● Server · localhost:8080 · engine 0.1.0. Open engine settings.',
    );
  });

  it('сервер другой версии engine → обе версии (US6 #3)', () => {
    const app = setup();
    setEngine(app, {
      target: { kind: 'server', address: 'localhost:8080' },
      status: { kind: 'ready', engine: '0.0.9', encrypted: false },
    });
    expect(indicator()).toHaveTextContent(
      '● Server · localhost:8080 · engine 0.0.9 (editor 0.1.0)',
    );
  });

  it('не локальный адрес без шифрования → «not encrypted» (FR-011)', () => {
    const app = setup();
    setEngine(app, {
      target: { kind: 'server', address: 'domain.com' },
      status: { kind: 'ready', engine: '0.1.0', encrypted: false },
    });
    expect(indicator()).toHaveTextContent('● Server · domain.com · engine 0.1.0 · not encrypted');
    setEngine(app, { status: { kind: 'ready', engine: '0.1.0', encrypted: true } });
    expect(indicator()).not.toHaveTextContent('not encrypted');
  });

  it('подключение → «Connecting…»', () => {
    const app = setup();
    setEngine(app, { status: { kind: 'connecting' } });
    expect(indicator()).toHaveTextContent('Connecting…');
    expect(indicator().closest('.engine-indicator')).toHaveAttribute('data-tone', 'pending');
  });

  it('щелчок открывает левую панель с разделом «Engine» (US4 #7)', () => {
    setup();
    fireEvent.click(indicator());
    const panel = screen.getByRole('dialog', { name: 'Workflows & storage' });
    expect(panel).toContainElement(screen.getByRole('region', { name: 'Engine' }));
  });

  it('нет связи → «◌ Offline — retrying in N s», «Retry now» и «Use local engine» (US3 #1)', () => {
    const app = setup();
    const calls: string[] = [];
    app.engine = {
      select: () => calls.push('select'),
      retryNow: () => calls.push('retry'),
      useLocal: () => calls.push('local'),
    };
    setEngine(app, {
      target: { kind: 'server', address: 'localhost:8080' },
      status: { kind: 'offline', attempt: 2, retryAt: Date.now() + 3_500 },
    });
    expect(indicator()).toHaveTextContent('◌ Offline — retrying in 4 s');
    expect(indicator().closest('.engine-indicator')).toHaveAttribute('data-tone', 'offline');
    fireEvent.click(screen.getByRole('button', { name: 'Retry now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use local engine' }));
    expect(calls).toEqual(['retry', 'local']);
  });

  it('другая версия протокола → текст и «Use local engine», без «Retry now» (US6 #2)', () => {
    const app = setup();
    setEngine(app, {
      target: { kind: 'server', address: 'localhost:8080' },
      status: { kind: 'incompatible', host: { protocol: 2, engine: '0.9.0' } },
    });
    expect(indicator()).toHaveTextContent('Protocol version differs (server 2, editor 1)');
    expect(screen.queryByRole('button', { name: 'Retry now' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Use local engine' })).toBeInTheDocument();
  });

  it('Local готов — кнопок нет', () => {
    const app = setup();
    setEngine(app, { status: { kind: 'ready', engine: '0.1.0', encrypted: false } });
    expect(screen.queryByRole('button', { name: 'Use local engine' })).toBeNull();
  });

  it('браузер спрашивает разрешение → «Connecting…» с подсказкой и «Use local engine» (FR-011)', () => {
    const app = setup();
    setEngine(app, {
      target: { kind: 'server', address: 'localhost:8080' },
      status: { kind: 'connecting', awaitingPermission: true },
    });
    expect(indicator()).toHaveTextContent(
      'Connecting… Allow local network access in the browser prompt.',
    );
    expect(screen.getByRole('button', { name: 'Use local engine' })).toBeInTheDocument();
  });

  it('сбой фонового потока: «The background engine keeps failing.» и «Use local engine» (US2 #3)', () => {
    const app = setup();
    setEngine(app, { target: { kind: 'worker' }, status: { kind: 'failed' } });
    expect(indicator()).toHaveTextContent('The background engine keeps failing.');
    expect(screen.getByRole('button', { name: 'Use local engine' })).toBeInTheDocument();
  });

  it('Worker в браузере нет → «This browser cannot run the engine in the background.» (FR-027)', () => {
    const app = setup();
    setEngine(app, { target: { kind: 'worker' }, status: { kind: 'failed', reason: 'no-worker' } });
    expect(indicator()).toHaveTextContent('This browser cannot run the engine in the background.');
  });

  it('справа от состояния в той же строке — объём обмена «tx … / rx …» (FR-013a)', () => {
    const app = setup();
    setEngine(app, {
      status: { kind: 'ready', engine: '0.1.0', encrypted: false },
      traffic: { tx: 12_697, rx: 3.1 * 1024 * 1024 },
    });
    const traffic = screen.getByTestId('engine-traffic');
    expect(traffic).toHaveTextContent('tx 12.4 KB / rx 3.1 MB');
    expect(traffic.parentElement).toBe(indicator().parentElement);
  });
});
