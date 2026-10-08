// Список серверов: в порядке добавления, строки не перемещаются (FR-003 – FR-005, уточнено 2026-10-08)
import { describe, expect, it } from 'vitest';
import { MAX_RECENT, rememberServer, removeServer } from '../../../src/engine-link/recent';
import type { RecentServer } from '../../../src/engine-link/types';

const list = (...addresses: string[]): RecentServer[] => addresses.map((address) => ({ address }));

describe('rememberServer', () => {
  it('новый сервер — в конец списка, порядок остальных не меняется', () => {
    expect(rememberServer(list('a:1', 'b:2'), 'c:3', 'ws')).toEqual([
      { address: 'a:1' },
      { address: 'b:2' },
      { address: 'c:3', scheme: 'ws' },
    ]);
  });

  it('уже записанный сервер остаётся на месте, обновляется только схема', () => {
    expect(
      rememberServer(
        [{ address: 'a:1', scheme: 'wss' }, { address: 'b:2' }, { address: 'c:3' }],
        'a:1',
        'ws',
      ),
    ).toEqual([{ address: 'a:1', scheme: 'ws' }, { address: 'b:2' }, { address: 'c:3' }]);
  });

  it('уже записанный сервер без новой схемы — список тот же (без лишней записи)', () => {
    const l = [{ address: 'a:1', scheme: 'ws' as const }, { address: 'b:2' }];
    expect(rememberServer(l, 'a:1', 'ws')).toBe(l);
    expect(rememberServer(l, 'b:2')).toBe(l);
  });

  it(`при ${MAX_RECENT + 1}-м уходит добавленный раньше всех, новый — последним`, () => {
    const full = list('a:1', 'b:2', 'c:3', 'd:4', 'e:5');
    expect(rememberServer(full, 'f:6').map((r) => r.address)).toEqual([
      'b:2',
      'c:3',
      'd:4',
      'e:5',
      'f:6',
    ]);
  });

  it('без схемы — запись без поля scheme', () => {
    expect(rememberServer([], 'a:1')).toEqual([{ address: 'a:1' }]);
  });
});

describe('removeServer', () => {
  it('«×» убирает невыбранный сервер, порядок остальных не меняется', () => {
    expect(removeServer(list('a:1', 'b:2', 'c:3'), 'b:2', { kind: 'local' })).toEqual(
      list('a:1', 'c:3'),
    );
  });

  it('выбранный сервер убрать нельзя', () => {
    const l = list('a:1', 'b:2');
    expect(removeServer(l, 'a:1', { kind: 'server', address: 'a:1' })).toBe(l);
  });

  it('неизвестный адрес — список без изменений', () => {
    const l = list('a:1');
    expect(removeServer(l, 'z:9', { kind: 'local' })).toBe(l);
  });
});
