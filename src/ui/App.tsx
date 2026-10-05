import { useEffect, useState } from 'react';
import { startEvaluation } from '../store/evaluation';
import { AppProvider } from '../store/react';
import { createAppStore } from '../store/store';
import { Editor } from './Editor';

export function App() {
  const [app] = useState(() => createAppStore());
  useEffect(() => startEvaluation(app), [app]);
  return (
    <AppProvider app={app}>
      <Editor />
    </AppProvider>
  );
}
