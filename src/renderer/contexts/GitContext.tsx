import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useSettings } from './SettingsContext';
import { GitFileStatus, GitLogEntry } from '../../main/git/interface';

interface GitContextType {
  status: GitFileStatus[];
  history: GitLogEntry[];
  currentDir: string | null;
  remotes: string[];
  currentBranch: string;
  refreshStatus: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  initRepo: () => Promise<void>;
  stageFiles: (files: string[]) => Promise<void>;
  unstageFiles: (files: string[]) => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
  pushChanges: (remote: string) => Promise<void>;
  setCurrentDir: (dir: string) => void;
}

const GitContext = createContext<GitContextType | undefined>(undefined);

export const useGit = () => {
  const context = useContext(GitContext);
  if (!context) {
    throw new Error('useGit must be used within a GitProvider');
  }
  return context;
};

interface GitProviderProps {
  children: ReactNode;
}

export function GitContextProvider({ children }: GitProviderProps) {
  const { projectPath } = useSettings();
  const [status, setStatus] = useState<GitFileStatus[]>([]);
  const [history, setHistory] = useState<GitLogEntry[]>([]);
  const [remotes, setRemotes] = useState<string[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<string>('');

  const currentDir = projectPath;

  const setCurrentDir = useCallback(() => {
    // projectPath is now the source of truth
    // eslint-disable-next-line no-console
    console.warn(
      'setCurrentDir is deprecated in GitContext. Use loadProjectSettings instead.',
    );
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!currentDir) return;
    try {
      const newStatus = await window.electron.git.status(currentDir);
      setStatus(newStatus);
      const branch = await window.electron.git.currentBranch(currentDir);
      setCurrentBranchState(branch);
      const remotesList = await window.electron.git.getRemotes(currentDir);
      setRemotes(remotesList);
    } catch (e) {
      console.error('Failed to refresh status', e);
      setStatus([]);
    }
  }, [currentDir]);

  const refreshHistory = useCallback(async () => {
    if (!currentDir) return;
    try {
      const newHistory = await window.electron.git.log(currentDir);
      setHistory(newHistory);
    } catch (e) {
      console.error('Failed to refresh history', e);
      setHistory([]);
    }
  }, [currentDir]);

  const initRepo = useCallback(async () => {
    if (!currentDir) return;
    await window.electron.git.init(currentDir);
    await refreshStatus();
    await refreshHistory();
  }, [currentDir, refreshStatus, refreshHistory]);

  const stageFiles = useCallback(
    async (files: string[]) => {
      if (!currentDir) return;
      await window.electron.git.add(currentDir, files);
      await refreshStatus();
    },
    [currentDir, refreshStatus],
  );

  const unstageFiles = useCallback(
    async (files: string[]) => {
      if (!currentDir) return;
      await window.electron.git.reset(currentDir, files);
      await refreshStatus();
    },
    [currentDir, refreshStatus],
  );

  const commitChanges = useCallback(
    async (message: string) => {
      if (!currentDir) return;
      await window.electron.ipcRenderer.invoke(
        'git:commit',
        currentDir,
        message,
      );
      await refreshStatus();
      await refreshHistory();
    },
    [currentDir, refreshStatus, refreshHistory],
  );

  const pushChanges = useCallback(
    async (remote: string) => {
      if (!currentDir || !currentBranch) return;
      await window.electron.git.push(currentDir, remote, currentBranch);
      await refreshHistory();
    },
    [currentDir, currentBranch, refreshHistory],
  );

  React.useEffect(() => {
    if (!currentDir) return;
    const cleanup = window.electron.fs.onFileChange(() => {
      refreshStatus();
    });
    return () => cleanup();
  }, [currentDir, refreshStatus]);

  const value = useMemo(
    () => ({
      status,
      history,
      currentDir,
      remotes,
      currentBranch,
      refreshStatus,
      refreshHistory,
      initRepo,
      stageFiles,
      unstageFiles,
      commitChanges,
      pushChanges,
      setCurrentDir,
    }),
    [
      status,
      history,
      currentDir,
      remotes,
      currentBranch,
      refreshStatus,
      refreshHistory,
      initRepo,
      stageFiles,
      unstageFiles,
      commitChanges,
      pushChanges,
      setCurrentDir,
    ],
  );

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>;
}
