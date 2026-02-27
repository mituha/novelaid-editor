import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import NovelMarkdown from '../AI/NovelMarkdown';
import './ChView.css';
import { usePersonas } from '../../hooks/usePersonas';
import PersonaSelector from '../AI/PersonaSelector';
import RoleSelector from '../AI/RoleSelector';
import PersonaIcon from '../AI/PersonaIcon';
import AIContextSelector from '../AI/AIContextSelector';
import { useAIContextContent } from '../../hooks/useAIContextContent';
import { useAutoResize } from '../../hooks/useAutoResize';
import ChatMessageList, { ChatMessage } from '../Chat/ChatMessageList';

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
  messages: ChatMessage[];
}

interface Tab {
  name: string;
  path: string;
}

interface ChViewProps {
  content: string;
  path: string;
  onContentChange: (newContent: string) => void;
  leftActivePath: string | null;
  rightActivePath: string | null;
  leftTabs: Tab[];
  rightTabs: Tab[];
  documents: Record<string, any>;
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

export default function ChView({
  content,
  path,
  onContentChange,
  leftActivePath,
  rightActivePath,
  leftTabs,
  rightTabs,
  documents: documents,
}: ChViewProps) {
  const { settings } = useSettings();
  const { allPersonas, staticPersonas, dynamicPersonas } = usePersonas();
  const { getContextText } = useAIContextContent();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [fileData, setFileData] = useState<ChFileStructure | null>(null);
  const activeAssistantMsgIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useAutoResize(textareaRef, input);

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

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !fileData) return;

    // AIコンテキストの収集
    const contextText = await getContextText(
      leftActivePath,
      rightActivePath,
      leftTabs,
      rightTabs,
      documents,
    );

    let finalInput = input;
    if (contextText) {
      finalInput = `Context:\n${contextText}\nUser: ${input}`;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: formatTimestamp(),
    };

    const assistantMsgId = (Date.now() + 1).toString();
    activeAssistantMsgIdRef.current = assistantMsgId;

    const assistantMsg: ChatMessage = {
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
    const apiMessages = fileData.messages.map((m) => ({
      role: m.role,
      content: m.parts
        ? m.parts.map((p) => p.content).join('')
        : m.content || '',
    }));
    // ユーザーメッセージにコンテキストを込めて送る
    apiMessages.push({
      role: 'user',
      content: finalInput,
    });

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
          <PersonaSelector
            selectedPersonaId={fileData.metadata.defaultPersonaId || ''}
            onPersonaChange={(id) => {
              const next: ChFileStructure = {
                ...fileData,
                metadata: {
                  ...fileData.metadata,
                  defaultPersonaId: id,
                },
              };
              setFileData(next);
              saveFile(next);
            }}
            staticPersonas={staticPersonas}
            dynamicPersonas={dynamicPersonas}
          />
          <RoleSelector
            selectedRoleId={fileData.metadata.defaultRoleId || 'assistant'}
            onRoleChange={(id) => {
              const next: ChFileStructure = {
                ...fileData,
                metadata: {
                  ...fileData.metadata,
                  defaultRoleId: id,
                },
              };
              setFileData(next);
              saveFile(next);
            }}
          />
        </div>
        <div className="ch-title">
          {fileData.metadata.title || path.split(/[/\\]/).pop()}
        </div>
      </div>

      <ChatMessageList
        messages={fileData.messages}
        allPersonas={allPersonas}
      />

      <div className="ch-input-area">
        <textarea
          ref={textareaRef}
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
          rows={1}
        />
        <AIContextSelector
          leftActivePath={leftActivePath}
          rightActivePath={rightActivePath}
          leftTabs={leftTabs}
          rightTabs={rightTabs}
        />
      </div>
    </div>
  );
}
