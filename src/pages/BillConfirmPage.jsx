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
  const { items, subtotal, gst, total, gstEnabled, billLanguage } = location.state || { items: [], subtotal: 0, gst: 0, total: 0, gstEnabled: false, billLanguage: 'en' };

  // Helper for billing language strings
  const bt = (key) => translations[billLanguage]?.[key] || translations['en'][key];

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isUdhar, setIsUdhar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [billNumber, setBillNumber] = useState(null);
  const [showPrintSelector, setShowPrintSelector] = useState(false);
  const [printFormat, setPrintFormat] = useState(null);
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
          const itemProfit = (Number(item.price) - Number(item.purchasePrice || 0)) * item.quantity;
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
            totalPurchasePrice += (Number(p.purchasePrice || 0) * billItem.quantity);
            return { ...p, stock: Math.max(0, Number(p.stock) - billItem.quantity) };
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

      setBillNumber(nextNumber);
      setLoading(false);
      setIsSuccess(true);
    } catch (err) {
      console.error('Billing failed:', err);
      alert('Failed to generate bill. Please try again.');
      setLoading(false);
    }
  };

  const handlePrint = (format) => {
    setPrintFormat(format);
    setShowPrintSelector(false);
    // Short delay to allow state update and re-render before print dialog
    setTimeout(() => {
      window.print();
    }, 100);
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

    const gstRowHtml = (gstEnabled && freshGstNumber) ? `<p style="margin:0;font-size:11px;color:#333;">GST No: ${freshGstNumber}</p>` : '';
    const gstAmountHtml = gstEnabled ? `
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
        <span>GST (18%):</span><span>&#8377;${gst.toLocaleString()}</span>
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
        <div style="font-size:12px;margin-bottom:12px;">${bt('customer_name')}: ${customerName || bt('guest')}</div>

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
        </div>

        <div className="flex flex-col gap-4 pt-4">
          <button 
            onClick={() => setShowPrintSelector(true)}
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

        {/* Print Format Selector Modal */}
        {showPrintSelector && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-surface w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-headline text-2xl font-bold">Print Format</h3>
                <button onClick={() => setShowPrintSelector(false)} className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center active:scale-90">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <div className="space-y-4">
                <button 
                  onClick={() => handlePrint('A4')}
                  className="w-full p-6 bg-surface-container-lowest rounded-2xl border-2 border-outline-variant hover:border-primary hover:bg-primary/5 transition-all text-left flex items-center gap-6 group"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                    <span className="material-symbols-outlined text-3xl">description</span>
                  </div>
                  <div>
                    <span className="block font-headline text-xl font-bold">A4 Printer</span>
                    <span className="text-sm text-on-surface-variant font-medium">Full page professional bill</span>
                  </div>
                </button>

                <button 
                  onClick={() => handlePrint('thermal')}
                  className="w-full p-6 bg-surface-container-lowest rounded-2xl border-2 border-outline-variant hover:border-secondary hover:bg-secondary/5 transition-all text-left flex items-center gap-6 group"
                >
                  <div className="w-14 h-14 bg-secondary/10 rounded-full flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-white transition-all">
                    <span className="material-symbols-outlined text-3xl">receipt</span>
                  </div>
                  <div>
                    <span className="block font-headline text-xl font-bold">Thermal</span>
                    <span className="text-sm text-on-surface-variant font-medium">Small receipt machine</span>
                  </div>
                </button>
              </div>

              <button 
                onClick={() => setShowPrintSelector(false)}
                className="w-full mt-6 py-4 text-on-surface-variant font-bold uppercase tracking-widest text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* --- DUAL PRINT FORMATS (Rendered via Portal for isolation) --- */}
        {isSuccess && createPortal(
          <div id="print-bill-content" className="hidden print:block">
            {/* PROFESSIONAL A4 FORMAT */}
            {printFormat === 'A4' && (
              <div className="bill-a4">
                {shopData.logo && <img src={shopData.logo} alt="Logo" className="logo" />}
                <div className="shop-header">
                  <div className="shop-name">{shopData.name}</div>
                  <div className="shop-info">
                    <p>{shopData.address}</p>
                    <p>Phone: {shopData.phone}</p>
                    {gstEnabled && shopData.gstNumber && <p>GST: {shopData.gstNumber}</p>}
                  </div>
                </div>
                
                <div className="divider"></div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <div>{bt('bill_number')}: #{billNumber}</div>
                  <div>{bt('date').toUpperCase()}: {new Date().toLocaleDateString('en-GB')}</div>
                </div>
                <div>{bt('time').toUpperCase()}: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div>{bt('customer_name')}: {customerName || bt('guest')}</div>

                <div className="divider"></div>

                <table className="items-table">
                  <thead>
                    <tr>
                      <th>{bt('item_description')}</th>
                      <th style={{ textAlign: 'center' }}>{bt('qty_short') || bt('qty')}</th>
                      <th style={{ textAlign: 'right' }}>{bt('rate')}</th>
                      <th style={{ textAlign: 'right' }}>{bt('amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                          {item.scientificName && <div style={{ fontSize: '10px', fontStyle: 'italic', opacity: 0.8 }}>{item.scientificName}</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}>{item.billingQty} {item.billingUnit || item.unit || ''}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.sellingPrice}/{item.unit || ''}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="total-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span> 
                    <span>₹{subtotal.toLocaleString()}</span>
                  </div>
                  {gstEnabled && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>GST (18%):</span> 
                      <span>₹{gst.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="divider" style={{ margin: '8px 0' }}></div>
                  <div className="total-row">
                    <span>{bt('total_amount').toUpperCase()}:</span> 
                    <span>₹{total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="divider"></div>
                
                <div style={{ textAlign: 'center', fontWeight: '800', fontStyle: 'italic', marginTop: '20px' }}>
                  <p>{bt('visit_again')}</p>
                  <p style={{ fontSize: '9px', marginTop: '8px', opacity: 0.5, fontWeight: 'normal' }}>Powered by ShopSaathi PWA</p>
                </div>
              </div>
            )}

            {/* THERMAL RECEIPT FORMAT */}
            {printFormat === 'thermal' && (
              <div className="bill-thermal">
                {shopData.logo && <img src={shopData.logo} alt="Logo" className="logo" />}
                <div className="shop-name">{shopData.name}</div>
                <div className="shop-info">
                  <p>{shopData.address}</p>
                  <p>Ph: {shopData.phone}</p>
                  {gstEnabled && shopData.gstNumber && <p>GST: {shopData.gstNumber}</p>}
                </div>

                <div className="thermal-divider"></div>
                <div style={{ fontSize: '11px', textAlign: 'left' }}>
                  <p>{bt('bill_number')}: #{billNumber}</p>
                  <p>{bt('date')}: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="thermal-divider"></div>

                <div style={{ textAlign: 'left' }}>
                  {items.map((item, idx) => (
                    <div key={idx} className="item-row">
                      <div style={{ fontWeight: 'bold' }}>{item.name.toUpperCase()}</div>
                      <div className="item-detail">
                        <span>{item.billingQty} {item.billingUnit || item.unit || ''} x ₹{item.sellingPrice}/{item.unit || ''}</span>
                        <span>₹{item.price}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="thermal-divider"></div>
                <div style={{ textAlign: 'right', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span> 
                    <span>₹{subtotal.toLocaleString()}.00</span>
                  </div>
                  {gstEnabled && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>GST(18%):</span> 
                      <span>₹{gst.toLocaleString()}.00</span>
                    </div>
                  )}
                </div>

                <div className="thermal-total">
                  TOTAL: ₹{total.toLocaleString()}
                </div>

                <div className="footer">
                  <p>THANK YOU! VISIT AGAIN! 🙏</p>
                  <p style={{ fontSize: '9px', marginTop: '5px', fontWeight: 'normal' }}>Powered by ShopSaathi</p>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
      </main>
    );
  }

  return (
    <main className="max-w-[450px] mx-auto px-6 pt-6 space-y-10 safe-bottom-padding page-transition-enter">
      {/* Top App Bar with Back Button */}
      <header className="flex items-center justify-between py-2">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-high hover:bg-surface-container-highest transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <h1 className="font-headline font-extrabold text-2xl tracking-tight text-primary">ShopSaathi</h1>
        <div className="w-10"></div>
      </header>

      {/* Page Title */}
      <div className="space-y-1 px-2 animate-in slide-in-from-top-4 duration-300">
        <h2 className="font-headline font-bold text-3xl tracking-tight text-on-surface">{t('confirm_details')}</h2>
        <p className="text-on-surface-variant font-body text-base">Enter customer information to finalize</p>
      </div>

      {/* Summary Recap */}
      <section className="bg-surface-container-highest/20 rounded-2xl p-6 border border-outline-variant/30 animate-in fade-in duration-300">
        <div className="flex justify-between items-center mb-4">
          <span className="font-bold text-on-surface">Items added</span>
          <span className="bg-primary text-white px-3 py-1 rounded-full text-xs font-black">{items.length}</span>
        </div>
        <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-none">
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-sm items-center">
              <span className="text-on-surface-variant font-medium">
                {item.name} <span className="text-[10px] opacity-70">({item.billingQty} {item.billingUnit || item.unit})</span>
              </span>
              <span className="font-bold">₹{item.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-outline-variant/30 mt-4 pt-4 flex justify-between items-center bg-surface p-4 rounded-xl">
           <span className="text-on-surface-variant font-bold uppercase tracking-widest text-xs">Final Total</span>
           <span className="font-headline text-2xl font-black text-primary">₹{total.toLocaleString()}</span>
        </div>
      </section>

      {/* Customer Information Form */}
      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-8 bg-secondary rounded-full"></div>
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-secondary">{t('customer_info') || 'Customer Info'}</h3>
        </div>
        
        <div className="bg-surface-container-low rounded-lg p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-widest text-on-surface-variant px-2">{t('customer_name')}</label>
            <div className="bg-surface-container-high rounded-lg p-5 flex items-center gap-3 focus-within:ring-2 focus-within:ring-secondary transition-all">
              <span className="material-symbols-outlined text-outline">person</span>
              <input 
                className="bg-transparent border-none w-full text-xl font-semibold focus:ring-0 p-0 text-on-surface" 
                placeholder="E.g., Anil Kumar" 
                type="text" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-widest text-on-surface-variant px-2">{t('phone_number')}</label>
            <div className="bg-surface-container-high rounded-lg p-5 flex items-center gap-3 focus-within:ring-2 focus-within:ring-secondary transition-all">
              <span className="material-symbols-outlined text-outline">call</span>
              <input 
                className="bg-transparent border-none w-full text-xl font-semibold focus:ring-0 p-0 text-on-surface" 
                placeholder="98765 43210" 
                type="tel" 
                maxLength="10"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Udhar Toggle */}
      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 delay-75">
        <div className="bg-surface-container-low rounded-lg p-6">
          <div 
            className="flex items-center justify-between bg-surface-container-lowest p-6 rounded-lg cursor-pointer transition-all active:scale-[0.98]" 
            onClick={() => setIsUdhar(!isUdhar)}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isUdhar ? 'bg-error-container text-error scale-110' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-2xl">menu_book</span>
              </div>
              <div>
                <span className="text-xl font-bold block">{t('add_to_udhar')}</span>
                <span className="text-sm text-on-surface-variant font-medium">{t('customer_debt')}</span>
              </div>
            </div>
            <button 
              className={`w-16 h-8 rounded-full relative p-1 transition-colors duration-300 ${isUdhar ? 'bg-error' : 'bg-surface-container-highest'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${isUdhar ? 'translate-x-8' : 'translate-x-0'}`}></div>
            </button>
          </div>
        </div>
      </section>

      {/* Generate Bill Button */}
      <div className="fixed-action-footer bg-surface/95 backdrop-blur-md px-6 py-6 border-t border-outline-variant shadow-[0_-12px_32px_rgba(0,0,0,0.08)] rounded-t-[2.5rem]">
        <button 
          onClick={handleConfirm}
          disabled={loading}
          className="signature-gradient w-full h-16 rounded-full flex items-center justify-center gap-3 text-white font-headline text-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <span className="material-symbols-outlined filled-icon">receipt_long</span>
              {t('generate_bill')}
            </>
          )}
        </button>
      </div>
    </main>
  );
}
