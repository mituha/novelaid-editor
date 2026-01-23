import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { SettingsProvider } from './contexts/SettingsContext';
import './App.css';

export default function App() {
  return (
    <Router>
      <SettingsProvider>
        <Routes>
          <Route path="/" element={<MainLayout />} />
        </Routes>
      </SettingsProvider>
    </Router>
  );
}
