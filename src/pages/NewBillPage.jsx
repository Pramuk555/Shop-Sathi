import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import * as dbService from '../services/db';

export default function NewBillPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { currentUser } = useAuth();
  const [billLanguage, setBillLanguage] = useState(language);
  const [isBillLangModalOpen, setIsBillLangModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // item being edited in modal
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCustomPrice, setEditCustomPrice] = useState('');
  const [editUseCustom, setEditUseCustom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGstEnabled, setIsGstEnabled] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const gstSaved = localStorage.getItem('gstEnabled');
      return gstSaved ? JSON.parse(gstSaved) : false;
    }
    return false;
  });
  const [isListening, setIsListening] = useState(false);
  const [items, setItems] = useState([]);
  
  const [allProducts, setAllProducts] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const productsSaved = localStorage.getItem('products');
      return productsSaved ? JSON.parse(productsSaved) : [];
    }
    return [];
  });
  const [allCategories, setAllCategories] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const categoriesSaved = localStorage.getItem('categories');
      return categoriesSaved ? JSON.parse(categoriesSaved) : [];
    }
    return [];
  });

  // Load Data
  useEffect(() => {
    if (!currentUser || currentUser.demo) {
      return;
    }

    // REAL SUPABASE MODE
    const unsubProds = dbService.subscribeInventory(currentUser.uid, (data) => {
      setAllProducts(data);
    });

    const unsubCats = dbService.subscribeCategories(currentUser.uid, (data) => {
      setAllCategories(data);
    });

    const unsubProfile = dbService.getShopProfile(currentUser.uid, (data) => {
      if (data && data.gstEnabled !== undefined) {
        setIsGstEnabled(data.gstEnabled);
      }
    });

    return () => {
      unsubProds();
      unsubCats();
      unsubProfile();
    };
  }, [currentUser]);

  // Robust Search Logic
  const searchResults = useMemo(() => {
    if (!allProducts) return [];
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.trim().toLowerCase();
      return allProducts.filter(p => 
        (p.name && String(p.name).toLowerCase().includes(query)) || 
        (p.scientificName && String(p.scientificName).toLowerCase().includes(query))
      ).map(p => {
        const cat = allCategories?.find(c => c.id === p.categoryId);
        return { ...p, categoryName: cat ? cat.name : (t('items') || 'Item') };
      }).slice(0, 5);
    }
    return [];
  }, [searchQuery, allProducts, allCategories, t]);

  // Voice Search (Web Speech API)
  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice Search is not supported in this browser.");
      return;
    }

    setIsListening(true);
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // English (India)
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      console.log('Voice recognition started (NewBill)');
      setIsListening(true);
    };

    recognition.onend = () => {
      console.log('Voice recognition ended (NewBill)');
      setIsListening(false);
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.replace(/[.?!,;:]/g, "").trim();
      console.log('Transcript received (NewBill):', transcript);
      setSearchQuery(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Voice recognition error (NewBill):', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('Microphone access is blocked. Please enable it in browser settings.');
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition (NewBill):', e);
      setIsListening(false);
    }
  };

  // Unit helpers
  const getSubUnit = (unit) => ({ kg: 'g', ltr: 'ml' }[unit] || null);
  const isSubUnit = (unit) => unit === 'g' || unit === 'ml';
  const calcItemPrice = (sellingPrice, qty, unit) =>
    Math.ceil((Number(sellingPrice) || 0) * qty / (isSubUnit(unit) ? 1000 : 1));

  const addItem = (product) => {
    if (!product) return;
    const existing = items.find(i => i.id === product.id);
    if (existing) {
      const newQty = existing.billingQty + (isSubUnit(existing.billingUnit) ? 50 : 1);
      updateBillingQty(product.id, newQty);
    } else {
      const billingUnit = product.unit || 'pcs';
      const billingQty = isSubUnit(billingUnit) ? 100 : 1;
      setItems([...items, {
        ...product,
        name: product.name || 'Unknown',
        billingUnit,
        billingQty,
        quantity: 1,
        price: Math.ceil(Number(product.sellingPrice) || 0),
      }]);
    }
    setSearchQuery('');
  };

  const updateBillingQty = (id, newQty) => {
    const qty = Math.max(0, Number(newQty) || 0);
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const stockDed = isSubUnit(item.billingUnit) ? qty / 1000 : qty;
      if (qty > 0 && stockDed > Number(item.stock)) {
        const avail = isSubUnit(item.billingUnit)
          ? `${Number(item.stock) * 1000}${item.billingUnit}`
          : `${item.stock} ${item.billingUnit}`;
        alert(`Only ${avail} in stock!`);
        return item;
      }
      return { ...item, billingQty: qty, price: calcItemPrice(item.sellingPrice, qty, item.billingUnit), quantity: 1 };
    }));
  };

  const updateBillingUnit = (id, newUnit) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const defaultQty = isSubUnit(newUnit) ? 100 : 1;
      return {
        ...item,
        billingUnit: newUnit,
        billingQty: defaultQty,
        price: calcItemPrice(item.sellingPrice, defaultQty, newUnit),
        quantity: 1,
      };
    }));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Edit modal helpers
  const openEdit = (item) => {
    setEditingItem(item);
    setEditUnit(item.billingUnit);
    setEditQty(String(item.billingQty));
    setEditCustomPrice(String(item.price));
    setEditUseCustom(false);
  };

  const closeEdit = () => setEditingItem(null);

  const applyEdit = () => {
    if (!editingItem) return;
    const qty = Math.max(0, Number(editQty) || 0);
    if (qty <= 0) { closeEdit(); return; }
    const unit = editUnit;
    const autoPrice = calcItemPrice(editingItem.sellingPrice, qty, unit);
    const finalPrice = editUseCustom ? (Math.max(0, Number(editCustomPrice) || 0)) : autoPrice;
    setItems(prev => prev.map(item => {
      if (item.id !== editingItem.id) return item;
      const stockDed = isSubUnit(unit) ? qty / 1000 : qty;
      if (stockDed > Number(item.stock)) {
        alert(`Only ${isSubUnit(unit) ? Number(item.stock)*1000+unit : item.stock+' '+item.unit} in stock!`);
        return item;
      }
      return { ...item, billingUnit: unit, billingQty: qty, price: finalPrice, quantity: 1 };
    }));
    closeEdit();
  };

  // Rate label for an item (always based on the kg/ltr base unit)
  const getRateLabel = (item) => {
    if (item.unit === 'kg' || item.unit === 'g') return `₹${item.sellingPrice}/kg`;
    if (item.unit === 'ltr' || item.unit === 'ml') return `₹${item.sellingPrice}/ltr`;
    return `₹${item.sellingPrice}/${item.unit || 'pc'}`;
  };

  // Quick preset quantities for the edit modal
  const getPresets = (unit) => {
    if (unit === 'g') return [100, 250, 500, 1000];
    if (unit === 'ml') return [100, 250, 500, 1000];
    if (unit === 'kg') return [0.25, 0.5, 1, 2];
    if (unit === 'ltr') return [0.25, 0.5, 1, 2];
    return [1, 2, 5, 10];
  };

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const gst = isGstEnabled ? Math.ceil(subtotal * 0.18) : 0;
  const total = subtotal + gst;

  const handleBillConfirmation = () => {
    if (items.length === 0) {
      alert("Please add items to the bill first.");
      return;
    }
    navigate('/bill-confirm', { 
      state: { 
        items, 
        subtotal, 
        gst, 
        total,
        gstEnabled: isGstEnabled,
        billLanguage // Pass the chosen billing language
      } 
    });
  };

  return (
    <main className="max-w-[390px] mx-auto px-4 pt-4 pb-40 space-y-4 animate-in slide-in-from-right-4 duration-300">
      {/* Top App Bar */}
      <header className="flex items-center justify-between py-1">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-surface-container-high active:scale-95 transition-all">
          <span className="material-symbols-outlined text-2xl text-on-surface">arrow_back</span>
        </button>
        <h1 className="font-headline font-extrabold text-xl tracking-tight text-primary">New Bill</h1>
        {/* Billing language moved here */}
        <button
          onClick={() => setIsBillLangModalOpen(true)}
          className="p-2 rounded-full hover:bg-surface-container-high active:scale-95 transition-all flex items-center gap-1"
          title="Bill language"
        >
          <span className="material-symbols-outlined text-primary text-xl">language</span>
          <span className="text-[10px] font-black text-primary uppercase">
            {({'en':'EN','hi':'HI','kn':'KN','te':'TE','ta':'TA','ml':'ML','mr':'MR','gu':'GU'})[billLanguage]}
          </span>
        </button>
      </header>

      {/* Search Section */}
      <section className="space-y-3">
        <div className="relative group z-[60]">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-outline/60 text-xl">search</span>
          </div>
          <input
            className="w-full h-12 pl-12 pr-20 bg-surface-container-lowest border border-outline-variant/30 rounded-full text-base font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-outline/60 shadow-sm text-on-surface"
            placeholder={t('search_products')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            type="text" 
          />
          <div className="absolute inset-y-0 right-2 flex items-center gap-1">
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="w-10 h-10 rounded-full flex items-center justify-center text-outline-variant hover:bg-surface-container-low transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
            <button 
              onClick={startVoiceSearch}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-error text-white animate-mic-pulse' : 'bg-secondary-container text-secondary'}`}
            >
              <span className="material-symbols-outlined">{isListening ? 'mic' : 'mic_none'}</span>
            </button>
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-[105%] left-0 right-0 bg-surface border border-outline-variant rounded-xl shadow-2xl overflow-hidden z-[70] animate-in fade-in slide-in-from-top-2">
              {searchResults.map((p) => (
                <button 
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="w-full p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors border-b border-outline-variant last:border-0"
                >
                  <div className="text-left">
                    <p className="text-xs font-bold text-secondary uppercase tracking-tighter">📁 {p.categoryName}</p>
                    <p className="font-bold text-on-surface">{p.name}</p>
                    <p className="text-xs text-on-surface-variant italic">{p.scientificName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-primary">₹{p.sellingPrice}</p>
                    <p className={`text-[10px] font-bold ${Number(p.stock) < 10 ? 'text-error' : 'text-outline'}`}>{t('stock')}: {p.stock}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bill Items List */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 bg-primary rounded-full"></div>
          <h3 className="font-headline font-bold text-sm uppercase tracking-wider text-primary">{t('bill_items')} {items.length > 0 && `(${items.length})`}</h3>
        </div>

        {items.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-outline-variant space-y-2 bg-surface-container-lowest rounded-2xl border-2 border-dashed border-outline-variant">
            <span className="material-symbols-outlined text-4xl">receipt_long</span>
            <p className="font-bold text-sm">{t('no_items')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const subUnit = getSubUnit(item.unit);
              const inSub = isSubUnit(item.billingUnit);
              const stockLow = inSub ? Number(item.stock) * 1000 < 500 : Number(item.stock) < 5;
              const stockLabel = inSub ? `${Number(item.stock) * 1000}${item.billingUnit}` : `${item.stock} ${item.unit}`;
              return (
              <div key={item.id} className="bg-surface-container-low rounded-xl p-3 shadow-sm border border-outline-variant/30 animate-in slide-in-from-bottom-2">
                {/* Row 1: name + actions */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-bold text-base text-on-surface leading-tight truncate">{item.name}</h4>
                    <p className="text-[10px] text-on-surface-variant/70 font-semibold">{getRateLabel(item)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(item)} className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center text-secondary active:scale-90 transition-transform">
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button onClick={() => removeItem(item.id)} className="w-7 h-7 rounded-full bg-error/10 flex items-center justify-center text-error active:scale-90 transition-transform">
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>

                {/* Row 2: unit toggle (only for weight/liquid) */}
                {subUnit && (
                  <div className="flex gap-1.5 mb-2">
                    <button onClick={() => updateBillingUnit(item.id, item.unit)}
                      className={`flex-1 py-1 rounded-lg text-xs font-black transition-all ${!inSub ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}
                    >{item.unit}</button>
                    <button onClick={() => updateBillingUnit(item.id, subUnit)}
                      className={`flex-1 py-1 rounded-lg text-xs font-black transition-all ${inSub ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}
                    >{subUnit}</button>
                  </div>
                )}

                {/* Row 3: price + stepper */}
                <div className="flex items-center justify-between">
                  {/* Price — tappable to open edit */}
                  <button onClick={() => openEdit(item)} className="flex flex-col items-start">
                    <div className="flex items-center gap-0.5 bg-primary/10 px-3 py-1.5 rounded-xl">
                      <span className="text-primary font-black text-sm">₹</span>
                      <span className="font-black text-primary text-xl">{item.price}</span>
                    </div>
                    <span className="text-[9px] text-primary/50 font-bold ml-1 mt-0.5">
                      {inSub
                        ? `${item.billingQty}${item.billingUnit} of ${getRateLabel(item)}`
                        : `${item.billingQty} ${item.billingUnit}`}
                    </span>
                  </button>

                  {/* Quick stepper */}
                  <div className="flex items-center gap-1 bg-surface-container-highest rounded-full px-2 py-1">
                    <button
                      onClick={() => {
                        const step = inSub ? 50 : (item.billingUnit==='kg'||item.billingUnit==='ltr') ? 0.5 : 1;
                        updateBillingQty(item.id, Math.max(inSub?50:1, Math.round((item.billingQty - step)*100)/100));
                      }}
                      className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 font-bold text-lg leading-none"
                    >−</button>
                    <button
                      onClick={() => openEdit(item)}
                      className="font-black text-on-surface text-base w-10 text-center py-1"
                    >{item.billingQty}</button>
                    <button
                      onClick={() => {
                        const step = inSub ? 50 : (item.billingUnit==='kg'||item.billingUnit==='ltr') ? 0.5 : 1;
                        updateBillingQty(item.id, Math.round((item.billingQty + step)*100)/100);
                      }}
                      className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 font-bold text-lg leading-none"
                    >+</button>
                  </div>
                </div>

                {stockLow && (
                  <p className="text-[10px] text-error font-black mt-1">⚠️ Only {stockLabel} left!</p>
                )}
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bill Summary - Compact Footer */}
      <footer className="fixed-action-footer bg-surface/95 backdrop-blur-xl px-4 py-3 border-t border-outline-variant/40 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] rounded-t-2xl">
        {/* Totals row */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-on-surface-variant text-xs font-medium">
              <span>Sub ₹{subtotal.toLocaleString()}</span>
              {isGstEnabled && <span className="text-secondary">+ GST ₹{gst.toLocaleString()}</span>}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-headline text-xs uppercase tracking-tighter text-on-surface-variant">Total</span>
              <span className="font-headline text-2xl font-black text-primary">₹{total.toLocaleString()}</span>
            </div>
          </div>
          <button
            onClick={handleBillConfirmation}
            className="signature-gradient h-12 px-6 rounded-full flex items-center gap-2 text-white font-headline text-base font-black shadow-lg shadow-primary/30 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg filled-icon">check_circle</span>
            {t('checkout')}
          </button>
        </div>

        {/* Billing Language Modal */}
        {isBillLangModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsBillLangModalOpen(false)}></div>
            <div className="relative bg-surface w-full max-w-sm rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-300 ring-1 ring-white/10">
              <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-8"></div>
              <h3 className="font-headline text-2xl font-bold mb-6 text-on-surface tracking-tight text-center">{t('billing_language')}</h3>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {[
                  { id: 'en', name: 'English', sub: 'Default' },
                  { id: 'hi', name: 'हिन्दी', sub: 'Hindi' },
                  { id: 'kn', name: 'ಕನ್ನಡ', sub: 'Kannada' },
                  { id: 'te', name: 'తెలుగు', sub: 'Telugu' },
                  { id: 'ta', name: 'தமிழ்', sub: 'Tamil' },
                  { id: 'ml', name: 'മലയാളം', sub: 'Malayalam' },
                  { id: 'mr', name: 'मराठी', sub: 'Marathi' },
                  { id: 'gu', name: 'ગુજરાતી', sub: 'Gujarati' }
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => { setBillLanguage(lang.id); setIsBillLangModalOpen(false); }}
                    className={`w-full p-5 flex items-center justify-between rounded-2xl transition-all ${
                      billLanguage === lang.id
                        ? 'bg-primary-container text-on-primary-container ring-2 ring-primary'
                        : 'bg-surface-container hover:bg-surface-container-high'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-bold text-lg">{lang.name}</p>
                      <p className="text-xs opacity-60 uppercase tracking-widest font-black">{lang.sub}</p>
                    </div>
                    {billLanguage === lang.id && (
                      <span className="material-symbols-outlined text-primary">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsBillLangModalOpen(false)}
                className="w-full mt-4 h-12 bg-surface-container-highest rounded-xl font-headline font-bold text-on-surface-variant active:scale-95 transition-transform text-sm"
              >
                {t('save')}
              </button>
            </div>
          </div>
        )}
      </footer>
      {/* ── Edit Item Modal ── */}
      {editingItem && (() => {
        const subUnit = getSubUnit(editingItem.unit);
        const inSub = isSubUnit(editUnit);
        const autoPrice = calcItemPrice(editingItem.sellingPrice, Number(editQty) || 0, editUnit);
        const presets = getPresets(editUnit);
        return (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeEdit} />
            <div className="relative bg-surface w-full max-w-[450px] rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-full duration-300 p-5 space-y-4">
              {/* Handle */}
              <div className="w-10 h-1 bg-outline-variant/40 rounded-full mx-auto" />

              {/* Title */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-headline text-lg font-bold text-on-surface">{editingItem.name}</h3>
                  <p className="text-xs text-on-surface-variant">{getRateLabel(editingItem)} — tap a preset or type qty</p>
                </div>
                <button onClick={closeEdit} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Unit toggle */}
              {subUnit && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditUnit(editingItem.unit); setEditQty(isSubUnit(editUnit) ? String(Math.round(Number(editQty)/1000*100)/100) : editQty); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-black transition-all ${!inSub ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}
                  >{editingItem.unit}</button>
                  <button
                    onClick={() => { setEditUnit(subUnit); setEditQty(String(Math.round(Number(editQty)*1000))); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-black transition-all ${inSub ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}
                  >{subUnit}</button>
                </div>
              )}

              {/* Quantity input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Quantity</label>
                {/* Presets */}
                <div className="flex gap-2">
                  {presets.map(p => (
                    <button
                      key={p}
                      onClick={() => setEditQty(String(p))}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all border ${String(editQty) === String(p) ? 'bg-primary text-white border-primary' : 'bg-surface-container-high text-on-surface border-outline-variant/30'}`}
                    >{p}{editUnit}</button>
                  ))}
                </div>
                {/* Stepper input */}
                <div className="flex items-center gap-2 bg-surface-container-high rounded-2xl px-4 py-2">
                  <button
                    onClick={() => {
                      const step = inSub ? 50 : (editUnit==='kg'||editUnit==='ltr') ? 0.25 : 1;
                      setEditQty(String(Math.max(inSub?50:0.25, Math.round((Number(editQty)-step)*100)/100)));
                    }}
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm font-bold text-xl active:scale-90"
                  >−</button>
                  <input
                    type="number"
                    inputMode={inSub ? 'numeric' : 'decimal'}
                    className="flex-1 text-center font-black text-2xl text-on-surface bg-transparent border-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                  <span className="text-sm font-bold text-on-surface-variant w-8 text-center">{editUnit}</span>
                  <button
                    onClick={() => {
                      const step = inSub ? 50 : (editUnit==='kg'||editUnit==='ltr') ? 0.25 : 1;
                      setEditQty(String(Math.round((Number(editQty)+step)*100)/100));
                    }}
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm font-bold text-xl active:scale-90"
                  >+</button>
                </div>
              </div>

              {/* Price preview + custom override */}
              <div className="bg-surface-container-low rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-on-surface-variant font-medium">
                      {getRateLabel(editingItem)} × {editQty}{editUnit}
                    </p>
                    <p className="font-headline text-2xl font-black text-primary">₹{editUseCustom ? (Number(editCustomPrice)||0) : autoPrice}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Auto price</p>
                    <button
                      onClick={() => { setEditUseCustom(!editUseCustom); if (!editUseCustom) setEditCustomPrice(String(autoPrice)); }}
                      className={`text-xs font-black px-3 py-1 rounded-full transition-all ${editUseCustom ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}
                    >{editUseCustom ? 'Custom ✓' : 'Override'}</button>
                  </div>
                </div>
                {editUseCustom && (
                  <div className="flex items-center gap-2 bg-surface-container-high rounded-xl px-3 py-2">
                    <span className="text-secondary font-black">₹</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="flex-1 font-black text-xl text-on-surface bg-transparent border-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="Enter price"
                      value={editCustomPrice}
                      onChange={(e) => setEditCustomPrice(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={closeEdit} className="flex-1 h-12 rounded-full bg-surface-container-high font-bold text-on-surface-variant active:scale-95 transition-transform">
                  Cancel
                </button>
                <button onClick={applyEdit} className="flex-[2] h-12 rounded-full signature-gradient font-headline font-bold text-white shadow-lg active:scale-95 transition-transform">
                  Update Item
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
