import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import LedgrMvp from "./LedgrMvp";

function ProtectedRoute({ children }) {
  const { session } = useAuth();

  // Still loading session from storage
  if (session === undefined) return null;

  return session ? children : <Navigate to="/login" replace />;
}

function AuthRoute({ children }) {
  const { session } = useAuth();

  if (session === undefined) return null;

  return session ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthRoute>
                <Login />
              </AuthRoute>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <LedgrMvp />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
