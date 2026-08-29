import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import LandingPage from "./pages/LandingPage";
import DashboardLayout from "./components/DashboardLayout";
import DashboardOverview from "./pages/DashboardOverview";
import MemberManagementPage from "./pages/MemberManagementPage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import DevicesPage from "./pages/DevicesPage";
import DeviceDetailsPage from "./pages/DeviceDetailsPage";
import ProjectGuard from "./components/ProjectGuard";
import { useAuthStore } from "./store/authStore";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session);
  return session ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function Router() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<LoginPage />} />

        {/* Global Hub - Redirect to the first available project or show a project list */}
        {/* We will just redirect to landing for now if they hit /dashboard directly */}
        <Route
          path="/dashboard"
          element={<Navigate to="/" replace />}
        />

        {/* Protected Project Shell (Slug Routing) */}
        <Route
          path="/:slug"
          element={
            <ProtectedRoute>
              <ProjectGuard>
                <DashboardLayout>
                  <DashboardOverview />
                </DashboardLayout>
              </ProjectGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/:slug/members"
          element={
            <ProtectedRoute>
              <ProjectGuard>
                <DashboardLayout>
                  <MemberManagementPage />
                </DashboardLayout>
              </ProjectGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/:slug/devices"
          element={
            <ProtectedRoute>
              <ProjectGuard>
                <DashboardLayout>
                  <DevicesPage />
                </DashboardLayout>
              </ProjectGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/:slug/devices/:deviceId"
          element={
            <ProtectedRoute>
              <ProjectGuard>
                <DashboardLayout>
                  <DeviceDetailsPage />
                </DashboardLayout>
              </ProjectGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/:slug/settings"
          element={
            <ProtectedRoute>
              <ProjectGuard>
                <DashboardLayout>
                  <ProjectSettingsPage />
                </DashboardLayout>
              </ProjectGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/:slug/audit-logs"
          element={
            <ProtectedRoute>
              <ProjectGuard>
                <DashboardLayout>
                  <AuditLogsPage />
                </DashboardLayout>
              </ProjectGuard>
            </ProtectedRoute>
          }
        />

        {/* Catch-all — landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
