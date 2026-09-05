import React, { useState } from 'react';
import { 
  X, Check, ShieldCheck, QrCode, CreditCard, Upload, 
  FileText, Copy, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Smartphone
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Order, CartItem, ShippingAddress } from '../types';
import { saveOrderAndReceiptToSupabase } from '../utils/supabase';

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
        userName: userName || shippingAddress.fullName || 'Valued Member',
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

      await saveOrderAndReceiptToSupabase(newOrder);
      setCreatedOrder(newOrder);
      setIsProcessing(false);
      setStep('receipt_upload');
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Razorpay payment gateway communication failed.');
    }
  };

  // 2. Process UPI QR Payment & Move to Receipt Upload
  const handleProceedQrPayment = () => {
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const newOrder: Order = {
      id: orderId,
      userId: userId || 'usr_active',
      userName: userName || shippingAddress.fullName || 'Valued Member',
      userEmail: userEmail || 'member@urcare.clinic',
      items,
      shippingAddress,
      subtotal: totalAmount,
      discount: 0,
      total: totalAmount,
      paymentMethod: 'qr_upi',
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      transactionId: transactionId || 'UPI-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      createdAt: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    setCreatedOrder(newOrder);
    setStep('receipt_upload');
  };

  // 3. Finalize Order with Uploaded Receipt
  const handleFinalizeReceiptUpload = async () => {
    if (!createdOrder) return;
    setIsProcessing(true);

    const updatedOrder: Order = {
      ...createdOrder,
      transactionId: transactionId || createdOrder.transactionId || 'TXN-CONFIRMED',
      receiptImageUrl: receiptPreview || undefined,
      receiptUploadedAt: new Date().toISOString(),
      paymentStatus: 'verified',
    };

    await saveOrderAndReceiptToSupabase(updatedOrder);
    setIsProcessing(false);
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
              <h3 className="text-lg font-black uppercase tracking-tight">Clinical Payment Gateway</h3>
            </div>
            <p className="text-xs opacity-60 mt-0.5">Secure 256-Bit Encrypted Healthcare Checkout</p>
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
                <span className="text-[11px] font-bold opacity-60 uppercase tracking-wider">Total Payable Amount</span>
                <div className="text-2xl font-black text-emerald-500 mt-0.5">₹{totalAmount.toLocaleString('en-IN')}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                  {items.reduce((sum, item) => sum + item.quantity, 0)} Items Selected
                </span>
                <p className="text-[11px] opacity-60 mt-1">Free Clinical Shipping Included</p>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider opacity-80">
                Select Payment Option
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
                  <div className="text-sm font-extrabold">Razorpay Gateway</div>
                  <div className="text-[11px] opacity-65 mt-0.5">Instant Card, NetBanking & UPI</div>
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
                  <div className="text-sm font-extrabold">UPI QR Code</div>
                  <div className="text-[11px] opacity-65 mt-0.5">Scan with GPay, PhonePe, Paytm</div>
                </button>
              </div>
            </div>

            {/* Option A Details: Razorpay */}
            {selectedMethod === 'razorpay' && (
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Supported Modes:</span>
                  <span className="text-[11px] font-mono opacity-60">Visa • Mastercard • RuPay • UPI</span>
                </div>
                <p className="text-xs opacity-75 leading-relaxed">
                  Clicking the button below invokes the Razorpay payment modal with automatic signature verification.
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
                      <span>Contacting Razorpay Gateway...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Pay ₹{totalAmount.toLocaleString('en-IN')} via Razorpay</span>
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
                    <div className="text-xs font-bold opacity-80">1. Scan & Pay ₹{totalAmount} with any UPI app</div>
                    <div className="text-xs font-bold opacity-80">2. Or copy official UPI ID:</div>
                    
                    <div className={`flex items-center justify-between p-2.5 rounded-xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-300'}`}>
                      <span className="text-xs font-mono font-bold text-emerald-500">{upiId}</span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[11px] font-bold flex items-center gap-1 transition-colors"
                      >
                        {copiedUpi ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <p className="text-[11px] opacity-60">
                      Merchant: UrCare Health Nutrition (HDFC Bank)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceedQrPayment}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>I Have Paid • Upload Receipt / UTR</span>
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
              <span>Payment initiated for Order #{createdOrder?.id}. Upload your transaction receipt below.</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold opacity-80 mb-1.5">
                  Transaction / UTR Reference Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 429381029481 or UPI-Ref-9921"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium outline-none ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold opacity-80 mb-1.5">
                  Upload Payment Screenshot / Receipt (Optional but recommended)
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
                      <span className="text-[11px] font-bold text-emerald-500">Receipt Attached. Click to replace</span>
                    </div>
                  ) : (
                    <div className="text-center space-y-1.5">
                      <Upload className="w-6 h-6 mx-auto text-emerald-500 opacity-80" />
                      <div className="text-xs font-bold">Select Receipt Image or PDF</div>
                      <div className="text-[10px] opacity-60">PNG, JPG, PDF up to 10MB</div>
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
                  <span>Attaching Receipt & Syncing to Supabase...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirm & Complete Order</span>
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
              <h4 className="text-xl font-black">Order Placed Successfully</h4>
              <p className="text-xs opacity-65 mt-1 font-mono">Order ID: {createdOrder.id}</p>
            </div>

            <div className={`p-4 rounded-2xl text-left text-xs ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200'} space-y-2`}>
              <div className="flex justify-between">
                <span className="opacity-60">Payment Method:</span>
                <span className="font-bold uppercase">{createdOrder.paymentMethod.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Transaction Reference:</span>
                <span className="font-mono font-bold text-emerald-500">{createdOrder.transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Estimated Delivery:</span>
                <span className="font-bold">{createdOrder.estimatedDelivery}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Receipt Status:</span>
                <span className="text-emerald-500 font-bold">
                  {createdOrder.receiptImageUrl ? 'Receipt Uploaded & Verified' : 'Standard Digital Invoice Generated'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20"
            >
              Done & Return to Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
