import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    // Set up listener before getSession() so the SIGNED_IN event fired
    // by an email confirmation token in the URL is never missed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // getSession() detects any token/code in the URL (email confirmation
    // redirects) and exchanges it for a live session automatically.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
