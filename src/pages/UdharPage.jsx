import { useState } from 'react';

export default function UdharPage() {
  const [udhars, setUdhars] = useState([
    { 
      id: 1, 
      name: 'Rajesh Kumar', 
      lastBill: '12 days ago', 
      amount: '12,400', 
      status: 'Pending',
      type: 'receive',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBIWew-bslWdsTJ3xiA2dV8xLICbXRN7Hu1BUNGzTs-V-zwDPSaEQOxxG63auvugMnfOxdDf24U3uatSlZarBpGuwldLH_EuQe0ZcRjKyIWmzf_u6tm1C6f2UcBaEnIaL0x0t37OjPDZOBkLq6Hsq9FEwlb5meIYez5C5vwFlSQ68CyL8_CFcTWFxCM8EJHQmjrg1Xn0CndhY-PlFWGHqJZqxYiTZ0JbD5MPb0uTh-Rv7QDR8GRSwIBXfYwvBYUQZUjRlhHMhiQAO8'
    },
    { 
      id: 2, 
      name: 'Sunita Gupta', 
      lastBill: '5 days ago', 
      amount: '8,100', 
      status: 'Pending',
      type: 'receive',
      initials: 'S.G.'
    },
    { 
      id: 3, 
      name: 'Amit Sharma', 
      lastBill: '22 days ago', 
      amount: '4,000', 
      status: 'Overdue',
      type: 'receive',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC0u5k3cYVPSjPqCYug7xbupLLbyLV68jhoCJnnY_aST-lt9TLrBMfao_g1OBXxSL-UW_3a30G3BooA_wpa5Odm4mfeV11Y_zEoJZEFQAZKCzyUISKKFuLigheakH8DNiJ9_uWIieSePsyrInEsaC3XyqX21Un8AxeNDmsDRbby0yeEZAiX_xNwd0aLIqW04NotqyaO4C3fAtwoOzVNpa44meRkGBjzZFZJDxJ9yMGZVWQ_0C4S3X4OCSbcTm-0FnYDl9te5b4-F9I'
    },
  ]);

  const [activeTab, setActiveTab] = useState('receive');

  const handleMarkPaid = (id) => {
    setUdhars(prev => prev.filter(u => u.id !== id));
  };

  return (
    <main className="px-6 pt-6 max-w-md mx-auto pb-40">
      {/* Page Title */}
      <div className="mb-6">
        <h2 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">Udhar 💸</h2>
      </div>

      {/* Hero Summary Card */}
      <section className="mb-8 p-8 rounded-xl bg-primary-fixed shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <p className="font-label font-bold text-on-primary-fixed-variant uppercase tracking-wider mb-2">Total Pending</p>
          <p className="font-headline font-extrabold text-5xl text-on-primary-fixed">₹24,500</p>
        </div>
        {/* Decorative circle */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-on-primary-fixed opacity-5 rounded-full"></div>
      </section>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 bg-surface-container-low p-2 rounded-full">
        <button 
          onClick={() => setActiveTab('receive')}
          className={`flex-1 py-4 px-6 rounded-full flex items-center justify-center gap-2 font-bold transition-all ${activeTab === 'receive' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-slate-500 hover:bg-surface-container-high'}`}
        >
          <span className={`w-3 h-3 rounded-full ${activeTab === 'receive' ? 'bg-primary' : 'bg-slate-300'}`}></span>
          To Receive
        </button>
        <button 
          onClick={() => setActiveTab('pay')}
          className={`flex-1 py-4 px-6 rounded-full flex items-center justify-center gap-2 font-bold transition-all ${activeTab === 'pay' ? 'bg-surface-container-lowest shadow-sm text-error' : 'text-slate-500 hover:bg-surface-container-high'}`}
        >
          <span className={`w-3 h-3 rounded-full ${activeTab === 'pay' ? 'bg-error' : 'bg-slate-300'}`}></span>
          To Pay
        </button>
      </div>

      {/* Customer List */}
      <div className="space-y-6">
        {udhars.filter(u => u.type === activeTab).map((u) => (
          <div key={u.id} className={`bg-surface-container-lowest p-6 rounded-lg ghost-border flex flex-col gap-6 ${u.status === 'Overdue' ? 'opacity-80' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary-fixed flex items-center justify-center">
                {u.img ? (
                  <img src={u.img} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-secondary font-bold text-2xl">{u.initials}</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-headline font-bold text-xl text-on-surface">{u.name}</h3>
                <p className="font-label text-on-surface-variant">Last bill: {u.lastBill}</p>
              </div>
              <div className="text-right">
                <p className="font-headline font-extrabold text-2xl text-primary">₹{u.amount}</p>
                <span className={`inline-block px-3 py-1 ${u.status === 'Overdue' ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-on-primary-fixed-variant'} text-sm font-bold rounded-full uppercase`}>
                  {u.status}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => handleMarkPaid(u.id)}
                className="flex-[2] h-16 signature-gradient text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined filled-icon">check_circle</span>
                Mark Paid
              </button>
              <button className="flex-1 h-16 bg-secondary-container text-on-secondary-container rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <span className="material-symbols-outlined">notifications_active</span>
                Remind
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAB: Add Udhar */}
      <button className="fixed bottom-32 right-6 signature-gradient text-on-primary h-16 px-8 rounded-full shadow-[0_8px_24px_rgba(25,28,29,0.2)] flex items-center gap-3 active:scale-90 transition-transform duration-150 z-40">
        <span className="material-symbols-outlined text-3xl filled-icon">add_circle</span>
        <span className="font-headline font-bold text-lg tracking-wide">Add Udhar</span>
      </button>
    </main>
  );
}
