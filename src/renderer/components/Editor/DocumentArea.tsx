import React from 'react';
import { TabBar, Tab } from '../TabBar/TabBar';
import CodeEditor from './CodeEditor';
import { FileNameHeader } from './FileNameHeader';
import NovelPreview from '../Preview/NovelPreview';
import MarkdownPreview from '../Preview/MarkdownPreview';
import DiffViewer from '../Git/DiffViewer';
import WebBrowser from '../Common/WebBrowser';
import ChView from '../ch/ChView';

interface DocumentData {
  content: string;
  metadata: Record<string, any>;
  lastSource?: 'user' | 'external';
  initialLine?: number;
  initialColumn?: number;
  searchQuery?: string;
  language?: string;
  deleted?: boolean;
}

interface DocumentAreaProps {
  side: 'left' | 'right';
  activeSide: 'left' | 'right';
  tabs: Tab[];
  activePath: string | null;
  isSplit: boolean;
  documents: Record<string, DocumentData>;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onToggleSplit: () => void;
  onOpenPreview: (path: string) => void;
  onSetActive: () => void;
  onContentChange: (value: string | undefined) => void;
  onSaveByPath: () => void;
  onRename: (newName: string) => Promise<void>;
  onNavigated: () => void;
  splitRatio: number;
  // For ChView
  leftActivePath: string | null;
  rightActivePath: string | null;
  leftTabs: Tab[];
  rightTabs: Tab[];
}

export default function DocumentArea({
  side,
  activeSide,
  tabs,
  activePath,
  isSplit,
  documents,
  onTabClick,
  onTabClose,
  onToggleSplit,
  onOpenPreview,
  onSetActive,
  onContentChange,
  onSaveByPath,
  onRename,
  onNavigated,
  splitRatio,
  leftActivePath,
  rightActivePath,
  leftTabs,
  rightTabs,
}: DocumentAreaProps) {
  const isActive = activeSide === side;

  const renderContent = () => {
    if (!activePath) {
      return (
        <div className="empty-editor-state">
          <p>ファイルを選択してください</p>
        </div>
      );
    }

    if (activePath.startsWith('preview://')) {
      const originalPath = activePath.replace('preview://', '');
      const data = documents[originalPath];
      if (data?.language === 'markdown') {
        return <MarkdownPreview content={data.content || ''} />;
      }
      return <NovelPreview content={data?.content || ''} />;
    }

    if (activePath.startsWith('git-diff://')) {
      const parts = activePath.replace('git-diff://', '').split('/');
      const staged = parts[0] === 'staged';
      const filePath = parts.slice(1).join('/');
      return <DiffViewer path={filePath} staged={staged} />;
    }

    if (activePath.startsWith('web-browser://')) {
      const url = activePath.replace('web-browser://', '');
      return <WebBrowser initialUrl={url} />;
    }

    const data = documents[activePath];
    if (!data) {
      return (
        <div className="loading-editor">
          <p>読み込み中...</p>
        </div>
      );
    }

    if (data.language === 'image') {
      const normalized = activePath.replace(/\\/g, '/');
      const encodedPath = normalized
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const src = `nvfs://local/${encodedPath}`;

      return (
        <div
          className="image-viewer-container"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            overflow: 'auto',
            backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
          }}
        >
          <img
            src={src}
            alt={activePath}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      );
    }

    if (activePath.endsWith('.ch')) {
      return (
        <ChView
          key={activePath}
          content={data.content}
          path={activePath}
          onContentChange={onContentChange as (val: string) => void}
          leftActivePath={leftActivePath}
          rightActivePath={rightActivePath}
          leftTabs={leftTabs}
          rightTabs={rightTabs}
          documents={documents}
        />
      );
    }

    // Extract filename for header
    const fileNameWithExt = activePath.split('\\').pop() || '';
    const lastDotIndex = fileNameWithExt.lastIndexOf('.');
    const fileName =
      lastDotIndex !== -1
        ? fileNameWithExt.substring(0, lastDotIndex)
        : fileNameWithExt;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <FileNameHeader fileName={fileName} onRename={onRename} />
        <CodeEditor
          key={`${side}-${activePath}`}
          value={data.content}
          language={data.language}
          lastSource={data.lastSource}
          side={side}
          onChange={onContentChange}
          onFocus={onSetActive}
          onBlur={onSaveByPath}
          initialLine={data.initialLine}
          initialColumn={data.initialColumn}
          searchQuery={data.searchQuery}
          onNavigated={onNavigated}
        />
      </div>
    );
  };

  let flexStyle = '1 1 0%';
  if (isSplit) {
    if (side === 'left') {
      flexStyle = `${splitRatio} 1 0%`;
    } else {
      flexStyle = `${1 - splitRatio} 1 0%`;
    }
  }

  return (
    <div
      className={`editor-group ${isActive ? 'active' : ''}`}
      style={{
        flex: flexStyle,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
      onFocus={onSetActive}
      onClick={onSetActive}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSetActive();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${side === 'left' ? 'Left' : 'Right'} Editor Group`}
    >
      <TabBar
        tabs={tabs}
        activeTabPath={activePath}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
        onToggleSplit={onToggleSplit}
        isSplit={isSplit}
        onOpenPreview={onOpenPreview}
      />
      <div className="editor-pane">{renderContent()}</div>
    </div>
  );
}
