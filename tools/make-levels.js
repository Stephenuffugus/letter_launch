/* Letter Launch — level generator (offline, one-time).
 * Builds a FIXED, pre-verified set of levels so the game never serves an
 * impossible one. Each level lists specific common words and the EXACT letters
 * needed to build them (shuffled), so it's always solvable — the challenge is
 * placement, never luck. Every word is validated against the live dictionary.
 *   node tools/make-levels.js   ->  docs/levels.js  (window.LL_LEVELS)
 */
const fs = require('fs');

// ---- load the dictionary (same Set the game uses) for validation ----
global.window = {};
eval(fs.readFileSync(__dirname + '/../docs/dict.js', 'utf8'));
const DICT = global.window.DICT;

// ---- curated pools of common, recognizable words (validated below) ----
const POOL = {
  3: ('cat dog sun run top bug hat pen cup fox jam key mud net owl pig rug sky web zip ant bee ' +
      'cow ear fan gem hen ice jar log map nut oak paw ram sea tea van win yak arm bat car den ' +
      'egg fig gum ham ink box bus hop jet kit').trim().split(/\s+/),
  4: ('rain star fish bird tree lion moon frog cake gold ring ship wolf snow leaf drum king lamp ' +
      'nest rock sand vine wave yarn bear coin dawn fire gate hill iron jade kite lake mint note ' +
      'palm road seed tide bell corn duck fern goat hawk reef sail wind boat cave deer glow hand ' +
      'maze opal pond rose surf').trim().split(/\s+/),
  5: ('storm beach cloud dance eagle flame grape heart ivory jewel lemon music north ocean peach ' +
      'queen river stone tiger whale zebra bread chair dream earth fruit glass honey light mango ' +
      'night olive plant robin snake train amber bloom brook candy coral crown daisy delta ember ' +
      'fairy field flora frost ghost giant globe grass green heron juice lilac lunar maple marsh ' +
      'misty noble onion otter pearl petal pixel prism quail raven reign roost sandy shade shell ' +
      'shine sloth solar spark spice spore steam swift thorn tulip vapor vista vivid woven zesty').trim().split(/\s+/),
  6: ('dragon forest garden island jungle meadow orange pebble rocket silver summer temple valley ' +
      'willow animal basket candle desert flower guitar hammer jacket kettle ladder marble needle ' +
      'pepper ribbon saddle ticket almond autumn breeze bronze bubble canyon cherry cosmos crater ' +
      'copper dapple fennel garnet ginger harbor indigo jaguar kitten lagoon maroon mellow mirror ' +
      'nectar oyster parrot pewter pillow purple quiver ripple rubble sailor saturn season shadow ' +
      'shrine smooth sphere spiral spruce sunset timber violet walnut winter wizard yonder zinnia ' +
      'frozen golden hidden velvet wonder').trim().split(/\s+/),
  7: ('admiral apricot blossom bramble caravan cascade chamber cheetah compass crystal cyclone ' +
      'diamond dolphin emerald feather flicker glacier granite harvest hexagon horizon iceberg ' +
      'journey juniper leopard machine majesty mariner mineral monarch octopus orchard pelican ' +
      'phoenix pyramid rainbow saffron scarlet serpent shimmer thunder twinkle unicorn vintage ' +
      'whisper wildcat').trim().split(/\s+/),
};
for (const k in POOL) POOL[k] = POOL[k].filter(w => DICT.has(w));

// ---- deterministic RNG (so the set is reproducible) ----
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function shuffle(arr, rnd){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=(rnd()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;}

// ---- difficulty ramp: smooth climb to N levels (capped so tiles fit the board) ----
function makeSchedule(N){
  const S=[];
  for(let i=1;i<=N;i++){
    let count, lens;
    if(i<=3){count=3; lens=[3];}
    else if(i<=6){count=3; lens=[3,4,4];}
    else if(i<=9){count=4; lens=[4];}
    else if(i<=12){count=4; lens=[4,5,4,5];}
    else if(i<=15){count=4; lens=[5];}
    else if(i<=18){count=5; lens=[4,5,5,6,5];}
    else if(i<=21){count=5; lens=[5,6,5,6,5];}
    else if(i<=24){count=5; lens=[6,5,6,5,6];}
    else if(i<=27){count=5; lens=[6];}
    else if(i<=30){count=6; lens=[5,6,5,6,5,6];}
    else if(i<=33){count=6; lens=[6,5,6,6,5,6];}
    else if(i<=36){count=6; lens=[6];}
    else            {count=5; lens=[6,7,6,7,6];}
    S.push({count,lens});
  }
  return S;
}
const SCHEDULE = makeSchedule(40);

const used = {3:new Set(),4:new Set(),5:new Set(),6:new Set(),7:new Set()};
function pick(len, rnd){
  const avail = POOL[len].filter(w => !used[len].has(w));
  const src = avail.length ? avail : POOL[len];       // recycle if a pool runs dry
  const w = shuffle(src, rnd)[0];
  used[len].add(w);
  return w;
}

const levels = [];
SCHEDULE.forEach((spec, idx) => {
  const rnd = mulberry32(1000 + idx);                 // per-level seed → reproducible
  const words = [];
  for (let i=0;i<spec.count;i++){
    const len = spec.lens[i % spec.lens.length];
    let w, guard=0;
    do { w = pick(len, rnd); guard++; } while (words.indexOf(w)>=0 && guard<30);
    words.push(w);
  }
  const letters = words.join('').toUpperCase().split('');
  const deal = shuffle(letters, rnd).join('');
  levels.push({ n: idx+1, words: words.map(w=>w.toUpperCase()), deal });
});

// ---- verify ----
let ok = true, maxTiles = 0;
levels.forEach(L => {
  const allInDict = L.words.every(w => DICT.has(w.toLowerCase()));
  const dealSorted = L.deal.split('').sort().join('');
  const needSorted = L.words.join('').split('').sort().join('');
  const lettersMatch = dealSorted === needSorted;
  const fits = L.deal.length <= 42;                   // board is 7×6
  maxTiles = Math.max(maxTiles, L.deal.length);
  if (!allInDict || !lettersMatch || !fits) { ok = false;
    console.log('✗ level', L.n, 'PROBLEM', {allInDict, lettersMatch, fits}); }
});
console.log('pools (in-dict):', Object.keys(POOL).map(k=>k+':'+POOL[k].length).join('  '));
levels.forEach(L => console.log('  L'+String(L.n).padStart(2)+'  ('+L.words.length+'w, '+String(L.deal.length).padStart(2)+'t)  '+L.words.join(' ')));
if (!ok) { console.error('\nValidation failed — not writing.'); process.exit(1); }
console.log('\nmax tiles in any level:', maxTiles, '(board holds 42)');

// ---- emit docs/levels.js ----
const out =
  '/* Letter Launch — level set + word pools. GENERATED by tools/make-levels.js — do not edit.\n' +
  ' * Fixed + pre-verified: every word is in the dictionary and each level is dealt the\n' +
  ' * exact letters to build its words, so no level is ever impossible. LL_WORDPOOL is the\n' +
  ' * same curated, dictionary-validated word pools, used to generate the Daily Climb. */\n' +
  '(()=>{\'use strict\';\n' +
  'window.LL_WORDPOOL=' + JSON.stringify(POOL) + ';\n' +
  'window.LL_LEVELS=[\n' +
  levels.map(L => '  {n:'+L.n+',words:'+JSON.stringify(L.words)+",deal:'"+L.deal+"'}").join(',\n') +
  '\n];})();\n';
fs.writeFileSync(__dirname + '/../docs/levels.js', out);
console.log('Wrote docs/levels.js — '+levels.length+' levels.');
