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

  // Restitution (bounciness) by bumper kind. >1 adds energy.
  // 'charger' uses identical physics to 'bouncer' (so reachability is unchanged);
  // it only flags the tile gold (2x letter value). See sim.js.
  const REST={ peg:0.86, bouncer:1.08, charger:1.08 };
  const PAD_MULT=2;                   // gold charged tile: letter value multiplier

  /* Bumper layout.
   *   bx,by : base position    r : radius    kind : 'peg' | 'bouncer'
   *   move  : optional { axis:'x'|'y', amp:px, speed:rad-per-ms, phase:rad }
   * NOTE: keep bumpers off column centers (cols are 72 wide; centers at GX0+c*72+36)
   * and leave a clear gap above BOARD_TOP so every column stays reachable.
   * Run the included sim (see README) after changing this. */
  const BUMPERS=[
    {bx:100, by:146, r:12, kind:'peg'},
    {bx:244, by:146, r:12, kind:'peg'},
    {bx:388, by:146, r:12, kind:'peg'},
    {bx:172, by:210, r:12, kind:'bouncer'},
    {bx:316, by:210, r:12, kind:'charger'},
    {bx:460, by:210, r:12, kind:'bouncer'},
    {bx:280, by:110, r:13, kind:'bouncer', move:{axis:'x', amp:120, speed:0.0018, phase:0}},
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
  let mode=LS.get('mode','free');                 // 'free' | 'daily'
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
  const DEFAULT_SKIN={tile:{hi:'#fffaf0',lo:'#f0e2c5',edge:'#cdb488',ink:'#2c2417'},felt:{board:'#1d3b34'},launcher:{wood:'#7c5024',woodD:'#5a3917',accent:'#eaa53b'},trail:{color:'#ffffff'}};
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
  let aiming=false, aim={sx:0,sy:0,cx:0,cy:0};
  let tracing=false, chain=[]; let shake=0;
  let streak=0, comboUntil=0, maxStreak=0;
  let playedWords=[];               // every valid word cleared (for the haiku card)
  let lastResult=null;              // snapshot for the share card (built on game over)

  const cellX=c=>GX0+c*CELL+CELL/2, cellY=r=>BOARD_TOP+r*CELL+CELL/2;
  function newGrid(){grid=[];for(let r=0;r<ROWS;r++)grid.push(new Array(COLS).fill(null));}
  function reset(){
    setupRng();                     // (re)seed the letter stream for the current mode
    newGrid(); score=0; gameOver=false; ball=null; drop=null; particles=[]; floaters=[]; chain=[]; tracing=false; aiming=false; streak=0; comboUntil=0; maxStreak=0; playedWords=[]; lastResult=null;
    queue=[randLetter(),randLetter(),randLetter()]; current=randLetter();
    document.getElementById('over').classList.remove('show');
    msg(mode==='daily'?('Daily '+prettyDate(todayKey())+' — drag to aim.'):'Drag down to aim, release to drop.');
    updateHUD(); syncMode();
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
  function updateBumpers(now){
    for(const b of BUMPERS){
      if(b.move){const o=Math.sin(now*b.move.speed+(b.move.phase||0))*b.move.amp;
        b.x=b.bx+(b.move.axis==='x'?o:0); b.y=b.by+(b.move.axis==='y'?o:0);}
      else {b.x=b.bx; b.y=b.by;}
      if(b.flash>0) b.flash-=0.08;
    }
  }

  // ---- aim / fire ----
  function dragVec(){let dx=aim.cx-aim.sx,dy=aim.cy-aim.sy,d=Math.hypot(dx,dy);
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
      current=queue.shift();queue.push(randLetter());updateHUD();}
  }

  // ---- words + streak ----
  const adjacent=(a,b)=>Math.abs(a.r-b.r)<=1&&Math.abs(a.c-b.c)<=1&&!(a.r===b.r&&a.c===b.c);
  const inChain=(r,c)=>chain.some(p=>p.r===r&&p.c===c);
  const chainWord=()=>chain.map(p=>grid[p.r][p.c].l).join('');
  function submitWord(){
    const w=chainWord();
    if(w.length>=MIN_WORD && DICT.has(w.toLowerCase())){
      const now=performance.now();
      streak=(now<comboUntil)?Math.min(streak+1,MULT_CAP):1; comboUntil=now+COMBO_MS;
      if(streak>maxStreak)maxStreak=streak;
      let base=0;for(const p of chain){const cl=grid[p.r][p.c];base+=(VALUES[cl.l.toLowerCase()]||1)*(cl.bonus?PAD_MULT:1);}
      const gained=base*w.length*streak; score+=gained;
      playedWords.push(w.toLowerCase());
      let cx=0,cy=0;
      for(const p of chain){cx+=cellX(p.c);cy+=cellY(p.r);ping(cellX(p.c),cellY(p.r),'#5bc47e',10);grid[p.r][p.c]=null;}
      floaters.push({x:cx/chain.length,y:cy/chain.length,txt:'+'+gained+(streak>1?'  x'+streak:''),life:1});
      collapse();chip(w,'good');
      sfx('word',w.length,streak); if(streak>=2)sfx('streakUp',streak);
      msg(w.toUpperCase()+' &rarr; +'+gained+(streak>1?' (x'+streak+' streak!)':''));
    } else if(w.length>=MIN_WORD){chip(w,'bad');shake=10;sfx('bad');msg('&ldquo;'+w.toUpperCase()+'&rdquo; isn\u2019t in the list.');}
    chain=[];updateHUD();setTimeout(hideChip,650);
  }
  function collapse(){for(let c=0;c<COLS;c++){const st=[];for(let r=ROWS-1;r>=0;r--)if(grid[r][c])st.push(grid[r][c]);
    for(let r=ROWS-1;r>=0;r--)grid[r][c]=st[ROWS-1-r]||null;}}

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
  function chip(t,cls){chipEl.textContent=t.toUpperCase();chipEl.className='chip '+cls;chipEl.style.display='inline-block';}
  function liveChip(){const w=chainWord();if(w.length){const ok=w.length>=MIN_WORD&&DICT.has(w.toLowerCase());chipEl.textContent=w.toUpperCase();chipEl.className='chip'+(ok?' good':'');chipEl.style.display='inline-block';}else hideChip();}
  const hideChip=()=>chipEl.style.display='none';

  function endGame(){
    gameOver=true;
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
    if(gameOver)return;e.preventDefault();const p=pos(e);
    const cell=cellAt(p);
    if(cell){tracing=true;chain=[cell];liveChip();return;}
    if(!ball&&!drop){aiming=true;aim={sx:p.x,sy:p.y,cx:p.x,cy:p.y};}
  }
  function move(e){
    if(gameOver)return;const p=pos(e);
    if(aiming){e.preventDefault();aim.cx=p.x;aim.cy=p.y;}
    else if(tracing){e.preventDefault();const cell=cellAt(p);if(cell){
      if(chain.length>=2){const prev=chain[chain.length-2];if(cell.r===prev.r&&cell.c===prev.c){chain.pop();liveChip();return;}}
      const last=chain[chain.length-1];if(!inChain(cell.r,cell.c)&&adjacent(last,cell)){chain.push(cell);liveChip();}
    }}
  }
  function up(){
    if(gameOver)return;
    if(aiming){aiming=false;const v=dragVec();if(v.d>14)launch(v.x*POWER,v.y*POWER);}
    else if(tracing){tracing=false;submitWord();}
  }
  cv.addEventListener('mousedown',down);cv.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
  cv.addEventListener('touchstart',down,{passive:false});cv.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',up);
  document.getElementById('again').onclick=reset;
  document.getElementById('restart').onclick=reset;
  const helpEl=document.getElementById('help');
  document.getElementById('helpBtn').onclick=()=>helpEl.classList.add('show');
  document.getElementById('helpClose').onclick=()=>helpEl.classList.remove('show');

  // ---- mode toggle (Daily / Free) ----
  const modeBtn=document.getElementById('modeBtn');
  function syncMode(){ if(!modeBtn)return; const s=(mode==='daily')?currentStreak():0; modeBtn.textContent=(mode==='daily'?('Daily'+(s>=1?'  🔥'+s:'')):'Free'); }
  if(modeBtn) modeBtn.onclick=()=>{ mode=(mode==='daily'?'free':'daily'); LS.set('mode',mode); reset(); };

  // ---- mute toggle ----
  const muteBtn=document.getElementById('muteBtn');
  function syncMute(){ if(!muteBtn)return; const m=window.LL_Audio?window.LL_Audio.isMuted():false; muteBtn.textContent=m?'🔇':'🔊'; }
  if(muteBtn){ muteBtn.onclick=()=>{ if(window.LL_Audio)window.LL_Audio.toggle(); syncMute(); }; syncMute(); }

  // ---- store (cosmetics; window.LL_Store) ----
  const storeBtn=document.getElementById('storeBtn');
  function syncCoins(c){ if(storeBtn) storeBtn.textContent='🪙 '+(c!=null?c:(window.LL_Store?window.LL_Store.coins():coins)); }
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

  // ---- trajectory preview (uses current bumper positions) ----
  function previewPts(){
    const v=dragVec();const pts=[];let x=ANCHOR.x,y=ANCHOR.y,vx=v.x*POWER,vy=v.y*POWER;
    for(let i=0;i<120;i++){
      vy+=GRAV;x+=vx;y+=vy;
      if(x<BALL_R){x=BALL_R;vx*=-0.7;}if(x>W-BALL_R){x=W-BALL_R;vx*=-0.7;}if(y<BALL_R){y=BALL_R;vy*=-0.5;}
      for(const b of BUMPERS){const dx=x-b.x,dy=y-b.y,dd=Math.hypot(dx,dy),mn=BALL_R+b.r;if(dd<mn){const nx=dx/(dd||1),ny=dy/(dd||1);x=b.x+nx*mn;y=b.y+ny*mn;const dot=vx*nx+vy*ny,k=REST[b.kind]||0.86;vx=(vx-2*dot*nx)*k;vy=(vy-2*dot*ny)*k;}}
      if(vy>0&&y+BALL_R>=BOARD_TOP)break;
      if(i%2===0)pts.push({x,y});
    }
    return pts;
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
    if(b.move){ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,b.r+4,0,7);ctx.stroke();}
    ctx.restore();
  }
  function render(){
    let sx=0,sy=0;if(shake>0){sx=(Math.random()-.5)*shake;sy=(Math.random()-.5)*shake;}
    ctx.save();ctx.translate(sx,sy);ctx.clearRect(-20,-20,W+40,H+40);
    ctx.fillStyle=skin().felt.board;roundRect(0,0,W,H,16);ctx.fill();

    ctx.fillStyle='rgba(0,0,0,.18)';roundRect(GX0-4,BOARD_TOP-6,GRID_W+8,ROWS*CELL+12,16);ctx.fill();
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){ctx.fillStyle='rgba(0,0,0,.16)';roundRect(GX0+c*CELL+6,BOARD_TOP+r*CELL+6,CELL-12,CELL-12,9);ctx.fill();}
    ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(14,BOARD_TOP);ctx.lineTo(W-14,BOARD_TOP);ctx.stroke();

    for(const b of BUMPERS) drawBumper(b);

    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=grid[r][c];if(t){if(t.pop>0)t.pop-=0.12;drawTile(cellX(c),cellY(r),t.l,CELL-14,inChain(r,c),Math.max(0,t.pop),t.bonus);}}
    if(chain.length>1){ctx.strokeStyle='rgba(91,196,126,.9)';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();chain.forEach((p,i)=>{const x=cellX(p.c),y=cellY(p.r);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}

    drawLauncher();

    if(aiming){const pts=previewPts();ctx.fillStyle=skin().trail.color;pts.forEach((p,i)=>{ctx.globalAlpha=0.8-i/pts.length*0.6;ctx.beginPath();ctx.arc(p.x,p.y,3.2,0,7);ctx.fill();});ctx.globalAlpha=1;}

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
    floaters.forEach(f=>{ctx.globalAlpha=Math.min(1,f.life*1.4);ctx.fillStyle='#5bc47e';ctx.font='900 24px Fraunces,serif';ctx.textAlign='center';ctx.fillText(f.txt,f.x,f.y);});ctx.globalAlpha=1;
    ctx.restore();
  }
  function drawLauncher(){
    const a=ANCHOR, Lk=skin().launcher;
    ctx.fillStyle=Lk.woodD;roundRect(a.x-30,a.y-40,60,14,5);ctx.fill();
    ctx.strokeStyle=Lk.wood;ctx.lineWidth=8;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(a.x-22,a.y-30);ctx.lineTo(a.x-12,a.y-2);ctx.moveTo(a.x+22,a.y-30);ctx.lineTo(a.x+12,a.y-2);ctx.stroke();
    if(aiming){const v=dragVec();if(v.d>14){const ang=Math.atan2(v.y,v.x);ctx.strokeStyle=hexA(Lk.accent,.9);ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x+Math.cos(ang)*40,a.y+Math.sin(ang)*40);ctx.stroke();}}
    if(!ball&&!drop&&!gameOver) drawTile(a.x,a.y,current,42,false,0);
  }

  // ---- loop ----
  function loop(){updateBumpers(performance.now());step();stepDrop();stepFx();render();requestAnimationFrame(loop);}
  reset(); updateBumpers(performance.now()); fit(); loop();
})();
