import React, { useState, useEffect, useRef, useMemo } from 'react';
import './FileNameHeader.css';

import { useDocument } from '../../contexts/DocumentContext';

interface FileNameHeaderProps {
  fileName: string; // fallback name
  activePath: string | null;
  onRename: (newName: string) => void;
  isReadOnly?: boolean;
}

export const FileNameHeader: React.FC<FileNameHeaderProps> = ({
  fileName,
  activePath,
  onRename,
  isReadOnly = false,
}) => {
  const { getFileTitle, activeTabItem, openDocuments } = useDocument();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(fileName);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const activeDoc = useMemo(() => {
    const path = activeTabItem?.path;
    return path ? openDocuments.find(d => d.path === path) : null;
  }, [activeTabItem, openDocuments]);

  useEffect(() => {
    if (activeDoc) {
      setDisplayName(activeDoc.name);
    } else if (activeTabItem?.path) {
      getFileTitle(activeTabItem.path).then(setDisplayName);
    } else {
      setDisplayName(fileName);
    }
  }, [activeTabItem, activeDoc, getFileTitle, fileName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    if (isReadOnly || isEditing || activeDoc?.documentType === 'gitDiff') return;
    setEditValue(displayName);
    setIsEditing(true);
  };

  const handleCommit = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== displayName) {
      onRename(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="file-name-header editing">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          className="file-name-input"
        />
      </div>
    );
  }

  return (
    <div
      className={`file-name-header ${isReadOnly ? 'readonly' : ''}`}
      onClick={handleStartEditing}
      onKeyDown={(e) => {
        if (activeDoc?.documentType !== 'gitDiff' && (e.key === 'Enter' || e.key === ' ')) {
          handleStartEditing();
        }
      }}
      title={isReadOnly ? 'Read only' : 'Click to rename'}
      role="button"
      tabIndex={0}
    >
      <span className="file-name-text">{displayName}</span>
    </div>
  );
};
