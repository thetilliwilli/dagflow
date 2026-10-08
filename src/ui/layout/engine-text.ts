// Тексты состояния цели вычисления: индикатор и ошибка пробной попытки (contracts/ui-texts.md)
import { ENGINE_VERSION } from '@dagflow/engine';
import { PROTOCOL_VERSION } from '@dagflow/protocol';
import { isLocalHost } from '../../engine-link/address';
import type { EngineSlice, Trial } from '../../engine-link/types';
import { engineMessages as m } from '../messages';

/** Цвет точки: переменные --engine-ready / pending / offline / problem (FR-014). */
export type EngineTone = 'ready' | 'pending' | 'offline' | 'problem';

export function engineTone(engine: EngineSlice): EngineTone {
  switch (engine.status.kind) {
    case 'ready':
      return 'ready';
    case 'connecting':
      return 'pending';
    case 'offline':
      return 'offline';
    default:
      return 'problem';
  }
}

/** Текст индикатора; secondsLeft — для «retrying in N s». */
export function indicatorText(engine: EngineSlice, secondsLeft = 0): string {
  const { status, target } = engine;
  switch (status.kind) {
    case 'ready': {
      if (target.kind === 'local') return m.indicatorLocal;
      if (target.kind === 'worker') return m.indicatorWorker;
      const text = m.indicatorServer(target.address, status.engine, ENGINE_VERSION);
      return !status.encrypted && !isLocalHost(target.address)
        ? `${text} · ${m.notEncrypted}`
        : text;
    }
    case 'connecting':
      return status.awaitingPermission ? `${m.connecting} ${m.lnaPrompt}` : m.connecting;
    case 'offline':
      return m.offline(secondsLeft);
    case 'incompatible':
      return m.protocolDiffers(status.host.protocol, PROTOCOL_VERSION);
    case 'failed':
      return status.reason === 'no-worker' ? m.noWorker : m.workerFailing;
  }
}

/** Текст ошибки пробной попытки у поля или строки. */
export function trialError(trial: Trial | undefined): string | undefined {
  if (!trial?.failure) return undefined;
  const address = trial.target.kind === 'server' ? trial.target.address : '';
  switch (trial.failure) {
    case 'invalid-address':
      return m.invalidAddress;
    case 'blocked':
      return m.blocked(address);
    case 'incompatible':
      return m.protocolMismatch(trial.host?.protocol ?? 0, PROTOCOL_VERSION);
    case 'no-worker':
      return m.noWorker;
    case 'lna-denied':
      return m.lnaDenied;
    case 'unreachable':
      return trial.target.kind === 'worker' ? m.noWorker : m.couldNotConnect(address);
  }
}
