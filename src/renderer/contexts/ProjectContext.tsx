import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';
import { setProjectDirectory } from '../../novelaid-fs/renderer';
import { useApp } from './AppContext';
import { DocumentViewMode, TabItem } from '../../common/types';

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
    talesNoteUrl?: string;
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
    documents: {
      path: string;
      leftMainView: DocumentViewMode;
      rightMainView: DocumentViewMode;
      leftPreviewView: DocumentViewMode;
      rightPreviewView: DocumentViewMode;
    }[];
    leftActive?: { path: string; isPreview: boolean } | null;
    rightActive?: { path: string; isPreview: boolean } | null;
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
  closeProject: () => void;
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
    talesNoteUrl: 'https://tales.note.com/posts/works',
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
  const { addRecentProject } = useApp();
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(DEFAULT_PROJECT_CONFIG);
  const [appVersion, setAppVersion] = useState<string>('');

  const updateTitle = useCallback((pName: string | null, version: string) => {
    const base = 'novelaid-editor';
    const versionStr = version ? ` v${version}` : '';
    const projectStr = pName ? ` - ${pName}` : '';
    window.electron.window.setTitle(`${base}${versionStr}${projectStr}`);
  }, []);

  // 起動時にバージョンを取得してタイトルを設定する
  React.useEffect(() => {
    const initVersion = async () => {
      try {
        const version = await window.electron.app.getVersion();
        setAppVersion(version);
        updateTitle(projectName, version);
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    };
    initVersion();
  }, [updateTitle, projectName]);
  const closeProject = useCallback(() => {
    setProjectPath(null);
    setProjectName(null);
    setProjectConfig(DEFAULT_PROJECT_CONFIG);
    updateTitle(null, appVersion);
  }, [updateTitle, appVersion]);

  const loadProject = useCallback(async (path: string) => {
    try {
      // 新しいプロジェクトをロードする前に現在の状態をクリア
      closeProject();
      const result = await window.electron.ipcRenderer.invoke('project:load', path);
      if (result) {
        // バックエンドの FileService にもプロジェクトディレクトリを設定
        await setProjectDirectory(path);
        setProjectPath(path);
        const pName = path.split(/[/\\]/).pop() || path;
        setProjectName(pName);
        updateTitle(pName, appVersion);
        if (result.config) {
          setProjectConfig({ ...DEFAULT_PROJECT_CONFIG, ...result.config });
        } else {
          setProjectConfig(DEFAULT_PROJECT_CONFIG);
        }

        if (result.warning) {
          await window.electron.ipcRenderer.invoke('dialog:alert', result.warning);
        }

        // 最近使ったプロジェクトのリストを更新
        await addRecentProject(path);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }, [updateTitle, appVersion, closeProject]);

  useEffect(() => {
    // プロジェクトパスがない場合は保存しない
    if (!projectPath) return;

    const timer = setTimeout(async () => {
      try {
        await window.electron.ipcRenderer.invoke('project:save-config', projectPath, projectConfig);
      } catch (err) {
        console.error('Failed to auto-save project config:', err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [projectConfig, projectPath]);

  const updateProjectConfig = useCallback(async (newConfig: Partial<ProjectConfig>) => {
    setProjectConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const value = useMemo(
    () => ({
      projectPath,
      projectName,
      projectConfig,
      loadProject,
      updateProjectConfig,
      closeProject,
    }),
    [projectPath, projectName, projectConfig, loadProject, updateProjectConfig, closeProject]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};
