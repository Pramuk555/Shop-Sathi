/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo mode — no Supabase configured yet
      setCurrentUser({ demo: true, email: 'demo@shopsaathi.app' });
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo mode
      const demoUser = { demo: true, email };
      setCurrentUser(demoUser);
      return { user: demoUser, error: null };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { user: data?.user, error };
  };

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo mode
      const demoUser = { demo: true, email };
      setCurrentUser(demoUser);
      return { user: demoUser, error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: data?.user, error };
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    signUp,
    signIn,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
