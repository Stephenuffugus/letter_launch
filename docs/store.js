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
  // Pure cosmetic — never sells power. Coins are an in-game-only currency.
  const CATALOG={
    tile:[
      {id:'classic',  name:'Classic',  price:0,   hi:'#fffaf0', lo:'#f0e2c5', edge:'#cdb488', ink:'#2c2417'},
      {id:'mint',     name:'Mint',     price:160, hi:'#e9fff5', lo:'#b6f0d8', edge:'#7fd0b0', ink:'#11463c'},
      {id:'coral',    name:'Coral',    price:160, hi:'#ffe3d6', lo:'#ffb59a', edge:'#e07f5f', ink:'#5c2316'},
      {id:'sky',      name:'Sky',      price:180, hi:'#e6f4ff', lo:'#aed7f5', edge:'#6fa8d0', ink:'#14385c'},
      {id:'bubblegum',name:'Bubblegum',price:200, hi:'#ffe0ef', lo:'#ff9fcb', edge:'#e070a6', ink:'#5e1a39'},
      {id:'lavender', name:'Lavender', price:200, hi:'#efe6ff', lo:'#cdb6f5', edge:'#9d7fd0', ink:'#3a2660'},
      {id:'slate',    name:'Slate',    price:240, hi:'#6b7480', lo:'#434c59', edge:'#2c333d', ink:'#f3f6fa'},
      {id:'obsidian', name:'Obsidian', price:280, hi:'#3a3f4a', lo:'#1b1f27', edge:'#0c0e13', ink:'#e8ecf5'},
      {id:'carbon',   name:'Carbon',   price:300, hi:'#6a7078', lo:'#2a2e34', edge:'#15171b', ink:'#f0f2f5'},
      {id:'ember',    name:'Ember',    price:360, hi:'#ffd9a8', lo:'#ff8a3c', edge:'#c4561a', ink:'#4a1e06'},
      {id:'gold',     name:'Gold',     price:420, hi:'#fff3c8', lo:'#ecbe55', edge:'#b9831e', ink:'#4a3206'},
      {id:'rosegold', name:'Rose Gold',price:460, hi:'#ffe9e3', lo:'#e8b9a8', edge:'#c08a76', ink:'#4a2c22'},
      {id:'neon',     name:'Neon',     price:540, hi:'#d6ffe9', lo:'#39ffa0', edge:'#14b86a', ink:'#043016'},
      {id:'magma',    name:'Magma',    price:900, hi:'#ffd98a', lo:'#e0381f', edge:'#7a1208', ink:'#3a0a04'},
    ],
    felt:[
      {id:'forest',  name:'Forest',  price:0,   a:'#2b554b', b:'#20413a', c:'#13241f', board:'#1d3b34'},
      {id:'midnight',name:'Midnight',price:150, a:'#2a4570', b:'#1b2c4d', c:'#0e1626', board:'#1a2b4a'},
      {id:'wine',    name:'Wine',    price:150, a:'#5f2842', b:'#421a2e', c:'#23101a', board:'#3b1a2a'},
      {id:'charcoal',name:'Charcoal',price:180, a:'#3a3f47', b:'#24272d', c:'#131519', board:'#1f2228'},
      {id:'ocean',   name:'Ocean',   price:220, a:'#1f6f7a', b:'#134a55', c:'#0a2a30', board:'#114048'},
      {id:'dusk',    name:'Dusk',    price:250, a:'#7a4a6b', b:'#4d2f49', c:'#241726', board:'#3e2740'},
      {id:'emerald', name:'Emerald', price:260, a:'#1f7a52', b:'#125236', c:'#0a2a1d', board:'#114a32'},
      {id:'plum',    name:'Plum',    price:260, a:'#5a2a6a', b:'#3c1c47', c:'#1f0f26', board:'#3a1c44'},
      {id:'mono',    name:'Mono',    price:300, a:'#4a4a4a', b:'#2c2c2c', c:'#141414', board:'#242424'},
      {id:'sakura',  name:'Sakura',  price:360, a:'#d98aa8', b:'#a8536f', c:'#5a2a3c', board:'#7a3a52'},
      {id:'sunset',  name:'Sunset',  price:420, a:'#c4632a', b:'#7a2f3a', c:'#2a1226', board:'#5a2433'},
      {id:'aurora',  name:'Aurora',  price:650, a:'#2a7a6a', b:'#2a3f7a', c:'#4a2a6a', board:'#1f2f4a'},
      {id:'goldleaf',name:'Gold Leaf',price:900,a:'#8a6a2a', b:'#5a4418', c:'#2a200a', board:'#4a3a14'},
    ],
    launcher:[
      {id:'oak',    name:'Oak',    price:0,   wood:'#7c5024', woodD:'#5a3917', accent:'#eaa53b'},
      {id:'steel',  name:'Steel',  price:120, wood:'#7c8794', woodD:'#525c68', accent:'#bfe6da'},
      {id:'candy',  name:'Candy',  price:120, wood:'#d65b86', woodD:'#a13a60', accent:'#ffd2e2'},
      {id:'ivory',  name:'Ivory',  price:200, wood:'#e8e0cf', woodD:'#c4b89a', accent:'#eaa53b'},
      {id:'ebony',  name:'Ebony',  price:200, wood:'#3a3f47', woodD:'#1f2228', accent:'#cdd6e0'},
      {id:'crimson',name:'Crimson',price:260, wood:'#a83232', woodD:'#6e1f1f', accent:'#ffd2c2'},
      {id:'jade',   name:'Jade',   price:260, wood:'#2e8a6a', woodD:'#1c5a44', accent:'#bdf2dc'},
      {id:'royal',  name:'Royal',  price:420, wood:'#4a3a8a', woodD:'#2c2256', accent:'#d6c6ff'},
      {id:'neon',   name:'Neon',   price:520, wood:'#2a2e34', woodD:'#15171b', accent:'#39ffa0'},
      {id:'gilded', name:'Gilded', price:850, wood:'#c9a23a', woodD:'#8a6a1c', accent:'#fff3c8'},
    ],
    trail:[
      {id:'dots',    name:'Dots',    price:0,   color:'#ffffff'},
      {id:'ember',   name:'Ember',   price:100, color:'#ff7a3c'},
      {id:'mint',    name:'Mint',    price:100, color:'#7af2c4'},
      {id:'gold',    name:'Gold',    price:200, color:'#ffcf4d'},
      {id:'rose',    name:'Rose',    price:200, color:'#ff7ab0'},
      {id:'sky',     name:'Sky',     price:220, color:'#6fc8ff'},
      {id:'violet',  name:'Violet',  price:320, color:'#b47aff'},
      {id:'lime',    name:'Lime',    price:320, color:'#b6ff5a'},
      {id:'crimson', name:'Crimson', price:420, color:'#ff4d5e'},
      {id:'sunburst',name:'Sunburst',price:520, color:'#ffd27a'},
    ],
    fx:[
      {id:'spring',  name:'Spring',  price:0,   color:'#5bc47e'},
      {id:'fxember', name:'Ember',   price:120, color:'#ff7a3c'},
      {id:'fxgold',  name:'Gold',    price:150, color:'#ffcf4d'},
      {id:'fxrose',  name:'Rose',    price:160, color:'#ff6fae'},
      {id:'fxsky',   name:'Sky',     price:220, color:'#59b6ff'},
      {id:'fxviolet',name:'Violet',  price:260, color:'#b47aff'},
      {id:'fxlime',  name:'Lime',    price:320, color:'#9bff4d'},
      {id:'fxaqua',  name:'Aqua',    price:420, color:'#39ffd0'},
      {id:'fxcrimson',name:'Crimson',price:420, color:'#ff4d5e'},
      {id:'fxsnow',  name:'Snow',    price:520, color:'#eaf4ff'},
    ],
  };
  const TYPES=Object.keys(CATALOG);
  const LABELS={tile:'Tiles', felt:'Felt', launcher:'Launcher', trail:'Aim Trail', fx:'Clear Burst'};

  // ---- owned / equipped state ----
  // Ownership is keyed by "type:id" so a friendly id (e.g. 'gold') can appear in more
  // than one category without one purchase unlocking the others.
  let owned=LS.get('owned',{}), equipped=LS.get('equipped',{});
  const okey=(t,id)=>t+':'+id;
  // migrate legacy bare-id ownership (pre-expansion saves) → composite keys
  const LEGACY={gold:'tile',slate:'tile',bubblegum:'tile',midnight:'felt',wine:'felt',dusk:'felt',steel:'launcher',candy:'launcher',ember:'trail',mint:'trail'};
  for(const id in LEGACY){ if(owned[id]===true) owned[okey(LEGACY[id],id)]=true; }
  for(const t of TYPES){                       // defaults are always owned + a valid equip
    owned[okey(t,CATALOG[t][0].id)]=true;
    if(!equipped[t]||!CATALOG[t].some(i=>i.id===equipped[t])) equipped[t]=CATALOG[t][0].id;
  }
  const saveState=()=>{LS.set('owned',owned);LS.set('equipped',equipped);};
  saveState();

  // ---- coins (LL_Store is the single source of truth) ----
  const coins=()=>LS.get('coins',0);
  const setCoins=n=>LS.set('coins',Math.max(0,n|0));
  const addCoins=n=>{setCoins(coins()+(n|0));refreshHud();return coins();};
  // one-time welcome bonus so a new player can try the store right away
  if(!LS.get('welcome',false)){ setCoins(coins()+200); LS.set('welcome',true); }

  // ---- lookups + the style the renderer consumes ----
  const item=(t,id)=>CATALOG[t].find(i=>i.id===id)||CATALOG[t][0];
  const eq=t=>item(t,equipped[t]);
  const getStyle=()=>({tile:eq('tile'),felt:eq('felt'),launcher:eq('launcher'),trail:eq('trail'),fx:eq('fx')});

  // keep the CSS letterbox background in sync with the felt theme
  function applyFeltVars(){const f=eq('felt'),r=document.documentElement.style;r.setProperty('--felt0',f.a);r.setProperty('--felt',f.b);r.setProperty('--felt2',f.c);}

  let onChange=null;                            // game.js hook (refresh topbar coin pill)
  const setOnChange=fn=>{onChange=fn;refreshHud();};

  // ---- buy / equip ----
  function buy(t,id){const it=item(t,id);if(owned[okey(t,id)])return equip(t,id);if(coins()<it.price)return false;
    setCoins(coins()-it.price);owned[okey(t,id)]=true;equipped[t]=id;saveState();afterChange();return true;}
  function equip(t,id){if(!owned[okey(t,id)])return false;equipped[t]=id;saveState();afterChange();return true;}
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
    if(t==='fx')       return 'background:radial-gradient(circle at 50% 50%,'+it.color+' 0 30%,'+it.color+'66 38%,transparent 62%),#16302a';
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
        const isEq=equipped[t]===it.id, own=!!owned[okey(t,it.id)], afford=coins()>=it.price;
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
        if(owned[okey(t,id)]) equip(t,id);
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
    getStyle, coins, addCoins, buy, equip, isOwned:(t,id)=>!!owned[okey(t,id)],
    open, close, isOpen, setOnChange, CATALOG,
  };
})();
