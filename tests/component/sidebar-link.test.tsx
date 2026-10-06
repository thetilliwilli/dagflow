// Ссылка на репозиторий внизу левой панели (US1 #9, FR-004)
import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../src/store/react';
import { Workbench } from '../../src/ui/Workbench';
import { openSidebar, testStore } from './helpers';

describe('левая панель: ссылка на репозиторий', () => {
  it('внизу панели — ссылка «github», открывается в новой вкладке', () => {
    render(
      <AppProvider app={testStore()}>
        <Workbench />
      </AppProvider>,
    );
    const panel = openSidebar();
    const link = within(panel).getByRole('link', { name: 'github' });
    expect(link).toHaveAttribute('href', 'https://github.com/thetilliwilli/dagflow');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Последний элемент панели
    const sidebar = panel.querySelector('.sidebar')!;
    expect(sidebar.lastElementChild).toContainElement(link);
  });
});
