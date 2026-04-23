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
      const query = searchQuery.toLowerCase();
      return allProducts.filter(p => 
        (p.name && p.name.toLowerCase().includes(query)) || 
        (p.scientificName && p.scientificName.toLowerCase().includes(query))
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
    <main className="max-w-[390px] mx-auto px-4 pt-6 space-y-10 safe-bottom-padding animate-in slide-in-from-right-4 duration-300">
      {/* Top App Bar */}
      <header className="flex items-center justify-between py-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-surface-container-high active:scale-95 transition-all">
          <span className="material-symbols-outlined text-3xl text-on-surface">arrow_back</span>
        </button>
        <h1 className="font-headline font-extrabold text-2xl tracking-tight text-primary">ShopSaathi</h1>
        <div className="w-10"></div>
      </header>

      {/* Modern Search Section */}
      <section className="space-y-4 pb-80">
        <h2 className="font-headline font-bold text-3xl tracking-tight text-on-surface px-2">{t('new_bill')}</h2>
        <div className="relative group z-[60]">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-outline/60">search</span>
          </div>
          <input 
            className="w-full h-14 pl-14 pr-24 bg-surface-container-lowest border border-outline-variant/30 rounded-full text-lg font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-outline/60 shadow-sm text-on-surface" 
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
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-8 bg-primary rounded-full"></div>
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-primary">{t('bill_items')}</h3>
        </div>

        {items.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-outline-variant space-y-4 bg-surface-container-lowest rounded-3xl border-2 border-dashed border-outline-variant">
            <span className="material-symbols-outlined text-6xl">receipt_long</span>
            <p className="font-headline font-bold">{t('no_items')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const subUnit = getSubUnit(item.unit);
              const inSub = isSubUnit(item.billingUnit);
              const stockLow = inSub
                ? Number(item.stock) * 1000 < 500
                : Number(item.stock) < 5;
              const stockLabel = inSub
                ? `${Number(item.stock) * 1000}${item.billingUnit}`
                : `${item.stock} ${item.unit}`;
              return (
              <div key={item.id} className="bg-surface-container-low rounded-xl p-5 shadow-sm border border-outline-variant/30 animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg text-on-surface">{item.name}</h4>
                    <p className="text-xs text-on-surface-variant font-medium italic">{item.scientificName}</p>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-error active:scale-95 transition-transform p-1">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>

                {/* Unit toggle (only for kg/g and ltr/ml) */}
                {subUnit && (
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => updateBillingUnit(item.id, item.unit)}
                      className={`flex-1 py-2 rounded-xl text-sm font-black transition-all ${!inSub ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}
                    >
                      {item.unit}
                    </button>
                    <button
                      onClick={() => updateBillingUnit(item.id, subUnit)}
                      className={`flex-1 py-2 rounded-xl text-sm font-black transition-all ${inSub ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}
                    >
                      {subUnit}
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  {/* Auto price display */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 bg-primary/10 px-4 py-2 rounded-xl">
                      <span className="text-primary font-black text-xl">₹</span>
                      <span className="font-black text-primary text-2xl">{item.price}</span>
                    </div>
                    <span className="text-[9px] text-on-surface-variant font-bold mt-1">AUTO PRICE</span>
                  </div>

                  {/* Quantity input */}
                  {inSub ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 bg-surface-container-highest rounded-full px-4 py-2">
                        <button
                          onClick={() => updateBillingQty(item.id, Math.max(1, item.billingQty - 10))}
                          className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 font-bold"
                        >-</button>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="font-black text-on-surface text-lg w-16 text-center bg-transparent border-none p-0 focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          value={item.billingQty}
                          onFocus={(e) => { e.target.select(); }}
                          onChange={(e) => updateBillingQty(item.id, e.target.value === '' ? 0 : e.target.value)}
                          onBlur={(e) => { if (!e.target.value || Number(e.target.value) < 1) updateBillingQty(item.id, 1); }}
                        />
                        <button
                          onClick={() => updateBillingQty(item.id, item.billingQty + 10)}
                          className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 font-bold"
                        >+</button>
                      </div>
                      <span className="text-[10px] font-black text-primary/60 uppercase">{item.billingUnit}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 bg-surface-container-highest rounded-full px-4 py-2">
                        <button
                          onClick={() => updateBillingQty(item.id, Math.max(1, item.billingQty - 1))}
                          className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 font-bold"
                        >-</button>
                        <span className="font-black text-on-surface text-lg w-8 text-center">{item.billingQty}</span>
                        <button
                          onClick={() => updateBillingQty(item.id, item.billingQty + 1)}
                          className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 font-bold"
                        >+</button>
                      </div>
                      <span className="text-[10px] font-black text-primary/60 uppercase">{item.billingUnit}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-between items-center text-sm font-bold border-t border-outline-variant/20 pt-3">
                  <span className="text-on-surface-variant">{t('subtotal')}:</span>
                  <span className="text-lg text-on-surface">₹{item.price}</span>
                </div>
                {stockLow && (
                  <p className="text-[10px] text-error font-black uppercase tracking-tighter mt-1 italic">⚠️ Only {stockLabel} left!</p>
                )}
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bill Summary - Static Footer */}
      <footer className="fixed-action-footer bg-surface/90 backdrop-blur-xl px-6 py-6 border-t border-outline-variant shadow-[0_-12px_40px_rgba(0,0,0,0.12)] rounded-t-[2.5rem]">
        <div className="space-y-4 mb-6">
          <div className="flex justify-between items-center text-on-surface-variant font-medium">
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString()}</span>
          </div>
          {isGstEnabled && (
            <div className="flex justify-between items-center text-secondary font-bold">
              <span>GST (18%)</span>
              <span>₹{gst.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-on-surface text-2xl font-black border-t border-outline-variant/30 pt-4">
            <span className="font-headline uppercase tracking-tighter">{t('total_amount')}</span>
            <span className="text-primary text-3xl">₹{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Billing Language Selector */}
        <button
          onClick={() => setIsBillLangModalOpen(true)}
          className="w-full flex items-center justify-between bg-surface-container-high/50 p-4 rounded-2xl ring-1 ring-outline-variant/20 shadow-sm mb-6 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">language</span>
            </div>
            <div className="text-left">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block leading-none mb-1">{t('billing_language')}</span>
              <span className="text-sm font-bold text-primary">
                {({'en':'English','hi':'हिन्दी','kn':'ಕನ್ನಡ','te':'తెలుగు','ta':'தமிழ்','ml':'മലയാളം','mr':'मराठी','gu':'ગુજરાતી'})[billLanguage] || 'English'}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
        </button>

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
                className="w-full mt-6 h-14 bg-surface-container-highest rounded-xl font-headline font-bold text-on-surface-variant active:scale-95 transition-transform"
              >
                {t('save')}
              </button>
            </div>
          </div>
        )}
        <button 
          onClick={handleBillConfirmation}
          className="signature-gradient w-full h-16 rounded-full flex items-center justify-center gap-3 text-white font-headline text-xl font-black shadow-xl shadow-primary/30 active:scale-95 transition-all hover:shadow-primary/50"
        >
          <span className="material-symbols-outlined text-2xl filled-icon">check_circle</span>
          {t('checkout')}
        </button>
      </footer>
    </main>
  );
}
