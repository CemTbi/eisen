// Built-in exercises. Ids are stable (backups and the logbook refer to them);
// the names live in js/locales/ under "ex.<id>", muscle groups under
// "muscle.<key>". Each exercise lists the muscles it trains, "main | supporting",
// which the exercise picture highlights (keys as in js/figure.js, names under "m.<key>").

export const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'abs', 'other'];

const list = (text) => (text ? text.trim().split(/\s+/) : []);

const group = (muscle, exercises) => Object.entries(exercises).map(([id, trained]) => {
  const [primary, secondary] = trained.split('|');
  return { id, muscle, primary: list(primary), secondary: list(secondary) };
});

export const BUILTIN_EXERCISES = [
  ...group('chest', {
    'bench-press-barbell': 'chest | triceps shoulders',
    'bench-press-dumbbell': 'chest | triceps shoulders',
    'incline-bench-barbell': 'chest | shoulders triceps',
    'incline-bench-dumbbell': 'chest | shoulders triceps',
    'chest-press-machine': 'chest | triceps shoulders',
    'pec-deck': 'chest | shoulders',
    'cable-fly': 'chest | shoulders',
    'dumbbell-fly': 'chest | shoulders',
    dips: 'chest triceps | shoulders',
    'push-up': 'chest | triceps shoulders abs',
  }),
  ...group('back', {
    deadlift: 'hamstrings glutes lowerback | quads traps lats forearms',
    'pull-up': 'lats | biceps traps forearms',
    'chin-up': 'lats biceps | traps forearms',
    'lat-pulldown': 'lats | biceps traps forearms',
    'lat-pulldown-close': 'lats | biceps traps forearms',
    'barbell-row': 'lats traps | biceps lowerback shoulders',
    'dumbbell-row': 'lats | traps biceps shoulders',
    'cable-row': 'lats traps | biceps shoulders',
    't-bar-row': 'lats traps | biceps lowerback',
    'machine-row': 'lats traps | biceps',
    'pullover-cable': 'lats | triceps chest',
    'back-extension': 'lowerback | glutes hamstrings',
  }),
  ...group('shoulders', {
    'overhead-press-barbell': 'shoulders | triceps traps',
    'overhead-press-dumbbell': 'shoulders | triceps traps',
    'shoulder-press-machine': 'shoulders | triceps traps',
    'lateral-raise-dumbbell': 'shoulders | traps',
    'lateral-raise-cable': 'shoulders | traps',
    'front-raise': 'shoulders | chest',
    'reverse-fly': 'shoulders | traps',
    'face-pull': 'shoulders traps | biceps',
    shrug: 'traps | forearms',
  }),
  ...group('biceps', {
    'curl-barbell': 'biceps | forearms',
    'curl-dumbbell': 'biceps | forearms',
    'curl-ez': 'biceps | forearms',
    'hammer-curl': 'biceps forearms',
    'preacher-curl': 'biceps | forearms',
    'curl-cable': 'biceps | forearms',
    'incline-curl': 'biceps | forearms',
  }),
  ...group('triceps', {
    'triceps-pushdown': 'triceps',
    'triceps-overhead-cable': 'triceps',
    'skull-crusher': 'triceps',
    'close-grip-bench': 'triceps | chest shoulders',
    'triceps-dip-machine': 'triceps | chest shoulders',
    'triceps-kickback': 'triceps',
  }),
  ...group('legs', {
    squat: 'quads glutes | hamstrings adductors lowerback',
    'front-squat': 'quads | glutes abs lowerback',
    'leg-press': 'quads | glutes hamstrings',
    'hack-squat': 'quads | glutes',
    'bulgarian-split-squat': 'quads glutes | hamstrings adductors',
    lunge: 'quads glutes | hamstrings',
    'leg-extension': 'quads',
    'leg-curl-lying': 'hamstrings | calves',
    'leg-curl-seated': 'hamstrings | calves',
    'romanian-deadlift': 'hamstrings glutes | lowerback forearms',
    'hip-thrust': 'glutes | hamstrings quads',
    'calf-raise-standing': 'calves',
    'calf-raise-seated': 'calves',
    adductor: 'adductors',
    abductor: 'glutes',
  }),
  ...group('abs', {
    crunch: 'abs | obliques',
    'cable-crunch': 'abs | obliques',
    'hanging-leg-raise': 'abs | obliques forearms',
    'ab-wheel': 'abs | lats shoulders',
    'russian-twist': 'obliques | abs',
    'ab-machine': 'abs | obliques',
  }),
];
