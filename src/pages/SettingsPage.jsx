import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { logout } = useAuth();
  
  const [shopLogo, setShopLogo] = useState(localStorage.getItem('shopLogo') || '');
  const [shopName, setShopName] = useState(localStorage.getItem('shopName') || 'Sharma General Store');
  const [shopAddress, setShopAddress] = useState(localStorage.getItem('shopAddress') || '123, Main Road, Bangalore');
  const [shopPhone, setShopPhone] = useState(localStorage.getItem('shopPhone') || '9876543210');
  const [gstNumber, setGstNumber] = useState(localStorage.getItem('gstNumber') || '');
  const [upiId, setUpiId] = useState(localStorage.getItem('upiId') || 'sharma.store@upi');
  const [showToast, setShowToast] = useState(false);

  const [isGstEnabled, setIsGstEnabled] = useState(() => {
    const saved = localStorage.getItem('gstEnabled');
    return saved ? JSON.parse(saved) : false;
  });

  const toggleGst = () => {
    const newValue = !isGstEnabled;
    setIsGstEnabled(newValue);
    localStorage.setItem('gstEnabled', JSON.stringify(newValue));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Resize if too large while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        const maxResolution = 300;
        if (width > height) {
          if (width > maxResolution) {
            height *= maxResolution / width;
            width = maxResolution;
          }
        } else {
          if (height > maxResolution) {
            width *= maxResolution / height;
            height = maxResolution;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i]     = avg; // R
          data[i + 1] = avg; // G
          data[i + 2] = avg; // B
        }

        ctx.putImageData(imageData, 0, 0);
        const bwBase64 = canvas.toDataURL('image/png');
        setShopLogo(bwBase64);
        localStorage.setItem('shopLogo', bwBase64);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setShopLogo('');
    localStorage.removeItem('shopLogo');
  };

  const handleFieldChange = (key, value, setter) => {
    setter(value);
    localStorage.setItem(key, value);
  };

  return (
    <main className="max-w-[390px] mx-auto px-4 pt-6 space-y-10 pb-32">
      {/* Top App Bar replacement */}
      <header className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl">storefront</span>
          <h1 className="font-headline font-extrabold text-2xl tracking-tight text-primary">ShopSaathi</h1>
        </div>
        <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-95">
          <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
        </button>
      </header>

      {/* Page Title */}
      <div className="flex items-center gap-2 px-2">
        <h2 className="font-headline font-bold text-3xl tracking-tight text-on-surface">Settings</h2>
        <span className="material-symbols-outlined text-2xl">settings</span>
      </div>

      {/* Shop Profile Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-8 bg-primary rounded-full"></div>
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-primary">Shop Profile</h3>
        </div>
        
        <div className="bg-surface-container-low rounded-lg p-6 space-y-8">
          {/* Logo Upload */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <label 
                className={`w-36 h-36 bg-surface-container-highest rounded-lg border-2 border-dashed border-outline-variant flex flex-col items-center justify-center p-4 group cursor-pointer hover:bg-surface-container-high transition-colors overflow-hidden ${shopLogo ? 'border-solid border-primary' : ''}`}
              >
                {shopLogo ? (
                  <img src={shopLogo} alt="Logo" className="w-full h-full object-contain filter grayscale" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">add_a_photo</span>
                    <p className="text-[10px] font-bold leading-tight text-on-surface-variant uppercase tracking-tighter">Tap to upload shop logo</p>
                  </>
                )}
                <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleLogoUpload} />
              </label>
              {shopLogo && (
                <button 
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-error text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface leading-tight">B&W Receipt Logo</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">Automatic B&W conversion</p>
            </div>
          </div>

          {/* Profile Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">Shop Name</label>
              <div className="bg-surface-container-high rounded-lg p-4 focus-within:ring-2 focus-within:ring-primary transition-all">
                <input 
                  className="bg-transparent border-none w-full text-lg font-bold focus:ring-0 p-0 text-on-surface" 
                  type="text" 
                  value={shopName}
                  onChange={(e) => handleFieldChange('shopName', e.target.value, setShopName)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">Shop Address</label>
              <div className="bg-surface-container-high rounded-lg p-4 focus-within:ring-2 focus-within:ring-primary transition-all">
                <input 
                  className="bg-transparent border-none w-full text-lg font-semibold focus:ring-0 p-0 text-on-surface" 
                  type="text" 
                  value={shopAddress}
                  placeholder="Street, City, Zip"
                  onChange={(e) => handleFieldChange('shopAddress', e.target.value, setShopAddress)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">Contact Number</label>
              <div className="bg-surface-container-high rounded-lg p-4 focus-within:ring-2 focus-within:ring-primary transition-all">
                <input 
                  className="bg-transparent border-none w-full text-lg font-semibold focus:ring-0 p-0 text-on-surface" 
                  type="tel" 
                  value={shopPhone}
                  onChange={(e) => handleFieldChange('shopPhone', e.target.value, setShopPhone)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Billing Settings */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-8 bg-secondary rounded-full"></div>
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-secondary">Billing Settings</h3>
        </div>
        
        <div className="bg-surface-container-low rounded-lg p-6 space-y-8">
          <div className="flex items-center justify-between bg-surface-container-lowest p-6 rounded-lg cursor-pointer" onClick={toggleGst}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary-fixed rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-on-secondary-fixed text-2xl">receipt_long</span>
              </div>
              <span className="text-xl font-bold">GST Billing</span>
            </div>
            <button 
              className={`w-16 h-8 rounded-full relative p-1 transition-colors ${isGstEnabled ? 'bg-primary' : 'bg-surface-container-highest'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${isGstEnabled ? 'translate-x-8' : 'translate-x-0'}`}></div>
            </button>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">GST Identification Number</label>
            <div className="bg-surface-container-high rounded-lg p-4 focus-within:ring-2 focus-within:ring-secondary transition-all">
              <input 
                className="bg-transparent border-none w-full text-lg font-bold focus:ring-0 p-0 text-on-surface uppercase" 
                placeholder="29XXXXX..." 
                type="text" 
                value={gstNumber}
                onChange={(e) => handleFieldChange('gstNumber', e.target.value.toUpperCase(), setGstNumber)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">Your UPI ID</label>
            <div className="bg-surface-container-high rounded-lg p-4 flex items-center gap-3 focus-within:ring-2 focus-within:ring-secondary transition-all">
              <span className="material-symbols-outlined text-secondary">qr_code_2</span>
              <input 
                className="bg-transparent border-none w-full text-lg font-bold focus:ring-0 p-0 text-on-surface" 
                placeholder="sharma.store@upi" 
                type="text" 
                value={upiId}
                onChange={(e) => handleFieldChange('upiId', e.target.value, setUpiId)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-8 bg-on-surface-variant rounded-full"></div>
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-on-surface-variant">Preferences</h3>
        </div>
        
        <div className="space-y-4">
          <button className="w-full flex items-center justify-between bg-surface-container-low p-6 rounded-lg active:scale-[0.98] transition-all">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-2xl text-on-surface-variant">language</span>
              <span className="text-xl font-bold">App Language</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium text-primary">English</span>
              <span className="material-symbols-outlined">chevron_right</span>
            </div>
          </button>
          
          <button 
            onClick={logout}
            className="w-full flex items-center justify-between bg-error-container p-6 rounded-lg active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-2xl text-error">logout</span>
              <span className="text-xl font-bold text-error">Logout</span>
            </div>
          </button>
        </div>
      </section>

      {/* Developer / Testing Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-8 bg-tertiary rounded-full"></div>
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-tertiary">Testing Tools</h3>
        </div>
        
        <div className="bg-surface-container-low rounded-lg p-6 space-y-4">
          <p className="text-sm font-medium text-on-surface-variant px-2">Fill the app with sample products and categories to test the billing flow immediately.</p>
          <button 
            onClick={() => {
              const sampleCategories = [
                { id: 'cat1', name: 'Pooja Items', color: 'border-secondary', icon: 'folder', iconBg: 'bg-secondary-fixed' },
                { id: 'cat2', name: 'Ayurvedic Medicines', color: 'border-primary', icon: 'medical_services', iconBg: 'bg-primary-fixed' },
                { id: 'cat3', name: 'Herbal Powders', color: 'border-tertiary', icon: 'medication', iconBg: 'bg-tertiary-fixed' },
              ];
              const sampleProducts = [
                { id: 'p1', name: 'Ashwagandha', scientificName: 'Withania somnifera', categoryId: 'cat2', sellingPrice: 450, purchasePrice: 380, stock: 25, unit: 'pieces', lowStockAlert: 5, profit: 70, pct: 25 },
                { id: 'p2', name: 'Camphor Table', scientificName: 'Cinnamomum camphora', categoryId: 'cat1', sellingPrice: 85, purchasePrice: 60, stock: 100, unit: 'pieces', lowStockAlert: 10, profit: 25, pct: 100 },
                { id: 'p3', name: 'Triphala Powder', scientificName: 'Emblica officinalis', categoryId: 'cat3', sellingPrice: 220, purchasePrice: 180, stock: 15, unit: 'pieces', lowStockAlert: 5, profit: 40, pct: 15 },
                { id: 'p4', name: 'Sandalwood Sticks', scientificName: 'Santalum album', categoryId: 'cat1', sellingPrice: 650, purchasePrice: 500, stock: 8, unit: 'pieces', lowStockAlert: 3, profit: 150, pct: 8 },
              ];
              localStorage.setItem('categories', JSON.stringify(sampleCategories));
              localStorage.setItem('products', JSON.stringify(sampleProducts));
              alert('Sample data added! You can now test the billing system.');
              window.location.href = '/dashboard';
            }}
            className="w-full flex items-center justify-center gap-3 bg-tertiary text-on-tertiary h-16 rounded-xl font-headline font-bold text-lg shadow-lg active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">database</span>
            Seed Sample Data
          </button>
          
          <button 
            onClick={() => {
              if (window.confirm('Clear all local storage data? This cannot be undone.')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="w-full text-error font-bold text-sm uppercase tracking-widest pt-2"
          >
            Reset All Application Data
          </button>
        </div>
        
        <div className="pt-8 text-center text-on-surface-variant opacity-40">
          <p className="text-sm font-bold uppercase tracking-widest">App version 2.4.0</p>
          <p className="text-xs font-medium mt-1">Made with ❤️ for Indian Sellers</p>
        </div>
      </section>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-on-surface text-surface px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300 z-[100]">
          <span className="material-symbols-outlined text-primary-fixed">check_circle</span>
          ✓ Logo saved
        </div>
      )}
    </main>
  );
}
