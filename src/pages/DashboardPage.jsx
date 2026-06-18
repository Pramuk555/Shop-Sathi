import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import * as dbService from '../services/db';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [stats, setStats] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const today = new Date().toDateString();
      const lastReset = localStorage.getItem('lastResetDate');
      if (lastReset !== today) {
        localStorage.setItem('todaySales', '0');
        localStorage.setItem('todayProfit', '0');
        localStorage.setItem('todayBills', '0');
        localStorage.setItem('lastResetDate', today);
      }
      let bills = JSON.parse(localStorage.getItem('bills') || '[]');
      if (!Array.isArray(bills)) bills = [];
      let udharList = JSON.parse(localStorage.getItem('udharList') || '[]');
      if (!Array.isArray(udharList)) udharList = [];
      const todayBillsArr = bills.filter(b => b.date && new Date(b.date).toDateString() === today);
      return {
        todaySales: todayBillsArr.reduce((s, b) => s + (Number(b.total) || 0), 0),
        todayProfit: todayBillsArr.reduce((s, b) => s + (Number(b.profit) || 0), 0),
        todayBills: todayBillsArr.length,
        totalToReceive: udharList.filter(u => u.type === 'receive').reduce((s, u) => s + (Number(u.remainingAmount) || 0), 0),
        totalToPay: udharList.filter(u => u.type === 'pay').reduce((s, u) => s + (Number(u.remainingAmount) || 0), 0)
      };
    }
    return { todaySales: 0, todayProfit: 0, todayBills: 0, totalToReceive: 0, totalToPay: 0 };
  });

  const [shopName, setShopName] = useState(() => {
    if (!currentUser || currentUser.demo) return localStorage.getItem('shopName') || '';
    return '';
  });

  const [lowStockCount, setLowStockCount] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const inv = JSON.parse(localStorage.getItem('products') || '[]');
      return inv.filter(p => Number(p.stock) <= Number(p.lowStockAlert ?? 5)).length;
    }
    return 0;
  });

  const [recentBills, setRecentBills] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const bills = JSON.parse(localStorage.getItem('bills') || '[]');
      return bills.slice(0, 3);
    }
    return [];
  });

  const [monthlySales, setMonthlySales] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const bills = JSON.parse(localStorage.getItem('bills') || '[]');
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      return bills.reduce((sum, b) => {
        const bDate = b.date ? new Date(b.date) : new Date(0);
        if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear)
          return sum + Number(b.total || 0);
        return sum;
      }, 0);
    }
    return 0;
  });

  const [weeklySalesData, setWeeklySalesData] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const bills = JSON.parse(localStorage.getItem('bills') || '[]');
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6 - i)); return d;
      });
      const weeklyData = last7Days.map(day =>
        bills.filter(b => { const bd = new Date(b.date); bd.setHours(0,0,0,0); return bd.getTime() === day.getTime(); })
          .reduce((sum, b) => sum + (Number(b.total) || 0), 0)
      );
      const maxVal = Math.max(...weeklyData, 1);
      return weeklyData.map(v => (v / maxVal) * 100);
    }
    return [0, 0, 0, 0, 0, 0, 0];
  });

  const [saleTrend, setSaleTrend] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const bills = JSON.parse(localStorage.getItem('bills') || '[]');
      const cm = new Date().getMonth(), cy = new Date().getFullYear();
      const mSales = bills.reduce((s,b) => { const d = b.date ? new Date(b.date) : new Date(0); return d.getMonth()===cm && d.getFullYear()===cy ? s+Number(b.total||0) : s; }, 0);
      const lmd = new Date(); lmd.setMonth(lmd.getMonth()-1);
      const lMonthSales = bills.reduce((s,b) => { const d = b.date ? new Date(b.date) : new Date(0); return d.getMonth()===lmd.getMonth() && d.getFullYear()===lmd.getFullYear() ? s+Number(b.total||0) : s; }, 0);
      if (lMonthSales > 0) { const pct = ((mSales - lMonthSales)/lMonthSales)*100; return { percent: Math.abs(Math.round(pct)), isUp: pct >= 0 }; }
      return { percent: 100, isUp: true };
    }
    return { percent: 0, isUp: true };
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [overdueUdharAlert, setOverdueUdharAlert] = useState(null);

  useEffect(() => {
    const processBillsData = (data) => {
      setRecentBills(data.slice(0, 3));
      const today = new Date().toDateString();
      const todayBillsArr = data.filter(b => b.date && new Date(b.date).toDateString() === today);
      setStats(prev => ({
        ...prev,
        todaySales: todayBillsArr.reduce((s, b) => s + (Number(b.total) || 0), 0),
        todayProfit: todayBillsArr.reduce((s, b) => s + (Number(b.profit) || 0), 0),
        todayBills: todayBillsArr.length
      }));
      const cm = new Date().getMonth(), cy = new Date().getFullYear();
      const mSales = data.reduce((s,b) => { const d=b.date?new Date(b.date):new Date(0); return d.getMonth()===cm&&d.getFullYear()===cy?s+Number(b.total||0):s; }, 0);
      setMonthlySales(mSales);
      const lmd = new Date(); lmd.setMonth(lmd.getMonth()-1);
      const lMonthSales = data.reduce((s,b) => { const d=b.date?new Date(b.date):new Date(0); return d.getMonth()===lmd.getMonth()&&d.getFullYear()===lmd.getFullYear()?s+Number(b.total||0):s; }, 0);
      if (lMonthSales > 0) { const pct=((mSales-lMonthSales)/lMonthSales)*100; setSaleTrend({percent:Math.abs(Math.round(pct)),isUp:pct>=0}); }
      else setSaleTrend({percent:100,isUp:true});
      const last7Days = [...Array(7)].map((_,i)=>{ const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-i));return d; });
      const weeklyData = last7Days.map(day => data.filter(b=>{ const bd=new Date(b.date);bd.setHours(0,0,0,0);return bd.getTime()===day.getTime(); }).reduce((s,b)=>s+(Number(b.total)||0),0));
      const maxVal = Math.max(...weeklyData, 1);
      setWeeklySalesData(weeklyData.map(v=>(v/maxVal)*100));
    };

    if (!currentUser || currentUser.demo) return;

    const unsubProfile = dbService.getShopProfile(currentUser.uid, (data) => {
      if (data) setShopName(data.shopName || 'ShopSaathi');
    });
    const unsubInventory = dbService.subscribeInventory(currentUser.uid, (data) => {
      setLowStockCount(data.filter(p => Number(p.stock) <= Number(p.lowStockAlert ?? 5)).length);
    });
    const unsubBills = dbService.subscribeBills(currentUser.uid, processBillsData);
    const unsubUdhar = dbService.subscribeUdhar(currentUser.uid, (data) => {
      const todayStr = new Date().toISOString().split('T')[0];
      setOverdueUdharAlert(data.find(u => u.status !== 'paid' && u.dueDate && u.dueDate < todayStr));
      setStats(prev => ({
        ...prev,
        totalToReceive: data.filter(u=>u.type==='receive').reduce((s,u)=>s+(Number(u.remainingAmount)||0),0),
        totalToPay: data.filter(u=>u.type==='pay').reduce((s,u)=>s+(Number(u.remainingAmount)||0),0)
      }));
    });

    return () => { unsubProfile?.(); unsubInventory?.(); unsubBills?.(); unsubUdhar?.(); };
  }, [currentUser]);

  const todayDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date());

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const hasAlerts = lowStockCount > 0 || !!overdueUdharAlert;

  return (
    <main className="max-w-[450px] mx-auto px-4 pt-4 pb-28 space-y-4 page-transition-enter">

      {/* ── Header ── */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl filled-icon">storefront</span>
          <h1 className="font-headline font-extrabold text-xl tracking-tight text-primary">ShopSaathi</h1>
        </div>
        <div className="flex items-center gap-1">
          {/* Settings */}
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-xl">settings</span>
          </button>
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
              {hasAlerts && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface" />
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-1 w-60 bg-surface rounded-2xl shadow-2xl border border-outline-variant/30 p-3 z-[100] animate-in slide-in-from-top-2 duration-200">
                <h4 className="font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3 px-1">Alerts</h4>
                <div className="space-y-2">
                  {lowStockCount > 0 && (
                    <button onClick={() => { navigate('/inventory'); setShowNotifications(false); }} className="w-full flex gap-2 text-sm p-2 hover:bg-surface-container-low rounded-xl text-left">
                      <span className="material-symbols-outlined text-error text-base">warning</span>
                      <p className="font-medium text-on-surface">{lowStockCount} items low on stock</p>
                    </button>
                  )}
                  {overdueUdharAlert && (
                    <button onClick={() => { navigate('/udhar'); setShowNotifications(false); }} className="w-full flex gap-2 text-sm p-2 hover:bg-surface-container-low rounded-xl text-left">
                      <span className="material-symbols-outlined text-secondary text-base">event_busy</span>
                      <p className="font-medium text-on-surface">Udhar overdue: {overdueUdharAlert.name}</p>
                    </button>
                  )}
                  {!hasAlerts && (
                    <p className="text-center py-3 text-on-surface-variant text-sm font-medium">All clear 🎉</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Greeting + Shop name ── */}
      <section className="flex items-baseline justify-between">
        <div>
          <p className="text-sm text-on-surface-variant font-medium">{getGreeting()},</p>
          <h2 className="font-headline text-2xl font-bold text-primary leading-tight truncate max-w-[220px]">
            {shopName || 'Your Shop'}
          </h2>
        </div>
        <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">{todayDate}</span>
      </section>

      {/* ── Stats grid ── */}
      <section className="grid grid-cols-2 gap-2">
        {/* Today Sales — full width */}
        <div className="col-span-2 bg-primary-fixed p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-on-primary-fixed/70 uppercase tracking-wider mb-0.5">{t('today_sales')}</p>
            <p className="font-headline text-3xl font-black text-on-primary-fixed">₹{(stats.todaySales||0).toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-fixed text-2xl filled-icon">payments</span>
          </div>
        </div>

        {/* Profit */}
        <div className="bg-tertiary-fixed-dim p-3 rounded-2xl">
          <p className="text-[10px] font-bold text-on-tertiary-fixed/70 uppercase tracking-wider">{t('today_profit')}</p>
          <p className="font-headline text-2xl font-black text-on-tertiary-fixed mt-0.5">₹{(stats.todayProfit||0).toLocaleString()}</p>
        </div>

        {/* Bills count */}
        <div className="bg-secondary-fixed p-3 rounded-2xl">
          <p className="text-[10px] font-bold text-on-secondary-fixed/70 uppercase tracking-wider">Bills Today</p>
          <p className="font-headline text-2xl font-black text-on-secondary-fixed mt-0.5">{stats.todayBills||0}</p>
        </div>

        {/* Udhar to receive */}
        <div className="bg-primary-fixed-dim p-3 rounded-2xl">
          <p className="text-[10px] font-bold text-on-primary-fixed/70 uppercase tracking-wider">{t('total_udhar')}</p>
          <p className="font-headline text-xl font-black text-on-primary-fixed mt-0.5">₹{(stats.totalToReceive||0).toLocaleString()}</p>
          <p className="text-[9px] text-on-primary-fixed/60 font-bold mt-0.5">To receive</p>
        </div>

        {/* Supplier to pay */}
        <div className="bg-error-container p-3 rounded-2xl">
          <p className="text-[10px] font-bold text-on-error-container/70 uppercase tracking-wider">To Pay</p>
          <p className="font-headline text-xl font-black text-on-error-container mt-0.5">₹{(stats.totalToPay||0).toLocaleString()}</p>
          <p className="text-[9px] text-on-error-container/60 font-bold mt-0.5">Supplier debt</p>
        </div>
      </section>

      {/* ── Low stock alert (only when present) ── */}
      {lowStockCount > 0 && (
        <button
          onClick={() => navigate('/inventory')}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-error-container border border-error/20 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-error filled-icon">inventory_2</span>
            <p className="text-sm font-bold text-on-error-container">{lowStockCount} items need restocking</p>
          </div>
          <span className="font-headline text-2xl font-black text-error">{lowStockCount}</span>
        </button>
      )}

      {/* ── Overdue udhar (only when present) ── */}
      {overdueUdharAlert && (
        <button
          onClick={() => navigate('/udhar')}
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low border border-secondary/20 active:scale-[0.98] transition-transform"
        >
          <span className="material-symbols-outlined text-secondary filled-icon">event_busy</span>
          <div className="text-left">
            <p className="text-sm font-bold text-on-surface">Overdue: {overdueUdharAlert.name}</p>
            <p className="text-xs text-on-surface-variant">₹{overdueUdharAlert.remainingAmount?.toLocaleString()} due {overdueUdharAlert.dueDate}</p>
          </div>
        </button>
      )}

      {/* ── Weekly chart ── */}
      <section className="bg-surface-container-low p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">This Month</p>
            <p className="font-headline text-2xl font-black text-on-surface">₹{monthlySales.toLocaleString()}</p>
          </div>
          <span className={`text-xs font-black px-2 py-1 rounded-full flex items-center gap-0.5 ${saleTrend.isUp ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-error-container text-on-error-container'}`}>
            {saleTrend.percent}% {saleTrend.isUp ? '↑' : '↓'}
          </span>
        </div>
        {/* Bars */}
        <div className="flex items-end gap-1 h-12">
          {weeklySalesData.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t ${h > 75 ? 'bg-primary' : h > 40 ? 'bg-primary/50' : 'bg-surface-container-highest'}`}
              style={{ height: `${Math.max(h, 4)}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between">
          {[...Array(7)].map((_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return <span key={i} className="text-[9px] font-bold text-on-surface-variant/60 uppercase">{d.toLocaleDateString([],{weekday:'narrow'})}</span>;
          })}
        </div>
      </section>

      {/* ── Recent Bills ── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-base font-bold text-on-surface">Recent Bills</h3>
          <button onClick={() => navigate('/bills')} className="text-primary font-bold text-xs">{t('view_all')}</button>
        </div>

        {recentBills.length === 0 ? (
          <div className="p-8 text-center bg-surface-container-low rounded-2xl text-on-surface-variant text-sm border-2 border-dashed border-outline-variant/30 font-medium">
            No bills yet — tap + to create one
          </div>
        ) : (
          <div className="space-y-2">
            {recentBills.map(bill => (
              <div key={bill.id} className={`bg-surface-container-lowest p-3 rounded-2xl flex items-center justify-between border-l-4 ${bill.isUdhar ? 'border-error' : 'border-primary'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-surface-container-high rounded-full flex items-center justify-center font-bold text-primary text-sm">
                    {(bill.customerName || 'G').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-on-surface leading-none">{bill.customerName || t('guest')}</p>
                    <p className="text-on-surface-variant text-xs mt-0.5">
                      {bill.date ? new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-headline text-base font-black">₹{(bill.total || 0).toLocaleString()}</p>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${bill.isUdhar ? 'bg-error-container text-error' : 'bg-primary-container text-on-primary-container'}`}>
                    {bill.isUdhar ? t('udhar') : t('paid')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
