import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [isOtpStage, setIsOtpStage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { sendOtp, verifyOtp, currentUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const formattedNumber = `+91${phoneNumber}`;
      await sendOtp(formattedNumber, 'recaptcha-container');
      setIsOtpStage(true);
    } catch (err) {
      setError('Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length < 4) {
      setError('Enter 4-digit OTP');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verifyOtp(otpValue);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex items-center justify-center p-4">
      {/* Mobile Container (390px target matching provided UI) */}
      <div className="w-full max-w-[390px] bg-surface min-h-[844px] flex flex-col relative overflow-hidden">
        
        {/* Top Branding Section */}
        <header className="pt-12 pb-8 px-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-10">
            <span className="material-symbols-outlined text-primary text-4xl">storefront</span>
            <h1 className="font-headline font-extrabold text-3xl tracking-tight text-primary">ShopSaathi</h1>
          </div>
          
          <div className="w-32 h-32 bg-primary-fixed rounded-full flex items-center justify-center mb-8 shadow-sm">
            <span className="material-symbols-outlined text-primary text-6xl">eco</span>
          </div>
          
          <h2 className="font-headline font-bold text-2xl mb-3 text-on-surface leading-tight">
            Aapki Dukaan, Aapka Saathi
          </h2>
          <p className="text-on-surface-variant font-medium text-lg leading-relaxed">
            Simple billing for every shop
          </p>
        </header>

        {/* Form Area */}
        <main className="flex-1 px-6 pb-12">
          <div className="bg-surface-container-low rounded-xl p-8 flex flex-col gap-8 transition-all">
            
            {error && <p className="text-error text-center font-bold text-sm bg-error-container p-2 rounded-lg">{error}</p>}

            {!isOtpStage ? (
              /* Phone Number Stage */
              <form className="flex flex-col gap-6" id="phone-stage" onSubmit={handleSendOtp}>
                <div className="flex flex-col gap-2">
                  <label className="font-headline font-bold text-lg text-on-surface px-1">Enter your phone number</label>
                  <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-lg text-on-surface-variant">+91</span>
                    <input 
                      className="w-full h-[72px] pl-16 pr-6 bg-surface-container-high rounded-lg border-none text-xl font-bold tracking-widest focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant/50 placeholder:font-normal placeholder:tracking-normal" 
                      placeholder="00000 00000" 
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                    />
                  </div>
                </div>
                
                <div id="recaptcha-container"></div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="signature-gradient w-full h-16 rounded-full flex items-center justify-center gap-3 text-on-primary font-headline font-bold text-lg shadow-lg active:scale-95 transition-transform"
                >
                  {loading ? <span className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full"></span> : (
                    <>
                      <span>Get OTP</span>
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* OTP Stage */
              <form className="flex flex-col gap-6" id="otp-stage" onSubmit={handleVerifyOtp}>
                <div className="flex flex-col gap-4">
                  <div className="px-1">
                    <h3 className="font-headline font-bold text-lg text-on-surface">Enter the 4-digit code</h3>
                    <p className="text-on-surface-variant text-sm">Sent to +91 {phoneNumber}</p>
                  </div>
                  <div className="flex justify-between gap-3">
                    {otp.map((digit, i) => (
                      <input 
                        key={i}
                        id={`otp-${i}`}
                        className="w-16 h-16 bg-surface-container-high rounded-lg border-none text-center text-2xl font-bold focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all" 
                        maxLength="1" 
                        type="text"
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        required
                      />
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="signature-gradient w-full h-16 rounded-full flex items-center justify-center gap-3 text-on-primary font-headline font-bold text-lg shadow-lg active:scale-95 transition-transform"
                >
                  {loading ? <span className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full"></span> : (
                    <>
                      <span className="material-symbols-outlined">verified_user</span>
                      <span>Verify & Login</span>
                    </>
                  )}
                </button>
                
                <button 
                  type="button"
                  onClick={() => setIsOtpStage(false)}
                  className="w-full flex items-center justify-center gap-2 text-primary font-bold text-base hover:underline decoration-2 underline-offset-4"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Change Number / Resend
                </button>
              </form>
            )}
          </div>
        </main>

        {/* Ambient Background Decoration */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-fixed rounded-full blur-[80px] opacity-40 -z-10"></div>
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-secondary-fixed rounded-full blur-[60px] opacity-30 -z-10"></div>
        
        {/* Footer */}
        <footer class="pb-10 px-8 text-center mt-auto">
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-full">
            <span class="material-symbols-outlined text-primary text-[18px] filled-icon">shield_lock</span>
            <span class="text-on-surface-variant font-medium text-sm">100% Safe & Secure Bahi Khata</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
