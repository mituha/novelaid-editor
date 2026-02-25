import React from 'react';
import { TabBar } from '../TabBar/TabBar';
import CodeEditor from './CodeEditor';
import { FileNameHeader } from './FileNameHeader';
import NovelPreview from '../Preview/NovelPreview';
import MarkdownPreview from '../Preview/MarkdownPreview';
import DiffViewer from '../Git/DiffViewer';
import WebBrowser from '../Common/WebBrowser';
import ChView from '../ch/ChView';

import { useDocument } from '../../contexts/DocumentContext';

interface DocumentAreaProps {
  side: 'left' | 'right';
  splitRatio: number;
}

export default function DocumentArea({
  side,
  splitRatio,
}: DocumentAreaProps) {
  const {
    documents,
    leftTabs,
    rightTabs,
    leftActivePath,
    rightActivePath,
    activeSide,
    isSplit,
    switchTab,
    closeTab,
    toggleSplit,
    openPreview,
    setActiveSide,
    updateContent,
    saveDocument,
    renameDocument,
    markNavigated,
  } = useDocument();

  const tabs = side === 'left' ? leftTabs : rightTabs;
  const activePath = side === 'left' ? leftActivePath : rightActivePath;
  const isActive = activeSide === side;

  const onSetActive = () => setActiveSide(side);

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
          onContentChange={(val) => updateContent(activePath, side, val)}
          leftActivePath={leftActivePath}
          rightActivePath={rightActivePath}
          leftTabs={leftTabs}
          rightTabs={rightTabs}
          documents={documents}
        />
      );
    }

    const fileNameWithExt = activePath.split('\\').pop() || '';
    const lastDotIndex = fileNameWithExt.lastIndexOf('.');
    const fileName =
      lastDotIndex !== -1
        ? fileNameWithExt.substring(0, lastDotIndex)
        : fileNameWithExt;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <FileNameHeader
          fileName={fileName}
          onRename={(newName) => renameDocument(activePath, newName)}
        />
        <CodeEditor
          key={`${side}-${activePath}`}
          value={data.content}
          language={data.language}
          lastSource={data.lastSource as any}
          side={side}
          onChange={(val) => updateContent(activePath, side, val)}
          onFocus={onSetActive}
          onBlur={() => saveDocument(activePath)}
          initialLine={data.initialLine}
          initialColumn={data.initialColumn}
          searchQuery={data.searchQuery}
          onNavigated={() => markNavigated(activePath)}
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
        onTabClick={(path) => switchTab(side, path)}
        onTabClose={(path) => closeTab(path, side)}
        onToggleSplit={toggleSplit}
        isSplit={isSplit}
        onOpenPreview={openPreview}
      />
      <div className="editor-pane">{renderContent()}</div>
    </div>
  );
}
