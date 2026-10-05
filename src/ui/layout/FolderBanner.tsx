// Предложения, связанные с хранилищем: выбор папки, перенос, слияние, напоминание (FR-028a, FR-028c).
// Фича 002 (FR-006a): показываются вверху левой панели; этап подсказки — в сторе интерфейса.
import { useAppState } from '../../store/react';
import { usePersistence } from '../../store/persistence-react';
import { useUi, useUiActions } from '../../store/ui';
import { storageMessages as m } from '../messages';
import { storageNotice, type StorageNotice } from './storage-notice';

/** Текущее сообщение о хранилище или null — для панели и для точки на кнопке меню. */
export function useStorageNotice(): StorageNotice | null {
  const persistence = usePersistence();
  const prompt = useAppState((s) => s.storagePrompt);
  const location = useAppState((s) => s.storageLocation);
  const folderSupported = useAppState((s) => s.folderSupported);
  const stage = useUi((s) => s.storageHint);
  return storageNotice({ hasPersistence: !!persistence, prompt, location, folderSupported }, stage);
}

export function FolderBanner() {
  const persistence = usePersistence();
  const prompt = useAppState((s) => s.storagePrompt);
  const ui = useUiActions();
  const notice = useStorageNotice();
  if (!persistence || !notice) return null;

  if (notice === 'copy-to-empty' && prompt?.kind === 'copy-to-empty') {
    return (
      <div className="banner" role="region" aria-label="Хранилище">
        <span>{m.copyToEmpty(prompt.folderName)}</span>
        <button type="button" className="primary" onClick={() => void persistence.confirmPrompt()}>
          {m.move}
        </button>
        <button type="button" onClick={() => void persistence.dismissPrompt()}>
          {m.dontMove}
        </button>
      </div>
    );
  }
  if (notice === 'add-from-browser' && prompt?.kind === 'add-from-browser') {
    return (
      <div className="banner" role="region" aria-label="Хранилище">
        <span>{m.addFromBrowser(prompt.folderName, prompt.add.length, prompt.copies.length)}</span>
        <button type="button" className="primary" onClick={() => void persistence.confirmPrompt()}>
          {m.add}
        </button>
        <button type="button" onClick={() => void persistence.dismissPrompt()}>
          {m.dontAdd}
        </button>
      </div>
    );
  }
  if (notice === 'unavailable') {
    return <UnavailableBanner />;
  }
  if (notice === 'hint') {
    return (
      <div className="banner banner--muted" role="region" aria-label="Хранилище">
        <span>{m.firstRunHint}</span>
        <button type="button" className="primary" onClick={() => void persistence.chooseFolder()}>
          {m.chooseFolder}
        </button>
        <button type="button" onClick={() => ui.setStorageHint('reminder')}>
          {m.later}
        </button>
      </div>
    );
  }
  return (
    <div className="banner banner--muted" role="region" aria-label="Хранилище">
      <span>{m.browserReminder}</span>
      <button type="button" onClick={() => ui.setStorageHint('hidden')}>
        {m.gotIt}
      </button>
    </div>
  );
}

function UnavailableBanner() {
  const persistence = usePersistence();
  const supported = useAppState((s) => s.folderSupported);
  return (
    <div className="banner banner--warning" role="region" aria-label="Хранилище">
      <span>{m.unavailableBanner}</span>
      {supported && persistence && (
        <button type="button" className="primary" onClick={() => void persistence.chooseFolder()}>
          {m.chooseFolder}
        </button>
      )}
    </div>
  );
}
