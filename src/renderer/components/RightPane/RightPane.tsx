import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSettings } from '../../contexts/SettingsContext';
import './RightPane.css';

interface MessagePart {
  type: 'text' | 'thought' | 'tool_call' | 'error';
  content: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  displayContent?: string; // For user message display
}

interface RightPaneProps {
  activeContent?: string;
  activePath?: string | null;
}

export function RightPane({ activeContent, activePath }: RightPaneProps) {
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

  const parseOldContentToParts = (content: string): MessagePart[] => {
    const parts: MessagePart[] = [];
    let remaining = content;

    while (remaining.includes('<thought>')) {
      const startIndex = remaining.indexOf('<thought>');
      const before = remaining.substring(0, startIndex).trim();
      if (before) parts.push({ type: 'text', content: before });

      const contentStart = startIndex + '<thought>'.length;
      const endIndex = remaining.indexOf('</thought>', contentStart);

      if (endIndex === -1) {
        parts.push({
          type: 'thought',
          content: remaining.substring(contentStart),
        });
        remaining = '';
      } else {
        parts.push({
          type: 'thought',
          content: remaining.substring(contentStart, endIndex),
        });
        remaining = remaining.substring(endIndex + '</thought>'.length).trim();
      }
    }
    if (remaining) {
      parts.push({ type: 'text', content: remaining });
    }
    return parts;
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
    };
    setMessages((prev) => [...prev, assistantMessage]);

    // Setup listeners
    // We strictly use the channels defined in preload
    const removeDataListener = window.electron.ipcRenderer.on(
      'ai:streamChat:data',
      (chunk: { type: string; content: string }) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== assistantMsgId) return msg;

            const lastPart = msg.parts[msg.parts.length - 1];
            if (lastPart && lastPart.type === chunk.type) {
              // Append to existing part if same type
              const updatedParts = [...msg.parts];
              updatedParts[updatedParts.length - 1] = {
                ...lastPart,
                content: lastPart.content + chunk.content,
              };
              return { ...msg, parts: updatedParts };
            } else {
              // Create new part
              return {
                ...msg,
                parts: [
                  ...msg.parts,
                  {
                    type: chunk.type as MessagePart['type'],
                    content: chunk.content,
                  },
                ],
              };
            }
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
      (error) => {
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

    const cleanup = () => {
      removeDataListener();
      removeEndListener();
      removeErrorListener();
    };

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
    <div className="right-pane">
      <div className="right-pane-header">AI Agent</div>
      <div className="right-pane-content">
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
                      key={`${msg.id}-thought-${index}`}
                      className="chat-message assistant thought-bubble"
                    >
                      <div className="message-sender">AI Thought</div>
                      <details className="thought-container" open>
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
                      key={`${msg.id}-text-${index}`}
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
      <div className="right-pane-input-area">
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'AI is typing...' : 'Ask AI...'}
          disabled={isStreaming}
        />
        <div className="chat-options" style={{ marginTop: '5px' }}>
          <label
            style={{
              fontSize: '12px',
              color: '#ccc',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <input
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
