import React, { useState } from 'react';
import {
  Package, Truck, CheckCircle2, Clock, MapPin, X, ChevronRight, ShoppingBag, ExternalLink, Upload, RefreshCw
} from 'lucide-react';
import { Order } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { updateOrderPayment } from '../utils/supabase';
import { compressImageToDataUrl } from '../utils/compressImage';
import { openAttachment } from '../utils/openAttachment';

const ORDER_STATUS_HI: Record<string, string> = {
  awaiting_payment: 'भुगतान सत्यापन बाकी',
  confirmed: 'पुष्टि हो गई',
  processing: 'प्रोसेसिंग में',
  shipped: 'भेज दिया गया',
  delivered: 'डिलीवर हो गया',
};

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onOpenStore?: () => void;
}

export const MyOrdersModal: React.FC<MyOrdersModalProps> = ({
  isOpen,
  onClose,
  orders,
  onOpenStore,
}) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  // Orders whose screenshot was re-uploaded in this session (after an admin
  // rejected the first one) — shown as pending again without a refetch.
  const [reuploaded, setReuploaded] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ id: string; message: string } | null>(null);
  if (!isOpen) return null;

  const handleReupload = async (orderId: string, file: File) => {
    setUploadError(null);
    setUploadingId(orderId);
    try {
      const receiptImageUrl = await compressImageToDataUrl(file);
      const result = await updateOrderPayment(orderId, { receiptImageUrl });
      if (!result.success) throw new Error(result.error);
      setReuploaded((prev) => ({ ...prev, [orderId]: receiptImageUrl }));
    } catch (e: any) {
      setUploadError({ id: orderId, message: e?.message || tr('Could not upload. Please try again.', 'अपलोड नहीं हो सका। कृपया दोबारा कोशिश करें।') });
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        id="my-orders-modal-container"
        className="relative w-full max-w-2xl bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-2xl my-8 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-900">{tr('My Orders', 'मेरे ऑर्डर')}</h2>
              <p className="text-xs text-zinc-500">{tr('Track and manage your nutrition & supplement orders', 'अपने पोषण व सप्लीमेंट ऑर्डर ट्रैक व प्रबंधित करें')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-zinc-900">{tr('No Orders Placed Yet', 'अभी तक कोई ऑर्डर नहीं दिया गया')}</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                {tr('Explore our scientifically formulated supplements, whey protein, and superfoods in the store.', 'स्टोर में हमारे वैज्ञानिक रूप से तैयार सप्लीमेंट्स, वे प्रोटीन व सुपरफूड्स देखें।')}
              </p>
              {onOpenStore && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenStore();
                  }}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition-all"
                >
                  {tr('Browse Store Products', 'स्टोर उत्पाद देखें')}
                </button>
              )}
            </div>
          ) : (
            orders.map((original) => {
              const order: Order = reuploaded[original.id]
                ? { ...original, paymentStatus: 'pending', orderStatus: 'awaiting_payment', receiptImageUrl: reuploaded[original.id] }
                : original;
              return (
              <div
                key={order.id}
                className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-all space-y-4"
              >
                {/* Order Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-600">{order.id}</span>
                    <span className="text-zinc-500 text-xs ml-2">
                      {tr('Placed on', 'दिनांक')} {new Date(order.createdAt).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                      order.orderStatus === 'delivered'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : order.orderStatus === 'shipped'
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {order.orderStatus === 'shipped' ? tr('In Transit', 'ट्रांजिट में') : order.orderStatus === 'awaiting_payment' ? tr('Verifying payment', ORDER_STATUS_HI.awaiting_payment) : tr(order.orderStatus, ORDER_STATUS_HI[order.orderStatus] || order.orderStatus)}
                    </span>
                    <span className="text-xs font-bold text-zinc-900">₹{order.total}</span>
                  </div>
                </div>

                {/* Payment verification status */}
                {order.paymentStatus === 'rejected' ? (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-2">
                    <p className="text-rose-700 font-semibold">
                      {tr('We could not verify your payment. Please upload a clear screenshot that shows the amount and UPI transaction ID.', 'हम आपका भुगतान सत्यापित नहीं कर सके। कृपया ऐसा साफ़ स्क्रीनशॉट अपलोड करें जिसमें राशि और UPI ट्रांज़ैक्शन ID दिखे।')}
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer">
                      {uploadingId === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{tr('Upload new screenshot', 'नया स्क्रीनशॉट अपलोड करें')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingId === order.id}
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleReupload(order.id, f); }}
                      />
                    </label>
                    {uploadError?.id === order.id && <p className="text-rose-600">{uploadError.message}</p>}
                  </div>
                ) : order.paymentStatus === 'pending' ? (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                    {tr('Payment screenshot received — your order will be confirmed once our team verifies it.', 'भुगतान स्क्रीनशॉट मिल गया — हमारी टीम द्वारा जाँच के बाद आपका ऑर्डर कन्फ़र्म हो जाएगा।')}
                  </div>
                ) : null}

                {order.receiptImageUrl && (
                  <div className="p-2.5 rounded-xl bg-white border border-zinc-200 text-xs flex items-center justify-between">
                    <span className="text-zinc-500 text-[11px]">{tr('Payment Screenshot Uploaded', 'भुगतान स्क्रीनशॉट अपलोड किया गया')}</span>
                    <button
                      type="button"
                      onClick={() => openAttachment(order.receiptImageUrl!, `payment-${order.id}.jpg`)}
                      className="text-emerald-600 font-bold hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <span>{tr('View Screenshot', 'स्क्रीनशॉट देखें')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Items in this order */}
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-t border-zinc-200 pt-2">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-9 h-9 rounded-lg object-cover bg-zinc-100"
                        />
                        <div>
                          <div className="font-semibold text-zinc-900 line-clamp-1">{item.product.name}</div>
                          <div className="text-[11px] text-zinc-500">{tr('Qty:', 'मात्रा:')} {item.quantity} × ₹{item.product.discountPrice || item.product.price}</div>
                        </div>
                      </div>
                      <div className="font-bold text-zinc-700">
                        ₹{(item.product.discountPrice || item.product.price) * item.quantity}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shipping & Delivery Estimate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200 text-xs">
                  <div className="flex items-start gap-2 text-zinc-500">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-zinc-700 font-semibold">{order.shippingAddress.fullName}</strong>
                      <p className="line-clamp-1">{order.shippingAddress.streetAddress}, {order.shippingAddress.city} - {order.shippingAddress.pincode}</p>
                    </div>
                  </div>
                  <div className="flex items-center sm:justify-end gap-2 text-zinc-500">
                    <Truck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{tr('Est. Delivery:', 'अनुमानित डिलीवरी:')} <strong className="text-emerald-700">{order.estimatedDelivery}</strong></span>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
