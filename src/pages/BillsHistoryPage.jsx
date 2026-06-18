import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import * as dbService from '../services/db';

// ── date helpers ──────────────────────────────────────────────────────────────
function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
// Monday-based week start
function startOfWeek(d) {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0=Sun
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1));
  return x;
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export default function BillsHistoryPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentUser } = useAuth();

  const [bills, setBills] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return JSON.parse(localStorage.getItem('bills') || '[]');
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState('daily');
  const [anchor, setAnchor] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  const [dbError, setDbError] = useState(false);
  const [shopData, setShopData] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return {
        name: localStorage.getItem('shopName') || 'ShopSaathi Store',
        address: localStorage.getItem('shopAddress') || '',
        phone: localStorage.getItem('shopPhone') || '',
        logo: localStorage.getItem('shopLogo') || '',
        gstNumber: localStorage.getItem('shopGST') || '',
      };
    }
    return { name: 'ShopSaathi Store', address: '', phone: '', logo: '', gstNumber: '' };
  });

  useEffect(() => {
    if (!currentUser || currentUser.demo) return;
    const unsubBills = dbService.subscribeBills(currentUser.uid, setBills, () => setDbError(true));
    const unsubProfile = dbService.getShopProfile(currentUser.uid, (data) => {
      if (data) setShopData(data);
    });
    return () => { unsubBills(); unsubProfile(); };
  }, [currentUser]);

  // ── compute range for current tab + anchor ──────────────────────────────────
  const { rangeStart, rangeEnd, label, isPresent } = useMemo(() => {
    const now = new Date();
    if (activeTab === 'daily') {
      const s = startOfDay(anchor);
      const e = endOfDay(anchor);
      const todayStr = startOfDay(now).toDateString();
      const present = s.toDateString() === todayStr;
      const lbl = present
        ? 'Today'
        : s.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: s.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
      return { rangeStart: s, rangeEnd: e, label: lbl, isPresent: present };
    }
    if (activeTab === 'weekly') {
      const s = startOfWeek(anchor);
      const e = endOfDay(new Date(s.getTime() + 6 * 86400000));
      const presentWeekStart = startOfWeek(now).toDateString();
      const present = s.toDateString() === presentWeekStart;
      const lbl = present
        ? 'This Week'
        : `${s.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
      return { rangeStart: s, rangeEnd: e, label: lbl, isPresent: present };
    }
    // monthly
    const s = startOfMonth(anchor);
    const e = endOfMonth(anchor);
    const present = anchor.getMonth() === now.getMonth() && anchor.getFullYear() === now.getFullYear();
    const lbl = present
      ? 'This Month'
      : s.toLocaleDateString([], { month: 'long', year: 'numeric' });
    return { rangeStart: s, rangeEnd: e, label: lbl, isPresent: present };
  }, [activeTab, anchor]);

  const shiftPeriod = (dir) => {
    const d = new Date(anchor);
    if (activeTab === 'daily') d.setDate(d.getDate() + dir);
    else if (activeTab === 'weekly') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  // ── filter bills to period + search ────────────────────────────────────────
  const periodBills = useMemo(() => {
    return bills.filter(b => {
      if (!b.date) return false;
      const bd = new Date(b.date);
      if (bd < rangeStart || bd > rangeEnd) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (b.customerName || 'Guest').toLowerCase().includes(q) ||
        String(b.billNumber || '').includes(q);
    });
  }, [bills, rangeStart, rangeEnd, searchQuery]);

  // ── summary ─────────────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    count: periodBills.length,
    sales: periodBills.reduce((s, b) => s + (Number(b.total) || 0), 0),
    profit: periodBills.reduce((s, b) => s + (Number(b.profit) || 0), 0),
  }), [periodBills]);

  // ── group by day for weekly/monthly views ───────────────────────────────────
  const groupedByDay = useMemo(() => {
    if (activeTab === 'daily') return null;
    const groups = {};
    for (const b of periodBills) {
      const key = startOfDay(new Date(b.date)).toISOString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }
    return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [periodBills, activeTab]);

  const tabs = [
    { key: 'daily', label: 'Daily', icon: 'today' },
    { key: 'weekly', label: 'Weekly', icon: 'date_range' },
    { key: 'monthly', label: 'Monthly', icon: 'calendar_month' },
  ];

  return (
    <main className="max-w-[450px] mx-auto px-6 pt-8 pb-32 min-h-screen bg-surface page-transition-enter">

      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <h1 className="font-headline font-extrabold text-3xl tracking-tight text-on-surface">Bill History</h1>
      </header>

      {/* DB error banner */}
      {dbError && (
        <div className="bg-error-container text-on-error-container rounded-2xl p-4 flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-error text-2xl">cloud_off</span>
          <div>
            <p className="font-bold text-sm">Database unreachable</p>
            <p className="text-xs opacity-70">Your Supabase project may be paused. Go to supabase.com → restore it, then refresh.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-surface-container-low rounded-2xl p-1 mb-5 gap-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setAnchor(new Date()); setSearchQuery(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.key
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Period navigator */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          onClick={() => shiftPeriod(-1)}
          className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined text-on-surface">chevron_left</span>
        </button>
        <div className="text-center">
          <p className="font-headline font-black text-lg text-on-surface">{label}</p>
          {isPresent && (
            <p className="text-[10px] text-primary font-black uppercase tracking-widest">Current</p>
          )}
        </div>
        <button
          onClick={() => shiftPeriod(1)}
          disabled={isPresent}
          className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-on-surface">chevron_right</span>
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-primary-container rounded-2xl p-4 text-center">
          <p className="font-headline text-2xl font-black text-on-primary-container">{summary.count}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-primary-container/70">Bills</p>
        </div>
        <div className="bg-tertiary-fixed-dim rounded-2xl p-4 text-center overflow-hidden">
          <p className="font-headline text-lg font-black text-on-tertiary-fixed leading-tight">₹{summary.sales.toLocaleString()}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-tertiary-fixed/70 mt-0.5">Sales</p>
        </div>
        <div className="bg-secondary-fixed rounded-2xl p-4 text-center overflow-hidden">
          <p className="font-headline text-lg font-black text-on-secondary-fixed leading-tight">₹{summary.profit.toLocaleString()}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-secondary-fixed/70 mt-0.5">Profit</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 mb-5 focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm">
        <span className="material-symbols-outlined text-outline">search</span>
        <input
          type="text"
          placeholder="Search customer or bill #..."
          className="bg-transparent border-none outline-none w-full font-bold text-on-surface placeholder:text-outline/50 focus:ring-0 p-0"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      {/* Bill list */}
      {periodBills.length === 0 ? (
        <div className="p-12 text-center bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30 mt-2">
          <span className="material-symbols-outlined text-6xl text-outline-variant block mb-3">receipt_long</span>
          <p className="text-on-surface-variant font-bold uppercase tracking-widest text-xs">
            {searchQuery ? 'No matching bills' : 'No bills for this period'}
          </p>
        </div>
      ) : activeTab === 'daily' ? (
        <BillList bills={periodBills} t={t} onSelect={setSelectedBill} showTime />
      ) : (
        <div className="space-y-6">
          {groupedByDay.map(([dayKey, dayBills]) => {
            const day = new Date(dayKey);
            const dayTotal = dayBills.reduce((s, b) => s + (Number(b.total) || 0), 0);
            const isToday = startOfDay(new Date()).toISOString() === dayKey;
            return (
              <div key={dayKey}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
                    {isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-on-surface-variant">{dayBills.length} bills</span>
                    <span className="text-xs font-black text-primary">₹{dayTotal.toLocaleString()}</span>
                  </div>
                </div>
                <BillList bills={dayBills} t={t} onSelect={setSelectedBill} showTime />
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedBill && (
        <BillDetailModal
          bill={selectedBill}
          shopData={shopData}
          onClose={() => setSelectedBill(null)}
        />
      )}
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BillList({ bills, t, onSelect, showTime }) {
  return (
    <div className="space-y-3">
      {bills.map(bill => (
        <div
          key={bill.id}
          onClick={() => onSelect(bill)}
          className="bg-surface-container-lowest p-5 rounded-2xl border-l-4 border-primary shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div className="space-y-1 min-w-0 flex-1 pr-3">
              <p className="text-base font-bold text-on-surface truncate">{bill.customerName || (t ? t('guest') : 'Guest')}</p>
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                #{bill.billNumber}
                {showTime && bill.date
                  ? ` • ${new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : bill.date
                    ? ` • ${new Date(bill.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}`
                    : ''}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-headline font-black text-xl text-primary">₹{Math.round(bill.total).toLocaleString()}</p>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight ${
                bill.isUdhar ? 'bg-error-container text-error' : 'bg-primary-container text-primary'
              }`}>
                {bill.isUdhar ? (t ? t('udhar') : 'Credit') : (t ? t('paid') : 'Paid')}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BillDetailModal({ bill, shopData, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-sm rounded-[2rem] max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center z-10 active:scale-90 hover:bg-gray-200 transition-colors"
        >
          <span className="material-symbols-outlined text-gray-700">close</span>
        </button>

        <div className="p-8 text-black bg-white font-sans leading-tight">
          {/* Shop header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-black uppercase mb-1 leading-tight">{shopData.name}</h2>
              {shopData.address && <p className="text-[10px] font-bold opacity-60 mb-1">{shopData.address}</p>}
              {shopData.phone && <p className="text-[10px] font-black uppercase">Ph: {shopData.phone}</p>}
              {shopData.gstNumber && <p className="text-[10px] font-black uppercase mt-1">GST: {shopData.gstNumber}</p>}
            </div>
            {shopData.logo && (
              <img src={shopData.logo} alt="Logo" className="w-14 h-14 object-contain grayscale flex-shrink-0" />
            )}
          </div>

          <div className="border-t-2 border-black my-4"></div>

          {/* Bill meta */}
          <div className="flex justify-between text-[11px] font-bold uppercase mb-4 gap-2">
            <div className="space-y-0.5">
              <p>Bill No: #{bill.billNumber}</p>
              <p>Date: {new Date(bill.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <p>Time: {new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="text-right space-y-0.5">
              <p>Customer: {bill.customerName || 'Guest'}</p>
              {bill.customerPhone && <p>Phone: {bill.customerPhone}</p>}
              <p className={bill.isUdhar ? 'text-red-600 font-black' : 'text-green-700 font-black'}>
                {bill.isUdhar ? 'Credit / Udhar' : (bill.paymentMode ? bill.paymentMode.charAt(0).toUpperCase() + bill.paymentMode.slice(1) : 'Cash')}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-300 my-3"></div>

          {/* Items table */}
          <table className="w-full text-left text-[11px] mb-5">
            <thead>
              <tr className="border-b-2 border-black font-black uppercase">
                <th className="pb-2">Item</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {(bill.items || []).map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 font-semibold">{item.name}</td>
                  <td className="py-1.5 text-center text-[10px]">
                    {item.billingQty || item.quantity || 1}
                    {item.billingUnit || item.unit ? ` ${item.billingUnit || item.unit}` : ''}
                  </td>
                  <td className="py-1.5 text-right font-bold">₹{Number(item.price || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t border-black pt-3 space-y-1">
            {bill.subtotal > 0 && bill.gst > 0 && (
              <div className="flex justify-between text-[11px] font-bold text-gray-600">
                <span>Subtotal</span>
                <span>₹{(bill.subtotal || 0).toLocaleString()}</span>
              </div>
            )}
            {(bill.cgst > 0 || bill.sgst > 0) ? (
              <>
                <div className="flex justify-between text-[11px] font-bold text-gray-600">
                  <span>CGST {bill.gstRate ? `(${bill.gstRate / 2}%)` : ''}</span>
                  <span>₹{(bill.cgst || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-gray-600">
                  <span>SGST {bill.gstRate ? `(${bill.gstRate / 2}%)` : ''}</span>
                  <span>₹{(bill.sgst || 0).toLocaleString()}</span>
                </div>
              </>
            ) : bill.gst > 0 ? (
              <div className="flex justify-between text-[11px] font-bold text-gray-600">
                <span>GST {bill.gstRate ? `(${bill.gstRate}%)` : ''}</span>
                <span>₹{(bill.gst || 0).toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-lg font-black pt-2 border-t border-gray-300">
              <span>TOTAL</span>
              <span>₹{(bill.total || 0).toLocaleString()}</span>
            </div>
            {bill.profit > 0 && (
              <div className="flex justify-between text-[10px] font-bold text-green-700">
                <span>Profit on this bill</span>
                <span>₹{(bill.profit || 0).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-200 text-center">
            <p className="text-[12px] font-black italic text-gray-700">Thank you! Visit Again 🙏</p>
            <p className="text-[9px] mt-2 opacity-40 uppercase tracking-widest font-bold">Powered by ShopSaathi</p>
          </div>
        </div>
      </div>
    </div>
  );
}
