import { createRoot } from 'react-dom/client';
import { setLocaleData } from 'monaco-editor-nls';
import ja from 'monaco-editor-nls/locale/ja.json';

setLocaleData(ja);

// Dynamic import to ensure monaco-editor is loaded after setLocaleData
import('./App').then(async ({ default: App }) => {
  const { loader } = await import('@monaco-editor/react');
  const monaco = await import('monaco-editor');
  loader.config({ monaco });

  const container = document.getElementById('root') as HTMLElement;
  const root = createRoot(container);
  root.render(<App />);
});

// calling IPC exposed from preload script
window.electron?.ipcRenderer.once('ipc-example', (arg) => {
  // eslint-disable-next-line no-console
  console.log(arg);
});
window.electron?.ipcRenderer.sendMessage('ipc-example', ['ping']);
