import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { Panel } from '../../types/panel';
import {
  Persona,
  CHAT_ROLES,
} from '../../../common/constants/personas';
import './AIChatPanel.css';
import NovelMarkdown from './NovelMarkdown';
import { usePersonas } from '../../hooks/usePersonas';
import PersonaIcon from './PersonaIcon';
import PersonaSelector from './PersonaSelector';
import RoleSelector from './RoleSelector';
import AIContextSelector from './AIContextSelector';
import { useAIContextContent } from '../../hooks/useAIContextContent';
import { useAutoResize } from '../../hooks/useAutoResize';

interface Tab {
  name: string;
  path: string;
}

interface MessagePart {
  type: 'text' | 'thought' | 'tool_call' | 'error';
  content: string;
}
// grammerContext removed, handled by system prompt in backend
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system'; // 'system' for UI markers
  parts: MessagePart[];
  displayContent?: string;
  personaId?: string;
  timestamp: number;
}


interface AIChatPanelProps {
  activeContent: string;
  activePath: string | null;
  leftActivePath: string | null;
  rightActivePath: string | null;
  leftTabs: Tab[];
  rightTabs: Tab[];
  tabContents: Record<string, any>;
}

export default function AIChatPanel({
  leftActivePath,
  rightActivePath,
  leftTabs,
  rightTabs,
  tabContents,
}: AIChatPanelProps) {
  const { settings } = useSettings();
  const { allPersonas, staticPersonas, dynamicPersonas } = usePersonas();
  const { getContextText } = useAIContextContent();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(''); // Empty means "None"
  const [selectedRoleId, setSelectedRoleId] = useState<string>('assistant');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useAutoResize(textareaRef, input);

  const getInitialMessages = useCallback(
    () => [
      {
        id: '1',
        role: 'assistant' as const,
        parts: [
          {
            type: 'thought' as const,
            content:
              '小説執筆の助手として、ユーザーに挨拶し、お手伝いを申し出ます。',
          },
          {
            type: 'text' as const,
            content:
              'こんにちは！小説執筆・編集専門のAIアシスタントです。本日はどのようなお手伝いをしましょうか？',
          },
        ],
        timestamp: Date.now(),
      },
    ],
    [],
  );

  const [messages, setMessages] = useState<Message[]>(getInitialMessages());
  const [contextStartIndex, setContextStartIndex] = useState(0);
  const [pendingContextReset, setPendingContextReset] = useState(false);

  // Mark context break when persona or role changes
  useEffect(() => {
    // If we have history beyond the initial greeting, mark for reset on next send
    if (messages.length > 1) {
      setPendingContextReset(true);
    }
    setInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersonaId, selectedRoleId]);

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

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    let finalContent = input;

    // AIコンテキストの収集
    const contextText = await getContextText(
      leftActivePath,
      rightActivePath,
      leftTabs,
      rightTabs,
      tabContents,
    );

    if (contextText) {
      finalContent = `Context:\n${contextText}\nUser: ${input}`;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', content: finalContent }],
      displayContent: input,
      timestamp: Date.now(),
    };

    let newMessages = [...messages];
    let newContextStartIndex = contextStartIndex;

    // Inject separator if context reset is pending
    if (pendingContextReset) {
      const roleName =
        CHAT_ROLES.find((r) => r.id === selectedRoleId)?.name || selectedRoleId;
      const persona = allPersonas.find(
        (p: Persona) => p.id === selectedPersonaId,
      );
      const personaName = persona?.name || 'なし';

      const separatorMessage: Message = {
        id: `sep-${Date.now()}`,
        role: 'system',
        parts: [
          {
            type: 'text',
            content: `${roleName} / ${personaName}`,
          },
        ],
        timestamp: Date.now(),
      };

      newContextStartIndex = newMessages.length + 1; // Index after separator
      newMessages = [...newMessages, separatorMessage, userMessage];
      setPendingContextReset(false);
      setContextStartIndex(newContextStartIndex);
    } else {
      newMessages = [...newMessages, userMessage];
    }

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
      timestamp: Date.now(),
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

    // Send request (only messages after newContextStartIndex)
    const apiMessages = newMessages
      .slice(newContextStartIndex)
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const content = m.parts.map((p) => p.content).join('');
        return {
          role: m.role,
          content,
        };
      });

    window.electron.ipcRenderer.sendMessage(
      'ai:streamChat',
      apiMessages,
      settings.ai || {},
      selectedPersonaId,
      selectedRoleId,
    );
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    if (isToday) return timeStr;

    return `${d.getFullYear()}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${timeStr}`;
  };

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <div className="selectors-row">
          <PersonaSelector
            selectedPersonaId={selectedPersonaId}
            onPersonaChange={setSelectedPersonaId}
            staticPersonas={staticPersonas}
            dynamicPersonas={dynamicPersonas}
          />
          <RoleSelector
            selectedRoleId={selectedRoleId}
            onRoleChange={setSelectedRoleId}
          />
        </div>
      </div>
      <div className="ai-chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.role}`}>
            {msg.role === 'system' ? (
              <div className="system-separator">
                <div className="line" />
                <span>{msg.parts[0].content}</span>
                <div className="line" />
              </div>
            ) : (
              <>
                {msg.role === 'assistant' && (
                  <div className="message-avatar">
                    <PersonaIcon
                      persona={allPersonas.find((p) => p.id === msg.personaId)}
                    />
                  </div>
                )}
                <div className="message-content-col">
                  <div className="message-bubble-group">
                    <div className={`message-bubble ${msg.role}`}>
                      {msg.role === 'user' ? (
                        <div className="message-text">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.displayContent ||
                              msg.parts.map((p) => p.content).join('')}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="message-parts">
                          {msg.parts.map((part, index) =>
                            part.type === 'thought' ? (
                              <div
                                /* eslint-disable-next-line react/no-array-index-key */
                                key={`part-thought-${msg.id}-${part.type}-${index}`}
                                className="thought-bubble"
                              >
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
                                /* eslint-disable-next-line react/no-array-index-key */
                                key={`part-text-${msg.id}-${part.type}-${index}`}
                                className="message-text"
                              >
                                <NovelMarkdown content={part.content} />
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                    <div className="message-timestamp">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-chat-input-area">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'AIが入力中...' : 'AIに相談する...'}
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

export const aiChatPanelConfig: Panel = {
  id: 'ai-chat',
  title: 'AIチャット',
  icon: <MessageSquare size={24} strokeWidth={1.5} />,
  component: AIChatPanel,
  defaultLocation: 'right',
};

// No default props needed for required ones
