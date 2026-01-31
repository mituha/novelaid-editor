import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import './RightPane.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
      content: 'Hello! I am your AI assistant. How can I help you today?',
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
      content: input, // We show original input in UI, but send modified content?
                      // Usually better to show what was sent or just keep hidden context.
                      // Let's show the context in the UI for transparency, or keep it hidden?
                      // Strategy: Show original input, but send constructed prompt.
                      // HOWEVER, `messages` state doubles as display and history.
                      // So we must add the modified content to history if we want the AI to "remember" it in context window.
                      // But for UI it looks messy.
                      // Compromise: Add a system message or just modifying the user message content.
                      // Because `chat` in backend takes `messages`, we should store the *actual* prompt in `messages`.
                      // UI can display a truncated version if needed, but for now let's just use the full content so user knows what's sent.
                      // Re-decision: Let's prepend context to the message content pushed to state.
      content: finalContent
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
        content: ''
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Setup listeners
    // We strictly use the channels defined in preload
    const removeDataListener = window.electron.ipcRenderer.on('ai:streamChat:data', (chunk) => {
        setMessages(prev => prev.map(msg =>
            msg.id === assistantMsgId
                ? { ...msg, content: msg.content + (typeof chunk === 'string' ? chunk : '') }
                : msg
        ));
    });

    const removeEndListener = window.electron.ipcRenderer.on('ai:streamChat:end', () => {
        setIsStreaming(false);
        cleanup();
    });

    const removeErrorListener = window.electron.ipcRenderer.on('ai:streamChat:error', (error) => {
        console.error('Stream error:', error);
        setMessages(prev => prev.map(msg =>
            msg.id === assistantMsgId
                ? { ...msg, content: msg.content + `\n[Error: ${error}]` }
                : msg
        ));
        setIsStreaming(false);
        cleanup();
    });

    const cleanup = () => {
        removeDataListener();
        removeEndListener();
        removeErrorListener();
    };

    // Send request
    const apiMessages = newMessages.map(m => ({
        role: m.role,
        content: m.content
    }));

    window.electron.ipcRenderer.sendMessage('ai:streamChat', apiMessages, settings.ai || {});
  };

  return (
    <div className="right-pane">
      <div className="right-pane-header">AI Agent</div>
      <div className="right-pane-content">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="right-pane-input-area">
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "AI is typing..." : "Ask AI..."}
          disabled={isStreaming}
        />
        <div className="chat-options" style={{ marginTop: '5px' }}>
             <label style={{ fontSize: '12px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '5px' }}>
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
