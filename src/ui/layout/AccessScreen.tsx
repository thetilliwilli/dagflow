// Экран восстановления доступа к папке: до подтверждения данные не читаются и не пишутся (FR-028d)
import { usePersistence } from '../../store/persistence-react';
import { storageMessages as m } from '../messages';

export function AccessScreen({ folderName }: { folderName: string }) {
  const persistence = usePersistence();
  return (
    <div className="access-screen">
      <div className="access-screen__card">
        <h1>{m.accessTitle}</h1>
        <p>{m.accessText(folderName)}</p>
        <button type="button" className="primary" onClick={() => void persistence?.restoreAccess()}>
          {m.restoreAccess}
        </button>
        <hr />
        <button type="button" className="link" onClick={() => void persistence?.useBrowser()}>
          {m.workInBrowser}
        </button>
        <p className="access-screen__note">{m.workInBrowserNote}</p>
      </div>
    </div>
  );
}
