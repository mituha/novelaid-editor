import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { GitFileStatus, GitLogEntry } from '../../../main/git/interface';

interface GitContextType {
  status: GitFileStatus[];
  history: GitLogEntry[];
  currentDir: string | null;
  refreshStatus: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  initRepo: () => Promise<void>;
  stageFiles: (files: string[]) => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
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

export const GitContextProvider: React.FC<GitProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<GitFileStatus[]>([]);
  const [history, setHistory] = useState<GitLogEntry[]>([]);
  const [currentDir, setCurrentDirState] = useState<string | null>(null);

  const setCurrentDir = useCallback((dir: string) => {
    setCurrentDirState(dir);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!currentDir) return;
    try {
        const newStatus = await window.electron.git.status(currentDir);
        setStatus(newStatus);
    } catch (e) {
        console.error("Failed to refresh status", e);
        setStatus([]);
    }
  }, [currentDir]);

  const refreshHistory = useCallback(async () => {
    if (!currentDir) return;
    try {
        const newHistory = await window.electron.git.log(currentDir);
        setHistory(newHistory);
    } catch (e) {
         console.error("Failed to refresh history", e);
         setHistory([]);
    }
  }, [currentDir]);

  const initRepo = useCallback(async () => {
    if (!currentDir) return;
    await window.electron.git.init(currentDir);
    await refreshStatus();
    await refreshHistory();
  }, [currentDir, refreshStatus, refreshHistory]);

  const stageFiles = useCallback(async (files: string[]) => {
    if (!currentDir) return;
    await window.electron.git.add(currentDir, files);
    await refreshStatus();
  }, [currentDir, refreshStatus]);

  const commitChanges = useCallback(async (message: string) => {
    if (!currentDir) return;
    await window.electron.git.commit(currentDir, message);
    await refreshStatus();
    await refreshHistory();
  }, [currentDir, refreshStatus, refreshHistory]);

  const value = {
    status,
    history,
    currentDir,
    refreshStatus,
    refreshHistory,
    initRepo,
    stageFiles,
    commitChanges,
    setCurrentDir
  };

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>;
};
