import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NewBillPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isGstEnabled, setIsGstEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [items, setItems] = useState([]);
  
  const [allProducts, setAllProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  // Load Data
  useEffect(() => {
    const productsSaved = localStorage.getItem('products');
    const categoriesSaved = localStorage.getItem('categories');
    const gstSaved = localStorage.getItem('gstEnabled');
    
    if (productsSaved) setAllProducts(JSON.parse(productsSaved));
    if (categoriesSaved) setAllCategories(JSON.parse(categoriesSaved));
    if (gstSaved) setIsGstEnabled(JSON.parse(gstSaved));
  }, []);

  // Robust Search Logic
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const query = searchQuery.toLowerCase();
      const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.scientificName && p.scientificName.toLowerCase().includes(query))
      ).map(p => {
        const cat = allCategories.find(c => c.id === p.categoryId);
        return { ...p, categoryName: cat ? cat.name : 'Uncategorized' };
      }).slice(0, 5); // Limit to top 5 results
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, allProducts, allCategories]);

  // Voice Search (Web Speech API)
  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice Search is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'kn-IN'; // Kannada
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
    };

    recognition.start();
  };

  const addItem = (product) => {
    const existing = items.find(i => i.id === product.id);
    if (existing) {
      updateQuantity(product.id, 1);
    } else {
      setItems([...items, { 
        ...product, 
        quantity: 1, 
        price: Number(product.sellingPrice) // Editable price
      }]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQuantity = (id, delta) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
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
        gstEnabled: isGstEnabled
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
      <section className="space-y-4">
        <h2 className="font-headline font-bold text-3xl tracking-tight text-on-surface px-2">New Bill</h2>
        <div className="relative z-[60]">
          <div className={`bg-surface-container-high rounded-xl p-4 flex items-center gap-3 transition-all ${searchQuery ? 'ring-2 ring-secondary bg-surface-container-lowest' : ''}`}>
            <span className="material-symbols-outlined text-outline">search</span>
            <input 
              className="bg-transparent border-none w-full text-lg font-semibold focus:ring-0 p-0 text-on-surface" 
              placeholder="Search by name or scientific name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text" 
            />
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
                    <p className={`text-[10px] font-bold ${Number(p.stock) < 10 ? 'text-error' : 'text-outline'}`}>Stock: {p.stock}</p>
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
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-primary">Bill Items</h3>
        </div>

        {items.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-outline-variant space-y-4 bg-surface-container-lowest rounded-3xl border-2 border-dashed border-outline-variant">
            <span className="material-symbols-outlined text-6xl">receipt_long</span>
            <p className="font-headline font-bold">No items added yet</p>
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
                  <div className="flex items-center gap-4 bg-surface-container-highest rounded-full px-2 py-1">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 transition-all">-</button>
                    <span className="font-black text-on-surface text-lg w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm active:scale-90 transition-all">+</button>
                  </div>
                </div>
                <div className="mt-4 flex justify-between items-center text-sm font-bold border-t border-outline-variant/20 pt-3">
                  <span className="text-on-surface-variant">Subtotal:</span>
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
            <span className="font-headline uppercase tracking-tighter">Grand Total</span>
            <span className="text-primary text-3xl">₹{total.toLocaleString()}</span>
          </div>
        </div>
        <button 
          onClick={handleBillConfirmation}
          className="signature-gradient w-full h-16 rounded-full flex items-center justify-center gap-3 text-white font-headline text-xl font-black shadow-xl shadow-primary/30 active:scale-95 transition-all hover:shadow-primary/50"
        >
          <span className="material-symbols-outlined text-2xl filled-icon">check_circle</span>
          Confirm Bill
        </button>
      </footer>
    </main>
  );
}
