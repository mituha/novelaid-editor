import React, { useState } from 'react';
import './FileExplorer.css';

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface FileExplorerProps {
  onFileSelect: (path: string, content: string) => void;
  onProjectOpened?: (path: string) => void;
}

const FileTreeItem = ({ file, onFileSelect, level = 0 }: { file: FileNode; onFileSelect: (path: string, content: string) => void; level?: number }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.isDirectory) {
      if (!isOpen && !isLoaded) {
         try {
             const fileList = await window.electron.ipcRenderer.invoke('fs:readDirectory', file.path);
             const sorted = (fileList as FileNode[]).sort((a, b) => {
                 if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                 return a.isDirectory ? -1 : 1;
             });
             setChildren(sorted);
             setIsLoaded(true);
         } catch (err) {
             console.error("Failed to load directory", err);
         }
      }
      setIsOpen(!isOpen);
    } else {
        try {
          const content = await window.electron.ipcRenderer.invoke('fs:readFile', file.path);
          onFileSelect(file.path, content as string);
        } catch (err) {
          console.error("Failed to read file", err);
        }
    }
  };

  return (
    <div>
        <div
            className={`file-item ${file.isDirectory ? 'directory' : 'file'}`}
            style={{ paddingLeft: `${15 + level * 10}px` }}
            onClick={handleToggle}
        >
            <span className="icon">
                {file.isDirectory ? (isOpen ? '📂' : '📁') : '📄'}
            </span>
            <span className="name">{file.name}</span>
        </div>
        {isOpen && children.map(child => (
            <FileTreeItem key={child.path} file={child} onFileSelect={onFileSelect} level={level + 1} />
        ))}
    </div>
  );
};

export const FileExplorer = ({ onFileSelect, onProjectOpened }: FileExplorerProps) => {
  const [rootFiles, setRootFiles] = useState<FileNode[]>([]);

  const handleOpenFolder = async () => {
    try {
      const path = await window.electron.ipcRenderer.invoke('dialog:openDirectory');
      if (path) {
        if (onFileSelect && (onProjectOpened as any)) { // Simply checking if exists? onProjectOpened is not in destructuring yet.
           // wait, i need to destructure it in component args.
        }
        const fileList = await window.electron.ipcRenderer.invoke('fs:readDirectory', path);
        const sorted = (fileList as FileNode[]).sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
            return a.isDirectory ? -1 : 1;
        });
        setRootFiles(sorted);
        if (onProjectOpened) {
            onProjectOpened(path);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <button className="open-btn" onClick={handleOpenFolder}>フォルダを開く</button>
      </div>
      <div className="explorer-content">
        {rootFiles.map((file) => (
            <FileTreeItem key={file.path} file={file} onFileSelect={onFileSelect} />
        ))}
      </div>
    </div>
  );
};
