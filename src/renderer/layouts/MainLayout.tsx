import React, { useState } from 'react';
import { FileExplorer } from '../components/Sidebar/FileExplorer';
import { CodeEditor } from '../components/Editor/CodeEditor';
import './MainLayout.css';

export const MainLayout = () => {
  const [fileContent, setFileContent] = useState<string>('// Start writing...');
  const [filePath, setFilePath] = useState<string>('');

  const handleFileSelect = (path: string, content: string) => {
    setFilePath(path);
    setFileContent(content);
  };

  const handleContentChange = (value: string | undefined) => {
     setFileContent(value || '');
  };

  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (filePath) {
          try {
            await window.electron.ipcRenderer.invoke('fs:writeFile', filePath, fileContent);
            console.log('Saved:', filePath);
          } catch (error) {
            console.error('Save failed:', error);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filePath, fileContent]);

  return (
    <div className="main-layout">
      <FileExplorer onFileSelect={handleFileSelect} />
      <CodeEditor value={fileContent} onChange={handleContentChange} />
    </div>
  );
};
