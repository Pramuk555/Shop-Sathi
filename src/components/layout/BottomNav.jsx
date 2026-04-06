import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', label: 'Home', icon: 'home' },
  { path: '/new-bill', label: 'New Bill', icon: 'receipt_long' },
  { path: '/inventory', label: 'My Stock', icon: 'inventory_2' },
  { path: '/udhar', label: 'Udhar', icon: 'payments' },
  { path: '/settings', label: 'Settings', icon: 'settings' }
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-white dark:bg-slate-950 z-50 rounded-t-[3rem] shadow-[0_-8px_24px_rgba(25,28,29,0.06)] border-t border-slate-100 dark:border-slate-800">
      {navItems.map((item) => (
        <NavLink 
          key={item.path} 
          to={item.path} 
          className={({ isActive }) => `
            flex flex-col items-center justify-center transition-all duration-200 
            hover:-translate-y-0.5 active:scale-90
            ${isActive 
              ? 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 rounded-full px-6 py-3 min-h-[64px] animate-pulse-subtle shadow-sm' 
              : 'text-slate-500 dark:text-slate-400 px-4 py-2 min-h-[64px] hover:bg-green-50 dark:hover:bg-green-900/10'
            }
          `}
        >
          <span className={`material-symbols-outlined transition-transform duration-200 ${item.icon === 'payments' || item.icon === 'inventory_2' ? '' : 'mb-1'} ${item.icon === 'home' || item.path === '/udhar' ? 'filled-icon' : ''}`}>
            {item.icon}
          </span>
          <span className="font-body font-bold text-[10px] uppercase tracking-wide">
            {item.label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
