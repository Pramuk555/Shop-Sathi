import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useState, useEffect } from 'react';

export default function AppLayout() {
  const location = useLocation();
  const hideNav = ['/login'].includes(location.pathname);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = sessionStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-on-primary px-4 py-3 flex items-center gap-3 shadow-lg">
          <span className="material-symbols-outlined text-xl">install_mobile</span>
          <span className="flex-1 font-headline font-bold text-sm">Install ShopSaathi as an app</span>
          <button
            onClick={handleInstall}
            className="bg-on-primary text-primary font-bold text-xs px-3 py-1.5 rounded-full"
          >
            Install
          </button>
          <button onClick={handleDismiss} className="opacity-70">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}
      <main className={`flex-1 ${showBanner ? 'pt-12' : ''}`}>
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
