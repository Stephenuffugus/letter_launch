/* Letter Launch — cosmetic store (window.LL_Store)
 * The coin authority + the cosmetics catalog + owned/equipped state (all in
 * localStorage). Builds its own store overlay UI. game.js reads getStyle() each
 * frame for tile / felt / launcher / trajectory colours, so equipping is instant.
 * Pure cosmetic — never sells power. Loaded before game.js.
 */
(()=>{
  'use strict';
  const NS='letterlaunch.', OLD='slingspell.';
  const LS={
    get(k,d){try{let v=localStorage.getItem(NS+k);if(v==null)v=localStorage.getItem(OLD+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
    set(k,v){try{localStorage.setItem(NS+k,JSON.stringify(v));}catch(e){}}
  };

  // ---- catalog (the first entry of each type is the free default, owned from the start) ----
  const CATALOG={
    tile:[
      {id:'classic',  name:'Classic',  price:0,   hi:'#fffaf0', lo:'#f0e2c5', edge:'#cdb488', ink:'#2c2417'},
      {id:'slate',    name:'Slate',    price:150, hi:'#6b7480', lo:'#434c59', edge:'#2c333d', ink:'#f3f6fa'},
      {id:'bubblegum',name:'Bubblegum',price:200, hi:'#ffe0ef', lo:'#ff9fcb', edge:'#e070a6', ink:'#5e1a39'},
      {id:'gold',     name:'Gold',     price:400, hi:'#fff3c8', lo:'#ecbe55', edge:'#b9831e', ink:'#4a3206'},
    ],
    felt:[
      {id:'forest',  name:'Forest',  price:0,   a:'#2b554b', b:'#20413a', c:'#13241f', board:'#1d3b34'},
      {id:'midnight',name:'Midnight',price:150, a:'#2a4570', b:'#1b2c4d', c:'#0e1626', board:'#1a2b4a'},
      {id:'wine',    name:'Wine',    price:150, a:'#5f2842', b:'#421a2e', c:'#23101a', board:'#3b1a2a'},
      {id:'dusk',    name:'Dusk',    price:250, a:'#7a4a6b', b:'#4d2f49', c:'#241726', board:'#3e2740'},
    ],
    launcher:[
      {id:'oak',  name:'Oak',  price:0,   wood:'#7c5024', woodD:'#5a3917', accent:'#eaa53b'},
      {id:'steel',name:'Steel',price:120, wood:'#7c8794', woodD:'#525c68', accent:'#bfe6da'},
      {id:'candy',name:'Candy',price:120, wood:'#d65b86', woodD:'#a13a60', accent:'#ffd2e2'},
    ],
    trail:[
      {id:'dots', name:'Dots',  price:0,   color:'#ffffff'},
      {id:'ember',name:'Ember', price:100, color:'#ff7a3c'},
      {id:'mint', name:'Mint',  price:100, color:'#7af2c4'},
    ],
  };
  const TYPES=Object.keys(CATALOG);
  const LABELS={tile:'Tiles', felt:'Felt', launcher:'Launcher', trail:'Trail'};

  // ---- owned / equipped state ----
  let owned=LS.get('owned',{}), equipped=LS.get('equipped',{});
  for(const t of TYPES){                       // defaults are always owned + a valid equip
    owned[CATALOG[t][0].id]=true;
    if(!equipped[t]||!CATALOG[t].some(i=>i.id===equipped[t])) equipped[t]=CATALOG[t][0].id;
  }
  const saveState=()=>{LS.set('owned',owned);LS.set('equipped',equipped);};
  saveState();

  // ---- coins (LL_Store is the single source of truth) ----
  const coins=()=>LS.get('coins',0);
  const setCoins=n=>LS.set('coins',Math.max(0,n|0));
  const addCoins=n=>{setCoins(coins()+(n|0));refreshHud();return coins();};

  // ---- lookups + the style the renderer consumes ----
  const item=(t,id)=>CATALOG[t].find(i=>i.id===id)||CATALOG[t][0];
  const eq=t=>item(t,equipped[t]);
  const getStyle=()=>({tile:eq('tile'),felt:eq('felt'),launcher:eq('launcher'),trail:eq('trail')});

  // keep the CSS letterbox background in sync with the felt theme
  function applyFeltVars(){const f=eq('felt'),r=document.documentElement.style;r.setProperty('--felt0',f.a);r.setProperty('--felt',f.b);r.setProperty('--felt2',f.c);}

  let onChange=null;                            // game.js hook (refresh topbar coin pill)
  const setOnChange=fn=>{onChange=fn;refreshHud();};

  // ---- buy / equip ----
  function buy(t,id){const it=item(t,id);if(owned[id])return equip(t,id);if(coins()<it.price)return false;
    setCoins(coins()-it.price);owned[id]=true;equipped[t]=id;saveState();afterChange();return true;}
  function equip(t,id){if(!owned[id])return false;equipped[t]=id;saveState();afterChange();return true;}
  function afterChange(){applyFeltVars();renderGrid();refreshHud();}

  // ================= UI =================
  let el=null, gridEl=null, coinEls=[];
  function build(){
    if(el) return;
    el=document.createElement('div'); el.className='overlay store'; el.id='store';
    el.innerHTML=
      '<h2>Store</h2>'+
      '<div class="storebal">&#129689; <span class="storeCoins">0</span> coins</div>'+
      '<div class="storegrid"></div>'+
      '<button class="btn" id="storeClose">Done</button>';
    const stage=document.getElementById('stage')||document.body;
    stage.appendChild(el);
    gridEl=el.querySelector('.storegrid');
    coinEls=[].slice.call(el.querySelectorAll('.storeCoins'));
    el.querySelector('#storeClose').onclick=close;
  }
  function swatchStyle(t,it){
    if(t==='tile')     return 'background:linear-gradient(180deg,'+it.hi+','+it.lo+');border-color:'+it.edge;
    if(t==='felt')     return 'background:linear-gradient(135deg,'+it.a+' 0%,'+it.b+' 60%,'+it.c+' 100%)';
    if(t==='launcher') return 'background:linear-gradient(180deg,'+it.wood+','+it.woodD+')';
    return 'background:radial-gradient(circle at 50% 45%,'+it.color+' 0 22%,transparent 24%),'+
           'radial-gradient(circle at 28% 70%,'+it.color+' 0 16%,transparent 18%),'+
           'radial-gradient(circle at 72% 70%,'+it.color+' 0 16%,transparent 18%),#1d3b34';
  }
  function renderGrid(){
    if(!gridEl) return;
    let html='';
    for(const t of TYPES){
      html+='<div class="sgroup"><div class="slabel">'+LABELS[t]+'</div><div class="srow">';
      for(const it of CATALOG[t]){
        const isEq=equipped[t]===it.id, own=!!owned[it.id], afford=coins()>=it.price;
        const state=isEq?'Equipped':(own?'Owned':('&#129689; '+it.price));
        const cls='sitem'+(isEq?' eq':'')+(own?' own':'')+(!own&&!afford?' lock':'');
        html+='<button class="'+cls+'" data-t="'+t+'" data-id="'+it.id+'">'+
              '<span class="swatch" style="'+swatchStyle(t,it)+'"></span>'+
              '<span class="sname">'+it.name+'</span>'+
              '<span class="sstate">'+state+'</span></button>';
      }
      html+='</div></div>';
    }
    gridEl.innerHTML=html;
    [].forEach.call(gridEl.querySelectorAll('.sitem'),b=>{
      b.onclick=()=>{
        const t=b.getAttribute('data-t'), id=b.getAttribute('data-id');
        if(owned[id]) equip(t,id);
        else if(!buy(t,id)){ b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      };
    });
  }
  function refreshHud(){
    const c=coins();
    coinEls.forEach(s=>s.textContent=c);
    if(onChange) onChange(c);
  }

  function open(){ build(); applyFeltVars(); renderGrid(); refreshHud(); el.classList.add('show'); }
  function close(){ if(el) el.classList.remove('show'); }
  const isOpen=()=>!!el&&el.classList.contains('show');

  applyFeltVars();   // theme the page background on load, before the store is ever opened

  window.LL_Store={
    getStyle, coins, addCoins, buy, equip, isOwned:id=>!!owned[id],
    open, close, isOpen, setOnChange, CATALOG,
  };
})();
