// Пробел и Escape (US1 #3, #8; FR-003, FR-005; research R6, R7)
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { AppProvider } from '../../src/store/react';
import type { UiActions } from '../../src/store/ui';
import { Workbench } from '../../src/ui/Workbench';
import { testStore, UiProbe } from './helpers';

function setup() {
  render(
    <AppProvider app={testStore()}>
      <Workbench />
    </AppProvider>,
  );
}

const key = (target: Element, k: ' ' | 'Escape') =>
  fireEvent.keyDown(target, { key: k, code: k === ' ' ? 'Space' : 'Escape' });
const paletteOpen = () => screen.queryByRole('dialog', { name: 'Палитра' }) !== null;
const sidebarOpen = () => screen.queryByRole('dialog', { name: 'Workflow и хранилище' }) !== null;

describe('Пробел — палитра (FR-005)', () => {
  it('на body переключает палитру', () => {
    setup();
    key(document.body, ' ');
    expect(paletteOpen()).toBe(true);
    key(document.body, ' ');
    expect(paletteOpen()).toBe(false);
  });

  it('на холсте переключает палитру', () => {
    setup();
    key(screen.getByTestId('canvas'), ' ');
    expect(paletteOpen()).toBe(true);
  });

  it('в полях ввода не переключает (US1 #8)', () => {
    setup();
    const fields = [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('select'),
    ];
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom не вычисляет isContentEditable из атрибута
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    for (const el of [...fields, editable]) {
      document.body.append(el);
      key(el, ' ');
      expect(paletteOpen()).toBe(false);
      el.remove();
    }
  });
});

describe('Escape (FR-003)', () => {
  it('закрывает верхнее окно — последнее открытое или поднятое щелчком', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
    key(document.body, ' ');
    expect(sidebarOpen() && paletteOpen()).toBe(true);
    key(document.body, 'Escape');
    expect(paletteOpen()).toBe(false);
    expect(sidebarOpen()).toBe(true);
    key(document.body, ' ');
    // Щелчок по левой панели поднимает её наверх — Escape закрывает её, а не палитру
    fireEvent.pointerDown(screen.getByRole('dialog', { name: 'Workflow и хранилище' }));
    key(document.body, 'Escape');
    expect(sidebarOpen()).toBe(false);
    expect(paletteOpen()).toBe(true);
  });

  it('в поле ввода не закрывает окно', () => {
    setup();
    key(document.body, ' ');
    const input = document.createElement('input');
    document.body.append(input);
    key(input, 'Escape');
    expect(paletteOpen()).toBe(true);
    input.remove();
  });
});

describe('Пробел во время связывания (граничный случай, перенесено из T018 в T037)', () => {
  it('в режиме привязки Пробел не открывает палитру', () => {
    const app = testStore();
    const actions = createActions(app);
    let ui!: UiActions;
    render(
      <AppProvider app={app}>
        <Workbench />
        <UiProbe onReady={(u) => (ui = u)} />
      </AppProvider>,
    );
    let id = '';
    act(() => {
      const r = actions.addNode('builtin:number', { x: 0, y: 0 });
      if (r.ok) id = r.id;
    });
    act(() => ui.setSelection([id]));
    const out = screen
      .getByRole('dialog', { name: 'Свойства' })
      .querySelector<HTMLElement>('li.prop-row[data-side="out"][data-port="value"]')!;
    const marker = within(out).getByRole('button', { name: 'Связать «value»' });
    fireEvent.pointerDown(marker, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(document, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    expect(marker).toHaveAttribute('aria-pressed', 'true');
    key(document.body, ' ');
    expect(paletteOpen()).toBe(false);
  });
});
