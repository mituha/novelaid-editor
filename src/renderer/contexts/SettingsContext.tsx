import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

export interface SettingsTab {
  id: string;
  name: string;
  render: () => React.JSX.Element;
}

interface SettingsContextType {
  registerSettingTab: (tab: SettingsTab) => void;
  settingTabs: SettingsTab[];
  openSettings: () => void;
  closeSettings: () => void;
  isSettingsOpen: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settingTabs, setSettingTabs] = useState<SettingsTab[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
      registerSettingTab,
      settingTabs,
      openSettings,
      closeSettings,
      isSettingsOpen,
    }),
    [
      registerSettingTab,
      settingTabs,
      openSettings,
      closeSettings,
      isSettingsOpen,
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
