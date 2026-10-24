// Why each condition happens (its root causes) and how the UrCare reversal
// treatment works on it. General wellness education, written simply.
export type Bi = [string, string];
export interface RootCauseInfo {
  emoji: string;
  name: Bi;
  causes: Bi[];
  fixes: Bi[];
}

export const ROOT_CAUSES: Record<string, RootCauseInfo> = {
  'Diabetes / Pre-Diabetes': {
    emoji: '🩸',
    name: ['Diabetes / Pre-diabetes', 'डायबिटीज़ / प्री-डायबिटीज़'],
    causes: [
      ['Insulin resistance — your cells stop listening to insulin, so sugar stays in the blood.', 'इंसुलिन रेज़िस्टेंस — शरीर की कोशिकाएं इंसुलिन की बात नहीं सुनतीं, इसलिए शुगर खून में रह जाती है।'],
      ['Too many refined carbs and sugar (white rice, maida, sweets, juices) spike sugar again and again.', 'बहुत ज़्यादा रिफाइंड कार्ब्स और चीनी (सफ़ेद चावल, मैदा, मिठाई, जूस) बार-बार शुगर बढ़ाते हैं।'],
      ['Belly fat, long sitting, poor sleep and stress make insulin work even worse.', 'पेट की चर्बी, लंबे समय बैठना, खराब नींद और तनाव इंसुलिन को और कमज़ोर करते हैं।'],
      ['A tired pancreas (beta cells) after years of high sugar.', 'सालों की ज़्यादा शुगर से थका हुआ पैंक्रियास (बीटा सेल्स)।'],
    ],
    fixes: [
      ['Low-glycaemic Indian meals with protein and fibre first, carbs last.', 'लो-ग्लाइसेमिक भारतीय खाना — पहले प्रोटीन और फाइबर, कार्ब्स आख़िर में।'],
      ['A 10–20 minute walk after every main meal to pull sugar into the muscles.', 'हर मुख्य खाने के बाद 10–20 मिनट टहलना, ताकि शुगर मांसपेशियों में जाए।'],
      ['Ayurvedic support (PancreReViv, GlucoLow) and a fixed daily routine to calm insulin resistance.', 'आयुर्वेदिक सहयोग (PancreReViv, GlucoLow) और तय दिनचर्या से इंसुलिन रेज़िस्टेंस कम करना।'],
      ['Doctor-guided review of your sugar readings and medicines as they improve.', 'सुधार के साथ डॉक्टर द्वारा आपकी शुगर रीडिंग और दवाओं की समीक्षा।'],
    ],
  },
  'Obesity': {
    emoji: '⚖️',
    name: ['Excess weight', 'मोटापा'],
    causes: [
      ['High insulin keeps the body in fat-storing mode.', 'ज़्यादा इंसुलिन शरीर को चर्बी जमा करने वाले मोड में रखता है।'],
      ['Frequent snacking, late dinners, sugary drinks and fried food.', 'बार-बार खाना, देर से डिनर, मीठे पेय और तला खाना।'],
      ['Low muscle and little daily movement slow the metabolism.', 'कम मांसपेशी और कम चलना-फिरना मेटाबॉलिज़्म धीमा करते हैं।'],
      ['Poor sleep and stress raise hunger hormones.', 'खराब नींद और तनाव भूख के हार्मोन बढ़ाते हैं।'],
    ],
    fixes: [
      ['High-protein, high-fibre plate with a gentle calorie deficit — no starving.', 'ज़्यादा प्रोटीन और फाइबर वाली थाली, हल्की कैलोरी कमी — भूखे नहीं रहना।'],
      ['Fixed meal times with a 12–14 hour overnight gap.', 'खाने का तय समय और रात में 12–14 घंटे का अंतर।'],
      ['Daily walking plus 3 days of strength exercise to build muscle.', 'रोज़ टहलना और हफ़्ते में 3 दिन ताकत वाली एक्सरसाइज़।'],
      ['7–8 hours of sleep to reset hunger hormones.', '7–8 घंटे की नींद ताकि भूख के हार्मोन ठीक हों।'],
    ],
  },
  'High Blood Pressure': {
    emoji: '❤️',
    name: ['High blood pressure', 'हाई ब्लड प्रेशर'],
    causes: [
      ['Too much salt and packaged food hold water and tighten blood vessels.', 'ज़्यादा नमक और पैकेट वाला खाना पानी रोकते हैं और नसें सख़्त करते हैं।'],
      ['Insulin resistance and belly fat stiffen the arteries.', 'इंसुलिन रेज़िस्टेंस और पेट की चर्बी धमनियों को सख़्त बनाते हैं।'],
      ['Ongoing stress, poor sleep and little exercise.', 'लगातार तनाव, खराब नींद और कम एक्सरसाइज़।'],
    ],
    fixes: [
      ['Low-sodium, potassium-rich food (vegetables, dal, fruits, curd).', 'कम नमक, पोटैशियम वाला खाना (सब्ज़ियां, दाल, फल, दही)।'],
      ['Daily brisk walk and pranayama / deep breathing.', 'रोज़ तेज़ चलना और प्राणायाम / गहरी सांस।'],
      ['Heart support (Cardiol) and regular BP checks with your doctor.', 'दिल का सहयोग (Cardiol) और डॉक्टर के साथ नियमित BP जांच।'],
    ],
  },
  'High Cholesterol / Fatty Liver': {
    emoji: '🫀',
    name: ['Cholesterol / Fatty liver', 'कोलेस्ट्रॉल / फैटी लिवर'],
    causes: [
      ['Extra sugar and refined carbs are turned into fat inside the liver.', 'ज़्यादा चीनी और रिफाइंड कार्ब्स लिवर में चर्बी बन जाते हैं।'],
      ['Fried food, trans fats and alcohol.', 'तला खाना, ट्रांस फैट और शराब।'],
      ['Belly fat and an inactive lifestyle.', 'पेट की चर्बी और कम सक्रिय जीवनशैली।'],
    ],
    fixes: [
      ['More fibre (vegetables, millets, sprouts), less sugar and fried food.', 'ज़्यादा फाइबर (सब्ज़ी, मिलेट्स, अंकुरित), कम चीनी और तला।'],
      ['Liver detox routine with LVReVerse Max and plenty of water.', 'LVReVerse Max और भरपूर पानी के साथ लिवर डिटॉक्स दिनचर्या।'],
      ['Daily exercise to burn liver fat; repeat lipid / LFT test after 3 months.', 'लिवर की चर्बी घटाने के लिए रोज़ एक्सरसाइज़; 3 महीने बाद लिपिड / LFT टेस्ट।'],
    ],
  },
  'Thyroid (Hypo/Hyper)': {
    emoji: '🦋',
    name: ['Thyroid', 'थायरॉइड'],
    causes: [
      ['Autoimmune inflammation attacking the thyroid gland.', 'ऑटोइम्यून सूजन जो थायरॉइड ग्रंथि पर असर करती है।'],
      ['Low selenium, zinc, iron or vitamin D; poor gut health.', 'कम सेलेनियम, ज़िंक, आयरन या विटामिन D; कमज़ोर पाचन।'],
      ['Long-term stress and poor sleep disturb hormones.', 'लंबा तनाव और खराब नींद हार्मोन बिगाड़ते हैं।'],
    ],
    fixes: [
      ['Anti-inflammatory, nutrient-rich meals at fixed times.', 'सूजन कम करने वाला पौष्टिक खाना, तय समय पर।'],
      ['Gut repair and stress care (yoga, breathing, sleep routine).', 'पाचन सुधार और तनाव की देखभाल (योग, सांस, नींद की दिनचर्या)।'],
      ['Take thyroid medicine exactly as prescribed; recheck TSH with your doctor.', 'थायरॉइड की दवा डॉक्टर के बताए अनुसार लें; TSH डॉक्टर से दोबारा जांचें।'],
    ],
  },
  'PCOS / PCOD': {
    emoji: '🌸',
    name: ['PCOS / PCOD', 'PCOS / PCOD'],
    causes: [
      ['Insulin resistance raises male hormones and disturbs periods.', 'इंसुलिन रेज़िस्टेंस पुरुष हार्मोन बढ़ाता है और पीरियड्स बिगाड़ता है।'],
      ['Weight gain, sugary food and low activity.', 'वज़न बढ़ना, मीठा खाना और कम सक्रियता।'],
      ['Stress and irregular sleep.', 'तनाव और अनियमित नींद।'],
    ],
    fixes: [
      ['Low-GI, high-protein meals to lower insulin.', 'इंसुलिन घटाने के लिए लो-GI, ज़्यादा प्रोटीन वाला खाना।'],
      ['Regular exercise, yoga and a calm sleep routine.', 'नियमित एक्सरसाइज़, योग और शांत नींद की दिनचर्या।'],
      ['Hormone-friendly Ayurvedic support guided by the care team.', 'केयर टीम के मार्गदर्शन में हार्मोन के लिए आयुर्वेदिक सहयोग।'],
    ],
  },
  'Neuropathy (Nerve Pain/Tingling)': {
    emoji: '⚡',
    name: ['Nerve pain / tingling', 'नसों में दर्द / झनझनाहट'],
    causes: [
      ['Long-term high sugar damages the small nerves and their blood supply.', 'लंबे समय की ज़्यादा शुगर छोटी नसों और उनकी खून की सप्लाई को नुकसान पहुंचाती है।'],
      ['Low vitamin B12 (common with metformin) and poor circulation.', 'कम विटामिन B12 (मेटफ़ॉर्मिन के साथ आम) और कमज़ोर रक्त संचार।'],
    ],
    fixes: [
      ['Steady blood sugar is the first step for nerve healing.', 'स्थिर शुगर नसों के ठीक होने का पहला कदम है।'],
      ['Nerve restoration support (ReNerve H2T, BetaReViv) and B-vitamin rich food.', 'नसों के लिए सहयोग (ReNerve H2T, BetaReViv) और B-विटामिन वाला खाना।'],
      ['Daily foot care, walking and leg exercises to improve circulation.', 'रोज़ पैरों की देखभाल, टहलना और पैरों की एक्सरसाइज़।'],
    ],
  },
  'Diabetic Retinopathy': {
    emoji: '👁️',
    name: ['Eye (retinopathy)', 'आंख (रेटिनोपैथी)'],
    causes: [
      ['High sugar and BP damage the tiny blood vessels of the eye.', 'ज़्यादा शुगर और BP आंख की छोटी नसों को नुकसान पहुंचाते हैं।'],
      ['Oxidative stress from poor diet and smoking.', 'खराब खान-पान और धूम्रपान से ऑक्सीडेटिव तनाव।'],
    ],
    fixes: [
      ['Tight sugar and BP control.', 'शुगर और BP पर अच्छा नियंत्रण।'],
      ['Antioxidant-rich food (green leafy vegetables, colourful fruits).', 'एंटीऑक्सीडेंट वाला खाना (हरी पत्तेदार सब्ज़ी, रंग-बिरंगे फल)।'],
      ['Regular eye check-ups with your eye doctor.', 'आंख के डॉक्टर से नियमित जांच।'],
    ],
  },
  'Heart Disease': {
    emoji: '💓',
    name: ['Heart health', 'दिल की बीमारी'],
    causes: [
      ['Inflammation and plaque in the arteries from high sugar, cholesterol and BP.', 'ज़्यादा शुगर, कोलेस्ट्रॉल और BP से धमनियों में सूजन और प्लाक।'],
      ['Smoking, stress, belly fat and an inactive life.', 'धूम्रपान, तनाव, पेट की चर्बी और कम सक्रिय जीवन।'],
    ],
    fixes: [
      ['Heart-healthy, low-sodium, omega-3 rich food.', 'दिल के लिए अच्छा, कम नमक, ओमेगा-3 वाला खाना।'],
      ['Gentle, doctor-approved daily walking and breathing practice.', 'डॉक्टर की सलाह से हल्का रोज़ टहलना और सांस का अभ्यास।'],
      ['Cardiol support and regular reviews with your cardiologist.', 'Cardiol का सहयोग और हृदय रोग विशेषज्ञ से नियमित समीक्षा।'],
    ],
  },
  'Kidney Disease': {
    emoji: '🫘',
    name: ['Kidney health', 'किडनी की बीमारी'],
    causes: [
      ['Years of high sugar and high BP damage the kidney filters.', 'सालों की ज़्यादा शुगर और BP किडनी के फ़िल्टर को नुकसान पहुंचाते हैं।'],
      ['Too much salt, painkillers and too little water.', 'ज़्यादा नमक, दर्द की दवाएं और कम पानी।'],
    ],
    fixes: [
      ['Controlled protein and sodium, with the right amount of water.', 'नियंत्रित प्रोटीन और नमक, सही मात्रा में पानी।'],
      ['Kidney support (Kronic Kidney Protector-3) and sugar + BP control.', 'किडनी का सहयोग (Kronic Kidney Protector-3) और शुगर + BP नियंत्रण।'],
      ['Creatinine / urea tests every 3 months with your doctor.', 'हर 3 महीने डॉक्टर के साथ क्रिएटिनिन / यूरिया टेस्ट।'],
    ],
  },
  'Joint Pain / Arthritis': {
    emoji: '🦴',
    name: ['Joint pain', 'जोड़ों का दर्द'],
    causes: [
      ['Inflammation from sugar, processed food and excess weight.', 'चीनी, प्रोसेस्ड खाने और ज़्यादा वज़न से सूजन।'],
      ['Weak muscles around the joints and low vitamin D.', 'जोड़ों के आसपास कमज़ोर मांसपेशियां और कम विटामिन D।'],
    ],
    fixes: [
      ['Anti-inflammatory food (turmeric, ginger, vegetables, omega-3).', 'सूजन कम करने वाला खाना (हल्दी, अदरक, सब्ज़ियां, ओमेगा-3)।'],
      ['Gentle mobility, stretching and strength work for the joints.', 'जोड़ों के लिए हल्की गतिशीलता, स्ट्रेचिंग और ताकत की एक्सरसाइज़।'],
      ['Weight reduction to take load off the knees.', 'घुटनों का बोझ घटाने के लिए वज़न कम करना।'],
    ],
  },
  'Chronic Fatigue': {
    emoji: '🔋',
    name: ['Tiredness / low energy', 'थकान / कम ऊर्जा'],
    causes: [
      ['Blood sugar ups and downs during the day.', 'दिन भर शुगर का ऊपर-नीचे होना।'],
      ['Low iron, B12 or vitamin D; poor absorption from a weak gut.', 'कम आयरन, B12 या विटामिन D; कमज़ोर पाचन से कम सोखना।'],
      ['Poor sleep and stress.', 'खराब नींद और तनाव।'],
    ],
    fixes: [
      ['Steady, protein-rich meals at fixed times.', 'तय समय पर स्थिर, प्रोटीन वाला खाना।'],
      ['Gut and absorption support (NutriAbsorb Max).', 'पाचन और सोखने के लिए सहयोग (NutriAbsorb Max)।'],
      ['Morning sunlight, light exercise and a sleep routine.', 'सुबह की धूप, हल्की एक्सरसाइज़ और नींद की दिनचर्या।'],
    ],
  },
  'Sleep Apnea / Sleep Issues': {
    emoji: '🌙',
    name: ['Sleep problems', 'नींद की समस्या'],
    causes: [
      ['Late heavy dinners, screens and caffeine at night.', 'देर से भारी डिनर, रात में स्क्रीन और कैफ़ीन।'],
      ['Excess weight around the neck and belly (sleep apnea).', 'गर्दन और पेट के आसपास ज़्यादा वज़न (स्लीप एपनिया)।'],
      ['Stress and an irregular body clock.', 'तनाव और अनियमित दिनचर्या।'],
    ],
    fixes: [
      ['Light early dinner and a screen-off wind-down routine.', 'हल्का और जल्दी डिनर, सोने से पहले स्क्रीन बंद।'],
      ['Fixed sleep and wake times; bedtime relaxation and breathing.', 'सोने-उठने का तय समय; सोने से पहले रिलैक्सेशन और सांस।'],
      ['Weight loss, and a sleep study with your doctor if you snore heavily.', 'वज़न घटाना, और तेज़ खर्राटे हों तो डॉक्टर से स्लीप स्टडी।'],
    ],
  },
  'Erectile Dysfunction': {
    emoji: '🩺',
    name: ['Erectile dysfunction', 'इरेक्टाइल डिसफ़ंक्शन'],
    causes: [
      ['Damaged blood vessels and nerves from high sugar, BP and cholesterol.', 'ज़्यादा शुगर, BP और कोलेस्ट्रॉल से खराब नसें।'],
      ['Low testosterone, stress, smoking and alcohol.', 'कम टेस्टोस्टेरोन, तनाव, धूम्रपान और शराब।'],
    ],
    fixes: [
      ['Better sugar and circulation through diet and exercise.', 'खाने और एक्सरसाइज़ से बेहतर शुगर और रक्त संचार।'],
      ['Stress care, good sleep and stopping smoking.', 'तनाव की देखभाल, अच्छी नींद और धूम्रपान बंद।'],
      ['Private, doctor-guided support from the care team.', 'केयर टीम से गोपनीय, डॉक्टर द्वारा मार्गदर्शन।'],
    ],
  },
  'Uric Acid / Gout': {
    emoji: '💧',
    name: ['Uric acid / gout', 'यूरिक एसिड / गाउट'],
    causes: [
      ['High-purine food, sugary drinks and alcohol.', 'ज़्यादा प्यूरीन वाला खाना, मीठे पेय और शराब।'],
      ['Too little water, excess weight and insulin resistance.', 'कम पानी, ज़्यादा वज़न और इंसुलिन रेज़िस्टेंस।'],
    ],
    fixes: [
      ['Low-purine meals and 3+ litres of water a day.', 'कम प्यूरीन वाला खाना और रोज़ 3+ लीटर पानी।'],
      ['No sugary drinks; more vegetables, curd and lemon.', 'मीठे पेय बंद; ज़्यादा सब्ज़ी, दही और नींबू।'],
      ['Gentle weight loss and uric acid tests with your doctor.', 'धीरे-धीरे वज़न घटाना और डॉक्टर के साथ यूरिक एसिड टेस्ट।'],
    ],
  },
  'Digestive / IBS': {
    emoji: '🌿',
    name: ['Digestion / IBS', 'पाचन / IBS'],
    causes: [
      ['Weak digestive fire, irregular meals and eating too fast.', 'कमज़ोर पाचन अग्नि, अनियमित खाना और जल्दी-जल्दी खाना।'],
      ['Gut bacteria imbalance from processed food and stress.', 'प्रोसेस्ड खाने और तनाव से आंतों के बैक्टीरिया में गड़बड़ी।'],
    ],
    fixes: [
      ['Fixed meal times, chewing well, warm cooked food.', 'खाने का तय समय, अच्छे से चबाना, गरम पका खाना।'],
      ['Gut-friendly fibre, curd and herbs (jeera, saunf, ajwain).', 'पाचन के लिए फाइबर, दही और मसाले (जीरा, सौंफ, अजवाइन)।'],
      ['Stress care and absorption support (NutriAbsorb Max).', 'तनाव की देखभाल और सोखने का सहयोग (NutriAbsorb Max)।'],
    ],
  },
};

/** For people who haven't picked a condition yet. */
export const GENERAL_ROOT_CAUSE: RootCauseInfo = {
  emoji: '🌱',
  name: ['Metabolic health', 'मेटाबॉलिक हेल्थ'],
  causes: [
    ['Insulin resistance — the hidden root of most lifestyle diseases.', 'इंसुलिन रेज़िस्टेंस — ज़्यादातर लाइफ़स्टाइल बीमारियों की छुपी जड़।'],
    ['Refined food, late meals, sitting all day, poor sleep and stress.', 'रिफाइंड खाना, देर से खाना, दिन भर बैठना, खराब नींद और तनाव।'],
  ],
  fixes: [
    ['A doctor-designed daily routine for food, movement and sleep.', 'खाने, चलने और नींद की डॉक्टर द्वारा बनाई दिनचर्या।'],
    ['Small daily steps, tracked every week.', 'छोटे रोज़ के कदम, हर हफ़्ते ट्रैक किए हुए।'],
  ],
};

/** What to expect over the 3-month treatment. */
export const THREE_MONTHS: { title: Bi; text: Bi }[] = [
  { title: ['Month 1 — Reset', 'महीना 1 — रीसेट'], text: ['Your body adjusts to the new routine. Sugar swings and cravings start to calm, energy and sleep improve.', 'शरीर नई दिनचर्या में ढलता है। शुगर का ऊपर-नीचे होना और क्रेविंग शांत होने लगती है, ऊर्जा और नींद सुधरती है।'] },
  { title: ['Month 2 — Repair', 'महीना 2 — रिपेयर'], text: ['Insulin starts working better. Weight, waist and fasting sugar begin to drop; digestion feels lighter.', 'इंसुलिन बेहतर काम करने लगता है। वज़न, कमर और फास्टिंग शुगर घटने लगते हैं; पाचन हल्का लगता है।'] },
  { title: ['Month 3 — Reverse', 'महीना 3 — रिवर्स'], text: ['Your new habits become natural. Repeat your tests — HbA1c and other reports show the change, and your doctor reviews your medicines.', 'नई आदतें स्वाभाविक बन जाती हैं। टेस्ट दोबारा कराएं — HbA1c और दूसरी रिपोर्ट में बदलाव दिखता है, और डॉक्टर आपकी दवाओं की समीक्षा करते हैं।'] },
];
