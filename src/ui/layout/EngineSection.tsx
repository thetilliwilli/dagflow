// Раздел «Engine» левой панели (FR-003 – FR-005): плоский список целей, поле адреса и «Connect»
import { useState } from 'react';
import { ENGINE_VERSION } from '@dagflow/engine';
import { useActions, useAppState } from '../../store/react';
import type { EngineTarget } from '../../engine-link/types';
import { engineMessages as m } from '../messages';
import { engineTone, trialError } from './engine-text';

const same = (a: EngineTarget, b: EngineTarget) =>
  a.kind === b.kind && (a.kind !== 'server' || (b.kind === 'server' && a.address === b.address));

export function EngineSection() {
  const engine = useAppState((s) => s.engine);
  const { status } = engine;
  const actions = useActions();
  const [address, setAddress] = useState('');
  const probing = engine.trial !== undefined && engine.trial.failure === undefined;
  const error = trialError(engine.trial);

  const rows: Array<{ target: EngineTarget; title: string; kind: string }> = [
    { target: { kind: 'local' }, title: m.localRow, kind: m.kindLocal },
    { target: { kind: 'worker' }, title: m.workerRow, kind: m.kindWorker },
    ...engine.recent.map((r) => ({
      target: { kind: 'server' as const, address: r.address },
      title: r.address,
      kind: m.kindServer,
    })),
  ];

  return (
    <section className="engine-section" aria-label={m.section}>
      <h2>{m.section}</h2>
      <ul className="engine-section__list">
        {rows.map(({ target, title, kind }) => {
          const selected = same(target, engine.target);
          const versions =
            selected &&
            target.kind === 'server' &&
            status.kind === 'ready' &&
            status.engine !== ENGINE_VERSION
              ? m.serverVersions(status.engine, ENGINE_VERSION)
              : undefined;
          return (
            <li
              key={target.kind === 'server' ? target.address : target.kind}
              className="engine-section__item"
            >
              <button
                type="button"
                className="engine-section__row"
                aria-current={selected || undefined}
                onClick={() => actions.selectTarget(target)}
              >
                <span
                  className="engine-dot"
                  data-tone={selected ? engineTone(engine) : undefined}
                  aria-hidden="true"
                />
                <span className="engine-section__title">
                  {title}
                  {versions && <small className="engine-section__versions">{versions}</small>}
                </span>
                <span className="engine-section__kind">{kind}</span>
              </button>
              {/* «×» — только у невыбранного сервера (FR-005) */}
              {target.kind === 'server' && !selected && (
                <button
                  type="button"
                  className="engine-section__remove"
                  aria-label={m.remove(target.address)}
                  title={m.remove(target.address)}
                  onClick={() => actions.removeServer(target.address)}
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="engine-section__connect"
        onSubmit={(e) => {
          e.preventDefault();
          actions.connectServer(address);
        }}
      >
        <input
          type="text"
          value={address}
          placeholder={m.addressPlaceholder}
          aria-label={m.addressPlaceholder}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button type="submit" disabled={probing}>
          {probing ? m.connecting : m.connect}
        </button>
      </form>
      {engine.trial?.awaitingPermission && !error && (
        <p className="engine-section__hint">{m.lnaPrompt}</p>
      )}
      {error && (
        <p className="engine-section__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
