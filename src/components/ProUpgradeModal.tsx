import React, { useState } from 'react';
import {
  Crown, Sparkles, Check, QrCode, ShieldCheck, X, Copy, ExternalLink, ArrowRight, Lock
} from 'lucide-react';
import { UserAccount } from '../types';
import { authedFetch } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

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
  featureTriggerName = 'UrCare Food Camera Scanner',
}) => {
  // Single flat plan — no monthly/yearly choice, kept simple on purpose.
  // UPI QR is the only payment method — Razorpay was removed on request.
  const planType: 'monthly' = 'monthly';
  const [paymentStep, setPaymentStep] = useState<'intro' | 'payment' | 'success'>('intro');
  const [transactionId, setTransactionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  if (!isOpen) return null;

  // Flat, one-price plan: ₹400/month. Pay first — only then Premium (Pro) unlocks.
  const price = 400;

  const upiId = 'urcare.official@okhdfcbank';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=${upiId}&pn=UrCare%20Premium%20Subscription&am=${price}&cu=INR`;

  // Premium unlocks exactly one thing, as requested: the food scan.
  const proFeatures = [
    { title: tr('UrCare Food Scan', 'UrCare फूड स्कैन'), desc: tr('Scan or describe any meal and instantly know if it suits YOUR health profile — calories, macros & a personalized good/avoid verdict.', 'किसी भी भोजन को स्कैन करें या बताएं और तुरंत जानें कि यह आपकी स्वास्थ्य प्रोफ़ाइल के अनुकूल है या नहीं — कैलोरी, मैक्रोज़ व व्यक्तिगत अच्छा/बचें निर्णय।') },
  ];

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleConfirmQrPayment = async () => {
    setIsProcessing(true);
    try {
      await authedFetch('/api/user/upgrade-pro', {
        method: 'POST',
        body: JSON.stringify({
          planType,
          amount: price,
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

      onUpgradeSuccess(updated);
      setPaymentStep('success');
    } catch (e) {
      console.error(e);
      setErrorMessage(tr('Could not confirm payment. Please try again.', 'भुगतान की पुष्टि नहीं हो सकी। कृपया पुनः प्रयास करें।'));
    } finally {
      setIsProcessing(false);
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
                <span>{tr('Premium Feature:', 'प्रीमियम फीचर:')} {featureTriggerName}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {tr('Unlock', 'अनलॉक करें')} <span className="text-emerald-400">UrCare Premium</span>
              </h2>
              <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">
                {tr('Pay once, unlock the Pro feature below — no plans, no confusion.', 'एक बार भुगतान करें, नीचे दिया गया प्रो फीचर अनलॉक करें — कोई प्लान या भ्रम नहीं।')}
              </p>
            </div>

            {/* Single Flat Price */}
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500 shadow-lg shadow-emerald-500/10 text-center mb-6">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">UrCare Premium</div>
              <div className="text-4xl font-black text-white mt-1">₹{price}<span className="text-sm font-normal text-zinc-400">/{tr('month', 'महीना')}</span></div>
              <div className="text-[11px] text-zinc-400 mt-1">{tr('One simple price. Cancel anytime.', 'एक सरल कीमत। कभी भी रद्द करें।')}</div>
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
              <span>{tr('Continue to Pay', 'भुगतान जारी रखें')} ₹{price}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {tr('7-Day Money Back Guarantee', '7-दिन पैसा वापसी गारंटी')}
              </span>
              <span>•</span>
              <span>{tr('Instant Unlock', 'तुरंत अनलॉक')}</span>
            </div>
          </div>
        )}

        {paymentStep === 'payment' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-black text-white">{tr('Choose Payment Method', 'भुगतान विधि चुनें')}</h3>
                <p className="text-xs text-zinc-400">{tr('Total payable:', 'कुल देय राशि:')} <strong className="text-emerald-400">₹{price}</strong> ({tr('1 Month Pro', '1 महीना प्रो')})</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentStep('intro')}
                className="text-xs text-zinc-400 hover:text-white underline"
              >
                {tr('Back', 'वापस')}
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}

            <div className="space-y-4">
                {/* QR Code Container */}
                <div className="p-4 rounded-2xl bg-white flex flex-col items-center justify-center text-center shadow-lg">
                  <img
                    src={qrUrl}
                    alt="UPI Payment QR"
                    className="w-44 h-44 object-contain rounded-lg"
                  />
                  <div className="mt-2 text-black">
                    <p className="text-xs font-bold">{tr('Scan with GPay, PhonePe, Paytm, BHIM', 'GPay, PhonePe, Paytm, BHIM से स्कैन करें')}</p>
                    <p className="text-xs text-zinc-600 font-mono mt-0.5">{tr('Amount:', 'राशि:')} ₹{price}.00</p>
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
                    <span>{copiedUpi ? tr('Copied!', 'कॉपी हो गया!') : tr('Copy', 'कॉपी करें')}</span>
                  </button>
                </div>

                {/* UTR input */}
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    {tr('Enter UPI Ref / Transaction ID (UTR)', 'UPI संदर्भ / ट्रांज़ैक्शन ID (UTR) दर्ज करें')}
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
                      <span>{tr('I Have Paid', 'मैंने भुगतान कर दिया है')} ₹{price} {tr('via QR', 'QR के माध्यम से')}</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
          </div>
        )}

        {paymentStep === 'success' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-black uppercase tracking-wider mb-2">
              <Crown className="w-3.5 h-3.5" />
              <span>{tr("You're now Pro", 'अब आप प्रो हैं')}</span>
            </div>
            <h3 className="text-2xl font-black text-white">{tr('Welcome to UrCare Premium!', 'UrCare प्रीमियम में आपका स्वागत है!')}</h3>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto">
              {tr('Your Pro membership is now active. UrCare Food Scan is unlocked.', 'आपकी प्रो सदस्यता अब सक्रिय है। UrCare फूड स्कैन अनलॉक हो गया है।')}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition-all"
            >
              {tr('Start Using Premium', 'प्रीमियम का उपयोग शुरू करें')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
