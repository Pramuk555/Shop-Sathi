import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import * as dbService from '../services/db';
import { translations } from '../translations';

export default function BillConfirmPage() {

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const { items, subtotal, gst, cgst, sgst, gstRate, total, gstEnabled, billLanguage } = location.state || { items: [], subtotal: 0, gst: 0, cgst: 0, sgst: 0, gstRate: 18, total: 0, gstEnabled: false, billLanguage: 'en' };

  // Helper for billing language strings
  const bt = (key) => translations[billLanguage]?.[key] || translations['en'][key];

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'upi' | 'card' | 'udhar'
  const isUdhar = paymentMode === 'udhar';
  const [savedCustomers, setSavedCustomers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('savedCustomers') || '[]'); } catch { return []; }
  });
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [billNumber, setBillNumber] = useState(null);
  const [sharing, setSharing] = useState(null); // 'loading', 'done', or null

  // Shop Details for Print
  const [shopData, setShopData] = useState(() => {
    const defaultData = {
      name: 'ShopSaathi Store',
      address: 'Main Road, City - 123456',
      phone: '9876543210',
      logo: '',
      gstNumber: '',
      upiId: ''
    };
    if (!currentUser || currentUser.demo) {
      return {
        name: localStorage.getItem('shopName') || defaultData.name,
        address: localStorage.getItem('shopAddress') || defaultData.address,
        phone: localStorage.getItem('shopPhone') || defaultData.phone,
        logo: localStorage.getItem('shopLogo') || defaultData.logo,
        gstNumber: localStorage.getItem('gstNumber') || defaultData.gstNumber,
        upiId: localStorage.getItem('upiId') || defaultData.upiId
      };
    }
    return defaultData;
  });

  useEffect(() => {
    if (!currentUser || currentUser.demo) {
      return;
    }

    const unsub = dbService.getShopProfile(currentUser.uid, (data) => {
      if (data) {
        setShopData({
          name: data.shopName || 'ShopSaathi Store',
          address: data.shopAddress || 'Main Road, City - 123456',
          phone: data.shopPhone || '9876543210',
          logo: data.shopLogo || '',
          gstNumber: data.gstNumber || '',
          upiId: data.upiId || ''
        });
      }
    });

    return () => unsub();
  }, [currentUser]);

  const handleConfirm = async () => {
    if (items.length === 0) return;
    setLoading(true);

    const isRealUser = currentUser && !currentUser.demo;
    let nextNumber;
    let profit = 0;

    try {
      if (isRealUser) {
        // --- REAL SUPABASE MODE ---
        // 1. Get and increment bill number
        nextNumber = await dbService.getNextBillNumber(currentUser.uid);
        await dbService.incrementBillNumber(currentUser.uid);
        
        // 2. Prepare bill and update stock
        for (const item of items) {
          const qty = item.billingQty || 1;
          const itemProfit = Number(item.price) - (Number(item.purchasePrice || 0) * qty);
          profit += itemProfit;

          if (item.id) {
            const deduction = (item.billingUnit === 'g' || item.billingUnit === 'ml')
              ? item.billingQty / 1000
              : item.billingQty;
            await dbService.updateProduct(currentUser.uid, item.id, {
              stock: Math.max(0, Number(item.stock) - deduction)
            });
          }
        }

        const newBill = {
          billNumber: nextNumber,
          customerName,
          customerPhone,
          paymentMode,
          isUdhar,
          items,
          subtotal,
          gst,
          total,
          profit,
          date: new Date().toISOString()
        };

        // 3. Save Bill
        await dbService.addBill(currentUser.uid, newBill);

        // 4. Handle Udhar
        if (isUdhar) {
          await dbService.addUdhar(currentUser.uid, {
            type: 'receive',
            name: customerName || `Walk-in Guest (#${nextNumber})`,
            phone: customerPhone,
            amount: total,
            paidAmount: 0,
            remainingAmount: total,
            description: `Bill #${nextNumber} - ${items.length} items`,
            date: new Date().toLocaleDateString('en-GB'),
            status: 'pending',
            payments: []
          });
        }
      } else {
        // --- DEMO / LOCALSTORAGE MODE ---
        const products = JSON.parse(localStorage.getItem('products') || '[]');
        let totalPurchasePrice = 0;

        const updatedProducts = products.map(p => {
          const billItem = items.find(item => item.id === p.id);
          if (billItem) {
            const qty = billItem.billingQty || 1;
            const deduction = (billItem.billingUnit === 'g' || billItem.billingUnit === 'ml') ? qty / 1000 : qty;
            totalPurchasePrice += (Number(p.purchasePrice || 0) * qty);
            return { ...p, stock: Math.max(0, Number(p.stock) - deduction) };
          }
          return p;
        });
        localStorage.setItem('products', JSON.stringify(updatedProducts));

        const lastNumberLocal = Number(localStorage.getItem('lastBillNumber') || 1000);
        nextNumber = lastNumberLocal + 1;
        localStorage.setItem('lastBillNumber', nextNumber.toString());

        const newBill = {
          id: Date.now(),
          billNumber: nextNumber,
          customerName,
          customerPhone,
          paymentMode,
          isUdhar,
          items,
          subtotal,
          gst,
          total,
          profit: subtotal - totalPurchasePrice,
          date: new Date().toISOString()
        };
        const bills = JSON.parse(localStorage.getItem('bills') || '[]');
        localStorage.setItem('bills', JSON.stringify([newBill, ...bills]));

        if (isUdhar) {
          const udharList = JSON.parse(localStorage.getItem('udharList') || '[]');
          const newUdharEntry = {
            id: Date.now() + 1,
            type: 'receive',
            name: customerName || `Walk-in Guest (#${nextNumber})`,
            phone: customerPhone,
            amount: total,
            paidAmount: 0,
            remainingAmount: total,
            description: `Bill #${nextNumber} - ${items.length} items`,
            date: new Date().toLocaleDateString('en-GB'),
            status: 'pending',
            payments: []
          };
          localStorage.setItem('udharList', JSON.stringify([newUdharEntry, ...udharList]));
        }

        // Legacy direct stat updates (for demo)
        const curSales = Number(localStorage.getItem('todaySales') || 0);
        const curProfit = Number(localStorage.getItem('todayProfit') || 0);
        const curBills = Number(localStorage.getItem('todayBills') || 0);
        localStorage.setItem('todaySales', (curSales + total).toString());
        localStorage.setItem('todayProfit', (curProfit + (subtotal - totalPurchasePrice)).toString());
        localStorage.setItem('todayBills', (curBills + 1).toString());
      }

      // Save customer for future autocomplete
      if (customerName.trim()) {
        const existing = JSON.parse(localStorage.getItem('savedCustomers') || '[]');
        const alreadyExists = existing.some(c => c.name.toLowerCase() === customerName.trim().toLowerCase());
        if (!alreadyExists) {
          const updated = [{ name: customerName.trim(), phone: customerPhone }, ...existing].slice(0, 100);
          localStorage.setItem('savedCustomers', JSON.stringify(updated));
          setSavedCustomers(updated);
        } else if (customerPhone) {
          const updated = existing.map(c =>
            c.name.toLowerCase() === customerName.trim().toLowerCase() ? { ...c, phone: customerPhone } : c
          );
          localStorage.setItem('savedCustomers', JSON.stringify(updated));
          setSavedCustomers(updated);
        }
      }

      setBillNumber(nextNumber);
      setLoading(false);
      setIsSuccess(true);
    } catch (err) {
      console.error('Billing failed:', err);
      alert('Failed to generate bill. Please try again.');
      setLoading(false);
    }
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 100);
  };

  const saveAndShare = async () => {
    setSharing('loading');

    // Use shopData state (loaded from Supabase for real users, localStorage for demo)
    const freshShopName = shopData.name || 'My Shop';
    const freshShopAddress = shopData.address || '';
    const freshShopPhone = shopData.phone || '';
    const freshShopLogo = shopData.logo || '';
    const freshGstNumber = shopData.gstNumber || '';

    // Build item rows HTML
    const calcItemTotal = (item) => Number(item.price) || 0;

    const itemRowsHtml = items.map(item => `
      <tr>
        <td style="padding:8px 4px;vertical-align:top;border-bottom:1px solid #eee;">
          <div style="font-weight:700;font-size:13px;">${item.name}</div>
          ${item.scientificName ? `<div style="font-size:10px;font-style:italic;color:#666;">${item.scientificName}</div>` : ''}
        </td>
        <td style="padding:8px 4px;text-align:center;vertical-align:top;border-bottom:1px solid #eee;">${item.billingQty} ${item.billingUnit || item.unit || ''}</td>
        <td style="padding:8px 4px;text-align:right;vertical-align:top;border-bottom:1px solid #eee;">&#8377;${item.sellingPrice}/${item.unit || ''}</td>
        <td style="padding:8px 4px;text-align:right;vertical-align:top;border-bottom:1px solid #eee;font-weight:700;">&#8377;${calcItemTotal(item)}</td>
      </tr>
    `).join('');

    const logoHtml = freshShopLogo ? `
      <img src="${freshShopLogo}" alt="Logo"
        style="width:72px;height:72px;object-fit:contain;filter:grayscale(100%);" />
    ` : '';

    const gstRowHtml = (gstEnabled && freshGstNumber) ? `<p style="margin:0;font-size:11px;color:#333;">GSTIN: ${freshGstNumber}</p>` : '';
    const gstAmountHtml = gstEnabled ? `
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
        <span>CGST (${gstRate / 2}%):</span><span>&#8377;${cgst.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span>SGST (${gstRate / 2}%):</span><span>&#8377;${sgst.toLocaleString()}</span>
      </div>
    ` : '';

    const billHtml = `
      <div style="
        width:560px;
        font-family:Arial,sans-serif;
        font-size:13px;
        color:#000;
        background:#fff;
        padding:32px 36px;
        box-sizing:border-box;
        line-height:1.5;
      ">
        <!-- HEADER: Logo + Shop Info side by side -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div style="flex:1;">
            <div style="font-size:24px;font-weight:900;color:#000;line-height:1.1;margin-bottom:4px;">${freshShopName}</div>
            <p style="margin:0;font-size:11px;color:#333;">${freshShopAddress}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#333;">Ph: ${freshShopPhone}</p>
            ${gstRowHtml}
          </div>
          ${logoHtml ? `<div style="margin-left:16px;flex-shrink:0;">${logoHtml}</div>` : ''}
        </div>

        <!-- DIVIDER -->
        <div style="border-top:1.5px dashed #000;margin:12px 0;"></div>

        <!-- BILL META -->
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;margin-bottom:4px;">
          <span>${bt('bill_number')}: #${billNumber}</span>
          <span>${bt('date').toUpperCase()}: ${new Date().toLocaleDateString('en-GB')}</span>
        </div>
        <div style="font-size:12px;margin-bottom:2px;">${bt('time').toUpperCase()}: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        <div style="font-size:12px;margin-bottom:2px;">${bt('customer_name')}: ${customerName || bt('guest')}</div>
        <div style="font-size:12px;margin-bottom:12px;font-weight:700;color:${paymentMode === 'udhar' ? '#c0392b' : '#1a5c0a'};">Payment: ${paymentMode.toUpperCase()}</div>

        <!-- DIVIDER -->
        <div style="border-top:1.5px dashed #000;margin:12px 0;"></div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
          <thead>
            <tr style="border-bottom:2px solid #000;">
              <th style="padding:6px 4px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:800;">${bt('item_description')}</th>
              <th style="padding:6px 4px;text-align:center;font-size:11px;text-transform:uppercase;font-weight:800;">${bt('qty_short') || bt('qty')}</th>
              <th style="padding:6px 4px;text-align:right;font-size:11px;text-transform:uppercase;font-weight:800;">${bt('rate')}</th>
              <th style="padding:6px 4px;text-align:right;font-size:11px;text-transform:uppercase;font-weight:800;">${bt('amount')}</th>
            </tr>
          </thead>
          <tbody>${itemRowsHtml}</tbody>
        </table>

        <!-- TOTALS -->
        <div style="border-top:1.5px solid #000;padding-top:8px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
            <span>${bt('subtotal')}:</span><span>&#8377;${subtotal.toLocaleString()}</span>
          </div>
          ${gstAmountHtml}
          <div style="border-top:1.5px solid #000;margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;font-size:22px;font-weight:900;margin-top:4px;">
            <span>${bt('total_amount')}:</span><span>&#8377;${total.toLocaleString()}</span>
          </div>
        </div>

        <!-- DIVIDER -->
        <div style="border-top:1.5px dashed #000;margin:16px 0;"></div>

        <!-- FOOTER -->
        <div style="text-align:center;font-weight:800;font-style:italic;margin-top:8px;">
          <p style="margin:0;">${bt('visit_again')}</p>
          <p style="font-size:9px;margin-top:8px;opacity:0.5;font-weight:400;font-style:normal;">Powered by ShopSaathi PWA</p>
        </div>
      </div>
    `;

    // Create and attach off-screen element
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:-9999px;left:0;z-index:-1;background:#fff;';
    wrapper.innerHTML = billHtml;
    document.body.appendChild(wrapper);
    const captureTarget = wrapper.firstElementChild;

    // Wait for images to load (logo)
    await new Promise(r => setTimeout(r, 400));

    try {
      const canvas = await html2canvas(captureTarget, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 560,
        windowWidth: 560,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      // A4: 210mm × 297mm. Content width 560px → scale to fit A4.
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = 210;
      const pdfHeight = (canvas.height / canvas.width) * pdfWidth;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      const filename = `ShopSaathi-Bill-${billNumber}.pdf`;

      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      const openWhatsApp = (text) => {
        const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        const a = document.createElement('a');
        a.href = waUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      const billSummary = `Bill #${billNumber} from ${freshShopName}\nCustomer: ${customerName || 'Guest'}\nTotal: ₹${total}`;

      const canShareFiles = navigator.share && navigator.canShare && navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({ files: [file], title: `Bill from ${freshShopName}` });
        } catch (err) {
          if (err?.name !== 'AbortError') {
            pdf.save(filename);
            openWhatsApp(billSummary);
          }
        }
      } else {
        pdf.save(filename);
        openWhatsApp(billSummary + '\n\nPlease find the attached PDF bill.');
      }

    } catch (error) {
      console.error('Sharing failed:', error);
      alert('Could not generate PDF. Please try again.');
    } finally {
      if (wrapper && wrapper.parentNode) document.body.removeChild(wrapper);
      setSharing('done');
      setTimeout(() => setSharing(null), 2000);
    }
  };

  if (isSuccess) {
    return (
      <main className="max-w-[450px] mx-auto px-6 pt-12 text-center space-y-8 safe-bottom-padding animate-in zoom-in-95 duration-300 print-hidden">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center shadow-xl shadow-primary/20 animate-success-bounce">
            <span className="material-symbols-outlined text-white text-6xl font-black">check</span>
          </div>
          <h2 className="font-headline text-4xl font-black text-on-surface">{t('bill_generated')}</h2>
          <p className="text-on-surface-variant font-medium">Shared successfully with {customerName || t('customer')}</p>
        </div>

        <div className="bg-surface-container-low rounded-3xl p-8 space-y-4">
          <p className="text-sm font-bold uppercase tracking-widest text-outline">Total Amount</p>
          <p className="font-headline text-5xl font-black text-primary">₹{total.toLocaleString()}</p>
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-on-surface-variant">
            <span className="material-symbols-outlined text-base">
              {paymentMode === 'cash' ? 'payments' : paymentMode === 'upi' ? 'qr_code_scanner' : paymentMode === 'card' ? 'credit_card' : 'menu_book'}
            </span>
            <span className="capitalize">{t(paymentMode) || paymentMode}</span>
          </div>
          {paymentMode === 'upi' && shopData.upiId && (
            <div className="mt-2 bg-white rounded-2xl p-4 border border-outline-variant/30">
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-2">Pay via UPI</p>
              <p className="font-mono font-bold text-primary text-base break-all">{shopData.upiId}</p>
              <p className="text-xs text-on-surface-variant mt-1">Ask customer to scan or enter this UPI ID</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 pt-4">
          <button
            onClick={handlePrint}
            className="h-16 bg-surface-container-highest rounded-full flex items-center justify-center gap-3 font-headline text-xl font-black text-on-surface active:scale-95 transition-all shadow-md"
          >
            <span className="material-symbols-outlined">print</span>
            {t('print_bill')}
          </button>

          <button 
            onClick={saveAndShare}
            disabled={sharing === 'loading'}
            className={`h-16 rounded-full flex items-center justify-center gap-3 font-headline text-xl font-black transition-all shadow-md active:scale-95 ${
              sharing === 'done' ? 'bg-green-500 text-white' : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            {sharing === 'loading' ? (
              <>
                <div className="w-5 h-5 border-2 border-on-secondary-container/30 border-t-on-secondary-container rounded-full animate-spin"></div>
                <span>⏳ {t('preparing')}</span>
              </>
            ) : sharing === 'done' ? (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                <span>✅ {t('bill_ready')}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">share</span>
                <span>📄 {t('save_share')}</span>
              </>
            )}
          </button>
          <button 
            onClick={() => navigate('/new-bill')}
            className="h-16 signature-gradient text-white rounded-full flex items-center justify-center gap-3 font-headline text-xl font-black shadow-lg shadow-primary/30 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">add</span>
            {t('bill')}
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-on-surface-variant font-bold text-sm tracking-widest uppercase hover:text-primary transition-colors"
          >
             {t('home')}
          </button>
        </div>

        {/* THERMAL RECEIPT — rendered in portal, shown only on print */}
        {isSuccess && createPortal(
          <div id="print-bill-content" className="hidden print:block">
            <div className="bill-thermal">
              {shopData.logo && <img src={shopData.logo} alt="Logo" className="logo" />}
              <div className="shop-name">{shopData.name}</div>
              <div className="shop-info">
                <p>{shopData.address}</p>
                <p>Ph: {shopData.phone}</p>
                {shopData.phone && <p>WhatsApp: {shopData.phone}</p>}
                {gstEnabled && shopData.gstNumber && <p>GSTIN: {shopData.gstNumber}</p>}
              </div>

              <div className="thermal-divider"></div>
              <div style={{ fontSize: '11px', textAlign: 'left' }}>
                <p style={{ fontWeight: 'bold' }}>{bt('bill_number')}: #{billNumber}</p>
                <p>{bt('date')}: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p>{bt('customer_name')}: {customerName || bt('guest')}</p>
                {customerPhone && <p>Ph: {customerPhone}</p>}
              </div>
              <div className="thermal-divider"></div>
              <div style={{ fontSize: '11px', textAlign: 'left', fontWeight: 'bold', color: paymentMode === 'udhar' ? '#c0392b' : '#000' }}>
                Paid by: {paymentMode.toUpperCase()}
              </div>
              <div className="thermal-divider"></div>

              <div style={{ textAlign: 'left' }}>
                {items.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{item.name.toUpperCase()}</div>
                    <div className="item-detail">
                      <span>{item.billingQty}{item.billingUnit || item.unit || ''} x ₹{item.sellingPrice}/{item.unit || ''}</span>
                      <span style={{ fontWeight: 'bold' }}>₹{item.price}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="thermal-divider"></div>
              <div style={{ fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                {gstEnabled && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>CGST ({gstRate / 2}%):</span>
                    <span>₹{cgst.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>SGST ({gstRate / 2}%):</span>
                    <span>₹{sgst.toLocaleString()}</span>
                  </div>
                </>}
              </div>

              <div className="thermal-total">
                TOTAL: ₹{total.toLocaleString()}
              </div>

              {shopData.upiId && (
                <div style={{ fontSize: '11px', textAlign: 'center', margin: '8px 0' }}>
                  <p style={{ fontWeight: 'bold' }}>Pay via UPI:</p>
                  <p style={{ fontFamily: 'monospace' }}>{shopData.upiId}</p>
                </div>
              )}

              <div className="footer">
                <p>{bt('visit_again')}</p>
                <p style={{ fontSize: '9px', marginTop: '5px', fontWeight: 'normal' }}>Powered by ShopSaathi</p>
              </div>
            </div>
          </div>,
          document.body
        )}
      </main>
    );
  }

  return (
    <main className="max-w-[450px] mx-auto px-4 pt-4 pb-28 space-y-4 page-transition-enter">
      {/* Header */}
      <header className="flex items-center justify-between py-1">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-high hover:bg-surface-container-highest transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined text-on-surface text-xl">arrow_back</span>
        </button>
        <h1 className="font-headline font-extrabold text-xl tracking-tight text-primary">{t('confirm_details')}</h1>
        <div className="w-9" />
      </header>

      {/* Items summary */}
      <section className="bg-surface-container-low rounded-2xl p-3 animate-in fade-in duration-300">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Items ({items.length})</span>
          <span className="font-headline text-xl font-black text-primary">₹{total.toLocaleString()}</span>
        </div>
        <div className="space-y-1.5 max-h-28 overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-sm items-center">
              <span className="text-on-surface-variant font-medium truncate max-w-[65%]">
                {item.name} <span className="text-[10px] opacity-60">× {item.billingQty}{item.billingUnit || item.unit}</span>
              </span>
              <span className="font-bold text-on-surface">₹{item.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
        {gstEnabled && (
          <div className="border-t border-outline-variant/20 mt-2 pt-2 space-y-0.5">
            <div className="flex justify-between text-xs text-secondary font-bold">
              <span>CGST ({gstRate / 2}%)</span><span>₹{cgst.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-secondary font-bold">
              <span>SGST ({gstRate / 2}%)</span><span>₹{sgst.toLocaleString()}</span>
            </div>
          </div>
        )}
      </section>

      {/* Payment Mode */}
      <section className="animate-in fade-in duration-300">
        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1 mb-2">{t('payment_mode') || 'Payment Mode'}</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { mode: 'cash', icon: 'payments', label: t('cash') },
            { mode: 'upi', icon: 'qr_code_scanner', label: t('upi') },
            { mode: 'card', icon: 'credit_card', label: t('card') || 'Card' },
            { mode: 'udhar', icon: 'menu_book', label: t('udhar') },
          ].map(({ mode, icon, label }) => {
            const isActive = paymentMode === mode;
            const isUdharMode = mode === 'udhar';
            return (
              <button
                key={mode}
                onClick={() => setPaymentMode(mode)}
                className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                  isActive
                    ? isUdharMode
                      ? 'border-error bg-error-container text-error'
                      : 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${isActive ? 'filled-icon' : ''}`}>{icon}</span>
                <span className="text-[11px] font-bold">{label}</span>
              </button>
            );
          })}
        </div>
        {paymentMode === 'udhar' && (
          <p className="text-xs text-error font-medium mt-2 px-1">Bill will be added to Udhar (credit) — amount to be collected later</p>
        )}
      </section>

      {/* Customer form */}
      <section className="space-y-2 animate-in fade-in duration-300">
        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">{t('customer_info') || 'Customer Info'} <span className="font-normal normal-case">(optional)</span></p>
        <div className="bg-surface-container-low rounded-2xl p-3 space-y-3">
          <div className="relative">
            <div className="bg-surface-container-high rounded-xl px-4 py-3 flex items-center gap-3 focus-within:ring-2 focus-within:ring-secondary transition-all">
              <span className="material-symbols-outlined text-outline text-xl">person</span>
              <input
                className="bg-transparent border-none w-full text-base font-semibold focus:ring-0 p-0 text-on-surface"
                placeholder={t('customer_name') + ' — e.g. Anil Kumar'}
                type="text"
                value={customerName}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerName(val);
                  if (val.trim().length > 0) {
                    const matches = savedCustomers.filter(c =>
                      c.name.toLowerCase().includes(val.toLowerCase())
                    ).slice(0, 4);
                    setCustomerSuggestions(matches);
                  } else {
                    setCustomerSuggestions([]);
                  }
                }}
                onBlur={() => setTimeout(() => setCustomerSuggestions([]), 200)}
              />
            </div>
            {customerSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-surface rounded-xl shadow-lg border border-outline-variant/30 mt-1 overflow-hidden">
                {customerSuggestions.map((c, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low active:bg-surface-container transition-colors"
                    onMouseDown={() => {
                      setCustomerName(c.name);
                      setCustomerPhone(c.phone || '');
                      setCustomerSuggestions([]);
                    }}
                  >
                    <span className="material-symbols-outlined text-sm text-outline">person</span>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{c.name}</p>
                      {c.phone && <p className="text-xs text-on-surface-variant">{c.phone}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="bg-surface-container-high rounded-xl px-4 py-3 flex items-center gap-3 focus-within:ring-2 focus-within:ring-secondary transition-all">
            <span className="material-symbols-outlined text-outline text-xl">call</span>
            <input
              className="bg-transparent border-none w-full text-base font-semibold focus:ring-0 p-0 text-on-surface"
              placeholder="Phone — 98765 43210"
              type="tel"
              maxLength="10"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
      </section>

      {/* Generate Bill Button */}
      <div className="fixed-action-footer bg-surface/95 backdrop-blur-md px-4 py-3 border-t border-outline-variant/30 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] rounded-t-2xl">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="signature-gradient w-full h-13 py-3 rounded-full flex items-center justify-center gap-2 text-white font-headline text-lg font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span className="material-symbols-outlined filled-icon text-xl">receipt_long</span>
              {t('generate_bill')}
            </>
          )}
        </button>
      </div>
    </main>
  );
}
