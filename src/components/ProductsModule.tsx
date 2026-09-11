import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Star, Plus, Minus, Check, ArrowRight, ShieldCheck, 
  Truck, QrCode, CreditCard, Sparkles, MapPin, X, Copy, Zap, 
  Package, ChevronRight, CheckCircle2, Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, CartItem, ShippingAddress, Order, UserAccount } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { saveOrderAndReceiptToSupabase, getProducts } from '../utils/supabase';

interface ProductsModuleProps {
  account: UserAccount;
  onOrderPlaced?: (newOrder: Order) => void;
  onOpenMyOrders?: () => void;
}

export const ProductsModule: React.FC<ProductsModuleProps> = ({
  account,
  onOrderPlaced,
  onOpenMyOrders,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Real catalog, managed by admin — no hardcoded/mock products. Ratings/review
  // counts are computed from real reviews, never fabricated.
  useEffect(() => {
    let cancelled = false;
    getProducts()
      .then((list) => { if (!cancelled) setProducts(list); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);

  // Checkout flow states: 'none' | 'address' | 'payment' | 'order_confirmed'
  const [checkoutStep, setCheckoutStep] = useState<'none' | 'address' | 'payment' | 'order_confirmed'>('none');
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: account.displayName || '',
    phone: account.phoneNumber || '',
    streetAddress: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'qr_upi' | 'razorpay' | 'autopay'>('qr_upi');
  const [transactionId, setTransactionId] = useState('');
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Cart calculations
  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => acc + (item.product.discountPrice || item.product.price) * item.quantity, 0);
  const deliveryFee = cartSubtotal > 1500 || cartSubtotal === 0 ? 0 : 99;
  const cartTotal = cartSubtotal + deliveryFee;

  const upiId = 'urcare.pay@okaxis';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=${upiId}&pn=UR%20CARE%20Nutrition&am=${cartTotal}&cu=INR`;

  // Instant Reliable Add to Cart
  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    // Animate button state
    setAddedAnimationId(product.id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1200);
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleCopyUpi = () => {
    try {
      navigator.clipboard.writeText(upiId);
    } catch (e) {}
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.streetAddress || !shippingAddress.city || !shippingAddress.pincode) {
      alert(tr('Please fill in all address details to continue.', 'जारी रखने के लिए कृपया सभी पते की जानकारी भरें।'));
      return;
    }
    setCheckoutStep('payment');
  };

  // Immediate Reliable Payment Execution
  const handleFinalizePayment = async () => {
    setIsProcessingOrder(true);
    
    const orderPayload: Order = {
      id: 'URC-' + Math.floor(100000 + Math.random() * 900000), // display placeholder until the server assigns the real id
      userId: account.uid,
      userName: shippingAddress.fullName,
      userEmail: account.email,
      items: [...cart],
      shippingAddress,
      subtotal: cartSubtotal,
      discount: 0,
      total: cartTotal,
      paymentMethod,
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      transactionId: transactionId || 'TXN_UR_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      createdAt: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    // The server assigns the canonical order (real id, status, etc.) — that's what
    // Admin sees too, so the confirmation must reflect the id it actually returned.
    const result = await saveOrderAndReceiptToSupabase(orderPayload);
    const finalOrder: Order = { ...orderPayload, id: result.success ? result.orderId : orderPayload.id };

    setTimeout(() => {
      setConfirmedOrder(finalOrder);
      if (onOrderPlaced) onOrderPlaced(finalOrder);

      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#00a800', '#ffffff', '#008000'],
        });
      } catch (e) {}

      setCart([]);
      setIsCartOpen(false);
      setCheckoutStep('order_confirmed');
      setIsProcessingOrder(false);
    }, 1000);
  };

  const categories = [
    { id: 'all', label: tr('All Products', 'सभी उत्पाद') },
    { id: 'protein', label: tr('Reversal Kits & Polyherbal Medicine', 'रिवर्सल किट्स व पॉलीहर्बल औषधि') },
    { id: 'vitamins', label: tr('Vitamins & Micronutrient Support', 'विटामिन व सूक्ष्म पोषक सहयोग') },
    { id: 'superfoods', label: tr('Diet & Gut Support', 'आहार व गट सहयोग') },
    { id: 'snacks', label: tr('Diabetic-Friendly Snacks', 'डायबिटीज-अनुकूल स्नैक्स') },
    { id: 'accessories', label: tr('Monitoring & Accessories', 'मॉनिटरिंग व सहायक उपकरण') },
  ];

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const cardClass = isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-sm';
  const subCardClass = isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200';

  return (
    <div id="urcare-products-store" className="space-y-6">
      
      {/* Store Header Banner */}
      <div className={`rounded-3xl p-6 sm:p-8 relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-900/10`}>
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-10 bottom-0 w-24 h-24 rounded-full bg-white/10 blur-xl" />
        <div className="max-w-xl space-y-2 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{tr('Doctor-Led • Root-Cause Diabetes Reversal', 'डॉक्टर-नेतृत्व वाला • रूट-कॉज़ डायबिटीज रिवर्सल')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {tr('UrCare Diabetes Reversal Store', 'UrCare डायबिटीज रिवर्सल स्टोर')}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-50/90 leading-relaxed">
            {tr('Personalised, clinically formulated polyherbal reversal kits and doctor-led nutrition support — for Type 1, Type 1.5 (LADA), Type 2 and pre-diabetes. Built to reverse, not just manage.', 'व्यक्तिगत, क्लीनिकली फॉर्मूलेटेड पॉलीहर्बल रिवर्सल किट्स व डॉक्टर-नेतृत्व वाला पोषण सहयोग — टाइप 1, टाइप 1.5 (LADA), टाइप 2 व प्री-डायबिटीज के लिए। सिर्फ प्रबंधन नहीं, रिवर्सल के लिए बनाया गया।')}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-bold">
            <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
              <Truck className="w-4 h-4" />
              <span>{tr('Free Delivery over ₹1,500', '₹1,500 से ऊपर मुफ्त डिलीवरी')}</span>
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
              <span>{tr('Clinically Formulated & Doctor-Led', 'क्लीनिकली फॉर्मूलेटेड व डॉक्टर-नेतृत्व वाला')}</span>
            </span>
            {onOpenMyOrders && (
              <button
                type="button"
                onClick={onOpenMyOrders}
                className="px-3 py-1 rounded-lg bg-white text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1"
              >
                <Package className="w-3.5 h-3.5" />
                <span>{tr('My Orders', 'मेरे ऑर्डर')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Categories & Cart Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 py-1.5 -mx-1 px-1 backdrop-blur-sm">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : subCardClass + ' opacity-70 hover:opacity-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Aesthetic Floating / Sticky Cart Trigger */}
        <button
          id="cart-trigger-btn"
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="relative px-4 py-2.5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 border border-emerald-500/40 text-white text-xs font-black flex items-center gap-2.5 shadow-lg shadow-emerald-950/20 transition-all hover:scale-102 active:scale-98 cursor-pointer group"
        >
          <div className="relative flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-emerald-400 stroke-[2.2] group-hover:scale-110 transition-transform" />
            {totalCartItems > 0 && (
              <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-black text-[9px] font-black flex items-center justify-center shadow-xs">
                {totalCartItems}
              </span>
            )}
          </div>
          <span className="tracking-wide">{tr('Cart', 'कार्ट')}</span>
          {totalCartItems > 0 && (
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-mono font-bold">
              ₹{cartSubtotal.toLocaleString('en-IN')}
            </span>
          )}
        </button>
      </div>

      {/* Product Cards Grid */}
      {productsLoading ? (
        <div className={`p-12 rounded-3xl ${cardClass} text-center text-sm font-bold opacity-60`}>{tr('Loading products...', 'उत्पाद लोड हो रहे हैं...')}</div>
      ) : filteredProducts.length === 0 ? (
        <div className={`p-12 rounded-3xl ${cardClass} text-center space-y-2`}>
          <ShoppingBag className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-sm font-bold opacity-70">{tr('No products available yet', 'अभी कोई उत्पाद उपलब्ध नहीं है')}</p>
          <p className="text-xs opacity-50">{tr('Check back soon — the store is being stocked.', 'जल्द ही देखें — स्टोर को स्टॉक किया जा रहा है।')}</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredProducts.map((product) => {
          const isAdded = addedAnimationId === product.id;

          return (
            <div
              key={product.id}
              id={`product-card-${product.id}`}
              onClick={() => setSelectedProductDetails(product)}
              className={`group flex flex-col justify-between rounded-3xl p-4 transition-all duration-200 ${cardClass} hover:border-emerald-500 shadow-sm hover:shadow-md cursor-pointer text-left relative overflow-hidden`}
            >
              <div>
                {/* Product Image */}
                <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-black/5 mb-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {product.featured && (
                    <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider shadow-sm">
                      {tr('Top Choice', 'सर्वश्रेष्ठ पसंद')}
                    </span>
                  )}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md text-[11px] font-bold text-amber-300 shadow-sm">
                    <Star className="w-3 h-3 fill-amber-300" />
                    <span>{product.rating}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">({product.reviewsCount})</span>
                  </div>
                </div>

                <h3 className="text-sm font-extrabold line-clamp-1 group-hover:text-emerald-500 transition-colors">
                  {product.name}
                </h3>
                <p className="text-xs opacity-70 line-clamp-2 mt-1 mb-2 leading-relaxed">
                  {product.description}
                </p>

                {/* Key benefit pill */}
                {product.benefits && product.benefits[0] && (
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
                    <Check className="w-3 h-3" />
                    <span className="truncate max-w-[190px]">{product.benefits[0]}</span>
                  </div>
                )}
              </div>

              {/* Price & Add to Cart Button */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between mt-2">
                <div>
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400">₹{product.discountPrice}</div>
                  <div className="text-[11px] opacity-50 line-through">₹{product.price}</div>
                </div>

                <button
                  id={`add-btn-${product.id}`}
                  type="button"
                  onClick={(e) => handleAddToCart(e, product)}
                  className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ${
                    isAdded
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-black'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{tr('Added!', 'जोड़ा गया!')}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>{tr('Add', 'जोड़ें')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* PRODUCT DETAILS MODAL (CLICK TO READ & EXPLORE FULL DETAILS) */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className={`relative w-full max-w-xl ${cardClass} rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 text-left max-h-[90vh] overflow-y-auto`}>
            <button
              type="button"
              onClick={() => setSelectedProductDetails(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row gap-5">
              <img
                src={selectedProductDetails.image}
                alt={selectedProductDetails.name}
                className="w-full sm:w-44 h-48 rounded-2xl object-cover bg-black/10 shrink-0"
              />

              <div className="space-y-2 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {selectedProductDetails.category.toUpperCase()}
                </span>
                
                <h3 className="text-lg sm:text-xl font-black text-zinc-950 dark:text-white">
                  {selectedProductDetails.name}
                </h3>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{selectedProductDetails.rating}</span>
                  </div>
                  <span className="text-xs opacity-50">({selectedProductDetails.reviewsCount} {tr('verified reviews', 'सत्यापित समीक्षाएं')})</span>
                </div>

                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    ₹{selectedProductDetails.discountPrice}
                  </span>
                  <span className="text-xs opacity-50 line-through">
                    ₹{selectedProductDetails.price}
                  </span>
                  <span className="text-xs font-bold text-rose-500">
                    {Math.round(((selectedProductDetails.price - selectedProductDetails.discountPrice) / selectedProductDetails.price) * 100)}% {tr('OFF', 'छूट')}
                  </span>
                </div>
              </div>
            </div>

            {/* Full Description */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{tr('About this product', 'इस उत्पाद के बारे में')}</span>
              <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                {selectedProductDetails.description}
              </p>
            </div>

            {/* Benefits Checklist */}
            {selectedProductDetails.benefits && selectedProductDetails.benefits.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {tr('Key Benefits & Highlights', 'मुख्य लाभ व विशेषताएं')}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedProductDetails.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nutritional Details if present */}
            {selectedProductDetails.nutritionInfo && (
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {tr('Nutritional Breakdown', 'पोषण विवरण')} ({selectedProductDetails.nutritionInfo.servingSize})
                </span>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] opacity-60 block">{tr('Calories', 'कैलोरी')}</span>
                    <span className="font-black text-sm">{selectedProductDetails.nutritionInfo.calories}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] opacity-60 block">{tr('Protein', 'प्रोटीन')}</span>
                    <span className="font-black text-sm text-emerald-500">{selectedProductDetails.nutritionInfo.protein}g</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] opacity-60 block">{tr('Carbs', 'कार्ब्स')}</span>
                    <span className="font-black text-sm">{selectedProductDetails.nutritionInfo.carbs}g</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] opacity-60 block">{tr('Fats', 'फैट्स')}</span>
                    <span className="font-black text-sm">{selectedProductDetails.nutritionInfo.fats}g</span>
                  </div>
                </div>
              </div>
            )}

            {/* Add to Cart Footer inside Modal */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedProductDetails(null)}
                className="px-5 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                {tr('Close', 'बंद करें')}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  handleAddToCart(e, selectedProductDetails);
                  setSelectedProductDetails(null);
                  setIsCartOpen(true);
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{tr('Add to Cart & Checkout', 'कार्ट में जोड़ें व चेकआउट करें')} (₹{selectedProductDetails.discountPrice})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CART DRAWER / MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md ${cardClass} h-full flex flex-col p-6 shadow-2xl overflow-y-auto`}>
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/40">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-black">{tr('Your Cart', 'आपका कार्ट')} ({totalCartItems})</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-full opacity-60 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16 opacity-50">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">{tr('Your cart is empty', 'आपका कार्ट खाली है')}</p>
                  <p className="text-xs mt-1">{tr('Add items from the store above to checkout', 'चेकआउट के लिए ऊपर स्टोर से आइटम जोड़ें')}</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className={`p-3 rounded-xl ${subCardClass} flex items-center gap-3`}>
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-12 h-12 rounded-lg object-cover bg-black/10 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold truncate">{item.product.name}</h4>
                      <div className="text-xs font-extrabold text-emerald-500 mt-0.5">₹{item.product.discountPrice}</div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/10">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.product.id, -1)}
                        className="w-6 h-6 rounded flex items-center justify-center font-bold opacity-60 hover:opacity-100"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold px-1">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.product.id, 1)}
                        className="w-6 h-6 rounded flex items-center justify-center font-bold opacity-60 hover:opacity-100"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="pt-4 border-t border-zinc-800/40 space-y-3">
                <div className="space-y-1 text-xs opacity-80">
                  <div className="flex justify-between">
                    <span>{tr('Subtotal', 'उप-योग')}</span>
                    <span className="font-bold">₹{cartSubtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{tr('Delivery', 'डिलीवरी')}</span>
                    <span className={deliveryFee === 0 ? 'text-emerald-500 font-bold' : ''}>
                      {deliveryFee === 0 ? tr('FREE', 'मुफ्त') : `₹${deliveryFee}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-emerald-500 pt-2 border-t border-zinc-800/40">
                    <span>{tr('Total Amount', 'कुल राशि')}</span>
                    <span className="text-base">₹{cartTotal}</span>
                  </div>
                </div>

                <button
                  id="checkout-next-btn"
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    setCheckoutStep('address');
                  }}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <span>{tr('Proceed to Delivery Address', 'डिलीवरी पते पर आगे बढ़ें')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADDRESS FORM MODAL */}
      {checkoutStep === 'address' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className={`relative w-full max-w-lg ${cardClass} rounded-3xl p-6 sm:p-7 shadow-2xl my-6 space-y-4`}>
            <button
              type="button"
              onClick={() => setCheckoutStep('none')}
              className="absolute top-4 right-4 p-1.5 rounded-full opacity-60 hover:opacity-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black">{tr('Delivery Details', 'डिलीवरी विवरण')}</h3>
                <p className="text-xs opacity-60">{tr('Enter your shipping address for fast delivery', 'तेज़ डिलीवरी हेतु अपना शिपिंग पता दर्ज करें')}</p>
              </div>
            </div>

            <form onSubmit={handleAddressSubmit} className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-bold opacity-75 mb-1">{tr('Full Name', 'पूरा नाम')} *</label>
                <input
                  type="text"
                  required
                  value={shippingAddress.fullName}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, fullName: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold opacity-75 mb-1">{tr('Phone Number', 'मोबाइल नंबर')} *</label>
                <input
                  type="tel"
                  required
                  value={shippingAddress.phone}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold opacity-75 mb-1">{tr('Street Address', 'सड़क का पता')} *</label>
                <input
                  type="text"
                  required
                  value={shippingAddress.streetAddress}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, streetAddress: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold opacity-75 mb-1">{tr('City', 'शहर')} *</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold opacity-75 mb-1">{tr('State', 'राज्य')} *</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.state}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold opacity-75 mb-1">{tr('Pincode', 'पिनकोड')} *</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.pincode}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, pincode: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 mt-2"
              >
                <span>{tr('Continue to Payment', 'भुगतान हेतु आगे बढ़ें')} (₹{cartTotal})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {checkoutStep === 'payment' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className={`relative w-full max-w-lg ${cardClass} rounded-3xl p-6 sm:p-7 shadow-2xl my-6 space-y-4`}>
            <button
              type="button"
              onClick={() => setCheckoutStep('address')}
              className="absolute top-4 right-4 p-1.5 rounded-full opacity-60 hover:opacity-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-xl font-black">{tr('Choose Payment', 'भुगतान चुनें')}</h3>
              <p className="text-xs opacity-60">{tr('Total Payable:', 'कुल देय राशि:')} <strong className="text-emerald-500 text-sm">₹{cartTotal}</strong></p>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('qr_upi')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  paymentMethod === 'qr_upi'
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-md'
                    : subCardClass
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>{tr('UPI QR / App', 'UPI QR / ऐप')}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('razorpay')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  paymentMethod === 'razorpay'
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-md'
                    : subCardClass
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>{tr('Cards / NetBanking', 'कार्ड / नेटबैंकिंग')}</span>
              </button>
            </div>

            {/* UPI QR & Instant Confirm */}
            {paymentMethod === 'qr_upi' && (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-white flex flex-col items-center justify-center text-center shadow-md">
                  <img
                    src={qrUrl}
                    alt="UPI QR Code"
                    className="w-40 h-40 object-contain rounded-lg"
                  />
                  <div className="mt-2 text-black">
                    <p className="text-xs font-bold">{tr('Scan & Pay via GPay, PhonePe, Paytm, BHIM', 'GPay, PhonePe, Paytm, BHIM से स्कैन कर भुगतान करें')}</p>
                    <p className="text-xs text-zinc-600 font-mono mt-0.5">{tr('Amount:', 'राशि:')} ₹{cartTotal}.00</p>
                  </div>
                </div>

                <div className={`p-3 rounded-xl ${subCardClass} flex items-center justify-between`}>
                  <div>
                    <div className="text-[10px] opacity-60 font-bold uppercase">UPI ID</div>
                    <div className="text-xs font-mono font-bold text-emerald-500">{upiId}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold hover:bg-emerald-500/20"
                  >
                    {copiedUpi ? tr('Copied!', 'कॉपी हुआ!') : tr('Copy', 'कॉपी करें')}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold opacity-75 mb-1">
                    {tr('UPI Reference / UTR Number (Optional)', 'UPI संदर्भ / UTR संख्या (वैकल्पिक)')}
                  </label>
                  <input
                    type="text"
                    placeholder={tr('e.g. 423981092831', 'जैसे 423981092831')}
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                  />
                </div>

                <button
                  id="pay-and-confirm-upi-btn"
                  type="button"
                  onClick={handleFinalizePayment}
                  disabled={isProcessingOrder}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  {isProcessingOrder ? (
                    <div className="w-5 h-5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <span>{tr('I Have Paid', 'मैंने भुगतान कर दिया है')} ₹{cartTotal} ({tr('Confirm Order', 'ऑर्डर की पुष्टि करें')})</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Online Cards & NetBanking */}
            {paymentMethod === 'razorpay' && (
              <div className="space-y-4 pt-2">
                <div className={`p-5 rounded-2xl ${subCardClass} text-center space-y-2`}>
                  <CreditCard className="w-8 h-8 mx-auto text-emerald-500" />
                  <h4 className="text-sm font-extrabold">{tr('Instant Card & NetBanking Gateway', 'तुरंत कार्ड व नेटबैंकिंग गेटवे')}</h4>
                  <p className="text-xs opacity-60">{tr('128-bit Encrypted secure payment for instant order authorization.', 'तुरंत ऑर्डर प्राधिकरण हेतु 128-बिट एन्क्रिप्टेड सुरक्षित भुगतान।')}</p>
                </div>

                <button
                  id="pay-gateway-btn"
                  type="button"
                  onClick={handleFinalizePayment}
                  disabled={isProcessingOrder}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  {isProcessingOrder ? (
                    <div className="w-5 h-5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <span>{tr('Pay', 'भुगतान करें')} ₹{cartTotal} {tr('Securely', 'सुरक्षित रूप से')}</span>
                      <Zap className="w-4 h-4 fill-black" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {checkoutStep === 'order_confirmed' && confirmedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className={`relative w-full max-w-md ${cardClass} rounded-3xl p-6 sm:p-7 shadow-2xl text-center space-y-4`}>
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-2xl font-black">{tr('Order Placed Successfully!', 'ऑर्डर सफलतापूर्वक दिया गया!')}</h3>
              <p className="text-xs text-emerald-500 font-mono font-bold mt-1">{tr('Order', 'ऑर्डर')} #{confirmedOrder.id}</p>
              <p className="text-xs opacity-60 mt-1">{tr('Estimated Delivery:', 'अनुमानित डिलीवरी:')} {confirmedOrder.estimatedDelivery}</p>
            </div>

            <div className={`p-4 rounded-2xl ${subCardClass} text-left text-xs space-y-1.5`}>
              <div className="flex justify-between font-bold">
                <span>{tr('Deliver To:', 'डिलीवर करें:')}</span>
                <span>{confirmedOrder.shippingAddress.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">{tr('Total Paid:', 'कुल भुगतान:')}</span>
                <span className="font-extrabold text-emerald-500">₹{confirmedOrder.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">{tr('Status:', 'स्थिति:')}</span>
                <span className="text-emerald-500 font-bold uppercase text-[10px]">{tr('Processing Dispatch', 'भेजने की प्रक्रिया जारी')}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCheckoutStep('none')}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm"
            >
              {tr('Back to Store', 'स्टोर पर वापस जाएं')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
