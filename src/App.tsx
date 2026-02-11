import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ModalProvider } from './contexts/ModalContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { EventSetup } from './pages/admin/EventSetup';
import { ControlRoom } from './pages/admin/ControlRoom';
import { Scorecard } from './pages/judge/Scorecard';
import { ReviewView } from './pages/committee/ReviewView';
import { AdminEventLayout } from './layouts/AdminEventLayout';
import { Roster } from './pages/admin/Roster';
import { Judges } from './pages/admin/Judges';

import { Results } from './pages/admin/Results';
import React from 'react';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, role, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user && !role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect based on actual role
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (role === 'judge') return <Navigate to="/judge/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="event/:eventId/*" element={<AdminEventLayout />}>
                <Route path="setup" element={<EventSetup />} />
                <Route path="roster" element={<Roster />} />
                <Route path="judges" element={<Judges />} />

                <Route path="control" element={<ControlRoom />} />
                <Route path="results" element={<Results />} />
                <Route path="*" element={<Navigate to="/admin/event/:eventId/setup" />} />
              </Route>
              <Route path="*" element={<Navigate to="/admin/dashboard" />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Judge Routes */}
      <Route
        path="/judge/*"
        element={
          <ProtectedRoute allowedRoles={['judge', 'committee']}>
            <Routes>
              <Route path="dashboard" element={<Scorecard />} />
              <Route path="*" element={<Navigate to="/judge/dashboard" />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Committee Routes */}
      <Route
        path="/committee/*"
        element={
          <ProtectedRoute allowedRoles={['committee']}>
            <Routes>
              <Route path="dashboard" element={<ReviewView />} />
              <Route path="*" element={<Navigate to="/committee/dashboard" />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <ModalProvider>
            <AppRoutes />
          </ModalProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
