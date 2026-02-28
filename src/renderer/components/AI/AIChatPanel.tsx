import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { Panel } from '../../types/panel';
import { Persona, CHAT_ROLES } from '../../../common/constants/personas';
import './AIChatPanel.css';
import { usePersonas } from '../../hooks/usePersonas';
import PersonaSelector from './PersonaSelector';
import RoleSelector from './RoleSelector';
import { useAIContextContent } from '../../hooks/useAIContextContent';
import ChatMessageList, {
  ChatMessage,
  ChatMessagePart,
} from '../Chat/ChatMessageList';
import AIChatInput from './AIChatInput';
import { useDocument } from '../../contexts/DocumentContext';

interface Tab {
  name: string;
  path: string;
}

// grammerContext removed, handled by system prompt in backend

interface AIChatPanelProps {
  leftActivePath: string | null;
  rightActivePath: string | null;
  leftTabs: Tab[];
  rightTabs: Tab[];
  documents: Record<string, any>;
}

export default function AIChatPanel({
  leftActivePath,
  rightActivePath,
  leftTabs,
  rightTabs,
  documents,
}: AIChatPanelProps) {
  const { settings, projectPath } = useSettings();
  const {
    openPanelDocument,
    updateContent,
    documents: ctxDocuments,
  } = useDocument();
  const { allPersonas, staticPersonas, dynamicPersonas } = usePersonas();
  const { getContextText } = useAIContextContent();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(''); // Empty means "None"
  const [selectedRoleId, setSelectedRoleId] = useState<string>('assistant');

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

  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages());
  const [contextStartIndex, setContextStartIndex] = useState(0);
  const [pendingContextReset, setPendingContextReset] = useState(false);
  const [useTools, setUseTools] = useState(true);
  const [useReasoning, setUseReasoning] = useState(true);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const panelPath = projectPath ? `${projectPath}/.novelaid/ai-chat.ch` : null;

  useEffect(() => {
    if (panelPath && openPanelDocument) {
      openPanelDocument(panelPath, { content: '[]', metadata: {} });
    }
  }, [panelPath, openPanelDocument]);

  useEffect(() => {
    if (panelPath && ctxDocuments[panelPath] && messages.length === 0) {
      try {
        const { content } = ctxDocuments[panelPath];
        if (content && content !== '[]') {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse chat history', e);
      }
    }
  }, [panelPath, ctxDocuments, messages.length]);

  useEffect(() => {
    if (panelPath && messages.length > 0 && updateContent && !isStreaming) {
      updateContent(panelPath, 'right', JSON.stringify(messages, null, 2));
    }
  }, [messages, panelPath, updateContent, isStreaming]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    let finalContent = input;

    // AIコンテキストの収集
    const contextText = await getContextText(
      leftActivePath,
      rightActivePath,
      leftTabs,
      rightTabs,
      documents,
    );

    if (contextText) {
      finalContent = `Context:\n${contextText}\nUser: ${input}`;
    }

    const userMessage: ChatMessage = {
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

      const separatorMessage: ChatMessage = {
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
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      parts: [],
      agentId: selectedPersonaId,
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

            const lastPart = msg.parts
              ? msg.parts[msg.parts.length - 1]
              : undefined;
            if (lastPart && lastPart.type === typedChunk.type) {
              // Append to existing part if same type
              const updatedParts = [...(msg.parts || [])];
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
                ...(msg.parts || []),
                {
                  type: typedChunk.type as ChatMessagePart['type'],
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
                    ...(msg.parts || []),
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
        const content =
          (m.parts || []).map((p) => p.content).join('') || m.content || '';
        return {
          role: m.role,
          content,
        };
      });

    window.electron.ipcRenderer.sendMessage(
      'ai:streamChat',
      apiMessages,
      {
        ...settings.ai,
        disableTools: !useTools,
        disableReasoning: !useReasoning,
      },
      selectedPersonaId,
      selectedRoleId,
      panelPath,
    );
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
      <ChatMessageList
        messages={messages}
        allPersonas={allPersonas}
        onMessagesChange={(newMessages) => {
          if (newMessages.length === 0) {
            setMessages(getInitialMessages());
            setContextStartIndex(0);
          } else {
            setMessages(newMessages);
          }
        }}
      />
      <AIChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isStreaming={isStreaming}
        placeholder="AIに相談する..."
        showContextSelector
        leftActivePath={leftActivePath}
        rightActivePath={rightActivePath}
        leftTabs={leftTabs}
        rightTabs={rightTabs}
        useTools={useTools}
        onUseToolsChange={setUseTools}
        useReasoning={useReasoning}
        onUseReasoningChange={setUseReasoning}
      />
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
