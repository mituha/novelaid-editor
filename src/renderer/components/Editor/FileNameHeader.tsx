import React, { useState, useEffect, useRef } from 'react';
import './FileNameHeader.css';

interface FileNameHeaderProps {
  fileName: string;
  onRename: (newName: string) => void;
  isReadOnly?: boolean;
}

export const FileNameHeader: React.FC<FileNameHeaderProps> = ({
  fileName,
  onRename,
  isReadOnly = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(fileName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(fileName);
  }, [fileName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // inputRef.current.select(); // User requested to not select all
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    if (!isReadOnly) {
      setIsEditing(true);
      setValue(fileName);
    }
  };

  const handleCommit = () => {
    setIsEditing(false);
    if (value.trim() && value !== fileName) {
      onRename(value);
    } else {
        setValue(fileName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setValue(fileName);
    }
  };

  if (isEditing) {
    return (
      <div className="file-name-header editing">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
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
      title={isReadOnly ? 'Read only' : 'Click to rename'}
    >
      <span className="file-name-text">{fileName}</span>
    </div>
  );
};
