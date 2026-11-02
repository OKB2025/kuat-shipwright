const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),ctx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const C=vm.runInContext('Core',ctx),plain=x=>JSON.parse(C.publicJSON(x)),near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function fixture(key='taper',side=1){const ship=C.newShip({L:12,W:8,H:4,assembly:true}),preset=C.wingPlanformPreset(key,side),part=C.placePart(ship,'wing',[6,2,6],[8,12,.2],preset);return {ship,part};}
function solid(p){const m=C.aeroWingMesh(p),t=C.meshTopology(m.f);assert.equal(t.closed,true);assert.equal(t.open,0);assert.ok(m.v.every(q=>q.every(Number.isFinite)));let volume=0;for(const [a,b,c]of m.f)volume+=C.dot(m.v[a],C.cross(m.v[b],m.v[c]));assert.ok(volume>0);assert.ok(C.partVolume(p)>0);return m;}

test('wing planform presets are cloned and distinguish aft sweep, forward sweep, delta and double delta',()=>{
 assert.deepEqual(Object.keys(C.WING_PLANFORM_PRESETS).sort(),['delta','doubleDelta','forward','straight','swept','taper']);
 for(const [key,expected]of [['swept',-1],['forward',1]]){const {part}=fixture(key);assert.equal(Math.sign(C.wingTipOffset(part)),expected);solid(part);}
 assert.equal(C.wingPlanformPreset('delta').outline.length,3);assert.equal(C.wingPlanformPreset('doubleDelta').outline.length,4);
 const first=C.wingPlanformPreset('delta');first.outline[0][0]=1.5;assert.equal(C.wingPlanformPreset('delta').outline[0][0],-.5);
 assert.deepEqual(plain(C.wingPlanformPreset('constructor')),plain(C.wingPlanformPreset('taper')));
});

test('moving a wing tip shears its edited outline while retaining the root, kink and area',()=>{
 const {part}=fixture('doubleDelta'),before=plain(part),area=C.aeroArea(part),oldOffset=C.wingTipOffset(part),target=2.75;
 const outline=C.wingShiftTip(part,target);assert.ok(outline);assert.deepEqual(plain(part),before,'the helper is pure');
 const shifted={...before,outline};near(C.wingTipOffset(shifted),target);near(C.aeroArea(shifted),area);
 before.outline.forEach(([x,z],i)=>{near(outline[i][1],z);near(outline[i][0]-x,(target-oldOffset)/part.s[0]*(z+.5));if(z===-.5)assert.deepEqual(plain(outline[i]),[x,z]);});
 assert.deepEqual(shifted.c,before.c);assert.deepEqual(shifted.s,before.s);solid(shifted);near(C.partVolume(shifted),C.partVolume(part),1e-5);
});

test('left-right mirrored wings retain the same fore-aft tip setting and reflect the changed shape',()=>{
 const {ship,part}=fixture('taper');part.outline=C.wingShiftTip(part,-3.25);const mirror=C.mirrorPart(part,ship);
 assert.equal(part.wingTipSide,1);assert.equal(mirror.wingTipSide,-1);near(C.wingTipOffset(mirror),-3.25);
 const a=C.wingShiftTip(part,4.125),b=C.wingShiftTip(mirror,4.125);assert.deepEqual(plain(b),plain(a.map(([x,z])=>[x,-z])));
 ship.parts.push({...mirror,id:ship.nextId++});const loaded=C.deserialize(C.serialize(ship));
 assert.equal(loaded.parts[0].wingTipSide,1);assert.equal(loaded.parts[1].wingTipSide,-1);near(C.wingTipOffset(loaded.parts[1]),-3.25);
});

test('legacy tapered outlines infer opposite tip sides after mirroring without adding a saved field',()=>{
 const {ship,part}=fixture();delete part.wingTipSide;const mirror=C.mirrorPart(part,ship);
 assert.equal(C.wingTipSide(part),1);assert.equal(C.wingTipSide(mirror),-1);near(C.wingTipOffset(part),C.wingTipOffset(mirror));
 assert.equal(Object.hasOwn(part,'wingTipSide'),false);assert.equal(Object.hasOwn(mirror,'wingTipSide'),false);
});

test('paired placement mirrors the explicit root/tip side along with the outline',()=>{
 const ship=C.newShip({L:12,W:8,H:4,assembly:true}),p=C.placePart(ship,'wing',[6,2,6],[8,12,.2],C.wingPlanformPreset('swept'),true),q=ship.parts.find(q=>q.id===p.tw);
 assert.ok(q);assert.equal(p.wingTipSide,1);assert.equal(q.wingTipSide,-1);near(C.wingTipOffset(p),C.wingTipOffset(q));
});

for(const key of ['delta','doubleDelta'])test(`${key} closes at a single zero-thickness tip on either side`,()=>{
 for(const side of [1,-1]){
  const {part}=fixture(key,side),m=solid(part),tips=m.v.filter(q=>Math.abs(q[2]-.5*side)<1e-8);
  assert.equal(tips.length,1);near(tips[0][1],0);
  if(key==='doubleDelta'){assert.ok(m.v.some(q=>Math.abs(q[2])<1e-8));const P=part.outline,slopes=[(P[2][0]-P[1][0])/(P[2][1]-P[1][1]),(P[3][0]-P[2][0])/(P[3][1]-P[2][1])];assert.ok(Math.abs(slopes[0]-slopes[1])>.1);}
  const moved={...plain(part),outline:C.wingShiftTip(part,1.25)};solid(moved);near(C.aeroArea(moved),C.aeroArea(part));near(C.partVolume(moved),C.partVolume(part),1e-5);
 }
});

test('tip movement has finite save-compatible bounds and rejects unsupported or invalid edits',()=>{
 const {part}=fixture('straight'),range=C.wingTipRange(part),before=plain(part);assert.ok(Number.isFinite(range.min)&&Number.isFinite(range.max));
 for(const target of [range.min,range.max]){const P=C.wingShiftTip(part,target);assert.ok(P);assert.ok(P.every(q=>q.every(v=>Number.isFinite(v)&&Math.abs(v)<=2)));near(C.wingTipOffset({...before,outline:P}),target);}
 for(const target of [NaN,Infinity,range.min-1,range.max+1])assert.equal(C.wingShiftTip(part,target),null);
 const baked=C.aeroBake(part);assert.equal(C.wingTipOffset(baked),null);assert.equal(C.wingTipRange(baked),null);assert.equal(C.wingShiftTip(baked,0),null);
 assert.equal(C.wingShiftTip({k:'struct',s:[8,12,.2]},0),null);assert.deepEqual(plain(part),before);
});

test('large wing dimensions and shifted outlines survive a normal design round trip',()=>{
 const ship=C.newShip({L:4,W:3,H:2,assembly:true}),p=C.placePart(ship,'wing',[2,1,10],[32,48,.064],C.wingPlanformPreset('forward'));
 p.outline=C.wingShiftTip(p,20.5);const q=C.deserialize(C.serialize(ship)).parts[0];
 assert.deepEqual(plain(q.s),[32,48,.064]);near(C.wingTipOffset(q),20.5);solid(q);
});
