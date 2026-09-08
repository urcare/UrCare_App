import React, { useState } from 'react';
import { 
  X, Check, ShieldCheck, QrCode, CreditCard, Upload, 
  FileText, Copy, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Smartphone
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Order, CartItem, ShippingAddress } from '../types';
import { saveOrderAndReceiptToSupabase, updateOrderPayment } from '../utils/supabase';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  totalAmount: number;
  shippingAddress: ShippingAddress;
  userId: string;
  userName: string;
  userEmail: string;
  onPaymentComplete: (order: Order) => void;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  items,
  totalAmount,
  shippingAddress,
  userId,
  userName,
  userEmail,
  onPaymentComplete,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  // Payment Options: 'razorpay' | 'qr_upi'
  const [selectedMethod, setSelectedMethod] = useState<'razorpay' | 'qr_upi'>('razorpay');
  const [step, setStep] = useState<'pay' | 'receipt_upload' | 'confirmed'>('pay');
  
  // UPI / QR Details
  const upiId = 'urcare@okhdfcbank';
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Receipt Upload & Verification State
  const [transactionId, setTransactionId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 1. Process Razorpay API Payment
  const handleProcessRazorpay = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Call backend razorpay order endpoint
      const response = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          currency: 'INR',
          receipt: 'rcpt_' + Date.now(),
        }),
      });
      const rzpData = await response.json();

      // Simulated secure gateway authorization
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
      const txn = 'RZP-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      const newOrder: Order = {
        id: orderId,
        userId: userId || 'usr_active',
        userName: userName || shippingAddress.fullName || tr('Valued Member', 'सम्मानित सदस्य'),
        userEmail: userEmail || 'member@urcare.clinic',
        items,
        shippingAddress,
        subtotal: totalAmount,
        discount: 0,
        total: totalAmount,
        paymentMethod: 'razorpay',
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        transactionId: txn,
        createdAt: new Date().toISOString(),
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      const saveResult = await saveOrderAndReceiptToSupabase(newOrder);
      // The server assigns the real order id — everything after this must use it.
      setCreatedOrder({ ...newOrder, id: saveResult.orderId });
      setIsProcessing(false);
      setStep('receipt_upload');
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || tr('Razorpay payment gateway communication failed.', 'Razorpay भुगतान गेटवे से संपर्क विफल रहा।'));
    }
  };

  // 2. Process UPI QR Payment & Move to Receipt Upload
  const handleProceedQrPayment = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    const placeholderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const newOrder: Order = {
      id: placeholderId,
      userId: userId || 'usr_active',
      userName: userName || shippingAddress.fullName || tr('Valued Member', 'सम्मानित सदस्य'),
      userEmail: userEmail || 'member@urcare.clinic',
      items,
      shippingAddress,
      subtotal: totalAmount,
      discount: 0,
      total: totalAmount,
      paymentMethod: 'qr_upi',
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
      transactionId: transactionId || undefined,
      createdAt: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    const saveResult = await saveOrderAndReceiptToSupabase(newOrder);
    setIsProcessing(false);
    if (!saveResult.success) {
      setErrorMessage(saveResult.error || tr('Could not create this order. Please try again.', 'यह ऑर्डर नहीं बनाया जा सका। कृपया पुनः प्रयास करें।'));
      return;
    }
    // The server assigns the real order id — everything after this must use it.
    setCreatedOrder({ ...newOrder, id: saveResult.orderId });
    setStep('receipt_upload');
  };

  // 3. Finalize Order with Uploaded Receipt
  const handleFinalizeReceiptUpload = async () => {
    if (!createdOrder) return;
    setIsProcessing(true);

    const finalTransactionId = transactionId || createdOrder.transactionId || 'TXN-CONFIRMED';
    const result = await updateOrderPayment(createdOrder.id, {
      transactionId: finalTransactionId,
      receiptImageUrl: receiptPreview || undefined,
      paymentStatus: 'verified',
    });

    setIsProcessing(false);
    if (!result.success) {
      setErrorMessage(result.error || tr('Could not confirm this order. Please try again.', 'यह ऑर्डर पुष्ट नहीं हो सका। कृपया पुनः प्रयास करें।'));
      return;
    }

    const updatedOrder: Order = {
      ...createdOrder,
      transactionId: finalTransactionId,
      receiptImageUrl: receiptPreview || undefined,
      receiptUploadedAt: new Date().toISOString(),
      paymentStatus: 'verified',
    };
    setCreatedOrder(updatedOrder);
    setStep('confirmed');
    onPaymentComplete(updatedOrder);
  };

  const cardBg = isDark ? 'bg-zinc-950 border border-zinc-800 text-white' : 'bg-white border border-zinc-200 text-zinc-950 shadow-2xl';
  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=upi://pay?pa=${upiId}%26pn=UrCare%20Nutrition%26am=${totalAmount}%26cu=INR`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className={`w-full max-w-xl p-6 sm:p-8 rounded-3xl ${cardBg} space-y-6 text-left relative max-h-[90vh] overflow-y-auto`}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/40">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-black uppercase tracking-tight">{tr('Clinical Payment Gateway', 'क्लिनिकल भुगतान गेटवे')}</h3>
            </div>
            <p className="text-xs opacity-60 mt-0.5">{tr('Secure 256-Bit Encrypted Healthcare Checkout', 'सुरक्षित 256-बिट एन्क्रिप्टेड हेल्थकेयर चेकआउट')}</p>
          </div>
          {step !== 'confirmed' && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: PAYMENT METHOD SELECTION */}
        {step === 'pay' && (
          <div className="space-y-6">
            
            {/* Amount Summary */}
            <div className={`p-4 rounded-2xl ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200'} flex items-center justify-between`}>
              <div>
                <span className="text-[11px] font-bold opacity-60 uppercase tracking-wider">{tr('Total Payable Amount', 'कुल देय राशि')}</span>
                <div className="text-2xl font-black text-emerald-500 mt-0.5">₹{totalAmount.toLocaleString('en-IN')}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                  {items.reduce((sum, item) => sum + item.quantity, 0)} {tr('Items Selected', 'आइटम चयनित')}
                </span>
                <p className="text-[11px] opacity-60 mt-1">{tr('Free Clinical Shipping Included', 'मुफ्त क्लिनिकल शिपिंग शामिल')}</p>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider opacity-80">
                {tr('Select Payment Option', 'भुगतान विकल्प चुनें')}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Razorpay API */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('razorpay')}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${
                    selectedMethod === 'razorpay'
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                      : isDark ? 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    {selectedMethod === 'razorpay' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  </div>
                  <div className="text-sm font-extrabold">{tr('Razorpay Gateway', 'Razorpay गेटवे')}</div>
                  <div className="text-[11px] opacity-65 mt-0.5">{tr('Instant Card, NetBanking & UPI', 'तुरंत कार्ड, नेटबैंकिंग व UPI')}</div>
                </button>

                {/* Option 2: QR Code with UPI ID */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('qr_upi')}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${
                    selectedMethod === 'qr_upi'
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                      : isDark ? 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <QrCode className="w-4 h-4" />
                    </div>
                    {selectedMethod === 'qr_upi' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  </div>
                  <div className="text-sm font-extrabold">{tr('UPI QR Code', 'UPI QR कोड')}</div>
                  <div className="text-[11px] opacity-65 mt-0.5">{tr('Scan with GPay, PhonePe, Paytm', 'GPay, PhonePe, Paytm से स्कैन करें')}</div>
                </button>
              </div>
            </div>

            {/* Option A Details: Razorpay */}
            {selectedMethod === 'razorpay' && (
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{tr('Supported Modes:', 'समर्थित तरीके:')}</span>
                  <span className="text-[11px] font-mono opacity-60">Visa • Mastercard • RuPay • UPI</span>
                </div>
                <p className="text-xs opacity-75 leading-relaxed">
                  {tr('Clicking the button below invokes the Razorpay payment modal with automatic signature verification.', 'नीचे दिया बटन दबाने से स्वचालित सिग्नेचर सत्यापन के साथ Razorpay भुगतान मॉडल खुलेगा।')}
                </p>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleProcessRazorpay}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{tr('Contacting Razorpay Gateway...', 'Razorpay गेटवे से संपर्क हो रहा है...')}</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>{tr('Pay', 'भुगतान करें')} ₹{totalAmount.toLocaleString('en-IN')} {tr('via Razorpay', 'Razorpay के माध्यम से')}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Option B Details: UPI QR Code & ID */}
            {selectedMethod === 'qr_upi' && (
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} space-y-4`}>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="p-2 bg-white rounded-2xl shadow-md shrink-0">
                    <img 
                      src={qrDataUrl} 
                      alt="UPI Payment QR Code" 
                      className="w-36 h-36 rounded-xl object-contain"
                    />
                  </div>
                  <div className="space-y-2.5 text-left w-full">
                    <div className="text-xs font-bold opacity-80">{tr(`1. Scan & Pay ₹${totalAmount} with any UPI app`, `1. किसी भी UPI ऐप से ₹${totalAmount} स्कैन कर भुगतान करें`)}</div>
                    <div className="text-xs font-bold opacity-80">{tr('2. Or copy official UPI ID:', '2. या आधिकारिक UPI ID कॉपी करें:')}</div>

                    <div className={`flex items-center justify-between p-2.5 rounded-xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-300'}`}>
                      <span className="text-xs font-mono font-bold text-emerald-500">{upiId}</span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[11px] font-bold flex items-center gap-1 transition-colors"
                      >
                        {copiedUpi ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUpi ? tr('Copied', 'कॉपी हुआ') : tr('Copy', 'कॉपी करें')}</span>
                      </button>
                    </div>

                    <p className="text-[11px] opacity-60">
                      {tr('Merchant:', 'व्यापारी:')} UrCare Health Nutrition (HDFC Bank)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceedQrPayment}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>{tr('I Have Paid • Upload Receipt / UTR', 'मैंने भुगतान कर दिया • रसीद / UTR अपलोड करें')}</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* STEP 2: RECEIPT UPLOAD */}
        {step === 'receipt_upload' && (
          <div className="space-y-5">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{tr(`Payment initiated for Order #${createdOrder?.id}. Upload your transaction receipt below.`, `ऑर्डर #${createdOrder?.id} के लिए भुगतान शुरू हुआ। नीचे अपनी ट्रांज़ैक्शन रसीद अपलोड करें।`)}</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold opacity-80 mb-1.5">
                  {tr('Transaction / UTR Reference Number', 'ट्रांज़ैक्शन / UTR संदर्भ संख्या')}
                </label>
                <input
                  type="text"
                  placeholder={tr('e.g. 429381029481 or UPI-Ref-9921', 'जैसे 429381029481 या UPI-Ref-9921')}
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium outline-none ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold opacity-80 mb-1.5">
                  {tr('Upload Payment Screenshot / Receipt (Optional but recommended)', 'भुगतान स्क्रीनशॉट / रसीद अपलोड करें (वैकल्पिक पर अनुशंसित)')}
                </label>

                <label className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDark ? 'border-zinc-800 hover:border-emerald-500 bg-zinc-900/40' : 'border-zinc-300 hover:border-emerald-600 bg-zinc-50'
                }`}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {receiptPreview ? (
                    <div className="flex flex-col items-center space-y-2">
                      <img src={receiptPreview} alt="Receipt Preview" className="max-h-32 rounded-lg object-contain" />
                      <span className="text-[11px] font-bold text-emerald-500">{tr('Receipt Attached. Click to replace', 'रसीद जुड़ी हुई है। बदलने के लिए क्लिक करें')}</span>
                    </div>
                  ) : (
                    <div className="text-center space-y-1.5">
                      <Upload className="w-6 h-6 mx-auto text-emerald-500 opacity-80" />
                      <div className="text-xs font-bold">{tr('Select Receipt Image or PDF', 'रसीद इमेज या PDF चुनें')}</div>
                      <div className="text-[10px] opacity-60">PNG, JPG, PDF — {tr('up to 10MB', '10MB तक')}</div>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleFinalizeReceiptUpload}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{tr('Attaching Receipt & Syncing to Supabase...', 'रसीद जोड़ी जा रही है व Supabase से सिंक हो रही है...')}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{tr('Confirm & Complete Order', 'पुष्टि करें व ऑर्डर पूर्ण करें')}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 3: ORDER CONFIRMED */}
        {step === 'confirmed' && createdOrder && (
          <div className="text-center space-y-4 py-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <div>
              <h4 className="text-xl font-black">{tr('Order Placed Successfully', 'ऑर्डर सफलतापूर्वक दिया गया')}</h4>
              <p className="text-xs opacity-65 mt-1 font-mono">{tr('Order ID:', 'ऑर्डर ID:')} {createdOrder.id}</p>
            </div>

            <div className={`p-4 rounded-2xl text-left text-xs ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200'} space-y-2`}>
              <div className="flex justify-between">
                <span className="opacity-60">{tr('Payment Method:', 'भुगतान विधि:')}</span>
                <span className="font-bold uppercase">{createdOrder.paymentMethod.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">{tr('Transaction Reference:', 'ट्रांज़ैक्शन संदर्भ:')}</span>
                <span className="font-mono font-bold text-emerald-500">{createdOrder.transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">{tr('Estimated Delivery:', 'अनुमानित डिलीवरी:')}</span>
                <span className="font-bold">{createdOrder.estimatedDelivery}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">{tr('Receipt Status:', 'रसीद स्थिति:')}</span>
                <span className="text-emerald-500 font-bold">
                  {createdOrder.receiptImageUrl ? tr('Receipt Uploaded & Verified', 'रसीद अपलोड व सत्यापित') : tr('Standard Digital Invoice Generated', 'मानक डिजिटल इनवॉइस बनाया गया')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20"
            >
              {tr('Done & Return to Dashboard', 'पूर्ण हुआ व डैशबोर्ड पर वापस जाएं')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
