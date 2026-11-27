// The tracking nozzle as a part of the gun (user 2026-11-27「ノズル部品にしたら、設計の 12 個の構造物（4 門 × 3）を取り除いて部品に置き換える／質量は同じ、
// 価格は高めで／X ウイングの構造物の比率をそのまま全口径に使って」).
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const N=C.CRAFT_TRACK_NOZZLE,bb=T=>{const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<T.length;i+=3)for(let a=0;a<3;a++){b[a]=Math.min(b[a],T[i+a]);b[a+3]=Math.max(b[a+3],T[i+a]);}return b;};
test('mass and price: the X-wing structures\' mass at 0.12 m by the cube of the bore; the price by its square',()=>{
 assert.ok(Math.abs(C.trackNozzleMass(.12)-.1027568938365313/4)<1e-12);assert.ok(Math.abs(C.trackNozzleMass(.24)/C.trackNozzleMass(.12)-8)<1e-9);
 assert.equal(C.trackNozzleCost(.12),2000);assert.ok(Math.abs(C.trackNozzleCost(.24)-8000)<1e-9);assert.equal(C.trackNozzleCost(.02),N.minCost);
 const plain=C.fitSpec({k:'claser',id:1,p:[0,0,0],boreM:.12,barrelM:3.5}),track=C.fitSpec({k:'claser',id:1,p:[0,0,0],boreM:.12,barrelM:3.5,nozzle:'track'});
 assert.ok(Math.abs(track.mass-plain.mass-C.trackNozzleMass(.12))<1e-12);assert.ok(Math.abs(track.cost-plain.cost-2000)<1e-9);
});
test('the X-wing example: its twelve nozzle structures give way to the part, whose pieces are where the structures were, at the same size and lean',()=>{
 const raw=require(path.join(root,'docs/handoff-2026-11-20/refs/xwing-refit-2026-11-27.json')),u=C.deserialize(JSON.parse(JSON.stringify(raw))),s=C.buildDesign('craft_xwing');
 assert.equal(u.parts.length-s.parts.length,12);assert.ok(!s.parts.some(p=>/段付きカラー|フラッシュバックサプレッサー|アンテナ型発射ノズル/.test(p.label||'')));
 for(const f of s.fits.filter(f=>f.nozzle==='track')){const o=C.fitOrigin(f),fr=C.fitFrameOf(f);for(const q of C.trackNozzlePieces(f,C.trackNozzleLean(s,f))){const T=C.structTriangles(q),W=[];for(let i=0;i<T.length;i+=3)for(let a=0;a<3;a++)W.push(o[a]+fr.fw[a]*T[i]+fr.up[a]*T[i+1]+fr.rt[a]*T[i+2]);
  const side=(f.p[2]>0?'右舷':'左舷')+(f.p[1]>2?'上翼':'下翼'),orig=u.parts.find(p=>(p.label||'').startsWith(side)&&(p.label||'').includes(q.name)),a=bb(C.structTriangles(orig)),b=bb(W);
  assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-4),f.id+' '+q.name+': '+a+' / '+b);}}
});
test('the gun\'s outline reaches over its nozzle',()=>{const f={k:'claser',id:1,p:[0,0,0],a:0,boreM:.12,barrelM:3.5,nozzle:'track'},g={...f};delete g.nozzle;const A=C.craftFitBounds(f),B=C.craftFitBounds(g);assert.ok(A[3]>B[3]+1,'ahead');assert.ok(A[4]-A[1]>B[4]-B[1],'the fork is taller than the tube');});
