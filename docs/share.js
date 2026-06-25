/* Letter Launch — share card
 * Builds a portrait PNG (the viral artifact) + a text summary, then shares via the
 * Web Share API (with image when supported), falling back to clipboard.
 * Exposes window.LL_Share: share(result), buildImage(result), buildText(result).
 *
 * result = { mode, dayKey, score, best, maxStreak, longestWord, words, wordCount, coins, haiku }
 * Loaded before game.js.
 */
(()=>{
  'use strict';
  const SHARE_URL='https://stephenuffugus.github.io/letter_launch/';   // deployed URL (appended to shared text + card footer)
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const fmt=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  function prettyDate(key){ if(!key) return ''; const p=key.split('-'); return MONTHS[(+p[1])-1]+' '+(+p[2]); }

  function buildText(r){
    const lines=[];
    lines.push('Letter Launch'+(r.mode==='daily'?' — Daily '+prettyDate(r.dayKey):''));
    if(r.mode==='daily'&&r.dayStreak>=2) lines.push('🔥 '+r.dayStreak+'-day streak');
    lines.push('Score '+fmt(r.score)+(r.maxStreak>=2?'   🔥 x'+r.maxStreak:''));
    if(r.longestWord) lines.push('Best word: '+r.longestWord.toUpperCase());
    if(r.wordCount) lines.push(r.wordCount+' word'+(r.wordCount===1?'':'s')+' cleared');
    if(r.haiku) lines.push('\n'+r.haiku);
    if(SHARE_URL) lines.push('\n'+SHARE_URL);
    return lines.join('\n');
  }

  // ---- image card ----
  function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}

  function drawTileRow(c,word,cx,cy,size,gap){
    const n=word.length, total=n*size+(n-1)*gap, x0=cx-total/2;
    for(let i=0;i<n;i++){
      const x=x0+i*(size+gap);
      c.save(); c.translate(x+size/2,cy);
      c.shadowColor='rgba(0,0,0,.4)'; c.shadowBlur=10; c.shadowOffsetY=4;
      const g=c.createLinearGradient(0,-size/2,0,size/2);
      g.addColorStop(0,'#fffaf0'); g.addColorStop(1,'#f0e2c5');
      c.fillStyle=g; roundRect(c,-size/2,-size/2,size,size,12); c.fill();
      c.shadowColor='transparent';
      c.fillStyle='rgba(205,180,136,.9)'; roundRect(c,-size/2,size/2-7,size,7,4); c.fill();
      c.fillStyle='#2c2417'; c.font='900 '+(size*0.6)+'px Fraunces, Georgia, serif';
      c.textAlign='center'; c.textBaseline='middle';
      c.fillText(word[i].toUpperCase(),0,2);
      c.restore();
    }
  }

  function buildImage(r){
    const W=1080,H=1350;
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const c=cv.getContext('2d');
    // felt background
    const bg=c.createRadialGradient(W/2,-80,80,W/2,H*0.4,H);
    bg.addColorStop(0,'#2b554b'); bg.addColorStop(0.5,'#20413a'); bg.addColorStop(1,'#13241f');
    c.fillStyle=bg; c.fillRect(0,0,W,H);

    c.textAlign='center';
    // wordmark
    c.fillStyle='#eaa53b'; c.font='900 92px Fraunces, Georgia, serif';
    c.fillText('LETTER LAUNCH',W/2,180);
    c.fillStyle='rgba(243,234,216,.65)'; c.font='700 38px "Bricolage Grotesque", system-ui, sans-serif';
    let sub=(r.mode==='daily'?'Daily — '+prettyDate(r.dayKey):'Free Play');
    if(r.mode==='daily'&&r.dayStreak>=2) sub+='   ·   🔥 '+r.dayStreak+'-day';
    c.fillText(sub,W/2,240);

    // big score
    c.fillStyle='rgba(243,234,216,.5)'; c.font='700 34px "Bricolage Grotesque", system-ui, sans-serif';
    c.fillText('SCORE',W/2,360);
    c.fillStyle='#fffaf0'; c.font='900 168px Fraunces, Georgia, serif';
    c.fillText(fmt(r.score),W/2,510);

    // streak
    if(r.maxStreak>=2){
      c.fillStyle='#eaa53b'; c.font='900 56px Fraunces, Georgia, serif';
      c.fillText('🔥 STREAK x'+r.maxStreak,W/2,610);
    }

    // best word as tiles
    let y=720;
    if(r.longestWord){
      c.fillStyle='rgba(243,234,216,.5)'; c.font='700 32px "Bricolage Grotesque", system-ui, sans-serif';
      c.fillText('BEST WORD',W/2,y); y+=70;
      const word=r.longestWord.toUpperCase();
      const size=Math.min(120, Math.floor((W-120)/Math.max(word.length,1))-14);
      drawTileRow(c,word,W/2,y+size/2,size,14); y+=size+50;
    }

    // word count
    if(r.wordCount){
      c.fillStyle='rgba(243,234,216,.8)'; c.font='600 40px "Bricolage Grotesque", system-ui, sans-serif';
      c.fillText(r.wordCount+' word'+(r.wordCount===1?'':'s')+' cleared',W/2,y+10); y+=70;
    }

    // haiku
    if(r.haiku){
      c.fillStyle='rgba(243,231,207,.92)'; c.font='italic 600 44px Fraunces, Georgia, serif';
      const hlines=String(r.haiku).split('\n');
      let hy=Math.max(y+40,H-300);
      for(const ln of hlines){ c.fillText(ln,W/2,hy); hy+=64; }
    }

    // footer
    c.fillStyle='rgba(243,234,216,.4)'; c.font='700 32px "Bricolage Grotesque", system-ui, sans-serif';
    c.fillText(SHARE_URL||'play Letter Launch',W/2,H-60);
    return cv;
  }

  async function share(r){
    const text=buildText(r);
    // make sure fonts are ready so the card renders correctly
    try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; }catch(e){}
    let canvas=null,file=null;
    try{
      canvas=buildImage(r);
      const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
      if(blob) file=new File([blob],'letter-launch.png',{type:'image/png'});
    }catch(e){}

    if(file && navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file],text}); return {ok:true,method:'file'}; }
      catch(e){ if(e&&e.name==='AbortError') return {ok:false,method:'abort'}; }
    }
    if(navigator.share){
      try{ await navigator.share({text}); return {ok:true,method:'text'}; }
      catch(e){ if(e&&e.name==='AbortError') return {ok:false,method:'abort'}; }
    }
    try{ await navigator.clipboard.writeText(text); return {ok:true,method:'clipboard'}; }catch(e){}
    return {ok:false,method:'none',text,canvas};
  }

  window.LL_Share={ share, buildImage, buildText };
})();
