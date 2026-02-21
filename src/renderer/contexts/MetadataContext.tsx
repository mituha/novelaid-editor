import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

interface MetadataContextType {
  isScanning: boolean;
  scanProgress: number;
  scanStatus: string;
}

const MetadataContext = createContext<MetadataContextType | undefined>(undefined);

export const useMetadata = () => {
  const context = useContext(MetadataContext);
  if (!context) {
    throw new Error('useMetadata must be used within a MetadataProvider');
  }
  return context;
};

export const MetadataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;

    const handleProgress = (data: any) => {
      const { progress, status } = data as { progress: number; status: string };
      setIsScanning(progress < 100);
      setScanProgress(progress);
      setScanStatus(status);
    };

    window.electron.ipcRenderer.on('metadata:scan-progress', handleProgress);

    return () => {
      // Clean up listener if possible (though ipcRenderer.on in this setup might not have an easy 'off' without refactoring the preload)
    };
  }, []);

  const value = React.useMemo(
    () => ({ isScanning, scanProgress, scanStatus }),
    [isScanning, scanProgress, scanStatus],
  );

  return (
    <MetadataContext.Provider value={value}>
      {children}
    </MetadataContext.Provider>
  );
};
