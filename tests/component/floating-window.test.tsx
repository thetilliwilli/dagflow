// Плавающее окно: разметка, закрытие, перетаскивание с ограничением, подъём наверх (FR-002, FR-003)
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FloatingWindow } from '../../src/ui/floating/FloatingWindow';
import { FloatingLayer } from '../../src/ui/floating/FloatingLayer';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function renderWindow(props: Partial<Parameters<typeof FloatingWindow>[0]> = {}) {
  const onClose = vi.fn();
  const onMove = vi.fn();
  const onFocus = vi.fn();
  render(
    <FloatingWindow
      label="Палитра"
      title="Палитра"
      position={{ x: 100, y: 100 }}
      onClose={onClose}
      onMove={onMove}
      onFocus={onFocus}
      {...props}
    >
      <p>содержимое</p>
    </FloatingWindow>,
  );
  return { onClose, onMove, onFocus, win: screen.getByRole('dialog', { name: 'Палитра' }) };
}

describe('FloatingWindow', () => {
  it('неблокирующий диалог с заголовком, содержимым и кнопкой «Закрыть»', () => {
    setViewport(1000, 800);
    const { win, onClose } = renderWindow();
    expect(win.tagName).toBe('SECTION');
    expect(win).toHaveClass('floating');
    expect(win).toHaveAttribute('aria-modal', 'false');
    expect(screen.getByText('содержимое')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('полный заголовок — во всплывающей подсказке (длинные имена обрезаются)', () => {
    setViewport(1000, 800);
    const { win } = renderWindow({ title: 'Свойства: очень длинное имя нода' });
    expect(win.querySelector('.floating__title')).toHaveAttribute(
      'title',
      'Свойства: очень длинное имя нода',
    );
  });

  it('стоит в переданном положении', () => {
    setViewport(1000, 800);
    const { win } = renderWindow({ position: { x: 120, y: 80 } });
    expect(win.style.left).toBe('120px');
    expect(win.style.top).toBe('80px');
  });

  it('без положения встаёт по функции place', () => {
    setViewport(1000, 800);
    const place = vi.fn(() => ({ x: 7, y: 9 }));
    const { win } = renderWindow({ position: null, place });
    expect(place).toHaveBeenCalledWith({ width: 200, height: 100 }, { width: 1000, height: 800 });
    expect(win.style.left).toBe('7px');
    expect(win.style.top).toBe('9px');
  });

  it('перетаскивание за заголовок двигает окно и не выпускает его за край', () => {
    setViewport(1000, 800);
    const { win, onMove } = renderWindow();
    const header = win.querySelector('.floating__header')!;
    fireEvent.pointerDown(header, { clientX: 110, clientY: 110, pointerId: 1, button: 0 });
    fireEvent.pointerMove(header, { clientX: 160, clientY: 130, pointerId: 1 });
    expect(win.style.left).toBe('150px');
    expect(win.style.top).toBe('120px');
    fireEvent.pointerMove(header, { clientX: 5000, clientY: 5000, pointerId: 1 });
    // Окно 200×100 (заглушка offsetWidth/offsetHeight) упирается в правый нижний угол
    expect(win.style.left).toBe('800px');
    expect(win.style.top).toBe('700px');
    fireEvent.pointerUp(header, { clientX: 5000, clientY: 5000, pointerId: 1 });
    expect(onMove).toHaveBeenLastCalledWith({ x: 800, y: 700 });
  });

  it('нажатие на кнопку закрытия не начинает перетаскивание', () => {
    setViewport(1000, 800);
    const { win, onMove } = renderWindow();
    const close = screen.getByRole('button', { name: 'Закрыть' });
    fireEvent.pointerDown(close, { clientX: 110, clientY: 110, pointerId: 1, button: 0 });
    fireEvent.pointerMove(close, { clientX: 300, clientY: 300, pointerId: 1 });
    expect(win.style.left).toBe('100px');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('pointerdown по окну поднимает его наверх (onFocus), z-index из пропса', () => {
    setViewport(1000, 800);
    const { win, onFocus } = renderWindow({ zIndex: 7 });
    expect(win.style.zIndex).toBe('7');
    fireEvent.pointerDown(screen.getByText('содержимое'), { pointerId: 1, button: 0 });
    expect(onFocus).toHaveBeenCalled();
  });

  it('при изменении размера окна браузера окно возвращается внутрь', () => {
    setViewport(1000, 800);
    const { win, onMove } = renderWindow({ position: { x: 700, y: 600 } });
    setViewport(600, 500);
    fireEvent(window, new Event('resize'));
    expect(win.style.left).toBe('400px');
    expect(win.style.top).toBe('400px');
    expect(onMove).toHaveBeenLastCalledWith({ x: 400, y: 400 });
  });
});

describe('FloatingLayer', () => {
  it('слой не перехватывает указатель, окна в нём — перехватывают', () => {
    setViewport(1000, 800);
    render(
      <FloatingLayer>
        <FloatingWindow label="Окно" title="Окно" position={{ x: 0, y: 0 }} onClose={() => {}}>
          x
        </FloatingWindow>
      </FloatingLayer>,
    );
    const layer = document.querySelector('.floating-layer') as HTMLElement;
    expect(layer).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Окно' }).parentElement).toBe(layer);
  });
});
