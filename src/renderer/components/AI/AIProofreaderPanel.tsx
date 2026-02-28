import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SpellCheck, ClipboardCheck, SearchCheck } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { Panel } from '../../types/panel';
import './AIProofreaderPanel.css';
import ChatMessageList, {
  ChatMessage,
  ChatMessagePart,
} from '../Chat/ChatMessageList';
import AIChatInput from './AIChatInput';
import { useDocument } from '../../contexts/DocumentContext';

interface AIProofreaderPanelProps {
  // eslint-disable-next-line react/require-default-props
  activeContent?: string;
  // eslint-disable-next-line react/require-default-props
  activePath?: string | null;
}

type ProofreadingMode = 'typo' | 'style' | 'editor';

interface ProofreadingAction {
  id: ProofreadingMode;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const grammerContext = `
なお、文章中の「|漢字《ルビ》」はルビ振りを示す記法、「《《傍点》》」は傍点を示す記法として扱ってください。
また、これらの記号、|《》等に関する指摘は不要です。
`;

const ACTIONS: ProofreadingAction[] = [
  {
    id: 'typo',
    label: '誤字脱字',
    icon: <SpellCheck size={16} />,
    prompt:
      '以下の文章の誤字脱字、送り仮名のミス、重複表現等を指摘箇条書きで指摘。修正案と修正理由を簡潔に併記。なお、ルビ、傍点の記述方法に関する指摘は不要です。',
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

export default function AIProofreaderPanel({
  activeContent = '',
  activePath = null,
}: AIProofreaderPanelProps) {
  const { settings, projectPath } = useSettings();
  const {
    openPanelDocument,
    updateContent,
    documents: ctxDocuments,
  } = useDocument();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [useTools, setUseTools] = useState(false);
  const [useReasoning, setUseReasoning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const panelPath = projectPath
    ? `${projectPath}/.novelaid/ai-proofreader.ch`
    : null;

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
        console.error('Failed to parse proofreader history', e);
      }
    }
  }, [panelPath, ctxDocuments, messages.length]);

  useEffect(() => {
    if (panelPath && messages.length > 0 && updateContent && !isStreaming) {
      updateContent(panelPath, 'right', JSON.stringify(messages, null, 2));
    }
  }, [messages, panelPath, updateContent, isStreaming]);

  const startSession = useCallback(
    (newMessages: ChatMessage[]) => {
      setMessages(newMessages);
      setIsStreaming(true);
      setInput('');

      const assistantMsgId = (Date.now() + 1).toString();
      const assistantMessage: ChatMessage = {
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
                const updatedParts = [...(msg.parts || [])];
                updatedParts[updatedParts.length - 1] = {
                  ...lastPart,
                  content: lastPart.content + typedChunk.content,
                };
                return { ...msg, parts: updatedParts };
              }
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
          setIsStreaming(false);
          cleanup();
        },
      );

      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.parts?.map((p) => p.content).join('') || m.content || '',
      }));

      window.electron.ipcRenderer.sendMessage('ai:streamChat', apiMessages, {
        ...settings.ai,
        disableTools: !useTools,
        disableReasoning: !useReasoning,
      });
    },
    [settings.ai, useTools, useReasoning],
  );

  const handleAction = (action: ProofreadingAction) => {
    if (!activeContent || isStreaming) return;

    const fullPrompt = `${action.prompt}\n\n${grammerContext}\n\n対象テキスト (File: ${activePath || 'Untitled'}):\n\`\`\`\n${activeContent}\n\`\`\``;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', content: fullPrompt }],
      displayContent: `${action.label}を開始しました`,
    };

    startSession([...messages, userMessage]);
  };

  const handleSendChat = () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
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
        {messages.length === 0 ? (
          <div className="empty-state">
            <ClipboardCheck size={48} opacity={0.2} />
            <p>校正アクションを選択して開始してください</p>
          </div>
        ) : (
          <ChatMessageList
            messages={messages}
            allPersonas={[]}
            onMessagesChange={setMessages}
          />
        )}
      </div>

      <AIChatInput
        value={input}
        onChange={setInput}
        onSend={handleSendChat}
        isStreaming={isStreaming}
        placeholder="校正結果について質問する..."
        showContextSelector={false}
        useTools={useTools}
        onUseToolsChange={setUseTools}
        useReasoning={useReasoning}
        onUseReasoningChange={setUseReasoning}
      />
    </div>
  );
}

export const aiProofreaderPanelConfig: Panel = {
  id: 'ai-proofreader',
  title: 'AI校正',
  icon: <SearchCheck size={24} strokeWidth={1.5} />,
  component: AIProofreaderPanel,
  defaultLocation: 'right',
};
