import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('boom: stack trace here');
  return <div>Холст работает</div>;
}

describe('ErrorBoundary', () => {
  it('показывает понятное сообщение без трассировки и восстанавливается по кнопке', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось отобразить вкладку');
    expect(screen.getByRole('alert').textContent).not.toContain('boom');
    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Перезагрузить вкладку' }));
    expect(screen.getByText('Холст работает')).toBeInTheDocument();
    spy.mockRestore();
  });
});
