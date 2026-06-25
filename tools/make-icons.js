/* Letter Launch — icon generator (dependency-free).
 * Draws the brand mark (felt background + a cream letter-tile bearing "L") and
 * encodes real PNGs using only Node's built-in zlib. 3x supersampled for clean
 * edges. Writes docs/icon-192.png, icon-512.png, and apple-touch-icon.png.
 *   node tools/make-icons.js
 */
const fs=require('fs'), zlib=require('zlib'), path=require('path');

// ---- minimal PNG encoder (truecolour + alpha) ----
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xFFFFFFFF;for(let i=0;i<buf.length;i++)c=CRC[(c^buf[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function chunk(type,data){
  const len=Buffer.alloc(4);len.writeUInt32BE(data.length,0);
  const t=Buffer.from(type,'ascii');
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);
  return Buffer.concat([len,t,data,crc]);
}
function png(size,rgba){
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);
  ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++){raw[y*(size*4+1)]=0;rgba.copy(raw,y*(size*4+1)+1,y*size*4,(y+1)*size*4);}
  const idat=zlib.deflateSync(raw,{level:9});
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',idat),chunk('IEND',Buffer.alloc(0))]);
}

// ---- artwork, sampled in normalised 0..1 space ----
const lerp=(a,b,t)=>a+(b-a)*t;
const mix=(c1,c2,t)=>[lerp(c1[0],c2[0],t),lerp(c1[1],c2[1],t),lerp(c1[2],c2[2],t)];
function inRR(x,y,x0,y0,x1,y1,r){            // inside a rounded rectangle?
  if(x<x0||x>x1||y<y0||y>y1)return false;
  const dx=x<x0+r?x0+r-x:(x>x1-r?x-(x1-r):0);
  const dy=y<y0+r?y0+r-y:(y>y1-r?y-(y1-r):0);
  return dx*dx+dy*dy<=r*r;
}
function sample(u,v){
  let col=mix([43,85,75],[19,36,31],v);                       // felt background gradient
  if(inRR(u,v-0.02,0.19,0.19,0.81,0.81,0.08)) col=mix(col,[8,16,14],0.55); // tile drop shadow
  if(inRR(u,v,0.19,0.19,0.81,0.81,0.08)){                     // cream tile
    col=mix([255,250,240],[240,226,197],(v-0.19)/0.62);
    if(v>0.74) col=mix(col,[205,180,136],0.6);                // bottom lip
  }
  const stem=(u>=0.405&&u<=0.485&&v>=0.34&&v<=0.66);          // letter "L"
  const foot=(u>=0.405&&u<=0.61 &&v>=0.582&&v<=0.66);
  if(stem||foot) col=[44,36,23];
  return col;
}
function render(size){
  const SS=3, rgba=Buffer.alloc(size*size*4), n=SS*SS;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let r=0,g=0,b=0;
    for(let sy=0;sy<SS;sy++)for(let sx=0;sx<SS;sx++){
      const c=sample((x+(sx+0.5)/SS)/size,(y+(sy+0.5)/SS)/size);
      r+=c[0];g+=c[1];b+=c[2];
    }
    const i=(y*size+x)*4;
    rgba[i]=r/n+0.5|0;rgba[i+1]=g/n+0.5|0;rgba[i+2]=b/n+0.5|0;rgba[i+3]=255;
  }
  return png(size,rgba);
}
const dir=path.join(__dirname,'..','docs');
for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]){
  fs.writeFileSync(path.join(dir,name),render(size));
  console.log('wrote '+name+' ('+size+'×'+size+')');
}
