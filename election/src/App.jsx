import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ElectionHomePage from './pages/ElectionHomePage'
import VotePage from './pages/VotePage'
import PublicResultsPage from './pages/PublicResultsPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import VotersPage from './pages/admin/VotersPage'
import CandidatesPage from './pages/admin/CandidatesPage'
import ResultsPage from './pages/admin/ResultsPage'
import SettingsPage from './pages/admin/SettingsPage'
import AdminLayout from './components/Layout/AdminLayout'
import ProtectedRoute from './components/Layout/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<ElectionHomePage />} />
        <Route path="/vote/:token" element={<VotePage />} />
        <Route path="/results" element={<PublicResultsPage />} />

        {/* Admin Auth */}
        <Route path="/admin" element={<AdminLoginPage />} />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="voters" element={<VotersPage />} />
          <Route path="candidates" element={<CandidatesPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
