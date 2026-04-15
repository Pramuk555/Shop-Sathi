import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppLayout() {
  const location = useLocation();
  const hideNav = ['/login'].includes(location.pathname);

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <main className={`flex-1 ${!hideNav ? 'pb-60' : ''}`}>
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
