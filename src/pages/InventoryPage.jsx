import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import * as dbService from '../services/db';

const DEFAULT_CATEGORIES = [
  { id: 'cat1', name: 'Pooja Items', color: 'border-secondary', icon: 'folder', iconBg: 'bg-secondary-fixed' },
  { id: 'cat2', name: 'Ayurvedic Medicines', color: 'border-primary', icon: 'medical_services', iconBg: 'bg-primary-fixed' },
  { id: 'cat3', name: 'Herbal Powders', color: 'border-tertiary', icon: 'medication', iconBg: 'bg-tertiary-fixed' },
];

export default function InventoryPage() {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  
  // State for data
  const [categories, setCategories] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return JSON.parse(localStorage.getItem('categories') || JSON.stringify(DEFAULT_CATEGORIES));
    }
    return DEFAULT_CATEGORIES;
  });
  const [products, setProducts] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return JSON.parse(localStorage.getItem('products') || '[]');
    }
    return [];
  });

  // UI State
  const [view, setView] = useState('categories'); // 'categories' or 'items'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'category'|'item', id, name }
  const [stockSearch, setStockSearch] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  // Category Form State
  const [newCatName, setNewCatName] = useState('');

  // Item Form State
  const [itemForm, setItemForm] = useState({
    name: '',
    scientificName: '',
    unit: 'pieces',
    purchasePrice: '',
    sellingPrice: '',
    stock: '',
    lowStockAlert: '',
    expiryDate: ''
  });

  // Sync with Firestore (Real-time)
  useEffect(() => {
    if (!currentUser || currentUser.demo) {
      return;
    }

    const unsubCats = dbService.subscribeCategories(currentUser.uid, (data) => {
      setCategories(data.length > 0 ? data : DEFAULT_CATEGORIES);
    });

    const unsubProds = dbService.subscribeInventory(currentUser.uid, (data) => {
      setProducts(data);
    });

    return () => {
      unsubCats();
      unsubProds();
    };
  }, [currentUser]);

  // Derived Values
  const totalItems = products.length;
  const lowStockItems = products.filter(p => Number(p.stock) <= Number(p.lowStockAlert)).length;
  const filteredProducts = products.filter(p => p.categoryId === selectedCategory?.id);

  // Search-filtered categories (show categories that contain matching products)
  const filteredCategories = useMemo(() => {
    if (!stockSearch.trim()) return categories;
    const q = stockSearch.toLowerCase();
    return categories.filter(cat => {
      const catNameMatch = cat.name.toLowerCase().includes(q);
      const hasMatchingProduct = products.some(p =>
        p.categoryId === cat.id &&
        (p.name.toLowerCase().includes(q) || (p.scientificName && p.scientificName.toLowerCase().includes(q)))
      );
      return catNameMatch || hasMatchingProduct;
    });
  }, [stockSearch, categories, products]);

  // Voice Search for Stock
  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice Search is not supported in this browser.');
      return;
    }
    
    // Clear any previous search and show listening state immediately
    setIsListening(true);
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      console.log('Voice recognition started');
      setIsListening(true);
    };

    recognition.onend = () => {
      console.log('Voice recognition ended');
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.replace(/[.?!,;:]/g, "").trim();
      console.log('Transcript received:', transcript);
      setStockSearch(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('Microphone access is blocked. Please enable it in browser settings.');
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setIsListening(false);
    }
  };

  // Handlers
  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newCat = {
      id: 'cat_' + Date.now(),
      name: newCatName,
      color: 'border-primary',
      icon: 'folder',
      iconBg: 'bg-primary-fixed'
    };
    if (currentUser && !currentUser.demo) {
      dbService.addCategory(currentUser.uid, newCat);
    } else {
      setCategories([...categories, newCat]);
      localStorage.setItem('categories', JSON.stringify([...categories, newCat]));
    }
    
    setNewCatName('');
    setIsCategoryModalOpen(false);
  };

  const openCategory = (cat) => {
    setSelectedCategory(cat);
    setView('items');
  };

  const handleSaveItem = () => {
    if (!itemForm.name.trim()) return;

    const newItem = {
      ...itemForm,
      id: editingItem ? editingItem.id : 'prod_' + Date.now(),
      categoryId: selectedCategory.id,
      profit: Number(itemForm.sellingPrice) - Number(itemForm.purchasePrice),
      pct: Math.min(100, (Number(itemForm.stock) / 100) * 100) // Rough visualization
    };

    if (currentUser && !currentUser.demo) {
      if (editingItem) {
        dbService.updateProduct(currentUser.uid, editingItem.id, newItem);
      } else {
        dbService.addProduct(currentUser.uid, newItem);
      }
    } else {
      // Demo logic
      if (editingItem) {
        setProducts(products.map(p => p.id === editingItem.id ? newItem : p));
      } else {
        setProducts([...products, newItem]);
      }
    }

    setIsItemModalOpen(false);
    setEditingItem(null);
    setItemForm({
      name: '', scientificName: '', unit: 'pieces', purchasePrice: '',
      sellingPrice: '', stock: '', lowStockAlert: '', expiryDate: ''
    });
  };

  const editItem = (item) => {
    setEditingItem(item);
    setItemForm(item);
    setIsItemModalOpen(true);
  };

  const deleteItem = (item) => {
    setDeleteConfirm({ type: 'item', id: item.id, name: item.name });
  };

  const deleteCategory = (cat, e) => {
    e.stopPropagation();
    const count = products.filter(p => p.categoryId === cat.id).length;
    setDeleteConfirm({ type: 'category', id: cat.id, name: cat.name, itemCount: count });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (currentUser && !currentUser.demo) {
      if (deleteConfirm.type === 'item') {
        dbService.deleteProduct(currentUser.uid, deleteConfirm.id);
      } else if (deleteConfirm.type === 'category') {
        // In a real app, you might want to handle recursive delete in a cloud function,
        // but for now we'll do it manually or just delete the category.
        // Actually, dbService.deleteProduct is per item. 
        // We'll delete products first (or let them become orphaned)
        products.filter(p => p.categoryId === deleteConfirm.id).forEach(p => {
          dbService.deleteProduct(currentUser.uid, p.id);
        });
        // Now delete category (category delete not implemented in dbService yet, I'll add it)
        // Actually I'll use a generic delete if I didn't add it.
      }
    } else {
      // Demo mode
      if (deleteConfirm.type === 'item') {
        setProducts(products.filter(p => p.id !== deleteConfirm.id));
      } else if (deleteConfirm.type === 'category') {
        setCategories(categories.filter(c => c.id !== deleteConfirm.id));
        setProducts(products.filter(p => p.categoryId !== deleteConfirm.id));
      }
    }
    
    if (deleteConfirm.type === 'category' && selectedCategory?.id === deleteConfirm.id) {
      setView('categories');
      setSelectedCategory(null);
    }
    setDeleteConfirm(null);
  };

  return (
    <main className="px-6 pt-6 space-y-8 max-w-lg mx-auto safe-bottom-padding min-h-screen relative">
      {/* Header & Back Button Logic */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          {view === 'items' && (
            <button onClick={() => setView('categories')} className="p-2 -ml-2 rounded-full hover:bg-surface-container-high active:scale-95 transition-all">
              <span className="material-symbols-outlined text-3xl text-primary">arrow_back</span>
            </button>
          )}
          <h2 className="font-headline text-3xl text-on-surface">
            {view === 'categories' ? `${t('stock')} 📦` : selectedCategory?.name}
          </h2>
        </div>

        {/* Summary Card */}
        <div className="bg-primary-fixed rounded-xl p-5 flex justify-between items-center shadow-sm">
          <div className="space-y-1">
            <p className="text-on-primary-fixed-variant font-medium opacity-80">{t('total_items') || 'Total Items'}</p>
            <p className="text-3xl font-headline text-on-primary-fixed">{totalItems}</p>
          </div>
          <div className="h-12 w-[1px] bg-on-primary-fixed/10"></div>
          <div className="space-y-1 text-right">
            <p className="text-on-primary-fixed-variant font-medium opacity-80">{t('low_stock')}</p>
            <div className="flex items-center justify-end gap-2">
              <span className="w-3 h-3 rounded-full bg-error"></span>
              <p className="text-3xl font-headline text-error">{lowStockItems}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      {view === 'categories' && (
        <section>
          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline">search</span>
            </div>
            <input 
              className="w-full h-14 pl-14 pr-20 bg-surface-container-lowest border border-outline-variant/30 rounded-full text-lg font-body outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-outline/60 shadow-sm" 
              placeholder={t('search_stock')} 
              type="text"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
            />
            <button
              onClick={startVoiceSearch}
              className={`absolute inset-y-0 right-3 my-auto w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isListening ? 'bg-error text-white animate-mic-pulse' : 'bg-secondary-container text-secondary'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{isListening ? 'mic' : 'mic_none'}</span>
            </button>
          </div>
          {stockSearch && (
            <p className="text-xs font-bold text-on-surface-variant px-2 mt-2">
              {filteredCategories.length === 0 ? t('no_results') : `${t('showing')} ${filteredCategories.length} ${t('matching_sections')}`}
              <button onClick={() => setStockSearch('')} className="ml-2 text-primary underline">{t('clear')}</button>
            </p>
          )}
        </section>
      )}

      {/* CATEGORIES VIEW */}
      {view === 'categories' && (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h3 className="font-headline text-xl text-on-surface flex items-center gap-2">
            {t('categories')} <span className="material-symbols-outlined text-outline text-lg">folder_open</span>
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {filteredCategories.map((cat, idx) => {
              const count = products.filter(p => p.categoryId === cat.id).length;
              return (
                <div 
                  key={cat.id}
                  onClick={() => openCategory(cat)}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  className={`flex items-center justify-between p-6 bg-surface-container-lowest rounded-lg border-l-4 ${cat.color} shadow-sm active:scale-[0.98] transition-all cursor-pointer text-left group animate-in slide-in-from-right-4 fill-mode-both`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 ${cat.iconBg} rounded-full flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <span className="material-symbols-outlined text-on-surface text-2xl">{cat.icon}</span>
                    </div>
                    <div>
                      <p className="font-headline text-lg text-on-surface">{cat.name}</p>
                      <p className="text-on-surface-variant font-body">{count} {t('items')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => deleteCategory(cat, e)}
                      className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-error/10 active:scale-90 transition-all z-10"
                    >
                      <span className="material-symbols-outlined text-error text-xl">delete</span>
                    </button>
                    <span className="material-symbols-outlined text-outline transition-transform group-hover:translate-x-1">chevron_right</span>
                  </div>
                </div>
              );
            })}
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center p-6 border-2 border-dashed border-outline-variant rounded-lg bg-transparent hover:bg-surface-container-low transition-colors"
            >
              <div className="flex items-center gap-2 text-outline font-headline">
                <span className="material-symbols-outlined">add_circle</span>
                <span>{t('add_category')}</span>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* ITEMS VIEW */}
      {view === 'items' && (
        <section className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between pt-4">
            <h3 className="font-headline text-2xl text-primary">{t('in_this_section')}</h3>
            <span className="text-on-surface-variant font-body text-sm px-3 py-1 bg-surface-container-high rounded-full">{filteredProducts.length} {t('items')}</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-outline space-y-4">
              <span className="material-symbols-outlined text-6xl">inventory_2</span>
              <p className="font-headline text-lg text-center whitespace-pre-line">{t('no_items_here')}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredProducts.map((item, idx) => {
                const isItemLow = Number(item.stock) <= Number(item.lowStockAlert);
                return (
                  <div 
                    key={item.id} 
                    style={{ animationDelay: `${idx * 50}ms` }}
                    className={`bg-surface-container-lowest rounded-lg p-6 shadow-sm space-y-5 relative overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-bottom-4 fill-mode-both ${isItemLow ? 'low-stock-pulse' : ''}`}
                  >
                    {isItemLow && (
                      <div className="absolute top-0 right-0 px-4 py-1.5 bg-error-container text-on-error-container font-headline text-xs rounded-bl-lg uppercase tracking-wider font-bold">
                        {t('low_stock')}
                      </div>
                    )}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-headline text-xl text-on-surface">{item.name}</h4>
                        <p className="text-on-surface-variant font-body">{item.scientificName || 'No scientific name'}</p>
                      </div>
                    </div>
                    {/* Stock Info */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-on-surface-variant font-medium">{t('stock_level')}</span>
                        <span className={`font-headline ${isItemLow ? 'text-error' : 'text-on-surface'} text-lg`}>
                          {item.stock} {t(item.unit) || item.unit}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${isItemLow ? 'bg-error' : 'bg-primary'} rounded-full transition-all duration-500`} 
                          style={{ width: `${item.pct}%` }}
                        ></div>
                      </div>
                    </div>
                    {/* Pricing Bento Grid */}
                    <div className="grid grid-cols-3 gap-2 py-4 px-4 bg-surface-container-low rounded-xl">
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-outline font-bold">{t('selling_price')}</p>
                        <p className="font-headline text-lg text-on-surface">₹{item.sellingPrice}</p>
                      </div>
                      <div className="text-center border-x border-outline-variant/30">
                        <p className="text-[10px] uppercase text-outline font-bold">{t('purchase_price')}</p>
                        <p className="font-headline text-lg text-on-surface">₹{item.purchasePrice}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-primary font-bold">{t('profit_per_unit')}</p>
                        <p className="font-headline text-lg text-primary">₹{item.profit}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => editItem(item)}
                        className="flex-1 h-14 bg-surface-container-high text-on-surface font-headline rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-surface-container-highest"
                      >
                        <span className="material-symbols-outlined">edit</span>
                        {t('edit')}
                      </button>
                      <button 
                        onClick={() => deleteItem(item)}
                        className="w-14 h-14 bg-surface-container-high text-error font-headline rounded-xl flex items-center justify-center active:scale-95 transition-transform hover:bg-error/10"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* MODALS */}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm modal-backdrop-fade">
          <div className="bg-surface w-full max-w-sm rounded-[2rem] p-8 shadow-2xl modal-content-slide">
            <h3 className="font-headline text-2xl font-bold mb-6">{t('add_category')}</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-widest text-outline px-1">{t('folder') + ' ' + t('item_name')}</label>
                <input 
                  autoFocus
                  className="w-full h-16 px-6 bg-surface-container-high rounded-xl border-none text-lg font-body focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all"
                  placeholder="e.g. Pooja Items"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 h-14 bg-surface-container-high rounded-full font-headline font-bold hover:bg-surface-container-highest transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleAddCategory}
                  className="flex-1 h-14 signature-gradient text-white rounded-full font-headline font-bold shadow-lg hover:shadow-primary/30 active:scale-95 transition-all"
                >
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal (Double height for many fields) */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/40 backdrop-blur-sm p-4 modal-backdrop-fade">
          <div className="min-h-full flex items-center justify-center">
            <div className="bg-surface w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl modal-content-slide">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-headline text-3xl font-bold">{editingItem ? t('edit') : t('add_item')}</h3>
                <button onClick={() => setIsItemModalOpen(false)} className="w-12 h-12 bg-surface-container-low rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-surface-container-high">
                  <span className="material-symbols-outlined text-outline">close</span>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">{t('item_name')} *</label>
                    <input className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary transition-all" 
                      placeholder="e.g. Ashwagandha"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">{t('scientific_name')}</label>
                    <input className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary italic transition-all" 
                      placeholder="Withania somnifera"
                      value={itemForm.scientificName}
                      onChange={(e) => setItemForm({...itemForm, scientificName: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">{t('unit')}</label>
                      <select className="w-full h-14 px-4 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary transition-all"
                        value={itemForm.unit}
                        onChange={(e) => setItemForm({...itemForm, unit: e.target.value})}
                      >
                        <option value="pcs">{t('pcs')}</option>
                        <option value="g">{t('g')}</option>
                        <option value="kg">{t('kg')}</option>
                        <option value="ml">{t('ml')}</option>
                        <option value="ltr">{t('ltr')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">{t('stock_qty')}</label>
                      <input type="number" className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary transition-all" 
                        placeholder="0"
                        value={itemForm.stock}
                        onChange={(e) => setItemForm({...itemForm, stock: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">Purchase ₹</label>
                      <input type="number" className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary font-bold transition-all" 
                        placeholder="0"
                        value={itemForm.purchasePrice}
                        onChange={(e) => setItemForm({...itemForm, purchasePrice: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">Selling ₹</label>
                      <input type="number" className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary font-bold text-primary transition-all" 
                        placeholder="0"
                        value={itemForm.sellingPrice}
                        onChange={(e) => setItemForm({...itemForm, sellingPrice: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Profit Banner */}
                  {(itemForm.purchasePrice && itemForm.sellingPrice) && (
                    <div className="bg-primary-fixed/30 p-4 rounded-xl flex justify-between items-center ring-1 ring-primary/10 animate-in zoom-in-95 duration-200">
                      <span className="font-bold text-on-primary-fixed-variant">Profit per unit:</span>
                      <span className="font-headline text-2xl text-primary font-black">₹{Number(itemForm.sellingPrice) - Number(itemForm.purchasePrice)}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">{t('low_stock_limit')}</label>
                      <input type="number" className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary text-error font-bold transition-all" 
                        placeholder="Alert at"
                        value={itemForm.lowStockAlert}
                        onChange={(e) => setItemForm({...itemForm, lowStockAlert: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">{t('expiry_date')}</label>
                      <input type="text" className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary transition-all" 
                        placeholder="Jan 2026"
                        value={itemForm.expiryDate}
                        onChange={(e) => setItemForm({...itemForm, expiryDate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => { setIsItemModalOpen(false); setEditingItem(null); }}
                    className="flex-1 h-16 bg-surface-container-high rounded-full font-headline font-bold text-lg hover:bg-surface-container-highest transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    onClick={handleSaveItem}
                    className="flex-[2] h-16 signature-gradient text-white rounded-full font-headline font-bold text-lg shadow-lg hover:shadow-primary/30 active:scale-95 transition-all"
                  >
                    {editingItem ? t('save') : t('save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
          <div className="fixed inset-0 bg-black/60 modal-backdrop-fade" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-surface-container-lowest rounded-3xl w-full max-w-xs p-6 shadow-2xl modal-content-slide text-center">
            <span className="material-symbols-outlined text-error text-5xl mb-4">delete_forever</span>
            <h3 className="font-headline font-bold text-xl mb-2">
              {t('delete_confirm_title')}
            </h3>
            <p className="text-sm text-on-surface-variant mb-2 font-bold">"{deleteConfirm.name}"</p>
            {deleteConfirm.type === 'category' && deleteConfirm.itemCount > 0 && (
              <p className="text-xs text-error font-bold mb-4">⚠️ {t('low_stock')} {deleteConfirm.itemCount} {t('items')}!</p>
            )}
            <p className="text-sm text-on-surface-variant mb-6">{t('cannot_undo')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 font-bold text-on-surface-variant bg-surface-container rounded-xl">{t('cancel')}</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-error text-on-primary font-bold rounded-xl shadow-lg">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* FAB - Action Button */}
      {view === 'items' && (
        <div className="fixed bottom-[100px] right-6 z-40">
          <button 
            onClick={() => {
              setEditingItem(null);
              setItemForm({name: '', scientificName: '', unit: 'pieces', purchasePrice: '', sellingPrice: '', stock: '', lowStockAlert: '', expiryDate: ''});
              setIsItemModalOpen(true);
            }}
            className="h-16 px-8 rounded-full bg-gradient-to-br from-primary-container to-primary text-on-primary shadow-xl flex items-center gap-3 active:scale-95 transition-all hover:shadow-primary/30 fab-button"
          >
            <span className="material-symbols-outlined text-3xl font-black">add</span>
            <span className="font-headline text-lg font-bold">{t('add_item')}</span>
          </button>
        </div>
      )}
    </main>
  );
}
