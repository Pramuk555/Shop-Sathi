import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import * as dbService from '../services/db';

export default function UdharPage() {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  
  // --- Data & State Management ---
  const [udhars, setUdhars] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const saved = localStorage.getItem('udharList');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState('receive'); // 'receive' or 'pay'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'partial', 'paid'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUdhar, setEditingUdhar] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(null); // stores udhar object
  const [paymentAmount, setPaymentAmount] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Persist data to Firestore/LocalStorage
  useEffect(() => {
    if (!currentUser || currentUser.demo) {
      return;
    }

    const unsub = dbService.subscribeUdhar(currentUser.uid, (data) => {
      if (!data) return;
      setUdhars(data);
    });

    return () => unsub();
  }, [currentUser]);

  // Demo-only persistence
  useEffect(() => {
    if (currentUser?.demo || !currentUser) {
      localStorage.setItem('udharList', JSON.stringify(udhars));
    }
  }, [udhars, currentUser]);

  // --- Calculations ---
  const totals = useMemo(() => {
    const receive = udhars
      .filter(u => u.type === 'receive')
      .reduce((sum, u) => sum + (Number(u.remainingAmount) || 0), 0);
    const pay = udhars
      .filter(u => u.type === 'pay')
      .reduce((sum, u) => sum + (Number(u.remainingAmount) || 0), 0);
    return { receive, pay, net: receive - pay };
  }, [udhars]);

  const filteredUdhars = useMemo(() => {
    return udhars
      .filter(u => u.type === activeTab)
      .filter(u => (u.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()))
      .filter(u => filterStatus === 'all' || u.status === filterStatus)
      .sort((a, b) => {
        // Paid items go to bottom
        if (a.status === 'paid' && b.status !== 'paid') return 1;
        if (a.status !== 'paid' && b.status === 'paid') return -1;
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
      });
  }, [udhars, activeTab, searchQuery, filterStatus]);

  // --- Handlers ---
  const handleOpenAddModal = (udhar = null) => {
    setEditingUdhar(udhar);
    setIsAddModalOpen(true);
  };

  const handleSaveUdhar = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const amount = Number(formData.get('amount'));
    const type = formData.get('type');
    const name = formData.get('name');
    const phone = formData.get('phone');
    const description = formData.get('description');
    const dueDate = formData.get('dueDate') || '';

    const newUdharData = editingUdhar ? {
      name, phone, amount,
      remainingAmount: amount - (editingUdhar.paidAmount || 0),
      description, dueDate, type,
      status: (amount - (editingUdhar.paidAmount || 0)) <= 0 ? 'paid' : ((editingUdhar.paidAmount || 0) > 0 ? 'partial' : 'pending')
    } : {
      type, name, phone, amount,
      paidAmount: 0,
      remainingAmount: amount,
      description, dueDate,
      date: new Date().toLocaleDateString('en-GB'),
      status: 'pending',
      payments: []
    };

    if (currentUser && !currentUser.demo) {
      if (editingUdhar) {
        dbService.updateUdhar(currentUser.uid, editingUdhar.id, newUdharData);
      } else {
        dbService.addUdhar(currentUser.uid, newUdharData);
      }
    } else {
      // Demo Mode
      if (editingUdhar) {
        setUdhars(prev => prev.map(u => u.id === editingUdhar.id ? { ...u, ...newUdharData } : u));
      } else {
        setUdhars([{ ...newUdharData, id: Date.now() }, ...udhars]);
      }
    }
    
    setIsAddModalOpen(false);
    setEditingUdhar(null);
  };

  const handleMarkPaid = (id) => {
    const udhar = udhars.find(u => u.id === id);
    if (!udhar) return;

    const update = {
      paidAmount: udhar.amount,
      remainingAmount: 0,
      status: 'paid',
      payments: [...udhar.payments, { amount: udhar.remainingAmount, date: new Date().toLocaleDateString('en-GB'), note: 'Full Payment' }]
    };

    if (currentUser && !currentUser.demo) {
      dbService.updateUdhar(currentUser.uid, id, update);
    } else {
      setUdhars(prev => prev.map(u => u.id === id ? { ...u, ...update } : u));
    }
  };

  const handlePartialPayment = (e) => {
    e.preventDefault();
    if (!isPaymentModalOpen || !paymentAmount) return;
    
    const amount = Number(paymentAmount);
    const u = isPaymentModalOpen;
    const newPaid = u.paidAmount + amount;
    const newRemaining = u.amount - newPaid;
    
    const update = {
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      status: newRemaining <= 0 ? 'paid' : 'partial',
      payments: [...u.payments, { amount, date: new Date().toLocaleDateString('en-GB'), note: 'Partial Payment' }]
    };

    if (currentUser && !currentUser.demo) {
      dbService.updateUdhar(currentUser.uid, u.id, update);
    } else {
      setUdhars(prev => prev.map(item => item.id === u.id ? { ...item, ...update } : item));
    }

    setIsPaymentModalOpen(null);
    setPaymentAmount('');
  };

  const handleDelete = (id) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (currentUser && !currentUser.demo) {
      dbService.deleteUdhar(currentUser.uid, deleteConfirmId);
    } else {
      setUdhars(prev => prev.filter(u => u.id !== deleteConfirmId));
    }
    setDeleteConfirmId(null);
  };

  const sendReminder = (u) => {
    if (!u.phone) return;
    const shopName = localStorage.getItem('shopName') || 'ShopSaathi';
    let message = `Namaste ${u.name} ji! 🙏\nThis is a gentle reminder from ${shopName}.`;
    if (u.paidAmount > 0 && u.status === 'partial') {
      message += `\nYou have paid *₹${u.paidAmount.toLocaleString()}* out of *₹${u.amount.toLocaleString()}*.`;
      message += `\nYour remaining pending amount is *₹${u.remainingAmount.toLocaleString()}*`;
    } else {
      message += `\nYou have a pending amount of *₹${u.remainingAmount.toLocaleString()}*`;
    }
    message += `\nsince ${u.date}.\nPlease pay when convenient.\nThank you! 🙏`;
    window.open(`https://wa.me/91${u.phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const getDaysAgo = (dateStr) => {
    if (!dateStr) return '';
    let date;
    if (dateStr.includes('T') || (dateStr.includes('-') && !dateStr.includes('/'))) {
      date = new Date(dateStr);
    } else {
      const [day, month, year] = dateStr.split('/').map(Number);
      date = new Date(year, month - 1, day);
    }
    if (isNaN(date.getTime())) return '';
    const diff = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    return diff === 0 ? 'Today' : `${diff} days ago`;
  };

  const getInitials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const colors = ['bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-purple-100 text-purple-600', 'bg-orange-100 text-orange-600', 'bg-pink-100 text-pink-600'];

  return (
    <main className="px-6 pt-6 max-w-md mx-auto pb-40 page-transition-enter">
      {/* Page Title */}
      <header className="mb-6 flex justify-between items-center">
        <h1 className="font-headline font-extrabold text-3xl tracking-tight text-on-surface">{t('udhar')}</h1>
      </header>

      {/* Hero Summary Card */}
      <section className={`mb-8 p-6 rounded-2xl shadow-sm relative overflow-hidden transition-all ${totals.net >= 0 ? 'bg-primary-fixed' : 'bg-error-container text-on-error-container'}`}>
        <div className="relative z-10 grid grid-cols-2 gap-4">
          <div>
            <div className="space-y-1">
              <p className="text-on-primary-fixed-variant font-medium opacity-80">{t('to_receive')}</p>
              <p className="text-3xl font-headline text-on-primary-fixed">₹{totals.receive.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right border-l border-black/10 pl-4">
            <div className="space-y-1 text-right">
              <p className="text-on-primary-fixed-variant font-medium opacity-80">{t('to_pay')}</p>
              <p className="text-3xl font-headline text-secondary">₹{totals.pay.toLocaleString()}</p>
            </div>
          </div>
          <div className="col-span-2 pt-4 border-t border-black/10 flex items-center justify-between">
            <p className="font-bold text-lg">
              {totals.net >= 0 ? t('net_profit') + ' ✅' : t('net_loss') + ' ⚠️'}
            </p>
            <p className={`font-headline font-black text-3xl ${totals.net >= 0 ? 'text-primary' : 'text-error'}`}>
              {totals.net >= 0 ? t('ahead') : t('owe')}
            </p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-surface-container-low p-1.5 rounded-2xl">
        <button 
          onClick={() => setActiveTab('receive')}
          className={`flex-1 py-4 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'receive' ? 'bg-primary text-white shadow-lg scale-[1.02]' : 'bg-surface-container text-on-surface-variant opacity-60'}`}
        >
          {t('to_receive')}
        </button>
        <button 
          onClick={() => setActiveTab('pay')}
          className={`flex-1 py-4 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'pay' ? 'bg-secondary text-white shadow-lg scale-[1.02]' : 'bg-surface-container text-on-surface-variant opacity-60'}`}
        >
          {t('to_pay')}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-2xl px-4 flex items-center gap-3 shadow-sm focus-within:ring-2 ring-primary transition-all">
          <span className="material-symbols-outlined text-on-surface-variant">search</span>
          <input 
            className="w-full h-14 bg-transparent border-none outline-none text-lg font-medium text-on-surface placeholder:text-outline/60 focus:ring-0" 
            placeholder={t('search_customers') || 'Search customers...'} 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select 
          className="bg-surface-container-lowest border border-outline-variant rounded-xl px-2 font-bold text-sm text-primary outline-none shadow-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Customer List */}
      <div className="space-y-4 pb-24">
        {filteredUdhars.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
            <span className="text-6xl">🎉</span>
            <p className="font-bold text-lg">No udhar entries yet.<br/>Everyone is settled up!</p>
          </div>
        ) : (
          filteredUdhars.map((u, i) => (
            <div key={u.id} className={`bg-surface-container-lowest p-5 rounded-2xl ghost-border relative transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${u.status === 'paid' ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${colors[i % colors.length]}`}>
                  {getInitials(u.name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-headline font-bold text-lg text-on-surface">{u.name}</h3>
                    <p className={`font-headline font-black text-xl ${activeTab === 'receive' ? 'text-primary' : 'text-error'}`}>₹{u.remainingAmount.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant mb-2">
                    {u.phone && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">call</span>{u.phone}</span>}
                    <span className="opacity-40">•</span>
                    <span>{getDaysAgo(u.date)}</span>
                  </div>
                  <p className="text-sm font-medium text-on-surface-variant/80 border-l-2 border-primary/20 pl-3 leading-relaxed">{u.description}</p>
                </div>
              </div>

              {/* Badges & Info */}
              <div className="flex items-center gap-2 mb-5">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                  u.status === 'paid' ? 'bg-green-100 text-green-700' : 
                  u.status === 'partial' ? 'bg-amber-100 text-amber-700' : 
                  'bg-error-container text-error'
                }`}>
                  {t(u.status) || u.status}
                </span>
                {u.dueDate && (
                  <span className="px-3 py-1 bg-surface-container-high rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                    {t('due')}: {u.dueDate}
                  </span>
                )}
                {u.paidAmount > 0 && u.status !== 'paid' && (
                  <span className="ml-auto text-[11px] font-bold text-on-surface-variant">
                    Paid: ₹{u.paidAmount.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-outline-variant/30">
                {u.status !== 'paid' && (
                  <>
                    <button 
                      onClick={() => handleMarkPaid(u.id)}
                      className="flex-1 h-12 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform"
                    >
                      <span className="material-symbols-outlined text-lg filled-icon">check_circle</span>
                      {t('full_pay')}
                    </button>
                    <button 
                      onClick={() => setIsPaymentModalOpen(u)}
                      className="flex-1 h-12 bg-primary-container text-on-primary-container rounded-xl font-bold flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform"
                    >
                      <span className="material-symbols-outlined text-lg">add_card</span>
                      {t('payment')}
                    </button>
                  </>
                )}
                
                {activeTab === 'receive' && u.phone && u.status !== 'paid' && (
                  <button 
                    onClick={() => sendReminder(u)}
                    className="h-12 w-12 bg-secondary-container text-on-secondary-container rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined">message</span>
                  </button>
                )}

                <button 
                  onClick={() => handleOpenAddModal(u)}
                  className="h-12 w-12 bg-surface-container-high text-primary rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                
                <button 
                  onClick={() => handleDelete(u.id)}
                  className="h-12 w-12 bg-surface-container-high text-error rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB: Add Udhar */}
      <button 
        onClick={() => handleOpenAddModal()}
        className="fixed bottom-32 right-6 signature-gradient text-on-primary h-16 w-16 px-0 md:w-auto md:px-8 rounded-full shadow-2xl flex items-center justify-center gap-3 active:scale-90 transition-transform duration-150 z-40"
      >
        <span className="material-symbols-outlined text-3xl filled-icon">add_circle</span>
        <span className="hidden md:block font-headline font-bold text-lg tracking-wide whitespace-nowrap">{t('add_udhar')}</span>
      </button>

      {/* MODAL: Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="fixed inset-0 bg-black/60 modal-backdrop-fade" onClick={() => setDeleteConfirmId(null)}></div>
          <div className="relative bg-surface-container-lowest rounded-3xl w-full max-w-xs p-6 shadow-2xl modal-content-slide text-center">
            <span className="material-symbols-outlined text-error text-5xl mb-4">delete_forever</span>
            <h3 className="font-headline font-bold text-xl mb-2">Delete Udhar?</h3>
            <p className="text-sm text-on-surface-variant mb-6 font-medium">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 font-bold text-on-surface-variant bg-surface-container rounded-xl">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-error text-on-primary font-bold rounded-xl shadow-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add/Edit Udhar */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:p-0">
          <div className="fixed inset-0 transition-opacity bg-black/60 modal-backdrop-fade" onClick={() => { setIsAddModalOpen(false); setEditingUdhar(null); }}></div>
          <div className="relative bg-surface-container-lowest rounded-3xl w-full max-w-md p-6 shadow-2xl modal-content-slide">
            <h3 className="font-headline font-bold text-2xl mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">{editingUdhar ? 'edit_note' : 'person_add'}</span>
              {editingUdhar ? 'Edit Udhar Entry' : 'New Udhar Entry'}
            </h3>

            <form onSubmit={handleSaveUdhar} className="space-y-4">
              <div className="flex p-1 bg-surface-container-high rounded-xl mb-4">
                <label className="flex-1 grow">
                  <input type="radio" name="type" value="receive" defaultChecked={editingUdhar ? editingUdhar.type === 'receive' : true} className="hidden peer" />
                  <div className="text-center py-2.5 rounded-lg font-bold text-sm cursor-pointer transition-all peer-checked:bg-primary-fixed peer-checked:text-primary text-on-surface-variant/60">
                    🟢 Receive
                  </div>
                </label>
                <label className="flex-1 grow">
                  <input type="radio" name="type" value="pay" defaultChecked={editingUdhar ? editingUdhar.type === 'pay' : false} className="hidden peer" />
                  <div className="text-center py-2.5 rounded-lg font-bold text-sm cursor-pointer transition-all peer-checked:bg-error-container peer-checked:text-error text-on-surface-variant/60">
                    🔴 Pay
                  </div>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant pl-1">NAME*</label>
                <input required name="name" type="text" defaultValue={editingUdhar?.name || ''} placeholder="e.g. Ramesh Bhai" className="w-full bg-surface-container p-4 rounded-xl font-bold outline-none border-2 border-transparent focus:border-primary/20" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant pl-1">AMOUNT (₹)*</label>
                  <input required name="amount" type="number" defaultValue={editingUdhar?.amount || ''} placeholder="0" className="w-full bg-surface-container p-4 rounded-xl font-bold outline-none border-2 border-transparent focus:border-primary/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant pl-1">PHONE</label>
                  <input name="phone" type="tel" maxLength="10" defaultValue={editingUdhar?.phone || ''} placeholder="987..." className="w-full bg-surface-container p-4 rounded-xl font-bold outline-none border-2 border-transparent focus:border-primary/20" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant pl-1">DESCRIPTION</label>
                <input name="description" type="text" defaultValue={editingUdhar?.description || ''} placeholder="e.g. 5kg Basmati Rice" className="w-full bg-surface-container p-4 rounded-xl font-bold outline-none border-2 border-transparent focus:border-primary/20" />
              </div>

              <div className="space-y-1 pb-4">
                <label className="text-xs font-bold text-on-surface-variant pl-1">DUE DATE {editingUdhar?.dueDate && <span className="opacity-40">(Current: {editingUdhar.dueDate})</span>}</label>
                <input name="dueDate" type="date" defaultValue={editingUdhar?.dueDate ? new Date(editingUdhar.dueDate.split('/').reverse().join('-')).toISOString().split('T')[0] : ''} className="w-full bg-surface-container p-4 rounded-xl font-bold outline-none border-2 border-transparent focus:border-primary/20" />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingUdhar(null); }} className="flex-1 py-4 font-bold text-on-surface-variant bg-surface-container rounded-xl">Cancel</button>
                <button type="submit" className="flex-[2] py-4 signature-gradient text-on-primary font-bold rounded-xl shadow-lg">{editingUdhar ? 'Apply Changes' : 'Save Udhar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Partial Payment */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="fixed inset-0 bg-black/60" onClick={() => setIsPaymentModalOpen(null)}></div>
          <div className="relative bg-surface-container-lowest rounded-3xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-headline font-bold text-xl mb-4 text-center">Add Payment</h3>
            <p className="text-center text-sm text-on-surface-variant mb-6 font-medium">
              Collecting payment from <span className="font-bold text-primary">{isPaymentModalOpen.name}</span>
            </p>
            
            <form onSubmit={handlePartialPayment} className="space-y-6">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-2xl text-on-surface-variant/40">₹</span>
                <input 
                  autoFocus
                  type="number" 
                  max={isPaymentModalOpen.remainingAmount}
                  placeholder="Enter amount"
                  className="w-full bg-surface-container-high py-6 pl-10 pr-6 rounded-2xl font-black text-3xl text-center outline-none border-4 border-transparent focus:border-primary/20"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                <p className="text-right text-[10px] font-black text-primary mt-2 uppercase tracking-widest">
                  Remaining: ₹{isPaymentModalOpen.remainingAmount}
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setIsPaymentModalOpen(null)} className="flex-1 py-3 font-bold text-on-surface-variant bg-surface-container rounded-lg">Exit</button>
                <button type="submit" className="flex-[2] py-3 signature-gradient text-on-primary font-bold rounded-lg shadow-lg">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
