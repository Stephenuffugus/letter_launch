/* Letter Launch — seeded RNG utilities
 * Lets the daily challenge hand everyone the same letter stream from a date seed,
 * while free play keeps using Math.random. Loaded before game.js.
 */
(()=>{
  'use strict';
  // mulberry32 — tiny, fast, deterministic 32-bit PRNG. Returns [0,1).
  function mulberry32(a){
    return function(){
      a|=0; a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15, 1|a);
      t=t+Math.imul(t^t>>>7, 61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296;
    };
  }
  // FNV-1a string hash -> 32-bit seed
  function hashStr(s){
    let h=2166136261>>>0;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  }
  // local-time YYYY-MM-DD (the day everyone shares)
  function dayKey(d){
    d=d||new Date();
    const y=d.getFullYear(),
          m=String(d.getMonth()+1).padStart(2,'0'),
          da=String(d.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+da;
  }
  window.LL_RNG={
    mulberry32, hashStr, dayKey,
    seeded:(seedStr)=>mulberry32(hashStr(String(seedStr)))
  };
})();
