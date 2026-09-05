import { AdminStats, MedicalReportAnalysis, Order, Prescription, UserReview } from '../types';

export const INITIAL_ADMIN_STATS: AdminStats = {
  totalUsers: 2480,
  proUsers: 920,
  freeUsers: 1560,
  totalBuyers: 640,
  nonBuyers: 1840,
  totalReviews: 412,
  totalRevenue: 1845000,
  totalOrders: 835,
  pendingReportsCount: 4,
};

export const INITIAL_USER_REPORTS_FOR_ADMIN: MedicalReportAnalysis[] = [
  {
    id: 'rep_usr_101',
    userId: 'usr_rahul_99',
    userName: 'Rahul Verma',
    reportName: 'Complete Blood Count & Lipid Profile',
    uploadedAt: '2026-08-24T08:15:00Z',
    summary: 'Elevated total cholesterol (228 mg/dL) and LDL (142 mg/dL). Fasting blood sugar is normal at 91 mg/dL. Low serum Vitamin D3.',
    biomarkers: [
      { name: 'Total Cholesterol', value: '228 mg/dL', status: 'high', referenceRange: '< 200 mg/dL', impactOnDiet: 'Strict limit on saturated fatty acids and fried street food.' },
      { name: 'LDL Bad Cholesterol', value: '142 mg/dL', status: 'high', referenceRange: '< 100 mg/dL', impactOnDiet: 'Increase soluble fiber (oats, isabgol, psyllium).' },
      { name: 'Fasting Blood Glucose', value: '91 mg/dL', status: 'normal', referenceRange: '70-99 mg/dL', impactOnDiet: 'Good insulin response; maintain current carb pacing.' },
      { name: 'Vitamin D3', value: '18.4 ng/mL', status: 'low', referenceRange: '30-100 ng/mL', impactOnDiet: 'Deficiency causes sluggish recovery and metabolic slowdown.' },
    ],
    identifiedRisks: ['Atherosclerosis Risk (Elevated LDL)', 'Vitamin D3 Deficiency'],
    dietaryRecommendations: [
      'Take 30g daily fiber via chia seeds, oats, and green leafy vegetables.',
      'Replace cooking butter/refined oils with cold-pressed mustard or olive oil.',
      'Supplement with Vitamin D3 60,000 IU weekly for 8 weeks.',
      'Add Omega-3 Triple Strength fish oil / flaxseed daily.',
    ],
    macroAdjustments: {
      proteinMultiplier: 2.0,
      carbAdjustment: 'Complex fiber-rich carbohydrates',
      fatAdjustment: 'Limit saturated fats to < 15g/day',
      keyNutrientsToBoost: ['Soluble Fiber', 'Vitamin D3', 'Omega-3 EPA/DHA'],
      foodsToAvoid: ['Deep fried snacks', 'Butter ghee excess', 'Commercial bakery biscuits'],
    },
    adminReviewed: false,
  },
  {
    id: 'rep_usr_102',
    userId: 'usr_priya_88',
    userName: 'Priya Sharma',
    reportName: 'Thyroid (TSH) & Metabolic Screening',
    uploadedAt: '2026-08-24T06:30:00Z',
    summary: 'Mild subclinical hypothyroidism (TSH 5.6 mIU/L). Borderline low Hemoglobin (11.2 g/dL). Blood sugar is optimal.',
    biomarkers: [
      { name: 'TSH (Thyroid Stimulating)', value: '5.6 mIU/L', status: 'high', referenceRange: '0.4-4.0 mIU/L', impactOnDiet: 'Metabolic slowdown; requires selenium and zinc support.' },
      { name: 'Hemoglobin (Hb)', value: '11.2 g/dL', status: 'low', referenceRange: '12.0-15.5 g/dL', impactOnDiet: 'Mild anemia; needs dietary iron and Vitamin C synergy.' },
      { name: 'HbA1c', value: '5.2%', status: 'normal', referenceRange: '< 5.7%', impactOnDiet: 'Healthy long-term glucose average.' },
    ],
    identifiedRisks: ['Subclinical Thyroid Slowdown', 'Mild Iron Deficiency Anemia'],
    dietaryRecommendations: [
      'Eat Brazil nuts (1-2 daily) for natural Selenium support.',
      'Consume iron-rich foods (beetroot, spinach, pomegranates) with lemon juice for maximum absorption.',
      'Avoid raw goitrogenic vegetables in excess (lightly steam broccoli/cabbage).',
    ],
    macroAdjustments: {
      proteinMultiplier: 1.8,
      carbAdjustment: 'Low glycemic whole grains & lentils',
      fatAdjustment: 'Moderate healthy fats (coconut, walnuts)',
      keyNutrientsToBoost: ['Iron + Vitamin C', 'Selenium', 'Zinc', 'Iodine'],
      foodsToAvoid: ['Soy protein isolate', 'Excess raw kale/cabbage', 'Refined sugar'],
    },
    adminReviewed: true,
    adminNotes: 'Prescribed Iron + Folic Acid tablet and UrCare Supergreens.',
  },
];

export const INITIAL_PRESCRIPTIONS: Prescription[] = [
  {
    id: 'rx_101',
    userId: 'usr_priya_88',
    userName: 'Priya Sharma',
    reportId: 'rep_usr_102',
    doctorName: 'Dr. Arjun Mehta, MD Clinical Nutrition',
    date: '2026-08-24',
    diagnosis: 'Subclinical Hypothyroidism & Borderline Iron Anemia',
    medicines: [
      { name: 'Ferrous Ascorbate + Folic Acid', dosage: '100mg', frequency: 'Once daily after lunch', duration: '30 Days', notes: 'Take with lemon water for high absorption' },
      { name: 'Selenium & Zinc Chelate', dosage: '50mcg / 15mg', frequency: 'Once daily with breakfast', duration: '60 Days', notes: 'Supports active T3 conversion' },
    ],
    recommendedSupplements: [
      'UrCare Daily Supergreens & Probiotics',
      'Organic Plant Protein (Chocolate)',
    ],
    dietaryAdjustments: [
      'Increase daily iron intake to 18mg (spinach, dates, raisins).',
      'Keep water intake at minimum 3.0 Liters daily.',
    ],
    notes: 'Patient responded well. Schedule follow-up blood test in 6 weeks.',
  },
];

export const INITIAL_REVIEWS: UserReview[] = [
  {
    id: 'rev_1',
    userId: 'usr_amit_44',
    userName: 'Amit Malhotra',
    rating: 5,
    comment: 'Lost 6.2 kg in 45 days! The AI food scan is so easy and the doctor prescription based on my cholesterol report helped normalize my lipid numbers.',
    date: '2026-08-23',
    productName: 'UrCare 100% Pure Whey Isolate',
    verified: true,
  },
  {
    id: 'rev_2',
    userId: 'usr_sneha_22',
    userName: 'Sneha Patel',
    rating: 5,
    comment: 'The QR payment was seamless and delivery arrived in 2 days. The plant protein tastes fantastic and doesn’t cause any stomach bloating.',
    date: '2026-08-22',
    productName: 'Organic Plant Protein',
    verified: true,
  },
  {
    id: 'rev_3',
    userId: 'usr_vikas_91',
    userName: 'Vikas Kumar',
    rating: 5,
    comment: 'Best nutrition app in India. Both English and Hindi recommendations are crystal clear.',
    date: '2026-08-21',
    productName: 'Triple Strength Omega-3',
    verified: true,
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-98231',
    userId: 'usr_rahul_99',
    userName: 'Rahul Verma',
    userEmail: 'rahul.verma@example.com',
    items: [
      {
        product: {
          id: 'prod_whey_iso',
          name: 'UrCare 100% Pure Whey Isolate',
          category: 'protein',
          price: 3499,
          discountPrice: 2699,
          rating: 4.9,
          reviewsCount: 1420,
          image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&auto=format&fit=crop&q=80',
          description: 'Ultra-filtered 27g protein per scoop',
          benefits: ['27g Protein', 'Zero Bloating'],
          inStock: true,
        },
        quantity: 1,
      },
      {
        product: {
          id: 'prod_omega_3',
          name: 'Triple Strength Omega-3 Fish Oil',
          category: 'vitamins',
          price: 1299,
          discountPrice: 849,
          rating: 4.9,
          reviewsCount: 2310,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
          description: 'Deep sea fish oil for heart protection',
          benefits: ['Lowers LDL', 'Heart Health'],
          inStock: true,
        },
        quantity: 1,
      },
    ],
    shippingAddress: {
      fullName: 'Rahul Verma',
      phone: '+91 98765 43210',
      streetAddress: 'Flat 402, Green Valley Heights, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400053',
    },
    subtotal: 3548,
    discount: 200,
    total: 3348,
    paymentMethod: 'qr_upi',
    paymentStatus: 'paid',
    orderStatus: 'shipped',
    transactionId: 'UPI-98321049281',
    createdAt: '2026-08-23T14:20:00Z',
    estimatedDelivery: '2026-08-26',
  },
];
