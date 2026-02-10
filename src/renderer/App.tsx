import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { SettingsProvider } from './contexts/SettingsContext';
import { GitContextProvider } from './contexts/GitContext';
import './App.css';

import { PanelProvider } from './contexts/PanelContext';
import ProjectLauncher from './components/Launcher/ProjectLauncher';

export default function App() {
  return (
    <Router>
      <SettingsProvider>
        <GitContextProvider>
          <PanelProvider>
            <Routes>
              <Route path="/" element={<ProjectLauncher />} />
              <Route path="/editor" element={<MainLayout />} />
            </Routes>
          </PanelProvider>
        </GitContextProvider>
      </SettingsProvider>
    </Router>
  );
}
