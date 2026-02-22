import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, User } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { PERSONAS, CHAT_ROLES } from '../../../common/constants/personas';
import NovelMarkdown from '../AI/NovelMarkdown';
import './ChView.css';

interface ChMessagePart {
  type: 'text' | 'thought' | 'tool_call' | 'error';
  content: string;
}

interface ChMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  agentId?: string;
  name?: string;
  content?: string; // For simple text messages
  parts?: ChMessagePart[]; // For structured messages
  timestamp: string; // yyyyMMddHHmmss
}

interface ChFileStructure {
  version: string;
  metadata: {
    title?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    defaultPersonaId?: string;
    defaultRoleId?: string;
    parameters?: Record<string, any>;
  };
  messages: ChMessage[];
}

interface ChViewProps {
  content: string;
  path: string;
  onContentChange: (newContent: string) => void;
}

const formatTimestamp = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${y}${m}${day}${h}${min}${s}`;
};

const displayTimestamp = (ts: string) => {
  if (ts.length !== 14) return ts;
  const y = ts.substring(0, 4);
  const m = ts.substring(4, 6);
  const d = ts.substring(6, 8);
  const h = ts.substring(8, 10);
  const min = ts.substring(10, 12);
  const s = ts.substring(12, 14);
  return `${y}/${m}/${d} ${h}:${min}:${s}`;
};

export default function ChView({ content, path, onContentChange }: ChViewProps) {
  const { settings } = useSettings();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [fileData, setFileData] = useState<ChFileStructure | null>(null);
  const activeAssistantMsgIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize file data
  useEffect(() => {
    try {
      if (!content || content.trim() === '') {
        const initialData: ChFileStructure = {
          version: '1.0',
          metadata: {
            createdAt: formatTimestamp(),
            updatedAt: formatTimestamp(),
            defaultPersonaId: '',
            defaultRoleId: 'assistant',
          },
          messages: [],
        };
        setFileData(initialData);
        return;
      }
      const parsed = JSON.parse(content);
      setFileData(parsed);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse .ch file', e);
    }
  }, [content, path]); // Re-run when content or path changes (path change handled by key mostly)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [fileData?.messages]);

  const saveFile = useCallback(
    (newData: ChFileStructure) => {
      const updated = {
        ...newData,
        metadata: {
          ...newData.metadata,
          updatedAt: formatTimestamp(),
        },
      };
      onContentChange(JSON.stringify(updated, null, 2));
    },
    [onContentChange],
  );

  // Listen for AI streaming
  useEffect(() => {
    const cleanupData = window.electron.ipcRenderer.on(
      'ai:streamChat:data',
      (chunk: any, resPath: any) => {
        if (resPath !== path) return;
        setFileData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) => {
              if (m.id !== activeAssistantMsgIdRef.current) return m;
              const parts = m.parts || [];
              const lastPart = parts[parts.length - 1];
              if (lastPart && lastPart.type === chunk.type) {
                const newParts = [...parts];
                newParts[newParts.length - 1] = {
                  ...lastPart,
                  content: lastPart.content + chunk.content,
                };
                return { ...m, parts: newParts };
              }
              return { ...m, parts: [...parts, chunk] };
            }),
          };
        });
      },
    );

    const cleanupEnd = window.electron.ipcRenderer.on(
      'ai:streamChat:end',
      (resPath: any) => {
        if (resPath !== path) return;
        setIsStreaming(false);
        setFileData((current) => {
          if (current) saveFile(current);
          return current;
        });
      },
    );

    const cleanupError = window.electron.ipcRenderer.on(
      'ai:streamChat:error',
      (err: any, resPath: any) => {
        if (resPath !== path) return;
        setIsStreaming(false);
        // eslint-disable-next-line no-console
        console.error('Stream error:', err);
      },
    );

    return () => {
      if (cleanupData) cleanupData();
      if (cleanupEnd) cleanupEnd();
      if (cleanupError) cleanupError();
    };
  }, [path, saveFile]);

  const handleSend = () => {
    if (!input.trim() || isStreaming || !fileData) return;

    const userMsg: ChMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: formatTimestamp(),
    };

    const assistantMsgId = (Date.now() + 1).toString();
    activeAssistantMsgIdRef.current = assistantMsgId;

    const assistantMsg: ChMessage = {
      id: assistantMsgId,
      role: 'assistant',
      agentId: fileData.metadata.defaultPersonaId,
      parts: [],
      timestamp: formatTimestamp(),
    };

    const nextData: ChFileStructure = {
      ...fileData,
      messages: [...fileData.messages, userMsg, assistantMsg],
    };

    setFileData(nextData);
    saveFile(nextData); // Save immediately to parent
    setInput('');
    setIsStreaming(true);

    // Prepare API messages
    const apiMessages = [...fileData.messages, userMsg].map((m) => ({
      role: m.role,
      content: m.parts
        ? m.parts.map((p) => p.content).join('')
        : m.content || '',
    }));

    window.electron.ipcRenderer.sendMessage(
      'ai:streamChat',
      apiMessages,
      settings.ai || {},
      fileData.metadata.defaultPersonaId,
      fileData.metadata.defaultRoleId,
      path,
    );
  };

  if (!fileData) return <div className="ch-view-loading">読み込み中...</div>;

  return (
    <div className="ch-view">
      <div className="ch-header">
        <div className="ch-selectors">
          <div className="ch-persona-selector">
            <Bot size={16} />
            <select
              value={fileData.metadata.defaultPersonaId}
              onChange={(e) => {
                const next: ChFileStructure = {
                  ...fileData,
                  metadata: {
                    ...fileData.metadata,
                    defaultPersonaId: e.target.value,
                  },
                };
                setFileData(next);
                saveFile(next);
              }}
            >
              <option value="">ペルソナなし</option>
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ch-role-selector">
            <User size={16} />
            <select
              value={fileData.metadata.defaultRoleId}
              onChange={(e) => {
                const next: ChFileStructure = {
                  ...fileData,
                  metadata: {
                    ...fileData.metadata,
                    defaultRoleId: e.target.value,
                  },
                };
                setFileData(next);
                saveFile(next);
              }}
            >
              {CHAT_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ch-title">
          {fileData.metadata.title || path.split(/[/\\]/).pop()}
        </div>
      </div>

      <div className="ch-messages">
        {fileData.messages.map((msg) => (
          <div key={msg.id} className={`ch-message-row ${msg.role}`}>
            <div className={`ch-message-bubble ${msg.role}`}>
              {msg.role === 'user' ? (
                <div className="ch-message-text">{msg.content}</div>
              ) : (
                <div className="ch-message-parts">
                  {msg.parts?.map((part, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div
                      key={`${msg.id}-part-${i}`}
                      className={`part-${part.type}`}
                    >
                      {part.type === 'thought' ? (
                        <details className="ch-thought">
                          <summary>Thinking...</summary>
                          <div className="ch-thought-content">
                            {part.content}
                          </div>
                        </details>
                      ) : (
                        <NovelMarkdown content={part.content} />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="ch-timestamp">
                {displayTimestamp(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="ch-input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isStreaming ? 'AI生成中...' : 'メッセージを入力...'}
          disabled={isStreaming}
        />
      </div>
    </div>
  );
}
