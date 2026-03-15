import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

interface AppContextType {
  version: string;
  recentProjects: RecentProject[];
  loadRecentProjects: () => Promise<void>;
  addRecentProject: (path: string) => Promise<void>;
  removeRecentProject: (path: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [version, setVersion] = useState<string>('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    (async () => {
      const v = await window.electron.app.getVersion();
      if (v) setVersion(v);
    })();
  }, []);

  const loadRecentProjects = useCallback(async () => {
    try {
      const projects = await window.electron.ipcRenderer.invoke('recent:get');
      if (Array.isArray(projects)) {
        setRecentProjects(projects);
      }
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    }
  }, []);

  const addRecentProject = useCallback(async (path: string) => {
    try {
      await window.electron.ipcRenderer.invoke('recent:add', path);
      await loadRecentProjects();
    } catch (error) {
      console.error('Failed to add recent project:', error);
    }
  }, [loadRecentProjects]);

  const removeRecentProject = useCallback(async (path: string) => {
    try {
      await window.electron.ipcRenderer.invoke('recent:remove', path);
      await loadRecentProjects();
    } catch (error) {
      console.error('Failed to remove recent project:', error);
    }
  }, [loadRecentProjects]);

  useEffect(() => {
    loadRecentProjects();
  }, [loadRecentProjects]);

  const value = useMemo(
    () => ({
      version,
      recentProjects,
      loadRecentProjects,
      addRecentProject,
      removeRecentProject,
    }),
    [version, recentProjects, loadRecentProjects, addRecentProject, removeRecentProject]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
