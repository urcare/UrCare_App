import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, Star, Plus, Minus, Check, ArrowRight, ShieldCheck,
  Truck, QrCode, CreditCard, Sparkles, MapPin, X, Copy, Zap,
  Package, ChevronRight, CheckCircle2, Lock, RefreshCw, Upload, Clock, Ticket
, ShoppingCart } from 'lucide-react';
import confetti from 'canvas-confetti';
import { MyOrdersModal } from './MyOrdersModal';
import { Product, PackOption, CartItem, ShippingAddress, Order, UserAccount } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { saveOrderAndReceiptToSupabase, getProducts, getPaymentQrSettings, getMyOrders, checkStoreCoupon, getReferralStatus, ReferralStatus } from '../utils/supabase';
import { getCachedAccountState, saveAccountState } from '../utils/accountState';
import { compressImageToDataUrl } from '../utils/compressImage';

interface ProductsModuleProps {
  account: UserAccount;
  onOrderPlaced?: (newOrder: Order) => void;
  onOpenMyOrders?: () => void;
  /** This member's orders — shown in the Pharmacy's "My Orders" tab. */
  orders?: Order[];
}

// Duration packs (1/2/3 months…): each pack is added to the cart as its own
// line item — id "<product>__pack<months>" — priced at that pack's price.
const PACK_SEP = '__pack';
function packVariant(product: Product, pack: PackOption): Product {
  return {
    ...product,
    id: `${product.id}${PACK_SEP}${pack.months}`,
    name: `${product.name} — ${pack.months} Month${pack.months > 1 ? 's' : ''}`,
    price: pack.mrp && pack.mrp > pack.price ? pack.mrp : pack.price,
    discountPrice: pack.price,
    packOptions: undefined,
  };
}
/** The pack shown by default: the one marked default, else the longest in stock. */
function defaultPack(product: Product): PackOption | null {
  const available = (product.packOptions || []).filter((p) => p.inStock);
  return available.find((p) => p.isDefault) || available[available.length - 1] || null;
}
/** The store coupon — the same code as urcare.org. The server decides the discount. */
const STORE_COUPON = 'URCARE4U';
const maxCouponOff = (product: Product) => Math.max(0, ...(product.packOptions || []).filter((p) => p.inStock).map((p) => p.couponOff || 0));
const COUPON_STORAGE_KEY = 'urcare_store_coupon';
const discountPercent = (mrp: number, price: number) => (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

export const ProductsModule: React.FC<ProductsModuleProps> = ({
  account,
  onOrderPlaced,
  onOpenMyOrders,
  orders = [],
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [products, setProductsRaw] = useState<Product[]>([]);
  // The app-unlock "product" is paid on the paywall, never sold in the store.
  const setProducts = (list: Product[]) => setProductsRaw(list.filter((p) => p.id !== 'prod_app_access'));
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
  // Pharmacy sections: the shop shelf or the member's own orders (the cart opens as a drawer).
  const [pharmacyView, setPharmacyView] = useState<'shop' | 'orders'>('shop');
  // Opened from the menu's Pharmacy sub-items (Shop / Cart / My Orders) or the header cart button.
  useEffect(() => {
    const apply = (view: string | undefined) => {
      if (view === 'orders') setPharmacyView('orders');
      else if (view === 'cart') { setPharmacyView('shop'); setIsCartOpen(true); }
      else if (view === 'shop') setPharmacyView('shop');
    };
    apply((window as any).__urcarePharmacyView);
    (window as any).__urcarePharmacyView = undefined;
    const onNav = (e: Event) => { apply(String((e as CustomEvent).detail)); (window as any).__urcarePharmacyView = undefined; };
    window.addEventListener('urcare:pharmacy', onNav);
    return () => window.removeEventListener('urcare:pharmacy', onNav);
  }, []);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  // The pack picked in the details popup — starts at the default pack.
  const [selectedPackMonths, setSelectedPackMonths] = useState<number | null>(null);
  useEffect(() => { setSelectedPackMonths(selectedProductDetails ? defaultPack(selectedProductDetails)?.months ?? null : null); }, [selectedProductDetails]);
  // Tapping the product photo in the details modal opens it full-screen —
  // just the same image, zoomed, nothing invented.
  const [isImageZoomed, setIsImageZoomed] = useState(false);

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

  // The cart is saved to the account (accountState.ts) so it survives a
  // refresh, logout or switching phones. It's restored once the live catalog
  // has loaded — items that are no longer in the catalog are dropped — and
  // only saved after that, so an empty cart never overwrites a saved one
  // before it has been restored.
  const cartRestoredRef = useRef(false);
  useEffect(() => {
    if (productsLoading || cartRestoredRef.current || products.length === 0) return;
    const saved = getCachedAccountState().cart || [];
    const restored: CartItem[] = saved
      .map((item) => {
        const [baseId, months] = item.productId.split(PACK_SEP);
        const base = products.find((p) => p.id === baseId);
        const pack = months ? base?.packOptions?.find((pk) => pk.months === Number(months) && pk.inStock) : undefined;
        // A cart saved before the product got packs moves to its default pack.
        const fallback = !months && base?.packOptions?.length ? defaultPack(base) : null;
        const product = months ? (base && pack ? packVariant(base, pack) : undefined) : base && fallback ? packVariant(base, fallback) : base?.packOptions?.length ? undefined : base;
        return product && item.quantity > 0 ? { product, quantity: item.quantity } : null;
      })
      .filter(Boolean) as CartItem[];
    if (restored.length) setCart(restored);
    cartRestoredRef.current = true;
  }, [products, productsLoading]);
  useEffect(() => {
    if (!cartRestoredRef.current) return;
    saveAccountState({ cart: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) });
  }, [cart]);

  // Pre-fill the delivery address from this account's most recent order, so a
  // returning customer doesn't retype it. Never overwrites anything typed.
  useEffect(() => {
    if (!account.uid) return;
    getMyOrders(account.uid).then((orders) => {
      const last = orders.find((o) => o.shippingAddress?.streetAddress)?.shippingAddress;
      if (last) setShippingAddress((prev) => (prev.streetAddress ? prev : { ...prev, ...last }));
    }).catch(() => {});
  }, [account.uid]);

  // Pincode → City/State autofill via India Post's free public lookup — no
  // API key, no data invented: a pincode can map to several post
  // offices/localities (same district & state, different area name), so
  // those real options are shown as a pickable dropdown instead of
  // silently guessing one. City/State only ever get filled from an actual
  // selected result, never a fabricated guess.
  const [pincodeSuggestions, setPincodeSuggestions] = useState<{ name: string; district: string; state: string }[]>([]);
  const [showPincodeDropdown, setShowPincodeDropdown] = useState(false);
  const [isLookingUpPincode, setIsLookingUpPincode] = useState(false);

  const handlePincodeChange = async (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setShippingAddress((prev) => ({ ...prev, pincode: digitsOnly }));
    if (digitsOnly.length !== 6) {
      setPincodeSuggestions([]);
      setShowPincodeDropdown(false);
      return;
    }
    setIsLookingUpPincode(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${digitsOnly}`);
      const data = await res.json();
      const postOffices = data?.[0]?.Status === 'Success' ? data[0].PostOffice || [] : [];
      const suggestions = postOffices.map((po: any) => ({ name: po.Name, district: po.District, state: po.State }));
      setPincodeSuggestions(suggestions);
      if (suggestions.length === 1) {
        // Only one real match — just fill it in directly, no need to make
        // the user pick from a dropdown of one.
        setShippingAddress((prev) => ({ ...prev, city: suggestions[0].district, state: suggestions[0].state }));
        setShowPincodeDropdown(false);
      } else if (suggestions.length > 1) {
        setShowPincodeDropdown(true);
      } else {
        setShowPincodeDropdown(false);
      }
    } catch {
      // No internet / API hiccup — fields just stay manually editable, exactly as before.
      setPincodeSuggestions([]);
      setShowPincodeDropdown(false);
    } finally {
      setIsLookingUpPincode(false);
    }
  };

  const selectPincodeSuggestion = (suggestion: { name: string; district: string; state: string }) => {
    setShippingAddress((prev) => ({ ...prev, city: suggestion.district, state: suggestion.state }));
    setShowPincodeDropdown(false);
  };

  const [transactionId, setTransactionId] = useState('');
  // Payment screenshot — REQUIRED before an order can be placed; an admin
  // checks it and approves the payment before the order is confirmed.
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [isReadingScreenshot, setIsReadingScreenshot] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [qrSettings, setQrSettings] = useState<{ qrImageUrl?: string; upiId?: string; payeeName?: string }>({});
  useEffect(() => { getPaymentQrSettings().then(setQrSettings); }, []);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Store coupon (URCARE4U). The code the shopper applied is remembered on
  // this device; the discount is always re-checked by the server whenever
  // the cart changes, so it can never go stale.
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>(() => { try { return localStorage.getItem(COUPON_STORAGE_KEY) || ''; } catch { return ''; } });
  const [couponResult, setCouponResult] = useState<{ valid: boolean; discount: number; message: string } | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  useEffect(() => { try { appliedCoupon ? localStorage.setItem(COUPON_STORAGE_KEY, appliedCoupon) : localStorage.removeItem(COUPON_STORAGE_KEY); } catch {} }, [appliedCoupon]);
  const cartKey = cart.map((it) => `${it.product.id}x${it.quantity}`).join('|');
  useEffect(() => {
    if (!appliedCoupon || !cart.length) { setCouponResult(null); return; }
    let cancelled = false;
    setIsCheckingCoupon(true);
    checkStoreCoupon(appliedCoupon, cart).then((r) => { if (!cancelled) { setCouponResult(r); setIsCheckingCoupon(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCoupon, cartKey]);
  const applyCoupon = (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) { setCouponResult({ valid: false, discount: 0, message: tr('Please enter a coupon code.', 'कृपया कूपन कोड डालें।') }); return; }
    setCouponInput(c);
    setAppliedCoupon(c);
  };
  const removeCoupon = () => { setAppliedCoupon(''); setCouponInput(''); setCouponResult(null); };

  // Cart calculations
  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  // The header cart button shows this count.
  useEffect(() => { window.dispatchEvent(new CustomEvent('urcare:cart-count', { detail: totalCartItems })); }, [totalCartItems]);
  const cartSubtotal = cart.reduce((acc, item) => acc + (item.product.discountPrice || item.product.price) * item.quantity, 0);
  const couponDiscount = couponResult?.valid ? couponResult.discount : 0;
  // Referral points: ₹1 each, spent in whole 50-point blocks (same rule as the server).
  const [referral, setReferral] = useState<ReferralStatus | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  useEffect(() => { getReferralStatus().then(setReferral); }, []);
  const pointsBlock = referral?.block || 50;
  const payableBeforePoints = cartSubtotal - couponDiscount;
  const pointsAvailable = referral ? Math.max(0, Math.min(Math.floor(referral.balance / pointsBlock) * pointsBlock, Math.floor(payableBeforePoints / pointsBlock) * pointsBlock)) : 0;
  const pointsDiscount = usePoints ? pointsAvailable : 0;
  const deliveryFee = cartSubtotal > 1500 || cartSubtotal === 0 ? 0 : 99;
  const cartTotal = cartSubtotal - couponDiscount - pointsDiscount + deliveryFee;

  // UPI details come from Admin → Products & QR. With a UPI ID set, the QR
  // carries the exact cart amount; otherwise the admin's uploaded QR image is
  // shown as-is; the hardcoded ID (the same verified UrCare ID) is only a
  // last-resort default if the settings request fails.
  const upiId = qrSettings.upiId || 'archamasaini123-1@oksbi';
  const payeeName = encodeURIComponent(qrSettings.payeeName || 'UrCare');
  const usesUpiId = !!qrSettings.upiId || !qrSettings.qrImageUrl;
  // The same UPI payment link the QR encodes — opened directly, it launches
  // GPay / PhonePe / Paytm / BHIM with the payee and amount already filled in.
  const upiPayUrl = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${cartTotal}.00&cu=INR&tn=${encodeURIComponent('UrCare order')}`;
  const qrUrl = usesUpiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiPayUrl)}`
    : qrSettings.qrImageUrl;
  // Only on a phone (a desktop has no UPI app), and only when the payee is a
  // UPI ID — an admin-uploaded QR image alone has no ID to open an app with.
  const canOpenUpiApp = usesUpiId && /Android|iPhone|iPad/i.test(navigator.userAgent);

  // Instant Reliable Add to Cart
  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (product.packOptions?.length) {
      const pack = defaultPack(product);
      if (!pack) return; // every pack is out of stock
      addLineToCart(packVariant(product, pack), product.id);
      return;
    }
    addLineToCart(product, product.id);
  };

  const addLineToCart = (product: Product, animateId: string) => {
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
    setAddedAnimationId(animateId);
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

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPaymentError(null);
    setIsReadingScreenshot(true);
    try {
      setPaymentScreenshot(await compressImageToDataUrl(file));
    } catch {
      setPaymentError(tr('Could not read this image. Please choose a screenshot of your payment.', 'यह इमेज पढ़ी नहीं जा सकी। कृपया भुगतान का स्क्रीनशॉट चुनें।'));
    } finally {
      setIsReadingScreenshot(false);
    }
  };

  // Places the order with the payment screenshot. It is NOT confirmed yet —
  // it waits in the admin panel until someone verifies the payment.
  const handleFinalizePayment = async () => {
    if (!paymentScreenshot) {
      setPaymentError(tr('Please upload a screenshot of your payment first.', 'कृपया पहले अपने भुगतान का स्क्रीनशॉट अपलोड करें।'));
      return;
    }
    setPaymentError(null);
    setIsProcessingOrder(true);

    const orderPayload: Order = {
      id: 'URC-' + Math.floor(100000 + Math.random() * 900000), // display placeholder until the server assigns the real id
      userId: account.uid,
      userName: shippingAddress.fullName,
      userEmail: account.email,
      items: [...cart],
      shippingAddress,
      subtotal: cartSubtotal,
      discount: couponDiscount,
      couponCode: couponDiscount > 0 ? appliedCoupon : undefined,
      pointsUsed: pointsDiscount || undefined,
      total: cartTotal,
      paymentMethod: 'qr_upi',
      paymentStatus: 'pending',
      orderStatus: 'awaiting_payment',
      transactionId: transactionId.trim() || undefined,
      receiptImageUrl: paymentScreenshot,
      createdAt: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    const result = await saveOrderAndReceiptToSupabase(orderPayload);
    if (!result.success) {
      setPaymentError(result.error || tr('Could not place your order. Please try again.', 'ऑर्डर नहीं हो सका। कृपया दोबारा कोशिश करें।'));
      setIsProcessingOrder(false);
      return;
    }
    // The server assigns the canonical order id — that's what Admin sees too.
    const finalOrder: Order = { ...orderPayload, id: result.orderId };
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
    removeCoupon();
    setTransactionId('');
    setPaymentScreenshot(null);
    setIsCartOpen(false);
    setCheckoutStep('order_confirmed');
    setIsProcessingOrder(false);
  };

  const categories = [
    { id: 'all', label: tr('All Products', 'सभी उत्पाद') },
    { id: 'protein', label: tr('Reversal Kits & Polyherbal Medicine', 'रिवर्सल किट्स व पॉलीहर्बल औषधि') },
    { id: 'vitamins', label: tr('Vitamins & Micronutrient Support', 'विटामिन व सूक्ष्म पोषक सहयोग') },
    { id: 'superfoods', label: tr('Diet & Gut Support', 'आहार व गट सहयोग') },
    { id: 'snacks', label: tr('Diabetic-Friendly Snacks', 'डायबिटीज-अनुकूल स्नैक्स') },
    { id: 'accessories', label: tr('Monitoring & Accessories', 'मॉनिटरिंग व सहायक उपकरण') },
    { id: 'plan', label: tr('Plans & Programs', 'योजनाएं व कार्यक्रम') },
    { id: 'meals', label: tr('Meals', 'भोजन') },
    { id: 'herbal_support', label: tr('Herbal Support', 'हर्बल सहयोग') },
    { id: 'exercises', label: tr('Exercises', 'व्यायाम') },
  ];

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const cardClass = isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-sm';
  const subCardClass = isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200';
  // Driven off the app's own theme toggle (isDark), never Tailwind's dark:
  // variant (which tracks the OS/WebView's own color scheme instead) — the
  // product-details modal used to mix both, so a phone set to system dark
  // mode while the app itself was in light mode rendered white text (or no
  // color at all) on a dark: background, i.e. invisible. Every color in
  // that modal now comes from one of these, so there's only one signal to
  // ever get out of sync with.
  const textPrimary = isDark ? 'text-white' : 'text-zinc-950';
  const textSecondary = isDark ? 'text-zinc-300' : 'text-zinc-700';
  const textMuted = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const chipClass = isDark ? 'bg-zinc-900/60 border border-zinc-800/80' : 'bg-zinc-100 border border-zinc-200';

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
            {tr('UrCare Medical Pharmacy', 'UrCare मेडिकल फार्मेसी')}
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
          </div>
        </div>
      </div>

      {pharmacyView === 'orders' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-base font-black text-zinc-900"><Package className="w-5 h-5 text-emerald-600" />{tr('My Orders & history', 'मेरे ऑर्डर व हिस्ट्री')}</h3>
            <button type="button" onClick={() => setPharmacyView('shop')} className="px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-black cursor-pointer hover:bg-emerald-50">{tr('← Back to shop', '← शॉप पर वापस')}</button>
          </div>
          <MyOrdersModal isOpen inline orders={orders} onClose={() => {}} onOpenStore={() => setPharmacyView('shop')} />
        </section>
      ) : (
      <>
      {/* Coupon banner — same offer as urcare.org */}
      <div className="rounded-2xl bg-white border border-amber-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Ticket className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">{tr('Limited offer', 'सीमित ऑफ़र')}</div>
            <div className="text-sm font-black text-zinc-900">{tr('Unlock an exclusive discount', 'खास छूट पाएं')}</div>
            <div className="text-xs text-zinc-500">{tr('Use code', 'कोड लगाएं')} <span className="font-black text-emerald-700">{STORE_COUPON}</span> {tr('on reversal kits and 2–3 month packs.', 'रिवर्सल किट्स और 2–3 महीने के पैक पर।')}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { applyCoupon(STORE_COUPON); setIsCartOpen(true); }}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer shrink-0"
        >
          {appliedCoupon === STORE_COUPON ? tr('Applied ✓ — view cart', 'लगा दिया ✓ — कार्ट देखें') : tr('Apply to cart', 'कार्ट में लगाएं')}
        </button>
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
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : subCardClass + ' opacity-70 hover:opacity-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

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
                <div className="relative w-full aspect-[5/4] rounded-2xl overflow-hidden bg-white border border-zinc-100 mb-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                  />
                  {(product.badge || product.featured) && (
                    <span className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-white text-[10px] font-black uppercase tracking-wider shadow-sm ${product.badge === 'Fast Selling' ? 'bg-orange-500' : 'bg-emerald-600'}`}>
                      {product.badge ? tr(product.badge, product.badge === 'Bestseller' ? 'बेस्टसेलर' : product.badge === 'Fast Selling' ? 'तेज़ी से बिक रहा' : product.badge) : tr('Top Choice', 'सर्वश्रेष्ठ पसंद')}
                    </span>
                  )}
                  {(() => {
                    const pack = product.packOptions?.length ? defaultPack(product) : null;
                    const off = product.packOptions?.length ? (pack ? discountPercent(pack.mrp || pack.price, pack.price) : 0) : discountPercent(product.price, product.discountPrice);
                    return off > 0 ? (
                      <span className="absolute top-2 right-2 px-2 py-1 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-sm">
                        {off}% {tr('OFF', 'छूट')}
                      </span>
                    ) : null;
                  })()}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-zinc-200 text-[11px] font-bold text-amber-600 shadow-sm">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{product.rating}</span>
                    <span className="text-[10px] text-zinc-500 font-normal">({product.reviewsCount})</span>
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
                {(() => {
                  const pack = product.packOptions?.length ? defaultPack(product) : null;
                  if (product.packOptions?.length) {
                    return pack ? (
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">₹{pack.price.toLocaleString('en-IN')}</span>
                          {pack.mrp && pack.mrp > pack.price && <span className="text-[11px] opacity-50 line-through">₹{pack.mrp.toLocaleString('en-IN')}</span>}
                        </div>
                        <div className="text-[11px] opacity-60">{pack.months > 1 ? `${pack.months} ${tr('months', 'महीने')} · ₹${Math.round(pack.price / pack.months).toLocaleString('en-IN')}/${tr('month', 'महीना')}` : tr('1 month', '1 महीना')}</div>
                        {maxCouponOff(product) > 0 && (
                          <div className="text-[11px] font-bold text-amber-700">{tr(`Save up to ₹${maxCouponOff(product).toLocaleString('en-IN')} with ${STORE_COUPON}`, `${STORE_COUPON} से ₹${maxCouponOff(product).toLocaleString('en-IN')} तक बचाएं`)}</div>
                        )}
                      </div>
                    ) : <div className="text-xs font-bold text-rose-500">{tr('Out of stock', 'स्टॉक में नहीं')}</div>;
                  }
                  return (
                    <div>
                      <div className="text-base font-black text-emerald-600 dark:text-emerald-400">₹{product.discountPrice.toLocaleString('en-IN')}</div>
                      {product.price > product.discountPrice && <div className="text-[11px] opacity-50 line-through">₹{product.price.toLocaleString('en-IN')}</div>}
                    </div>
                  );
                })()}

                <button
                  id={`add-btn-${product.id}`}
                  type="button"
                  onClick={(e) => handleAddToCart(e, product)}
                  className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ${
                    isAdded
                      ? 'bg-white text-emerald-700 border border-emerald-300'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
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
      </>
      )}

      {/* PRODUCT DETAILS MODAL (CLICK TO READ & EXPLORE FULL DETAILS) */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/30 backdrop-blur-sm overflow-y-auto">
          <div className={`relative w-full max-w-xl ${cardClass} rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 text-left max-h-[92vh] overflow-y-auto`}>
            <button
              type="button"
              onClick={() => setSelectedProductDetails(null)}
              className={`absolute top-4 right-4 p-2 rounded-full ${subCardClass} opacity-70 hover:opacity-100 cursor-pointer`}
            >
              <X className={`w-5 h-5 ${textPrimary}`} />
            </button>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => setIsImageZoomed(true)}
                className="w-full sm:w-56 aspect-[5/4] rounded-2xl overflow-hidden bg-white border border-zinc-100 shrink-0 cursor-zoom-in relative group"
                aria-label={tr('View full-size photo', 'पूरी फोटो देखें')}
              >
                <img
                  src={selectedProductDetails.image}
                  alt={selectedProductDetails.name}
                  className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                />
              </button>

              <div className="space-y-1.5 flex-1 min-w-0">
                <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {selectedProductDetails.category.toUpperCase()}
                </span>

                <h3 className={`text-lg sm:text-xl font-black leading-tight ${textPrimary}`}>
                  {selectedProductDetails.name}
                </h3>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{selectedProductDetails.rating}</span>
                  </div>
                  <span className={`text-xs ${textMuted}`}>({selectedProductDetails.reviewsCount} {tr('verified reviews', 'सत्यापित समीक्षाएं')})</span>
                </div>

                {selectedProductDetails.packOptions?.length ? (
                  <div className="pt-1 space-y-1.5">
                    <div className={`text-[11px] font-black uppercase tracking-wider ${textMuted}`}>{tr('Choose duration', 'अवधि चुनें')}</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedProductDetails.packOptions.map((pk) => (
                        <button
                          key={pk.months}
                          type="button"
                          disabled={!pk.inStock}
                          onClick={() => setSelectedPackMonths(pk.months)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold text-left ${
                            !pk.inStock ? 'opacity-40 cursor-not-allowed border-zinc-200' : selectedPackMonths === pk.months ? 'border-emerald-500 bg-emerald-50 text-emerald-800 cursor-pointer' : 'border-zinc-200 hover:border-emerald-300 cursor-pointer'
                          }`}
                        >
                          <div>{pk.months} {tr(pk.months > 1 ? 'Months' : 'Month', 'महीने')}</div>
                          <div className="text-[10px] font-semibold opacity-70">{pk.inStock ? `₹${pk.price.toLocaleString('en-IN')}` : tr('Out of stock', 'स्टॉक में नहीं')}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(() => {
                  const pack = selectedProductDetails.packOptions?.find((pk) => pk.months === selectedPackMonths && pk.inStock);
                  const price = pack ? pack.price : selectedProductDetails.discountPrice;
                  const mrp = pack ? (pack.mrp || pack.price) : selectedProductDetails.price;
                  const off = discountPercent(mrp, price);
                  return (
                    <div className="flex items-baseline gap-2 pt-1 flex-wrap">
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹{price.toLocaleString('en-IN')}</span>
                      {off > 0 && <span className={`text-xs line-through ${textMuted}`}>₹{mrp.toLocaleString('en-IN')}</span>}
                      {off > 0 && <span className="text-xs font-bold text-rose-500">{off}% {tr('OFF', 'छूट')}</span>}
                      {pack && pack.months > 1 && <span className={`text-xs ${textMuted}`}>(₹{Math.round(pack.price / pack.months).toLocaleString('en-IN')}/{tr('month', 'महीना')})</span>}
                      {pack?.couponOff ? (
                        <span className="basis-full text-xs font-bold text-amber-700">
                          {tr(`Use ${STORE_COUPON} to save ₹${pack.couponOff.toLocaleString('en-IN')} more → pay ₹${(pack.price - pack.couponOff).toLocaleString('en-IN')}`, `${STORE_COUPON} लगाकर ₹${pack.couponOff.toLocaleString('en-IN')} और बचाएं → ₹${(pack.price - pack.couponOff).toLocaleString('en-IN')} दें`)}
                        </span>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Full Description */}
            <div className={`p-4 rounded-2xl ${subCardClass} space-y-1.5`}>
              <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>{tr('About this product', 'इस उत्पाद के बारे में')}</span>
              <p className={`text-xs sm:text-[13px] leading-relaxed ${textSecondary}`}>
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
                    <div key={idx} className={`flex items-center gap-2 text-xs sm:text-[13px] font-medium p-2.5 rounded-xl ${chipClass} ${textSecondary}`}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nutritional Details if present */}
            {selectedProductDetails.nutritionInfo && (
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {tr('Nutritional Breakdown', 'पोषण विवरण')} <span className={`normal-case font-semibold ${textMuted}`}>({selectedProductDetails.nutritionInfo.servingSize})</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  {[
                    { label: tr('Calories', 'कैलोरी'), value: selectedProductDetails.nutritionInfo.calories, unit: '', color: textPrimary },
                    { label: tr('Protein', 'प्रोटीन'), value: selectedProductDetails.nutritionInfo.protein, unit: 'g', color: 'text-emerald-500' },
                    { label: tr('Carbs', 'कार्ब्स'), value: selectedProductDetails.nutritionInfo.carbs, unit: 'g', color: textPrimary },
                    { label: tr('Fats', 'फैट्स'), value: selectedProductDetails.nutritionInfo.fats, unit: 'g', color: textPrimary },
                  ].map((stat) => (
                    <div key={stat.label} className={`p-2.5 sm:p-3 rounded-xl ${subCardClass}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wide block mb-0.5 ${textMuted}`}>{stat.label}</span>
                      <span className={`font-black text-base sm:text-lg ${stat.color}`}>{stat.value}{stat.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add to Cart Footer inside Modal */}
            <div className={`pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3`}>
              <button
                type="button"
                onClick={() => setSelectedProductDetails(null)}
                className={`px-5 py-3 rounded-xl border font-bold text-xs cursor-pointer transition-colors ${textSecondary} ${isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
              >
                {tr('Close', 'बंद करें')}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const pack = selectedProductDetails.packOptions?.find((pk) => pk.months === selectedPackMonths && pk.inStock);
                  if (selectedProductDetails.packOptions?.length && !pack) return;
                  addLineToCart(pack ? packVariant(selectedProductDetails, pack) : selectedProductDetails, selectedProductDetails.id);
                  setSelectedProductDetails(null);
                  setIsCartOpen(true);
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="truncate">{tr('Add to Cart & Checkout', 'कार्ट में जोड़ें व चेकआउट करें')} (₹{(selectedProductDetails.packOptions?.find((pk) => pk.months === selectedPackMonths)?.price ?? selectedProductDetails.discountPrice).toLocaleString('en-IN')})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN PHOTO VIEWER — same image, just zoomed; tap anywhere to close */}
      {isImageZoomed && selectedProductDetails && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-white/95 animate-in fade-in cursor-zoom-out"
          onClick={() => setIsImageZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setIsImageZoomed(false)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            aria-label={tr('Close', 'बंद करें')}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedProductDetails.image}
            alt={selectedProductDetails.name}
            className="max-w-full max-h-full object-contain rounded-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* CART DRAWER / MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-900/30 backdrop-blur-sm">
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
                      className="w-12 h-12 rounded-lg object-contain bg-white border border-zinc-100 shrink-0"
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
                <div className="space-y-1.5">
                  {appliedCoupon && couponResult?.valid ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                      <span className="font-bold text-emerald-800 flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" />{appliedCoupon} {tr('applied', 'लगा')}</span>
                      <button type="button" onClick={removeCoupon} className="font-bold text-rose-600 cursor-pointer">{tr('Remove', 'हटाएं')}</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(couponInput); }}
                        placeholder={tr('Coupon code', 'कूपन कोड')}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-900 text-xs font-bold uppercase outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => applyCoupon(couponInput)}
                        disabled={isCheckingCoupon}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer disabled:opacity-60"
                      >
                        {isCheckingCoupon ? '…' : tr('Apply', 'लगाएं')}
                      </button>
                    </div>
                  )}
                  {couponResult && !couponResult.valid ? (
                    <p className="text-[11px] text-rose-600 px-1">{couponResult.message}</p>
                  ) : couponResult?.valid ? (
                    <p className="text-[11px] text-emerald-700 px-1">{couponResult.message}</p>
                  ) : (
                    <p className="text-[11px] text-zinc-500 px-1">{tr('Use', 'कोड')} <span className="font-black text-emerald-700">{STORE_COUPON}</span> {tr('for an exclusive discount', 'लगाकर खास छूट पाएं')}</p>
                  )}
                  {referral && referral.balance > 0 && (
                    <label className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs cursor-pointer ${pointsAvailable ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200 opacity-70 cursor-not-allowed'}`}>
                      <input type="checkbox" checked={usePoints && !!pointsAvailable} disabled={!pointsAvailable} onChange={(e) => setUsePoints(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-black text-emerald-800">{tr(`Use ${pointsAvailable || pointsBlock} points (₹${pointsAvailable || pointsBlock} off)`, `${pointsAvailable || pointsBlock} पॉइंट्स लगाएं (₹${pointsAvailable || pointsBlock} छूट)`)}</span>
                        <span className="block text-[10px] font-semibold text-emerald-600/80">{pointsAvailable ? tr(`You have ${referral.balance} points`, `आपके पास ${referral.balance} पॉइंट्स हैं`) : tr(`Add ₹${pointsBlock}+ to your cart to use points`, `पॉइंट्स के लिए कार्ट ₹${pointsBlock}+ का करें`)}</span>
                      </span>
                    </label>
                  )}
                </div>
                <div className="space-y-1 text-xs opacity-80">
                  <div className="flex justify-between">
                    <span>{tr('Subtotal', 'उप-योग')}</span>
                    <span className="font-bold">₹{cartSubtotal}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>{tr('Coupon discount', 'कूपन छूट')}</span>
                      <span>−₹{couponDiscount}</span>
                    </div>
                  )}
                  {pointsDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>{tr('Referral points', 'रेफ़रल पॉइंट्स')}</span>
                      <span>−₹{pointsDiscount}</span>
                    </div>
                  )}
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
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/30 backdrop-blur-sm overflow-y-auto">
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

              <div className="relative">
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
                    <label className="text-xs font-bold opacity-75 mb-1 flex items-center gap-1">
                      <span>{tr('Pincode', 'पिनकोड')} *</span>
                      {isLookingUpPincode && <RefreshCw className="w-3 h-3 animate-spin opacity-60" />}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={shippingAddress.pincode}
                      onChange={(e) => handlePincodeChange(e.target.value)}
                      onFocus={() => { if (pincodeSuggestions.length > 1) setShowPincodeDropdown(true); }}
                      placeholder="6-digit"
                      className={`w-full p-2.5 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                    />
                  </div>
                </div>

                {/* Pincode → area dropdown — a real pincode can map to
                    several localities (same city/state, different post
                    office name); picking one fills City & State, never
                    invented, always from this actual lookup. */}
                {showPincodeDropdown && pincodeSuggestions.length > 1 && (
                  <div className={`absolute z-10 right-0 top-full mt-1 w-full max-w-55 rounded-xl border shadow-lg max-h-48 overflow-y-auto ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'}`}>
                    <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {tr('Select your area', 'अपना क्षेत्र चुनें')}
                    </div>
                    {pincodeSuggestions.map((s, i) => (
                      <button
                        key={`${s.name}-${i}`}
                        type="button"
                        onClick={() => selectPincodeSuggestion(s)}
                        className={`w-full text-left px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-zinc-50 text-zinc-800'}`}
                      >
                        <div className="font-bold">{s.name}</div>
                        <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{s.district}, {s.state}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 mt-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/30 backdrop-blur-sm overflow-y-auto">
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

            {/* Payment method — UPI QR is the only live option; card /
                netbanking via Razorpay is shown as "coming soon" and can't be
                selected yet. */}
            <div className="grid grid-cols-2 gap-2">
              <div className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border bg-emerald-500 text-white border-emerald-400 shadow-md">
                <QrCode className="w-4 h-4" />
                <span>{tr('UPI QR / App', 'UPI QR / ऐप')}</span>
              </div>
              <div
                aria-disabled="true"
                className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center border opacity-60 cursor-not-allowed ${subCardClass}`}
              >
                <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" />{tr('Cards / NetBanking', 'कार्ड / नेटबैंकिंग')}</span>
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 mt-0.5">{tr('Coming soon', 'जल्द आ रहा है')}</span>
              </div>
            </div>

            <div className="space-y-3">
              {canOpenUpiApp && (
                <a
                  href={upiPayUrl}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex flex-col items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4 fill-white" />
                    {tr(`Step 1: Pay ₹${cartTotal} with UPI app`, `चरण 1: UPI ऐप से ₹${cartTotal} भुगतान करें`)}
                  </span>
                  <span className="text-[10px] font-bold opacity-70">{tr('Opens GPay, PhonePe, Paytm or BHIM with the amount filled in', 'GPay, PhonePe, Paytm या BHIM राशि भरी हुई के साथ खुलेगा')}</span>
                </a>
              )}
              <div className="p-4 rounded-2xl bg-white flex flex-col items-center justify-center text-center shadow-md">
                <img
                  src={qrUrl}
                  alt="UPI QR Code"
                  className="w-40 h-40 object-contain rounded-lg"
                />
                <div className="mt-2 text-black">
                  <p className="text-xs font-bold">
                    {canOpenUpiApp
                      ? tr('Or scan this QR from another phone', 'या किसी दूसरे फ़ोन से यह QR स्कैन करें')
                      : tr('Step 1: Scan & pay via GPay, PhonePe, Paytm, BHIM', 'चरण 1: GPay, PhonePe, Paytm, BHIM से स्कैन कर भुगतान करें')}
                  </p>
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

              {/* Step 2 — payment screenshot (required) */}
              <div>
                <label className="block text-xs font-bold opacity-75 mb-1">
                  {tr('Step 2: Upload payment screenshot (required)', 'चरण 2: भुगतान का स्क्रीनशॉट अपलोड करें (ज़रूरी)')}
                </label>
                <label
                  htmlFor="payment-screenshot-input"
                  className={`block p-3 rounded-xl border-2 border-dashed cursor-pointer text-center transition-colors ${
                    paymentScreenshot ? 'border-emerald-500' : isDark ? 'border-zinc-700 hover:border-emerald-500' : 'border-zinc-300 hover:border-emerald-500'
                  }`}
                >
                  {isReadingScreenshot ? (
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin opacity-60" />
                  ) : paymentScreenshot ? (
                    <div className="flex items-center gap-3 text-left">
                      <img src={paymentScreenshot} alt="" className="w-14 h-14 object-cover rounded-lg border border-zinc-200" />
                      <div className="text-xs">
                        <div className="font-bold text-emerald-500 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {tr('Screenshot added', 'स्क्रीनशॉट जुड़ गया')}</div>
                        <div className="opacity-60">{tr('Tap to change', 'बदलने के लिए टैप करें')}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs space-y-1">
                      <Upload className="w-5 h-5 mx-auto text-emerald-500" />
                      <div className="font-bold">{tr('Tap to upload the payment screenshot', 'भुगतान स्क्रीनशॉट अपलोड करने हेतु टैप करें')}</div>
                      <div className="opacity-60">{tr('It must show the amount and the UPI transaction ID', 'इसमें राशि और UPI ट्रांज़ैक्शन ID दिखनी चाहिए')}</div>
                    </div>
                  )}
                </label>
                <input
                  id="payment-screenshot-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleScreenshotChange}
                />
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

              {paymentError && (
                <p className="text-xs font-bold text-rose-500">{paymentError}</p>
              )}

              <button
                id="pay-and-confirm-upi-btn"
                type="button"
                onClick={handleFinalizePayment}
                disabled={isProcessingOrder || isReadingScreenshot || !paymentScreenshot}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              >
                {isProcessingOrder ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <span>{tr('Submit Payment for Verification', 'भुगतान सत्यापन हेतु भेजें')}</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-[11px] opacity-60 text-center">
                {tr('Your order is confirmed once our team verifies the payment (usually within a few hours).', 'हमारी टीम द्वारा भुगतान सत्यापित होते ही आपका ऑर्डर कन्फ़र्म हो जाएगा (आमतौर पर कुछ घंटों में)।')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {checkoutStep === 'order_confirmed' && confirmedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/30 backdrop-blur-sm overflow-y-auto">
          <div className={`relative w-full max-w-md ${cardClass} rounded-3xl p-6 sm:p-7 shadow-2xl text-center space-y-4`}>
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-2xl font-black">{tr('Order Received!', 'ऑर्डर मिल गया!')}</h3>
              <p className="text-xs text-emerald-500 font-mono font-bold mt-1">{tr('Order', 'ऑर्डर')} #{confirmedOrder.id}</p>
              <p className="text-xs opacity-60 mt-1">{tr('We are verifying your payment screenshot. You will get a notification as soon as your order is confirmed.', 'हम आपके भुगतान स्क्रीनशॉट की जाँच कर रहे हैं। ऑर्डर कन्फ़र्म होते ही आपको सूचना मिलेगी।')}</p>
            </div>

            <div className={`p-4 rounded-2xl ${subCardClass} text-left text-xs space-y-1.5`}>
              <div className="flex justify-between font-bold">
                <span>{tr('Deliver To:', 'डिलीवर करें:')}</span>
                <span>{confirmedOrder.shippingAddress.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">{tr('Amount:', 'राशि:')}</span>
                <span className="font-extrabold text-emerald-500">₹{confirmedOrder.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">{tr('Status:', 'स्थिति:')}</span>
                <span className="text-amber-500 font-bold uppercase text-[10px]">{tr('Payment verification pending', 'भुगतान सत्यापन बाकी')}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCheckoutStep('none')}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm"
            >
              {tr('Back to Store', 'स्टोर पर वापस जाएं')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
