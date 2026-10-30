const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v));
const stock=C.SHIP_EXAMPLES.craft_xwing.build();
const close=(a,b,message='vector')=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,`${message}[${i}]: ${v} != ${b[i]}`));};
function fixture(){
 const s=C.newShip({L:100,W:80,H:20,assembly:true}),wing={id:1,k:'struct',form:'box',c:[20,10,10],s:[6,8,2],wing:C.normalizeWing({foil:true,axis:'x',open:13,stow:0,T:1,pivot:[20,10,6]})};
 const body={id:2,k:'struct',form:'box',c:[40,12,24],s:[2,2,2]},engine={id:3,k:'engine',c:[40,12,24],d:1,dir:[-1,0,0]},battery={id:4,k:'battery',c:[20,10,10],d:.5};
 s.parts.push(wing,body,engine,battery);s.fits.push({id:5,k:'claser',p:[40,13,24],a:2,host:body.id},{id:6,k:'claser',p:[40,11,24],a:3,host:body.id});s.nextId=10;return {s,wing,body,engine,battery};
}

test('stock X-wing has four independent S-foil assemblies with all carried structures, engines and lasers',()=>{
 const foils=stock.parts.filter(C.isFoil);assert.equal(foils.length,4);const allParts=new Set(),allFits=new Set();
 for(const wing of foils){
  assert.equal(wing.wing.axis,'x');assert.equal(wing.wing.stow,0);assert.equal(wing.wing.T,1);assert.equal(Math.abs(wing.wing.open),13);close(wing.wing.pivot,[2.66,1.832,Math.sign(wing.c[2])*1.05]);
  const members=C.wingMembers(stock,wing);assert.equal(members.structs.length,6);assert.equal(members.parts.length,1);assert.equal(members.parts[0].k,'engine');assert.equal(members.fits.length,1);assert.equal(members.fits[0].k,'claser');
  assert.deepEqual(members.structs.concat(members.parts).map(p=>p.id).sort((a,b)=>a-b),wing.wing.members.parts.slice().sort((a,b)=>a-b));assert.deepEqual(members.fits.map(f=>f.id),wing.wing.members.fits);
  for(const part of [wing,...members.structs,...members.parts]){assert.ok(!allParts.has(part.id));allParts.add(part.id);assert.equal(Math.sign(part.c[2]),Math.sign(wing.c[2]));}
  for(const fit of members.fits){assert.ok(!allFits.has(fit.id));allFits.add(fit.id);}
 }
 assert.equal(allParts.size,32);assert.equal(allFits.size,4);
 for(const p of stock.parts.filter(p=>['gen','cockpit','astromech','fuel','inertial','shield','hyper','battery'].includes(p.k)))assert.ok(!allParts.has(p.id),`${p.k} stays in the fuselage`);
 for(const f of stock.fits.filter(f=>f.k==='ctorp'))assert.ok(!allFits.has(f.id),'torpedoes stay on the fuselage');
});

test('X-wing stowing reverses the authored 13-degree deployment and preserves the saved model',()=>{
 const before=C.publicJSON(stock);
 for(const wing of stock.parts.filter(C.isFoil)){
  const frame=C.foilFrame(stock,wing),members=C.wingMembers(stock,wing),upper=wing.wing.open>0;
  const engine=members.parts[0],closed=C.foilAt(frame,wing,engine.c,0);close(closed,[engine.c[0],upper?2.722:.942,Math.sign(wing.c[2])*1.643],'stowed engine');
  const nacelle=members.structs.find(p=>p.label.includes('機関ナセル'));close(C.foilAt(frame,wing,nacelle.c,0),[nacelle.c[0],upper?2.472:1.192,Math.sign(wing.c[2])*1.643],'stowed nacelle');
  const pose=C.foilPose(stock,wing,wing.wing.stow);assert.equal(pose.parts.length,8);assert.equal(pose.fits.length,1);
  for(const part of members.parts)close(pose.parts.find(p=>p._poseOf===part.id).c,C.foilAt(frame,wing,part.c,0));
  const fit=members.fits[0],posed=pose.fits[0];assert.ok(Math.abs(C.len(C.sub(posed.p,frame.pv))-C.len(C.sub(fit.p,frame.pv)))<1e-7,'carried laser stays at its rigid hinge radius');
 }
 assert.equal(C.publicJSON(stock),before);
 const loaded=C.deserialize(C.serialize(stock));assert.equal(loaded.parts.filter(C.isFoil).length,4);
 for(const wing of stock.parts.filter(C.isFoil)){const copy=loaded.parts.find(p=>p.id===wing.id);assert.deepEqual(plain(copy.wing),plain(wing.wing));assert.deepEqual(C.wingMembers(loaded,copy).structs.map(p=>p.id),C.wingMembers(stock,wing).structs.map(p=>p.id));}
});

test('membership normalization rejects malformed IDs, deduplicates, copies arrays and bounds lists',()=>{
 const input={parts:[1,1,2,0,-1,1.5,NaN,Infinity,'3',Number.MAX_SAFE_INTEGER+1],fits:[4,4,5,null,{}]};const wing=C.normalizeWing({foil:true,members:input});
 assert.deepEqual(plain(wing.members),{parts:[1,2],fits:[4,5]});wing.members.parts.push(9);assert.equal(input.parts.includes(9),false);
 assert.equal(C.normalizeWing({foil:true,members:{parts:'invalid',fits:[]}}).members,undefined);assert.equal(C.normalizeWing({foil:false,members:{parts:[1]}}).members,undefined);
 assert.equal(C.normalizeWing({foil:true,members:{parts:Array.from({length:2000},(_,i)=>i+1)}}).members.parts.length,C.DESIGN_LIMITS.parts);
});

test('explicit carrying extends inference without self, other roots, missing IDs or cross-foil duplicates',()=>{
 const {s,wing,body,engine,battery}=fixture(),other={...plain(wing),id:7,wing:C.normalizeWing({foil:true,members:{parts:[body.id,engine.id],fits:[5]}})};s.parts.push(other);
 wing.wing.members={parts:[wing.id,body.id,body.id,engine.id,other.id,999],fits:[5,5,888]};
 const first=C.wingMembers(s,wing);assert.deepEqual(plain(first.structs.map(p=>p.id)),[body.id]);assert.deepEqual(plain(first.parts.map(p=>p.id)),[engine.id,battery.id]);assert.deepEqual(plain(first.fits.map(f=>f.id)),[5,6]);
 const second=C.wingMembers(s,other);assert.equal(second.structs.length,0);assert.ok(!second.parts.some(p=>p.id===engine.id));assert.equal(second.fits.length,0);
 delete wing.wing.members;delete other.wing.members;assert.equal(C.wingMembers(s,wing).structs.length,0);assert.deepEqual(plain(C.wingMembers(s,wing).parts.map(p=>p.id)),[battery.id],'old designs retain inference');
});

test('horizontal and vertical mirrors remap explicit source IDs to their mirrored partners',()=>{
 const {s,wing,body,engine}=fixture();body.tw=12;body.vt=22;engine.tw=13;engine.vt=23;s.fits[0].tw=15;s.fits[0].vt=25;wing.wing.members={parts:[body.id,engine.id,999],fits:[5,6]};
 const horizontal=C.mirrorPart(wing,s),vertical=C.vmirrorPart(wing,s);
 assert.deepEqual(plain(horizontal.wing.members),{parts:[12,13],fits:[15]});assert.deepEqual(plain(vertical.wing.members),{parts:[22,23],fits:[25]});assert.deepEqual(plain(wing.wing.members),{parts:[2,3,999],fits:[5,6]});
 const starboard=stock.parts.find(p=>C.isFoil(p)&&p.c[2]>0),port=stock.parts.find(p=>p.id===starboard.tw);assert.deepEqual(plain(C.mirrorPart(starboard,stock).wing.members),plain(port.wing.members));
});

test('duplicating only a root does not retain links to the original assembly',()=>{
 const {s,wing}=fixture();wing.wing.members={parts:[2,3],fits:[5]};const copy=C.placePart(s,'struct',[20,30,10],wing.s,wing,false);assert.equal(copy.wing.members,undefined);assert.deepEqual(plain(wing.wing.members),{parts:[2,3],fits:[5]});
});

test('assembly capture and mirrored placement remap pivot coordinates and carried IDs into each new instance',()=>{
 const wing=stock.parts.find(p=>C.isFoil(p)&&p.c[2]>0),members=C.wingMembers(stock,wing),ids={parts:[wing.id,...members.structs.map(p=>p.id),...members.parts.map(p=>p.id)],fits:members.fits.map(f=>f.id)};
 const result=C.assemblyCapture(stock,ids,{name:'S-foil'});assert.ok(result.template);const template=C.normalizeAssemblyTemplate(result.template),localRoot=template.parts.find(C.isFoil);
 assert.deepEqual(localRoot.wing.members.parts.slice().sort((a,b)=>a-b),template.parts.filter(p=>p!==localRoot).map(p=>p.id).sort((a,b)=>a-b));assert.deepEqual(localRoot.wing.members.fits,template.fits.map(f=>f.id));
 const destination=C.newShip({L:200,W:100,H:100,assembly:true});destination.nextId=100;const placed=C.assemblyPlace(destination,template,[80,40,20],{mirror:true});assert.equal(placed.error,undefined);
 const roots=destination.parts.filter(C.isFoil);assert.equal(roots.length,2);
 for(const root of roots){const carried=C.wingMembers(destination,root);assert.equal(carried.structs.length,6);assert.equal(carried.parts.length,1);assert.equal(carried.fits.length,1);for(const id of root.wing.members.parts)assert.ok(id>=100);for(const id of root.wing.members.fits)assert.ok(id>=100);}
 const a=roots.find(p=>p.c[2]>0),b=roots.find(p=>p.c[2]<0);close(b.wing.pivot,C.mirrorP(a.wing.pivot));assert.deepEqual(a.wing.members.parts.map(id=>destination.parts.find(p=>p.id===id).tw),b.wing.members.parts);
 const rootOnly=C.assemblyCapture(stock,{parts:[wing.id],fits:[]},{name:'Root'}).template;assert.equal(rootOnly.parts[0].wing.members,undefined,'uncaptured source members must not remain linked');
});

test('stock X-wing runtime profile exposes four actuators that deploy and stow over one second',()=>{
 const stats=C.computeStats(stock),profile=C.fleetProfile(stats,stock.name,stock),unit={p:profile};
 assert.equal(profile.foils.length,4);assert.deepEqual(profile.foils.map(f=>f.id).sort((a,b)=>a-b),stock.parts.filter(C.isFoil).map(p=>p.id).sort((a,b)=>a-b));
 C.foilInit(unit);assert.deepEqual(plain(unit.fo.d),[0,0,0,0]);C.foilStep(unit,.4,()=>true);for(const d of unit.fo.d)assert.ok(Math.abs(d-.4)<1e-9);C.foilStep(unit,.6,()=>true);assert.deepEqual(plain(unit.fo.d),[1,1,1,1]);
 C.foilStep(unit,.25,()=>false);assert.deepEqual(plain(unit.fo.d),[.75,.75,.75,.75]);C.foilStep(unit,.75,()=>false);assert.deepEqual(plain(unit.fo.d),[0,0,0,0]);
});
