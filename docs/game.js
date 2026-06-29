/* SlingSpell — game logic
 * Depends on dict.js (defines window.DICT : Set<string>) loaded before this file.
 * All tunable values live in the CONFIG block below.
 */
(()=>{
  'use strict';

  // ================= CONFIG (tune here) =================
  const W=560, H=760;                 // logical canvas size (game coordinates)
  const COLS=7, ROWS=6, CELL=72;      // board grid
  const GRID_W=COLS*CELL, GX0=(W-GRID_W)/2, BOARD_TOP=304;
  const ANCHOR={x:W/2, y:70};         // launcher position (top-center)
  const MAX_PULL=150, POWER=0.14, GRAV=0.42, BALL_R=22; // aim/physics feel
  const COMBO_MS=5000, MULT_CAP=8;    // streak window + cap
  const COIN_RATE=100;                // points per coin earned
  const MIN_WORD=3;
  const MAX_BALL_FRAMES=360;          // failsafe: force-settle a ball stuck bouncing (~6s) so the launcher never locks

  // Restitution (bounciness) by bumper kind. Kept <=1 so the field never ADDS
  // energy — that makes the flight deterministic and the trajectory preview an
  // honest prediction (you can actually aim). 'charger' shares 'bouncer' physics
  // (reachability unchanged); it only flags the tile gold (2x letter value). See sim.js.
  const REST={ peg:0.82, bouncer:1.0, charger:1.0 };
  const PAD_MULT=2;                   // gold charged tile: letter value multiplier

  /* Bumper layout — fully STATIC (no moving bumper). A static field means the
   * previewed path is exactly the path the ball takes, so placement is a skill,
   * not a dice roll. All 7 columns stay reachable (verified by tools/sim.js — 7/7).
   *   bx,by : position    r : radius    kind : 'peg' | 'bouncer' | 'charger'
   * NOTE: keep bumpers off column centers (cols are 72 wide; centers at GX0+c*72+36)
   * and leave a clear gap above BOARD_TOP so every column stays reachable.
   * Re-run tools/sim.js (must print 7/7) after ANY change here. */
  // NB: no bumper sits on the launcher's center line (x=280) — a straight-down shot
  // must fall straight, so aiming feels honest. Gaps between pegs keep all 7 cols reachable.
  const BUMPERS=[
    {bx:100, by:150, r:12, kind:'peg'},
    {bx:244, by:150, r:12, kind:'peg'},
    {bx:388, by:150, r:12, kind:'peg'},
    {bx:172, by:214, r:12, kind:'bouncer'},
    {bx:316, by:214, r:12, kind:'charger'},
    {bx:460, by:214, r:12, kind:'bouncer'},
  ];

  const VALUES={a:1,b:3,c:3,d:2,e:1,f:4,g:2,h:4,i:1,j:8,k:5,l:1,m:3,n:1,o:1,p:3,q:10,r:1,s:1,t:1,u:1,v:4,w:4,x:8,y:4,z:10};
  // Letter bag (vowel-weighted for word-formability).
  const BAGW={a:9,e:12,i:9,o:8,u:4,n:6,r:6,t:6,l:4,s:5,d:4,g:3,b:2,c:3,m:3,p:3,f:2,h:3,v:2,w:2,y:3,k:2,j:1,x:1,q:1,z:1};
  // ================= end CONFIG =================

  const DICT = window.DICT || new Set();
  const BAG=(()=>{let p=[];for(const k in BAGW)for(let i=0;i<BAGW[k];i++)p.push(k);return p;})();
  // Pluggable RNG: free play uses Math.random; daily challenge uses a date-seeded
  // stream so everyone gets the same letters. setupRng() swaps it per mode.
  let rng=Math.random;
  const randLetter=()=>BAG[(rng()*BAG.length)|0].toUpperCase();

  // ---- persistence (localStorage; new 'letterlaunch.' namespace, reads legacy 'slingspell.' as fallback) ----
  const NS='letterlaunch.', OLD='slingspell.';
  const LS={
    get(k,d){try{let v=localStorage.getItem(NS+k);if(v==null)v=localStorage.getItem(OLD+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
    set(k,v){try{localStorage.setItem(NS+k,JSON.stringify(v));}catch(e){}}
  };
  let best=LS.get('best',0), coins=LS.get('coins',0);
  // 'level' (word-list campaign) is the headline mode and the default. Other modes:
  // 'climb' (daily 3-stage word list), 'daily' (seeded endless), 'free' (endless practice).
  let mode=LS.get('mode','level');
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const todayKey=()=>window.LL_RNG?window.LL_RNG.dayKey():'';
  const prettyDate=key=>{if(!key)return'';const p=key.split('-');return MONTHS[(+p[1])-1]+' '+(+p[2]);};
  // ---- daily streak: consecutive days the Daily challenge was completed ----
  const yesterdayKey=()=>{const d=new Date();d.setDate(d.getDate()-1);return window.LL_RNG?window.LL_RNG.dayKey(d):'';};
  function currentStreak(){                 // live streak for display (0 once a day is missed)
    const last=LS.get('streak.last',''), n=LS.get('streak.count',0);
    return (last===todayKey()||last===yesterdayKey())?n:0;
  }
  function bumpStreak(){                     // called once when a Daily run ends (idempotent within a day)
    const today=todayKey(), last=LS.get('streak.last','');
    let n=LS.get('streak.count',0);
    if(last!==today) n=(last===yesterdayKey())?n+1:1;
    LS.set('streak.count',n); LS.set('streak.last',today); return n;
  }
  function setupRng(){
    if(mode==='daily'&&window.LL_RNG) rng=window.LL_RNG.seeded('LL-'+todayKey());
    else rng=Math.random;
  }
  const sfx=(name,...a)=>{if(window.LL_Audio)window.LL_Audio.play(name,...a);};

  // ---- cosmetics (from window.LL_Store; falls back to the classic look) ----
  const DEFAULT_SKIN={tile:{hi:'#fffaf0',lo:'#f0e2c5',edge:'#cdb488',ink:'#2c2417'},felt:{board:'#1d3b34'},launcher:{wood:'#7c5024',woodD:'#5a3917',accent:'#eaa53b'},trail:{color:'#ffffff'},fx:{color:'#5bc47e'}};
  const skin=()=>window.LL_Store?window.LL_Store.getStyle():DEFAULT_SKIN;
  const hexA=(hex,a)=>{hex=String(hex).replace('#','');if(hex.length===3)hex=hex.split('').map(x=>x+x).join('');const n=parseInt(hex,16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';};

  // ---- canvas + responsive fit ----
  const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
  const stage=document.getElementById('stage');
  const dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=W*dpr; cv.height=H*dpr; ctx.scale(dpr,dpr);
  function fit(){const aw=stage.clientWidth-8, ah=stage.clientHeight-8, s=Math.min(aw/W, ah/H);
    cv.style.width=(W*s)+'px'; cv.style.height=(H*s)+'px';}
  window.addEventListener('resize',fit);
  window.addEventListener('orientationchange',()=>setTimeout(fit,150));

  // ---- state ----
  let grid, queue, current, score, gameOver;
  let ball=null, drop=null, particles=[], floaters=[];
  let aiming=false, aim={sx:0,sy:0,cx:0,cy:0}, aimCol=-1;   // aimCol: previewed landing column
  let tracing=false, chain=[]; let shake=0;
  let dragMoved=false, gestureStart=null;   // tap-vs-drag: a gesture is a drag once it crosses into another tile
  let tool=null, swapFirst=null;            // active power-up tool ('swap'|'bomb') + its first picked cell
  let paused=true;                  // true while the home menu / pause is up (input frozen, boot state)
  let streak=0, comboUntil=0, maxStreak=0;
  let playedWords=[];               // every valid word cleared (for the haiku card)
  let lastResult=null;              // snapshot for the share card (built on game over)
  // levels + daily climb (puzzle modes)
  let level=LS.get('level',1);      // current campaign level number (1-based)
  let levelData=null, deal=[], dealIdx=0, launched=0, targets=[];
  let climbStage=0;                 // daily ascension: current stage (0..2)
  // Word Hunt mode: stock the board with letters, then spell a word it can make.
  let huntTarget=null, huntDone=new Set(), huntHelps=0, huntStock=0;
  const HUNT_STOCK=8;               // tiles to launch before the first target appears
  const ITEMS={shuffle:{cost:40}, swap:{cost:30}, bomb:{cost:50}};   // power-up coin costs (in-game only)

  const cellX=c=>GX0+c*CELL+CELL/2, cellY=r=>BOARD_TOP+r*CELL+CELL/2;
  function newGrid(){grid=[];for(let r=0;r<ROWS;r++)grid.push(new Array(COLS).fill(null));}
  // ---- levels ----
  const LEVELS=()=>window.LL_LEVELS||[];
  function loadLevel(){
    const arr=LEVELS(); if(!arr.length){ levelData=null; deal=[]; targets=[]; dealIdx=0; return; }
    if(level<1||level>arr.length) level=1;
    levelData=arr[level-1];
    deal=levelData.deal.split(''); dealIdx=0;
    targets=levelData.words.map(w=>({w:w,done:false}));
  }
  // ---- daily climb: 3 escalating puzzles, generated from the date seed + shared pools ----
  const CLIMB_STAGES=[{count:3,lens:[3,4,4]},{count:4,lens:[4,5,5,5]},{count:5,lens:[5,5,6,6,5]}];
  function genPuzzle(seedStr,spec){
    const pool=window.LL_WORDPOOL;
    if(!pool){ return {words:['CAT','SUN','TOP'],deal:'CATSUNTOP'}; }
    const rnd=window.LL_RNG?window.LL_RNG.seeded(seedStr):Math.random;
    const words=[];
    for(let i=0;i<spec.count;i++){
      const len=spec.lens[i%spec.lens.length], arr=pool[len]||pool[5]||[];
      if(!arr.length) continue;
      let w,guard=0; do{ w=arr[(rnd()*arr.length)|0]; guard++; }while(words.indexOf(w)>=0 && guard<40);
      words.push(String(w).toUpperCase());
    }
    const ls=words.join('').split('');
    for(let i=ls.length-1;i>0;i--){const j=(rnd()*(i+1))|0,t=ls[i];ls[i]=ls[j];ls[j]=t;}
    return {words,deal:ls.join('')};
  }
  function loadClimb(){
    const spec=CLIMB_STAGES[Math.max(0,Math.min(CLIMB_STAGES.length-1,climbStage))];
    const p=genPuzzle('LLA-'+todayKey()+'-'+climbStage,spec);
    deal=p.deal.split(''); dealIdx=0;
    targets=p.words.map(w=>({w:w,done:false}));
  }
  const nextLetter=()=> (mode==='level'||mode==='climb') ? (dealIdx<deal.length?deal[dealIdx++]:'') : randLetter();
  function reset(){
    paused=false;                   // every reset yields a playable board (boot re-pauses via openMenu)
    tool=null; swapFirst=null;
    if(mode==='hunt'){ huntTarget=null; huntDone=new Set(); huntHelps=0; huntStock=0; }
    setupRng();                     // (re)seed the letter stream for the current mode
    if(mode==='level') loadLevel(); else if(mode==='climb') loadClimb();
    newGrid(); score=0; gameOver=false; ball=null; drop=null; particles=[]; floaters=[]; chain=[]; tracing=false; dragMoved=false; aiming=false; streak=0; comboUntil=0; maxStreak=0; playedWords=[]; lastResult=null; launched=0;
    queue=[nextLetter(),nextLetter(),nextLetter()]; current=nextLetter();
    document.getElementById('over').classList.remove('show');
    const lo=document.getElementById('levelover'); if(lo) lo.classList.remove('show');
    const mn=document.getElementById('menu'); if(mn) mn.classList.remove('show');   // reset == a clean, playable board
    msg(mode==='climb'?('Daily Climb — stage '+(climbStage+1)+' of 3'):(mode==='level'?('Level '+level+' — build the words on the list!'):(mode==='hunt'?('Word Hunt — launch '+HUNT_STOCK+' letters, then spell what they make!'):(mode==='daily'?('Daily '+prettyDate(todayKey())+' — drag to aim.'):'Drag down to aim, release to drop.'))));
    updateHUD(); syncMode(); renderLevelBar(); hideChip(); updateItemBar();
  }
  function lowestEmpty(c){for(let r=ROWS-1;r>=0;r--) if(!grid[r][c]) return r; return -1;}
  function nearestOpenCol(c){for(let d=1;d<COLS;d++){if(c-d>=0&&lowestEmpty(c-d)>=0)return c-d;if(c+d<COLS&&lowestEmpty(c+d)>=0)return c+d;}return -1;}
  // Resolve the live ball into the grid: its aimed column, or the nearest column
  // with room if that one is full. Only ends the game when the WHOLE board is full.
  function settleBall(){
    if(!ball)return;
    let c=Math.max(0,Math.min(COLS-1,Math.floor((ball.x-GX0)/CELL)));
    let r=lowestEmpty(c);
    if(r<0){ c=nearestOpenCol(c); if(c<0){ endGame(); ball=null; return; } r=lowestEmpty(c); }
    drop={c,r,letter:ball.letter,y:Math.min(ball.y,cellY(r)),vy:Math.max(ball.vy,4),bonus:ball.bonus};
    ball=null;
  }

  // ---- bumpers ----
  function updateBumpers(){
    for(const b of BUMPERS){           // static field: position is just the base
      b.x=b.bx; b.y=b.by;
      if(b.flash>0) b.flash-=0.08;
    }
  }

  // ---- aim / fire ----
  // Stable aim point: per-axis median of the last few drag samples (rejects a lift-off
  // jerk). The PREVIEW and the actual launch both use this, so the glowing column never lies.
  function aimPoint(){const path=aim.path||[];
    if(path.length>=3){const xs=path.slice(-3).map(q=>q.x).sort((a,b)=>a-b),ys=path.slice(-3).map(q=>q.y).sort((a,b)=>a-b);return{x:xs[1],y:ys[1]};}
    if(path.length>=1)return path[path.length-1];
    return{x:aim.cx,y:aim.cy};}
  function dragVec(){const t=aimPoint();let dx=t.x-aim.sx,dy=t.y-aim.sy,d=Math.hypot(dx,dy);
    if(d>MAX_PULL){dx*=MAX_PULL/d;dy*=MAX_PULL/d;}return{x:dx,y:dy,d:Math.min(d,MAX_PULL)};}
  function launch(vx,vy){ball={x:ANCHOR.x,y:ANCHOR.y,vx,vy,r:BALL_R,letter:current,rot:0,bonus:false,age:0};}

  // ---- physics ----
  function step(){
    if(!ball)return;
    ball.vy+=GRAV; ball.x+=ball.vx; ball.y+=ball.vy; ball.rot+=ball.vx*0.02; ball.age++;
    if(ball.x<ball.r){ball.x=ball.r;ball.vx*=-0.7;if(Math.abs(ball.vx)>1.2)sfx('wall');}
    if(ball.x>W-ball.r){ball.x=W-ball.r;ball.vx*=-0.7;if(Math.abs(ball.vx)>1.2)sfx('wall');}
    if(ball.y<ball.r){ball.y=ball.r;ball.vy*=-0.5;}
    for(const b of BUMPERS){const dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy),min=ball.r+b.r;
      if(d<min){const nx=dx/(d||1),ny=dy/(d||1);ball.x=b.x+nx*min;ball.y=b.y+ny*min;
        const dot=ball.vx*nx+ball.vy*ny,k=REST[b.kind]||0.86;
        ball.vx=(ball.vx-2*dot*nx)*k; ball.vy=(ball.vy-2*dot*ny)*k;
        b.flash=1;
        const col=b.kind==='charger'?'#ffcf4d':(b.kind==='bouncer'?'#eaa53b':'#bfe6da');
        ping(b.x,b.y,col, b.kind==='peg'?4:8);
        if(b.kind==='charger'&&!ball.bonus){ball.bonus=true;ping(b.x,b.y,'#ffe9a8',12);sfx('streakUp',3);}
        sfx(b.kind==='peg'?'peg':'bouncer');}}
    if(ball.vy>0 && ball.y+ball.r>=BOARD_TOP){ settleBall(); return; }
    if(ball.age>MAX_BALL_FRAMES){ settleBall(); return; }   // failsafe: a stuck ball can never lock the launcher
    if(ball.y>H+60){ball=null;}
  }
  function stepDrop(){
    if(!drop)return;
    drop.vy+=GRAV*1.5; drop.y+=drop.vy; const ty=cellY(drop.r);
    if(drop.y>=ty){grid[drop.r][drop.c]={l:drop.letter,pop:1,bonus:!!drop.bonus};ping(cellX(drop.c),ty,drop.bonus?'#ffcf4d':'#eaa53b',drop.bonus?9:6);sfx('lock');drop=null;
      launched++; if(mode==='hunt'){huntStock++;maybePickHuntTarget();}
      current=queue.shift();queue.push(nextLetter());updateHUD();renderLevelBar();}
  }

  // ---- words + streak ----
  const adjacent=(a,b)=>Math.abs(a.r-b.r)<=1&&Math.abs(a.c-b.c)<=1&&!(a.r===b.r&&a.c===b.c);
  const inChain=(r,c)=>chain.some(p=>p.r===r&&p.c===c);
  const chainWord=()=>chain.map(p=>grid[p.r][p.c].l).join('');
  function scoreAndClear(w){       // score the chain, clear its tiles, collapse; returns points gained
    const now=performance.now();
    streak=(now<comboUntil)?Math.min(streak+1,MULT_CAP):1; comboUntil=now+COMBO_MS;
    if(streak>maxStreak)maxStreak=streak;
    let base=0;for(const p of chain){const cl=grid[p.r][p.c];base+=(VALUES[cl.l.toLowerCase()]||1)*(cl.bonus?PAD_MULT:1);}
    const gained=base*w.length*streak; score+=gained;
    playedWords.push(w.toLowerCase());
    let cx=0,cy=0; const fxc=skin().fx?skin().fx.color:'#5bc47e';
    for(const p of chain){cx+=cellX(p.c);cy+=cellY(p.r);ping(cellX(p.c),cellY(p.r),fxc,10);grid[p.r][p.c]=null;}
    floaters.push({x:cx/chain.length,y:cy/chain.length,txt:'+'+gained+(streak>1?'  x'+streak:''),life:1,col:fxc});
    clearAdjacentBlockers();        // a word next to a black block breaks it
    collapse();chip(w,'good');
    sfx('word',w.length,streak); if(streak>=2)sfx('streakUp',streak);
    return gained;
  }
  function submitWord(){
    const w=chainWord(), lw=w.toLowerCase();
    if(w.length>=MIN_WORD){
      if(mode==='level'||mode==='climb'){       // only words on the checklist count
        const t=targets.find(x=>!x.done && x.w.toLowerCase()===lw);
        if(t){ const g=scoreAndClear(w); t.done=true; renderLevelBar(); msg(w.toUpperCase()+' \u2713  +'+g);
          if(targets.every(x=>x.done)) setTimeout(mode==='climb'?climbAdvance:levelComplete,450); }
        else if(DICT.has(lw)){ chip(w,'bad'); sfx('bad'); msg('&ldquo;'+w.toUpperCase()+'&rdquo; \u2014 not on the list.'); }
        else { chip(w,'bad'); shake=10; sfx('bad'); msg('Not a word.'); }
      } else if(mode==='hunt'){ huntSubmit(w,lw); }
      else if(DICT.has(lw)){ const g=scoreAndClear(w); msg(w.toUpperCase()+' &rarr; +'+g+(streak>1?' (x'+streak+' streak!)':'')); }
      else { chip(w,'bad'); shake=10; sfx('bad'); msg('&ldquo;'+w.toUpperCase()+'&rdquo; isn\u2019t in the list.'); }
    }
    chain=[];updateHUD();updateWordUI();setTimeout(hideChip,650);
  }
  // click-to-spell: tap tiles one at a time (great for diagonals, where dragging
  // is fiddly). Tap a selected tile to unpick it and everything after it.
  function tapCell(cell){
    const idx=chain.findIndex(p=>p.r===cell.r&&p.c===cell.c);
    if(idx>=0) chain.length=idx;                                 // deselect from here onward
    else if(chain.length===0) chain=[cell];
    else if(adjacent(chain[chain.length-1],cell)) chain.push(cell);
    else chain=[cell];                                           // not adjacent → start fresh here
    sfx('peg'); liveChip();
  }
  function collapse(){for(let c=0;c<COLS;c++){const st=[];for(let r=ROWS-1;r>=0;r--)if(grid[r][c])st.push(grid[r][c]);
    for(let r=ROWS-1;r>=0;r--)grid[r][c]=st[ROWS-1-r]||null;}}

  // ---- blockers (black spaces) ----
  const isBlocker=cl=>cl&&cl.blocker;
  function clearAdjacentBlockers(){     // remove blockers touching any just-cleared chain cell
    const seen={};
    for(const p of chain) for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      const r=p.r+dr,c=p.c+dc,k=r+','+c;
      if(r<0||r>=ROWS||c<0||c>=COLS||seen[k])continue; seen[k]=1;
      if(isBlocker(grid[r][c])){ grid[r][c]=null; ping(cellX(c),cellY(r),'#9fb0c0',10); sfx('bad'); }
    }
  }
  function dropBlocker(){                // penalty: drop a black block into a random open column
    const open=[]; for(let c=0;c<COLS;c++) if(lowestEmpty(c)>=0) open.push(c);
    if(!open.length) return false;
    const c=open[(Math.random()*open.length)|0], r=lowestEmpty(c);
    grid[r][c]={blocker:true,pop:1}; ping(cellX(c),cellY(r),'#2a2f38',10); sfx('lock'); return true;
  }

  // ---- power-ups (coins spent per use; in-game currency only) ----
  const playerCoins=()=>window.LL_Store?window.LL_Store.coins():coins;
  function spend(n){ if(window.LL_Store){ if(window.LL_Store.coins()<n) return false; window.LL_Store.addCoins(-n); return true; } if(coins<n) return false; coins-=n; LS.set('coins',coins); return true; }
  const tileCount=()=>{let n=0;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=grid[r][c];if(t&&t.l)n++;}return n;};
  function useItem(kind){
    if(paused||gameOver) return;
    const it=ITEMS[kind]; if(!it) return;
    chain=[]; swapFirst=null; hideChip(); updateWordUI();   // drop any in-progress word so a collapse/swap can't strand it
    if(playerCoins()<it.cost){ msg('Need '+it.cost+' 🪙 for '+kind+'.'); flashItem(kind); return; }
    if(kind==='shuffle'){ if(tileCount()<2){ msg('Nothing to shuffle.'); flashItem(kind); return; } if(!spend(it.cost)) return; shuffleBoard(); sfx('streakUp',2); msg('Shuffled!'); }
    else if(kind==='swap'){ tool='swap'; msg('Swap: tap two tiles.'); }    // charged on completion
    else if(kind==='bomb'){ tool='bomb'; msg('Bomb: tap a tile to remove it.'); }           // charged on use
    updateItemBar();
  }
  function cancelTool(){ tool=null; swapFirst=null; updateItemBar(); }
  function applyTool(cell){
    const cl=grid[cell.r][cell.c]; if(!cl){ cancelTool(); return; }
    if(tool==='bomb'){
      if(playerCoins()<ITEMS.bomb.cost){ msg('Need '+ITEMS.bomb.cost+' 🪙.'); cancelTool(); return; }
      spend(ITEMS.bomb.cost); ping(cellX(cell.c),cellY(cell.r),'#ff7a3c',14); grid[cell.r][cell.c]=null; collapse(); sfx('bouncer'); cancelTool();
    } else if(tool==='swap'){
      if(isBlocker(cl)){ msg('Pick letter tiles to swap.'); return; }
      if(!swapFirst){ swapFirst=cell; sfx('peg'); return; }
      if(swapFirst.r===cell.r&&swapFirst.c===cell.c){ swapFirst=null; return; }   // tap again to deselect
      if(playerCoins()<ITEMS.swap.cost){ msg('Need '+ITEMS.swap.cost+' 🪙.'); cancelTool(); return; }
      spend(ITEMS.swap.cost);
      const a=grid[swapFirst.r][swapFirst.c], b=grid[cell.r][cell.c]; const t=a.l; a.l=b.l; b.l=t; a.pop=1; b.pop=1;
      ping(cellX(cell.c),cellY(cell.r),'#7af2c4',10); ping(cellX(swapFirst.c),cellY(swapFirst.r),'#7af2c4',10); sfx('lock'); cancelTool();
    }
  }
  function shuffleBoard(){              // re-randomise the letters on existing tiles (positions unchanged)
    const ls=[]; for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=grid[r][c]; if(t&&t.l)ls.push(t.l);}
    for(let i=ls.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;const tmp=ls[i];ls[i]=ls[j];ls[j]=tmp;}
    let k=0; for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=grid[r][c]; if(t&&t.l){t.l=ls[k++];t.pop=1;}}
  }

  // ---- Word Hunt: derive a real, formable target word from the board's letters ----
  function boardCounts(){ const m={}; for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=grid[r][c]; if(t&&t.l){const k=t.l.toLowerCase(); m[k]=(m[k]||0)+1;}} return m; }
  function fitsCounts(w,m){ const need={}; for(const ch of w){ need[ch]=(need[ch]||0)+1; if(need[ch]>(m[ch]||0)) return false; } return true; }
  // DFS: can WORD be traced as an adjacency chain on the current board? Guarantees the
  // target we hand the player is actually spellable (not just present as loose letters).
  function canTrace(W){
    W=W.toUpperCase(); const used={};
    const dfs=(r,c,i)=>{ if(i===W.length-1) return true; used[r+','+c]=1;
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){ if(!dr&&!dc)continue; const nr=r+dr,nc=c+dc;
        if(nr<0||nr>=ROWS||nc<0||nc>=COLS||used[nr+','+nc])continue;
        const t=grid[nr][nc]; if(t&&t.l&&t.l.toUpperCase()===W[i+1]&&dfs(nr,nc,i+1)){ used[r+','+c]=0; return true; } }
      used[r+','+c]=0; return false; };
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=grid[r][c]; if(t&&t.l&&t.l.toUpperCase()===W[0]&&dfs(r,c,0)) return true;}
    return false;
  }
  function findHuntTarget(){
    const pool=window.LL_WORDPOOL; if(!pool) return null;
    const m=boardCounts();
    for(const len of [7,6,5,4,3]){ const arr=pool[len]||[]; const cand=[];
      for(const w of arr){ if(huntDone.has(w))continue; if(fitsCounts(w,m)&&canTrace(w)) cand.push(w); }   // present AND traceable now
      if(cand.length) return cand[(Math.random()*cand.length)|0].toUpperCase(); }
    return null;
  }
  function maybePickHuntTarget(){
    if(mode!=='hunt'||huntTarget) return;
    if(huntStock<HUNT_STOCK) return;
    huntTarget=findHuntTarget(); huntHelps=0;
    if(huntTarget) msg('Spell it: '+huntTarget); renderLevelBar();
  }
  function huntHelp(){
    if(mode!=='hunt'||!huntTarget) return;
    if(ball||drop||paused||gameOver) return;   // only hand over a letter when the launcher is idle
    const give=huntTarget[huntHelps % huntTarget.length];   // hand over a letter of the word
    queue.unshift(current); queue.pop(); current=give; updateHUD();   // pop keeps the launch queue a fixed length
    huntHelps++;
    if(huntHelps>1 && dropBlocker()) msg('Help: ‘'+give+'’ — but a block dropped!'); else msg('Help: place the ‘'+give+'’.');
    renderLevelBar();
  }
  function huntSubmit(w,lw){
    if(!DICT.has(lw)){ chip(w,'bad'); shake=10; sfx('bad'); msg('Not a word.'); return; }
    const g=scoreAndClear(w);
    if(huntTarget && lw===huntTarget.toLowerCase()){
      huntDone.add(lw); const bonus=w.length*5; score+=bonus;
      msg('★ '+w.toUpperCase()+'!  +'+(g+bonus)); huntTarget=null; huntHelps=0;
      setTimeout(maybePickHuntTarget,350);
    } else msg(w.toUpperCase()+' &rarr; +'+g);
    renderLevelBar();
  }

  // ---- fx ----
  function ping(x,y,col='#fff',n=5){for(let i=0;i<n;i++){const a=Math.random()*6.28,s=1+Math.random()*3;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,col});}}
  function stepFx(){particles=particles.filter(p=>{p.life-=0.035;p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;return p.life>0;});
    floaters=floaters.filter(f=>{f.life-=0.016;f.y-=0.7;return f.life>0;});if(shake>0)shake--;
    if(streak>0 && performance.now()>comboUntil) streak=0;}

  // ---- HUD ----
  function updateHUD(){document.getElementById('score').textContent=score;
    document.getElementById('q0').textContent=current;document.getElementById('q1').textContent=queue[0]||'';document.getElementById('q2').textContent=queue[1]||'';}
  const toastEl=document.getElementById('toast'); let toastT=null;
  function msg(t){toastEl.innerHTML=t;toastEl.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>toastEl.classList.remove('show'),1800);}
  const chipEl=document.getElementById('chip');
  const wClearBtn=document.getElementById('wClear'), wSubmitBtn=document.getElementById('wSubmit');
  function updateWordUI(){           // show/hide the ✕ clear + ✓ submit buttons for tap-to-spell
    const n=chain.length, ready=chainWord().length>=MIN_WORD;
    if(wClearBtn) wClearBtn.style.display=n?'grid':'none';
    if(wSubmitBtn){ wSubmitBtn.style.display=ready?'grid':'none'; wSubmitBtn.classList.toggle('ready',ready); }
  }
  function chip(t,cls){chipEl.textContent=t.toUpperCase();chipEl.className='chip '+cls;chipEl.style.display='inline-block';}
  function liveChip(){const w=chainWord();if(w.length){const ok=w.length>=MIN_WORD&&DICT.has(w.toLowerCase());chipEl.textContent=w.toUpperCase();chipEl.className='chip'+(ok?' good':'');chipEl.style.display='inline-block';}else chipEl.style.display='none';updateWordUI();}
  const hideChip=()=>{ if(chain.length) return; chipEl.style.display='none'; updateWordUI(); };  // guard the stale post-submit timer
  if(wClearBtn) wClearBtn.onclick=()=>{ chain=[]; hideChip(); };
  if(wSubmitBtn) wSubmitBtn.onclick=()=>{ if(chain.length){ tracing=false; submitWord(); } };

  // ---- levels: checklist bar + completion ----
  function renderLevelBar(){
    const bar=document.getElementById('levelbar'); if(!bar)return;
    const was=bar.classList.contains('show');
    if(mode==='hunt'){
      const mid=huntTarget
        ? '<span class="lchip" style="letter-spacing:2px">'+huntTarget+'</span><button class="lretry" id="huntHelp" title="Need a letter (drops a block after the first)">＋ letter</button>'
        : (huntStock<HUNT_STOCK
            ? '<span class="lvl" style="opacity:.8">launch '+(HUNT_STOCK-huntStock)+' more…</span>'
            : '<span class="lvl" style="opacity:.8">keep launching — no word yet…</span>');
      bar.innerHTML='<button class="lmenu" id="lvlMenu" title="Game modes">&#9776;</button>'+
        '<span class="lvl">Hunt</span>'+(huntTarget?'<span class="lvl" style="opacity:.7;font-size:11px">spell</span>':'')+mid+
        '<button class="lretry" id="lvlRetry" title="New hunt">&#8635;</button>';
      bar.classList.add('show');
      const hh=document.getElementById('huntHelp'); if(hh) hh.onclick=huntHelp;
      const rb=document.getElementById('lvlRetry'); if(rb) rb.onclick=()=>reset();
      const mb=document.getElementById('lvlMenu'); if(mb) mb.onclick=openMenu;
      if(!was) fit();
      return;
    }
    if(mode!=='level'&&mode!=='climb'){ if(was){ bar.classList.remove('show'); bar.innerHTML=''; fit(); } return; }
    const left=Math.max(0,deal.length-launched);
    const allDone=targets.length>0 && targets.every(x=>x.done);
    const noTiles=!current && queue.every(q=>!q);     // nothing left to launch
    const stuck=noTiles && !allDone;
    const lbl=mode==='climb'?('Climb '+(climbStage+1)+'/3'):('Lv '+level);
    const chips=targets.map(t=>'<span class="lchip'+(t.done?' done':'')+'">'+t.w+'</span>').join('');
    bar.innerHTML='<button class="lmenu" id="lvlMenu" title="Game modes">&#9776;</button>'+
      '<span class="lvl">'+lbl+'</span>'+chips+
      '<span class="ltiles'+(stuck?' out':'')+'" title="tiles left">'+left+'●</span>'+
      '<button class="lretry'+(stuck?' urge':'')+'" id="lvlRetry" title="Retry this '+(mode==='climb'?'stage':'level')+'">&#8635;</button>';
    bar.classList.add('show');
    const rb=document.getElementById('lvlRetry'); if(rb) rb.onclick=()=>reset();
    const mb=document.getElementById('lvlMenu'); if(mb) mb.onclick=openMenu;
    if(stuck) msg('Out of tiles — trace a word on the board, or tap &#8635; to retry.');
    if(!was) fit();   // bar appeared → the stage got shorter, refit the canvas
  }
  function levelComplete(){
    sfx('over'); setTimeout(()=>sfx('coin'),200);
    if(window.LL_Store) window.LL_Store.addCoins(10);     // reward → spendable in the store
    const cleared=level, last=cleared>=LEVELS().length;
    level=last?1:level+1; LS.set('level',level);
    const lo=document.getElementById('levelover');
    if(!lo){ reset(); return; }
    document.getElementById('levelTitle').textContent=last?('All '+LEVELS().length+' Levels Cleared! 🎉'):('Level '+cleared+' Cleared!');
    document.getElementById('levelNum').textContent=cleared;
    document.getElementById('levelSub').textContent=last?'You beat them all — looping to 1. More coming!':('Score '+score+'  •  +10 🪙');
    document.getElementById('levelNext').textContent=last?'Play Again':'Next Level →';
    lo.classList.add('show'); syncMode();
  }
  function climbAdvance(){
    const cleared=climbStage+1;
    if(climbStage<CLIMB_STAGES.length-1){
      climbStage++; sfx('streakUp',2);
      const lo=document.getElementById('levelover');
      if(!lo){ reset(); return; }
      document.getElementById('levelTitle').textContent='Stage '+cleared+' of 3 cleared!';
      document.getElementById('levelNum').textContent=cleared;
      document.getElementById('levelSub').textContent='Score '+score+' — keep climbing!';
      document.getElementById('levelNext').textContent='Next Stage →';
      lo.classList.add('show');
    } else climbComplete();
  }
  function climbComplete(){
    const dk=todayKey(), earned=Math.floor(score/COIN_RATE);
    best=Math.max(best,score); LS.set('best',best);
    coins = window.LL_Store ? window.LL_Store.addCoins(earned) : (coins+earned);
    if(!window.LL_Store) LS.set('coins',coins);
    const dayStreak=bumpStreak();
    const climbBest=Math.max(LS.get('climb.'+dk,0),score); LS.set('climb.'+dk,climbBest);
    const sorted=playedWords.slice().sort((a,b)=>b.length-a.length), haiku=haikuText();
    lastResult={mode:'daily',dayKey:dk,score,best,maxStreak,longestWord:sorted[0]||'',words:sorted,wordCount:playedWords.length,coins:earned,haiku,dayStreak};
    const ot=document.getElementById('overTitle'); if(ot) ot.textContent='Daily Climb Cleared! 🎉';
    document.getElementById('finalScore').textContent=score;
    document.getElementById('coinsLine').innerHTML='&#9679; +'+earned+' coins  (total '+coins+')';
    document.getElementById('bestLine').textContent='Daily '+prettyDate(dk)+' best: '+climbBest;
    const streakEl=document.getElementById('streakLine');
    if(streakEl){ streakEl.textContent='🔥 '+dayStreak+'-day streak'+(dayStreak>=2?'!':''); streakEl.classList.toggle('show',dayStreak>=1); }
    showHaiku(haiku);
    document.getElementById('over').classList.add('show');
    sfx('over'); if(earned>0)setTimeout(()=>sfx('coin'),320);
    syncMode();
  }

  function endGame(){
    gameOver=true;
    { const ot=document.getElementById('overTitle'); if(ot) ot.textContent='Board Full!'; }
    const earned=Math.floor(score/COIN_RATE);
    best=Math.max(best,score); LS.set('best',best);
    coins = window.LL_Store ? window.LL_Store.addCoins(earned) : (coins+earned);
    if(!window.LL_Store) LS.set('coins',coins);
    const dk=todayKey();
    let dailyBest=score, dayStreak=0;
    if(mode==='daily'){ dailyBest=Math.max(LS.get('daily.'+dk,0),score); LS.set('daily.'+dk,dailyBest); dayStreak=bumpStreak(); }
    const haiku=haikuText();
    const sorted=playedWords.slice().sort((a,b)=>b.length-a.length);
    lastResult={mode,dayKey:dk,score,best,maxStreak,longestWord:sorted[0]||'',words:sorted,wordCount:playedWords.length,coins:earned,haiku,dayStreak};
    document.getElementById('finalScore').textContent=score;
    document.getElementById('coinsLine').innerHTML='&#9679; +'+earned+' coins  (total '+coins+')';
    document.getElementById('bestLine').textContent=(mode==='daily'?('Daily '+prettyDate(dk)+' best: '+dailyBest):('Best: '+best));
    const streakEl=document.getElementById('streakLine');
    if(streakEl){ const show=mode==='daily'&&dayStreak>=1; streakEl.textContent=show?('🔥 '+dayStreak+'-day streak'+(dayStreak>=2?'!':'')):''; streakEl.classList.toggle('show',show); }
    showHaiku(haiku);
    document.getElementById('over').classList.add('show');
    sfx('over'); if(earned>0)setTimeout(()=>sfx('coin'),320);
    syncMode();   // refresh the pill's streak badge
  }

  // ---- HAIKU INTEGRATION POINT ----
  // Wire your engine by defining window.makeHaiku(seedWords) => string | {lines:[a,b,c]}.
  // It receives the run's cleared words (longest first). Return null/undefined to hide the card.
  function haikuText(){
    if(typeof window.makeHaiku!=='function' || playedWords.length===0) return '';
    let out; try{ out=window.makeHaiku(playedWords.slice().sort((a,b)=>b.length-a.length)); }catch(e){ out=null; }
    if(!out) return '';
    return Array.isArray(out.lines)?out.lines.join('\n'):(typeof out==='string'?out:'');
  }
  function showHaiku(text){
    const el=document.getElementById('haiku'); el.classList.remove('show'); el.textContent='';
    if(!text) return;
    el.textContent=text; el.classList.add('show');
  }

  // ---- input ----
  function pos(e){const r=cv.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)/r.width*W,y:(t.clientY-r.top)/r.height*H};}
  function cellAt(p){if(p.x<GX0||p.x>GX0+GRID_W||p.y<BOARD_TOP)return null;const c=Math.floor((p.x-GX0)/CELL),r=Math.floor((p.y-BOARD_TOP)/CELL);if(r<0||r>=ROWS||c<0||c>=COLS||!grid[r][c])return null;return{r,c};}
  function down(e){
    if(window.LL_Audio)window.LL_Audio.resume();   // unlock audio on first gesture
    if(gameOver||paused)return;e.preventDefault();const p=pos(e);
    const cell=cellAt(p);
    if(tool){ if(cell) applyTool(cell); else cancelTool(); return; }   // power-up targeting
    // pressing a tile starts a gesture; we wait until release/move to know if it's
    // a tap (click-to-spell) or a drag (trace), so a tap can extend the current word.
    if(cell){ if(grid[cell.r][cell.c].l){tracing=true;dragMoved=false;gestureStart=cell;} return; }  // tile→spell, blocker→ignore
    if(!ball&&!drop&&current){aiming=true;aim={sx:p.x,sy:p.y,cx:p.x,cy:p.y,path:[]};}
  }
  function move(e){
    if(gameOver||paused)return;const p=pos(e);
    if(aiming){e.preventDefault();aim.cx=p.x;aim.cy=p.y;(aim.path||(aim.path=[])).push({x:p.x,y:p.y});if(aim.path.length>5)aim.path.shift();}
    else if(tracing){e.preventDefault();const cell=cellAt(p);if(!cell||!grid[cell.r][cell.c].l)return;
      if(!dragMoved){                                   // crossed into a letter tile → this gesture is a drag
        if(cell.r===gestureStart.r&&cell.c===gestureStart.c)return;
        dragMoved=true;
        if(chain.length===0) chain=[gestureStart];      // fresh trace
        else{ const i=chain.findIndex(q=>q.r===gestureStart.r&&q.c===gestureStart.c);
          if(i>=0) chain.length=i+1;                    // continue from the pressed (already-picked) tile
          else if(adjacent(chain[chain.length-1],gestureStart)) chain.push(gestureStart);  // extend, don't wipe taps
          else chain=[gestureStart]; }
        liveChip();
      }
      if(chain.length>=2){const prev=chain[chain.length-2];if(cell.r===prev.r&&cell.c===prev.c){chain.pop();liveChip();return;}}
      const last=chain[chain.length-1];if(!inChain(cell.r,cell.c)&&adjacent(last,cell)){chain.push(cell);liveChip();}
    }
  }
  function up(){
    if(gameOver||paused)return;
    if(aiming){aiming=false;const v=dragVec();   // dragVec uses aimPoint() — same point the preview drew
      if(v.d>14){launch(v.x*POWER,v.y*POWER);chain=[];hideChip();}
    }
    else if(tracing){tracing=false;
      if(dragMoved) submitWord();        // a drag-trace submits on release (unchanged feel)
      else tapCell(gestureStart);        // a stationary press = a tap → toggle that tile into the word
    }
  }
  cv.addEventListener('mousedown',down);cv.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
  cv.addEventListener('touchstart',down,{passive:false});cv.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',up);
  document.getElementById('again').onclick=()=>{ if(mode==='climb')climbStage=0; reset(); };
  document.getElementById('restart').onclick=reset;
  { const ln=document.getElementById('levelNext'); if(ln) ln.onclick=reset; }
  const helpEl=document.getElementById('help');
  document.getElementById('helpBtn').onclick=()=>helpEl.classList.add('show');
  document.getElementById('helpClose').onclick=()=>helpEl.classList.remove('show');

  // ---- game-mode menu (home screen + always-available switcher) ----
  const modeBtn=document.getElementById('modeBtn');
  const menuEl=document.getElementById('menu');
  const MODE_NAME={level:'Levels',climb:'Climb',daily:'Daily',free:'Free',hunt:'Hunt'};
  function syncMode(){ if(!modeBtn)return;
    let s=''; if(mode==='daily'||mode==='climb'){ const c=currentStreak(); if(c>=1)s='  🔥'+c; }
    modeBtn.innerHTML='&#9776; '+(MODE_NAME[mode]||'Play')+s; }
  function modeAvailable(m){ if(m==='level')return !!LEVELS().length; if(m==='climb'||m==='hunt')return !!window.LL_WORDPOOL; return true; }
  function openMenu(){
    paused=true; aiming=false; tracing=false;
    // the menu lives inside #stage, so it can't cover the result overlays or the
    // (sibling) level bar — dismiss them so the menu is the only thing showing.
    document.getElementById('over').classList.remove('show');
    const lo=document.getElementById('levelover'); if(lo) lo.classList.remove('show');
    const lb=document.getElementById('levelbar'); if(lb && lb.classList.contains('show')){ lb.classList.remove('show'); fit(); }
    const lv=document.getElementById('mcLevel'); if(lv) lv.textContent='Level '+level;
    const cs=currentStreak(), fire=cs>=1?('🔥'+cs):'';
    const mc=document.getElementById('mcClimb'); if(mc) mc.textContent=fire;
    const md=document.getElementById('mcDaily'); if(md) md.textContent=fire;
    if(menuEl) menuEl.classList.add('show');
    updateItemBar();
  }
  function closeMenu(){ if(menuEl) menuEl.classList.remove('show'); paused=false; }
  function startMode(m){
    if(!modeAvailable(m)) m='free';
    mode=m; LS.set('mode',mode);
    if(mode==='climb') climbStage=0;
    closeMenu(); reset();
  }
  if(modeBtn) modeBtn.onclick=openMenu;
  if(menuEl){
    [].forEach.call(menuEl.querySelectorAll('.modecard'),c=>{ c.onclick=()=>startMode(c.getAttribute('data-mode')); });
    const ms=document.getElementById('menuStore'); if(ms) ms.onclick=()=>{ if(window.LL_Store) window.LL_Store.open(); };
    const mh=document.getElementById('menuHelp'); if(mh) mh.onclick=()=>document.getElementById('help').classList.add('show');
  }

  // ---- mute toggle ----
  const muteBtn=document.getElementById('muteBtn');
  function syncMute(){ if(!muteBtn)return; const m=window.LL_Audio?window.LL_Audio.isMuted():false; muteBtn.textContent=m?'🔇':'🔊'; }
  if(muteBtn){ muteBtn.onclick=()=>{ if(window.LL_Audio)window.LL_Audio.toggle(); syncMute(); }; syncMute(); }

  // ---- power-up item bar (Shuffle / Swap / Bomb; coins spent per use) ----
  // Declared before the store's setOnChange (which fires syncCoins→updateItemBar immediately).
  const itemBar=document.getElementById('itembar');
  const itemBtns={shuffle:document.getElementById('itShuffle'),swap:document.getElementById('itSwap'),bomb:document.getElementById('itBomb')};
  function flashItem(kind){ const b=itemBtns[kind]; if(b){ b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); } }
  function updateItemBar(){
    if(!itemBar) return;
    const playing = !paused && !gameOver;
    itemBar.classList.toggle('show', playing);
    if(!playing) return;
    const c=playerCoins();
    for(const k in itemBtns){ const b=itemBtns[k]; if(!b)continue;
      b.classList.toggle('afford', c>=ITEMS[k].cost);
      b.classList.toggle('armed', (k==='swap'&&tool==='swap')||(k==='bomb'&&tool==='bomb'));
    }
  }
  for(const k in itemBtns){ const b=itemBtns[k]; if(b) b.onclick=()=>{ if(tool===k){ cancelTool(); } else useItem(k); }; }

  // ---- store (cosmetics; window.LL_Store) ----
  const storeBtn=document.getElementById('storeBtn');
  function syncCoins(c){ if(storeBtn) storeBtn.textContent='🪙 '+(c!=null?c:(window.LL_Store?window.LL_Store.coins():coins)); updateItemBar(); }
  if(storeBtn) storeBtn.onclick=()=>{ if(window.LL_Store) window.LL_Store.open(); };
  if(window.LL_Store) window.LL_Store.setOnChange(syncCoins);
  syncCoins();

  // ---- share ----
  const shareBtn=document.getElementById('shareBtn'), shareStatusEl=document.getElementById('shareStatus');
  function shareStatus(t){ if(shareStatusEl){ shareStatusEl.textContent=t; shareStatusEl.classList.add('show'); setTimeout(()=>shareStatusEl.classList.remove('show'),2000); } }
  if(shareBtn) shareBtn.onclick=async()=>{
    if(!lastResult||!window.LL_Share)return;
    shareBtn.disabled=true;
    const res=await window.LL_Share.share(lastResult);
    if(res.method==='clipboard') shareStatus('Copied to clipboard!');
    else if(res.method==='none') shareStatus('Sharing not supported');
    shareBtn.disabled=false;
  };

  // ---- trajectory preview ----
  // Because the field is static, this is an EXACT prediction of the ball's path.
  // Returns the sampled points AND the column the tile will actually settle in
  // (accounting for spill to the nearest open column when the aimed one is full),
  // so the player can aim by sight.
  function previewPts(){
    const v=dragVec();const pts=[];let x=ANCHOR.x,y=ANCHOR.y,vx=v.x*POWER,vy=v.y*POWER;
    let col=-1;
    // simulate the SAME horizon the real ball gets (incl. the failsafe force-settle),
    // so the predicted column never blinks out for long, bouncy aims.
    for(let i=0;i<MAX_BALL_FRAMES;i++){
      vy+=GRAV;x+=vx;y+=vy;
      if(x<BALL_R){x=BALL_R;vx*=-0.7;}if(x>W-BALL_R){x=W-BALL_R;vx*=-0.7;}if(y<BALL_R){y=BALL_R;vy*=-0.5;}
      for(const b of BUMPERS){const dx=x-b.x,dy=y-b.y,dd=Math.hypot(dx,dy),mn=BALL_R+b.r;if(dd<mn){const nx=dx/(dd||1),ny=dy/(dd||1);x=b.x+nx*mn;y=b.y+ny*mn;const dot=vx*nx+vy*ny,k=REST[b.kind]||0.86;vx=(vx-2*dot*nx)*k;vy=(vy-2*dot*ny)*k;}}
      if(i%2===0 && pts.length<120) pts.push({x,y});   // keep the visible trail tidy
      if(vy>0&&y+BALL_R>=BOARD_TOP){ col=Math.floor((x-GX0)/CELL); break; }
    }
    if(col<0) col=Math.floor((x-GX0)/CELL);             // failsafe: settle at current x (mirrors settleBall)
    col=Math.max(0,Math.min(COLS-1,col));
    if(lowestEmpty(col)<0) col=nearestOpenCol(col);     // spill to nearest open column
    return {pts,col};
  }

  // ---- render ----
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function drawTile(cx,cy,letter,size,sel,pop,bonus){
    const T=skin().tile;
    const s=size*(pop?1+0.18*pop:1);ctx.save();ctx.translate(cx,cy);
    ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    const g=ctx.createLinearGradient(0,-s/2,0,s/2);g.addColorStop(0,T.hi);g.addColorStop(1,T.lo);
    ctx.fillStyle=g;roundRect(-s/2,-s/2,s,s,10);ctx.fill();ctx.shadowColor='transparent';
    ctx.fillStyle=T.edge;roundRect(-s/2,s/2-5,s,5,3);ctx.fill();
    if(bonus){ctx.strokeStyle='#ffcf4d';ctx.lineWidth=3;roundRect(-s/2+2,-s/2+2,s-4,s-4,9);ctx.stroke();}
    if(sel){ctx.strokeStyle='#5bc47e';ctx.lineWidth=4;roundRect(-s/2,-s/2,s,s,10);ctx.stroke();}
    ctx.fillStyle=T.ink;ctx.font='900 '+(s*0.56)+'px Fraunces,Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(letter,0,2);
    const val=VALUES[letter.toLowerCase()]||1;
    ctx.font='700 '+(s*0.18)+'px Bricolage Grotesque,sans-serif';ctx.fillStyle=bonus?'#c8860f':hexA(T.ink,0.55);ctx.textAlign='right';ctx.fillText(bonus?(val*PAD_MULT):val,s/2-7,s/2-8);
    ctx.restore();
  }
  function drawBlocker(cx,cy,size,pop){
    const s=size*(pop?1+0.18*pop:1);ctx.save();ctx.translate(cx,cy);
    ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    const g=ctx.createLinearGradient(0,-s/2,0,s/2);g.addColorStop(0,'#2c313a');g.addColorStop(1,'#11141a');
    ctx.fillStyle=g;roundRect(-s/2,-s/2,s,s,10);ctx.fill();ctx.shadowColor='transparent';
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=2;roundRect(-s/2+3,-s/2+3,s-6,s-6,8);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.22)';ctx.font='900 '+(s*0.4)+'px Bricolage Grotesque,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✕',0,1);
    ctx.restore();
  }
  function drawBumper(b){
    ctx.save();ctx.translate(b.x,b.y);
    const lift=(b.flash>0)?b.flash:0;
    if(b.kind==='charger'){
      ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(0,3,b.r,0,7);ctx.fill();
      const g=ctx.createRadialGradient(-b.r*.3,-b.r*.3,1,0,0,b.r);
      g.addColorStop(0, lift>0?'#fffcea':'#ffd95e');g.addColorStop(1,'#c8860f');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,b.r,0,7);ctx.fill();
      ctx.strokeStyle='rgba(255,250,220,'+(0.6+0.4*lift)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,b.r-3,0,7);ctx.stroke();
      ctx.fillStyle='#5a3c06';ctx.font='900 '+(b.r*1.1)+'px Bricolage Grotesque,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('★',0,1);
    } else if(b.kind==='bouncer'){
      ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(0,3,b.r,0,7);ctx.fill();
      const g=ctx.createRadialGradient(-b.r*.3,-b.r*.3,1,0,0,b.r);
      g.addColorStop(0, lift>0?'#fff4d8':'#f0b755');g.addColorStop(1,'#b9781e');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,b.r,0,7);ctx.fill();
      ctx.strokeStyle='rgba(255,240,200,'+(0.5+0.5*lift)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,b.r-3,0,7);ctx.stroke();
    } else {
      ctx.fillStyle='#11463c';ctx.beginPath();ctx.arc(0,3,b.r,0,7);ctx.fill();
      const g=ctx.createRadialGradient(-b.r*.3,-b.r*.3,1,0,0,b.r);
      g.addColorStop(0, lift>0?'#bff0e2':'#3a7d6d');g.addColorStop(1,'#1c5448');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,b.r,0,7);ctx.fill();
    }
    ctx.restore();
  }
  function render(){
    let sx=0,sy=0;if(shake>0){sx=(Math.random()-.5)*shake;sy=(Math.random()-.5)*shake;}
    const prev=(aiming && dragVec().d>14)?previewPts():null;   // exact, once per frame
    aimCol=prev?prev.col:-1;
    ctx.save();ctx.translate(sx,sy);ctx.clearRect(-20,-20,W+40,H+40);
    ctx.fillStyle=skin().felt.board;roundRect(0,0,W,H,16);ctx.fill();

    ctx.fillStyle='rgba(0,0,0,.18)';roundRect(GX0-4,BOARD_TOP-6,GRID_W+8,ROWS*CELL+12,16);ctx.fill();
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){ctx.fillStyle='rgba(0,0,0,.16)';roundRect(GX0+c*CELL+6,BOARD_TOP+r*CELL+6,CELL-12,CELL-12,9);ctx.fill();}
    // predicted-landing column highlight: a glowing drop zone so aiming is by sight
    if(aimCol>=0){
      const hx=GX0+aimCol*CELL, fxc=skin().fx?skin().fx.color:'#5bc47e';
      const tr=lowestEmpty(aimCol); const ty=tr>=0?cellY(tr)-CELL/2:BOARD_TOP;
      ctx.fillStyle=hexA(fxc,0.14);roundRect(hx+3,BOARD_TOP-2,CELL-6,ROWS*CELL+4,10);ctx.fill();
      ctx.fillStyle=hexA(fxc,0.22);roundRect(hx+3,ty+2,CELL-6,Math.max(0,cellY(ROWS-1)+CELL/2-ty-2),10);ctx.fill();
      ctx.strokeStyle=hexA(fxc,0.55);ctx.lineWidth=2;roundRect(hx+3,BOARD_TOP-2,CELL-6,ROWS*CELL+4,10);ctx.stroke();
    }
    ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(14,BOARD_TOP);ctx.lineTo(W-14,BOARD_TOP);ctx.stroke();

    for(const b of BUMPERS) drawBumper(b);

    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=grid[r][c];if(t){if(t.pop>0)t.pop-=0.12;
      if(t.blocker) drawBlocker(cellX(c),cellY(r),CELL-14,Math.max(0,t.pop));
      else drawTile(cellX(c),cellY(r),t.l,CELL-14,inChain(r,c),Math.max(0,t.pop),t.bonus);
      if(swapFirst&&swapFirst.r===r&&swapFirst.c===c){ctx.strokeStyle='#7af2c4';ctx.lineWidth=4;roundRect(cellX(c)-(CELL-14)/2,cellY(r)-(CELL-14)/2,CELL-14,CELL-14,10);ctx.stroke();}
    }}
    if(chain.length>1){ctx.strokeStyle='rgba(91,196,126,.9)';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();chain.forEach((p,i)=>{const x=cellX(p.c),y=cellY(p.r);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}

    drawLauncher();

    if(prev){const pts=prev.pts;ctx.fillStyle=skin().trail.color;pts.forEach((p,i)=>{ctx.globalAlpha=0.85-i/pts.length*0.6;ctx.beginPath();ctx.arc(p.x,p.y,3.2,0,7);ctx.fill();});ctx.globalAlpha=1;}

    if(drop)drawTile(cellX(drop.c),drop.y,drop.letter,CELL-14,false,0,drop.bonus);
    if(ball){ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(ball.rot);drawTile(0,0,ball.letter,BALL_R*2,false,0,ball.bonus);ctx.restore();}

    if(streak>=2){
      const rem=Math.max(0,(comboUntil-performance.now())/COMBO_MS);
      const bx=W-104,by=16,bw=88,bh=34;
      ctx.fillStyle='rgba(234,165,59,.95)';roundRect(bx,by,bw,bh,9);ctx.fill();
      ctx.fillStyle='#3a2606';ctx.font='900 19px Fraunces,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('STREAK x'+streak,bx+bw/2,by+bh/2-2);
      ctx.fillStyle='rgba(58,38,6,.3)';roundRect(bx+6,by+bh-7,bw-12,3,2);ctx.fill();
      ctx.fillStyle='#3a2606';roundRect(bx+6,by+bh-7,(bw-12)*rem,3,2);ctx.fill();
    }

    particles.forEach(p=>{ctx.globalAlpha=p.life;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,3,0,7);ctx.fill();});ctx.globalAlpha=1;
    floaters.forEach(f=>{ctx.globalAlpha=Math.min(1,f.life*1.4);ctx.fillStyle=f.col||'#5bc47e';ctx.font='900 24px Fraunces,serif';ctx.textAlign='center';ctx.fillText(f.txt,f.x,f.y);});ctx.globalAlpha=1;
    ctx.restore();
  }
  function drawLauncher(){
    const a=ANCHOR, Lk=skin().launcher;
    ctx.fillStyle=Lk.woodD;roundRect(a.x-30,a.y-40,60,14,5);ctx.fill();
    ctx.strokeStyle=Lk.wood;ctx.lineWidth=8;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(a.x-22,a.y-30);ctx.lineTo(a.x-12,a.y-2);ctx.moveTo(a.x+22,a.y-30);ctx.lineTo(a.x+12,a.y-2);ctx.stroke();
    if(aiming){const v=dragVec();if(v.d>14){const ang=Math.atan2(v.y,v.x);ctx.strokeStyle=hexA(Lk.accent,.9);ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x+Math.cos(ang)*40,a.y+Math.sin(ang)*40);ctx.stroke();}}
    if(!ball&&!drop&&!gameOver&&current) drawTile(a.x,a.y,current,42,false,0);
  }

  // ---- loop ----
  function loop(){updateBumpers();if(!paused){step();stepDrop();}stepFx();render();requestAnimationFrame(loop);}
  reset(); openMenu(); updateBumpers(); fit(); loop();
})();
