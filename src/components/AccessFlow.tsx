import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import { siWhatsapp } from 'simple-icons';
import {
  CheckCircle2, AlertTriangle, ArrowRight, Lock, Upload, Share2, Mail, Globe, Phone, Clock,
  FileText, Sparkles, LogOut, RefreshCw, ShieldCheck, Stethoscope,
} from 'lucide-react';
import { UserHealthProfile, UserAccount, MedicalReportAnalysis, Order } from '../types';
import { ReportUploader } from './ReportUploader';
import { ShareHealthModal } from './ShareHealthModal';
import { ShineBorder } from './magicui/shine-border';
import { BorderBeam } from './magicui/border-beam';
import { getMyReports, getPaymentQrSettings, saveOrderAndReceiptToSupabase, AccessStatus } from '../utils/supabase';
import { compressImageToDataUrl } from '../utils/compressImage';
import { useLanguage } from '../context/LanguageContext';

export const APP_ACCESS_PRODUCT_ID = 'prod_app_access';

// The reviewing doctor's contact details shown on the paywall.
const DOCTOR = {
  name: 'Dr. Aakarshak',
  whatsapp: '917983143151',
  phoneLabel: '+91 79831 43151',
  email: 'urcarein@gmail.com',
  website: 'https://urcare.org',
};

const BrandIcon: React.FC<{ path: string; className?: string }> = ({ path, className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d={path} /></svg>
);

interface Summary { good: string[]; bad: string[]; need: string[] }

/** What's going well, what needs attention and what they need — from the
 *  user's own onboarding answers and (if uploaded) their latest report. */
function buildSummary(profile: UserHealthProfile, report: MedicalReportAnalysis | null, tr: (en: string, hi: string) => string): Summary {
  const good: string[] = [];
  const bad: string[] = [];
  const need: string[] = [];

  if (profile.heightCm > 0 && profile.currentWeightKg > 0) {
    const bmi = Math.round((profile.currentWeightKg / Math.pow(profile.heightCm / 100, 2)) * 10) / 10;
    if (bmi >= 18.5 && bmi < 25) good.push(tr(`Healthy weight for your height (BMI ${bmi})`, `आपकी लंबाई के हिसाब से सही वज़न (BMI ${bmi})`));
    else if (bmi >= 25) bad.push(tr(`Weight above the healthy range (BMI ${bmi})`, `वज़न सही रेंज से ज़्यादा (BMI ${bmi})`));
    else bad.push(tr(`Weight below the healthy range (BMI ${bmi})`, `वज़न सही रेंज से कम (BMI ${bmi})`));
  }
  const conditions = (profile.medicalConditions || []).filter((c) => c && c !== 'None' && c !== 'Other');
  if (conditions.length) {
    conditions.slice(0, 4).forEach((c) => bad.push(tr(`Living with ${c}`, `${c} है`)));
    need.push(tr(`A doctor-guided reversal plan for ${conditions.slice(0, 2).join(' & ')}`, `${conditions.slice(0, 2).join(' व ')} के लिए डॉक्टर-गाइडेड रिवर्सल प्लान`));
  } else {
    good.push(tr('No long-term condition reported', 'कोई लंबी बीमारी नहीं बताई'));
  }

  if (report) {
    const markers = report.biomarkers || [];
    const normal = markers.filter((b) => b.status === 'normal');
    const flagged = markers.filter((b) => b.status !== 'normal');
    if (normal.length) good.push(tr(`${normal.length} of ${markers.length} report values are in the normal range`, `रिपोर्ट की ${markers.length} में से ${normal.length} वैल्यू नॉर्मल हैं`));
    flagged.slice(0, 5).forEach((b) => bad.push(`${b.name}: ${b.value} (${tr(b.status, b.status === 'high' ? 'ज़्यादा' : b.status === 'low' ? 'कम' : 'गंभीर')})`));
    (report.identifiedRisks || []).slice(0, 2).forEach((r) => bad.push(r));
    (report.dietaryRecommendations || []).slice(0, 3).forEach((r) => need.push(r));
    const avoid = report.macroAdjustments?.foodsToAvoid || [];
    if (avoid.length) need.push(tr(`Cut down on: ${avoid.slice(0, 4).join(', ')}`, `कम करें: ${avoid.slice(0, 4).join(', ')}`));
  } else {
    need.push(tr('A lab report, so your plan can target your real numbers', 'एक लैब रिपोर्ट, ताकि प्लान आपके असली नंबरों के हिसाब से बने'));
  }
  need.push(tr('A daily routine (meals, movement, sleep) timed to your day', 'आपके दिन के हिसाब से टाइम किया गया रूटीन (खाना, एक्सरसाइज़, नींद)'));
  if (!good.length) good.push(tr('You have taken the first step by completing onboarding', 'ऑनबोर्डिंग पूरी करके आपने पहला कदम उठा लिया है'));
  return { good, bad, need };
}

interface AccessFlowProps {
  profile: UserHealthProfile;
  account: UserAccount;
  status: AccessStatus;
  onRefresh: () => void;
  onSignOut: () => void;
}

/** After onboarding (new accounts): upload a report, then the paywall —
 *  a summary of their data, a ₹499 UPI unlock that an admin verifies, a
 *  share option and the doctor's contact. */
export const AccessFlow: React.FC<AccessFlowProps> = ({ profile, account, status, onRefresh, onSignOut }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [reports, setReports] = useState<MedicalReportAnalysis[] | null>(null);
  const [step, setStep] = useState<'report' | 'paywall'>('report');

  useEffect(() => {
    getMyReports(account.uid).then((list) => {
      setReports(list);
      // Already has a report (or already paid/pending) → straight to the paywall.
      if (list.length || status.status !== 'none') setStep('paywall');
    });
  }, [account.uid, status.status]);

  if (!reports) {
    return <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><div className="w-9 h-9 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin" /></div>;
  }

  return step === 'report'
    ? <ReportStep profile={profile} account={account} tr={tr} onDone={(r) => { if (r) setReports((prev) => [r, ...(prev || [])]); setStep('paywall'); }} onSignOut={onSignOut} />
    : <Paywall profile={profile} account={account} reports={reports} status={status} tr={tr} onRefresh={onRefresh} onSignOut={onSignOut} onAddReport={() => setStep('report')} />;
};

// ---------------------------------------------------------------- report step

const ReportStep: React.FC<{
  profile: UserHealthProfile; account: UserAccount; tr: (en: string, hi: string) => string;
  onDone: (report: MedicalReportAnalysis | null) => void; onSignOut: () => void;
}> = ({ profile, account, tr, onDone, onSignOut }) => {
  const rows: [string, string][] = [
    [tr('Name', 'नाम'), profile.name || account.displayName || '—'],
    [tr('Age', 'उम्र'), profile.age ? String(profile.age) : '—'],
    [tr('Gender', 'लिंग'), profile.gender ? String(profile.gender) : '—'],
    [tr('Height', 'लंबाई'), profile.heightCm ? `${profile.heightCm} cm` : '—'],
    [tr('Weight', 'वज़न'), profile.currentWeightKg ? `${profile.currentWeightKg} kg` : '—'],
    [tr('Conditions', 'बीमारियाँ'), (profile.medicalConditions || []).filter((c) => c && c !== 'None').join(', ') || tr('None', 'कोई नहीं')],
  ];
  return (
    <div className="access-bg min-h-screen px-4 py-6 sm:py-10">
      <div className="max-w-xl mx-auto space-y-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="home-hero relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 text-white">
          <span className="home-hero-blob home-hero-blob-a" aria-hidden="true" />
          <span className="home-hero-blob home-hero-blob-b" aria-hidden="true" />
          <BorderBeam size={110} duration={9} colorFrom="#fde68a" colorTo="#ffffff" borderWidth={2} />
          <span className="hero-chip"><FileText className="w-3.5 h-3.5" />{tr('Step 2 of 3', 'चरण 2 / 3')}</span>
          <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold leading-tight">{tr('Add your lab report', 'अपनी लैब रिपोर्ट डालें')}</h1>
          <p className="mt-1.5 text-sm text-white/85">{tr('We read it together with your onboarding answers to build your health summary.', 'आपके ऑनबोर्डिंग जवाबों के साथ इसे पढ़कर आपका हेल्थ सारांश बनाएंगे।')}</p>
        </motion.div>

        <div className="rounded-2xl bg-white border border-zinc-200 shadow-depth p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-zinc-900">{tr('Your onboarding details', 'आपकी ऑनबोर्डिंग जानकारी')}</h2>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">{tr('Saved', 'सेव है')}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {rows.map(([k, v]) => (
              <div key={k} className={k === tr('Conditions', 'बीमारियाँ') ? 'col-span-2' : ''}>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{k}</dt>
                <dd className="text-sm font-bold text-zinc-800 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative rounded-2xl bg-white border border-zinc-200 shadow-depth p-4 sm:p-5 overflow-hidden">
          <ShineBorder borderWidth={2} duration={12} shineColor={['#34d399', '#4ade80', '#a7f3d0']} />
          <ReportUploader
            standalone
            userAccount={account}
            onReportAnalyzed={(analysis) => onDone(analysis)}
            onDone={() => onDone(null)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onSignOut} className="text-xs font-bold text-zinc-400 hover:text-zinc-600 cursor-pointer flex items-center gap-1"><LogOut className="w-3.5 h-3.5" />{tr('Sign out', 'साइन आउट')}</button>
          <button type="button" onClick={() => onDone(null)} className="text-xs font-black text-emerald-700 hover:underline cursor-pointer flex items-center gap-1">
            {tr("I don't have a report — continue", 'मेरे पास रिपोर्ट नहीं — आगे बढ़ें')}<ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- paywall

const Paywall: React.FC<{
  profile: UserHealthProfile; account: UserAccount; reports: MedicalReportAnalysis[]; status: AccessStatus;
  tr: (en: string, hi: string) => string; onRefresh: () => void; onSignOut: () => void; onAddReport: () => void;
}> = ({ profile, account, reports, status, tr, onRefresh, onSignOut, onAddReport }) => {
  const latest = useMemo(() => [...reports].sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''))[0] || null, [reports]);
  const summary = useMemo(() => buildSummary(profile, latest, tr), [profile, latest, tr]);
  const price = status.price || 499;
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Payment
  const [qrSettings, setQrSettings] = useState<{ qrImageUrl?: string; upiId?: string; payeeName?: string }>({});
  const [upiQr, setUpiQr] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { getPaymentQrSettings().then(setQrSettings); }, []);
  const upiId = qrSettings.upiId || 'archamasaini123-1@oksbi';
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(qrSettings.payeeName || 'UrCare')}&am=${price}.00&cu=INR&tn=${encodeURIComponent('UrCare app unlock')}`;
  const usesUpiId = !!qrSettings.upiId || !qrSettings.qrImageUrl;
  useEffect(() => {
    if (!usesUpiId) return;
    QRCode.toDataURL(upiLink, { margin: 1, width: 480, color: { dark: '#064e3b', light: '#ffffff' } }).then(setUpiQr).catch(() => setUpiQr(''));
  }, [upiLink, usesUpiId]);
  const isPhone = /Android|iPhone|iPad/i.test(navigator.userAgent);

  // While a payment is being verified, check back every 20 s.
  useEffect(() => {
    if (status.status !== 'pending') return;
    const id = window.setInterval(onRefresh, 20000);
    return () => window.clearInterval(id);
  }, [status.status, onRefresh]);

  const pickScreenshot = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try { setScreenshot(await compressImageToDataUrl(file)); } catch { setError(tr('Could not read that image. Please try another one.', 'यह इमेज नहीं पढ़ी जा सकी। दूसरी आज़माएं।')); }
  };

  const submit = async () => {
    if (!screenshot) { setError(tr('Please upload a screenshot of your payment first.', 'पहले पेमेंट का स्क्रीनशॉट डालें।')); return; }
    setSubmitting(true);
    setError(null);
    const name = profile.name || account.displayName || 'Member';
    const order: Order = {
      id: 'ACCESS',
      userId: account.uid,
      userName: name,
      userEmail: account.email,
      items: [{ product: { id: APP_ACCESS_PRODUCT_ID, name: 'UrCare App Unlock', price, discountPrice: price } as any, quantity: 1 }],
      shippingAddress: { fullName: name, phone: profile.phone || '', streetAddress: 'Digital — UrCare app unlock', city: '', state: '', pincode: '' },
      subtotal: price,
      discount: 0,
      total: price,
      paymentMethod: 'qr_upi',
      paymentStatus: 'pending',
      orderStatus: 'awaiting_payment',
      transactionId: utr.trim() || undefined,
      receiptImageUrl: screenshot,
      createdAt: new Date().toISOString(),
      estimatedDelivery: '',
    };
    const result = await saveOrderAndReceiptToSupabase(order);
    setSubmitting(false);
    if (!result.success) { setError(result.error || tr('Could not submit. Please try again.', 'सबमिट नहीं हुआ। फिर कोशिश करें।')); return; }
    setScreenshot(null);
    setUtr('');
    onRefresh();
  };

  const waText = encodeURIComponent(
    status.status === 'pending'
      ? `Hi ${DOCTOR.name}, I have paid ₹${price} to unlock UrCare (${account.email}). Please verify my payment.`
      : `Hi ${DOCTOR.name}, I'd like to know more about the UrCare plan. (${account.email})`,
  );

  const unlocks: [string, string][] = [
    ['Your full daily reversal plan, timed to your day', 'आपके दिन के हिसाब से पूरा डेली रिवर्सल प्लान'],
    ['Detailed report insights and health score', 'डिटेल्ड रिपोर्ट इनसाइट्स और हेल्थ स्कोर'],
    ['UrCare Medical Team (AI) chat, any time', 'UrCare मेडिकल टीम (AI) चैट, कभी भी'],
    ['Food scan with good / bad and healthier swaps', 'फूड स्कैन — अच्छा/बुरा और हेल्दी विकल्प'],
    ['Health team chat and doctor review', 'हेल्थ टीम चैट और डॉक्टर रिव्यू'],
    ['Weekly progress tracking', 'हर हफ़्ते की प्रोग्रेस ट्रैकिंग'],
  ];

  return (
    <div className="access-bg min-h-screen px-4 py-6 sm:py-10">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="home-hero relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 text-white">
          <span className="home-hero-blob home-hero-blob-a" aria-hidden="true" />
          <span className="home-hero-blob home-hero-blob-b" aria-hidden="true" />
          <BorderBeam size={110} duration={9} colorFrom="#fde68a" colorTo="#ffffff" borderWidth={2} />
          <div className="flex items-center justify-between gap-2">
            <span className="hero-chip"><Sparkles className="w-3.5 h-3.5" />{tr('Step 3 of 3', 'चरण 3 / 3')}</span>
            <button type="button" onClick={() => setIsShareOpen(true)} className="hero-chip cursor-pointer hover:bg-white/25"><Share2 className="w-3.5 h-3.5" />{tr('Share', 'शेयर')}</button>
          </div>
          <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold leading-tight">{tr(`${(profile.name || 'Your').split(' ')[0]}, here is your health summary`, `${(profile.name || 'आपका').split(' ')[0]}, यह रहा आपका हेल्थ सारांश`)}</h1>
          <p className="mt-1.5 text-sm text-white/85">{latest ? tr(`From your onboarding answers and ${latest.reportName}`, `आपके ऑनबोर्डिंग जवाबों और ${latest.reportName} से`) : tr('From your onboarding answers', 'आपके ऑनबोर्डिंग जवाबों से')}</p>
        </motion.div>

        {/* Summary */}
        <SummaryBlock tone="good" title={tr("What's going well", 'क्या अच्छा है')} items={summary.good} />
        <SummaryBlock tone="bad" title={tr('Needs attention', 'किस पर ध्यान देना है')} items={summary.bad.length ? summary.bad : [tr('Nothing flagged yet — a report would tell us more', 'अभी कुछ नहीं मिला — रिपोर्ट से और पता चलेगा')]} />
        <SummaryBlock tone="need" title={tr('What you need to get better', 'बेहतर होने के लिए क्या चाहिए')} items={summary.need} />
        {!latest && (
          <button type="button" onClick={onAddReport} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-emerald-300 text-emerald-700 text-sm font-black hover:bg-emerald-50 cursor-pointer">
            <Upload className="w-4 h-4" />{tr('Add a lab report for a sharper summary', 'बेहतर सारांश के लिए लैब रिपोर्ट डालें')}
          </button>
        )}

        {/* Unlock */}
        <div className="relative rounded-[1.5rem] bg-white border border-emerald-200 shadow-depth overflow-hidden">
          <ShineBorder borderWidth={2} duration={10} shineColor={['#34d399', '#fde68a', '#4ade80']} />
          <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100">
            <div className="flex items-center gap-2 text-emerald-800"><Lock className="w-4 h-4" /><span className="text-xs font-black uppercase tracking-wider">{tr('Unlock the full UrCare app', 'पूरी UrCare ऐप खोलें')}</span></div>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-display text-4xl font-bold text-zinc-900">₹{price}</span>
              <span className="pb-1 text-xs font-bold text-zinc-500">{tr('one-time', 'एक बार')}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">{tr('To get better, you get everything below once your payment is verified:', 'बेहतर होने के लिए, पेमेंट वेरिफ़ाई होते ही आपको ये सब मिलेगा:')}</p>
            <ul className="mt-3 grid gap-1.5">
              {unlocks.map(([en, hi]) => (
                <li key={en} className="flex items-start gap-2 text-[13px] font-semibold text-zinc-800"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{tr(en, hi)}</li>
              ))}
            </ul>
          </div>

          <div className="p-5">
            {status.status === 'pending' ? (
              <div className="text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center"><Clock className="w-7 h-7" /></div>
                <h3 className="text-base font-black text-zinc-900">{tr('Verifying your payment', 'आपका पेमेंट वेरिफ़ाई हो रहा है')}</h3>
                <p className="text-xs text-zinc-500">{tr('Our team checks your screenshot — usually within a few hours. The app opens by itself once it is approved.', 'हमारी टीम स्क्रीनशॉट चेक करती है — आमतौर पर कुछ घंटों में। मंज़ूर होते ही ऐप अपने आप खुल जाएगी।')}</p>
                <div className="flex gap-2 justify-center">
                  <a href={`https://wa.me/${DOCTOR.whatsapp}?text=${waText}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#25D366] text-white text-xs font-black"><BrandIcon path={siWhatsapp.path} className="w-4 h-4" />{tr('Message on WhatsApp', 'WhatsApp पर मैसेज')}</a>
                  <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-200 text-xs font-black text-zinc-700 cursor-pointer"><RefreshCw className="w-3.5 h-3.5" />{tr('Check again', 'फिर देखें')}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {status.status === 'rejected' && (
                  <p className="flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{tr("We couldn't verify your last payment. Please pay again or upload the correct screenshot.", 'आपका पिछला पेमेंट वेरिफ़ाई नहीं हो सका। फिर से पेमेंट करें या सही स्क्रीनशॉट डालें।')}
                  </p>
                )}
                <div className="text-center">
                  <div className="text-xs font-black text-zinc-900">{tr(`Step 1: Scan & pay ₹${price}`, `चरण 1: स्कैन करें व ₹${price} दें`)}</div>
                  {(usesUpiId ? upiQr : qrSettings.qrImageUrl) ? (
                    <img src={usesUpiId ? upiQr : qrSettings.qrImageUrl} alt="UPI QR" className="mt-2 mx-auto w-48 h-48 rounded-2xl bg-white p-2 border border-zinc-100 shadow-sm object-contain" />
                  ) : <div className="mt-2 mx-auto w-48 h-48 rounded-2xl bg-zinc-100 animate-pulse" />}
                  {usesUpiId && <p className="mt-1.5 text-[11px] font-mono text-zinc-500">{upiId}</p>}
                  {usesUpiId && isPhone && (
                    <a href={upiLink} className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-black">{tr('Pay with UPI app', 'UPI ऐप से पे करें')}<ArrowRight className="w-3.5 h-3.5" /></a>
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-zinc-900 mb-1.5">{tr('Step 2: Upload the payment screenshot', 'चरण 2: पेमेंट का स्क्रीनशॉट डालें')}</div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickScreenshot(e.target.files?.[0])} />
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-zinc-200 hover:border-emerald-300 cursor-pointer text-left">
                    {screenshot ? <img src={screenshot} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-200" /> : <span className="w-12 h-12 rounded-lg bg-zinc-50 flex items-center justify-center"><Upload className="w-5 h-5 text-zinc-400" /></span>}
                    <span className="text-xs font-bold text-zinc-600">{screenshot ? tr('Screenshot added — tap to change', 'स्क्रीनशॉट जुड़ गया — बदलने के लिए टैप करें') : tr('Tap to choose the screenshot', 'स्क्रीनशॉट चुनने के लिए टैप करें')}</span>
                  </button>
                  <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder={tr('UPI reference / UTR (optional)', 'UPI रेफ़रेंस / UTR (वैकल्पिक)')} className="mt-2 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold outline-none focus:border-emerald-500" />
                </div>
                {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
                <button type="button" onClick={submit} disabled={submitting} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-black shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-60 active:scale-[0.99] transition-transform">
                  {submitting ? tr('Submitting…', 'सबमिट हो रहा है…') : tr(`Submit payment of ₹${price}`, `₹${price} का पेमेंट सबमिट करें`)}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-zinc-400"><ShieldCheck className="w-3.5 h-3.5" />{tr('Our team verifies every payment by hand', 'हमारी टीम हर पेमेंट खुद जांचती है')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Doctor contact */}
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-depth p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md"><Stethoscope className="w-5 h-5" /></span>
            <div>
              <div className="text-sm font-black text-zinc-900">{tr('Talk to our doctor', 'हमारे डॉक्टर से बात करें')}</div>
              <div className="text-[11px] font-semibold text-zinc-500">{DOCTOR.name} · UrCare</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href={`https://wa.me/${DOCTOR.whatsapp}?text=${waText}`} target="_blank" rel="noreferrer" className="contact-tile"><span className="contact-icon bg-[#25D366]"><BrandIcon path={siWhatsapp.path} className="w-4 h-4" /></span><span><b>WhatsApp</b><small>{DOCTOR.phoneLabel}</small></span></a>
            <a href={`tel:+${DOCTOR.whatsapp}`} className="contact-tile"><span className="contact-icon bg-emerald-600"><Phone className="w-4 h-4" /></span><span><b>{tr('Call', 'कॉल')}</b><small>{DOCTOR.phoneLabel}</small></span></a>
            <a href={`mailto:${DOCTOR.email}?subject=${encodeURIComponent('UrCare')}`} className="contact-tile"><span className="contact-icon bg-rose-500"><Mail className="w-4 h-4" /></span><span><b>Email</b><small>{DOCTOR.email}</small></span></a>
            <a href={DOCTOR.website} target="_blank" rel="noreferrer" className="contact-tile"><span className="contact-icon bg-zinc-800"><Globe className="w-4 h-4" /></span><span><b>{tr('Website', 'वेबसाइट')}</b><small>urcare.org</small></span></a>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pb-6">
          <button type="button" onClick={onSignOut} className="text-xs font-bold text-zinc-400 hover:text-zinc-600 cursor-pointer flex items-center gap-1"><LogOut className="w-3.5 h-3.5" />{tr('Sign out', 'साइन आउट')}</button>
          <button type="button" onClick={() => setIsShareOpen(true)} className="text-xs font-black text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"><Share2 className="w-3.5 h-3.5" />{tr('Share my summary', 'मेरा सारांश शेयर करें')}</button>
        </div>
      </div>

      <ShareHealthModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        profile={profile}
        displayName={(profile.name || account.displayName || '').trim()}
        prescriptions={profile.prescriptions || []}
        reports={reports}
        tr={tr}
      />
    </div>
  );
};

const SummaryBlock: React.FC<{ tone: 'good' | 'bad' | 'need'; title: string; items: string[] }> = ({ tone, title, items }) => {
  const meta = {
    good: { icon: CheckCircle2, ring: 'border-emerald-200', head: 'text-emerald-800', dot: 'text-emerald-600', bg: 'from-emerald-50/80' },
    bad: { icon: AlertTriangle, ring: 'border-amber-200', head: 'text-amber-800', dot: 'text-amber-600', bg: 'from-amber-50/80' },
    need: { icon: ArrowRight, ring: 'border-emerald-200', head: 'text-emerald-800', dot: 'text-emerald-600', bg: 'from-emerald-50/80' },
  }[tone];
  const Icon = meta.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl bg-gradient-to-b ${meta.bg} to-white border ${meta.ring} p-4`}>
      <h3 className={`flex items-center gap-2 text-sm font-black ${meta.head}`}><Icon className="w-4 h-4" />{title}</h3>
      <ul className="mt-2.5 space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-700 font-medium"><span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-current ${meta.dot}`} />{t}</li>
        ))}
      </ul>
    </motion.div>
  );
};
