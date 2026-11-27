// The four doctor-led care programs from urcare.org/shop → "Treatment".
// Prices are the website's. The wording is toned down for app-store review
// (no cure / reversal / guarantee / surgery claims). These are real-world
// medical services, not sold in the app: "Start" opens WhatsApp, Call or Email
// with the UrCare team, the same buttons the website shows.

export const TREATMENT_CONTACT = {
  whatsapp: '917983143151',
  phone: '+917983143151',
  email: 'urcarein@gmail.com',
};

export const TREATMENT_CORE_FEATURES = [
  'UrCare health assessment report',
  'Personalised care plan with monthly goal updates',
  '2–3 personalised herbal formulations, chosen for your condition',
  'Personalised vitamin and mineral guidance',
  'Doctor guidance, UrCare team support and progress updates',
];

export interface StoreTreatment {
  code: string;
  label?: string;
  title: string;
  tagline?: string;
  duration: string;
  summary: string;
  priceUsd: string;
  priceInr: string;
  inrApprox: boolean;
  includes: string[];
}

export const STORE_TREATMENTS: StoreTreatment[] = [
  {
    code: 'A',
    label: 'Ultimate VIP',
    title: '12-Month Ultimate VIP Personalised Care Program + India Wellness Retreat',
    tagline: '12 months of complete, doctor-led personal care',
    duration: '12 Months',
    summary: '12 months of personalised care, a 10-day wellness retreat in India, a VIP care concierge, personalised herbal formulations and supplements, and 5 years of annual health reviews.',
    priceUsd: '$11,700',
    priceInr: '₹10.82 Lakh',
    inrApprox: true,
    includes: [
      'Detailed health assessment with quarterly report reviews by specialist doctors (MBBS MD / BAMS MD)',
      '12-month personalised care plan, updated every month',
      'Personalised herbal formulations, vitamins and supplements, delivered for 12 months',
      'Private doctor consultations and priority WhatsApp access to your doctors',
      'Dedicated personal health manager and care coordination team',
      '10-day wellness retreat in Rishikesh / Dehradun with accommodation and therapeutic meals',
      'Full-body health check-up and in-person specialist consultations during the retreat',
      'Yoga, physiotherapy, fitness and stress-management sessions',
      'Travel assistance in India and help arranging hospital and specialist appointments',
      'Weekly follow-ups and quarterly progress reports',
      'Review of your current medicines with your doctors',
      'Family member health screening',
      '5 years of annual online health reviews',
    ],
  },
  {
    code: 'B',
    label: 'All in 1',
    title: 'All-in-1 Personalised Care Program',
    tagline: '12 months of complete personalised care',
    duration: '12 Months+',
    summary: 'Everything in one program: personalised care, herbal formulations, doctor consultations and a dedicated health manager, continuing until your agreed health goals are reached.',
    priceUsd: '$4,700',
    priceInr: '₹4.35 Lakh',
    inrApprox: true,
    includes: [
      'Detailed health assessment: medical history, blood report review and quarterly progress reviews',
      '12-month personalised care plan, updated every month',
      'Personalised herbal formulations, vitamins and supplements, delivered on schedule',
      'Private doctor consultations and WhatsApp access to your doctors',
      'Dedicated personal health manager and UrCare support team',
      '3-day personalised online health intensive',
      'Weekly follow-ups and quarterly progress reports',
      'Personalised diet, nutrition, exercise and lifestyle program',
      'Weight management and nutrient deficiency review',
      'Review of your current medicines with your doctors',
      'Long-term health maintenance roadmap',
      'Family / partner health guidance',
    ],
  },
  {
    code: 'C',
    title: 'Complete Personalised Care Program',
    duration: '6–8 Months',
    summary: 'The same complete care features, for 6 to 8 months.',
    priceUsd: '$1,298',
    priceInr: '₹1.25 Lakh',
    inrApprox: false,
    includes: [],
  },
  {
    code: 'D',
    title: 'Personalised Care Program',
    duration: '3 + 1 Months',
    summary: 'The core care features for 3 months, plus 1 month of extra support.',
    priceUsd: '$684.46',
    priceInr: '₹65,000',
    inrApprox: false,
    includes: [],
  },
];

export const TREATMENT_FOOTNOTE = 'All services depend on clinical suitability, the agreed package and provider availability. Results differ from person to person and are not guaranteed. UrCare care programs support, and do not replace, your own doctor\'s treatment. Never stop or change any medicine without your doctor.';
