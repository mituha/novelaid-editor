import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, User, Bot, Loader2, Sparkles } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { Panel } from '../../types/panel';
import { PERSONAS, Persona } from '../../../common/constants/personas';
import './AIChatPanel.css';

interface MessagePart {
  type: 'text' | 'thought' | 'tool_call' | 'error';
  content: string;
}
const grammerContext = ''; // Retired, handled by system prompt in backend
interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  displayContent?: string; // For user message display
  personaId?: string; // ID of the persona that sent this (if assistant)
}

interface AIChatPanelProps {
  activeContent?: string;
  activePath?: string | null;
}

export default function AIChatPanel({
  activeContent = '',
  activePath = null,
}: AIChatPanelProps) {
  const { settings } = useSettings();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(''); // Empty means "None"
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      parts: [
        {
          type: 'thought',
          content: '小説執筆の助手として、ユーザーに挨拶し、お手伝いを申し出ます。',
        },
        {
          type: 'text',
          content: 'こんにちは！小説執筆・編集専門のAIアシスタントです。本日はどのようなお手伝いをしましょうか？',
        },
      ],
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;

    let finalContent = input;

    // Attach context if enabled and available
    if (includeContext && activeContent && activePath) {
      finalContent = `Context (File: ${activePath}):\n\`\`\`\n${activeContent}\n\`\`\`\n\nUser: ${input}`;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', content: finalContent }],
      displayContent: input, // This is the content shown in the UI for user messages
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    // Prepare for assistant response
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      parts: [],
      personaId: selectedPersonaId,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    let removeDataListener: (() => void) | undefined;
    let removeEndListener: (() => void) | undefined;
    let removeErrorListener: (() => void) | undefined;

    const cleanup = () => {
      if (removeDataListener) removeDataListener();
      if (removeEndListener) removeEndListener();
      if (removeErrorListener) removeErrorListener();
    };

    // Setup listeners
    // We strictly use the channels defined in preload
    removeDataListener = window.electron.ipcRenderer.on(
      'ai:streamChat:data',
      (chunk: unknown) => {
        const typedChunk = chunk as { type: string; content: string };
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== assistantMsgId) return msg;

            const lastPart = msg.parts[msg.parts.length - 1];
            if (lastPart && lastPart.type === typedChunk.type) {
              // Append to existing part if same type
              const updatedParts = [...msg.parts];
              updatedParts[updatedParts.length - 1] = {
                ...lastPart,
                content: lastPart.content + typedChunk.content,
              };
              return { ...msg, parts: updatedParts };
            }
            // Create new part
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

    removeEndListener = window.electron.ipcRenderer.on(
      'ai:streamChat:end',
      () => {
        setIsStreaming(false);
        cleanup();
      },
    );

    removeErrorListener = window.electron.ipcRenderer.on(
      'ai:streamChat:error',
      (error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Stream error:', error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  parts: [
                    ...msg.parts,
                    { type: 'error', content: `\n[Error: ${error}]` },
                  ],
                }
              : msg,
          ),
        );
        setIsStreaming(false);
        cleanup();
      },
    );

    // Send request
    const apiMessages = newMessages.map((m) => {
      // For API, we merge parts back into a string or handle as structured (future-proof)
      // For existing providers, we still expect content as a string
      const content = m.parts.map((p) => p.content).join(''); // This is simplified, context might need specialized handling
      return {
        role: m.role,
        content: content,
      };
    });

    window.electron.ipcRenderer.sendMessage(
      'ai:streamChat',
      apiMessages,
      settings.ai || {},
      selectedPersonaId,
    );
  };

  const renderPersonaIcon = (persona?: Persona, size = 16) => {
    if (!persona) return <Bot size={size} />;

    const { icon } = persona;
    if (icon.type === 'lucide') {
      const LucideIcon = (LucideIcons as any)[icon.value] || Bot;
      return <LucideIcon size={size} />;
    }
    if (icon.type === 'local') {
      // For local assets, we might need to resolve the path
      // In dev, relative to public/ or assets/ might work depending on setup
      // Usually ERB serves from .erb/dll or similar.
      // Let's try direct path as it's often served or handled by file protocol if using custom resolver.
      // But for a simple img, if we are in dev, we might need a better way.
      // However, the user said "assets/icons/64x64.png".
      return (
        <div className="persona-icon">
          <img src={`../../../../${icon.value}`} alt={persona.name} />
        </div>
      );
    }
    if (icon.type === 'url') {
      return (
        <div className="persona-icon">
          <img src={icon.value} alt={persona.name} />
        </div>
      );
    }
    return <Bot size={size} />;
  };

  const getPersonaName = (pId?: string) => {
    if (!pId) return 'AI Assistant';
    const persona = PERSONAS.find((p) => p.id === pId);
    return persona ? persona.name : 'AI Assistant';
  };

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <div className="persona-selector">
          <Sparkles size={14} style={{ color: '#aaa' }} />
          <select
            value={selectedPersonaId}
            onChange={(e) => setSelectedPersonaId(e.target.value)}
          >
            <option value="">ペルソナなし</option>
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="ai-chat-content">
        {messages.map((msg) => (
          <React.Fragment key={msg.id}>
            {msg.role === 'user' ? (
              <div className={`chat-message ${msg.role}`}>
                <div className="message-sender">
                  <User size={16} /> You
                </div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.displayContent ||
                    msg.parts.map((p) => p.content).join('')}
                </ReactMarkdown>
              </div>
            ) : (
              <>
                {msg.parts.map((part, index) =>
                  part.type === 'thought' ? (
                    <div
                      key={`${msg.id}-thought-${part.type}-${index}`}
                      className="chat-message assistant thought-bubble"
                    >
                      <div className="message-sender">AI Thought</div>
                      <details className="thought-container">
                        <summary>Thinking...</summary>
                        <div className="thought-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {part.content}
                          </ReactMarkdown>
                        </div>
                      </details>
                    </div>
                  ) : (
                    <div
                      key={`${msg.id}-text-${part.type}-${index}`}
                      className="chat-message assistant"
                    >
                      <div className="message-sender">
                        {renderPersonaIcon(
                          PERSONAS.find((p) => p.id === msg.personaId),
                        )}
                        {getPersonaName(msg.personaId)}
                      </div>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {part.content}
                      </ReactMarkdown>
                    </div>
                  ),
                )}
              </>
            )}
          </React.Fragment>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-chat-input-area">
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'AIが入力中...' : 'AIに相談する...'}
          disabled={isStreaming}
        />
        <div className="chat-options" style={{ marginTop: '5px' }}>
          <label
            htmlFor="include-context-checkbox"
            style={{
              fontSize: '12px',
              color: '#ccc',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <input
              id="include-context-checkbox"
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
            />
            エディターのコンテキストを含める
          </label>
        </div>
      </div>
    </div>
  );
}

export const aiChatPanelConfig: Panel = {
  id: 'ai-chat',
  title: 'AIチャット',
  icon: <MessageSquare size={24} strokeWidth={1.5} />,
  component: AIChatPanel,
  defaultLocation: 'right',
};
