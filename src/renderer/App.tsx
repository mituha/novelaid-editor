import { MemoryRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import MainLayout from './layouts/MainLayout';
import { SettingsProvider } from './contexts/SettingsContext';
import { GitContextProvider } from './contexts/GitContext';
import './App.css';

import { PanelProvider } from './contexts/PanelContext';
import ProjectLauncher from './components/Launcher/ProjectLauncher';

function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('menu:go-home', () => {
      navigate('/');
    });
    return unsubscribe;
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
      <SettingsProvider>
        <GitContextProvider>
          <PanelProvider>
            <AppRoutes />
          </PanelProvider>
        </GitContextProvider>
      </SettingsProvider>
    </Router>
  );
}
