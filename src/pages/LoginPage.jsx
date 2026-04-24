import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const { sendMagicLink, signIn, signUp, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) navigate('/dashboard');
  }, [currentUser, navigate]);

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email.'); return; }
    setLoading(true);
    const { error: err } = await sendMagicLink(email);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (!email || !password) { setPwError('Enter email and password.'); return; }
    if (password.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    if (isSignUp) {
      const { error: err } = await signUp(email, password);
      setLoading(false);
      if (err) { setPwError(err.message); return; }
      setPwSuccess('Account created! Check your email to confirm, then log in.');
    } else {
      const { error: err } = await signIn(email, password);
      setLoading(false);
      if (err) { setPwError(err.message); return; }
      navigate('/dashboard');
    }
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[390px] bg-surface min-h-[844px] flex flex-col relative overflow-hidden">

        {/* Branding */}
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

        {/* Form */}
        <main className="flex-1 px-6 pb-12">
          <div className="bg-surface-container-low rounded-xl p-8 flex flex-col gap-6">

            {!showPassword ? (
              /* ── MAGIC LINK MODE ── */
              sent ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="w-20 h-20 bg-primary-fixed rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-5xl">mark_email_read</span>
                  </div>
                  <h3 className="font-headline font-bold text-xl text-on-surface">Check your email!</h3>
                  <p className="text-on-surface-variant text-base leading-relaxed">
                    We sent a login link to<br />
                    <span className="font-bold text-primary">{email}</span>
                  </p>
                  <p className="text-on-surface-variant text-sm">Tap the link in the email — you'll be logged in instantly.</p>
                  <button
                    onClick={() => { setSent(false); setEmail(''); }}
                    className="text-primary text-sm font-bold hover:underline mt-2"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form className="flex flex-col gap-5" onSubmit={handleMagicLink}>
                  <div className="text-center">
                    <h3 className="font-headline font-bold text-xl text-on-surface">Enter your email</h3>
                    <p className="text-on-surface-variant text-sm mt-1">We'll send you a login link — no password needed</p>
                  </div>

                  {error && (
                    <p className="text-error text-center font-bold text-sm bg-error-container p-2 rounded-lg">{error}</p>
                  )}

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-xl">mail</span>
                    <input
                      className="w-full h-[56px] pl-12 pr-4 bg-surface-container-high rounded-lg border-none text-base font-medium focus:ring-2 focus:ring-secondary/20 transition-all placeholder:text-outline-variant/50"
                      placeholder="you@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="signature-gradient w-full h-14 rounded-full flex items-center justify-center gap-3 text-on-primary font-headline font-bold text-lg shadow-lg active:scale-95 transition-transform"
                  >
                    {loading
                      ? <span className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full" />
                      : <><span>Send Login Link</span><span className="material-symbols-outlined">send</span></>
                    }
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowPassword(true); setError(''); }}
                    className="text-on-surface-variant text-sm font-medium hover:text-primary transition-colors text-center"
                  >
                    Prefer password? Login with password →
                  </button>
                </form>
              )
            ) : (
              /* ── PASSWORD MODE ── */
              <form className="flex flex-col gap-5" onSubmit={handlePasswordLogin}>
                <div className="flex bg-surface-container-high rounded-xl p-1 gap-1">
                  <button type="button" onClick={() => { setIsSignUp(false); setPwError(''); setPwSuccess(''); }}
                    className={`flex-1 py-2 rounded-lg font-headline font-bold text-base transition-all ${!isSignUp ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>
                    Login
                  </button>
                  <button type="button" onClick={() => { setIsSignUp(true); setPwError(''); setPwSuccess(''); }}
                    className={`flex-1 py-2 rounded-lg font-headline font-bold text-base transition-all ${isSignUp ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>
                    Sign Up
                  </button>
                </div>

                {pwError && <p className="text-error text-center font-bold text-sm bg-error-container p-2 rounded-lg">{pwError}</p>}
                {pwSuccess && <p className="text-center font-bold text-sm bg-primary-fixed p-2 rounded-lg text-on-primary-fixed">{pwSuccess}</p>}

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-xl">mail</span>
                  <input
                    className="w-full h-[56px] pl-12 pr-4 bg-surface-container-high rounded-lg border-none text-base font-medium focus:ring-2 focus:ring-secondary/20 transition-all placeholder:text-outline-variant/50"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-xl">lock</span>
                  <input
                    className="w-full h-[56px] pl-12 pr-12 bg-surface-container-high rounded-lg border-none text-base font-medium focus:ring-2 focus:ring-secondary/20 transition-all placeholder:text-outline-variant/50"
                    placeholder={isSignUp ? 'Min. 6 characters' : 'Enter your password'}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="signature-gradient w-full h-14 rounded-full flex items-center justify-center gap-3 text-on-primary font-headline font-bold text-lg shadow-lg active:scale-95 transition-transform"
                >
                  {loading
                    ? <span className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full" />
                    : <><span>{isSignUp ? 'Create Account' : 'Login'}</span><span className="material-symbols-outlined">arrow_forward</span></>
                  }
                </button>

                <button
                  type="button"
                  onClick={() => { setShowPassword(false); setPwError(''); setPwSuccess(''); }}
                  className="text-on-surface-variant text-sm font-medium hover:text-primary transition-colors text-center flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  Back to magic link login
                </button>
              </form>
            )}
          </div>
        </main>

        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-fixed rounded-full blur-[80px] opacity-40 -z-10"></div>
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-secondary-fixed rounded-full blur-[60px] opacity-30 -z-10"></div>

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
