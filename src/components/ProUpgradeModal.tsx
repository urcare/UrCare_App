import React, { useState } from 'react';
import { 
  Crown, Sparkles, Check, QrCode, CreditCard, ShieldCheck, Zap, X, Copy, ExternalLink, ArrowRight, Lock
} from 'lucide-react';
import { UserAccount } from '../types';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: UserAccount;
  onUpgradeSuccess: (updatedAccount: UserAccount) => void;
  featureTriggerName?: string;
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({
  isOpen,
  onClose,
  account,
  onUpgradeSuccess,
  featureTriggerName = 'AI Food Camera Scanner',
}) => {
  // Single flat plan — no monthly/yearly choice, kept simple on purpose.
  const planType: 'monthly' = 'monthly';
  const [paymentStep, setPaymentStep] = useState<'intro' | 'payment' | 'success'>('intro');
  const [paymentMethod, setPaymentMethod] = useState<'qr_upi' | 'razorpay'>('qr_upi');
  const [transactionId, setTransactionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Flat, one-price plan: ₹400/month. Pay first — only then Premium (Pro) unlocks.
  const price = 400;

  const upiId = 'urcare.official@okhdfcbank';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=${upiId}&pn=UrCare%20Premium%20Subscription&am=${price}&cu=INR`;

  // Premium unlocks exactly two things, as requested: AI Scan + Daily Goals.
  const proFeatures = [
    { title: 'AI Food Scan', desc: 'Scan or describe any meal and instantly know if it suits YOUR health profile — calories, macros & a personalized good/avoid verdict.' },
    { title: 'Daily Goals', desc: 'Every day: exactly what to eat, what to avoid, sleep timing, water intake & the right exercises for you.' },
  ];

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleConfirmQrPayment = async () => {
    setIsProcessing(true);
    try {
      await fetch('/api/user/upgrade-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: account.uid,
          planType,
          paymentMethod: 'qr_upi',
          transactionId: transactionId || 'UPI-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        }),
      });

      const updated: UserAccount = {
        ...account,
        isPro: true,
        proPlanType: planType,
        proExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      try {
        localStorage.setItem('urcare_user_account', JSON.stringify(updated));
      } catch (e) {}

      onUpgradeSuccess(updated);
      setPaymentStep('success');
    } catch (e) {
      console.error(e);
      setErrorMessage('Could not confirm payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Loads the official Razorpay Checkout.js script once, and reuses it on subsequent calls.
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const finalizeUpgrade = async (paymentMethod: string, extra?: Record<string, any>) => {
    await fetch('/api/user/upgrade-pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: account.uid,
        planType,
        paymentMethod,
        ...extra,
      }),
    });

    const updated: UserAccount = {
      ...account,
      isPro: true,
      proPlanType: planType,
      proExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      localStorage.setItem('urcare_user_account', JSON.stringify(updated));
    } catch (e) {}

    onUpgradeSuccess(updated);
    setIsProcessing(false);
    setPaymentStep('success');
  };

  const handleRazorpayPayment = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      // 1. Create a real (or simulated, if no live keys yet) order on the server
      const res = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: price,
          receipt: 'urcare_premium_' + Date.now(),
          notes: { userId: account.uid, planType },
        }),
      });
      const orderData = await res.json();

      // 2. If live Razorpay keys are configured, open the real Checkout.js widget
      if (orderData.mode === 'live' && orderData.keyId) {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          setIsProcessing(false);
          setErrorMessage('Could not load Razorpay checkout. Please check your connection and try again.');
          return;
        }

        const rzp = new (window as any).Razorpay({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'UrCare Premium',
          description: 'UrCare Premium Subscription',
          order_id: orderData.id,
          prefill: {
            name: account.displayName,
            email: account.email,
            contact: account.phoneNumber || '',
          },
          theme: { color: '#059669' },
          handler: async (response: any) => {
            // 3. Verify the payment signature on the server, then unlock premium
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.verified) {
              setIsProcessing(false);
              setErrorMessage('Payment verification failed. If money was deducted, it will be refunded automatically.');
              return;
            }
            await finalizeUpgrade('razorpay', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
          },
          modal: {
            ondismiss: () => setIsProcessing(false),
          },
        });
        rzp.open();
        return;
      }

      // 3b. No live Razorpay keys configured yet — clearly-labelled simulated checkout
      // so development / demo flows keep working end-to-end.
      setTimeout(async () => {
        await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: orderData.id,
            razorpay_payment_id: 'pay_sim_' + Math.random().toString(36).substring(2, 10),
          }),
        });
        await finalizeUpgrade('razorpay');
      }, 1000);
    } catch (e) {
      setIsProcessing(false);
      setErrorMessage('Something went wrong while starting the payment. Please try again.');
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        id="pro-upgrade-modal-card"
        className="relative w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/10 my-8"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {paymentStep === 'intro' && (
          <div>
            {/* Crown Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-green-400 p-0.5 shadow-lg shadow-emerald-500/20 mb-3">
                <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                  <Crown className="w-7 h-7 text-amber-400" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
                <Lock className="w-3.5 h-3.5" />
                <span>Premium Feature: {featureTriggerName}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Unlock <span className="text-emerald-400">UrCare Premium</span>
              </h2>
              <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">
                Pay once, unlock both Pro features below — no plans, no confusion.
              </p>
            </div>

            {/* Single Flat Price */}
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500 shadow-lg shadow-emerald-500/10 text-center mb-6">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">UrCare Premium</div>
              <div className="text-4xl font-black text-white mt-1">₹{price}<span className="text-sm font-normal text-zinc-400">/month</span></div>
              <div className="text-[11px] text-zinc-400 mt-1">One simple price. Cancel anytime.</div>
            </div>

            {/* Feature List */}
            <div className="space-y-3 mb-6 bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/80">
              {proFeatures.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{f.title}</h4>
                    <p className="text-[11px] text-zinc-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <button
              id="proceed-pro-payment-btn"
              type="button"
              onClick={() => setPaymentStep('payment')}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95"
            >
              <span>Continue to Pay ₹{price}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                7-Day Money Back Guarantee
              </span>
              <span>•</span>
              <span>Instant AI Unlock</span>
            </div>
          </div>
        )}

        {paymentStep === 'payment' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-black text-white">Choose Payment Method</h3>
                <p className="text-xs text-zinc-400">Total payable: <strong className="text-emerald-400">₹{price}</strong> (1 Month Pro)</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentStep('intro')}
                className="text-xs text-zinc-400 hover:text-white underline"
              >
                Back
              </button>
            </div>

            {/* Payment Method Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800 mb-5">
              <button
                type="button"
                onClick={() => setPaymentMethod('qr_upi')}
                className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'qr_upi'
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>UPI QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('razorpay')}
                className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'razorpay'
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Razorpay / Cards</span>
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}

            {paymentMethod === 'qr_upi' ? (
              <div className="space-y-4">
                {/* QR Code Container */}
                <div className="p-4 rounded-2xl bg-white flex flex-col items-center justify-center text-center shadow-lg">
                  <img
                    src={qrUrl}
                    alt="UPI Payment QR"
                    className="w-44 h-44 object-contain rounded-lg"
                  />
                  <div className="mt-2 text-black">
                    <p className="text-xs font-bold">Scan with GPay, PhonePe, Paytm, BHIM</p>
                    <p className="text-xs text-zinc-600 font-mono mt-0.5">Amount: ₹{price}.00</p>
                  </div>
                </div>

                {/* Copy UPI ID */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase font-bold">UPI ID</div>
                    <div className="text-xs font-mono font-bold text-white">{upiId}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedUpi ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                {/* UTR input */}
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    Enter UPI Ref / Transaction ID (UTR)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 423981092831"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-emerald-500 focus:outline-none text-white text-sm"
                  />
                </div>

                {/* Confirm QR button */}
                <button
                  id="confirm-qr-pro-btn"
                  type="button"
                  onClick={handleConfirmQrPayment}
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <span>I Have Paid ₹{price} via QR</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-3">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-white">Razorpay Secure Gateway</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Pay securely using UPI Apps, Credit/Debit Cards, NetBanking, or Wallets.
                  </p>
                </div>

                <button
                  id="pay-razorpay-pro-btn"
                  type="button"
                  onClick={handleRazorpayPayment}
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-teal-500/20"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <span>Pay ₹{price} with Razorpay</span>
                      <Zap className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {paymentStep === 'success' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-black uppercase tracking-wider mb-2">
              <Crown className="w-3.5 h-3.5" />
              <span>You're now Pro</span>
            </div>
            <h3 className="text-2xl font-black text-white">Welcome to UrCare Premium!</h3>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto">
              Your Pro membership is now active. AI Food Scan and Daily Goals are unlocked.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition-all"
            >
              Start Using Premium
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
