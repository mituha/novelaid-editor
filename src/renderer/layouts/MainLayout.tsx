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
import Resizer from '../components/Common/Resizer';
import StatusBar from '../components/Common/StatusBar';
import { CharCounter } from '../utils/CharCounter';
import { DetailedCountResult } from 'novelaid-ruby';
import { usePanel } from '../contexts/PanelContext';
import './MainLayout.css';

import { SidePane } from '../components/Common/SidePane';

export default function MainLayout() {
  const {
    openDocuments,
    activeTabItem,
    isSplit,
    leftTabs,
    rightTabs,
    openDocument,
    closeTab,
    saveDocument,
  } = useDocument();

  const navigate = useNavigate();
  const { openSettings, registerSettingTab } =
    useSettings();

  const { activeLeftPanelId, activeRightPanelId, setActivePanel, getPanels } =
    usePanel();

  const [leftPaneWidth, setLeftPaneWidth] = useState(250);
  const [rightPaneWidth, setRightPaneWidth] = useState(300);
  const [editorSplitRatio, setEditorSplitRatio] = useState(0.5);

  const [selectedText, setSelectedText] = useState('');
  const [detailedMetrics, setDetailedMetrics] = useState<DetailedCountResult | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<DetailedCountResult | null>(null);

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
            await openDocument(path);
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
    closeTab,
    openDocument,
  ]);

  const handleSave = useCallback(async () => {
    if (activeTabItem) {
      console.log('MainLayout handleSave: ', activeTabItem.path);
      await saveDocument(activeTabItem.path);
    }
  }, [activeTabItem, saveDocument]);

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

  const activePath = activeTabItem?.path || null;
  const activeTabUniquePath = activeTabItem
    ? activeTabItem.isPreview
      ? `preview://${activePath}`
      : activePath
    : null;

  const activeTab = [...leftTabs, ...rightTabs].find(t => t.path === activeTabUniquePath);
  const activeDocument = openDocuments.find(d => d.path === activePath);

  // 全体の詳細文字数カウント (Debounce: 200ms)
  useEffect(() => {
    const text = activeTab && !activeTabItem?.isPreview && activeTab.documentType !== 'gitDiff' && activeTab.documentType !== 'browser'
      ? activeDocument?.content || ''
      : '';

    if (!text) {
      setDetailedMetrics(null);
      return;
    }

    const timer = setTimeout(() => {
      const metrics = CharCounter.getDetailedMetrics(text);
      setDetailedMetrics(metrics);
    }, 200);

    return () => clearTimeout(timer);
  }, [activeDocument?.content, activeTab, activeTabItem, activePath]);

  // 選択範囲の詳細文字数カウント (Debounce: 100ms)
  useEffect(() => {
    if (!selectedText) {
      setSelectedMetrics(null);
      return;
    }

    const timer = setTimeout(() => {
      const metrics = CharCounter.getDetailedMetrics(selectedText);
      setSelectedMetrics(metrics);
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedText]);

  // 選択範囲変更イベントの監視
  useEffect(() => {
    const handleSelectionChange = (e: CustomEvent<{ text: string; path: string }>) => {
      if (e.detail.path === activePath) {
        setSelectedText(e.detail.text);
      }
    };
    window.addEventListener('editor-selection-change' as any, handleSelectionChange);
    return () => {
      window.removeEventListener('editor-selection-change' as any, handleSelectionChange);
    };
  }, [activePath]);

  // アクティブパスが変わったら選択状態をクリア
  useEffect(() => {
    setSelectedText('');
    setSelectedMetrics(null);
  }, [activePath]);

  return (
    <div className="layout-wrapper">
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
          <SidePane location="left" />
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
          <SidePane location="right" />
        </div>
      </div>
      <StatusBar
        detailedMetrics={detailedMetrics}
        selectedMetrics={selectedMetrics}
        activePath={activePath}
        documentType={activeDocument?.documentType}
        metadata={activeDocument?.metadata}
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
