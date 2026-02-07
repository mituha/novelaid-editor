import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SpellCheck, ClipboardCheck, Send } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import './AIProofreaderPanel.css';

interface MessagePart {
  type: 'text' | 'thought' | 'tool_call' | 'error';
  content: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  displayContent?: string;
}

interface AIProofreaderPanelProps {
  activeContent?: string;
  activePath?: string | null;
}

type ProofreadingMode = 'typo' | 'style' | 'editor';

interface ProofreadingAction {
  id: ProofreadingMode;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const ACTIONS: ProofreadingAction[] = [
  {
    id: 'typo',
    label: '誤字脱字',
    icon: <SpellCheck size={16} />,
    prompt:
      '以下の文章の誤字脱字、送り仮名のミス、重複表現等を指摘してください。形式は箇条書きで、修正案も提示してください。',
  },
  {
    id: 'style',
    label: '文体・リズム',
    icon: <ClipboardCheck size={16} />,
    prompt:
      '以下の文章の文体（ですます調、だである調の混在）、文章のリズム、語彙の適切さを分析し、改善案を提案してください。',
  },
  {
    id: 'editor',
    label: '編集者講評',
    icon: <ClipboardCheck size={16} />,
    prompt:
      'プロの小説編集者の視点から、プロット、キャラクターの魅力、文章力を多角的に評価し、具体的な講評とアドバイスを行ってください。',
  },
];

export function AIProofreaderPanel({
  activeContent,
  activePath,
}: AIProofreaderPanelProps) {
  const { settings } = useSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const startSession = useCallback(
    (newMessages: Message[]) => {
      setMessages(newMessages);
      setIsStreaming(true);
      setInput('');

      const assistantMsgId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMsgId,
        role: 'assistant',
        parts: [],
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const cleanup = () => {
        removeDataListener();
        removeEndListener();
        removeErrorListener();
      };

      const removeDataListener = window.electron.ipcRenderer.on(
        'ai:streamChat:data',
        (chunk: unknown) => {
          const typedChunk = chunk as { type: string; content: string };
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMsgId) return msg;

              const lastPart = msg.parts[msg.parts.length - 1];
              if (lastPart && lastPart.type === typedChunk.type) {
                const updatedParts = [...msg.parts];
                updatedParts[updatedParts.length - 1] = {
                  ...lastPart,
                  content: lastPart.content + typedChunk.content,
                };
                return { ...msg, parts: updatedParts };
              }
              return {
                ...msg,
                parts: [
                  ...msg.parts,
                  {
                    type: typedChunk.type as MessagePart['type'],
                    content: typedChunk.content,
                  },
                ],
              };
            }),
          );
        },
      );

      const removeEndListener = window.electron.ipcRenderer.on(
        'ai:streamChat:end',
        () => {
          setIsStreaming(false);
          cleanup();
        },
      );

      const removeErrorListener = window.electron.ipcRenderer.on(
        'ai:streamChat:error',
        (error: unknown) => {
          console.error('Stream error:', error);
          setIsStreaming(false);
          cleanup();
        },
      );

      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.parts.map((p) => p.content).join(''),
      }));

      window.electron.ipcRenderer.sendMessage(
        'ai:streamChat',
        apiMessages,
        settings.ai || {},
      );
    },
    [settings.ai],
  );

  const handleAction = (action: ProofreadingAction) => {
    if (!activeContent || isStreaming) return;

    const fullPrompt = `${action.prompt}\n\n対象テキスト (File: ${activePath || 'Untitled'}):\n\`\`\`\n${activeContent}\n\`\`\``;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', content: fullPrompt }],
      displayContent: `${action.label}を開始しました`,
    };

    startSession([...messages, userMessage]);
  };

  const handleSendChat = () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', content: input }],
      displayContent: input,
    };

    startSession([...messages, userMessage]);
  };

  return (
    <div className="proofreader-panel">
      <div className="proofreader-header">
        <div className="action-buttons">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className="action-btn"
              onClick={() => handleAction(action)}
              disabled={isStreaming || !activeContent}
              title={action.label}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="proofreader-results">
        {messages.length === 0 && (
          <div className="empty-state">
            <ClipboardCheck size={48} opacity={0.2} />
            <p>校正アクションを選択して開始してください</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`proofreader-msg ${msg.role}`}>
            {msg.parts.map((part, idx) => (
              <div key={idx} className={`part-type-${part.type}`}>
                {part.type === 'thought' ? (
                  <details className="thought-details">
                    <summary>思考プロセス</summary>
                    <div className="thought-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {part.content}
                      </ReactMarkdown>
                    </div>
                  </details>
                ) : (
                  <div className="text-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {part.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="proofreader-input-area">
        <div className="chat-input-wrapper">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="校正結果について質問する..."
            disabled={isStreaming}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendChat();
              }
            }}
          />
          <button
            type="button"
            className="send-btn"
            onClick={handleSendChat}
            disabled={isStreaming || !input.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
