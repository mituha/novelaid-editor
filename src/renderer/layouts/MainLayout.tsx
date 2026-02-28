import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DocumentArea from '../components/Editor/DocumentArea';
import { useDocument } from '../contexts/DocumentContext';
import { SettingsModal } from '../components/Settings/SettingsModal';
import { useSettings } from '../contexts/SettingsContext';
import EditorSettingsTab from '../components/Settings/Tabs/EditorSettingsTab';
import AISettingsTab from '../components/Settings/Tabs/AISettingsTab';
import { AppearanceSettingsTab } from '../components/Settings/Tabs/AppearanceSettingsTab';
import { CalibrationSettingsTab } from '../components/Settings/Tabs/CalibrationSettingsTab';
import RightPane from '../components/RightPane/RightPane';
import Resizer from '../components/Common/Resizer';
import StatusBar from '../components/Common/StatusBar';
import { CharCounter } from '../utils/CharCounter';
import { usePanel } from '../contexts/PanelContext';
import { useMetadata } from '../contexts/MetadataContext';
import './MainLayout.css';

import { LeftPane } from '../components/LeftPane/LeftPane';

export default function MainLayout() {
  const {
    documents,
    activeTabPath,
    isSplit,
    openDocument,
    closeTab,
    openDiff,
    openWebBrowser,
    saveDocument,
  } = useDocument();

  const navigate = useNavigate();
  const { openSettings, registerSettingTab, loadProjectSettings } =
    useSettings();

  const { activeLeftPanelId, activeRightPanelId, setActivePanel, getPanels } =
    usePanel();

  const { isScanning, scanProgress, scanStatus } = useMetadata();

  const [leftPaneWidth, setLeftPaneWidth] = useState(250);
  const [rightPaneWidth, setRightPaneWidth] = useState(300);
  const [editorSplitRatio, setEditorSplitRatio] = useState(0.5);

  const isLeftPaneNarrow = !activeLeftPanelId;
  const isRightPaneNarrow = !activeRightPanelId;

  const leftDisplayWidth = isLeftPaneNarrow ? 50 : leftPaneWidth;
  const rightDisplayWidth = isRightPaneNarrow ? 50 : rightPaneWidth;


  const handleLeftResize = useCallback((delta: number) => {
    setLeftPaneWidth((prev) => Math.max(150, Math.min(600, prev + delta)));
  }, []);

  const handleEditorSplitResize = useCallback((delta: number) => {
    setEditorSplitRatio((prev) =>
      Math.max(0.1, Math.min(0.9, prev + delta / 800)),
    );
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightPaneWidth((prev) => Math.max(200, Math.min(600, prev - delta)));
  }, []);

  const handleToggleLeftPane = useCallback(() => {
    if (isLeftPaneNarrow) {
      const panels = getPanels().filter((p) => p.defaultLocation === 'left');
      if (panels.length > 0) {
        setActivePanel('left', panels[0].id);
      }
    } else {
      setActivePanel('left', null);
    }
  }, [isLeftPaneNarrow, getPanels, setActivePanel]);

  const handleToggleRightPane = useCallback(() => {
    if (isRightPaneNarrow) {
      const panels = getPanels().filter((p) => p.defaultLocation === 'right');
      if (panels.length > 0) {
        setActivePanel('right', panels[0].id);
      }
    } else {
      setActivePanel('right', null);
    }
  }, [isRightPaneNarrow, getPanels, setActivePanel]);

  const handleFileSelect = useCallback(
    (
      path: string,
      data: { content: string; metadata: Record<string, any> },
    ) => {
      openDocument(path, data);
    },
    [openDocument],
  );

  useEffect(() => {
    registerSettingTab({
      id: 'editor',
      name: 'Editor',
      render: () => <EditorSettingsTab />,
    });
    registerSettingTab({
      id: 'ai',
      name: 'AI',
      render: () => <AISettingsTab />,
    });
    registerSettingTab({
      id: 'calibration',
      name: '校正',
      render: () => <CalibrationSettingsTab />,
    });
    registerSettingTab({
      id: 'appearance',
      name: 'Appearance',
      render: () => <AppearanceSettingsTab />,
    });

    const ipcRenderer = window.electron?.ipcRenderer;
    if (ipcRenderer) {
      const removeSettingsListener = ipcRenderer.on(
        'menu:open-settings',
        () => {
          openSettings();
        },
      );
      const removeOpenListener = ipcRenderer.on(
        'app:open-file',
        async (path: any) => {
          try {
            const data = await window.electron.ipcRenderer.invoke(
              'fs:readDocument',
              path,
            );
            handleFileSelect(path, data);
          } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Failed to open file via app:open-file:', error);
          }
        },
      );

      const removeCloseListener = ipcRenderer.on(
        'app:close-file',
        (pathOrArgs: any) => {
          const filePath =
            typeof pathOrArgs === 'string' ? pathOrArgs : pathOrArgs?.path;
          const reason =
            typeof pathOrArgs === 'string' ? undefined : pathOrArgs?.reason;

          if (!filePath) return;
          closeTab(filePath, undefined, reason);
        },
      );

      return () => {
        if (removeSettingsListener) removeSettingsListener();
        if (removeOpenListener) removeOpenListener();
        if (removeCloseListener) removeCloseListener();
      };
    }
    return () => {};
  }, [
    registerSettingTab,
    openSettings,
    handleFileSelect,
    closeTab,
  ]);

  const handleSave = useCallback(async () => {
    if (activeTabPath) {
      await saveDocument(activeTabPath);
    }
  }, [activeTabPath, saveDocument]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const getOriginalPath = (path: string | null) =>
    path?.startsWith('preview://') ? path.replace('preview://', '') : path;


  return (
    <div className="layout-wrapper">
      {isScanning && (
        <div className="metadata-scan-progress">
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
          <div className="progress-status-container">
            <span className="scan-icon">🔍</span>
            <span className="status-text">
              メタデータをスキャン中... ({scanProgress}%): {scanStatus}
            </span>
          </div>
        </div>
      )}
      <div className="main-layout">
        <div
          style={{
            width: `${leftDisplayWidth}px`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <LeftPane
            onFileSelect={handleFileSelect}
            onProjectOpened={(path) => loadProjectSettings(path)}
            onOpenDiff={openDiff}
            onOpenWebBrowser={openWebBrowser}
          />
        </div>
        {!isLeftPaneNarrow && <Resizer onResize={handleLeftResize} />}

        <div className="editor-area">
          <div
            className="editors-container"
            style={{
              display: 'flex',
              flex: 1,
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <DocumentArea side="left" splitRatio={editorSplitRatio} />

            {isSplit && (
              <>
                <Resizer onResize={handleEditorSplitResize} />
                  <DocumentArea side="right" splitRatio={editorSplitRatio} />
              </>
            )}
          </div>
        </div>

        {!isRightPaneNarrow && <Resizer onResize={handleRightResize} />}
        <div
          style={{
            width: `${rightDisplayWidth}px`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <RightPane />
        </div>
      </div>
      <StatusBar
        metrics={CharCounter.getMetrics(
          activeTabPath && !activeTabPath.startsWith('preview://')
            ? documents[activeTabPath]?.content || ''
            : '',
          activeTabPath,
        )}
        activePath={getOriginalPath(activeTabPath)}
        documentType={
          activeTabPath
            ? documents[getOriginalPath(activeTabPath) || '']?.documentType
            : undefined
        }
        metadata={
          activeTabPath
            ? documents[getOriginalPath(activeTabPath) || '']?.metadata
            : undefined
        }
        openSettings={openSettings}
        onGoHome={() => navigate('/')}
        onToggleLeftPane={handleToggleLeftPane}
        onToggleRightPane={handleToggleRightPane}
        isLeftPaneVisible={!isLeftPaneNarrow}
        isRightPaneVisible={!isRightPaneNarrow}
      />
      <SettingsModal />
    </div>
  );
}
