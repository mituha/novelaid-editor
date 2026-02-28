import React, { useEffect, useRef, useCallback } from 'react';
import NovelMarkdown from '../AI/NovelMarkdown';
import PersonaIcon from '../AI/PersonaIcon';
import './ChatMessageList.css';

export interface ChatMessagePart {
  type: 'text' | 'thought' | 'tool_call' | 'error';
  content: string;
  metadata?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  agentId?: string;
  name?: string;
  content?: string;
  parts?: ChatMessagePart[];
  displayContent?: string;
  timestamp?: string | number;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  allPersonas: any[];
}

const displayTimestamp = (ts?: string | number) => {
  if (!ts) return '';
  if (typeof ts === 'number') {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}:${s}`;
  }
  if (ts.length !== 14) return ts;
  const y = ts.substring(0, 4);
  const m = ts.substring(4, 6);
  const d = ts.substring(6, 8);
  const h = ts.substring(8, 10);
  const min = ts.substring(10, 12);
  const s = ts.substring(12, 14);
  return `${y}/${m}/${d} ${h}:${min}:${s}`;
};

export default function ChatMessageList({
  messages,
  allPersonas,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="chat-message-list">
      {messages.map((msg) => (
        <div key={msg.id} className={`chat-message-row ${msg.role}`}>
          {msg.role === 'system' ? (
            <div className="system-separator">
              <div className="line" />
              <span>
                {msg.displayContent ||
                  msg.content ||
                  (msg.parts && msg.parts[0]?.content)}
              </span>
              <div className="line" />
            </div>
          ) : (
            <>
              {msg.role === 'assistant' && (
                <div className="chat-message-avatar">
                  <PersonaIcon
                    persona={allPersonas.find((p) => p.id === msg.agentId)}
                    size={32}
                  />
                </div>
              )}
              <div className="chat-message-content-col">
                <div className="chat-message-bubble-group">
                  <div className={`chat-message-bubble ${msg.role}`}>
                    {msg.role === 'user' ? (
                      <div className="chat-message-text">
                        <NovelMarkdown
                          content={
                            msg.displayContent ||
                            msg.content ||
                            (msg.parts &&
                              msg.parts.map((p) => p.content).join('')) ||
                            ''
                          }
                        />
                      </div>
                    ) : (
                      <div className="chat-message-parts">
                        <div className="chat-message-sender-name">
                          {msg.name ||
                            (msg.agentId
                              ? allPersonas.find((p) => p.id === msg.agentId)
                                  ?.name
                              : 'AI Assistant')}
                        </div>
                        {msg.parts?.map((part, i) => (
                          <div
                            // eslint-disable-next-line react/no-array-index-key
                            key={`${msg.id}-part-${i}`}
                            className={`part-${part.type}`}
                          >
                            {part.type === 'thought' ? (
                              <details className="chat-thought">
                                <summary>Thinking...</summary>
                                <div className="chat-thought-content">
                                  <NovelMarkdown content={part.content} />
                                </div>
                              </details>
                            ) : part.type === 'tool_call' ? (
                              <div className="chat-tool-call">
                                <span className="tool-icon">🔍</span>
                                <span className="tool-name">
                                  {part.metadata?.tool_call?.name
                                    ? `${part.metadata.tool_call.name} を実行中...`
                                    : 'ツールを実行中...'}
                                </span>
                              </div>
                            ) : (
                              <NovelMarkdown content={part.content} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.timestamp && (
                    <div className="chat-timestamp">
                      {displayTimestamp(msg.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
