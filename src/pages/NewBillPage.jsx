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

  const addItem = (product) => {
    if (!product) return;
    const existing = items.find(i => i.id === product.id);
    if (existing) {
      updateQuantity(product.id, 1);
    } else {
      setItems([...items, { 
        ...product, 
        quantity: 1, 
        unit: product.unit || 'pcs',
        price: Number(product.sellingPrice) || 0,
        name: product.name || 'Unknown'
      }]);
    }
    setSearchQuery('');
  };

  const updateQuantity = (id, delta) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const currentQty = Number(item.quantity) || 0;
        const newQty = Math.max(0, currentQty + delta);
        // Check stock
        if (newQty > Number(item.stock)) {
          alert(`Only ${item.stock} items in stock!`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setInternalQuantity = (id, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Number(value);
        if (isNaN(newQty)) return item;
        if (newQty > Number(item.stock)) {
          alert(`Only ${item.stock} in stock!`);
          return { ...item, quantity: Number(item.stock) };
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updatePrice = (id, newPrice) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, price: Number(newPrice) } : item
    ));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const gst = isGstEnabled ? subtotal * 0.18 : 0;
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
            {items.map((item) => (
              <div key={item.id} className="bg-surface-container-low rounded-xl p-5 shadow-sm border border-outline-variant/30 animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg text-on-surface">{item.name}</h4>
                    <p className="text-xs text-on-surface-variant font-medium">{item.scientific}</p>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-error active:scale-95 transition-transform p-1">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-surface-container-high px-3 py-1 rounded-lg">
                    <span className="text-on-surface-variant text-xs font-bold">₹</span>
                    <input 
                      type="number"
                      className="w-16 bg-transparent border-none p-0 focus:ring-0 font-black text-primary text-xl"
                      value={item.price}
                      onChange={(e) => updatePrice(item.id, e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-surface-container-highest rounded-full px-3 py-1">
                    <button 
                      onClick={() => updateQuantity(item.id, (item.unit === 'g' || item.unit === 'ml') ? -100 : (item.unit === 'kg' || item.unit === 'ltr') ? -0.5 : -1)} 
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 transition-all font-bold"
                    >
                      -
                    </button>
                    <div className="flex flex-col items-center">
                      <input 
                        type="number"
                        step="any"
                        className="font-black text-on-surface text-lg w-16 text-center bg-transparent border-none p-0 focus:ring-0"
                        value={item.quantity}
                        onChange={(e) => setInternalQuantity(item.id, e.target.value)}
                      />
                      <span className="text-[10px] font-black text-primary/60 uppercase tracking-tighter leading-none mt-0.5">
                        {t(item.unit) || item.unit}
                      </span>
                    </div>
                    <button 
                      onClick={() => updateQuantity(item.id, (item.unit === 'g' || item.unit === 'ml') ? 100 : (item.unit === 'kg' || item.unit === 'ltr') ? 0.5 : 1)} 
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 transition-all font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex justify-between items-center text-sm font-bold border-t border-outline-variant/20 pt-3">
                  <span className="text-on-surface-variant">{t('subtotal')}:</span>
                  <span className="text-lg text-on-surface">₹{item.price * item.quantity}</span>
                </div>
                {Number(item.stock) < 10 && (
                  <p className="text-[10px] text-error font-black uppercase tracking-tighter mt-1 italic">⚠️ Only {item.stock} left!</p>
                )}
              </div>
            ))}
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

        {/* Improved Billing Language Selector */}
        <div className="flex items-center justify-between mb-6 bg-surface-container-high/50 p-3 rounded-2xl ring-1 ring-outline-variant/20 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">language</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block leading-none mb-1">{t('billing_language')}</span>
              <span className="text-xs font-bold text-primary">{billLanguage === 'en' ? 'English' : billLanguage === 'hi' ? 'हिन्दी' : 'ಕನ್ನಡ'}</span>
            </div>
          </div>
          <div className="flex bg-surface-container-highest rounded-xl p-1 gap-1">
            {[
              { id: 'en', label: 'EN' },
              { id: 'hi', label: 'HI' },
              { id: 'kn', label: 'KN' }
            ].map(lang => (
              <button
                key={lang.id}
                onClick={() => setBillLanguage(lang.id)}
                className={`w-12 h-10 rounded-lg text-xs font-black transition-all ${
                  billLanguage === lang.id 
                  ? 'bg-primary text-white shadow-md scale-105' 
                  : 'text-on-surface-variant opacity-50 hover:opacity-100 hover:bg-surface-container-high'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
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
