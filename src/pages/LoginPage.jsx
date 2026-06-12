import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { signIn, signUp, currentUser, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isResetMode) {
      if (!email) {
        setError('Please enter your email.');
        return;
      }
    } else {
      if (!email || !password) {
        setError('Please enter your email and password.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isResetMode) {
        const { error: resetError } = await resetPassword(email);
        if (resetError) {
          setError(resetError.message);
        } else {
          setSuccessMsg('Password reset link sent to your email!');
          setIsResetMode(false);
        }
      } else if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setSuccessMsg('Account created! Please check your email to confirm, then log in.');
          setIsSignUp(false);
          setPassword('');
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message);
        } else {
          navigate('/dashboard');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[390px] bg-surface min-h-[844px] flex flex-col relative overflow-hidden">

        {/* Top Branding Section */}
        <header className="pt-12 pb-8 px-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-10">
            <span className="material-symbols-outlined text-primary text-4xl">storefront</span>
            <h1 className="font-headline font-extrabold text-3xl tracking-tight text-primary">ShopSaathi</h1>
          </div>

          <div className="w-32 h-32 bg-primary-fixed rounded-full flex items-center justify-center mb-8 shadow-sm">
            <span className="material-symbols-outlined text-primary text-6xl">eco</span>
          </div>

          <h2 className="font-headline font-bold text-2xl mb-3 text-on-surface leading-tight">
            Aapki Dukaan, Aapka Saathi
          </h2>
          <p className="text-on-surface-variant font-medium text-lg leading-relaxed">
            Simple billing for every shop
          </p>
        </header>

        {/* Form Area */}
        <main className="flex-1 px-6 pb-12">
          <div className="bg-surface-container-low rounded-xl p-8 flex flex-col gap-6 transition-all">

            {/* Tab Toggle */}
            {!isResetMode ? (
              <div className="flex bg-surface-container-high rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(false); setError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-2 rounded-lg font-headline font-bold text-base transition-all ${!isSignUp ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-2 rounded-lg font-headline font-bold text-base transition-all ${isSignUp ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}
                >
                  Sign Up
                </button>
              </div>
            ) : (
              <h3 className="font-headline font-bold text-xl text-center text-primary">Reset Password</h3>
            )}

            {error && (
              <p className="text-error text-center font-bold text-sm bg-error-container p-2 rounded-lg">
                {error}
              </p>
            )}
            {successMsg && (
              <p className="text-center font-bold text-sm bg-primary-fixed p-2 rounded-lg text-on-primary-fixed">
                {successMsg}
              </p>
            )}

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              {/* Email Field */}
              <div className="flex flex-col gap-2">
                <label className="font-headline font-bold text-base text-on-surface px-1">
                  Email address
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-xl">
                    mail
                  </span>
                  <input
                    className="w-full h-[56px] pl-12 pr-4 bg-surface-container-high rounded-lg border-none text-base font-medium focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant/50"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              {!isResetMode && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="font-headline font-bold text-base text-on-surface">
                      Password
                    </label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => { setIsResetMode(true); setError(''); setSuccessMsg(''); }}
                        className="text-primary text-xs font-bold hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-xl">
                      lock
                    </span>
                    <input
                      className="w-full h-[56px] pl-12 pr-12 bg-surface-container-high rounded-lg border-none text-base font-medium focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant/50"
                      placeholder={isSignUp ? 'Min. 6 characters' : 'Enter your password'}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!isResetMode}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                      tabIndex={-1}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {isResetMode && (
                <button
                  type="button"
                  onClick={() => setIsResetMode(false)}
                  className="text-on-surface-variant text-sm font-bold flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  Back to Login
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="signature-gradient w-full h-14 rounded-full flex items-center justify-center gap-3 text-on-primary font-headline font-bold text-lg shadow-lg active:scale-95 transition-transform mt-2"
              >
                {loading ? (
                  <span className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <span>{isResetMode ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Login'}</span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </main>

        {/* Ambient Background Decoration */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-fixed rounded-full blur-[80px] opacity-40 -z-10"></div>
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-secondary-fixed rounded-full blur-[60px] opacity-30 -z-10"></div>

        {/* Footer */}
        <footer className="pb-10 px-8 text-center mt-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-full">
            <span className="material-symbols-outlined text-primary text-[18px] filled-icon">shield_lock</span>
            <span className="text-on-surface-variant font-medium text-sm">100% Safe & Secure Bahi Khata</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
