import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

interface AppContextType {
  version: string;
  activeProjectName: string | null;
  setActiveProject: (path: string | null) => void;
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
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const v = await window.electron.app.getVersion();
      if (v) setVersion(v);
    })();
  }, []);

  const updateTitle = useCallback(() => {
    const base = 'novelaid-editor';
    const versionStr = version ? ` v${version}` : '';
    const projectStr = activeProjectName ? ` - ${activeProjectName}` : '';
    window.electron.window.setTitle(`${base}${versionStr}${projectStr}`);
  }, [version, activeProjectName]);

  useEffect(() => {
    updateTitle();
  }, [updateTitle]);

  const setActiveProject = useCallback((path: string | null) => {
    if (!path) {
      setActiveProjectName(null);
      return;
    }
    const folderName = path.split(/[/\\]/).pop() || path;
    setActiveProjectName(folderName);
  }, []);

  const value = React.useMemo(
    () => ({
      version,
      activeProjectName,
      setActiveProject,
    }),
    [version, activeProjectName, setActiveProject]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
