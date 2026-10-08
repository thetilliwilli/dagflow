// Адрес сервера: разбор, нормализация, локальность, порядок схем (FR-008 – FR-011, research R8, R9)
import { describe, expect, it } from 'vitest';
import {
  isLocalHost,
  isPrivateHost,
  parseAddress,
  schemeOrder,
  toUrl,
} from '../../../src/engine-link/address';

describe('parseAddress', () => {
  it.each([
    ['localhost:8080', 'localhost:8080', undefined],
    ['domain.com', 'domain.com', undefined],
    ['domain.com/dagflow', 'domain.com/dagflow', undefined],
    ['Domain.COM/', 'domain.com', undefined],
    ['  localhost:8080  ', 'localhost:8080', undefined],
    ['192.168.1.20:9000', '192.168.1.20:9000', undefined],
    ['[::1]:8080', '[::1]:8080', undefined],
    ['domain.com:80', 'domain.com:80', undefined],
    ['ws://localhost:8080', 'localhost:8080', 'ws'],
    ['wss://domain.com/x/', 'domain.com/x', 'wss'],
    ['http://domain.com', 'domain.com', 'ws'],
    ['https://domain.com:8443', 'domain.com:8443', 'wss'],
  ])('«%s» → %s (схема-подсказка: %s)', (input, address, hint) => {
    expect(parseAddress(input)).toEqual({ ok: true, address, hint });
  });

  it.each([
    '',
    '   ',
    'user:pass@domain.com',
    'domain.com?x=1',
    'domain.com#top',
    'domain .com',
    'ftp://domain.com',
    'domain.com:0',
    'domain.com:70000',
    'domain.com:abc',
    ':8080',
  ])('«%s» → ошибка', (input) => {
    expect(parseAddress(input)).toEqual({ ok: false });
  });

  it('порт не подставляется (FR-010)', () => {
    expect(parseAddress('domain.com')).toEqual({ ok: true, address: 'domain.com' });
    expect(toUrl('domain.com', 'wss')).toBe('wss://domain.com');
    expect(toUrl('domain.com:80', 'wss')).toBe('wss://domain.com:80');
  });
});

describe('isLocalHost', () => {
  it.each([
    ['localhost:8080', true],
    ['engine.localhost', true],
    ['127.0.0.1:8080', true],
    ['127.5.6.7', true],
    ['[::1]:8080', true],
    ['[::ffff:127.0.0.1]:8080', true],
    ['192.168.1.20:9000', false],
    ['domain.com/dagflow', false],
    ['localhost.com', false],
  ])('%s → %s', (address, local) => {
    expect(isLocalHost(address)).toBe(local);
  });
});

describe('schemeOrder', () => {
  it('локальный адрес: ws, затем wss', () => {
    expect(schemeOrder('localhost:8080', { pageSecure: false })).toEqual(['ws', 'wss']);
    expect(schemeOrder('localhost:8080', { pageSecure: true })).toEqual(['ws', 'wss']);
  });

  it('остальные: wss, затем ws', () => {
    expect(schemeOrder('domain.com', { pageSecure: false })).toEqual(['wss', 'ws']);
  });

  it('страница по https и адрес не локальный — только wss (FR-011)', () => {
    expect(schemeOrder('domain.com', { pageSecure: true })).toEqual(['wss']);
  });

  it('запомненная схема — первой', () => {
    expect(schemeOrder('localhost:8080', { pageSecure: false, remembered: 'wss' })).toEqual([
      'wss',
      'ws',
    ]);
  });

  it('схема, указанная пользователем, — первой, даже если браузер её запретит', () => {
    expect(schemeOrder('domain.com', { pageSecure: false, hint: 'ws' })).toEqual(['ws', 'wss']);
    expect(schemeOrder('domain.com', { pageSecure: true, hint: 'ws' })).toEqual(['ws', 'wss']);
  });
});

describe('isPrivateHost', () => {
  it.each([
    ['192.168.1.20:9000', true],
    ['10.0.0.5', true],
    ['172.16.0.1', true],
    ['172.31.255.1', true],
    ['172.32.0.1', false],
    ['169.254.1.1', true],
    ['[fd12::1]:8080', true],
    ['[fe80::1]', true],
    ['printer.local', true],
    ['nas', true],
    ['nas.lan:8080', true],
    ['router.home.arpa', true],
    ['build.internal', true],
    ['[::ffff:192.168.0.2]:8080', true],
    ['[::ffff:8.8.8.8]', false],
    ['domain.com', false],
    ['8.8.8.8', false],
    ['localhost:8080', false],
  ])('%s → %s', (address, local) => {
    expect(isPrivateHost(address)).toBe(local);
  });
});
