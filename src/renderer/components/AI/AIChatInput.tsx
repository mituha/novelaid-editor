import React, { useRef } from 'react';
import { Send } from 'lucide-react';
import { useAutoResize } from '../../hooks/useAutoResize';
import AIContextSelector from './AIContextSelector';
import './AIChatInput.css';

interface Tab {
  name: string;
  path: string;
}

interface AIChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  placeholder?: string;
  showContextSelector?: boolean;
  leftActivePath?: string | null;
  rightActivePath?: string | null;
  leftTabs?: Tab[];
  rightTabs?: Tab[];
}

export default function AIChatInput({
  value,
  onChange,
  onSend,
  isStreaming,
  placeholder = 'メッセージを入力...',
  showContextSelector = true,
  leftActivePath = null,
  rightActivePath = null,
  leftTabs = [],
  rightTabs = [],
}: AIChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useAutoResize(textareaRef, value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="ai-chat-input-container">
      <div className="ai-chat-input-wrapper">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'AI生成中...' : placeholder}
          disabled={isStreaming}
          rows={1}
          className="ai-chat-textarea"
        />
        <button
          type="button"
          className="ai-chat-send-btn"
          onClick={onSend}
          disabled={isStreaming || !value.trim()}
          title="送信 (Enter)"
        >
          <Send size={16} />
        </button>
      </div>
      {showContextSelector && (
        <div className="ai-chat-input-options">
          <AIContextSelector
            leftActivePath={leftActivePath}
            rightActivePath={rightActivePath}
            leftTabs={leftTabs}
            rightTabs={rightTabs}
          />
        </div>
      )}
    </div>
  );
}
