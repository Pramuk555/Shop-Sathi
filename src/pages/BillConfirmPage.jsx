import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function BillConfirmPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, subtotal, gst, total, gstEnabled } = location.state || { items: [], subtotal: 0, gst: 0, total: 0, gstEnabled: false };

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isUdhar, setIsUdhar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [billId, setBillId] = useState(null);
  const [billNumber, setBillNumber] = useState(null);
  const [showPrintSelector, setShowPrintSelector] = useState(false);
  const [printFormat, setPrintFormat] = useState(null);
  const [sharing, setSharing] = useState(null); // 'loading', 'done', or null

  // Shop Details for Print
  const [shopData, setShopData] = useState({
    name: localStorage.getItem('shopName') || 'ShopSaathi Store',
    address: localStorage.getItem('shopAddress') || 'Main Road, City - 123456',
    phone: localStorage.getItem('shopPhone') || '9876543210',
    logo: localStorage.getItem('shopLogo') || '',
    gstNumber: localStorage.getItem('gstNumber') || '',
    upiId: localStorage.getItem('upiId') || ''
  });

  const handleConfirm = async () => {
    if (items.length === 0) return;
    setLoading(true);

    // 1. Deduct Stock from localStorage
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

    // 2. Save Bill with Auto-Incrementing Number
    const lastNumber = Number(localStorage.getItem('lastBillNumber') || 1000);
    const nextNumber = lastNumber + 1;
    localStorage.setItem('lastBillNumber', nextNumber.toString());
    setBillNumber(nextNumber);

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
      date: new Date().toISOString()
    };
    const bills = JSON.parse(localStorage.getItem('bills') || '[]');
    localStorage.setItem('bills', JSON.stringify([newBill, ...bills]));
    setBillId(newBill.id);

    // 3. Update Dashboard Stats
    const currentSales = Number(localStorage.getItem('todaySales') || 0);
    const currentProfit = Number(localStorage.getItem('todayProfit') || 0);
    const currentBills = Number(localStorage.getItem('todayBills') || 0);
    
    // Profit = Total (excluding GST) - Total Purchase Price
    const billProfit = subtotal - totalPurchasePrice;

    localStorage.setItem('todaySales', (currentSales + total).toString());
    localStorage.setItem('todayProfit', (currentProfit + billProfit).toString());
    localStorage.setItem('todayBills', (currentBills + 1).toString());

    // 4. Show Success
    await new Promise(resolve => setTimeout(resolve, 600));
    setLoading(false);
    setIsSuccess(true);
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
    
    // Force A4 format
    setPrintFormat('A4');
    
    // Wait for React to re-render
    await new Promise(r => setTimeout(r, 500));
    
    // Get the print portal element
    const element = document.getElementById('print-bill-content');
    
    if (!element) {
      alert('Bill not ready. Try again.');
      setSharing(null);
      return;
    }
    
    // Make it visible for capture
    element.style.position = 'fixed';
    element.style.top = '-9999px';
    element.style.left = '0';
    element.style.display = 'block';
    element.style.visibility = 'visible';
    element.style.width = '794px';
    element.style.backgroundColor = '#ffffff';
    element.style.zIndex = '-1';
    
    // Wait for styles to apply
    await new Promise(r => setTimeout(r, 300));
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      
      const filename = `ShopSaathi-Bill-${billNumber}.pdf`;
      
      if (navigator.share && navigator.canShare) {
        const pdfBlob = pdf.output('blob');
        const file = new File(
          [pdfBlob], 
          filename,
          { type: 'application/pdf' }
        );
        try {
          await navigator.share({
            files: [file],
            title: `Bill from ${shopData.name}`,
          });
        } catch(err) {
          pdf.save(filename);
        }
      } else {
        pdf.save(filename);
      }
      
    } catch (error) {
      console.error('Sharing failed:', error);
      alert('Could not generate PDF. Please try again.');
    } finally {
      // Always hide element again
      element.style.display = '';
      element.style.position = '';
      element.style.top = '';
      element.style.visibility = '';
      element.style.width = '';
      element.style.zIndex = '';
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
          <h2 className="font-headline text-4xl font-black text-on-surface">Bill Generated!</h2>
          <p className="text-on-surface-variant font-medium">Shared successfully with {customerName || 'Customer'}</p>
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
            Print Bill
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
                <span>⏳ Preparing...</span>
              </>
            ) : sharing === 'done' ? (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                <span>✅ Bill Ready</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">share</span>
                <span>📄 Save & Share Bill</span>
              </>
            )}
          </button>
          <button 
            onClick={() => navigate('/new-bill')}
            className="h-16 signature-gradient text-white rounded-full flex items-center justify-center gap-3 font-headline text-xl font-black shadow-lg shadow-primary/30 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">add</span>
            New Bill
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-on-surface-variant font-bold text-sm tracking-widest uppercase hover:text-primary transition-colors"
          >
             Back to Dashboard
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
                  <div>BILL NO: #{billNumber}</div>
                  <div>DATE: {new Date().toLocaleDateString('en-GB')}</div>
                </div>
                <div>TIME: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div>CUSTOMER: {customerName || 'Walk-in Guest'}</div>

                <div className="divider"></div>

                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Item Description</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                          {item.scientificName && <div style={{ fontSize: '10px', fontStyle: 'italic', opacity: 0.8 }}>{item.scientificName}</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}>{item.quantity} {item.unit || ''}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.price}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.price * item.quantity}</td>
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
                    <span>TOTAL:</span> 
                    <span>₹{total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="divider"></div>
                
                <div style={{ textAlign: 'center', fontWeight: '800', fontStyle: 'italic', marginTop: '20px' }}>
                  <p>Thank you! Visit Again! 🙏</p>
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
                  <p>Bill#: {billNumber}</p>
                  <p>Date: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="thermal-divider"></div>

                <div style={{ textAlign: 'left' }}>
                  {items.map((item, idx) => (
                    <div key={idx} className="item-row">
                      <div style={{ fontWeight: 'bold' }}>{item.name.toUpperCase()}</div>
                      <div className="item-detail">
                        <span>{item.quantity} {item.unit || ''} x {item.price}</span>
                        <span>₹{item.price * item.quantity}.00</span>
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
        <h2 className="font-headline font-bold text-3xl tracking-tight text-on-surface">Confirm Details</h2>
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
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-on-surface-variant">{item.name} × {item.quantity}</span>
              <span className="font-bold">₹{item.price * item.quantity}</span>
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
          <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-secondary">Customer Info</h3>
        </div>
        
        <div className="bg-surface-container-low rounded-lg p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-widest text-on-surface-variant px-2">Customer Name (Optional)</label>
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
            <label className="text-sm font-bold uppercase tracking-widest text-on-surface-variant px-2">Phone Number (Optional)</label>
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
                <span className="text-xl font-bold block">Add to Udhar</span>
                <span className="text-sm text-on-surface-variant font-medium">Keep as credit</span>
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
              Generate Bill
            </>
          )}
        </button>
      </div>
    </main>
  );
}
