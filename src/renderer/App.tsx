import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { SettingsProvider } from './contexts/SettingsContext';
import { GitContextProvider } from './contexts/GitContext';
import './App.css';

export default function App() {
  return (
    <Router>
      <SettingsProvider>
        <GitContextProvider>
          <Routes>
            <Route path="/" element={<MainLayout />} />
          </Routes>
        </GitContextProvider>
      </SettingsProvider>
    </Router>
  );
}
