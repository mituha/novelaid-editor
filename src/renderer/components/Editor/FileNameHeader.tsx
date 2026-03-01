import React, { useState, useEffect, useRef } from 'react';
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
  const { getFileTitle } = useDocument();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(fileName);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    if (activePath) {
      getFileTitle(activePath).then((title) => {
        if (isMounted) {
          setDisplayName(title);
        }
      });
    } else {
      setDisplayName(fileName);
    }
    return () => {
      isMounted = false;
    };
  }, [activePath, fileName, getFileTitle]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    if (!isReadOnly) {
      setEditValue(displayName);
      setIsEditing(true);
    }
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
        if (e.key === 'Enter' || e.key === ' ') {
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
