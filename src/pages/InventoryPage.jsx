import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_CATEGORIES = [
  { id: 'cat1', name: 'Pooja Items', color: 'border-secondary', icon: 'folder', iconBg: 'bg-secondary-fixed' },
  { id: 'cat2', name: 'Ayurvedic Medicines', color: 'border-primary', icon: 'medical_services', iconBg: 'bg-primary-fixed' },
  { id: 'cat3', name: 'Herbal Powders', color: 'border-tertiary', icon: 'medication', iconBg: 'bg-tertiary-fixed' },
];

export default function InventoryPage() {
  const navigate = useNavigate();
  
  // State for data
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : [];
  });

  // UI State
  const [view, setView] = useState('categories'); // 'categories' or 'items'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
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

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem('categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  // Derived Values
  const totalItems = products.length;
  const lowStockItems = products.filter(p => Number(p.stock) <= Number(p.lowStockAlert)).length;
  const filteredProducts = products.filter(p => p.categoryId === selectedCategory?.id);

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
    setCategories([...categories, newCat]);
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

    if (editingItem) {
      setProducts(products.map(p => p.id === editingItem.id ? newItem : p));
    } else {
      setProducts([...products, newItem]);
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

  const deleteItem = (id) => {
    if (window.confirm('Delete this item?')) {
      setProducts(products.filter(p => p.id !== id));
    }
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
            {view === 'categories' ? 'My Stock 📦' : selectedCategory?.name}
          </h2>
        </div>

        {/* Summary Card */}
        <div className="bg-primary-fixed rounded-xl p-5 flex justify-between items-center shadow-sm">
          <div className="space-y-1">
            <p className="text-on-primary-fixed-variant font-medium opacity-80">Total Items</p>
            <p className="text-3xl font-headline text-on-primary-fixed">{totalItems}</p>
          </div>
          <div className="h-12 w-[1px] bg-on-primary-fixed/10"></div>
          <div className="space-y-1 text-right">
            <p className="text-on-primary-fixed-variant font-medium opacity-80">Low Stock</p>
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
              className="w-full h-16 pl-14 pr-6 bg-surface-container-high border-none rounded-xl text-lg font-body focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all placeholder:text-outline" 
              placeholder="Search across all categories..." 
              type="text"
            />
          </div>
        </section>
      )}

      {/* CATEGORIES VIEW */}
      {view === 'categories' && (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h3 className="font-headline text-xl text-on-surface flex items-center gap-2">
            Categories <span className="material-symbols-outlined text-outline text-lg">folder_open</span>
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {categories.map((cat, idx) => {
              const count = products.filter(p => p.categoryId === cat.id).length;
              return (
                <button 
                  key={cat.id}
                  onClick={() => openCategory(cat)}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  className={`flex items-center justify-between p-6 bg-surface-container-lowest rounded-lg border-l-4 ${cat.color} shadow-sm active:scale-[0.98] transition-all text-left group animate-in slide-in-from-right-4 fill-mode-both`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 ${cat.iconBg} rounded-full flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <span className="material-symbols-outlined text-on-surface text-2xl">{cat.icon}</span>
                    </div>
                    <div>
                      <p className="font-headline text-lg text-on-surface">{cat.name}</p>
                      <p className="text-on-surface-variant font-body">{count} items</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-outline transition-transform group-hover:translate-x-1">chevron_right</span>
                </button>
              );
            })}
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center p-6 border-2 border-dashed border-outline-variant rounded-lg bg-transparent hover:bg-surface-container-low transition-colors"
            >
              <div className="flex items-center gap-2 text-outline font-headline">
                <span className="material-symbols-outlined">add_circle</span>
                <span>Add New Category</span>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* ITEMS VIEW */}
      {view === 'items' && (
        <section className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between pt-4">
            <h3 className="font-headline text-2xl text-primary">In this Section</h3>
            <span className="text-on-surface-variant font-body text-sm px-3 py-1 bg-surface-container-high rounded-full">{filteredProducts.length} Items</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-outline space-y-4">
              <span className="material-symbols-outlined text-6xl">inventory_2</span>
              <p className="font-headline text-lg text-center">No items here.<br/>Click ➕ below to add your first item.</p>
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
                        Low Stock
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
                        <span className="text-on-surface-variant font-medium">Stock Level</span>
                        <span className={`font-headline ${isItemLow ? 'text-error' : 'text-on-surface'} text-lg`}>
                          {item.stock} {item.unit}
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
                        <p className="text-[10px] uppercase text-outline font-bold">Selling</p>
                        <p className="font-headline text-lg text-on-surface">₹{item.sellingPrice}</p>
                      </div>
                      <div className="text-center border-x border-outline-variant/30">
                        <p className="text-[10px] uppercase text-outline font-bold">Purchase</p>
                        <p className="font-headline text-lg text-on-surface">₹{item.purchasePrice}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-primary font-bold">Profit</p>
                        <p className="font-headline text-lg text-primary">₹{item.profit}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => editItem(item)}
                        className="flex-1 h-14 bg-surface-container-high text-on-surface font-headline rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-surface-container-highest"
                      >
                        <span className="material-symbols-outlined">edit</span>
                        Edit
                      </button>
                      <button 
                        onClick={() => deleteItem(item.id)}
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
            <h3 className="font-headline text-2xl font-bold mb-6">Add New Category</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-widest text-outline px-1">Category Name</label>
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
                  Cancel
                </button>
                <button 
                  onClick={handleAddCategory}
                  className="flex-1 h-14 signature-gradient text-white rounded-full font-headline font-bold shadow-lg hover:shadow-primary/30 active:scale-95 transition-all"
                >
                  Save Section
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
                <h3 className="font-headline text-3xl font-bold">{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                <button onClick={() => setIsItemModalOpen(false)} className="w-12 h-12 bg-surface-container-low rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-surface-container-high">
                  <span className="material-symbols-outlined text-outline">close</span>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">Item Name *</label>
                    <input className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary transition-all" 
                      placeholder="e.g. Ashwagandha"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">Scientific Name (Optional)</label>
                    <input className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary italic transition-all" 
                      placeholder="Withania somnifera"
                      value={itemForm.scientificName}
                      onChange={(e) => setItemForm({...itemForm, scientificName: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">Unit</label>
                      <select className="w-full h-14 px-4 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary transition-all"
                        value={itemForm.unit}
                        onChange={(e) => setItemForm({...itemForm, unit: e.target.value})}
                      >
                        <option value="pieces">Pieces / Units</option>
                        <option value="grams">Grams (g)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="ml">Milliliters (ml)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">Stock Quantity</label>
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
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">Low Stock Alert</label>
                      <input type="number" className="w-full h-14 px-5 bg-surface-container-low rounded-lg border-none focus:ring-2 focus:ring-primary text-error font-bold transition-all" 
                        placeholder="Alert at"
                        value={itemForm.lowStockAlert}
                        onChange={(e) => setItemForm({...itemForm, lowStockAlert: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-outline px-1 block mb-2">Expiry Date</label>
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
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveItem}
                    className="flex-[2] h-16 signature-gradient text-white rounded-full font-headline font-bold text-lg shadow-lg hover:shadow-primary/30 active:scale-95 transition-all"
                  >
                    {editingItem ? 'Update Item' : 'Save Item'}
                  </button>
                </div>
              </div>
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
            <span className="font-headline text-lg font-bold">Add New Item</span>
          </button>
        </div>
      )}
    </main>
  );
}
