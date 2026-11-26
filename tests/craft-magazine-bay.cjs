// Launchers of one round with a magazine behind them, ring and straight bomb bays, the drop device and the pylon's load
// (user decisions 2026-11-25/26; docs/handoff-2026-11-25/next-pr-decisions-2026-11-26.md chapter 4, docs/benchmarks/parts-2026-11-26/README.md):
// 「発射器(今のを1発分に縮小)」「発射器の真後ろに絶対作られる／その後左右上下と均等に増え入らない分は逆側に行く」「爆弾倉は幅0.2のドーナッツ型円筒…」
// 「0.3mで」「直列タイプの爆弾倉は下面が自動で投下ハッチになる／円筒タイプは自分で投下装置をつける／直列タイプは一回の投下で一列全部が落ちる／
// 円筒タイプは長押しで投下を続ける」「パイロンは一つあたりミサイル、魚雷一つ、爆弾は3個で」.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const plain=x=>JSON.parse(JSON.stringify(x));
// a slab of structure x -4..4, y 0..2, z -zHalf..zHalf, with a launcher lying on its top face pointing along +x
// sink: how far the launcher is sunk into the slab (0: it stands on the top face, the skin between it and the structure)
function slab(zHalf=2,at=[2,2,0],sink=0){const s=C.newShip({L:8,W:2*zHalf,H:2,assembly:true},'magazine');s.parts=[];s.fits=[];s.nextId=1;C.placePart(s,'struct',[0,1,0],[8,2*zHalf,2],{form:'box'},false);if(sink){/* a tube inside the structure, as the examples' sunk tubes are saved: its point is sink metres under the top face */const f={id:s.nextId++,k:'ctorp',p:[at[0],at[1]-sink,at[2]],n:[0,1,0],a:2/* mounted on a face that looks up, firing along +x */,ped:0,base:0,low:0,localMount:true,frameForward:[1,0,0],placement:{modelVersion:1,mode:'direct'}};s.fits.push(f);return {s,f};}const r=C.placeFit(s,'ctorp',at,[0,1,0],0,false);assert.ok(r.fit,r.err);return {s,f:r.fit};}
const cellsOf=m=>m.cells.map(c=>c.i+','+c.j);

test('the figures',()=>{assert.equal(C.CRAFT_BAY.cell,.3);assert.equal(C.FITS.cdrop.dropPerS,4);assert.deepEqual(plain(C.CRAFT_LAUNCHER_SLIM),{wm:.3,hm:.3,mass:.36});assert.equal(C.FITS.ctorp.store.slots,1);});

test('a launcher holds its one round and its magazine\'s; one saved before the rule asks for what its tube held',()=>{
 const {s,f}=slab();assert.equal(f.magazine,undefined);assert.equal(C.craftMagazineWant(f),C.LAUNCHER_ROUNDS.torpedo-1);assert.equal(C.craftMagazineWant({k:'cmsl'}),C.LAUNCHER_ROUNDS.missile-1);
 f.magazine=0;assert.equal(C.craftMagazine(s,f,[]).got,0);let st=C.craftStations(s);assert.equal(st[0].store.rounds,1);assert.equal(C.storeCapacity(st[0].store,'ptorp'),1,'no magazine: the one round');
 f.magazine=4;st=C.craftStations(s);assert.equal(st[0].store.rounds,5);assert.equal(C.storeCapacity(st[0].store,'ptorp'),5);assert.equal(C.storeCapacity(st[0].store,'cmsl'),5);assert.equal(C.storeCapacity(st[0].store,'bomb'),0,'a launcher takes no bombs');
 assert.equal(C.storeCapacity(C.FITS.ctorp.store,'ptorp'),C.LAUNCHER_ROUNDS.torpedo,'a station with no design behind it keeps the rule of 2026-11-24');
});

test('the first cell is straight behind the launcher; the rest go out evenly to the four sides',()=>{
 // sunk 1 m into a 2 m slab: room to both sides, above and below
 const {s,f}=slab(2,[2,2,0],1);f.magazine=9;/* nine rounds in the magazine: the one straight behind and two steps to each side */const m=C.craftMagazine(s,f,[]);assert.equal(m.cells[0].behind,true);assert.equal(cellsOf(m)[0],'0,0');
 assert.deepEqual(plain(cellsOf(m).slice(1,5).sort()),['-1,0','0,-1','0,1','1,0'],'one step to each of the four sides first');assert.deepEqual(plain(cellsOf(m).slice(5,9).sort()),['-2,0','0,-2','0,2','2,0'],'then a second step to each');
 assert.equal(m.got,9);
 // standing on the top face: the cell straight behind is still made; the rest go down into the structure under it
 {const t=slab();t.f.magazine=4;const mt=C.craftMagazine(t.s,t.f,[]);assert.equal(cellsOf(mt)[0],'0,0');assert.equal(mt.got,4);assert.ok(mt.cells.slice(1).every(c=>c.i===0&&c.j<0),'under the launcher: '+cellsOf(mt));}
 const fw=C.fitFrameOf(f).fw,o=C.fitOrigin(f);for(const c of m.cells)assert.ok(C.dot(C.sub(c.c,o),fw)<0,'every cell is behind the launcher');
});

test('a side with no room gives its turn to the opposite side; when that has none either, the rounds do not fit and a warning says so',()=>{
 // the launcher at the slab's +z edge: nothing fits further to that side
 const {s,f}=slab(2,[2,2,1.7],1);f.magazine=6;const m=C.craftMagazine(s,f,[]),rt=C.fitFrameOf(f).rt,o=C.fitOrigin(f),side=m.cells.filter(c=>!c.behind).map(c=>Math.sign(Math.round(C.dot(C.sub(c.c,o),rt)*1000)));
 const toEdge=side.filter(v=>v===Math.sign(C.dot(rt,[0,0,1]))).length,away=side.filter(v=>v===-Math.sign(C.dot(rt,[0,0,1]))).length;assert.ok(away>toEdge,'more cells on the side away from the edge: '+cellsOf(m));
 // a thin, narrow slab has room for few: the rest is reported
 const t=slab(.15,[2,2,0],.3);t.f.magazine=11;/* a slab 0.3 m wide with the tube just under its top: no room to the sides or above, some below */const mt=C.craftMagazine(t.s,t.f,[]);assert.ok(mt.got<mt.want,'only '+mt.got+' of '+mt.want+' fit');assert.ok(mt.got>=1,'the cell straight behind is always made');
 // the warning, on a launcher placed by the editor's own call (standing on the 2 m slab: the cell behind it and the cells under it, fewer than 11)
 const top=slab();top.f.magazine=11;const mTop=C.craftMagazine(top.s,top.f,[]);assert.ok(mTop.got<11&&mTop.got>=2,'on the slab: '+mTop.got);const S=C.computeStats(top.s);assert.equal(!!top.f.float,false);
 assert.ok(S.warnings.some(w=>w.code==='magazine'&&/入りきりません/.test(w.text)),'warned: '+S.warnings.map(w=>w.code).join(','));assert.equal(C.craftStations(top.s)[0].store.rounds,1+mTop.got);
});

test('two launchers do not share a cell',()=>{
 const {s,f}=slab(2,[2,2,.3],1);const r={fit:{id:s.nextId++,k:'ctorp',p:[2,1,-.3],n:[0,1,0],a:2/* mounted on a face that looks up, firing along +x */,ped:0,base:0,low:0,localMount:true,frameForward:[1,0,0],placement:{modelVersion:1,mode:'direct'}}};s.fits.push(r.fit);f.magazine=5;r.fit.magazine=5;const taken=[],a=C.craftMagazine(s,f,taken),b=C.craftMagazine(s,r.fit,taken);
 const hit=(p,q)=>p[0]<q[3]-1e-6&&p[3]>q[0]+1e-6&&p[1]<q[4]-1e-6&&p[4]>q[1]+1e-6&&p[2]<q[5]-1e-6&&p[5]>q[2]+1e-6;
 for(const x of a.cells.filter(c=>!c.behind))for(const y of b.cells.filter(c=>!c.behind))assert.ok(!hit(x.b,y.b),'cells '+x.i+','+x.j+' and '+y.i+','+y.j+' overlap');
});

test('the magazine count and the slim body are saved; a launcher saved without them loads as it was',()=>{
 const {s,f}=slab();f.magazine=7;f.oneRound=true;const back=C.deserialize(plain(C.serialize(s))),g=back.fits.find(q=>q.k==='ctorp');assert.equal(g.magazine,7);assert.equal(g.oneRound,true);
 assert.equal(C.fitSpec(g).wm,.3);assert.equal(C.fitSpec(g).mass,.36);assert.equal(C.fitSpec(g).fm,1.4,'the length stays: a sunk tube\'s mouth is where it was');
 delete f.magazine;delete f.oneRound;const old=C.deserialize(plain(C.serialize(s))).fits.find(q=>q.k==='ctorp');assert.equal(old.magazine,undefined);assert.equal(old.oneRound,undefined);assert.equal(C.fitSpec(old).wm,.5);assert.equal(C.fitSpec(old).mass,1);
});

test('a ring bay: bombs round a 0.3 m ring, a row every 0.3 m of length; it needs a drop device on the wall it touches',()=>{
 assert.deepEqual(plain(C.ringBayRows([.3,1.8,1.8])),{rows:1,perRow:Math.floor(Math.PI*1.5/.3+1e-9)});assert.equal(C.ringBayRows([.6,1.8,1.8]).rows,2,'0.6 m long: two rows');assert.equal(C.ringBayRows([.6,.5,.5]).perRow,0,'too narrow for a ring');
 const ring={mount:'bay',ring:true,box:[.6,1.8,1.8],devices:2};assert.equal(C.storeCapacity(ring,'bomb'),2*15);assert.equal(C.storeCapacity(ring,'ptorp'),0,'bombs only');
 assert.deepEqual(plain(C.bayRelease(ring)),{mode:'stream',perS:8},'dropped for as long as held: 4 a second a device');
 assert.deepEqual(plain(C.bayRelease({mount:'bay',box:[2.4,1.2,.7]})),{mode:'row',n:8},'a straight bay drops one row along its length at once');
 // on a design: no station without a device, one with it
 const s=C.newShip({L:8,W:4,H:3,assembly:true},'ring');s.parts=[];s.fits=[];s.nextId=1;C.placePart(s,'struct',[0,1.5,0],[8,4,3],{form:'box'},false);
 s.parts.push({id:s.nextId++,k:'bombBay',c:[0,1,0],d:1.8,room:[.6,1.8,1.8],corner:0,bayRing:true});
 assert.equal(C.craftStations(s).filter(st=>st.mount==='bay').length,0,'no drop device: no station');assert.ok(C.computeStats(s).warnings.some(w=>w.code==='bomb-bay-device'));
 const r=C.placeFit(s,'cdrop',[0,0,0],[0,-1,0],0,false);assert.ok(r.fit,r.err);const st=C.craftStations(s).filter(x=>x.mount==='bay');assert.equal(st.length,1);assert.equal(st[0].store.ring,true);assert.equal(st[0].store.devices,1);
 assert.ok(!C.computeStats(s).warnings.some(w=>w.code==='bomb-bay-device'));
 const back=C.deserialize(plain(C.serialize(s)));assert.equal(back.parts.find(p=>p.k==='bombBay').bayRing,true,'the form is saved');
});

test('the pylon: one missile, one torpedo or three bombs',()=>{const st=C.FITS.cpylon.store;assert.equal(C.storeCapacity(st,'cmsl'),1);assert.equal(C.storeCapacity(st,'rmsl'),1);assert.equal(C.storeCapacity(st,'ptorp'),1);assert.equal(C.storeCapacity(st,'bomb'),3);assert.deepEqual(plain(C.STORE_DEFAULT.cpylon),['cmsl',1]);});
