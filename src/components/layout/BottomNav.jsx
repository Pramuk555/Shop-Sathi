import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

// 4 nav items with a FAB slot in the center
const leftItems = [
  { path: '/dashboard', labelKey: 'home', icon: 'home' },
  { path: '/bills', labelKey: 'history', icon: 'receipt_long' },
];
const rightItems = [
  { path: '/udhar', labelKey: 'udhar', icon: 'payments' },
  { path: '/inventory', labelKey: 'stock', icon: 'inventory_2' },
];

function NavItem({ path, icon, label }) {
  return (
    <NavLink to={path} className="flex-1">
      {({ isActive }) => (
        <div className={`flex flex-col items-center gap-0.5 py-2 transition-colors duration-200 ${isActive ? 'text-[#0d631b]' : 'text-slate-400'}`}>
          <div className={`w-12 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-green-100' : ''}`}>
            <span className={`material-symbols-outlined text-[22px] leading-none ${isActive ? 'filled-icon' : ''}`}>
              {icon}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider leading-none">{label}</span>
        </div>
      )}
    </NavLink>
  );
}

export default function BottomNav() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isNewBill = location.pathname === '/new-bill';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-[450px] mx-auto">
      <div className="relative flex items-end bg-white border-t border-slate-100 shadow-[0_-2px_16px_rgba(0,0,0,0.06)] rounded-t-2xl px-2 pb-4 pt-1">
        {/* Left items */}
        <div className="flex flex-1 justify-around">
          {leftItems.map(item => (
            <NavItem key={item.path} path={item.path} icon={item.icon} label={t(item.labelKey)} />
          ))}
        </div>

        {/* Center FAB */}
        <div className="flex flex-col items-center px-3" style={{ marginTop: '-20px' }}>
          <button
            onClick={() => navigate('/new-bill')}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all duration-200 ${
              isNewBill
                ? 'bg-[#00490e] shadow-green-800/40'
                : 'bg-gradient-to-br from-[#0d631b] to-[#00490e] shadow-green-900/30'
            }`}
          >
            <span className="material-symbols-outlined text-white text-2xl filled-icon">
              {isNewBill ? 'edit_note' : 'add'}
            </span>
          </button>
          <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${isNewBill ? 'text-[#0d631b]' : 'text-slate-400'}`}>
            {t('bill')}
          </span>
        </div>

        {/* Right items */}
        <div className="flex flex-1 justify-around">
          {rightItems.map(item => (
            <NavItem key={item.path} path={item.path} icon={item.icon} label={t(item.labelKey)} />
          ))}
        </div>
      </div>
    </nav>
  );
}
