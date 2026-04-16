/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    if (!isSupabaseConfigured || !supabase) {
      return { demo: true, email: 'demo@shopsaathi.app' };
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    return isSupabaseConfigured && supabase ? true : false;
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    // Normalize Supabase user to always expose .uid (same as .id)
    const normalize = (user) => user ? { ...user, uid: user.id } : null;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(normalize(session?.user) ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(normalize(session?.user) ?? null);
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
