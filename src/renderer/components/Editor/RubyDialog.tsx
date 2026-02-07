import React, { useState, useEffect, useRef } from 'react';
import './RubyDialog.css';

interface RubyDialogProps {
  isOpen: boolean;
  initialText: string;
  onConfirm: (ruby: string) => void;
  onCancel: () => void;
}

export default function RubyDialog({
  isOpen,
  initialText,
  onConfirm,
  onCancel,
}: RubyDialogProps) {
  const [ruby, setRuby] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRuby('');
      // 少し遅延させないとフォーカスが当たらない場合がある
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm(ruby);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="ruby-dialog-overlay"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onCancel();
      }}
      role="presentation"
    >
      <div
        className="ruby-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="none"
      >
        <h3>ルビを振る</h3>
        <div className="ruby-dialog-target">
          対象: <strong>{initialText}</strong>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={ruby}
          onChange={(e) => setRuby(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="読みを入力..."
          className="ruby-dialog-input"
        />
        <div className="ruby-dialog-actions">
          <button type="button" onClick={onCancel} className="ruby-btn-cancel">
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(ruby)}
            className="ruby-btn-confirm"
            disabled={!ruby.trim()}
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}
