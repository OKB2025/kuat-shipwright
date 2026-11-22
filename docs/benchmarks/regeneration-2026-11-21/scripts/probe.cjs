// Physics review 1(a)/(b): for Providence pairs, aviationConnected and the first probe point that connects (grid probe as in core);
// then what fills the gap above #24 under #181: other parts' inPart at points in the gap.
const zlib=require('zlib'),fs=require('fs'),path=require('path');const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const key=process.argv[2]||'providence',pairs=JSON.parse(process.argv[3]||'[[24,181],[184,181],[24,184]]');
const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(`data/examples/${key}/design.json.gz`))));C.computeStats(s);const P=id=>s.parts.find(p=>p.id===id);const lerp=(a,b,t)=>a+(b-a)*t;
for(const [i,j] of pairs){const a=P(i),b=P(j),A=C.partAABB(a),B=C.partAABB(b),apart=(X,Y)=>[0,1,2].some(k=>X[k]>Y[k+3]+1.5||Y[k]>X[k+3]+1.5),placed=p=>C.partAABB({...p,_packing:null,_clip:null});
 const reach=!!(a._packing||b._packing)&&!apart(placed(a),placed(b)),tols=[0,1,2].map(k=>reach?Math.max(1.5,(a._packing?.cell?.[k]||0)/2,(b._packing?.cell?.[k]||0)/2):1.5);
 const lo=[0,1,2].map(k=>Math.max(A[k],B[k])),hi=[0,1,2].map(k=>Math.min(A[k+3],B[k+3]));let hit=null;
 const near=(p,q)=>{if(C.inPart(p,q))return 'inside';for(const ax of [0,1,2])for(const sg of [-1,1]){const r=q.slice();r[ax]+=sg*tols[ax];if(C.inPart(p,r))return `axis ${ax} ${sg>0?'+':'-'}${tols[ax].toFixed(2)}`;}return null;};
 for(let x=0;x<5&&!hit;x++)for(let y=0;y<5&&!hit;y++)for(let z=0;z<5&&!hit;z++){const q=[x,y,z].map((v,ax)=>lerp(lo[ax],hi[ax],(v+.5)/5)),na=near(a,q),nb=na&&near(b,q);if(na&&nb)hit={q:q.map(v=>+v.toFixed(2)),a:na,b:nb};}
 console.log(`#${i}-#${j}: connected ${C.aviationConnected(a,b)}, reach ${reach}, tols ${tols.map(v=>v.toFixed(2))}, grid probe ${hit?JSON.stringify(hit):'none (face probe or not connected)'}`);}
// gap contents: column above #24's top under #181's cells
const a=P(24),b=P(181),A=C.partAABB(a),top=A[4];const others=new Map();let samples=0;
for(let x=A[0]+5;x<A[3];x+=10)for(let z=-60;z<=60;z+=10)for(let y=top+.5;y<top+4.4;y+=1){samples++;if(C.inPart(b,[x,y,z]))continue;for(const p of s.parts){if(p.id===24||p.id===181)continue;if(['hull','struct'].includes(p.k)&&!p.room){/* structures: point inside its solid? */}if(C.inPart(p,[x,y,z]))others.set(p.id+' '+p.k+' '+(p.label||''),(others.get(p.id+' '+p.k+' '+(p.label||''))||0)+1);}}
console.log('gap above #24 (y',top.toFixed(2),'to +4.4) samples',samples,'occupied by',JSON.stringify([...others]));
