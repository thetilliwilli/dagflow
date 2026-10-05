// Где сейчас хранятся данные + выбор рабочей папки (FR-028a, FR-028b)
import { useAppState } from '../../store/react';
import { usePersistence } from '../../store/persistence-react';
import { storageMessages as m } from '../messages';

export function StorageIndicator() {
  const persistence = usePersistence();
  const location = useAppState((s) => s.storageLocation);
  const supported = useAppState((s) => s.folderSupported);
  if (!persistence) return null;
  const text = !location
    ? m.loading
    : location.kind === 'browser'
      ? m.browser
      : location.kind === 'none'
        ? m.none
        : m.folder(location.name);
  return (
    <div className="storage-indicator" data-testid="storage-indicator">
      <span>{text}</span>
      {supported && location && (
        <button type="button" onClick={() => void persistence.chooseFolder()}>
          {location.kind === 'folder' ? m.changeFolder : m.chooseFolder}
        </button>
      )}
    </div>
  );
}
