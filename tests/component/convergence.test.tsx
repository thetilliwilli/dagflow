import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { startEngine } from '../../src/store/engine';
import type { Persistence } from '../../src/store/persistence';
import { PersistenceProvider } from '../../src/store/persistence-react';
import { AppProvider } from '../../src/store/react';
import type { AppState } from '../../src/store/store';
import { Workbench } from '../../src/ui/Workbench';
import { manualScheduler, openPalette, openSidebar, testStore } from './helpers';

const fakePersistence = {
  start: async () => {},
  restoreAccess: async () => {},
  useBrowser: async () => {},
  chooseFolder: async () => {},
  confirmPrompt: async () => {},
  dismissPrompt: async () => {},
  flush: async () => {},
  stop: () => {},
} as unknown as Persistence;

function setup(state: Partial<AppState> = {}) {
  const app = testStore();
  const frames = manualScheduler();
  startEngine(app, { schedule: frames.schedule });
  app.store.setState(state);
  render(
    <AppProvider app={app}>
      <PersistenceProvider persistence={fakePersistence}>
        <Workbench />
      </PersistenceProvider>
    </AppProvider>,
  );
  return { app, frames };
}

describe('недоступные данные (T100)', () => {
  it('повреждённый составной нод показан в палитре с причиной', () => {
    setup({
      unavailable: [
        { id: 'broken', kind: 'composite', reason: 'Файл повреждён: некорректный JSON' },
      ],
    });
    const palette = within(openPalette('My composite nodes'));
    expect(palette.getByText(/Unavailable: broken/)).toBeInTheDocument();
    expect(palette.getByText(/Файл повреждён/)).toBeInTheDocument();
  });

  it('нод неизвестного типа рисуется заглушкой с объяснением', () => {
    const { app, frames } = setup();
    act(() => {
      app.store.setState((d: AppState) => {
        const wf = Object.values(d.workflows)[0]!;
        wf.graph.nodes.push({
          id: 'ghost',
          type: 'composite:missing',
          name: 'Призрак',
          position: { x: 0, y: 0 },
          values: {},
        });
      });
    });
    act(() => frames.flushFrames());
    const node = document.querySelector<HTMLElement>('.react-flow__node[data-id="ghost"]')!;
    expect(within(node).getByText('Unknown node')).toBeInTheDocument();
    expect(within(node).getByText(/composite:missing/)).toBeInTheDocument();
  });
});

describe('напоминание о выгрузке (T101, US3 #2)', () => {
  it('после «Позже» при поддержке папок показывается напоминание о выгрузке в файл', async () => {
    const user = userEvent.setup();
    setup({ storageLocation: { kind: 'browser' }, folderSupported: true });
    // Фича 002 (FR-006a): сообщение — вверху левой панели, на кнопке меню точка
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('data-attention', 'true');
    expect(screen.queryByText(/Choose a working folder/)).toBeNull();
    openSidebar();
    expect(screen.getByText(/Choose a working folder/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.getByText(/export workflows to a file/)).toBeInTheDocument();
    // Закрыть и открыть панель — этап подсказки не сбрасывается
    await user.click(menu);
    openSidebar();
    expect(screen.getByText(/export workflows to a file/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/export workflows to a file/)).toBeNull();
    expect(menu).not.toHaveAttribute('data-attention');
  });

  it('сохранение недоступно — баннер с объяснением', () => {
    setup({ storageLocation: { kind: 'none', reason: 'SecurityError' }, folderSupported: false });
    openSidebar();
    expect(screen.getByTestId('storage-indicator')).toHaveTextContent('Saving unavailable');
    expect(screen.getByRole('region', { name: 'Storage' })).toHaveTextContent(/Export workflows/);
  });
});
