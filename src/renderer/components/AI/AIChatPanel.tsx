import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { Panel } from '../../types/panel';
import './AIChatPanel.css';

interface MessagePart {
  type: 'text' | 'thought' | 'tool_call' | 'error';
  content: string;
}
const grammerContext = `
なお、文章中の「|漢字《ルビ》」はルビ振りを示す記法、「《《傍点》》」は傍点を示す記法として扱ってください。
また、これらの記号、|《》等に関する指摘は不要です。
`;
interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  displayContent?: string; // For user message display
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      parts: [
        {
          type: 'thought',
          content: 'I should greet the user and offer help as a novel editing assistant.',
        },
        {
          type: 'text',
          content: 'Hello! I am your AI assistant specialized in novel editing. How can I help you with your story today?',
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
      finalContent = `Context (File: ${activePath}):\n\`\`\`\n${activeContent}\n\`\`\`\n\n${grammerContext}\n\nUser: ${input}`;
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
    );
  };

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-content">
        {messages.map((msg) => (
          <React.Fragment key={msg.id}>
            {msg.role === 'user' ? (
              <div className={`chat-message ${msg.role}`}>
                <div className="message-sender">You</div>
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
                      <div className="message-sender">AI Assistant</div>
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
          placeholder={isStreaming ? 'AI is typing...' : 'Ask AI...'}
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
            Include Editor Context
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
