import React, { useState, useEffect, useCallback } from 'react';
import { useGit } from '../../contexts/GitContext';
import './FileExplorerPanel.css';

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface FileExplorerProps {
  onFileSelect: (path: string, content: string) => void;
  onProjectOpened?: (path: string) => void;
}

function FileTreeItem({
  file,
  onFileSelect,
  level = 0,
  onRefresh,
}: {
  file: FileNode;
  onFileSelect: (path: string, content: string) => void;
  level?: number;
  onRefresh: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [creatingChildType, setCreatingChildType] = useState<
    'file' | 'folder' | null
  >(null);
  const [newChildName, setNewChildName] = useState('');

  const loadDirectory = useCallback(async () => {
    try {
      const fileList = await window.electron.ipcRenderer.invoke(
        'fs:readDirectory',
        file.path,
      );
      const sorted = (fileList as FileNode[]).sort((a, b) => {
        if (a.isDirectory === b.isDirectory)
          return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
      setChildren(sorted);
      setIsLoaded(true);
    } catch (err) {
      console.error('Failed to load directory', err);
    }
  }, [file.path]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.isDirectory) {
      if (!isOpen && (!isLoaded || children.length === 0)) {
        await loadDirectory();
      }
      setIsOpen(!isOpen);
    } else {
      try {
        const content = await window.electron.ipcRenderer.invoke(
          'fs:readFile',
          file.path,
        );
        onFileSelect(file.path, content as string);
      } catch (err) {
        console.error('Failed to read file', err);
      }
    }
  };

  const handleRename = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newName !== file.name) {
      try {
        const parentPath = file.path.substring(0, file.path.lastIndexOf('\\'));
        const newPath = `${parentPath}\\${newName}`;
        await window.electron.ipcRenderer.invoke('fs:rename', file.path, newPath);
        setIsRenaming(false);
        onRefresh();
      } catch (err) {
        console.error('Failed to rename', err);
      }
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setNewName(file.name);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await window.electron.ipcRenderer.invoke(
      'dialog:confirm',
      `Delete ${file.name}?`,
    );
    if (confirmed) {
      try {
        await window.electron.ipcRenderer.invoke('fs:delete', file.path);
        onRefresh();
      } catch (err) {
        console.error('Failed to delete', err);
      }
    }
  };

  const handleCreateChild = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newChildName) {
      try {
        const fullPath = `${file.path}\\${newChildName}`;
        if (creatingChildType === 'file') {
          await window.electron.ipcRenderer.invoke('fs:createFile', fullPath);
        } else {
          await window.electron.ipcRenderer.invoke(
            'fs:createDirectory',
            fullPath,
          );
        }
        setCreatingChildType(null);
        setNewChildName('');
        await loadDirectory();
        if (!isOpen) setIsOpen(true);
      } catch (err) {
        console.error(err);
      }
    } else if (e.key === 'Escape') {
      setCreatingChildType(null);
      setNewChildName('');
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
        {isRenaming ? (
          <input
            className="rename-input"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleRename}
            onBlur={() => {
              setIsRenaming(false);
              setNewName(file.name);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="name">{file.name}</span>
        )}
        <div className="actions">
          {file.isDirectory && (
            <>
              <button
                type="button"
                className="inline-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingChildType('file');
                }}
                title="New File"
              >
                📄+
              </button>
              <button
                type="button"
                className="inline-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingChildType('folder');
                }}
                title="New Folder"
              >
                📁+
              </button>
            </>
          )}
          <button
            type="button"
            className="inline-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsRenaming(true);
            }}
            title="Rename"
          >
            ✏️
          </button>
          <button
            type="button"
            className="inline-btn"
            onClick={handleDelete}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="children-list">
          {creatingChildType && (
            <div
              className="file-item"
              style={{ paddingLeft: `${15 + (level + 1) * 10}px` }}
            >
              <span className="icon">
                {creatingChildType === 'file' ? '📄' : '📁'}
              </span>
              <input
                className="rename-input"
                autoFocus
                value={newChildName}
                placeholder={`New ${creatingChildType}...`}
                onChange={(e) => setNewChildName(e.target.value)}
                onKeyDown={handleCreateChild}
                onBlur={() => {
                  setCreatingChildType(null);
                  setNewChildName('');
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              file={child}
              onFileSelect={onFileSelect}
              level={level + 1}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorerPanel({
  onFileSelect,
  onProjectOpened,
}: FileExplorerProps) {
  const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(
    null,
  );
  const [newName, setNewName] = useState('');
  const { currentDir, setCurrentDir } = useGit();

  const refreshRoot = useCallback(async () => {
    if (!currentDir) {
      setRootFiles([]);
      return;
    }
    try {
      const fileList = await window.electron.ipcRenderer.invoke(
        'fs:readDirectory',
        currentDir,
      );
      const sorted = (fileList as FileNode[]).sort((a, b) => {
        if (a.isDirectory === b.isDirectory)
          return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
      setRootFiles(sorted);
    } catch (error) {
      console.error(error);
    }
  }, [currentDir]);

  const handleOpenFolder = async () => {
    try {
      const path = await window.electron.ipcRenderer.invoke(
        'dialog:openDirectory',
      );
      if (path) {
        setCurrentDir(path);
        if (onProjectOpened) {
          onProjectOpened(path);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    refreshRoot();
  }, [currentDir, refreshRoot]);

  const handleCreate = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newName && currentDir) {
      try {
        const fullPath = `${currentDir}\\${newName}`;
        if (creatingType === 'file') {
          await window.electron.ipcRenderer.invoke('fs:createFile', fullPath);
        } else {
          await window.electron.ipcRenderer.invoke(
            'fs:createDirectory',
            fullPath,
          );
        }
        setCreatingType(null);
        setNewName('');
        refreshRoot();
      } catch (err) {
        console.error(err);
      }
    } else if (e.key === 'Escape') {
      setCreatingType(null);
      setNewName('');
    }
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <button type="button" className="open-btn" onClick={handleOpenFolder}>
          フォルダを開く
        </button>
        {currentDir && (
          <div className="explorer-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => setCreatingType('file')}
            >
              📄+
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => setCreatingType('folder')}
            >
              📁+
            </button>
          </div>
        )}
      </div>
      <div className="explorer-content">
        {creatingType && (
          <div className="file-item" style={{ paddingLeft: '15px' }}>
            <span className="icon">
              {creatingType === 'file' ? '📄' : '📁'}
            </span>
            <input
              className="rename-input"
              autoFocus
              value={newName}
              placeholder={`New ${creatingType}...`}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleCreate}
              onBlur={() => {
                setCreatingType(null);
                setNewName('');
              }}
            />
          </div>
        )}
        {rootFiles.map((file) => (
          <FileTreeItem
            key={file.path}
            file={file}
            onFileSelect={onFileSelect}
            onRefresh={refreshRoot}
          />
        ))}
      </div>
    </div>
  );
}
