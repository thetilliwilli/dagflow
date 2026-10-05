// Предложения, связанные с хранилищем: выбор папки, перенос, слияние, напоминание (FR-028a, FR-028c)
import { useState } from 'react';
import { useAppState } from '../../store/react';
import { usePersistence } from '../../store/persistence-react';
import { storageMessages as m } from '../messages';

export function FolderBanner() {
  const persistence = usePersistence();
  const prompt = useAppState((s) => s.storagePrompt);
  const location = useAppState((s) => s.storageLocation);
  const supported = useAppState((s) => s.folderSupported);
  const [hidden, setHidden] = useState(false);
  if (!persistence) return null;

  if (prompt?.kind === 'copy-to-empty') {
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
  if (prompt?.kind === 'add-from-browser') {
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
  if (hidden || location?.kind !== 'browser') return null;
  return (
    <div className="banner banner--muted" role="region" aria-label="Хранилище">
      <span>{supported ? m.firstRunHint : m.browserReminder}</span>
      {supported && (
        <button type="button" className="primary" onClick={() => void persistence.chooseFolder()}>
          {m.chooseFolder}
        </button>
      )}
      <button type="button" onClick={() => setHidden(true)}>
        {m.later}
      </button>
    </div>
  );
}
