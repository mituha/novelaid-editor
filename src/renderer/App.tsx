import { MemoryRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import MainLayout from './layouts/MainLayout';
import { useSettings, SettingsProvider } from './contexts/SettingsContext';
import { GitContextProvider } from './contexts/GitContext';
import { useApp, AppProvider } from './contexts/AppContext';
import './App.css';

import { PanelProvider } from './contexts/PanelContext';
import { MetadataProvider } from './contexts/MetadataContext';
import { AIContextProvider } from './contexts/AIContextContext';
import ProjectLauncher from './components/Launcher/ProjectLauncher';

function AppRoutes() {
  const navigate = useNavigate();
  const { setActiveProject } = useApp();
  const { loadProjectSettings } = useSettings();

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;
    try {
      const unsubscribeGoHome = window.electron.ipcRenderer.on(
        'menu:go-home',
        () => {
          navigate('/');
        },
      );
      const unsubscribeOpenProject = window.electron.ipcRenderer.on(
        'menu:open-project',
        async (path: any) => {
          await window.electron?.ipcRenderer.invoke('recent:add', path);
          setActiveProject(path);
          await loadProjectSettings(path);
          navigate('/editor');
        },
      );
      return () => {
        if (typeof unsubscribeGoHome === 'function') unsubscribeGoHome();
        if (typeof unsubscribeOpenProject === 'function') unsubscribeOpenProject();
      };
    } catch (e) {
      console.error('Failed to setup menu:go-home listener', e);
    }
  }, [navigate, setActiveProject, loadProjectSettings]);

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
                <AIContextProvider>
                  <AppRoutes />
                </AIContextProvider>
              </MetadataProvider>
            </PanelProvider>
          </GitContextProvider>
        </SettingsProvider>
      </AppProvider>
    </Router>
  );
}
