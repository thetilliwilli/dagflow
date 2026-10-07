import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src';

describe('ENGINE_VERSION', () => {
  it('совпадает с version в package.json пакета (research R6)', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(ENGINE_VERSION).toBe(pkg.version);
  });
});
