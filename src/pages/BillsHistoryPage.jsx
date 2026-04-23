import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import * as dbService from '../services/db';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  const [dbError, setDbError] = useState(false);
  const [shopData, setShopData] = useState(() => {
    const defaultData = {
      name: 'ShopSaathi Store',
      address: '',
      phone: '',
      logo: ''
    };
    if (!currentUser || currentUser.demo) {
      return {
        name: localStorage.getItem('shopName') || defaultData.name,
        address: localStorage.getItem('shopAddress') || defaultData.address,
        phone: localStorage.getItem('shopPhone') || defaultData.phone,
        logo: localStorage.getItem('shopLogo') || defaultData.logo
      };
    }
    return defaultData;
  });

  useEffect(() => {
    if (!currentUser || currentUser.demo) {
      return;
    }

    const unsubBills = dbService.subscribeBills(currentUser.uid, setBills, () => setDbError(true));
    const unsubProfile = dbService.getShopProfile(currentUser.uid, (data) => {
      if (data) setShopData(data);
    });

    return () => {
      unsubBills();
      unsubProfile();
    };
  }, [currentUser]);

  const filteredBills = bills.filter(bill => 
    (bill.customerName || 'Guest').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (bill.billNumber || '').toString().includes(searchQuery)
  );

  return (
    <main className="max-w-[450px] mx-auto px-6 pt-8 pb-32 min-h-screen bg-surface page-transition-enter">
      {dbError && (
        <div className="bg-error-container text-on-error-container rounded-2xl p-4 flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-error text-2xl">cloud_off</span>
          <div>
            <p className="font-bold text-sm">Database unreachable</p>
            <p className="text-xs opacity-70">Your Supabase project may be paused. Go to supabase.com → restore it, then refresh.</p>
          </div>
        </div>
      )}
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-95">
          <span className="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <h1 className="font-headline font-extrabold text-3xl tracking-tight text-on-surface">{t('history')}</h1>
      </header>

      {/* Search */}
      <div className="bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 mb-8 focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm">
        <span className="material-symbols-outlined text-outline">search</span>
        <input 
          type="text" 
          placeholder={t('search_stock_history') || t('history') + '...'}
          className="bg-transparent border-none outline-none w-full font-bold text-on-surface placeholder:text-outline/50 focus:ring-0 p-0"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Bill List */}
      <div className="space-y-4">
        {filteredBills.length === 0 ? (
          <div className="p-12 text-center bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30">
            <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">receipt_long</span>
            <p className="text-on-surface-variant font-bold uppercase tracking-widest text-xs">{t('no_items')}</p>
          </div>
        ) : (
          filteredBills.map(bill => (
            <div 
              key={bill.id} 
              onClick={() => setSelectedBill(bill)}
              className="bg-surface-container-lowest p-5 rounded-2xl border-l-4 border-primary shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <p className="text-lg font-bold text-on-surface">{bill.customerName || t('guest')}</p>
                    <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                      #{bill.billNumber} • {bill.date ? new Date(bill.date).toLocaleDateString() : ''}
                    </p>
                </div>
                <div className="text-right">
                  <p className="font-headline font-black text-xl text-primary">₹{Math.round(bill.total).toLocaleString()}</p>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${bill.isUdhar ? 'bg-error-container text-error' : 'bg-primary-container text-primary'}`}>
                    {bill.isUdhar ? t('udhar') : t('paid')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2rem] max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300 relative">
            {/* Close Button */}
            <button 
              onClick={() => setSelectedBill(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-surface-container-high rounded-full flex items-center justify-center z-10 active:scale-90"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* A4 Format Content Re-implementation */}
            <div className="p-8 text-black bg-white min-h-64 font-sans leading-tight">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-black uppercase mb-1 leading-tight">{shopData.name}</h2>
                  <p className="text-[10px] font-bold opacity-70 mb-1">{shopData.address}</p>
                  <p className="text-[10px] font-black uppercase">PHONE: {shopData.phone}</p>
                  {shopData.gstNumber && <p className="text-[10px] font-black uppercase mt-1">GST: {shopData.gstNumber}</p>}
                </div>
                {shopData.logo && (
                  <img src={shopData.logo} alt="Logo" className="w-16 h-16 object-contain grayscale" />
                )}
              </div>

              <div className="border-t border-black my-4"></div>

              {/* Bill Meta */}
              <div className="flex justify-between text-[11px] font-bold uppercase mb-4">
                <div>
                  <p>BILL NO: #{selectedBill.billNumber}</p>
                  <p>DATE: {new Date(selectedBill.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p>CUSTOMER: {selectedBill.customerName || 'GUEST'}</p>
                  <p>{selectedBill.isUdhar ? 'MODE: CREDIT' : 'MODE: CASH'}</p>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-[11px] mb-6">
                <thead>
                  <tr className="border-b-2 border-black font-black uppercase">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBill.items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 font-bold uppercase">{item.name}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">₹{Number(item.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="space-y-1 text-right border-t border-black pt-4">
                <div className="flex justify-between text-[11px] font-bold">
                  <span>SUBTOTAL:</span>
                  <span>₹{selectedBill.subtotal?.toLocaleString()}</span>
                </div>
                {selectedBill.gst > 0 && (
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>GST (18%):</span>
                    <span>₹{selectedBill.gst?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-black pt-2 border-t border-gray-100">
                  <span>TOTAL:</span>
                  <span>₹{selectedBill.total?.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-200 text-center">
                <p className="text-[12px] font-black italic">{t('visit_again')}</p>
                <p className="text-[9px] mt-2 opacity-50 uppercase tracking-widest font-bold">Generated via ShopSaathi PWA</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
