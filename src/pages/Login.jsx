import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#121212" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-bold uppercase tracking-widest"
            style={{ color: "#c4a35d" }}
          >
            LEDGR
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#888888" }}>
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 rounded-lg"
          style={{ backgroundColor: "#1e1e1e", border: "1px solid #2a2a2a" }}
        >
          {error && (
            <div
              className="rounded-lg px-4 py-2 text-sm"
              style={{ backgroundColor: "#e0525220", border: "1px solid #e05252", color: "#e05252" }}
            >
              {error}
            </div>
          )}
          {message && (
            <div
              className="rounded-lg px-4 py-2 text-sm"
              style={{ backgroundColor: "#4caf7d20", border: "1px solid #4caf7d", color: "#4caf7d" }}
            >
              {message}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#f5f5f0" }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: "#121212",
                border: "1px solid #2a2a2a",
                color: "#f5f5f0",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#c4a35d")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#f5f5f0" }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: "#121212",
                border: "1px solid #2a2a2a",
                color: "#f5f5f0",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#c4a35d")}
              onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold rounded-lg py-2 text-sm transition-opacity"
            style={{
              backgroundColor: "#c4a35d",
              color: "#121212",
              opacity: loading ? 0.5 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-sm mt-4" style={{ color: "#888888" }}>
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setMessage(null);
            }}
            className="font-medium transition-opacity hover:opacity-80"
            style={{ color: "#c4a35d" }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
