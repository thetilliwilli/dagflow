import { describe, expect, it } from 'vitest';
import { isLocalHost, parseOptions } from '../src/options';
import { httpReply, CORS_HEADERS } from '../src/http';

describe('параметры запуска (contracts/server-cli.md)', () => {
  it('по умолчанию: порт 8080, адрес 127.0.0.1, без --verbose', () => {
    expect(parseOptions([])).toEqual({
      ok: true,
      options: { port: 8080, host: '127.0.0.1', verbose: false },
    });
  });

  it('--port, --host, --verbose', () => {
    expect(parseOptions(['--port', '9000', '--host', '0.0.0.0', '--verbose'])).toEqual({
      ok: true,
      options: { port: 9000, host: '0.0.0.0', verbose: true },
    });
  });

  it.each(['0', '65536', 'abc', '80.5', ''])('неверный порт «%s» → текст и код 2', (value) => {
    const args = value === '' ? ['--port'] : ['--port', value];
    expect(parseOptions(args)).toEqual({
      ok: false,
      message: `Invalid port “${value}”. Use a number from 1 to 65535.`,
      exitCode: 2,
    });
  });

  it('неизвестный параметр → текст и код 2', () => {
    expect(parseOptions(['--path', '/x'])).toEqual({
      ok: false,
      message: 'Unknown option “--path”. Options: --port <number>, --host <address>, --verbose.',
      exitCode: 2,
    });
  });

  it.each([
    ['localhost', true],
    ['engine.localhost', true],
    ['127.0.0.1', true],
    ['127.1.2.3', true],
    ['::1', true],
    ['[::1]', true],
    ['0.0.0.0', false],
    ['::', false],
    ['192.168.1.20', false],
  ])('локальный адрес %s → %s', (host, local) => {
    expect(isLocalHost(host)).toBe(local);
  });
});

describe('HTTP-ответы (FR-031)', () => {
  it('OPTIONS → 204 с разрешающими заголовками', () => {
    expect(httpReply('OPTIONS')).toEqual({ status: 204, headers: CORS_HEADERS, body: '' });
  });

  it('GET → 200 text/plain с версией engine', () => {
    const r = httpReply('GET');
    expect(r.status).toBe(200);
    expect(r.body).toBe('DAG Flow engine 0.1.0');
    expect(r.headers).toMatchObject({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Private-Network': 'true',
    });
  });
});
