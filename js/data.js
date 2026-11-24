// Plan data: exercises, session templates, weekly schedule, phases, milestones.
// Mode: 'reps' (count per set), 'time' (seconds per set), 'minutes' (one block).
// reps/secs may be a number or a [low, high] range. perSide: the prescription is per leg/side.

export const CATEGORIES = {
  hips: 'Hips and glutes',
  knee: 'Knee control',
  feet: 'Feet and balance',
  upper: 'Upper body',
  core: 'Core',
  mobility: 'Mobility',
  cardio: 'Cardio',
};

export const EXERCISES = {
  'glute-bridge': {
    name: 'Glute bridge', cat: 'hips', mode: 'reps', sets: 3, reps: 12, rest: 'light',
    tempo: '1 s up, 2 s squeeze, 2 s down',
    note: 'Squeeze 2 s at the top.',
    steps: [
      'Lie on your back with knees bent, feet flat and hip-width apart, heels about a foot from your bottom.',
      'Brace your stomach lightly and press through your heels to lift your hips until knees, hips and shoulders line up.',
      'Squeeze your glutes for 2 seconds at the top. Keep your lower back neutral; the lift comes from the hips.',
      'Lower slowly over 2 seconds and reset before the next rep.',
    ],
    progress: 'Add single-leg glute bridges once 3 x 12 feels easy.',
    demo: 'glute bridge exercise form',
  },
  'sl-glute-bridge': {
    name: 'Single-leg glute bridge', cat: 'hips', mode: 'reps', sets: 2, reps: 8, perSide: true, rest: 'light',
    tempo: '1 s up, 1 s pause, 2 s down',
    note: 'Add once double-leg is easy.',
    steps: [
      'Set up as for a glute bridge, then lift one foot off the floor with that knee bent.',
      'Press through the heel of the foot on the floor and lift your hips.',
      'Keep your pelvis level: don\'t let the free side drop.',
      'Lower over 2 seconds. Finish all reps on one side, then switch.',
    ],
    progress: 'Add a 2 s pause at the top, then a third set.',
    demo: 'single leg glute bridge form',
  },
  'side-leg-raise': {
    name: 'Side-lying leg raise', cat: 'hips', mode: 'reps', sets: 3, reps: 12, perSide: true, rest: 'light',
    tempo: '1 s up, 2 to 3 s down',
    note: 'Toes forward, slow down.',
    steps: [
      'Lie on your side with the bottom knee bent for balance and the top leg straight, in line with your body.',
      'Point the toes of the top foot forward, not up at the ceiling.',
      'Lift the top leg to about 30 to 45 degrees, leading with the heel.',
      'Lower over 2 to 3 seconds. Don\'t roll your hips backward.',
    ],
    progress: 'Add a light band around the ankles.',
    demo: 'side lying hip abduction leg raise form',
  },
  'clamshell': {
    name: 'Banded clamshell', cat: 'hips', mode: 'reps', sets: 3, reps: 15, perSide: true, rest: 'light',
    tempo: '1 s open, 1 s pause, 2 s close',
    note: 'Light band above knees.',
    steps: [
      'Put a light band just above your knees and lie on your side, hips and knees bent about 45 degrees, heels together.',
      'Keep your feet touching and lift the top knee up against the band.',
      'Stop before your pelvis rolls back. Pause for 1 second at the top.',
      'Close slowly over 2 seconds.',
    ],
    progress: 'Move to a stronger band.',
    demo: 'banded clamshell exercise form',
  },
  'side-plank': {
    name: 'Side plank', cat: 'core', mode: 'time', sets: 3, secs: [20, 30], perSide: true, rest: 'light',
    note: 'From knees if needed.',
    steps: [
      'Lie on your side with your elbow directly under your shoulder.',
      'Bend your knees (easier) or stack your feet with legs straight.',
      'Lift your hips so your body is a straight line from head to knees or feet.',
      'Hold and breathe. Stop when your hips start to sag.',
    ],
    progress: 'Add 5 s per hold, or move from knees to feet.',
    demo: 'side plank from knees form',
  },
  'short-foot': {
    name: 'Short foot (arch doming)', cat: 'feet', mode: 'reps', sets: 3, reps: 10, perSide: true, inRests: true, rest: 'light', repSecs: 6,
    tempo: '5 s hold per rep',
    note: 'Draw the ball of the foot toward the heel, toes relaxed.',
    steps: [
      'Sit with your foot flat on the floor. Later, do it standing.',
      'Keep your toes long and relaxed. Don\'t curl or grip with them.',
      'Draw the ball of your foot back toward your heel so the arch lifts into a dome.',
      'Hold for 5 seconds, then relax fully.',
    ],
    progress: 'Move from sitting to standing, then to standing on one leg.',
    demo: 'short foot exercise arch doming',
  },
  'sl-balance': {
    name: 'Single-leg balance', cat: 'feet', mode: 'time', sets: 3, secs: 30, perSide: true, lr: true, inRests: true, rest: 'light',
    note: 'Arch lifted; eyes closed later.',
    steps: [
      'Stand on one leg next to a wall or counter in case you need it.',
      'Keep a soft knee, tracking over your second toe.',
      'Lift the arch (the short-foot position) and keep it lifted.',
      'Hold for 30 seconds. Later, try it with your eyes closed.',
    ],
    progress: 'Try with eyes closed, or stand on a folded towel.',
    demo: 'single leg balance exercise',
  },
  'sit-to-stand': {
    name: 'Chair sit-to-stand', cat: 'knee', mode: 'reps', sets: 3, reps: 10,
    tempo: '3 s down, no pause, 1 s up',
    note: '3 s down, no bouncing.',
    steps: [
      'Sit near the front of a chair, feet hip-width apart and slightly behind your knees.',
      'Lean your chest forward and stand up, pressing through your whole foot.',
      'Sit back down over 3 seconds, touching the chair lightly. No dropping or bouncing.',
      'Keep your knees tracking over your toes the whole time.',
    ],
    progress: 'Hold a weight at your chest, or use a lower chair.',
    demo: 'slow sit to stand exercise',
  },
  'step-down': {
    name: 'Slow step-down from low step', cat: 'knee', mode: 'reps', sets: 3, reps: 8, perSide: true, lr: true,
    tempo: '3 to 4 s down, 1 s up',
    note: 'Knee over 2nd toe.',
    steps: [
      'Stand on one leg on a low step (10 to 15 cm), the other foot hanging off the front.',
      'Keep your hips level and bend the standing knee to lower the free heel toward the floor over 3 to 4 seconds.',
      'Keep the standing knee over your second toe. Don\'t let it cave inward.',
      'Tap the heel lightly on the floor, then push back up through the standing leg.',
    ],
    progress: 'Use a slightly higher step (Phase 2). Milestone: 15 clean reps each side.',
    demo: 'slow eccentric step down exercise knee',
  },
  'wall-sit': {
    name: 'Wall sit', cat: 'knee', mode: 'time', sets: 3, secs: [30, 45],
    note: 'Comfortable depth only.',
    steps: [
      'Stand with your back flat against a wall, feet about 60 cm out and hip-width apart.',
      'Slide down to a comfortable, pain-free depth. Don\'t go past 90 degrees at the knee.',
      'Keep your knees over your ankles and your weight in your heels.',
      'Hold and breathe, then slide back up.',
    ],
    progress: 'Add 5 to 10 s per hold, then go slightly deeper if pain-free.',
    demo: 'wall sit exercise form',
  },
  'band-tke': {
    name: 'Banded terminal knee extension', cat: 'knee', mode: 'reps', sets: 3, reps: 15, perSide: true,
    tempo: '1 s straighten, 2 s squeeze, 1 s release',
    note: 'Band behind knee, squeeze quad. Stop just short of locking the knee.',
    caution: 'tke',
    steps: [
      'Anchor a band at knee height, loop it behind one knee and step back until it pulls.',
      'Start with that knee slightly bent and the heel down.',
      'Straighten the knee by tightening the thigh, stopping just short of locked. Never push past straight.',
      'Hold the squeeze for 2 seconds, then let the knee bend slowly.',
    ],
    progress: 'Step farther back for more band tension.',
    demo: 'banded terminal knee extension',
  },
  'calf-raise': {
    name: 'Slow calf raise, arch lifted', cat: 'feet', mode: 'reps', sets: 2, reps: 10, rest: 'light',
    tempo: '1 s up, 3 s down',
    note: 'Bodyweight only. No heavy calf raises.',
    steps: [
      'Stand on flat floor holding a wall, feet hip-width apart.',
      'Lift your arches (short-foot position) and keep your weight over the big and second toes.',
      'Rise onto your toes in 1 second without letting your ankles roll outward.',
      'Lower over 3 seconds.',
    ],
    progress: 'Work toward single-leg raises. Milestone: 20 each side without pain.',
    demo: 'slow calf raise exercise',
  },
  'sl-calf-raise': {
    name: 'Single-leg calf raise, arch lifted', cat: 'feet', mode: 'reps', sets: 3, reps: [12, 20], perSide: true, lr: true, rest: 'light',
    tempo: '1 s up, 3 s down',
    note: 'Bodyweight only. Build toward 20 each side (a running milestone).',
    steps: [
      'Stand on one foot on flat floor, fingertips on a wall for balance, other foot lifted behind you.',
      'Lift the arch (short-foot position) and keep your weight over the big and second toes.',
      'Rise as high as you can in 1 second without the ankle rolling outward.',
      'Lower over 3 seconds. Do all reps on one side, then the other.',
    ],
    progress: 'Add reps toward 20 each side. Keep it bodyweight.',
    demo: 'single leg calf raise bodyweight',
  },
  'bent-calf-raise': {
    name: 'Bent-knee calf raise', cat: 'feet', mode: 'reps', sets: 2, reps: 15, rest: 'light', inRests: true,
    tempo: '1 s up, 3 s down',
    note: 'Works the lower calf (soleus), which takes most of the load when running.',
    steps: [
      'Stand holding a wall with both knees bent about 20 to 30 degrees, as if starting to sit.',
      'Keep the knees bent the whole time and rise onto your toes.',
      'Lower over 3 seconds without straightening the knees.',
    ],
    progress: 'Move to one leg at a time once 2 x 15 is easy.',
    demo: 'bent knee calf raise soleus',
  },
  'tib-raise': {
    name: 'Tibialis raise (toe raise)', cat: 'feet', mode: 'reps', sets: 2, reps: 15, rest: 'light', inRests: true,
    tempo: '1 s up, 2 s down',
    note: 'For the shin. Stop if it brings on shin pain.',
    steps: [
      'Stand with your back and bottom against a wall, heels about 30 cm out from it.',
      'Keep your legs straight and lift your toes and the balls of your feet as high as you can.',
      'Lower slowly over 2 seconds, without letting the toes slap down.',
    ],
    progress: 'Move your heels a little farther from the wall.',
    demo: 'tibialis raise wall',
  },
  'pogo-hops': {
    name: 'Pogo hops, both legs', cat: 'knee', mode: 'reps', sets: 3, reps: 15, repSecs: 1,
    note: 'Phase 3. Small, quick, quiet hops. Stop if knee pain goes above 2.',
    steps: [
      'Stand tall with feet hip-width apart, knees soft.',
      'Hop a few centimeters off the floor using mostly your ankles, staying on the balls of your feet.',
      'Land quietly and bounce straight into the next hop, keeping the knees over the toes.',
      'Count only hops with good, quiet landings.',
    ],
    progress: 'When 3 x 15 is easy and pain-free, add single-leg hops.',
    demo: 'pogo hops beginner',
  },
  'sl-hops': {
    name: 'Single-leg hops', cat: 'knee', mode: 'reps', sets: 2, reps: 10, perSide: true, lr: true, repSecs: 1,
    note: 'Phase 3, from week 11. Low hops on the spot. Stop if knee pain goes above 2.',
    steps: [
      'Stand on one leg next to a wall, knee soft and over the second toe.',
      'Do small hops on the spot, landing softly on the ball of the foot.',
      'Keep the hips level and the knee from caving inward.',
      'Do all hops on one side, then the other.',
    ],
    progress: 'Keep the volume low until running starts.',
    demo: 'single leg pogo hops',
  },
  'push-up': {
    name: 'Incline or knee push-up', cat: 'upper', mode: 'reps', sets: 2, reps: [8, 12], rest: 'light',
    tempo: '2 s down, 1 s up',
    note: 'Upper body block, about 5 min.',
    steps: [
      'Put your hands on a counter, bench or sofa arm, slightly wider than your shoulders (or kneel on the floor).',
      'Make a straight line from head to heels (or knees).',
      'Lower your chest toward the edge with elbows angled about 45 degrees from your body.',
      'Push back up without letting your hips sag.',
    ],
    progress: 'Use a lower surface, or move from knees to toes.',
    demo: 'incline push up form',
  },
  'band-row': {
    name: 'Towel or band row', cat: 'upper', mode: 'reps', sets: 2, reps: 12, rest: 'light',
    tempo: '1 s pull, 1 s squeeze, 2 s return',
    note: 'Squeeze shoulder blades.',
    steps: [
      'Anchor a band at chest height (a door anchor works), or wrap a towel around a sturdy post.',
      'Hold the ends with straight arms and step back until there is tension.',
      'Pull your elbows back close to your sides and squeeze your shoulder blades together.',
      'Pause for 1 second, then let your arms straighten over 2 seconds.',
    ],
    progress: 'Use a heavier band, or add a third set.',
    demo: 'resistance band row at home',
  },
  'plank': {
    name: 'Plank', cat: 'core', mode: 'time', sets: 2, secs: 30, rest: 'light',
    note: 'Straight line, breathe.',
    steps: [
      'Forearms on the floor, elbows under your shoulders.',
      'Make a straight line from head to heels. Squeeze your glutes and brace your stomach.',
      'Breathe normally through the hold.',
      'Stop when your hips start to sag or pike up.',
    ],
    progress: 'Add 10 s per hold.',
    demo: 'forearm plank form',
  },
  'calf-stretch': {
    name: 'Calf stretch, straight and bent knee', cat: 'mobility', mode: 'time', sets: 2, secs: 30, perSide: true,
    note: 'Gentle. Set 1 with a straight knee, set 2 with a bent knee.',
    steps: [
      'Hands on a wall, one foot back, heel down, toes pointing forward.',
      'With the back knee straight, lean in until you feel a gentle stretch in the calf. Hold for 30 seconds.',
      'Bend the back knee slightly to move the stretch lower, toward the Achilles. Hold for 30 seconds.',
      'Switch legs.',
    ],
    progress: 'No progression needed. Keep it gentle.',
    demo: 'calf stretch straight and bent knee',
  },
  'hip-flexor-stretch': {
    name: 'Hip flexor stretch', cat: 'mobility', mode: 'time', sets: 2, secs: 30, perSide: true,
    note: 'Tuck pelvis.',
    steps: [
      'Kneel on one knee (on a cushion) with the other foot flat in front.',
      'Tuck your pelvis under by squeezing the glute on the kneeling side.',
      'Shift your weight forward slightly until you feel a stretch at the front of the hip.',
      'Don\'t arch your lower back. Hold for 30 seconds, then switch.',
    ],
    progress: 'No progression needed.',
    demo: 'half kneeling hip flexor stretch',
  },
  'quad-stretch': {
    name: 'Quad stretch', cat: 'mobility', mode: 'time', sets: 2, secs: 30, perSide: true,
    note: 'No knee pain.',
    steps: [
      'Stand holding a wall and bend one knee, holding that ankle behind you.',
      'Keep your knees together and your pelvis tucked.',
      'Ease the heel toward your bottom until you feel a gentle stretch at the front of the thigh.',
      'Stop short of any knee pain. Lying on your side is a gentler option.',
    ],
    progress: 'No progression needed.',
    demo: 'standing quad stretch',
  },
  'easy-walk': {
    name: 'Easy walk', cat: 'cardio', mode: 'minutes', sets: 1, mins: [15, 20],
    note: 'Flat ground.',
    steps: [
      'Walk at an easy, conversational pace on flat ground.',
      'Use a relaxed, shorter stride.',
      'Stop and note it if anything above 2 out of 10 comes on.',
    ],
    progress: 'In Phase 2, make walks longer and add gentle hills.',
    demo: 'easy walking technique',
  },
  'hip-thrust': {
    name: 'Hip thrust', cat: 'hips', mode: 'reps', sets: 3, reps: 10, weighted: true,
    tempo: '1 s up, 1 s squeeze, 2 s down',
    note: 'Main lift; log weight.',
    steps: [
      'Sit with your upper back against a bench edge, just below the shoulder blades. Roll a padded bar or a dumbbell over your hips (or use the machine).',
      'Plant your feet so your shins are vertical at the top.',
      'Tuck your chin and drive through your heels to lift your hips until your torso is level with the floor.',
      'Squeeze your glutes for 1 second without arching your back, then lower under control.',
    ],
    progress: 'Add 2.5 to 5 kg.',
    demo: 'barbell hip thrust form',
  },
  'cable-abduction': {
    name: 'Cable hip abduction', cat: 'hips', mode: 'reps', sets: 3, reps: 12, perSide: true, weighted: true,
    tempo: '1 s out, 2 to 3 s back',
    note: 'Slow.',
    steps: [
      'Strap the cuff on the ankle farther from the machine and stand side-on, holding the machine.',
      'Stand tall with a soft standing knee and toes forward.',
      'Sweep the working leg out to the side without leaning your torso much.',
      'Return over 2 to 3 seconds. A seated abduction machine also works.',
    ],
    progress: 'Add one weight step.',
    demo: 'cable hip abduction form',
  },
  'rdl': {
    name: 'Romanian deadlift', cat: 'hips', mode: 'reps', sets: 3, reps: [8, 10], weighted: true,
    tempo: '3 s down, 1 s up',
    note: 'Hinge at hips, soft knees.',
    steps: [
      'Hold dumbbells or a bar in front of your thighs, feet hip-width, knees soft.',
      'Push your hips back and slide the weight down the front of your legs, back flat.',
      'Go down until you feel a stretch in your hamstrings, around mid-shin.',
      'Drive your hips forward to stand and squeeze your glutes at the top.',
    ],
    progress: 'Add 2.5 to 5 kg.',
    demo: 'romanian deadlift dumbbell form',
  },
  'goblet-squat': {
    name: 'Goblet squat, slow tempo', cat: 'knee', mode: 'reps', sets: 3, reps: 8, weighted: true,
    tempo: '3 s down, 1 s up',
    note: '3 s down, pain-free depth.',
    steps: [
      'Hold a dumbbell or kettlebell at your chest. Feet shoulder-width, toes turned slightly out.',
      'Sit down between your hips over 3 seconds, to a pain-free depth.',
      'Keep your knees tracking over your toes and your chest up.',
      'Drive up through your whole foot.',
    ],
    progress: 'Add 2 kg, or go slightly deeper if pain-free.',
    demo: 'goblet squat form',
  },
  'leg-press': {
    name: 'Leg press, limited range', cat: 'knee', mode: 'reps', sets: 3, reps: 10, weighted: true,
    tempo: '2 s down, 1 s up',
    note: 'Stop before deep knee bend.',
    steps: [
      'Sit with your back flat on the pad, feet mid-platform and hip-width apart.',
      'Release the safeties and lower the platform under control.',
      'Stop before a deep knee bend, at about 90 degrees or wherever it stays pain-free.',
      'Press back up without locking your knees.',
    ],
    progress: 'Add 5 to 10 kg.',
    demo: 'leg press form knee friendly',
  },
  'cable-tke': {
    name: 'Cable terminal knee extension', cat: 'knee', mode: 'reps', sets: 3, reps: 15, perSide: true, weighted: true,
    tempo: '1 s straighten, 2 s squeeze, 1 s release',
    note: 'For the tired-above-knee feeling. Stop just short of locking the knee.',
    caution: 'tke',
    steps: [
      'Loop a strap from a low-to-middle cable behind one knee and face the machine.',
      'Step back until there is tension, with that knee slightly bent and the heel down.',
      'Straighten the knee by tightening the thigh muscle just above the knee, stopping just short of locked. Never push past straight.',
      'Hold for 2 seconds, then let the knee bend slowly.',
    ],
    progress: 'Add one weight step.',
    demo: 'cable terminal knee extension',
  },
  'pallof': {
    name: 'Pallof press or dead bug', cat: 'core', mode: 'reps', sets: 2, reps: 10, perSide: true,
    tempo: '2 s hold at full reach',
    note: 'Core.',
    steps: [
      'Pallof press: stand side-on to a cable at chest height and hold the handle at your chest.',
      'Brace, press the handle straight out and hold for 2 seconds without letting your body turn. Bring it back in.',
      'Dead bug: lie on your back, arms up, hips and knees at 90 degrees.',
      'Slowly lower the opposite arm and leg while your lower back stays on the floor, then switch sides.',
    ],
    progress: 'Pallof: add one weight step. Dead bug: slow each rep down.',
    demo: 'pallof press form',
  },
  'cycling': {
    name: 'Easy indoor cycling', cat: 'cardio', mode: 'minutes', sets: 1, mins: 30, optional: true,
    note: 'Easy to moderate effort. Try to finish by 8 p.m.',
    steps: [
      'Ride at an easy to moderate effort: you could hold a conversation.',
      'Keep the saddle high enough that your knee is only slightly bent at the bottom of the stroke.',
      'Try to finish by 8 p.m. so it doesn\'t cut into sleep.',
    ],
    progress: 'Keep it easy. Cycling is support work in this plan.',
    demo: 'indoor bike saddle height setup',
  },
};

// Session templates. Items may override sets, reps, secs, mins or note, and can be limited
// to phases with from/to (phase numbers) or fromWeek. Phase 2 and 3 versions switch in
// automatically; a day can be set to the Phase 1 versions ("easier version").
export const SESSIONS = {
  homeA: {
    name: 'Home A', title: 'Hips and glutes + feet', kind: 'home',
    items: [
      { ex: 'glute-bridge', to: 1 },
      { ex: 'sl-glute-bridge', to: 1 },
      { ex: 'sl-glute-bridge', from: 2, sets: 3, reps: 10, note: 'Phase 2: single-leg version for all sets.' },
      { ex: 'side-leg-raise' }, { ex: 'clamshell' }, { ex: 'side-plank' },
      { ex: 'sl-calf-raise', from: 2, note: 'Phase 2: single-leg calf raises move to Home A days.' },
      { ex: 'short-foot' },
      { ex: 'tib-raise' },
      { ex: 'sl-balance', from: 2, note: 'Phase 2: eyes closed, or stand on a folded towel.' },
      { ex: 'sl-balance', to: 1 },
    ],
  },
  homeB: {
    name: 'Home B', title: 'Knee control + feet + upper body and core', kind: 'home',
    items: [
      { ex: 'sit-to-stand' },
      { ex: 'step-down', to: 1 },
      { ex: 'step-down', from: 2, reps: 10, note: 'Phase 2: use a higher step, about 20 cm.' },
      { ex: 'wall-sit', to: 1 },
      { ex: 'wall-sit', from: 2, secs: [45, 60], note: 'Phase 2: longer holds.' },
      { ex: 'band-tke' },
      { ex: 'pogo-hops', from: 3 },
      { ex: 'sl-hops', from: 3, fromWeek: 11 },
      { ex: 'calf-raise', to: 1 },
      { ex: 'bent-calf-raise', from: 2 },
      { ex: 'short-foot', sets: 2 },
      { ex: 'push-up' }, { ex: 'band-row' }, { ex: 'plank' },
    ],
  },
  homeC: {
    name: 'Home C', title: 'Mobility and easy walk (optional)', kind: 'home', optional: true,
    items: [
      { ex: 'calf-stretch' }, { ex: 'hip-flexor-stretch' }, { ex: 'quad-stretch' },
      { ex: 'easy-walk', to: 1 },
      { ex: 'easy-walk', from: 2, mins: [20, 30], note: 'Phase 2: longer, with gentle hills.' },
    ],
  },
  gym1: {
    name: 'Gym day 1', title: 'Hips, hinge and knee strength', kind: 'gym',
    items: [
      { ex: 'hip-thrust' }, { ex: 'cable-abduction' }, { ex: 'rdl' }, { ex: 'goblet-squat' },
      { ex: 'leg-press' }, { ex: 'cable-tke' }, { ex: 'pallof' },
    ],
  },
  gym2: {
    name: 'Gym day 2', title: 'Hips, hinge and knee strength', kind: 'gym',
    items: [
      { ex: 'hip-thrust' }, { ex: 'cable-abduction' }, { ex: 'rdl' }, { ex: 'goblet-squat' },
      { ex: 'leg-press' }, { ex: 'cable-tke' }, { ex: 'pallof' },
    ],
  },
  rest: {
    name: 'Rest', title: 'Rest day', kind: 'rest', items: [],
  },
};

// Items for a session at a phase and week.
export function phaseItems(sid, phase, week) {
  return (SESSIONS[sid]?.items || []).filter((it) =>
    (it.from == null || phase >= it.from) && (it.to == null || phase <= it.to) && (it.fromWeek == null || week >= it.fromWeek));
}

// 0 = Sunday ... 6 = Saturday (JavaScript getDay order)
export const SCHEDULE = {
  1: 'homeA', 2: 'gym1', 3: 'homeB', 4: 'homeA', 5: 'gym2', 6: 'homeB', 0: 'homeC',
};
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PHASES = [
  { n: 1, weeks: [1, 4], name: 'Build the base', text: 'Bodyweight at home, light gym loads, easy cycling.' },
  { n: 2, weeks: [5, 8], name: 'Progress', text: 'Single-leg versions, a slightly higher step, heavier gym loads, longer and hillier walks, longer wall sits. Calf raises move to one leg (bodyweight), plus bent-knee calf raises.' },
  { n: 3, weeks: [9, 12], name: 'Prepare for running', text: 'Add hopping drills on both legs (from week 9), then single legs (from week 11), at low volume. Keep the strength work.' },
  { n: 4, weeks: [13, null], name: 'Walk-run', text: 'Only after the milestones: walk-run intervals, for example 1 min run and 2 min walk for 20 min, three times a week, then gradually more running.' },
];

export const MILESTONES = [
  { id: 'stairs', name: 'Stairs up and down at 0 to 1 out of 10' },
  { id: 'steps10k', name: 'Walking 10,000 steps with no next-day soreness' },
  { id: 'stepdown15', name: '15 slow single-leg step-downs each side, clean form' },
  { id: 'calf20', name: '20 single-leg calf raises each side without pain' },
  { id: 'balance30', name: '30 s single-leg balance each side, arch held' },
  { id: 'physio', name: 'Physio has checked and agreed' },
];

export const NOTE_OPTIONS = [
  'Felt easy', 'Just right', 'Felt hard', 'Knee discomfort',
  'Shin discomfort', 'Calf tightness', 'Form broke down', 'Cut short',
];
// Notes that mean a session did not count as clean for progression.
export const BAD_NOTES = ['Felt hard', 'Knee discomfort', 'Shin discomfort', 'Calf tightness', 'Form broke down', 'Cut short'];

export const RULES = {
  effort: 'Work at 6 to 7 out of 10 and stop one rep before shaking or form breakdown.',
  pain: 'Stop or scale back if pain goes above 4 out of 10 during an exercise, or if next-morning soreness gets worse two days in a row.',
  gymLoad: 'Start light. Add weight only when every set is clean and pain stays at 3 out of 10 or lower.',
  rest: 'Rest 30 s after light floor work, 45 to 60 s after the knee exercises at home and 90 s between gym sets. Switch sides without resting. Fill home rests with short foot or single-leg balance.',
  tke: 'Stop just short of locking the knee, and never push past straight.',
  running: [
    'Increase weekly running by no more than about 10%.',
    'Stop and drop back a step if pain goes above 3 out of 10 or soreness is worse the next morning.',
    'Keep cadence a little higher and strides shorter to shift work from the calves toward the hips.',
  ],
};
