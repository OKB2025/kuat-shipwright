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
 assert.equal(u.parts.length-s.parts.length,12);{const ids=new Set(s.parts.map(p=>p.id));for(const p of s.parts)for(const i of p.wing?.members?.parts||[])assert.ok(ids.has(i),'a foil member '+i+' that is gone');}assert.ok(!s.parts.some(p=>/段付きカラー|フラッシュバックサプレッサー|アンテナ型発射ノズル/.test(p.label||'')));
 for(const f of s.fits.filter(f=>f.nozzle==='track')){const o=C.fitOrigin(f),fr=C.fitFrameOf(f);for(const q of C.trackNozzlePieces(f,C.trackNozzleLean(s,f))){const T=C.structTriangles(q),W=[];for(let i=0;i<T.length;i+=3)for(let a=0;a<3;a++)W.push(o[a]+fr.fw[a]*T[i]+fr.up[a]*T[i+1]+fr.rt[a]*T[i+2]);
  const side=(f.p[2]>0?'右舷':'左舷')+(f.p[1]>2?'上翼':'下翼'),orig=u.parts.find(p=>(p.label||'').startsWith(side)&&(p.label||'').includes(q.name)),a=bb(C.structTriangles(orig)),b=bb(W);
  assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-4),f.id+' '+q.name+': '+a+' / '+b);
  // 2026-11-27 (reference-fidelity review) each vertex near one of the structure's, both ways: a box alone does not tell a lean of +13° from -13°
  const pts=T=>{const r=[];for(let i=0;i<T.length;i+=3)r.push([T[i],T[i+1],T[i+2]]);return r;},P=pts(W),Q=pts(C.structTriangles(orig)),far=(X,Y)=>Math.max(...X.map(x=>Math.min(...Y.map(y=>Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2])))));
  assert.ok(far(P,Q)<1e-4&&far(Q,P)<1e-4,f.id+' '+q.name+': vertices '+far(P,Q)+' / '+far(Q,P));}}
});
test('the gun\'s outline reaches over its nozzle',()=>{const f={k:'claser',id:1,p:[0,0,0],a:0,boreM:.12,barrelM:3.5,nozzle:'track'},g={...f};delete g.nozzle;const A=C.craftFitBounds(f),B=C.craftFitBounds(g);assert.ok(A[3]>B[3]+1,'ahead');assert.ok(A[4]-A[1]>B[4]-B[1],'the fork is taller than the tube');});

// 2026-11-27 (user「TIEアヴェンジャーの翼部レーザーの発射速度は全部1秒3発にして」「重レーザーは毎秒2発で」)
test('the TIE Avenger example: its sixteen wing lasers fire three shots a second; the two heavy guns on the hubs fire two, the guns under the nose keep four',()=>{
 const s=C.buildDesign('craft_tie_avenger'),host=new Map(s.parts.map(p=>[p.id,p])),wing=s.fits.filter(f=>f.k==='claser'&&/前縁|縁桁/.test(host.get(f.host)?.label||'')),rest=s.fits.filter(f=>f.k==='claser'&&!wing.includes(f));
 assert.equal(wing.length,16);for(const f of wing)assert.equal(C.fitSpec(f).gunRule.rateHz,3);assert.equal(rest.length,4);
 /* 2026-11-27 expectation changed (user「重レーザーは毎秒2発で」): the two heavy guns on the hubs fire 2 a second (were 4 like the nose guns) */
 const heavy=rest.filter(f=>/多角形ハブ/.test(host.get(f.host)?.label||'')),nose=rest.filter(f=>!heavy.includes(f));assert.equal(heavy.length,2);for(const f of heavy){assert.equal(f.boreM,.15);assert.equal(C.fitSpec(f).gunRule.rateHz,2);}
 assert.equal(nose.length,2);for(const f of nose)assert.equal(C.fitSpec(f).gunRule.rateHz,4);
});
// 2026-11-27 user「イオン砲はノズルの対象外で」: an ion gun carries no tracking nozzle (mass, price, rule, drawing), even where its design asks for
// one (the B-wing's three SW-7a ion cannons do); the B-wing example's mass and price are those of the user's table again (17.302 t, 167 446).
test('an ion gun has no tracking nozzle: the B-wing\'s ion cannons ask for one and carry none',()=>{
 const g={k:'claser',id:1,p:[0,0,0],boreM:.15,barrelM:3.5,ionBoxM3:.08},a=C.fitSpec({...g,nozzle:'track'}),b=C.fitSpec(g);
 assert.equal(C.trackNozzleOn({...g,nozzle:'track'}),false);assert.equal(a.gunRule?.nozzle,undefined);assert.equal(a.mass,b.mass);assert.equal(a.cost,b.cost);
 const s=C.buildDesign('craft_bwing'),ion=s.fits.filter(f=>f.nozzle==='track');assert.equal(ion.length,3,'the design asks for it on three ion cannons');assert.ok(ion.every(f=>f.ionBoxM3>0&&!C.trackNozzleOn(f)));
 const S=C.computeStats(s);assert.equal(+S.mass.toFixed(3),17.302);assert.equal(Math.round(S.cost),167446);
 assert.equal(C.trackNozzleOn({k:'claser',boreM:.12,nozzle:'track'}),true,'a fixed laser keeps it');
});
