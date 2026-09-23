import { Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Validator from './pages/Validator';
import History from './pages/History';
import HistoryDetail from './pages/HistoryDetail';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/validate" element={<Validator />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:id" element={<HistoryDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </AppShell>
  );
}
