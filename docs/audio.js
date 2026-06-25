/* Letter Launch — sound (Web Audio, fully synthesized; no asset files)
 * Lazy-creates an AudioContext on the first user gesture (autoplay policy).
 * Exposes window.LL_Audio: play(name,...args), resume(), toggle(), setMuted(), isMuted().
 * Loaded before game.js.
 */
(()=>{
  'use strict';
  let ctx=null, master=null, muted=false;
  try{ muted=JSON.parse(localStorage.getItem('letterlaunch.muted')
        ?? localStorage.getItem('slingspell.muted') ?? 'false'); }catch(e){}

  function ensure(){
    if(ctx) return ctx;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return null;
    ctx=new AC();
    master=ctx.createGain(); master.gain.value=0.5; master.connect(ctx.destination);
    return ctx;
  }
  function resume(){ const c=ensure(); if(c&&c.state==='suspended') c.resume(); }

  // one oscillator note, optional glide
  function tone(freq,start,dur,type,gain,glideTo){
    const c=ensure(); if(!c||muted) return;
    const t0=c.currentTime+start;
    const o=c.createOscillator(), g=c.createGain();
    o.type=type||'sine';
    o.frequency.setValueAtTime(freq,t0);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20,glideTo),t0+dur);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(gain||0.2,t0+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0+dur+0.02);
  }
  // short filtered-noise burst (impacts)
  function noise(start,dur,gain,lpFreq){
    const c=ensure(); if(!c||muted) return;
    const t0=c.currentTime+start;
    const n=Math.max(1,Math.floor(c.sampleRate*dur));
    const buf=c.createBuffer(1,n,c.sampleRate); const d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    const src=c.createBufferSource(); src.buffer=buf;
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=lpFreq||1200;
    const g=c.createGain(); g.gain.setValueAtTime(gain||0.2,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    src.connect(lp); lp.connect(g); g.connect(master); src.start(t0); src.stop(t0+dur);
  }

  const PENT=[0,2,4,7,9,12,14,16,19,21];        // major-pentatonic semitone offsets
  const midi=n=>440*Math.pow(2,(n-69)/12);

  const SFX={
    peg(){ tone(420+Math.random()*60,0,0.07,'triangle',0.10); },
    bouncer(){ tone(540,0,0.11,'triangle',0.15,940); },
    wall(){ noise(0,0.05,0.07,600); },
    lock(){ tone(180,0,0.09,'square',0.14,120); noise(0,0.04,0.05,420); },
    bad(){ tone(200,0,0.20,'sawtooth',0.13,110); },
    streakUp(level){ const base=74+Math.min((level||1),8); [0,4,7].forEach((s,i)=>tone(midi(base+s),i*0.045,0.16,'triangle',0.10)); },
    over(){ [0,-3,-7].forEach((s,i)=>tone(midi(64+s),i*0.14,0.5,'sine',0.16)); },
    coin(){ tone(midi(84),0,0.08,'square',0.11); tone(midi(91),0.06,0.13,'square',0.11); },
    // valid word: ascending arpeggio; longer word = more notes, higher streak = higher pitch
    word(len,streak){
      const notes=Math.max(3,Math.min(len||3,8));
      const base=60+Math.min((streak||1)-1,6)*2;
      for(let i=0;i<notes;i++){
        const s=PENT[i%PENT.length]+12*Math.floor(i/PENT.length);
        tone(midi(base+s),i*0.06,0.22,'triangle',0.13);
      }
    }
  };

  function play(name,...args){ if(muted) return; const f=SFX[name]; if(f) f(...args); }
  function setMuted(m){ muted=!!m; try{ localStorage.setItem('letterlaunch.muted',JSON.stringify(muted)); }catch(e){} }
  function toggle(){ setMuted(!muted); if(!muted) resume(); return muted; }

  window.LL_Audio={ play, resume, toggle, setMuted, isMuted:()=>muted };
})();
