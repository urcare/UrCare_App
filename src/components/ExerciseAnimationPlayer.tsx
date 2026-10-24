import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

// Exercise animations from LottieFiles (Lottie Simple License — free for
// commercial use, no attribution required), stored in public/lottie/exercise.
interface Move {
  file: string;
  name: [string, string];
  start: [string, string];
  posture: [string, string];
  reps: number;
  unit: 'reps' | 'breaths' | 'steps' | 'seconds';
}

const MOVES: Record<string, Move> = {
  walk: { file: 'walk-b', name: ['Brisk walk', 'तेज़ चाल'], start: ['Stand tall, shoulders relaxed.', 'सीधे खड़े हों, कंधे ढीले।'], posture: ['Swing arms naturally, heel then toe, steady pace.', 'हाथ सहज झुलाएं, पहले एड़ी फिर पंजा, एक जैसी रफ़्तार।'], reps: 20, unit: 'steps' },
  breathe: { file: 'meditate-b', name: ['Deep breathing', 'गहरी सांस'], start: ['Sit cross-legged, spine straight, hands on knees.', 'पालथी मारकर बैठें, रीढ़ सीधी, हाथ घुटनों पर।'], posture: ['Breathe in 4 counts through the nose, out 6 counts.', 'नाक से 4 गिनती में सांस लें, 6 गिनती में छोड़ें।'], reps: 10, unit: 'breaths' },
  cobra: { file: 'yoga-cobra', name: ['Cobra pose (Bhujangasana)', 'भुजंगासन'], start: ['Lie on your stomach, palms under shoulders.', 'पेट के बल लेटें, हथेलियां कंधों के नीचे।'], posture: ['Lift chest slowly, hips stay down, elbows soft.', 'छाती धीरे उठाएं, कूल्हे ज़मीन पर, कोहनी हल्की मुड़ी।'], reps: 8, unit: 'reps' },
  stretch: { file: 'stretch', name: ['Shoulder stretch', 'कंधे का स्ट्रेच'], start: ['Stand with feet hip-width apart.', 'पैर कूल्हे जितनी दूरी पर रखकर खड़े हों।'], posture: ['Pull one arm across the chest, hold, switch sides.', 'एक हाथ छाती के पार खींचें, रुकें, फिर दूसरा।'], reps: 6, unit: 'reps' },
  hip: { file: 'hip', name: ['Knee raise & hip opener', 'घुटना उठाना व हिप ओपनर'], start: ['Stand tall, hands on hips.', 'सीधे खड़े हों, हाथ कमर पर।'], posture: ['Lift the knee to hip height, open it out, lower slowly.', 'घुटना कमर तक उठाएं, बाहर घुमाएं, धीरे नीचे लाएं।'], reps: 10, unit: 'reps' },
  squat: { file: 'squat', name: ['Squat', 'स्क्वाट'], start: ['Feet shoulder-width, toes slightly out.', 'पैर कंधों जितने खुले, पंजे थोड़े बाहर।'], posture: ['Sit back like into a chair, chest up, knees over toes.', 'कुर्सी पर बैठने जैसे पीछे जाएं, छाती ऊपर, घुटने पंजों की सीध में।'], reps: 12, unit: 'reps' },
  pushup: { file: 'pushup', name: ['Push-up', 'पुश-अप'], start: ['Hands under shoulders, body in a straight line.', 'हाथ कंधों के नीचे, शरीर एक सीधी लाइन में।'], posture: ['Lower chest to the floor, press back up. Knees down if needed.', 'छाती ज़मीन तक लाएं, वापस ऊपर धकेलें। ज़रूरत हो तो घुटने टिकाएं।'], reps: 10, unit: 'reps' },
  lunge: { file: 'lunge', name: ['Lunge', 'लंज'], start: ['Stand tall, step one foot forward.', 'सीधे खड़े हों, एक पैर आगे रखें।'], posture: ['Bend both knees to 90°, front knee over the ankle.', 'दोनों घुटने 90° मोड़ें, आगे का घुटना टखने के ऊपर।'], reps: 10, unit: 'reps' },
  plank: { file: 'plank', name: ['Plank with reach', 'प्लैंक'], start: ['Forearms under shoulders, legs straight.', 'कोहनियां कंधों के नीचे, पैर सीधे।'], posture: ['Keep hips level, tighten the stomach, breathe.', 'कूल्हे सीध में, पेट टाइट, सांस लेते रहें।'], reps: 20, unit: 'seconds' },
  sleep: { file: 'sleep', name: ['Bedtime relaxation (Yoga Nidra)', 'सोने से पहले रिलैक्सेशन (योग निद्रा)'], start: ['Lie on your back in bed, arms by your sides, eyes closed.', 'बिस्तर पर पीठ के बल लेटें, हाथ बगल में, आंखें बंद।'], posture: ['Relax each body part from toes to head, slow breaths.', 'पैरों से सिर तक हर अंग ढीला छोड़ें, धीमी सांस।'], reps: 10, unit: 'breaths' },
  seated: { file: 'yoga-seated', name: ['Seated yoga (Sukhasana)', 'सुखासन'], start: ['Sit cross-legged on a mat, back straight.', 'चटाई पर पालथी मारकर बैठें, पीठ सीधी।'], posture: ['Relax shoulders, hands on knees, breathe slowly.', 'कंधे ढीले, हाथ घुटनों पर, धीरे सांस लें।'], reps: 10, unit: 'breaths' },
  core: { file: 'core-ball', name: ['Core workout', 'पेट की एक्सरसाइज़'], start: ['Lie on your back, knees bent, feet flat.', 'पीठ के बल लेटें, घुटने मोड़ें, पैर ज़मीन पर।'], posture: ['Lift legs slowly, keep the lower back on the floor.', 'पैर धीरे उठाएं, कमर ज़मीन से लगी रहे।'], reps: 10, unit: 'reps' },
  chakra: { file: 'meditate-chakra', name: ['Meditation', 'ध्यान'], start: ['Sit comfortably, spine tall, eyes closed.', 'आराम से बैठें, रीढ़ सीधी, आंखें बंद।'], posture: ['Focus on the breath; if the mind wanders, come back.', 'सांस पर ध्यान रखें; मन भटके तो वापस लाएं।'], reps: 12, unit: 'breaths' },
  chairSquat: { file: 'chair-squat', name: ['Chair sit-to-stand', 'कुर्सी से उठना-बैठना'], start: ['Sit at the front of a sturdy chair, feet flat.', 'मज़बूत कुर्सी के आगे बैठें, पैर ज़मीन पर।'], posture: ['Stand up without using hands, sit back down slowly.', 'हाथों के बिना खड़े हों, धीरे वापस बैठें।'], reps: 10, unit: 'reps' },
  gobletSquat: { file: 'goblet-squat', name: ['Weighted squat', 'वज़न के साथ स्क्वाट'], start: ['Hold a light weight or water bottle at your chest.', 'हल्का वज़न या पानी की बोतल छाती पर पकड़ें।'], posture: ['Sit back, chest up, push through the heels to stand.', 'पीछे बैठें, छाती ऊपर, एड़ियों से ज़ोर देकर उठें।'], reps: 10, unit: 'reps' },
  legRaise: { file: 'leg-raise', name: ['Leg raise', 'पैर उठाना'], start: ['Lie on your back, hands beside your hips.', 'पीठ के बल लेटें, हाथ कूल्हों के पास।'], posture: ['Lift both legs slowly, lower without touching the floor.', 'दोनों पैर धीरे उठाएं, ज़मीन छुए बिना नीचे लाएं।'], reps: 10, unit: 'reps' },
  cycling: { file: 'cycling', name: ['Cycling', 'साइकिलिंग'], start: ['Adjust the seat so the knee is slightly bent at the bottom.', 'सीट ऐसी रखें कि नीचे घुटना थोड़ा मुड़ा रहे।'], posture: ['Pedal at an easy, steady pace; keep the back relaxed.', 'आराम से एक जैसी रफ़्तार में पैडल करें, पीठ ढीली।'], reps: 60, unit: 'seconds' },
  jog: { file: 'jogging', name: ['Easy jog', 'हल्की जॉगिंग'], start: ['Warm up with 2 minutes of walking.', '2 मिनट चलकर वार्म-अप करें।'], posture: ['Short steps, land softly, you should still be able to talk.', 'छोटे कदम, हल्के से पैर रखें, बात कर सकें इतनी रफ़्तार।'], reps: 60, unit: 'seconds' },
  run: { file: 'running', name: ['Running', 'दौड़ना'], start: ['Only if your doctor allows it. Warm up first.', 'सिर्फ़ डॉक्टर की इजाज़त हो तो। पहले वार्म-अप करें।'], posture: ['Arms at 90 degrees, relaxed shoulders, steady breathing.', 'हाथ 90 डिग्री पर, कंधे ढीले, सांस एक जैसी।'], reps: 60, unit: 'seconds' },
  treadmill: { file: 'treadmill', name: ['Treadmill walk', 'ट्रेडमिल वॉक'], start: ['Start slow, hold the rails only for balance.', 'धीमे शुरू करें, रेलिंग सिर्फ़ संतुलन के लिए पकड़ें।'], posture: ['Walk tall, increase speed a little every few minutes.', 'सीधे चलें, हर कुछ मिनट में रफ़्तार थोड़ी बढ़ाएं।'], reps: 60, unit: 'seconds' },
  shadowBox: { file: 'shadow-box', name: ['Shadow boxing', 'शैडो बॉक्सिंग'], start: ['Stand with one foot forward, fists near your chin.', 'एक पैर आगे, मुट्ठियां ठोड़ी के पास।'], posture: ['Punch forward gently, alternate arms, keep moving the feet.', 'हल्के से आगे पंच करें, हाथ बदलते रहें, पैर चलाते रहें।'], reps: 30, unit: 'reps' },
  walk2: { file: 'walk-2', name: ['After-meal walk', 'खाने के बाद टहलना'], start: ['Start 10 to 15 minutes after eating.', 'खाने के 10 से 15 मिनट बाद शुरू करें।'], posture: ['Easy pace, relaxed arms. It helps lower blood sugar.', 'आराम की रफ़्तार, हाथ ढीले। इससे शुगर घटती है।'], reps: 20, unit: 'steps' },
  walkTogether: { file: 'walk-together', name: ['Walk with family', 'परिवार के साथ टहलें'], start: ['Invite a family member or friend.', 'परिवार के किसी सदस्य या दोस्त को साथ लें।'], posture: ['Talk while you walk, at a pace where you can still chat.', 'चलते हुए बात करें, इतनी रफ़्तार कि बात हो सके।'], reps: 20, unit: 'steps' },
  armCircles: { file: 'arm-circles', name: ['Arm circles', 'हाथ घुमाना'], start: ['Stand tall, arms out to the sides.', 'सीधे खड़े हों, हाथ बगल में फैलाएं।'], posture: ['Make small circles forward, then backward.', 'आगे की ओर छोटे घेरे बनाएं, फिर पीछे की ओर।'], reps: 10, unit: 'reps' },
  sideStretch: { file: 'side-stretch', name: ['Side plank reach', 'साइड स्ट्रेच'], start: ['Lie on your side, elbow under the shoulder.', 'करवट लेटें, कोहनी कंधे के नीचे।'], posture: ['Lift the hips, reach the top arm up, hold and breathe.', 'कूल्हे उठाएं, ऊपर का हाथ ऊपर करें, रुकें और सांस लें।'], reps: 6, unit: 'reps' },
  twist: { file: 'yoga-twist', name: ['Yoga twist', 'योग ट्विस्ट'], start: ['Start on hands and knees or in a low lunge.', 'हाथ-घुटनों के बल या लो लंज में शुरू करें।'], posture: ['Open one arm to the ceiling, follow it with your eyes, switch.', 'एक हाथ छत की ओर खोलें, आंखों से देखें, फिर बदलें।'], reps: 6, unit: 'reps' },
  legsUp: { file: 'legs-up-wall', name: ['Legs up the wall (Viparita Karani)', 'विपरीत करणी'], start: ['Lie near a wall, rest your legs straight up on it.', 'दीवार के पास लेटें, पैर दीवार पर सीधे टिकाएं।'], posture: ['Arms relaxed, slow breathing. Great before sleep.', 'हाथ ढीले, धीमी सांस। सोने से पहले बहुत अच्छा।'], reps: 10, unit: 'breaths' },
  meditateW: { file: 'meditate-woman', name: ['Calm meditation', 'शांत ध्यान'], start: ['Sit cross-legged, hands resting on the knees.', 'पालथी मारकर बैठें, हाथ घुटनों पर।'], posture: ['Close your eyes and count slow breaths.', 'आंखें बंद करें और धीमी सांसें गिनें।'], reps: 10, unit: 'breaths' },
  jack: { file: 'jumping-jack', name: ['Jumping jacks', 'जंपिंग जैक'], start: ['Stand with feet together, arms by your sides.', 'पैर साथ, हाथ बगल में।'], posture: ['Jump feet out and arms up, then back. Step instead of jumping if needed.', 'पैर फैलाते हुए हाथ ऊपर, फिर वापस। ज़रूरत हो तो कूदने के बजाय कदम रखें।'], reps: 20, unit: 'reps' },
};

export type ExerciseMove = Move;

/** Which animated moves demonstrate a plan step: matched on the step's name
 *  first (its details often mention other things, like sleep), then on the
 *  details, else a gentle walk / stretch / breathing set. */
export function movesForExercise(title: string, body = ''): Move[] {
  return matchMoves(title.toLowerCase()) || (body ? matchMoves(`${title} ${body}`.toLowerCase()) : null) || [MOVES.walk, MOVES.stretch, MOVES.breathe];
}

function matchMoves(t: string): Move[] | null {
  const pick = (...keys: string[]) => keys.map((k) => MOVES[k]);
  if (/sleep|bedtime|night|nidra|shavasana|savasana|wind.?down|सोने/.test(t)) return pick('sleep', 'legsUp', 'breathe');
  if (/meditat|dhyan|mindful/.test(t)) return pick('chakra', 'meditateW', 'breathe');
  if (/pranayam|breath|anulom|kapal|bhramari|relaxation/.test(t)) return pick('breathe', 'seated', 'meditateW');
  if (/chair|senior|elderly|beginner|gentle/.test(t)) return pick('chairSquat', 'armCircles', 'walk2');
  if (/strength|resistance|intensive exercise|squat|push.?up|lunge|plank|core|abs|weight/.test(t)) return pick('squat', 'chairSquat', 'gobletSquat', 'pushup', 'lunge', 'plank', 'core', 'legRaise');
  if (/fasted cardio|cardio|hiit|jumping|aerobic|run|jog|cycl|treadmill|box/.test(t)) return pick('jog', 'cycling', 'treadmill', 'jack', 'shadowBox', 'run');
  if (/yoga|asana|surya|bhujang|cobra/.test(t)) return pick('seated', 'cobra', 'twist', 'stretch', 'sideStretch', 'breathe');
  if (/stretch|flexib|mobility|warm.?up|cool.?down|massage|abhyanga/.test(t)) return pick('stretch', 'armCircles', 'hip', 'sideStretch', 'cobra');
  if (/after.?(meal|lunch|dinner|breakfast)|post.?(meal|lunch|dinner)/.test(t)) return pick('walk2', 'walk');
  if (/walk|steps|stroll|movement|टहल/.test(t)) return pick('walk', 'walk2', 'walkTogether');
  return null;
}

const UNIT_LABEL: Record<Move['unit'], [string, string]> = { reps: ['reps', 'बार'], breaths: ['breaths', 'सांस'], steps: ['steps', 'कदम'], seconds: ['sec', 'सेकंड'] };

export const ExerciseAnimationPlayer: React.FC<{ moves: Move[]; tr: (en: string, hi: string) => string }> = ({ moves, tr }) => {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [count, setCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const player = useRef<any>(null);
  const move = moves[Math.min(index, moves.length - 1)];

  // Count one rep / breath / step per animation loop.
  const attach = useMemo(() => (instance: any) => {
    player.current = instance;
    if (!instance) return;
    instance.addEventListener('loop', () => setCount((c) => c + 1));
    instance.addEventListener('loadError', () => setFailed(true));
  }, []);
  useEffect(() => { setCount(0); setFailed(false); setPlaying(true); }, [index]);
  useEffect(() => { player.current?.setSpeed?.(speed); }, [speed, index]);

  if (!move) return null;
  const toggle = () => { if (playing) player.current?.pause?.(); else player.current?.play?.(); setPlaying(!playing); };
  const replay = () => { player.current?.stop?.(); player.current?.play?.(); setCount(0); setPlaying(true); };
  const doneCount = Math.min(count, move.reps);

  return (
    <div className="bg-gradient-to-b from-orange-50 to-white">
      <div className="relative w-full aspect-[4/3] sm:aspect-video">
        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <span className="text-4xl">🏃</span>
            <span className="mt-2 text-xs font-bold">{tr('Animation could not load — see the steps below or watch the video.', 'एनिमेशन लोड नहीं हुआ — नीचे दिए स्टेप देखें या वीडियो देखें।')}</span>
          </div>
        ) : (
          <DotLottieReact key={move.file} src={`/lottie/exercise/${move.file}.lottie`} autoplay loop speed={speed} dotLottieRefCallback={attach} style={{ width: '100%', height: '100%' }} />
        )}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 border border-orange-200 text-[11px] font-black text-orange-700 shadow-sm">
          {doneCount}/{move.reps} {tr(...UNIT_LABEL[move.unit])}
        </span>
        {moves.length > 1 && (
          <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-zinc-900/80 text-white text-[10px] font-black">{index + 1}/{moves.length}</span>
        )}
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        <div className="flex items-center gap-2">
          {moves.length > 1 && <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center disabled:opacity-30 cursor-pointer" aria-label={tr('Previous move', 'पिछला मूव')}><ChevronLeft className="w-4 h-4" /></button>}
          <h5 className="flex-1 min-w-0 text-center text-base font-black text-zinc-900 truncate">{tr(...move.name)}</h5>
          {moves.length > 1 && <button type="button" onClick={() => setIndex((i) => Math.min(moves.length - 1, i + 1))} disabled={index === moves.length - 1} className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center disabled:opacity-30 cursor-pointer" aria-label={tr('Next move', 'अगला मूव')}><ChevronRight className="w-4 h-4" /></button>}
        </div>

        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={toggle} className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30 cursor-pointer" aria-label={playing ? tr('Pause', 'रोकें') : tr('Play', 'चलाएं')}>
            {playing ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5 ml-0.5" fill="white" />}
          </button>
          <button type="button" onClick={replay} className="w-11 h-11 rounded-full border border-zinc-200 bg-white text-zinc-700 flex items-center justify-center cursor-pointer" aria-label={tr('Replay', 'फिर से')}><RotateCcw className="w-4.5 h-4.5" /></button>
          <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-100">
            {[0.5, 1, 1.5].map((s) => (
              <button key={s} type="button" onClick={() => setSpeed(s)} className={`px-2.5 py-1.5 rounded-full text-[11px] font-black cursor-pointer ${speed === s ? 'bg-white text-orange-700 shadow-sm' : 'text-zinc-500'}`}>{s}×</button>
            ))}
          </div>
        </div>

        <ol className="grid gap-2 text-[12px]">
          <li className="flex gap-2 p-2.5 rounded-xl bg-white border border-zinc-100"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black flex items-center justify-center shrink-0">1</span><span><b className="text-zinc-900">{tr('Start', 'शुरुआत')}:</b> <span className="text-zinc-600">{tr(...move.start)}</span></span></li>
          <li className="flex gap-2 p-2.5 rounded-xl bg-white border border-zinc-100"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black flex items-center justify-center shrink-0">2</span><span><b className="text-zinc-900">{tr('Correct form', 'सही तरीका')}:</b> <span className="text-zinc-600">{tr(...move.posture)}</span></span></li>
          <li className="flex gap-2 p-2.5 rounded-xl bg-white border border-zinc-100"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black flex items-center justify-center shrink-0">3</span><span><b className="text-zinc-900">{tr('Do', 'करें')}:</b> <span className="text-zinc-600">{tr(`${move.reps} ${UNIT_LABEL[move.unit][0]}, then rest 30 seconds.`, `${move.reps} ${UNIT_LABEL[move.unit][1]}, फिर 30 सेकंड आराम।`)}</span></span></li>
        </ol>
      </div>
    </div>
  );
};
