import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

// プロジェクト設定の型定義
export interface ProjectConfig {
  theme?: 'dark' | 'light';
  editor?: {
    fontSize?: number;
    showLineNumbers?: boolean;
    showMinimap?: boolean;
    wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
    selectionHighlight?: boolean;
    occurrencesHighlight?: boolean;
    renderWhitespace?: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
    renderControlCharacters?: boolean;
    showFullWidthSpace?: boolean;
    [key: string]: any;
  };
  ai?: {
    provider?: 'lmstudio' | 'gemini' | 'openai' | 'none';
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
      baseUrl?: string;
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

interface ProjectContextType {
  projectPath: string | null;
  projectName: string | null;
  projectConfig: ProjectConfig;
  loadProject: (path: string) => Promise<void>;
  updateProjectConfig: (newConfig: Partial<ProjectConfig>) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  theme: 'dark',
  editor: {
    fontSize: 14,
    showLineNumbers: true,
    showMinimap: true,
    wordWrap: 'on',
    selectionHighlight: true,
    occurrencesHighlight: false,
    renderWhitespace: 'all',
    renderControlCharacters: true,
    showFullWidthSpace: true,
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
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(DEFAULT_PROJECT_CONFIG);

  const updateTitle = useCallback((pName: string | null) => {
    const base = 'novelaid-editor';
    const projectStr = pName ? ` - ${pName}` : '';
    window.electron.window.setTitle(`${base}${projectStr}`);
  }, []);

  const loadProject = useCallback(async (path: string) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('project:load', path);
      if (result) {
        setProjectPath(path);
        const pName = path.split(/[/\\]/).pop() || path;
        setProjectName(pName);
        updateTitle(pName);
        if (result.config) {
          setProjectConfig({ ...DEFAULT_PROJECT_CONFIG, ...result.config });
        } else {
          setProjectConfig(DEFAULT_PROJECT_CONFIG);
        }
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }, [updateTitle]);

  const updateProjectConfig = useCallback(async (newConfig: Partial<ProjectConfig>) => {
    if (!projectPath) return;

    setProjectConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      window.electron.ipcRenderer
        .invoke('project:save-config', projectPath, updated)
        .catch((err) => {
          console.error('Failed to save project config:', err);
        });
      return updated;
    });
  }, [projectPath]);

  const value = useMemo(
    () => ({
      projectPath,
      projectName,
      projectConfig,
      loadProject,
      updateProjectConfig,
    }),
    [projectPath, projectName, projectConfig, loadProject, updateProjectConfig]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};
