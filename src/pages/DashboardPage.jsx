import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import * as dbService from '../services/db';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
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
    if (!currentUser || currentUser.demo) {
      return localStorage.getItem('shopName') || '';
    }
    return '';
  });

  const [lowStockCount, setLowStockCount] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const inv = JSON.parse(localStorage.getItem('products') || '[]');
      return inv.filter(p => Number(p.stock) <= Number(p.lowStockAlert || 5)).length;
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
        if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
          return sum + Number(b.total || 0);
        }
        return sum;
      }, 0);
    }
    return 0;
  });
  const [weeklySalesData, setWeeklySalesData] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const bills = JSON.parse(localStorage.getItem('bills') || '[]');
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - (6 - i));
        return d;
      });
      const weeklyData = last7Days.map(day => {
        return bills.filter(b => {
          const bDate = new Date(b.date);
          bDate.setHours(0,0,0,0);
          return bDate.getTime() === day.getTime();
        }).reduce((sum, b) => sum + (Number(b.total) || 0), 0);
      });
      const maxVal = Math.max(...weeklyData, 1);
      return weeklyData.map(v => (v / maxVal) * 100);
    }
    return [0, 0, 0, 0, 0, 0, 0];
  });
  const [saleTrend, setSaleTrend] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const bills = JSON.parse(localStorage.getItem('bills') || '[]');
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const mSales = bills.reduce((sum, b) => {
        const bDate = b.date ? new Date(b.date) : new Date(0);
        if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
          return sum + Number(b.total || 0);
        }
        return sum;
      }, 0);

      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lMonth = lastMonthDate.getMonth();
      const lYear = lastMonthDate.getFullYear();
      const lMonthSales = bills.reduce((sum, b) => {
        const bDate = b.date ? new Date(b.date) : new Date(0);
        if (bDate.getMonth() === lMonth && bDate.getFullYear() === lYear) {
          return sum + Number(b.total || 0);
        }
        return sum;
      }, 0);

      if (lMonthSales > 0) {
        const diff = mSales - lMonthSales;
        const pct = (diff / lMonthSales) * 100;
        return { percent: Math.abs(Math.round(pct)), isUp: pct >= 0 };
      }
      return { percent: 100, isUp: true };
    }
    return { percent: 0, isUp: true };
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [criticalAlert, setCriticalAlert] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const inv = JSON.parse(localStorage.getItem('products') || '[]');
      const lowStock = inv.filter(p => Number(p.stock) <= Number(p.lowStockAlert || 5));
      return lowStock.length > 0 ? [...lowStock].sort((a, b) => a.stock - b.stock)[0] : null;
    }
    return null;
  });
  const [overdueUdharAlert, setOverdueUdharAlert] = useState(null);

  useEffect(() => {
    const processBillsData = (data) => {
      setRecentBills(data.slice(0, 3));
      const today = new Date().toDateString();
      const todayBillsArr = data ? data.filter(b => b.date && new Date(b.date).toDateString() === today) : [];
      
      const newTodaySales = todayBillsArr.reduce((s, b) => s + (Number(b.total) || 0), 0);
      const newTodayProfit = todayBillsArr.reduce((s, b) => s + (Number(b.profit) || 0), 0);

      setStats(prev => ({
        ...prev,
        todaySales: newTodaySales,
        todayProfit: newTodayProfit,
        todayBills: todayBillsArr.length
      }));

      // Monthly sales calculation
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const mSales = data.reduce((sum, b) => {
        const bDate = b.date ? new Date(b.date) : new Date(0);
        if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
          return sum + Number(b.total || 0);
        }
        return sum;
      }, 0);
      setMonthlySales(mSales);

      // Monthly Trend
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lMonth = lastMonthDate.getMonth();
      const lYear = lastMonthDate.getFullYear();
      const lMonthSales = data.reduce((sum, b) => {
        const bDate = b.date ? new Date(b.date) : new Date(0);
        if (bDate.getMonth() === lMonth && bDate.getFullYear() === lYear) {
          return sum + Number(b.total || 0);
        }
        return sum;
      }, 0);

      if (lMonthSales > 0) {
        const diff = mSales - lMonthSales;
        const pct = (diff / lMonthSales) * 100;
        setSaleTrend({ percent: Math.abs(Math.round(pct)), isUp: pct >= 0 });
      } else {
        setSaleTrend({ percent: 100, isUp: true });
      }

      // Weekly Data (last 7 days)
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - (6 - i));
        return d;
      });
      const weeklyData = last7Days.map(day => {
        return data.filter(b => {
          const bDate = new Date(b.date);
          bDate.setHours(0,0,0,0);
          return bDate.getTime() === day.getTime();
        }).reduce((sum, b) => sum + (Number(b.total) || 0), 0);
      });
      const maxVal = Math.max(...weeklyData, 1);
      setWeeklySalesData(weeklyData.map(v => (v / maxVal) * 100));
    };

    if (!currentUser || currentUser.demo) {
      return;
    }

    const unsubProfile = dbService.getShopProfile(currentUser.uid, (data) => {
      if (data) setShopName(data.shopName || 'ShopSaathi');
    });

    const unsubInventory = dbService.subscribeInventory(currentUser.uid, (data) => {
      const lowStock = data.filter(p => Number(p.stock) <= Number(p.lowStockAlert || 5));
      setLowStockCount(lowStock.length);
      if (lowStock.length > 0) {
        setCriticalAlert([...lowStock].sort((a, b) => a.stock - b.stock)[0]);
      }
    });

    const unsubBills = dbService.subscribeBills(currentUser.uid, (data) => {
      processBillsData(data);
    });

    const unsubUdhar = dbService.subscribeUdhar(currentUser.uid, (data) => {
      const todayStr = new Date().toISOString().split('T')[0];
      setOverdueUdharAlert(data.find(u => u.status !== 'paid' && u.dueDate && u.dueDate < todayStr));
      
      setStats(prev => ({
        ...prev,
        totalToReceive: data.filter(u => u.type === 'receive').reduce((s, u) => s + (Number(u.remainingAmount) || 0), 0),
        totalToPay: data.filter(u => u.type === 'pay').reduce((s, u) => s + (Number(u.remainingAmount) || 0), 0)
      }));
    });

    return () => {
      unsubProfile?.();
      unsubInventory?.();
      unsubBills?.();
      unsubUdhar?.();
    };
  }, [currentUser]);

  const todayDate = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language === 'hi' ? 'hi-IN' : 'kn-IN', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  }).format(new Date());

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('good_morning') + ' 🌅';
    if (hour < 17) return t('good_afternoon') + ' ☀️';
    return t('good_evening') + ' 🌙';
  };

  // Display stats array for rendering
  const statsConfig = [
    { label: t('today_sales'), value: `₹${(stats?.todaySales || 0).toLocaleString()}`, icon: "payments", color: "bg-primary-fixed", text: "text-on-primary-fixed", fullWidth: true },
    { label: t('today_profit'), value: `₹${(stats?.todayProfit || 0).toLocaleString()}`, icon: "trending_up", color: "bg-tertiary-fixed-dim", text: "text-on-tertiary-fixed", trend: t('live_margin') },
    { label: t('history'), value: (stats?.todayBills || 0).toString(), icon: "receipt_long", color: "bg-secondary-fixed", text: "text-on-secondary-fixed", trend: t('satisfied') },
    { label: t('total_udhar'), value: `₹${(stats?.totalToReceive || 0).toLocaleString()}`, icon: "account_balance_wallet", color: "bg-primary-fixed-dim", text: "text-on-primary-fixed", trend: t('customer_debt') },
    { label: t('overdue_udhar'), value: `₹${(stats?.totalToPay || 0).toLocaleString()}`, icon: "outbound", color: "bg-error-container", text: "text-on-error-container", trend: t('supplier_debt') },
  ];

  return (
    <main className="max-w-[450px] mx-auto px-6 pt-8 space-y-8 safe-bottom-padding page-transition-enter">
      {/* Top AppBar replacement */}
      <header className="flex items-center justify-between py-4 relative">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl">storefront</span>
          <h1 className="font-headline font-extrabold text-2xl tracking-tight text-primary">ShopSaathi</h1>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
            {(lowStockCount > 0 || overdueUdharAlert) && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface"></span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-64 bg-surface rounded-2xl shadow-2xl border border-outline-variant p-4 z-[100] animate-in slide-in-from-top-2 duration-200">
              <h4 className="font-bold text-sm uppercase tracking-widest text-on-surface-variant mb-4 px-2">Notifications</h4>
              <div className="space-y-3">
                {lowStockCount > 0 && (
                  <div className="flex gap-3 text-sm p-2 hover:bg-surface-container-low rounded-xl transition-colors">
                    <span className="material-symbols-outlined text-error">warning</span>
                    <p className="font-medium text-on-surface">⚠️ {lowStockCount} items are low on stock</p>
                  </div>
                )}
                {overdueUdharAlert && (
                  <div className="flex gap-3 text-sm p-2 hover:bg-surface-container-low rounded-xl transition-colors">
                    <span className="material-symbols-outlined text-secondary">event_busy</span>
                    <p className="font-medium text-on-surface">⚠️ Udhar overdue for {overdueUdharAlert.name}</p>
                  </div>
                )}
                {lowStockCount === 0 && !overdueUdharAlert && (
                  <div className="text-center py-4 text-on-surface-variant opacity-50 font-bold italic">
                    No new notifications 🔔
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Greeting */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xl font-bold text-on-surface">{getGreeting()}</span>
          <span className="text-sm font-medium text-on-surface-variant">{t('today') || 'Today'}, {todayDate}</span>
        </div>
        <h2 className="font-headline text-3xl text-primary tracking-tight">{shopName}</h2>
      </section>

      {/* Bento Grid Metrics */}
      <section className="grid grid-cols-2 gap-4">
        {statsConfig.map((stat, i) => (
          <div key={i} className={`${stat.color} ${stat.fullWidth ? 'col-span-2' : ''} p-6 rounded-lg flex flex-col justify-between shadow-sm relative overflow-hidden h-32 clickable transition-all duration-200 hover:shadow-md`}>
            {stat.fullWidth ? (
              <div className="flex flex-row items-center justify-between h-full">
                <div>
                  <p className={`${stat.text}-variant font-bold text-lg mb-1`}>{stat.label}</p>
                  <p className={`font-headline text-4xl ${stat.text}`}>{stat.value}</p>
                </div>
                <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center">
                  <span className={`material-symbols-outlined text-3xl ${stat.text} filled-icon`}>{stat.icon}</span>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className={`${stat.text}-variant font-bold text-base mb-1`}>{stat.label}</p>
                  <p className={`font-headline text-2xl ${stat.text}`}>{stat.value}</p>
                </div>
                <div className="mt-2 text-sm font-medium flex items-center gap-1 opacity-80">
                  <span className="material-symbols-outlined text-sm">{stat.icon === 'trending_up' ? 'trending_up' : 'receipt_long'}</span>
                  <span>{stat.trend}</span>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Low Stock Banner */}
        <div 
          onClick={() => navigate('/inventory')}
          className="col-span-2 p-5 rounded-lg bg-error-container flex items-center justify-between border-l-4 border-error low-stock-pulse cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error filled-icon">inventory_2</span>
            </div>
            <div>
              <p className="text-on-error-container font-bold text-lg">{t('low_stock')}</p>
              <p className="text-on-error-container/80 text-sm">{lowStockCount} {t('items')} {t('need_ordering')}</p>
            </div>
          </div>
          <p className="font-headline text-3xl text-error">{lowStockCount}</p>
        </div>
      </section>

      {/* Monthly Sales Chart Simulation */}
      <section className="p-6 rounded-lg bg-surface-container-low space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-on-surface-variant font-bold text-lg uppercase tracking-wider">{t('this_months_sales')}</p>
            <p className="font-headline text-4xl text-on-surface">₹{monthlySales.toLocaleString()}</p>
          </div>
          <span className={`${saleTrend.isUp ? 'text-primary bg-primary-fixed' : 'text-error bg-error-container'} font-bold text-sm px-3 py-1 rounded-full flex items-center gap-1`}>
            {saleTrend.percent}% {saleTrend.isUp ? '↑' : '↓'}
          </span>
        </div>
        <div className="flex items-end justify-between h-24 gap-2 pt-4 px-2">
          {weeklySalesData.map((h, i) => (
            <div key={i} className={`w-full rounded-t-lg ${h > 80 ? 'bg-primary' : 'bg-surface-container-highest'}`} style={{ height: `${h}%` }}></div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-bold text-on-surface-variant px-1 uppercase">
          {[...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return <span key={i}>{d.toLocaleDateString([], { weekday: 'short' })}</span>
          })}
        </div>
      </section>

      {/* Critical & Overdue Alerts */}
      {(criticalAlert || overdueUdharAlert) && (
        <section className="space-y-4 animate-in fade-in duration-500">
          <h3 className="font-headline text-xl font-bold flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-error">warning</span>
            {t('priority_alerts')}
          </h3>
          <div className="space-y-3">
            {criticalAlert && (
              <div 
                onClick={() => navigate('/inventory')}
                className="flex items-center gap-4 p-4 bg-surface-container-lowest rounded-lg border-l-8 border-error shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-error text-3xl">production_quantity_limits</span>
                <div>
                  <p className="font-bold text-lg">{criticalAlert.name}</p>
                  <p className="text-on-surface-variant text-sm font-medium">{t('only')} {criticalAlert.stock} {t('units_left')}</p>
                </div>
              </div>
            )}
            
            {overdueUdharAlert && (
              <div 
                onClick={() => navigate('/udhar')}
                className="flex items-center gap-4 p-4 bg-surface-container-lowest rounded-lg border-l-8 border-secondary shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-secondary text-3xl">event_busy</span>
                <div>
                  <p className="font-bold text-lg">{t('overdue')}: {overdueUdharAlert.name}</p>
                  <p className="text-on-surface-variant text-sm font-medium">₹{overdueUdharAlert.remainingAmount.toLocaleString()} {t('payment_due_on')} {overdueUdharAlert.dueDate}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Recent Bills */}
      <section className="space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-xl font-bold">{t('history')}</h3>
          <button onClick={() => navigate('/bills')} className="text-primary font-bold text-sm">{t('view_all')}</button>
        </div>
        <div className="space-y-4">
          {recentBills.length === 0 ? (
            <div className="p-10 text-center bg-surface-container-low rounded-xl text-outline border-2 border-dashed border-outline-variant/30 font-bold">
              No bills generated yet
            </div>
          ) : (
            recentBills.map(bill => (
              <div key={bill.id} className={`bg-surface-container-lowest p-5 rounded-lg flex items-center justify-between border-l-4 ${bill.isUdhar ? 'border-error' : 'border-primary'} shadow-sm`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center font-bold text-primary">
                    {(bill.customerName || 'Guest').split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{bill.customerName || t('guest')}</p>
                    <p className="text-on-surface-variant text-sm font-medium">{bill.date ? new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-headline text-lg">₹{bill.total.toLocaleString()}</p>
                  <span className={`${bill.isUdhar ? 'bg-error-container text-error' : 'bg-primary-container text-primary'} font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest`}>
                    {bill.isUdhar ? t('udhar') : t('paid')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Big Prominent CTA */}
      <section className="fixed-action-footer px-5 z-40">
        <button 
          onClick={() => navigate('/new-bill')}
          className="signature-gradient w-full py-6 rounded-xl flex items-center justify-center gap-4 text-on-primary font-bold text-xl shadow-2xl active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-3xl filled-icon">add_circle</span>
          {t('bill')}
        </button>
      </section>
    </main>
  );
}
