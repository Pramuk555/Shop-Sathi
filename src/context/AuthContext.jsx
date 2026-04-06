import { createContext, useContext, useEffect, useState } from 'react';
import { auth, isFirebaseConfigured } from '../firebase';
import { onAuthStateChanged as firebaseOnAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // In demo mode (no Firebase), we auto-set a fake user so the app is fully navigable
  const [currentUser, setCurrentUser] = useState(isFirebaseConfigured ? null : { demo: true, phoneNumber: '+91 0000000000' });
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Demo mode — skip Firebase auth listener
      setLoading(false);
      return;
    }

    // Real Firebase mode
    const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const sendOtp = async (phoneNumber, containerId) => {
    if (!isFirebaseConfigured || !auth) {
      // Demo mode: simulate OTP send
      await new Promise(r => setTimeout(r, 800));
      window._demoOtp = true;
      return true;
    }

    const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible'
      });
    }
    const appVerifier = window.recaptchaVerifier;
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    window.confirmationResult = confirmationResult;
    return true;
  };

  const verifyOtp = async (otp) => {
    if (!isFirebaseConfigured || window._demoOtp) {
      // Demo mode: simulate verify
      await new Promise(r => setTimeout(r, 500));
      const demoUser = { demo: true, phoneNumber: '+91 0000000000' };
      setCurrentUser(demoUser);
      return demoUser;
    }

    if (!window.confirmationResult) throw new Error('No OTP sent');
    const result = await window.confirmationResult.confirm(otp);
    return result.user;
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    }
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    sendOtp,
    verifyOtp,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
