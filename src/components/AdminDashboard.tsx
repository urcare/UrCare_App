import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Users, Crown, ShoppingBag, Star, FileText,
  DollarSign, CheckCircle2, AlertTriangle, Eye, Plus, Send,
  QrCode, Edit, ArrowRight, Lock, LogOut, Sparkles, Filter,
  Truck, Check, Stethoscope, Search, ExternalLink, RefreshCw, Upload, X,
  Zap, ChevronRight, HelpCircle, Save, Activity, HeartPulse, Trash2, Image as ImageIcon, Tag, Package,
  User, Target, Flame, Droplets, Scale, Calendar
} from 'lucide-react';
import {
  AdminStats, MedicalReportAnalysis, Order, Prescription,
  UserReview, Product, Biomarker, UserHealthProfile, UserAccount
} from '../types';
import { 
  INITIAL_ADMIN_STATS, INITIAL_USER_REPORTS_FOR_ADMIN, 
  INITIAL_PRESCRIPTIONS, INITIAL_REVIEWS, INITIAL_ORDERS 
} from '../data/mockAdminData';
import { INITIAL_PRODUCTS } from '../data/products';
import { Logo } from './Logo';
import { ReportPhotoViewer } from './ReportPhotoViewer';

interface AdminDashboardProps {
  onExitAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExitAdmin }) => {
  // Authentication State (Admin Only Barrier)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'patients' | 'reports' | 'orders' | 'products_qr' | 'reviews'>('overview');

  // Stats & Data
  const [stats, setStats] = useState<AdminStats>(INITIAL_ADMIN_STATS);
  const [reports, setReports] = useState<MedicalReportAnalysis[]>(INITIAL_USER_REPORTS_FOR_ADMIN);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(INITIAL_PRESCRIPTIONS);
  const [reviews, setReviews] = useState<UserReview[]>(INITIAL_REVIEWS);
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const stored = localStorage.getItem('urcare_products');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_PRODUCTS;
  });

  // Product Manager Modal and Search State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productSearchQuery, setProductSearchQuery] = useState('');

  const PRESET_PRODUCT_PHOTOS = [
    { name: 'Whey Isolate', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800' },
    { name: 'Plant Protein', url: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&q=80&w=800' },
    { name: 'Omega-3 Fish Oil', url: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=800' },
    { name: 'Multivitamins & Zinc', url: 'https://images.unsplash.com/photo-1550572017-ed200f5e6343?auto=format&fit=crop&q=80&w=800' },
    { name: 'Ashwagandha Extract', url: 'https://images.unsplash.com/photo-1616671285442-1e96a4d7d1e8?auto=format&fit=crop&q=80&w=800' },
    { name: 'Chia & Super Seeds', url: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&q=80&w=800' },
    { name: 'Smart Shaker Cup', url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=800' }
  ];

  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    category: 'protein' as 'protein' | 'vitamins' | 'superfoods' | 'snacks' | 'accessories',
    price: 1999,
    discountPrice: 1499,
    image: PRESET_PRODUCT_PHOTOS[0].url,
    description: '',
    benefitsText: '',
    servingSize: '1 Scoop (33g)',
    calories: 120,
    protein: 25,
    carbs: 2,
    fats: 1.5,
    inStock: true,
    featured: false,
  });

  const saveProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    try {
      localStorage.setItem('urcare_products', JSON.stringify(newProducts));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('Failed to save products to localStorage:', e);
    }
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      id: 'prod_' + Date.now(),
      name: '',
      category: 'protein',
      price: 1999,
      discountPrice: 1499,
      image: PRESET_PRODUCT_PHOTOS[0].url,
      description: '',
      benefitsText: '100% Ultra-Filtered, Zero Added Sugar, Lab Tested for Purity',
      servingSize: '1 Scoop (33g)',
      calories: 120,
      protein: 25,
      carbs: 2,
      fats: 1.5,
      inStock: true,
      featured: false,
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      discountPrice: p.discountPrice || p.price,
      image: p.image,
      description: p.description || '',
      benefitsText: (p.benefits || []).join(', '),
      servingSize: p.nutritionInfo?.servingSize || '1 Serving',
      calories: p.nutritionInfo?.calories || 100,
      protein: p.nutritionInfo?.protein || 20,
      carbs: p.nutritionInfo?.carbs || 5,
      fats: p.nutritionInfo?.fats || 1,
      inStock: p.inStock !== false,
      featured: !!p.featured,
    });
    setIsProductModalOpen(true);
  };

  const handleProductPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setProductForm(prev => ({ ...prev, image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const benefitsArray = productForm.benefitsText
      .split(/,|\n/)
      .map(b => b.trim())
      .filter(Boolean);

    const newOrUpdatedProduct: Product = {
      id: productForm.id || ('prod_' + Date.now()),
      name: productForm.name.trim() || 'UrCare Clinical Product',
      category: productForm.category,
      price: Number(productForm.price) || 999,
      discountPrice: Number(productForm.discountPrice) || Number(productForm.price) || 799,
      rating: editingProduct ? editingProduct.rating : 4.9,
      reviewsCount: editingProduct ? editingProduct.reviewsCount : 14,
      image: productForm.image || PRESET_PRODUCT_PHOTOS[0].url,
      description: productForm.description.trim() || 'Clinical grade nutrition formulated for optimal bioavailability and metabolic health.',
      benefits: benefitsArray.length > 0 ? benefitsArray : ['Clinical Grade Bioavailability', 'Doctor Formulated', '100% Pure & Lab Tested'],
      nutritionInfo: {
        servingSize: productForm.servingSize || '1 Serving',
        calories: Number(productForm.calories) || 0,
        protein: Number(productForm.protein) || 0,
        carbs: Number(productForm.carbs) || 0,
        fats: Number(productForm.fats) || 0,
      },
      inStock: productForm.inStock,
      featured: productForm.featured,
    };

    let updatedList: Product[];
    if (editingProduct) {
      updatedList = products.map(p => p.id === editingProduct.id ? newOrUpdatedProduct : p);
    } else {
      updatedList = [newOrUpdatedProduct, ...products];
    }

    saveProducts(updatedList);
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product from the store catalog?')) {
      const updated = products.filter(p => p.id !== productId);
      saveProducts(updated);
    }
  };

  const handleToggleStock = (productId: string) => {
    const updated = products.map(p => p.id === productId ? { ...p, inStock: !p.inStock } : p);
    saveProducts(updated);
  };

  // Search & Filter for Reports
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportFilterStatus, setReportFilterStatus] = useState<'all' | 'pending' | 'reviewed' | 'high_risk'>('all');
  const [selectedReportForView, setSelectedReportForView] = useState<MedicalReportAnalysis | null>(null);

  // QR Code Settings
  const [qrSettings, setQrSettings] = useState({
    qrImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=urcare.official@okhdfcbank&pn=UrCare%20Nutrition&mc=5411&cu=INR',
    upiId: 'urcare.official@okhdfcbank',
    payeeName: 'UrCare Health & Clinical Nutrition Inc.',
    merchantNote: 'Scan & Pay via any UPI App (GPay, PhonePe, Paytm, BHIM)',
  });
  const [isUpdatingQr, setIsUpdatingQr] = useState(false);
  const [qrSuccessMessage, setQrSuccessMessage] = useState('');

  // Prescription modal state
  const [selectedReportForRx, setSelectedReportForRx] = useState<MedicalReportAnalysis | null>(null);
  const [rxDiagnosis, setRxDiagnosis] = useState('');
  const [rxMedicines, setRxMedicines] = useState<{ name: string; dosage: string; frequency: string; duration: string; notes: string }[]>([
    { name: '', dosage: '', frequency: '', duration: '', notes: '' }
  ]);
  const [rxSupplements, setRxSupplements] = useState<string>('UrCare 100% Pure Whey Isolate, Triple Strength Omega-3');
  const [rxNotes, setRxNotes] = useState('');
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

  // AI Scanning state
  const [isAiScanningReport, setIsAiScanningReport] = useState<string | null>(null);

  // Load user reports from localStorage + server
  const loadAllReports = () => {
    try {
      const stored = localStorage.getItem('urcare_lab_reports');
      const userUploaded: MedicalReportAnalysis[] = stored ? JSON.parse(stored) : [];

      const mergedMap = new Map<string, MedicalReportAnalysis>();
      userUploaded.forEach(r => { if (r.id) mergedMap.set(r.id, r); });
      INITIAL_USER_REPORTS_FOR_ADMIN.forEach(r => { if (r.id && !mergedMap.has(r.id)) mergedMap.set(r.id, r); });

      setReports(Array.from(mergedMap.values()));
    } catch (e) {
      console.warn('Error loading reports from store:', e);
    }
  };

  // The real signed-up account on this device — same localStorage the live app writes to,
  // so onboarding data, the 22-module Root-Cause Assessment, and Pro status show up here
  // exactly as the patient sees them, instead of disconnected demo records.
  const [realPatient, setRealPatient] = useState<{ profile: UserHealthProfile; account: UserAccount } | null>(null);
  const [patientMealDays, setPatientMealDays] = useState(0);
  const [patientTasksDone, setPatientTasksDone] = useState(0);

  const loadRealPatient = () => {
    try {
      const storedProfile = localStorage.getItem('urcare_user_profile');
      const storedAccount = localStorage.getItem('urcare_user_account');
      if (storedProfile && storedAccount) {
        setRealPatient({ profile: JSON.parse(storedProfile), account: JSON.parse(storedAccount) });
      } else {
        setRealPatient(null);
      }
    } catch (e) {
      setRealPatient(null);
    }

    try {
      const mealLog = JSON.parse(localStorage.getItem('urcare_meal_log') || '{}');
      setPatientMealDays(Object.keys(mealLog).filter((k) => mealLog[k]?.length).length);
    } catch (e) {
      setPatientMealDays(0);
    }

    try {
      const taskLog = JSON.parse(localStorage.getItem('urcare_daily_task_completion') || '{}');
      const total = Object.values(taskLog as Record<string, Record<string, boolean>>)
        .reduce((sum, day) => sum + Object.values(day).filter(Boolean).length, 0);
      setPatientTasksDone(total);
    } catch (e) {
      setPatientTasksDone(0);
    }
  };

  // Load latest from backend if available
  useEffect(() => {
    loadAllReports();
    loadRealPatient();

    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.totalUsers) setStats((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});

    fetch('/api/admin/orders')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.orders && data.orders.length > 0) setOrders(data.orders);
      })
      .catch(() => {});

    fetch('/api/admin/qr-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.qrImageUrl) setQrSettings(data);
      })
      .catch(() => {});
  }, []);

  const handleAdminLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const emailNorm = adminEmail.trim().toLowerCase();
    const pass = adminPassword.trim();

    // Accepted admin emails and passwords
    const validEmails = ['admin@urcare.app', 'admin@urcare.com', 'admin@cal.ai', 'admin'];
    const validPasswords = ['admin123', '8899', 'urcare2025', 'admin', '123456'];

    if (
      validPasswords.includes(pass) ||
      (validEmails.includes(emailNorm) && (pass === 'admin123' || pass === '8899' || pass === 'admin')) ||
      emailNorm.includes('admin')
    ) {
      setIsAdminLoggedIn(true);
      setLoginError('');
      loadAllReports();
      loadRealPatient();
    } else {
      setLoginError('Access restricted: Invalid admin credentials. Use admin@urcare.app with password admin123 or PIN 8899.');
    }
  };

  const handle1ClickDemoLogin = () => {
    setAdminEmail('admin@urcare.app');
    setAdminPassword('admin123');
    setIsAdminLoggedIn(true);
    setLoginError('');
    loadAllReports();
    loadRealPatient();
  };

  const handleStatusChange = async (orderId: string, newStatus: 'confirmed' | 'processing' | 'shipped' | 'delivered') => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, orderStatus: newStatus } : o))
    );
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: newStatus }),
      });
    } catch (e) {}
  };

  const handleScanReportWithAi = async (reportId: string) => {
    setIsAiScanningReport(reportId);
    try {
      const report = reports.find((r) => r.id === reportId);
      const res = await fetch('/api/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportText: report?.summary || 'Comprehensive blood and lipid panel',
          reportType: report?.reportName || 'Blood Test',
        }),
      });
      const data = await res.json();
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                summary: data.summary || r.summary,
                biomarkers: data.biomarkers || r.biomarkers,
                identifiedRisks: data.identifiedRisks || r.identifiedRisks,
                dietaryRecommendations: data.dietaryRecommendations || r.dietaryRecommendations,
              }
            : r
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiScanningReport(null);
    }
  };

  const handleOpenRxModal = (report: MedicalReportAnalysis) => {
    setSelectedReportForRx(report);
    setRxDiagnosis(report.identifiedRisks?.join(', ') || 'Metabolic Optimization & Nutrient Support');
    setRxMedicines([
      { name: 'Ferrous Ascorbate + Folic Acid', dosage: '100mg', frequency: 'Once daily after lunch', duration: '30 Days', notes: 'Take with lemon water for high absorption' },
      { name: 'Vitamin D3 Cholecalciferol', dosage: '60,000 IU', frequency: 'Once weekly for 8 weeks', duration: '8 Weeks', notes: 'Supports bone density and metabolism' },
    ]);
    setRxNotes('Patient advised to follow daily protein target and take omega-3 supplements.');
  };

  // Issue a prescription directly for the real signed-in patient (no lab report needed) —
  // reuses the same Rx form/modal, just seeded from their live profile / root-cause data.
  const handleOpenRxForPatient = () => {
    if (!realPatient) return;
    const { profile, account } = realPatient;
    const stubReport: MedicalReportAnalysis = {
      id: undefined,
      userId: account.uid,
      userName: profile.name || account.displayName,
      reportName: 'Direct Clinical Consultation',
      uploadedAt: new Date().toISOString(),
      summary: profile.assessmentData?.mainHealthConcern || 'General metabolic health consultation.',
      biomarkers: [],
      identifiedRisks: profile.medicalConditions || [],
      dietaryRecommendations: [],
      macroAdjustments: { keyNutrientsToBoost: [], foodsToAvoid: [] },
    };
    setSelectedReportForRx(stubReport);
    setRxDiagnosis(profile.assessmentData?.mainHealthConcern || profile.medicalConditions?.join(', ') || 'Metabolic Optimization & Nutrient Support');
    setRxMedicines([{ name: '', dosage: '', frequency: '', duration: '', notes: '' }]);
    setRxNotes(`Personalized for ${profile.goal?.replace('_', ' ') || 'health goal'}, ${profile.dietaryPreference || 'balanced'} diet.`);
  };

  const handleAddMedicineRow = () => {
    setRxMedicines((prev) => [...prev, { name: '', dosage: '', frequency: '', duration: '', notes: '' }]);
  };

  const handleRemoveMedicineRow = (index: number) => {
    setRxMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportForRx) return;
    setIsSubmittingRx(true);
    try {
      const rxPayload = {
        userId: selectedReportForRx.userId,
        userName: selectedReportForRx.userName,
        reportId: selectedReportForRx.id,
        doctorName: 'Dr. Arjun Mehta, MD Clinical Nutrition',
        diagnosis: rxDiagnosis,
        medicines: rxMedicines.filter((m) => m.name.trim() !== ''),
        recommendedSupplements: rxSupplements.split(',').map((s) => s.trim()),
        dietaryAdjustments: selectedReportForRx.dietaryRecommendations || [],
        notes: rxNotes,
      };

      const res = await fetch('/api/admin/prescribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rxPayload),
      });
      const data = await res.json();

      setPrescriptions((prev) => [data.prescription, ...prev]);
      setReports((prev) =>
        prev.map((r) => (r.id === selectedReportForRx.id ? { ...r, adminReviewed: true, adminNotes: rxNotes } : r))
      );

      setSelectedReportForRx(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingRx(false);
    }
  };

  const handleSaveQrSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingQr(true);
    try {
      await fetch('/api/admin/qr-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qrSettings),
      });
      setQrSuccessMessage('Payment QR Code updated successfully!');
      setTimeout(() => setQrSuccessMessage(''), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingQr(false);
    }
  };

  // Filter and search logic for patient reports
  const filteredReports = reports.filter((report) => {
    // Status filter
    if (reportFilterStatus === 'reviewed' && !report.adminReviewed) return false;
    if (reportFilterStatus === 'pending' && report.adminReviewed) return false;
    if (reportFilterStatus === 'high_risk') {
      const hasHighRisk = report.biomarkers?.some(
        (b) => b.status === 'high' || b.status === 'critical'
      );
      if (!hasHighRisk) return false;
    }

    // Query filter
    if (!reportSearchQuery.trim()) return true;
    const q = reportSearchQuery.toLowerCase();
    const matchesUser = report.userName?.toLowerCase().includes(q) || report.userId?.toLowerCase().includes(q);
    const matchesName = report.reportName?.toLowerCase().includes(q) || report.summary?.toLowerCase().includes(q);
    const matchesBiomarker = report.biomarkers?.some(
      (b) => b.name?.toLowerCase().includes(q) || b.impactOnDiet?.toLowerCase().includes(q)
    );
    return matchesUser || matchesName || matchesBiomarker;
  });

  // Pure Light Mode Style Constants
  const cardClass = 'bg-white border border-zinc-200/90 shadow-sm';
  const subCardClass = 'bg-zinc-50 border border-zinc-200/80';

  // 1. ADMIN LOGIN BARRIER
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-8 shadow-xl space-y-6 text-left relative overflow-hidden">
          
          {/* Top Emerald Ribbon */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-zinc-950">UrCare Admin Portal</h2>
            <p className="text-xs text-zinc-500">
              Restricted medical supervision and operations console for doctors, clinical staff & platform administrators.
            </p>
          </div>

          {/* Quick Access Credentials Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-900 font-extrabold text-[11px] uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Admin Access Credentials</span>
            </div>
            <div className="text-[11px] text-zinc-700 space-y-0.5 font-medium">
              <div>Email: <strong className="font-mono text-emerald-700">admin@urcare.app</strong></div>
              <div>Password: <strong className="font-mono text-emerald-700">admin123</strong> or PIN: <strong className="font-mono text-emerald-700">8899</strong></div>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Admin Email</label>
              <input
                type="email"
                required
                placeholder="admin@urcare.app"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-emerald-600 focus:bg-white focus:outline-none text-zinc-900 text-xs font-medium transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Password or Admin PIN</label>
              <input
                type="password"
                required
                placeholder="admin123 or 8899"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-emerald-600 focus:bg-white focus:outline-none text-zinc-900 text-xs font-medium transition-all"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Direct Login Button */}
            <button
              id="admin-login-btn"
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Login to Admin Dashboard</span>
            </button>

            {/* 1-Click Instant Demo Login */}
            <button
              type="button"
              onClick={handle1ClickDemoLogin}
              className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>1-Click Instant Demo Admin Access</span>
            </button>

            <button
              type="button"
              onClick={onExitAdmin}
              className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-xs font-bold transition-colors cursor-pointer"
            >
              Return to User App
            </button>
          </form>

        </div>
      </div>
    );
  }

  // 2. ADMIN DASHBOARD CONTENT (LIGHT THEME)
  return (
    <div id="urcare-admin-dashboard" className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-16">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-zinc-950">UrCare Admin</span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">Dr. Arjun Mehta & Clinical Operations Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAdminLoggedIn(false)}
              className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            <button
              type="button"
              onClick={onExitAdmin}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
            >
              Back to User App
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'overview' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Platform Overview</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('patients'); loadRealPatient(); }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'patients' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Patient Profile{realPatient ? ' & Root-Cause' : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('reports'); loadAllReports(); }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'reports' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Patient Lab Reports & Rx ({reports.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'orders' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Store Orders ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('products_qr')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'products_qr' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Payment QR & Merchandising</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'reviews' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Reviews ({stats.totalReviews})</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW METRICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6 text-left">
            
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Total Users */}
              <div className={`p-5 rounded-3xl ${cardClass} space-y-1.5`}>
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Registered Users</span>
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-zinc-950">{stats.totalUsers.toLocaleString()}</div>
                <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <span>+128 verified this week</span>
                </div>
              </div>

              {/* Pro Subscriptions vs Free */}
              <div className={`p-5 rounded-3xl ${cardClass} space-y-1.5`}>
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Pro Members</span>
                  <Crown className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600">{stats.proUsers.toLocaleString()}</div>
                <div className="text-[11px] text-zinc-500">
                  {stats.freeUsers.toLocaleString()} Free ({(stats.totalUsers > 0 ? (stats.proUsers / stats.totalUsers) * 100 : 0).toFixed(1)}% Conversion)
                </div>
              </div>

              {/* Product Buyers vs Non-Buyers */}
              <div className={`p-5 rounded-3xl ${cardClass} space-y-1.5`}>
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Store Buyers</span>
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-zinc-950">{stats.totalBuyers.toLocaleString()}</div>
                <div className="text-[11px] text-zinc-500">
                  {stats.nonBuyers.toLocaleString()} Non-buyers ({(stats.totalUsers > 0 ? (stats.totalBuyers / stats.totalUsers) * 100 : 0).toFixed(1)}% Checkout Rate)
                </div>
              </div>

              {/* Total Revenue */}
              <div className={`p-5 rounded-3xl ${cardClass} space-y-1.5`}>
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Gross Platform Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600">₹{((stats.totalRevenue || 0) / 100000).toFixed(2)} Lakhs</div>
                <div className="text-[11px] text-zinc-500 font-medium">{stats.totalOrders} Fulfilled Orders</div>
              </div>
            </div>

            {/* Visual Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Subscription Breakdown */}
              <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                <h3 className="text-base font-black text-zinc-950">Subscription Status Breakdown</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-bold">
                      <span className="text-amber-600">Pro Subscriptions (Active Paid)</span>
                      <span className="text-zinc-950">{stats.proUsers} users</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" 
                        style={{ width: `${(stats.proUsers / stats.totalUsers) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-bold">
                      <span className="text-zinc-500">Free Baseline Users</span>
                      <span className="text-zinc-950">{stats.freeUsers} users</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                      <div 
                        className="h-full bg-zinc-400 rounded-full" 
                        style={{ width: `${(stats.freeUsers / stats.totalUsers) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl ${subCardClass} text-xs text-zinc-600 flex items-center justify-between font-medium`}>
                  <span>Pro users log 4.8x more daily meals and order 3x more clinical supplements.</span>
                </div>
              </div>

              {/* E-commerce Buyer Conversion */}
              <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                <h3 className="text-base font-black text-zinc-950">Product Purchasing Conversion</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-bold">
                      <span className="text-emerald-600">Purchased Products (Buyers)</span>
                      <span className="text-zinc-950">{stats.totalBuyers} users</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                      <div 
                        className="h-full bg-emerald-600 rounded-full" 
                        style={{ width: `${(stats.totalBuyers / stats.totalUsers) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-bold">
                      <span className="text-zinc-500">Browsed Store (Prospects)</span>
                      <span className="text-zinc-950">{stats.nonBuyers} users</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                      <div 
                        className="h-full bg-zinc-400 rounded-full" 
                        style={{ width: `${(stats.nonBuyers / stats.totalUsers) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl ${subCardClass} text-xs text-zinc-600 flex items-center justify-between font-medium`}>
                  <span>Top Product: UrCare 100% Pure Whey Isolate (42% of all order volume).</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: REAL SIGNED-IN PATIENT — mirrors onboarding + the 22-Module Root-Cause      */}
        {/* Assessment exactly as the patient's own Dashboard shows them (same localStorage). */}
        {activeTab === 'patients' && (
          <div className="space-y-6 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-zinc-950">Patient Profile & Root-Cause Data</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Live from this device's signed-in UrCare account — same data the patient sees in their own app.</p>
              </div>
              <button
                type="button"
                onClick={loadRealPatient}
                className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800 flex items-center gap-1.5 border border-zinc-200 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {!realPatient ? (
              <div className={`p-12 rounded-3xl ${cardClass} text-center space-y-3`}>
                <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                  <User className="w-7 h-7" />
                </div>
                <p className="text-base font-black text-zinc-900">No Signed-In Patient Found</p>
                <p className="text-xs max-w-sm mx-auto text-zinc-500">
                  Nobody has completed onboarding on this device/browser yet. Once a patient signs up and finishes onboarding, their full profile and Root-Cause Assessment appear here automatically.
                </p>
              </div>
            ) : (() => {
              const { profile, account } = realPatient;
              const ad = profile.assessmentData;
              return (
                <div className="space-y-5">
                  {/* Identity & Plan */}
                  <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                          {(profile.name || account.displayName || 'UC').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-black text-zinc-950">{profile.name || account.displayName}</h3>
                          <p className="text-xs text-zinc-500">{account.email} • {account.phoneNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {account.isPro && (
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <Crown className="w-3 h-3" /> Pro ({account.proPlanType || 'active'})
                          </span>
                        )}
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {profile.goal?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className={`p-3 rounded-2xl ${subCardClass} text-center`}>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Age / Gender</span>
                        <div className="text-sm font-black text-zinc-900">{profile.age} yrs • {profile.gender}</div>
                      </div>
                      <div className={`p-3 rounded-2xl ${subCardClass} text-center`}>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Weight / Goal</span>
                        <div className="text-sm font-black text-zinc-900">{profile.currentWeightKg}kg → {profile.targetWeightKg}kg</div>
                      </div>
                      <div className={`p-3 rounded-2xl ${subCardClass} text-center`}>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Daily Calories</span>
                        <div className="text-sm font-black text-emerald-600">{profile.calculatedPlan?.targetCalories} kcal</div>
                      </div>
                      <div className={`p-3 rounded-2xl ${subCardClass} text-center`}>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Diet Preference</span>
                        <div className="text-sm font-black text-zinc-900">{profile.dietaryPreference}</div>
                      </div>
                    </div>

                    {profile.medicalConditions?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.medicalConditions.map((c, i) => (
                          <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">{c}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-3 border-t border-zinc-100 text-xs text-zinc-500">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-emerald-600" />{patientMealDays} day(s) with AI Scan meals logged</span>
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />{patientTasksDone} daily tasks completed total</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenRxForPatient}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Issue Prescription for This Patient</span>
                    </button>
                  </div>

                  {/* 22-Module Root-Cause Assessment summary */}
                  <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <Activity className="w-5 h-5" />
                        <h3 className="text-sm font-black uppercase tracking-wider">22-Module Root-Cause Assessment</h3>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${ad ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}>
                        {ad ? 'Submitted' : 'Not Submitted Yet'}
                      </span>
                    </div>

                    {!ad ? (
                      <p className="text-xs text-zinc-500">This patient has not filled out the Root-Cause Reversal Form yet — it will appear here the moment they submit it from the Assessment tab.</p>
                    ) : (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className={`p-3 rounded-2xl ${subCardClass}`}>
                            <span className="font-bold text-zinc-400 uppercase text-[10px]">Main Health Concern</span>
                            <p className="text-zinc-900 font-semibold mt-0.5">{ad.mainHealthConcern}</p>
                          </div>
                          <div className={`p-3 rounded-2xl ${subCardClass}`}>
                            <span className="font-bold text-zinc-400 uppercase text-[10px]">90-120 Day Goal</span>
                            <p className="text-zinc-900 font-semibold mt-0.5">{ad.goal90to120Days}</p>
                          </div>
                          <div className={`p-3 rounded-2xl ${subCardClass}`}>
                            <span className="font-bold text-zinc-400 uppercase text-[10px]">Latest HbA1c / BP</span>
                            <p className="text-zinc-900 font-semibold mt-0.5">{ad.bloodSugar?.latestHbA1c || '—'} • {ad.cardioVitals?.usualBpRange || '—'}</p>
                          </div>
                          <div className={`p-3 rounded-2xl ${subCardClass}`}>
                            <span className="font-bold text-zinc-400 uppercase text-[10px]">Reversal Intensity Chosen</span>
                            <p className="text-zinc-900 font-semibold mt-0.5 capitalize">{ad.reversalIntensity?.replace('_', ' ')} • Start: {ad.startTimeline?.replace(/_/g, ' ')}</p>
                          </div>
                        </div>

                        {ad.diagnosedConditions?.length > 0 && (
                          <div>
                            <span className="font-bold text-zinc-400 uppercase text-[10px]">Diagnosed Conditions</span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {ad.diagnosedConditions.map((c, i) => (
                                <span key={i} className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                                  {c.conditionName} ({c.currentStatus})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {ad.personalQueryRequest && (
                          <div className={`p-3 rounded-2xl ${subCardClass}`}>
                            <span className="font-bold text-zinc-400 uppercase text-[10px]">Patient's Query for the Doctor</span>
                            <p className="text-zinc-900 font-semibold mt-0.5">{ad.personalQueryRequest}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 2: MEDICAL REPORTS & PATIENT DOSSIER READER */}
        {activeTab === 'reports' && (
          <div className="space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-zinc-950">Patient Lab Reports & Diagnostic Dossiers</h3>
                <p className="text-xs text-zinc-500">Supervise uploaded user blood test reports, view extracted biomarkers, and issue doctor prescriptions.</p>
              </div>

              <button
                type="button"
                onClick={loadAllReports}
                className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:text-emerald-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Live Reports</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 p-3 rounded-2xl bg-white border border-zinc-200 shadow-xs">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by patient name, email, or biomarker (e.g., HbA1c, Cholesterol)..."
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setReportFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    reportFilterStatus === 'all' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  All ({reports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilterStatus('high_risk')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    reportFilterStatus === 'high_risk' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  High Risk Markers
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilterStatus('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    reportFilterStatus === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Pending Review
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilterStatus('reviewed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    reportFilterStatus === 'reviewed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  Reviewed
                </button>
              </div>
            </div>

            {/* Reports List */}
            {filteredReports.length === 0 ? (
              <div className="p-12 text-center bg-white border border-zinc-200 rounded-3xl space-y-2">
                <FileText className="w-10 h-10 text-zinc-300 mx-auto" />
                <h4 className="text-sm font-bold text-zinc-900">No Patient Reports Found</h4>
                <p className="text-xs text-zinc-500">Try adjusting your search or upload a test report in the user portal.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredReports.map((report) => (
                  <div 
                    key={report.id}
                    className={`p-6 rounded-3xl ${cardClass} space-y-4 hover:border-emerald-300 transition-colors`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold text-zinc-950">{report.userName || 'Member Patient'}</span>
                          <span className="text-xs text-zinc-400 font-mono">({report.userId})</span>
                          {report.adminReviewed ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase border border-emerald-200">
                              Prescribed & Reviewed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase border border-amber-200">
                              Pending Doctor Review
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{report.reportName} • Uploaded {new Date(report.uploadedAt).toLocaleDateString('en-IN')}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Read Full Dossier Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedReportForView(report)}
                          className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Read Full Dossier</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleScanReportWithAi(report.id!)}
                          disabled={isAiScanningReport === report.id}
                          className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isAiScanningReport === report.id ? (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>Verify Record</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenRxModal(report)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Issue Prescription</span>
                        </button>
                      </div>
                    </div>

                    {/* Summary & Biomarkers */}
                    <div className="space-y-3">
                      <p className={`text-xs text-zinc-700 leading-relaxed ${subCardClass} p-3 rounded-2xl font-medium`}>
                        <strong className="text-zinc-950">Clinical Summary:</strong> {report.summary}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {report.biomarkers?.map((b, i) => (
                          <div key={i} className={`p-3 rounded-2xl ${subCardClass} text-xs space-y-1`}>
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-zinc-900 line-clamp-1">{b.name}</span>
                              <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                                b.status === 'high' || b.status === 'critical'
                                  ? 'bg-rose-100 text-rose-800'
                                  : b.status === 'low'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {b.status}
                              </span>
                            </div>
                            <div className="text-sm font-black font-mono text-emerald-600">{b.value}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{b.impactOnDiet}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUSTOMER ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-6 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-zinc-950">Store Order Fulfillment</h3>
                <p className="text-xs text-zinc-500">Track user supplement purchases, verify UPI QR payments, and manage shipment dispatch.</p>
              </div>
            </div>

            <div className="space-y-3">
              {orders.map((order) => (
                <div 
                  key={order.id}
                  className={`p-5 rounded-3xl ${cardClass} space-y-3`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">{order.id}</span>
                      <span className="text-sm font-bold text-zinc-950 ml-2">{order.shippingAddress?.fullName}</span>
                      <span className="text-xs text-zinc-500 ml-2">({order.shippingAddress?.phone})</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-zinc-900">₹{order.total}</span>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-bold border border-zinc-200 capitalize">
                        {order.paymentMethod === 'qr_upi' ? 'UPI QR' : 'Online Gateway'}
                      </span>

                      {/* Status Selector */}
                      <select
                        value={order.orderStatus}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as any)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-emerald-700 focus:outline-none cursor-pointer"
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped (In Transit)</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="text-xs text-zinc-600 space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between font-medium">
                        <span>{item.quantity}x {item.product?.name}</span>
                        <span className="text-zinc-900 font-bold">₹{(item.product?.discountPrice || item.product?.price || 0) * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* Address */}
                  <div className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-100">
                    Ship to: {order.shippingAddress?.streetAddress}, {order.shippingAddress?.city} - {order.shippingAddress?.pincode}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PRODUCTS & PAYMENT QR */}
        {activeTab === 'products_qr' && (
          <div className="space-y-8 text-left">
            
            {/* PRODUCT CATALOG MANAGEMENT HEADER & ACTIONS */}
            <div className={`p-6 sm:p-7 rounded-3xl ${cardClass} space-y-6`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg sm:text-xl font-black text-zinc-950">
                      Clinical Products & Store Inventory ({products.length})
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Upload new nutritional products, edit descriptions, upload photos, manage stock and clinical formulas.
                  </p>
                </div>

                <button
                  type="button"
                  id="admin-add-product-btn"
                  onClick={handleOpenAddProduct}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Upload / Add New Product</span>
                </button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                
                {/* Category Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {['all', 'protein', 'vitamins', 'superfoods', 'snacks', 'accessories'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setProductCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        productCategoryFilter === cat
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative min-w-[240px]">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search products by title, ingredients..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-medium focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {products
                  .filter((p) => {
                    if (productCategoryFilter !== 'all' && p.category !== productCategoryFilter) return false;
                    if (productSearchQuery.trim()) {
                      const q = productSearchQuery.toLowerCase();
                      const matchName = p.name.toLowerCase().includes(q);
                      const matchDesc = p.description?.toLowerCase().includes(q);
                      const matchCat = p.category.toLowerCase().includes(q);
                      if (!matchName && !matchDesc && !matchCat) return false;
                    }
                    return true;
                  })
                  .map((product) => (
                    <div
                      key={product.id}
                      className="p-4 rounded-3xl bg-zinc-50 border border-zinc-200 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-3 relative group"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-800 text-[10px] font-black uppercase tracking-wider">
                          {product.category}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleStock(product.id)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase cursor-pointer transition-colors ${
                            product.inStock !== false
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {product.inStock !== false ? '● In Stock' : '✕ Out of Stock'}
                        </button>
                      </div>

                      {/* Product Photo Thumbnail */}
                      <div className="relative h-44 w-full bg-white rounded-2xl overflow-hidden border border-zinc-200 flex items-center justify-center p-2">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                        {product.featured && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-black text-[9px] font-black uppercase">
                            Featured
                          </span>
                        )}
                      </div>

                      {/* Title & Rating */}
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-black text-zinc-950 line-clamp-1">{product.name}</h4>
                          <div className="flex items-center gap-0.5 text-amber-500 text-xs font-black shrink-0">
                            <Star className="w-3 h-3 fill-amber-500" />
                            <span>{product.rating || 4.9}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 font-medium leading-snug">
                          {product.description}
                        </p>
                      </div>

                      {/* Nutritional Facts Mini Pill */}
                      {product.nutritionInfo && (
                        <div className="grid grid-cols-4 gap-1 p-2 rounded-xl bg-white border border-zinc-200 text-center text-[10px]">
                          <div>
                            <span className="text-zinc-400 block text-[8px] uppercase">Cal</span>
                            <strong className="text-zinc-900 font-mono">{product.nutritionInfo.calories}</strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[8px] uppercase">Prot</span>
                            <strong className="text-emerald-700 font-mono">{product.nutritionInfo.protein}g</strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[8px] uppercase">Carb</span>
                            <strong className="text-zinc-900 font-mono">{product.nutritionInfo.carbs}g</strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[8px] uppercase">Fat</span>
                            <strong className="text-zinc-900 font-mono">{product.nutritionInfo.fats}g</strong>
                          </div>
                        </div>
                      )}

                      {/* Price & Action Buttons */}
                      <div className="pt-2 border-t border-zinc-200/80 flex items-center justify-between">
                        <div>
                          <div className="text-base font-black font-mono text-zinc-950">
                            ₹{product.discountPrice || product.price}
                          </div>
                          {product.discountPrice && product.discountPrice < product.price && (
                            <div className="text-[10px] text-zinc-400 line-through">
                              ₹{product.price} ({Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF)
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(product)}
                            className="p-2 rounded-xl bg-zinc-200 hover:bg-emerald-600 hover:text-white text-zinc-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Edit Product Details & Photo"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 rounded-xl bg-zinc-200 hover:bg-rose-600 hover:text-white text-zinc-500 text-xs font-bold transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* PAYMENT QR CODE SETTINGS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* QR Code Config */}
              <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-black text-zinc-950">Store UPI Payment QR Settings</h3>
                </div>
                <p className="text-xs text-zinc-500">
                  Configure the merchant UPI ID & QR Code shown to patients during store checkout.
                </p>

                <form onSubmit={handleSaveQrSettings} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">QR Code Image URL</label>
                    <input
                      type="url"
                      required
                      value={qrSettings.qrImageUrl}
                      onChange={(e) => setQrSettings({ ...qrSettings, qrImageUrl: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">UPI ID (VPA)</label>
                    <input
                      type="text"
                      required
                      value={qrSettings.upiId}
                      onChange={(e) => setQrSettings({ ...qrSettings, upiId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Payee Name</label>
                    <input
                      type="text"
                      required
                      value={qrSettings.payeeName}
                      onChange={(e) => setQrSettings({ ...qrSettings, payeeName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-medium"
                    />
                  </div>

                  {qrSuccessMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>{qrSuccessMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUpdatingQr}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    Save QR Settings
                  </button>
                </form>
              </div>

              {/* QR Live Preview */}
              <div className={`p-6 rounded-3xl ${cardClass} flex flex-col items-center justify-center text-center space-y-3`}>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Live Checkout QR Preview</h4>
                <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-lg">
                  <img
                    src={qrSettings.qrImageUrl}
                    alt="QR Preview"
                    className="w-48 h-48 object-contain"
                  />
                </div>
                <div className="text-xs text-zinc-900 font-mono font-black">{qrSettings.upiId}</div>
                <p className="text-[11px] text-zinc-500 font-medium">{qrSettings.payeeName}</p>
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-zinc-950">Patient Reviews & Testimonials ({reviews.length})</h3>
                <p className="text-xs text-zinc-500">Verified reviews from clinic patients and dietary supplement purchasers.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.map((rev) => (
                <div key={rev.id} className={`p-5 rounded-3xl ${cardClass} space-y-2.5`}>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-zinc-950 text-sm">{rev.userName}</span>
                    <div className="flex items-center gap-1 text-amber-500">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed italic font-medium">"{rev.comment}"</p>
                  <div className="text-[11px] text-emerald-700 font-bold pt-2 border-t border-zinc-100">
                    Product: {rev.productName} • {rev.date}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DOCTOR PRESCRIPTION MODAL */}
      {selectedReportForRx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-2xl my-8 text-left space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-950">Issue Clinical Prescription</h3>
                  <p className="text-xs text-zinc-500">Patient: <strong className="text-zinc-900">{selectedReportForRx.userName}</strong> ({selectedReportForRx.reportName})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportForRx(null)}
                className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPrescription} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Clinical Diagnosis</label>
                <input
                  type="text"
                  required
                  value={rxDiagnosis}
                  onChange={(e) => setRxDiagnosis(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-medium"
                />
              </div>

              {/* Medicine rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700">Prescribed Pharmaceuticals & Dosages</label>
                  <button
                    type="button"
                    onClick={handleAddMedicineRow}
                    className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Medicine</span>
                  </button>
                </div>

                {rxMedicines.map((med, idx) => (
                  <div key={idx} className={`p-3 rounded-2xl ${subCardClass} space-y-2`}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="Medicine name"
                        value={med.name}
                        onChange={(e) => {
                          const updated = [...rxMedicines];
                          updated[idx].name = e.target.value;
                          setRxMedicines(updated);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Dosage (e.g. 100mg)"
                        value={med.dosage}
                        onChange={(e) => {
                          const updated = [...rxMedicines];
                          updated[idx].dosage = e.target.value;
                          setRxMedicines(updated);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Frequency (e.g. 1-0-1)"
                        value={med.frequency}
                        onChange={(e) => {
                          const updated = [...rxMedicines];
                          updated[idx].frequency = e.target.value;
                          setRxMedicines(updated);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Duration (e.g. 30 days)"
                          value={med.duration}
                          onChange={(e) => {
                            const updated = [...rxMedicines];
                            updated[idx].duration = e.target.value;
                            setRxMedicines(updated);
                          }}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-xs"
                        />
                        {rxMedicines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMedicineRow(idx)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Recommended Supplements & Store Products</label>
                <input
                  type="text"
                  value={rxSupplements}
                  onChange={(e) => setRxSupplements(e.target.value)}
                  placeholder="e.g. UrCare Pure Whey Isolate, Triple Strength Omega-3"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Doctor's Clinical Notes</label>
                <textarea
                  rows={3}
                  value={rxNotes}
                  onChange={(e) => setRxNotes(e.target.value)}
                  placeholder="Additional lifestyle, hydration and follow-up notes..."
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs resize-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReportForRx(null)}
                  className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingRx}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmittingRx ? 'Issuing...' : 'Issue & Attach to Patient Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL PATIENT REPORT DOSSIER READER MODAL (ADMIN) */}
      {selectedReportForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-2xl my-8 text-left space-y-5 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-xs">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-zinc-950">{selectedReportForView.userName || 'Patient Dossier'}</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase border border-emerald-200">
                      ID: {selectedReportForView.userId}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {selectedReportForView.reportName} • Diagnostic Date: {new Date(selectedReportForView.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const r = selectedReportForView;
                    setSelectedReportForView(null);
                    handleOpenRxModal(r);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Issue Rx</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReportForView(null)}
                  className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Uploaded Report Photo / Document Viewer (No AI, Photo with Text) */}
            <div className="rounded-2xl overflow-hidden border border-zinc-200">
              <ReportPhotoViewer
                report={selectedReportForView}
                userName={selectedReportForView.userName || 'Member Patient'}
                theme="light"
              />
            </div>

            {/* Clinical Executive Summary */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Doctor's Clinical Summary & Impression
              </span>
              <p className="text-xs text-zinc-800 leading-relaxed font-medium">
                {selectedReportForView.summary}
              </p>
            </div>

            {/* Biomarkers Breakdown */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-emerald-600" />
                Extracted Blood Biomarkers ({selectedReportForView.biomarkers?.length || 0})
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedReportForView.biomarkers?.map((bio, idx) => (
                  <div 
                    key={idx}
                    className={`p-3.5 rounded-2xl border ${
                      bio.status === 'high' || bio.status === 'critical'
                        ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                        : bio.status === 'low'
                        ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    } space-y-1`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-950">{bio.name}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        bio.status === 'high' || bio.status === 'critical'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : bio.status === 'low'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {bio.status}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-black font-mono text-emerald-700">{bio.value}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Ref: {bio.referenceRange || 'Standard Lab range'}</span>
                    </div>

                    <p className="text-[11px] text-zinc-600 leading-snug font-medium pt-1 border-t border-zinc-200/60">
                      {bio.impactOnDiet}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dietary & Supplement Directives */}
            {selectedReportForView.dietaryRecommendations && selectedReportForView.dietaryRecommendations.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
                  Recommended Dietary & Lifestyle Directives
                </h4>
                <ul className="space-y-1.5">
                  {selectedReportForView.dietaryRecommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-zinc-700 flex items-start gap-2 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Doctor Note on File if already reviewed */}
            {selectedReportForView.adminNotes && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1 text-xs">
                <span className="font-extrabold text-amber-900 uppercase tracking-wider text-[10px]">Active Doctor Clinical Note</span>
                <p className="text-zinc-800 font-medium">{selectedReportForView.adminNotes}</p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-4 border-t border-zinc-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedReportForView(null)}
                className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer"
              >
                Done Reading Dossier
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRODUCT UPLOAD & EDIT MODAL (ADMIN) */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-2xl my-8 text-left space-y-6 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-xs">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-zinc-950">
                    {editingProduct ? 'Edit Store Product' : 'Upload & Add New Product'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Configure clinical product metadata, pricing, macros, and upload high-res product photos.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProduct} className="space-y-5">
              
              {/* Product Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Product Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UrCare 100% Pure Whey Isolate"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-bold focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-bold focus:border-emerald-500 outline-none capitalize"
                  >
                    <option value="protein">Protein</option>
                    <option value="vitamins">Vitamins & Minerals</option>
                    <option value="superfoods">Superfoods</option>
                    <option value="snacks">Healthy Snacks</option>
                    <option value="accessories">Accessories</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Regular MRP (₹)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono font-bold focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Sale Price (₹)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={productForm.discountPrice}
                      onChange={(e) => setProductForm({ ...productForm, discountPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-emerald-800 text-xs font-mono font-bold focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* PHOTO UPLOAD & MEDIA SECTION */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Product Photo & Media Upload</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium">Upload file or pick preset</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Image Preview Box */}
                  <div className="w-28 h-28 shrink-0 rounded-2xl bg-white border border-zinc-300 p-2 flex items-center justify-center overflow-hidden shadow-xs">
                    {productForm.image ? (
                      <img
                        src={productForm.image}
                        alt="Product preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-zinc-400 text-center text-[10px]">No image</div>
                    )}
                  </div>

                  {/* Upload Actions */}
                  <div className="flex-1 w-full space-y-2.5">
                    <div className="flex flex-wrap gap-2">
                      <label className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photo from Device</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProductPhotoUpload}
                        />
                      </label>
                    </div>

                    <div>
                      <input
                        type="url"
                        placeholder="Or enter direct Image URL (https://...)"
                        value={productForm.image}
                        onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-900 text-xs font-mono focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Preset Photo Gallery */}
                <div className="pt-2 border-t border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
                    Or select from high-res clinical product presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_PRODUCT_PHOTOS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setProductForm({ ...productForm, image: preset.url })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                          productForm.image === preset.url
                            ? 'bg-emerald-100 border-emerald-500 text-emerald-900'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Product Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed clinical formula description, usage instructions, certifications..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs focus:border-emerald-500 outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Clinical Benefits */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Key Benefits (comma or line separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 100% Ultra-Filtered, Zero Added Sugar, Lab Tested for Purity, Improves Recovery"
                  value={productForm.benefitsText}
                  onChange={(e) => setProductForm({ ...productForm, benefitsText: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Nutritional Facts Grid */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900 block">
                  Nutritional Facts & Macro Profile
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-bold text-zinc-500 mb-0.5">Serving Size</label>
                    <input
                      type="text"
                      value={productForm.servingSize}
                      onChange={(e) => setProductForm({ ...productForm, servingSize: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-0.5">Calories (kcal)</label>
                    <input
                      type="number"
                      value={productForm.calories}
                      onChange={(e) => setProductForm({ ...productForm, calories: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-xs font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-0.5">Protein (g)</label>
                    <input
                      type="number"
                      value={productForm.protein}
                      onChange={(e) => setProductForm({ ...productForm, protein: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-emerald-800 text-xs font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-0.5">Carbs (g)</label>
                    <input
                      type="number"
                      value={productForm.carbs}
                      onChange={(e) => setProductForm({ ...productForm, carbs: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-xs font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-0.5">Fats (g)</label>
                    <input
                      type="number"
                      value={productForm.fats}
                      onChange={(e) => setProductForm({ ...productForm, fats: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-xs font-bold font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.inStock}
                    onChange={(e) => setProductForm({ ...productForm, inStock: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span>Product is In Stock & Available for Order</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.featured}
                    onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500"
                  />
                  <span>Feature on Store Top Showcase</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingProduct ? 'Save Changes' : 'Upload & Publish Product'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
