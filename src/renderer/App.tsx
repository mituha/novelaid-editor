import { MemoryRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import MainLayout from './layouts/MainLayout';
import { SettingsProvider } from './contexts/SettingsContext';
import { GitContextProvider } from './contexts/GitContext';
import { AppProvider } from './contexts/AppContext';
import './App.css';

import { PanelProvider } from './contexts/PanelContext';
import { MetadataProvider } from './contexts/MetadataContext';
import ProjectLauncher from './components/Launcher/ProjectLauncher';

function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;
    try {
      const unsubscribe = window.electron.ipcRenderer.on('menu:go-home', () => {
        navigate('/');
      });
      return unsubscribe;
    } catch (e) {
      console.error('Failed to setup menu:go-home listener', e);
    }
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<ProjectLauncher />} />
      <Route path="/editor" element={<MainLayout />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppProvider>
        <SettingsProvider>
          <GitContextProvider>
            <PanelProvider>
              <MetadataProvider>
                <AppRoutes />
              </MetadataProvider>
            </PanelProvider>
          </GitContextProvider>
        </SettingsProvider>
      </AppProvider>
    </Router>
  );
}
