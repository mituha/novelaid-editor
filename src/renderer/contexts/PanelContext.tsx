import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import {
  Files,
  GitGraph,
  MessageSquare,
  SearchCheck,
  Bookmark,
  Database,
} from 'lucide-react';
import { Panel, PanelRegistry, PanelLocation } from '../types/panel';
import { FileExplorerPanel } from '../components/FileExplorer/FileExplorerPanel';
import { GitPanel } from '../components/Git/GitPanel';
import AIChatPanel from '../components/AI/AIChatPanel';
import AIProofreaderPanel from '../components/AI/AIProofreaderPanel';
import { MetadataListPanel } from '../components/Metadata/MetadataListPanel';
import { MetadataPropertyEditor } from '../components/Metadata/MetadataPropertyEditor';

interface PanelContextType extends PanelRegistry {
  activeLeftPanelId: string | null;
  activeRightPanelId: string | null;
  setActivePanel: (location: PanelLocation, panelId: string | null) => void;
  isRightPaneOpen: boolean;
  toggleRightPane: () => void;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

const initialPanels: Panel[] = [
  {
    id: 'files',
    title: 'Files',
    icon: <Files size={24} strokeWidth={1.5} />,
    component: FileExplorerPanel,
    defaultLocation: 'left',
  },
  {
    id: 'git',
    title: 'Git',
    icon: <GitGraph size={24} strokeWidth={1.5} />,
    component: GitPanel,
    defaultLocation: 'left',
  },
  {
    id: 'ai-proofreader',
    title: 'AI校正',
    icon: <SearchCheck size={24} strokeWidth={1.5} />,
    component: AIProofreaderPanel,
    defaultLocation: 'right',
  },
  {
    id: 'ai-chat',
    title: 'AI Chat',
    icon: <MessageSquare size={24} strokeWidth={1.5} />,
    component: AIChatPanel,
    defaultLocation: 'right',
  },
  {
    id: 'metadata-list',
    title: '収集一覧',
    icon: <Bookmark size={24} strokeWidth={1.5} />,
    component: MetadataListPanel,
    defaultLocation: 'left',
  },
  {
    id: 'metadata-editor',
    title: 'プロパティ',
    icon: <Database size={24} strokeWidth={1.5} />,
    component: MetadataPropertyEditor,
    defaultLocation: 'right',
  },
];

export const PanelProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [panels, setPanels] = useState<Panel[]>(initialPanels);
  const [activeLeftPanelId, setActiveLeftPanelId] = useState<string | null>(
    'files',
  );
  const [activeRightPanelId, setActiveRightPanelId] = useState<string | null>(
    'ai-chat',
  );
  const [isRightPaneOpen, setIsRightPaneOpen] = useState(true);

  const register = useCallback((panel: Panel) => {
    setPanels((prev) => {
      if (prev.find((p) => p.id === panel.id)) return prev;
      return [...prev, panel];
    });
  }, []);

  const getPanels = useCallback(() => panels, [panels]);

  const getPanel = useCallback(
    (id: string) => panels.find((p) => p.id === id),
    [panels],
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
};

export const usePanel = () => {
  const context = useContext(PanelContext);
  if (context === undefined) {
    throw new Error('usePanel must be used within a PanelProvider');
  }
  return context;
};
