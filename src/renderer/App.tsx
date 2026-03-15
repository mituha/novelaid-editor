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
import { DocumentProvider } from './contexts/DocumentContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProjectLauncher from './components/Launcher/ProjectLauncher';
import './styles/theme.css';
import { ProjectProvider, useProject } from './contexts/ProjectContext';

function AppRouter() {
  const navigate = useNavigate();
  const { addRecentProject } = useApp();
  const { loadProject } = useProject();

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
          await addRecentProject(path);
          await loadProject(path);
          navigate('/editor');
        },
      );
      const unsubscribeRestoreProject = window.electron.ipcRenderer.on(
        'app:restore-project',
        async (path: any) => {
          await loadProject(path);
          navigate('/editor');
        }
      );
      return () => {
        if (typeof unsubscribeGoHome === 'function') unsubscribeGoHome();
        if (typeof unsubscribeOpenProject === 'function') unsubscribeOpenProject();
        if (typeof unsubscribeRestoreProject === 'function') unsubscribeRestoreProject();
      };
    } catch (e) {
      console.error('Failed to setup menu:go-home listener', e);
    }
  }, [navigate, addRecentProject, loadProject]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProjectLauncher />} />
        <Route path="/editor" element={<MainLayout />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ProjectProvider>
        <ThemeProvider>
          <SettingsProvider>
            <GitContextProvider>
              <PanelProvider>
                <MetadataProvider>
                  <AIContextProvider>
                    <DocumentProvider>
                      <AppRouter />
                    </DocumentProvider>
                  </AIContextProvider>
                </MetadataProvider>
              </PanelProvider>
            </GitContextProvider>
          </SettingsProvider>
        </ThemeProvider>
      </ProjectProvider>
    </AppProvider>
  );
}
