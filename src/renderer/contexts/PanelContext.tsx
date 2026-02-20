import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { useSettings } from './SettingsContext';
import { Panel, PanelRegistry, PanelLocation } from '../types/panel';
import { fileExplorerPanelConfig } from '../components/FileExplorer/FileExplorerPanel';
import { gitPanelConfig } from '../components/Git/GitPanel';
import { searchPanelConfig } from '../components/Search/SearchPanel';
import { aiChatPanelConfig } from '../components/AI/AIChatPanel';
import { aiProofreaderPanelConfig } from '../components/AI/AIProofreaderPanel';
import {
  charactersPanelConfig,
  locationsPanelConfig,
  plotsPanelConfig,
  metadataListPanelConfig,
} from '../components/Metadata/MetadataListPanel';
import { metadataPropertyEditorPanelConfig } from '../components/Metadata/MetadataPropertyEditor';
import { submissionPanelConfig } from '../components/Submission/SubmissionPanel';
import { calibrationPanelConfig } from '../components/Calibration/CalibrationPanel';

interface PanelContextType extends PanelRegistry {
  activeLeftPanelId: string | null;
  activeRightPanelId: string | null;
  setActivePanel: (location: PanelLocation, panelId: string | null) => void;
  isRightPaneOpen: boolean;
  toggleRightPane: () => void;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

const builtInPanels: Panel[] = [
  fileExplorerPanelConfig,
  searchPanelConfig,
  gitPanelConfig,
  aiProofreaderPanelConfig,
  aiChatPanelConfig,
  charactersPanelConfig,
  locationsPanelConfig,
  plotsPanelConfig,
  metadataListPanelConfig,
  metadataPropertyEditorPanelConfig,
  submissionPanelConfig,
  calibrationPanelConfig,
];

const initialPanels: Panel[] = builtInPanels;

export function PanelProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [panels, setPanels] = useState<Panel[]>(initialPanels);
  const [activeLeftPanelId, setActiveLeftPanelId] = useState<string | null>(
    'files',
  );
  const [activeRightPanelId, setActiveRightPanelId] = useState<string | null>(
    'ai-chat',
  );
  const [isRightPaneOpen, setIsRightPaneOpen] = useState(true);

  const filteredPanels = useMemo(() => {
    if (settings.ai?.provider === 'none') {
      return panels.filter(
        (p) => p.id !== 'ai-chat' && p.id !== 'ai-proofreader',
      );
    }
    return panels;
  }, [panels, settings.ai?.provider]);

  // Handle panel visibility changes
  useEffect(() => {
    if (settings.ai?.provider === 'none') {
      if (
        activeLeftPanelId === 'ai-chat' ||
        activeLeftPanelId === 'ai-proofreader'
      ) {
        setActiveLeftPanelId('files');
      }
      if (
        activeRightPanelId === 'ai-chat' ||
        activeRightPanelId === 'ai-proofreader'
      ) {
        setActiveRightPanelId('calibration');
      }
    }
  }, [settings.ai?.provider, activeLeftPanelId, activeRightPanelId]);

  const register = useCallback((panel: Panel) => {
    setPanels((prev) => {
      if (prev.find((p) => p.id === panel.id)) return prev;
      return [...prev, panel];
    });
  }, []);

  const getPanels = useCallback(() => filteredPanels, [filteredPanels]);

  const getPanel = useCallback(
    (id: string) => filteredPanels.find((p) => p.id === id),
    [filteredPanels],
  );

  const setActivePanel = useCallback(
    (location: PanelLocation, panelId: string | null) => {
      if (location === 'left') {
        setActiveLeftPanelId(panelId);
      } else if (location === 'right') {
        setActiveRightPanelId(panelId);
        if (panelId && !isRightPaneOpen) {
          setIsRightPaneOpen(true);
        }
      }
    },
    [isRightPaneOpen],
  );

  const toggleRightPane = useCallback(() => {
    setIsRightPaneOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      register,
      getPanels,
      getPanel,
      activeLeftPanelId,
      activeRightPanelId,
      setActivePanel,
      isRightPaneOpen,
      toggleRightPane,
    }),
    [
      register,
      getPanels,
      getPanel,
      activeLeftPanelId,
      activeRightPanelId,
      setActivePanel,
      isRightPaneOpen,
      toggleRightPane,
    ],
  );

  return (
    <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
  );
}

export const usePanel = () => {
  const context = useContext(PanelContext);
  if (context === undefined) {
    throw new Error('usePanel must be used within a PanelProvider');
  }
  return context;
};
