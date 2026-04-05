import React from 'react';
import { TabBar } from '../TabBar/TabBar';
import CodeEditor from './CodeEditor';
import { FileNameHeader } from './FileNameHeader';
import NovelNavigator from './NovelNavigator';
import NovelPreview from '../Preview/NovelPreview';
import { MarkdownPreview } from '../../../novelaid-markdown';
import DiffViewer from '../Git/DiffViewer';
import WebBrowser from '../Common/WebBrowser';
import ChView from '../ch/ChView';
import { NovelaidDocumentType } from '../../../novelaid-fs';

import { useDocument } from '../../contexts/DocumentContext';
import { isViewTypeSupported } from '../../../common/documentSupport';
import { getFilePath } from '../../../common/utils/pathUtils';

const getCodeEditorLanguage = (docType?: NovelaidDocumentType): string => {
  if (!docType) return 'novel';
  if (
    ['javascript', 'typescript', 'json', 'css', 'html', 'markdown'].includes(
      docType,
    )
  ) {
    return docType;
  }
  return 'novel';
};

interface DocumentAreaProps {
  side: 'left' | 'right';
  splitRatio: number;
}

export default function DocumentArea({ side, splitRatio }: DocumentAreaProps) {
  const {
    openDocuments,
    leftTabs,
    rightTabs,
    activeLeftItem,
    activeRightItem,
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
    changeViewType,
    getAbsolutePath,
  } = useDocument();

  const tabs = side === 'left' ? leftTabs : rightTabs;
  const activeItem = side === 'left' ? activeLeftItem : activeRightItem;
  const isActive = activeSide === side;

  // TabBar との互換性のために、プレビュー時は preview:// プレフィックスを付ける
  const activeTabPath = activeItem
    ? activeItem.isPreview
      ? `preview://${activeItem.path}`
      : activeItem.path
    : null;

  const activeTab = tabs.find((t) => t.path === activeTabPath);
  const viewType = activeTab?.viewType || 'editor';

  const onSetActive = () => setActiveSide(side);

  const renderContent = () => {
    if (!activeItem) {
      return (
        <div className="empty-editor-state">
          <p>ファイルを選択してください</p>
        </div>
      );
    }

    const { path, isPreview } = activeItem;
    const document = openDocuments.find((d) => d.path === path);

    if (isPreview) {
      if (!isViewTypeSupported(document?.documentType, 'preview')) {
        return (
          <div className="empty-editor-state">
            <p>このファイル形式ではプレビューをサポートしていません</p>
          </div>
        );
      }

      if (document?.documentType === 'markdown') {
        return (
          <MarkdownPreview
            content={document.content || ''}
            filePath={path}
            viewType="preview"
          />
        );
      }
      return <NovelPreview content={document?.content || ''} />;
    }

    if (activeTab?.documentType === 'gitDiff') {
      const parts = path.replace('gitDiff://', '').split('/');
      const staged = parts[0] === 'staged';
      const filePath = parts.slice(1).join('/');
      return <DiffViewer key={`${side}-${path}`} path={filePath} staged={staged} />;
    }

    if (activeTab?.documentType === 'browser') {
      const url = path.replace('browser://', '');
      return <WebBrowser key={`${side}-${path}`} initialUrl={url} />;
    }

    if (!document) {
      return (
        <div className="loading-editor">
          <p>読み込み中...</p>
        </div>
      );
    }

    if (document.documentType === 'image') {
      const normalized = path.replace(/\\/g, '/');
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
            alt={path}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      );
    }

    if (viewType === 'canvas' && document.documentType === 'chat') {
      return (
        <ChView
          key={path}
          content={document.content}
          path={path}
          onContentChange={(val) => updateContent(path, side, val)}
          activeLeftItem={activeLeftItem}
          activeRightItem={activeRightItem}
          openDocuments={openDocuments}
        />
      );
    }

    if (viewType === 'reader') {
      if (document.documentType === 'markdown') {
        return (
          <MarkdownPreview
            content={document.content || ''}
            filePath={path}
            viewType="reader"
          />
        );
      }
      return <NovelPreview content={document.content || ''} />;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <FileNameHeader
          fileTitle={activeTab?.fileTitle || ''}
          activePath={path}
          onRename={(newName) => renameDocument(path, newName)}
        />
        <CodeEditor
          key={`${side}-${path}`}
          value={document.content}
          language={getCodeEditorLanguage(document.documentType)}
          lastSource={document.lastSource as any}
          side={side}
          activePath={path}
          onChange={(val) => updateContent(path, side, val)}
          onFocus={onSetActive}
          onBlur={() => saveDocument(path)}
          initialLine={document.initialLine}
          initialColumn={document.initialColumn}
          searchQuery={document.searchQuery}
          onNavigated={() => markNavigated(path)}
        />
        {document.documentType === 'novel' && (
          <NovelNavigator activePath={path} />
        )}
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
        activeTabPath={activeTabPath}
        onTabClick={(p) => switchTab(side, p)}
        onTabClose={(tab) => {
          closeTab(tab.path, side, tab.viewType);
        }}
        onToggleSplit={toggleSplit}
        isSplit={isSplit}
        onOpenPreview={openPreview}
        onChangeViewType={(p, vt) => {
          const isP = p.startsWith('preview://');
          const dp = isP ? p.replace('preview://', '') : p;
          changeViewType(side, { path: dp, isPreview: isP }, vt);
        }}
        activeDocumentType={
          activeItem
            ? openDocuments.find((d) => d.path === activeItem.path)?.documentType
            : undefined
        }
      />
      <div className="editor-pane">{renderContent()}</div>
    </div>
  );
}
