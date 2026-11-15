// Built-in exercises. Ids are stable (backups and the logbook refer to them);
// the names live in js/locales/ under "ex.<id>", muscles under "muscle.<key>".

export const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'abs', 'other'];

const group = (muscle, ids) => ids.map((id) => ({ id, muscle }));

export const BUILTIN_EXERCISES = [
  ...group('chest', ['bench-press-barbell', 'bench-press-dumbbell', 'incline-bench-barbell', 'incline-bench-dumbbell',
    'chest-press-machine', 'pec-deck', 'cable-fly', 'dumbbell-fly', 'dips', 'push-up']),
  ...group('back', ['deadlift', 'pull-up', 'chin-up', 'lat-pulldown', 'lat-pulldown-close', 'barbell-row', 'dumbbell-row',
    'cable-row', 't-bar-row', 'machine-row', 'pullover-cable', 'back-extension']),
  ...group('shoulders', ['overhead-press-barbell', 'overhead-press-dumbbell', 'shoulder-press-machine',
    'lateral-raise-dumbbell', 'lateral-raise-cable', 'front-raise', 'reverse-fly', 'face-pull', 'shrug']),
  ...group('biceps', ['curl-barbell', 'curl-dumbbell', 'curl-ez', 'hammer-curl', 'preacher-curl', 'curl-cable', 'incline-curl']),
  ...group('triceps', ['triceps-pushdown', 'triceps-overhead-cable', 'skull-crusher', 'close-grip-bench',
    'triceps-dip-machine', 'triceps-kickback']),
  ...group('legs', ['squat', 'front-squat', 'leg-press', 'hack-squat', 'bulgarian-split-squat', 'lunge', 'leg-extension',
    'leg-curl-lying', 'leg-curl-seated', 'romanian-deadlift', 'hip-thrust', 'calf-raise-standing', 'calf-raise-seated',
    'adductor', 'abductor']),
  ...group('abs', ['crunch', 'cable-crunch', 'hanging-leg-raise', 'ab-wheel', 'russian-twist', 'ab-machine']),
];
