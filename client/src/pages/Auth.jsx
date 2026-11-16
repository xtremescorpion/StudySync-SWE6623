import { useState } from "react";
import { api } from "../api/client.js";
import { useAuth, ErrorBanner } from "../App.jsx";

/* FR 01, 02, 05: register, sign in, reset password. */
export default function Auth() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState("login"); // login | register | reset
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const { user, token } = await api.post("/auth/register", form);
        signIn(user, token);
      } else if (mode === "login") {
        const { user, token } = await api.post("/auth/login", {
          email: form.email,
          password: form.password,
        });
        signIn(user, token);
      } else {
        await api.post("/auth/reset-password", {
          email: form.email,
          newPassword: form.password,
        });
        setNotice("If that account exists, its password has been reset. You can sign in now.");
        setMode("login");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centre">
      <div className="card auth">
        <h1>StudySync</h1>
        <p className="muted">A collaborative study planner and assignment tracker</p>

        <div className="tabs">
          <button
            className={mode === "login" ? "on" : ""}
            onClick={() => { setMode("login"); setError(null); }}
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "on" : ""}
            onClick={() => { setMode("register"); setError(null); }}
          >
            Create account
          </button>
          <button
            className={mode === "reset" ? "on" : ""}
            onClick={() => { setMode("reset"); setError(null); }}
          >
            Reset password
          </button>
        </div>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        {notice && <div className="notice">{notice}</div>}

        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Name
              <input value={form.name} onChange={set("name")} required autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              required
              autoComplete="email"
            />
          </label>
          <label>
            {mode === "reset" ? "New password" : "Password"}
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {mode !== "login" && (
            <p className="hint">At least 8 characters.</p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Working…"
              : mode === "login"
              ? "Sign in"
              : mode === "register"
              ? "Create account"
              : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
