import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    todaySales: 0,
    todayProfit: 0,
    todayBills: 0
  });

  const [lowStockCount, setLowStockCount] = useState(0);
  const [recentBills, setRecentBills] = useState([]);
  const [monthlySales, setMonthlySales] = useState(0);
  const [criticalAlert, setCriticalAlert] = useState(null);

  useEffect(() => {
    // 1. Check for Midnight Reset
    const lastReset = localStorage.getItem('lastResetDate');
    const today = new Date().toDateString();
    
    if (lastReset !== today) {
      localStorage.setItem('todaySales', '0');
      localStorage.setItem('todayProfit', '0');
      localStorage.setItem('todayBills', '0');
      localStorage.setItem('lastResetDate', today);
    }

    // 2. Load Stats
    setStats({
      todaySales: Number(localStorage.getItem('todaySales') || 0),
      todayProfit: Number(localStorage.getItem('todayProfit') || 0),
      todayBills: Number(localStorage.getItem('todayBills') || 0)
    });

    // 3. Load Bills & Monthly Sales
    const bills = JSON.parse(localStorage.getItem('bills') || '[]');
    setRecentBills(bills.slice(0, 3));

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const mSales = bills.reduce((sum, b) => {
      const bDate = new Date(b.date);
      if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
        return sum + Number(b.total || 0);
      }
      return sum;
    }, 0);
    setMonthlySales(mSales);

    // 4. Load Low Stock & Alerts
    const products = JSON.parse(localStorage.getItem('products') || '[]');
    const lowStockItems = products.filter(p => Number(p.stock) <= Number(p.lowStockAlert || 5));
    setLowStockCount(lowStockItems.length);
    if (lowStockItems.length > 0) {
      setCriticalAlert(lowStockItems[0]);
    }
  }, []);

  const shopName = "Amrut Ayurvedic & Herbs";
  const todayDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Display stats array for rendering
  const statsConfig = [
    { label: "Today's Sales", value: `₹${stats.todaySales.toLocaleString()}`, icon: "payments", color: "bg-primary-fixed", text: "text-on-primary-fixed", fullWidth: true },
    { label: "Profit", value: `₹${stats.todayProfit.toLocaleString()}`, icon: "trending_up", color: "bg-tertiary-fixed-dim", text: "text-on-tertiary-fixed", trend: "Live Margin" },
    { label: "Bills Today", value: stats.todayBills.toString(), icon: "receipt_long", color: "bg-secondary-fixed", text: "text-on-secondary-fixed", trend: "Satisfied" },
  ];

  return (
    <main className="max-w-[450px] mx-auto px-6 pt-8 space-y-8 safe-bottom-padding page-transition-enter">
      {/* Top AppBar replacement */}
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl">storefront</span>
          <h1 className="font-headline font-extrabold text-2xl tracking-tight text-primary">ShopSaathi</h1>
        </div>
        <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-95">
          <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
        </button>
      </header>

      {/* Greeting */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xl font-bold text-on-surface">Good Morning! 🌅</span>
          <span className="text-sm font-medium text-on-surface-variant">Today, {todayDate}</span>
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
              <p className="text-on-error-container font-bold text-lg">Low Stock Items</p>
              <p className="text-on-error-container/80 text-sm">{lowStockCount} items need ordering</p>
            </div>
          </div>
          <p className="font-headline text-3xl text-error">{lowStockCount}</p>
        </div>
      </section>

      {/* Monthly Sales Chart Simulation */}
      <section className="p-6 rounded-lg bg-surface-container-low space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-on-surface-variant font-bold text-lg uppercase tracking-wider">This Month's Sales</p>
            <p className="font-headline text-4xl text-on-surface">₹{monthlySales.toLocaleString()}</p>
          </div>
          <span className="text-primary font-bold text-sm bg-primary-fixed px-3 py-1 rounded-full">+14% ↑</span>
        </div>
        <div className="flex items-end justify-between h-24 gap-2 pt-4 px-2">
          {[40, 65, 50, 90, 55, 70, 85].map((h, i) => (
            <div key={i} className={`w-full rounded-t-lg ${h > 80 ? 'bg-primary' : 'bg-surface-container-highest'}`} style={{ height: `${h}%` }}></div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-bold text-on-surface-variant px-1 uppercase">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}
        </div>
      </section>

      {/* Critical Alerts */}
      {criticalAlert && (
        <section className="space-y-4 animate-in fade-in duration-500">
          <h3 className="font-headline text-xl font-bold flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-error">warning</span>
            Critical Alerts
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 bg-surface-container-lowest rounded-lg border-l-8 border-error shadow-sm">
              <span className="material-symbols-outlined text-error text-3xl">production_quantity_limits</span>
              <div>
                <p className="font-bold text-lg">{criticalAlert.name}</p>
                <p className="text-on-surface-variant text-sm font-medium">Only {criticalAlert.stock} units left in stock</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Bills */}
      <section className="space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-xl font-bold">Recent Bills</h3>
          <button onClick={() => navigate('/inventory')} className="text-primary font-bold text-sm">View All</button>
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
                    <p className="font-bold text-lg">{bill.customerName || 'Guest'}</p>
                    <p className="text-on-surface-variant text-sm font-medium">{new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-headline text-lg">₹{bill.total.toLocaleString()}</p>
                  <span className={`${bill.isUdhar ? 'bg-error-container text-error' : 'bg-primary-container text-primary'} font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest`}>
                    {bill.isUdhar ? 'Udhar' : 'Paid'}
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
          Create New Bill
        </button>
      </section>
    </main>
  );
}
