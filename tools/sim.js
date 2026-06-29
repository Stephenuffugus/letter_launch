/* Reachability check — brute-forces the aim space and confirms every column
 * can be reached. The bumper field is static (deterministic), so one pass suffices.
 * Keep the constants/BUMPERS here in sync with game.js after edits.
 *   node sim.js
 */
const W=560,H=760,COLS=7,CELL=72,GX0=28,BOARD_TOP=304,POWER=0.14,GRAV=0.42,R=22,MAX_PULL=150;
const REST={peg:0.82,bouncer:1.0,charger:1.0};   // <=1 so the field is deterministic; charger == bouncer physics
const BUMPERS=[
  {bx:100,by:150,r:12,kind:'peg'},
  {bx:244,by:150,r:12,kind:'peg'},
  {bx:388,by:150,r:12,kind:'peg'},
  {bx:172,by:214,r:12,kind:'bouncer'},
  {bx:316,by:214,r:12,kind:'charger'},
  {bx:460,by:214,r:12,kind:'bouncer'},
  {bx:280,by:108,r:13,kind:'peg'},
];
function place(){return BUMPERS.map(b=>({x:b.bx,y:b.by,r:b.r,kind:b.kind}));}
function landCol(dx,dy,B){
  let d=Math.hypot(dx,dy);if(d>MAX_PULL){dx*=MAX_PULL/d;dy*=MAX_PULL/d;}
  let x=W/2,y=70,vx=dx*POWER,vy=dy*POWER;
  for(let i=0;i<3000;i++){
    vy+=GRAV;x+=vx;y+=vy;
    if(x<R){x=R;vx*=-0.7;}if(x>W-R){x=W-R;vx*=-0.7;}if(y<R){y=R;vy*=-0.5;}
    for(const b of B){const ex=x-b.x,ey=y-b.y,dd=Math.hypot(ex,ey),mn=R+b.r;
      if(dd<mn){const nx=ex/(dd||1),ny=ey/(dd||1);x=b.x+nx*mn;y=b.y+ny*mn;const dot=vx*nx+vy*ny,k=REST[b.kind]||0.86;vx=(vx-2*dot*nx)*k;vy=(vy-2*dot*ny)*k;}}
    if(vy>0&&y+R>=BOARD_TOP)return Math.max(0,Math.min(COLS-1,Math.floor((x-GX0)/CELL)));
    if(y>H+60)return -1;
  }
  return -1;
}
const B=place(),counts=new Array(COLS).fill(0);
for(let dx=-150;dx<=150;dx+=4)for(let dy=-150;dy<=150;dy+=4){const c=landCol(dx,dy,B);if(c>=0)counts[c]++;}
const reach=counts.filter(n=>n>0).length;
console.log('reachable '+reach+'/7   '+counts.join(' '));
console.log(reach===COLS?'OK ✓ — every column reachable (static field)':'!!! a column is unreachable');
