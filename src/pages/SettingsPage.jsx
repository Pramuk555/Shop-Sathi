import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import * as dbService from '../services/db';

export default function SettingsPage() {
  const { currentUser, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  
  const [shopLogo, setShopLogo] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return localStorage.getItem('shopLogo') || '';
    }
    return '';
  });
  const [shopName, setShopName] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return localStorage.getItem('shopName') || '';
    }
    return '';
  });
  const [shopAddress, setShopAddress] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return localStorage.getItem('shopAddress') || '';
    }
    return '';
  });
  const [shopPhone, setShopPhone] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return localStorage.getItem('shopPhone') || '';
    }
    return '';
  });
  const [gstNumber, setGstNumber] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return localStorage.getItem('gstNumber') || '';
    }
    return '';
  });
  const [upiId, setUpiId] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return localStorage.getItem('upiId') || '';
    }
    return '';
  });
  const [isGstEnabled, setIsGstEnabled] = useState(() => {
    if (!currentUser || currentUser.demo) {
      const savedGst = localStorage.getItem('gstEnabled');
      return savedGst ? JSON.parse(savedGst) : false;
    }
    return false;
  });
  const [gstRate, setGstRate] = useState(() => {
    if (!currentUser || currentUser.demo) {
      return Number(localStorage.getItem('gstRate') || 18);
    }
    return 18;
  });
  const [showToast, setShowToast] = useState(false);

  // Sync with Firestore
  useEffect(() => {
    if (!currentUser || currentUser.demo) {
      return;
    }

    const unsub = dbService.getShopProfile(currentUser.uid, (data) => {
      if (data) {
        setShopLogo(data.shopLogo || '');
        setShopName(data.shopName || '');
        setShopAddress(data.shopAddress || '');
        setShopPhone(data.shopPhone || '');
        setGstNumber(data.gstNumber || '');
        setUpiId(data.upiId || '');
        setIsGstEnabled(!!data.gstEnabled);
        if (data.gstRate !== undefined) setGstRate(Number(data.gstRate) || 18);
      }
    });

    return () => unsub();
  }, [currentUser]);

  const toggleGst = () => {
    const newValue = !isGstEnabled;
    setIsGstEnabled(newValue);
    if (currentUser && !currentUser.demo) {
      dbService.updateShopProfile(currentUser.uid, { gstEnabled: newValue });
    } else {
      localStorage.setItem('gstEnabled', JSON.stringify(newValue));
    }
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
        
        if (currentUser && !currentUser.demo) {
          dbService.updateShopProfile(currentUser.uid, { shopLogo: bwBase64 });
        } else {
          localStorage.setItem('shopLogo', bwBase64);
        }

        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setShopLogo('');
    if (currentUser && !currentUser.demo) {
      dbService.updateShopProfile(currentUser.uid, { shopLogo: '' });
    } else {
      localStorage.removeItem('shopLogo');
    }
  };

  const handleFieldChange = (key, value, setter) => {
    setter(value);
    if (currentUser && !currentUser.demo) {
      dbService.updateShopProfile(currentUser.uid, { [key]: value });
    } else {
      localStorage.setItem(key, value);
    }
  };

  return (
    <>
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
        <h2 className="font-headline font-bold text-3xl tracking-tight text-on-surface flex items-center gap-3">
          {t('settings')}
          <span className="material-symbols-outlined text-2xl text-primary animate-pulse-subtle">settings</span>
        </h2>
      </div>

      {/* Shop Profile Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-8 bg-primary rounded-full"></div>
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-primary">{t('shop_profile')}</h3>
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
                    <p className="text-[10px] font-bold leading-tight text-on-surface-variant uppercase tracking-tighter">{t('tap_to_upload') || 'Tap to upload logo'}</p>
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
              <p className="text-sm font-bold text-on-surface leading-tight">{t('receipt_logo') || 'Receipt Logo'}</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">{t('bw_conversion') || 'B&W Conversion'}</p>
            </div>
          </div>

          {/* Profile Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">{t('shop_name') || 'Shop Name'}</label>
              <div className="bg-surface-container-high rounded-2xl p-4 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm">
                <input 
                  className="bg-transparent border-0 outline-none focus:outline-none focus:ring-0 w-full text-lg font-semibold p-0 text-on-surface" 
                  type="text"
                  placeholder={t('shop_name_placeholder')} 
                  value={shopName}
                  onChange={(e) => handleFieldChange('shopName', e.target.value, setShopName)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">{t('shop_address') || 'Shop Address'}</label>
              <div className="bg-surface-container-high rounded-2xl p-4 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm">
                <input 
                  className="bg-transparent border-0 outline-none focus:outline-none focus:ring-0 w-full text-lg font-semibold p-0 text-on-surface" 
                  type="text" 
                  value={shopAddress}
                  placeholder={t('shop_address_placeholder')}
                  onChange={(e) => handleFieldChange('shopAddress', e.target.value, setShopAddress)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">{t('phone_number')}</label>
              <div className="bg-surface-container-high rounded-2xl p-4 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary transition-all shadow-sm">
                <input 
                  className="bg-transparent border-0 outline-none focus:outline-none focus:ring-0 w-full text-lg font-semibold p-0 text-on-surface" 
                  type="tel" 
                  placeholder={t('contact_placeholder')}
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
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-secondary">{t('billing_settings')}</h3>
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
                className="bg-transparent border-none outline-none focus:ring-0 w-full text-lg font-bold p-0 text-on-surface uppercase"
                placeholder="29XXXXX..."
                type="text"
                value={gstNumber}
                onChange={(e) => handleFieldChange('gstNumber', e.target.value.toUpperCase(), setGstNumber)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">GST Rate %</label>
            <p className="text-xs text-on-surface-variant px-2">CGST + SGST will each be half of this rate</p>
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 12, 18, 28].map(rate => (
                <button
                  key={rate}
                  onClick={() => handleFieldChange('gstRate', rate, setGstRate)}
                  className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-all ${gstRate === rate ? 'border-secondary bg-secondary text-white' : 'border-outline-variant bg-surface-container-high text-on-surface'}`}
                >{rate}%</button>
              ))}
            </div>
            <div className="bg-surface-container-high rounded-lg p-3 flex items-center gap-3 focus-within:ring-2 focus-within:ring-secondary transition-all mt-1">
              <span className="text-on-surface-variant font-bold text-sm">Custom %</span>
              <input
                className="bg-transparent border-none outline-none focus:ring-0 flex-1 text-lg font-bold p-0 text-on-surface [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                type="number"
                min="0"
                max="100"
                value={gstRate}
                onChange={(e) => handleFieldChange('gstRate', Number(e.target.value) || 0, setGstRate)}
              />
              <span className="text-on-surface-variant font-bold">%</span>
            </div>
            {isGstEnabled && gstRate > 0 && (
              <p className="text-xs text-secondary font-bold px-2">
                CGST {gstRate / 2}% + SGST {gstRate / 2}% = {gstRate}% total
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-2">Your UPI ID</label>
            <div className="bg-surface-container-high rounded-lg p-4 flex items-center gap-3 focus-within:ring-2 focus-within:ring-secondary transition-all">
              <span className="material-symbols-outlined text-secondary">qr_code_2</span>
              <input 
                className="bg-transparent border-none outline-none focus:ring-0 w-full text-lg font-bold p-0 text-on-surface" 
                placeholder={t('upi_placeholder')}
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
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-on-surface-variant">{t('preferences') || 'Preferences'}</h3>
        </div>
        
        <div className="space-y-4">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between bg-surface-container-low p-6 rounded-lg cursor-pointer" onClick={toggleTheme}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-surface-container-highest rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">
                  {isDarkMode ? 'dark_mode' : 'light_mode'}
                </span>
              </div>
              <span className="text-xl font-bold">Dark Mode</span>
            </div>
            <button 
              className={`w-16 h-8 rounded-full relative p-1 transition-colors ${isDarkMode ? 'bg-primary' : 'bg-surface-container-highest'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${isDarkMode ? 'translate-x-8' : 'translate-x-0'}`}></div>
            </button>
          </div>

          <div 
            onClick={() => setIsLangModalOpen(true)}
            className="w-full flex items-center justify-between bg-surface-container-low p-6 rounded-lg active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-surface-container-highest rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">language</span>
              </div>
              <span className="text-xl font-bold">{t('language')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium text-primary">
                {({'en':'English','hi':'हिन्दी','kn':'ಕನ್ನಡ','te':'తెలుగు','ta':'தமிழ்','ml':'മലയാളം','mr':'मराठी','gu':'ગુજરાતી'})[language] || 'English'}
              </span>
              <span className="material-symbols-outlined">chevron_right</span>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="w-full flex items-center justify-between bg-error-container p-6 rounded-lg active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-2xl text-error">logout</span>
              <span className="text-xl font-bold text-error">{t('logout')}</span>
            </div>
          </button>
        </div>
      </section>

      <div className="pt-8 text-center text-on-surface-variant opacity-40">
        <p className="text-sm font-bold uppercase tracking-widest">App version 2.4.0</p>
        <p className="text-xs font-medium mt-1">Made with ❤️ for Indian Sellers</p>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-on-surface text-surface px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300 z-[100]">
          <span className="material-symbols-outlined text-primary-fixed">check_circle</span>
          ✓ Logo saved
        </div>
      )}
      </main>

      {/* Language Selection Modal */}
      {isLangModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsLangModalOpen(false)}></div>
          <div className="relative bg-surface w-full max-w-sm rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-300 ring-1 ring-white/10">
            <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-8"></div>
            <h3 className="font-headline text-2xl font-bold mb-6 text-on-surface tracking-tight text-center">{t('language')}</h3>
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
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
                  onClick={() => {
                    setLanguage(lang.id);
                    setIsLangModalOpen(false);
                  }}
                  className={`w-full p-6 flex items-center justify-between rounded-2xl transition-all ${
                    language === lang.id 
                    ? 'bg-primary-container text-on-primary-container ring-2 ring-primary' 
                    : 'bg-surface-container hover:bg-surface-container-high'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-bold text-lg">{lang.name}</p>
                    <p className="text-xs opacity-60 uppercase tracking-widest font-black">{lang.sub}</p>
                  </div>
                  {language === lang.id && (
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                  )}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsLangModalOpen(false)}
              className="w-full mt-8 h-14 bg-surface-container-highest rounded-xl font-headline font-bold text-on-surface-variant active:scale-95 transition-transform"
            >
              {t('save')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
