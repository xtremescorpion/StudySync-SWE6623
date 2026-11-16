import { useEffect, useState, createContext, useContext } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { api, getToken, setToken } from "./api/client.js";

import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Courses from "./pages/Courses.jsx";
import Assignments from "./pages/Assignments.jsx";
import Planning from "./pages/Planning.jsx";
import Groups from "./pages/Groups.jsx";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // FR 02/04: restore the session from a stored token on first load.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = (user, token) => {
    setToken(token);
    setUser(user);
  };

  const signOut = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* the token may already be expired; clear it either way */
    }
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return <div className="centre muted">Loading…</div>;
  }

  return (
    <AuthContext.Provider value={{ user, setUser, signIn, signOut }}>
      {user ? <Shell /> : <Auth />}
    </AuthContext.Provider>
  );
}

function Shell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          StudySync
        </div>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/courses">Courses</NavLink>
          <NavLink to="/assignments">Assignments</NavLink>
          <NavLink to="/planning">Study plan</NavLink>
          <NavLink to="/groups">Groups</NavLink>
        </nav>
        <div className="who">
          <span className="muted">{user.name}</span>
          <button
            className="link"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/* Shared error banner, NFR 06, every failure is shown, never swallowed. */
export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      <span>{error}</span>
      {onDismiss && (
        <button className="link" onClick={onDismiss}>
          dismiss
        </button>
      )}
    </div>
  );
}

export function Loading({ children = "Loading…" }) {
  return <p className="muted">{children}</p>;
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}
