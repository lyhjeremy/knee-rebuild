// Real-person media for the exercise pages.
// PHOTOS: copies of photos from wger.de (Creative Commons BY-SA 4.0), credited under each one.
// GIFS: animated demos from ExerciseDB's free API, loaded from their server, not stored here.

const CC = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };

export const PHOTOS = {
  'calf-raise': [
    { src: 'photos/wger-439-calf-raise.jpg', alt: 'Woman doing a standing calf raise, flat feet then up on her toes', author: 'clafal', page: 'https://wger.de/en/exercise/622/view/', license: CC, note: 'She holds dumbbells; yours are bodyweight only.' },
  ],
  'calf-stretch': [
    { src: 'photos/wger-452-calf-stretch.jpg', alt: 'Man leaning into a wall with one leg back, back heel down', author: 'erikocobra (photo: MD Anderson)', page: 'https://wger.de/en/exercise/1239/view/', license: CC },
    { src: 'photos/wger-644-calf-stretch.jpg', alt: 'Woman holding a rack with one leg stepped back, stretching the calf', author: 'Davidgj32', page: 'https://wger.de/en/exercise/1876/view/', license: CC },
  ],
  'hip-flexor-stretch': [
    { src: 'photos/wger-635-hip-flexor-stretch.jpg', alt: 'Woman in a kneeling lunge stretching the front of the back hip', author: 'Davidgj32', page: 'https://wger.de/en/exercise/1867/view/', license: CC, note: 'She leans deeper than you need; keep your pelvis tucked.' },
  ],
  'quad-stretch': [
    { src: 'photos/wger-641-quad-stretch.jpg', alt: 'Woman standing on one leg holding the other ankle behind her', author: 'Davidgj32', page: 'https://wger.de/en/exercise/2687/view/', license: CC },
  ],
  'goblet-squat': [
    { src: 'photos/wger-328-goblet-squat.jpg', alt: 'Man holding a kettlebell at his chest, standing and then squatting', author: 'philip', page: 'https://wger.de/en/exercise/203/view/', license: CC, note: 'Go only to your pain-free depth.' },
  ],
};

// ExerciseDB GIFs show a 3D-rendered figure, not a filmed person. They load from
// static.exercisedb.dev at view time (no published reuse terms, so they are not copied here).
const edb = (id) => `https://static.exercisedb.dev/media/${id}.gif`;
export const GIFS = {
  'glute-bridge': [
    { url: edb('u0cNiij'), label: 'Glute bridge on the floor', alt: '3D figure doing a glute bridge on the floor' },
  ],
  'sl-glute-bridge': [
    { url: edb('rmEukuS'), label: 'Single-leg bridge with the other leg straight', alt: '3D figure doing a single-leg glute bridge' },
  ],
  'side-leg-raise': [
    { url: edb('7WaDzyL'), label: 'Side hip abduction', alt: '3D figure lying on its side lifting the top leg' },
  ],
  'side-plank': [
    { url: edb('RKjH6Lt'), label: 'Side plank on the feet', alt: '3D figure holding a side plank on one forearm', note: 'Start from your knees if needed.' },
  ],
  'calf-raise': [
    { url: edb('XIHEoCG'), label: 'Calf raise holding a wall', alt: '3D figure rising onto its toes with hands on a wall', note: 'Keep your arches lifted and lower over 3 s.' },
  ],
  'push-up': [
    { url: edb('B1EVP9F'), label: 'Incline push-up', alt: '3D figure doing push-ups with hands on a raised step' },
  ],
  'calf-stretch': [
    { url: edb('m0tCHqc'), label: 'Calf stretch with hands on the wall', alt: '3D figure leaning into a wall stretching the calf' },
  ],
  'quad-stretch': [
    { url: edb('BWnJR72'), label: 'Quad stretch lying on your side', alt: '3D figure lying on its side pulling one heel back', note: 'This is the gentler lying version.' },
  ],
  'hip-thrust': [
    { url: edb('qKBpF7I'), label: 'Barbell glute bridge', alt: '3D figure doing a barbell glute bridge on the floor', note: 'Same movement from the floor; for the hip thrust your upper back rests on a bench.' },
  ],
  'cable-abduction': [
    { url: edb('CHpahtl'), label: 'Seated hip abduction machine', alt: '3D figure pushing the knees apart on an abduction machine', note: 'Machine version. The cable version is the same sideways sweep, standing.' },
  ],
  'rdl': [
    { url: edb('rR0LJzx'), label: 'Dumbbell Romanian deadlift', alt: '3D figure hinging forward with dumbbells' },
  ],
  'goblet-squat': [
    { url: edb('yn8yg1r'), label: 'Dumbbell goblet squat', alt: '3D figure squatting with a dumbbell held at the chest', note: 'Go only to your pain-free depth.' },
  ],
  'leg-press': [
    { url: edb('10Z2DXU'), label: '45-degree leg press', alt: '3D figure on a sled leg press', note: 'Stop before the deep knee bend shown at the bottom.' },
  ],
  'pallof': [
    { url: edb('9pa4H5m'), label: 'Pallof press', alt: '3D figure pressing a band straight out from the chest' },
    { url: edb('iny3m5y'), label: 'Dead bug', alt: '3D figure lying on its back lowering opposite arm and leg' },
  ],
  'cycling': [
    { url: edb('a8VDgLw'), label: 'Stationary bike', alt: '3D figure pedalling a stationary bike' },
  ],
};
