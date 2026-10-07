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
    expect(indicator()).toHaveAttribute('data-tone', 'ready');
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
    expect(indicator()).toHaveAttribute('data-tone', 'pending');
  });

  it('щелчок открывает левую панель с разделом «Engine» (US4 #7)', () => {
    setup();
    fireEvent.click(indicator());
    const panel = screen.getByRole('dialog', { name: 'Workflows & storage' });
    expect(panel).toContainElement(screen.getByRole('region', { name: 'Engine' }));
  });
});
