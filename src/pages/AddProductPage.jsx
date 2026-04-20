import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import * as dbService from '../services/db';

export default function AddProductPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  
  const [categories, setCategories] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return JSON.parse(localStorage.getItem('categories') || '[]');
    }
    return [];
  });
  const [product, setProduct] = useState(() => {
    const initial = {
      name: '',
      price: '',
      stock: '',
      categoryId: '',
      unit: 'pcs',
    };
    if (!currentUser || currentUser.demo) {
      const saved = JSON.parse(localStorage.getItem('categories') || '[]');
      if (saved.length > 0) {
        initial.categoryId = saved[0].id;
      }
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (!currentUser || currentUser.demo) {
      return;
    }
    const unsub = dbService.subscribeCategories(currentUser.uid, (data) => {
      if (mounted) {
        setCategories(data);
        if (data.length > 0 && !product.categoryId) {
          setProduct(prev => ({ ...prev, categoryId: data[0].id }));
        }
      }
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [currentUser, product.categoryId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const newProduct = {
      name: product.name,
      scientificName: '', // Optional
      categoryId: product.categoryId || null,
      sellingPrice: Number(product.price),
      purchasePrice: Number(product.price * 0.8), // Default guess
      stock: Number(product.stock),
      unit: product.unit,
      lowStockAlert: 5,
      image: imagePreview || ''
    };

    if (currentUser && !currentUser.demo) {
      try {
        await dbService.addProduct(currentUser.uid, newProduct);
      } catch (err) {
        console.error('Failed to add product:', err);
        alert('Failed to save to cloud.');
        setLoading(false);
        return;
      }
    } else {
      const existing = JSON.parse(localStorage.getItem('products') || '[]');
      localStorage.setItem('products', JSON.stringify([{ ...newProduct, id: Date.now().toString() }, ...existing]));
    }

    setLoading(false);
    navigate('/inventory');
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <main className="max-w-[450px] mx-auto px-6 pt-8 pb-32 min-h-screen bg-surface page-transition-enter">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-90">
          <span className="material-symbols-outlined text-on-surface text-2xl">arrow_back</span>
        </button>
        <h1 className="font-headline font-extrabold text-3xl tracking-tight text-on-surface">{t('add_item')}</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Image Picker */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative w-full aspect-square max-w-[200px] mx-auto bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant hover:border-primary transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center p-4 group"
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">add_a_photo</span>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Add Photo</p>
            </>
          )}
          <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-2">{t('item_name')}</label>
            <div className="bg-surface-container-high rounded-2xl p-4 focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm">
              <input 
                type="text" 
                required 
                placeholder="Product Name"
                className="bg-transparent border-none w-full text-lg font-bold p-0 focus:ring-0 text-on-surface"
                value={product.name}
                onChange={e => setProduct({...product, name: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-2">{t('selling_price')}</label>
              <div className="bg-surface-container-high rounded-2xl p-4 flex items-center gap-2 focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm">
                <span className="text-primary font-bold">₹</span>
                <input 
                  type="number" 
                  required 
                  placeholder="0"
                  className="bg-transparent border-none w-full text-lg font-bold p-0 focus:ring-0 text-on-surface"
                  value={product.price}
                  onChange={e => setProduct({...product, price: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-2">Stock</label>
              <div className="bg-surface-container-high rounded-2xl p-4 focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm">
                <input 
                  type="number" 
                  required 
                  placeholder="0"
                  className="bg-transparent border-none w-full text-lg font-bold p-0 focus:ring-0 text-on-surface"
                  value={product.stock}
                  onChange={e => setProduct({...product, stock: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-2">{t('unit')}</label>
              <div className="bg-surface-container-high rounded-2xl p-4 focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm relative">
                <select 
                  value={product.unit}
                  onChange={e => setProduct({...product, unit: e.target.value})}
                  className="bg-transparent border-none w-full text-lg font-bold p-0 appearance-none focus:ring-0 text-on-surface pr-8"
                >
                  <option value="pcs">{t('pcs')}</option>
                  <option value="g">{t('g')}</option>
                  <option value="kg">{t('kg')}</option>
                  <option value="ml">{t('ml')}</option>
                  <option value="ltr">{t('ltr')}</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-2">{t('categories')}</label>
              <div className="bg-surface-container-high rounded-2xl p-4 focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm relative">
                <select 
                  value={product.categoryId}
                  onChange={e => setProduct({...product, categoryId: e.target.value})}
                  className="bg-transparent border-none w-full text-lg font-bold p-0 appearance-none focus:ring-0 text-on-surface pr-8"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
              </div>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full h-16 signature-gradient text-white rounded-full flex items-center justify-center gap-3 font-headline text-xl font-black shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <span className="material-symbols-outlined font-black">save</span>
              {t('save')}
            </>
          )}
        </button>
      </form>
    </main>
  );
}
