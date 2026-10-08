// Объём обмена с целью: «tx … / rx …» (FR-013a, contracts/ui-texts.md)
import { describe, expect, it } from 'vitest';
import { engineMessages as m } from '../../../src/ui/messages';

describe('объём обмена', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [12_697, '12.4 KB'],
    [3.1 * 1024 * 1024, '3.1 MB'],
    [2 * 1024 ** 3, '2.0 GB'],
    [1_048_550, '1.0 MB'],
    [1024 * 1024 - 1, '1.0 MB'],
  ])('%s байт → %s', (bytes, text) => {
    expect(m.bytes(bytes)).toBe(text);
  });

  it('строка индикатора: tx / rx', () => {
    expect(m.traffic(12_697, 3.1 * 1024 * 1024)).toBe('tx 12.4 KB / rx 3.1 MB');
    expect(m.traffic(0, 0)).toBe('tx 0 B / rx 0 B');
  });
});
