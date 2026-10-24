// Season and month guide for the plan (Indian seasons). General diet and
// lifestyle tips for metabolic health; the doctor-guided plan itself stays.
export type Bi = [string, string];
export type SeasonKey = 'spring' | 'summer' | 'monsoon' | 'autumn' | 'winter';

export const SEASONS: Record<SeasonKey, { emoji: string; name: Bi; months: Bi; food: Bi[]; move: Bi[]; care: Bi[] }> = {
  spring: {
    emoji: '🌼', name: ['Spring (Basant)', 'बसंत'], months: ['Feb – Mar', 'फ़रवरी – मार्च'],
    food: [['Light, warm meals; bitter greens like methi and neem help sugar control.', 'हल्का, गरम खाना; मेथी और नीम जैसी कड़वी चीज़ें शुगर कंट्रोल में मदद करती हैं।'], ['Barley, millets and moong dal over heavy, oily food.', 'भारी और तेल वाले खाने की जगह जौ, मिलेट्स और मूंग दाल।']],
    move: [['Great weather for longer morning walks and yoga outdoors.', 'सुबह लंबी सैर और बाहर योग के लिए बढ़िया मौसम।']],
    care: [['Allergy season — keep honey and sweets away even if you feel low.', 'एलर्जी का मौसम — कमज़ोरी लगे तब भी शहद और मिठाई से दूर रहें।']],
  },
  summer: {
    emoji: '☀️', name: ['Summer', 'गर्मी'], months: ['Apr – Jun', 'अप्रैल – जून'],
    food: [['Drink 3–4 litres of water, buttermilk, lemon water (no sugar), sattu.', '3–4 लीटर पानी, छाछ, बिना चीनी नींबू पानी, सत्तू।'], ['Cooling foods: cucumber, lauki, tori, curd, mint. Skip mango shakes and cold drinks.', 'ठंडक देने वाला खाना: खीरा, लौकी, तोरी, दही, पुदीना। मैंगो शेक और कोल्ड ड्रिंक न लें।']],
    move: [['Exercise early morning or after sunset, never in the afternoon heat.', 'एक्सरसाइज़ सुबह जल्दी या सूरज ढलने के बाद, दोपहर की गर्मी में नहीं।']],
    care: [['Dehydration can raise sugar — check readings more often on hot days.', 'पानी की कमी से शुगर बढ़ सकती है — गर्म दिनों में ज़्यादा बार जांचें।']],
  },
  monsoon: {
    emoji: '🌧️', name: ['Monsoon', 'बरसात'], months: ['Jul – Sep', 'जुलाई – सितंबर'],
    food: [['Freshly cooked, warm food; avoid street food and raw salads from outside.', 'ताज़ा पका गरम खाना; बाहर का स्ट्रीट फ़ूड और कच्चा सलाद न लें।'], ['Ginger, turmeric, jeera, ajwain support weak monsoon digestion.', 'अदरक, हल्दी, जीरा, अजवाइन बरसात में कमज़ोर पाचन में मदद करते हैं।']],
    move: [['Indoor workouts: yoga, home strength, stair walking, skipping.', 'घर के अंदर: योग, होम स्ट्रेंथ, सीढ़ियां चढ़ना, रस्सी कूदना।']],
    care: [['Keep feet dry and check them daily — infections spread fast in diabetes.', 'पैर सूखे रखें और रोज़ देखें — डायबिटीज़ में इन्फ़ेक्शन जल्दी फैलता है।']],
  },
  autumn: {
    emoji: '🍂', name: ['Autumn (Sharad)', 'शरद'], months: ['Oct – Nov', 'अक्टूबर – नवंबर'],
    food: [['Festival season — choose roasted snacks and sugar-free sweets in small portions.', 'त्योहारों का मौसम — भुने स्नैक्स और थोड़ी मात्रा में शुगर-फ़्री मिठाई चुनें।'], ['Amla, guava, pomegranate and leafy greens are at their best.', 'आंवला, अमरूद, अनार और हरी पत्तेदार सब्ज़ियां सबसे अच्छी मिलती हैं।']],
    move: [['Pleasant weather — add brisk walks after every festive meal.', 'सुहाना मौसम — हर त्योहार वाले खाने के बाद तेज़ सैर करें।']],
    care: [['Late nights and sweets spike sugar — keep sleep and meal times fixed.', 'देर रात और मिठाई से शुगर बढ़ती है — नींद और खाने का समय तय रखें।']],
  },
  winter: {
    emoji: '❄️', name: ['Winter', 'सर्दी'], months: ['Dec – Jan', 'दिसंबर – जनवरी'],
    food: [['Warm soups, bajra / jowar roti, sarson saag, methi; a few soaked nuts.', 'गरम सूप, बाजरा / ज्वार रोटी, सरसों का साग, मेथी; थोड़े भीगे मेवे।'], ['Go easy on gajar halwa, gur and fried winter snacks.', 'गाजर का हलवा, गुड़ और तले सर्दी के नाश्ते कम लें।']],
    move: [['Cold makes people sit more — do 10-minute indoor walks every 2 hours.', 'ठंड में लोग ज़्यादा बैठते हैं — हर 2 घंटे में 10 मिनट घर में टहलें।']],
    care: [['Sugar and BP often rise in winter; get 15–20 minutes of sunlight for vitamin D.', 'सर्दी में शुगर और BP अक्सर बढ़ते हैं; विटामिन D के लिए 15–20 मिनट धूप लें।']],
  },
};

/** Season for a month (0 = January). */
export function seasonForMonth(m: number): SeasonKey {
  if (m === 1 || m === 2) return 'spring';
  if (m >= 3 && m <= 5) return 'summer';
  if (m >= 6 && m <= 8) return 'monsoon';
  if (m === 9 || m === 10) return 'autumn';
  return 'winter';
}

export const MONTH_NAMES: Bi[] = [
  ['January', 'जनवरी'], ['February', 'फ़रवरी'], ['March', 'मार्च'], ['April', 'अप्रैल'], ['May', 'मई'], ['June', 'जून'],
  ['July', 'जुलाई'], ['August', 'अगस्त'], ['September', 'सितंबर'], ['October', 'अक्टूबर'], ['November', 'नवंबर'], ['December', 'दिसंबर'],
];

/** Diabetes-friendly fruits and vegetables in season each month (India). */
export const MONTH_PRODUCE: Bi[][] = [
  [['Spinach', 'पालक'], ['Methi', 'मेथी'], ['Sarson', 'सरसों'], ['Cauliflower', 'गोभी'], ['Carrot', 'गाजर'], ['Guava', 'अमरूद'], ['Amla', 'आंवला']],
  [['Peas', 'मटर'], ['Broccoli', 'ब्रोकली'], ['Radish', 'मूली'], ['Beetroot', 'चुकंदर'], ['Orange', 'संतरा'], ['Strawberry', 'स्ट्रॉबेरी']],
  [['Bathua', 'बथुआ'], ['Cabbage', 'पत्ता गोभी'], ['Raw mango (small)', 'कच्चा आम (थोड़ा)'], ['Papaya', 'पपीता'], ['Spring onion', 'हरा प्याज़']],
  [['Lauki', 'लौकी'], ['Tori', 'तोरी'], ['Cucumber', 'खीरा'], ['Karela', 'करेला'], ['Jamun (early)', 'जामुन (शुरुआती)']],
  [['Cucumber', 'खीरा'], ['Tinda', 'टिंडा'], ['Karela', 'करेला'], ['Watermelon (small bowl)', 'तरबूज़ (छोटी कटोरी)'], ['Mint', 'पुदीना']],
  [['Lauki', 'लौकी'], ['Parwal', 'परवल'], ['Jamun', 'जामुन'], ['Plum', 'आलूबुखारा'], ['Bhindi', 'भिंडी']],
  [['Jamun', 'जामुन'], ['Pear', 'नाशपाती'], ['Bhindi', 'भिंडी'], ['Arbi', 'अरबी'], ['Corn (small)', 'भुट्टा (थोड़ा)']],
  [['Pear', 'नाशपाती'], ['Apple', 'सेब'], ['Karela', 'करेला'], ['Kundru', 'कुंदरू'], ['Ginger', 'अदरक']],
  [['Guava', 'अमरूद'], ['Pomegranate', 'अनार'], ['Pumpkin', 'कद्दू'], ['Beans', 'बीन्स'], ['Lemon', 'नींबू']],
  [['Amla', 'आंवला'], ['Guava', 'अमरूद'], ['Spinach', 'पालक'], ['Sweet lime', 'मौसमी'], ['Shakarkandi (small)', 'शकरकंद (थोड़ा)']],
  [['Methi', 'मेथी'], ['Carrot', 'गाजर'], ['Cauliflower', 'गोभी'], ['Orange', 'संतरा'], ['Pomegranate', 'अनार']],
  [['Sarson', 'सरसों'], ['Bathua', 'बथुआ'], ['Peas', 'मटर'], ['Guava', 'अमरूद'], ['Amla', 'आंवला'], ['Turnip', 'शलजम']],
];
