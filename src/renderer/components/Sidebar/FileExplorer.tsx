import React, { useState } from 'react';
import './FileExplorer.css';

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface FileExplorerProps {
  onFileSelect: (path: string, content: string) => void;
}

export const FileExplorer = ({ onFileSelect }: FileExplorerProps) => {
  const [files, setFiles] = useState<FileNode[]>([]);

  const handleOpenFolder = async () => {
    try {
      const path = await window.electron.ipcRenderer.invoke('dialog:openDirectory');
      if (path) {
        const fileList = await window.electron.ipcRenderer.invoke('fs:readDirectory', path);
        // Basic sorting: directories first
        const sorted = (fileList as FileNode[]).sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
            return a.isDirectory ? -1 : 1;
        });
        setFiles(sorted);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileClick = async (file: FileNode) => {
    if (!file.isDirectory) {
        const content = await window.electron.ipcRenderer.invoke('fs:readFile', file.path);
        onFileSelect(file.path, content as string);
    }
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <button className="open-btn" onClick={handleOpenFolder}>フォルダを開く</button>
      </div>
      <div className="explorer-content">
        {files.map((file) => (
          <div
            key={file.path}
            className={`file-item ${file.isDirectory ? 'directory' : 'file'}`}
            onClick={() => handleFileClick(file)}
          >
            <span className="icon">{file.isDirectory ? '📁' : '📄'}</span>
            <span className="name">{file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
