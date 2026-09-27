import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppShell from "./components/AppShell.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Team from "./pages/Team.jsx";
import Sessions from "./pages/Sessions.jsx";
import Settings from "./pages/Settings.jsx";
import GeneralTab from "./pages/settings/GeneralTab.jsx";
import UsersTab from "./pages/settings/UsersTab.jsx";
import PipelineTab from "./pages/settings/PipelineTab.jsx";
import RolesTab from "./pages/settings/RolesTab.jsx";
import NotFound from "./pages/NotFound.jsx";

export const App = () => (
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/team" element={<Team />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/settings" element={<Settings />}>
              <Route index element={<GeneralTab />} />
              <Route path="users" element={<UsersTab />} />
              <Route path="pipeline" element={<PipelineTab />} />
              <Route path="roles" element={<RolesTab />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);

export default App;
