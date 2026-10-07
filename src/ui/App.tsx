import { useEffect, useState } from 'react';
import { startEngine } from '../store/engine';
import { createPersistence } from '../store/persistence';
import { PersistenceProvider } from '../store/persistence-react';
import { AppProvider, useAppState } from '../store/react';
import { createAppStore } from '../store/store';
import { AccessScreen } from './layout/AccessScreen';
import { Workbench } from './Workbench';

function Shell() {
  const location = useAppState((s) => s.storageLocation);
  if (location?.kind === 'folder-pending') return <AccessScreen folderName={location.name} />;
  return <Workbench />;
}

export function App() {
  const [app] = useState(() => createAppStore());
  const [persistence] = useState(() => createPersistence(app));
  useEffect(() => startEngine(app), [app]);
  useEffect(() => {
    void persistence.start();
  }, [persistence]);
  return (
    <AppProvider app={app}>
      <PersistenceProvider persistence={persistence}>
        <Shell />
      </PersistenceProvider>
    </AppProvider>
  );
}
