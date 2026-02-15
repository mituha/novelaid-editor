import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

// プロジェクト設定の型定義 (src/main/project.ts とあわせるのが理想だが、一旦ここで定義)
export interface ProjectConfig {
  theme?: 'dark' | 'light';
  editor?: {
    fontSize?: number;
    showLineNumbers?: boolean;
    showMinimap?: boolean;
    wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
    selectionHighlight?: boolean;
    occurrencesHighlight?: boolean;
    [key: string]: any;
  };
  ai?: {
    provider?: 'lmstudio' | 'gemini' | 'openai';
    lmstudio?: {
      model?: string;
      baseUrl?: string;
    };
    gemini?: {
      apiKey?: string;
      model?: string;
    };
    openai?: {
      apiKey?: string;
      baseUrl?: string; // e.g. http://localhost:1234/v1
      model?: string;
    };
  };
  metadataLists?: {
    id: string;
    title: string;
    tag: string;
  }[];
  submission?: {
    kakuyomuUrl?: string;
    naroUrl?: string;
    customUrl?: string;
  };
  calibration?: {
    textlint?: boolean;
    noDroppingTheRa?: boolean;
    noDoubledJoshi?: boolean;
    jaSpacing?: boolean;
    kanjiOpenClose?: boolean;
  };
  lastOpenFiles?: {
    left: { path: string; name: string }[];
    right: { path: string; name: string }[];
    leftActive?: string | null;
    rightActive?: string | null;
    activeSide?: 'left' | 'right';
    isSplit?: boolean;
  };
  [key: string]: any;
}

export interface SettingsTab {
  id: string;
  name: string;
  render: () => React.JSX.Element;
}

interface SettingsContextType {
  settings: ProjectConfig;
  updateSettings: (newSettings: ProjectConfig) => void;
  registerSettingTab: (tab: SettingsTab) => void;
  settingTabs: SettingsTab[];
  openSettings: () => void;
  closeSettings: () => void;
  isSettingsOpen: boolean;
  loadProjectSettings: (path: string) => Promise<void>;
  projectPath: string | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ProjectConfig>({
    theme: 'dark',
    editor: {
      fontSize: 14,
      showLineNumbers: true,
      showMinimap: true,
      wordWrap: 'on',
      selectionHighlight: true,
      occurrencesHighlight: false, // 小説執筆としては不要
    },
    submission: {
      kakuyomuUrl: 'https://kakuyomu.jp/my',
      naroUrl: 'https://syosetu.com/usernovel/list/',
    },
    calibration: {
      textlint: true,
      noDroppingTheRa: true,
      noDoubledJoshi: true,
      jaSpacing: true,
      kanjiOpenClose: true,
    },
  });
  const [settingTabs, setSettingTabs] = useState<SettingsTab[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [projectPath, setProjectPath] = useState<string | null>(null); // eslint-disable-line space-in-parens

  const loadProjectSettings = useCallback(async (path: string) => {
    setProjectPath(path);
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'project:load',
        path,
      );
      if (result && result.config) {
        setSettings((prev) => ({ ...prev, ...result.config }));
      }
      // Plugins could be handled here too
    } catch (error) {
      console.error('Failed to load project settings:', error);
    }
  }, []);

  const updateSettings = useCallback(
    async (newSettings: ProjectConfig) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };
        if (projectPath) {
          window.electron.ipcRenderer
            .invoke('project:save-config', projectPath, updated)
            .catch((err) => {
              console.error('Failed to save config:', err);
            });
        }
        return updated;
      });
    },
    [projectPath],
  );

  const registerSettingTab = useCallback((tab: SettingsTab) => {
    setSettingTabs((prev) => {
      if (prev.find((t) => t.id === tab.id)) return prev;
      return [...prev, tab];
    });
  }, []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      registerSettingTab,
      settingTabs,
      openSettings,
      closeSettings,
      isSettingsOpen,
      loadProjectSettings,
      projectPath,
    }),
    [
      settings,
      updateSettings,
      registerSettingTab,
      settingTabs,
      openSettings,
      closeSettings,
      isSettingsOpen,
      loadProjectSettings,
      projectPath,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
