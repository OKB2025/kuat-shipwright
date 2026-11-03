const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,why='structural material differs',tol=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1e-6,Math.abs(b)*tol),`${why}: ${a} != ${b}`);
function ship(assembly=true){const s=C.newShip({L:300,W:200,H:160,assembly,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1},'Structural union review');s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};s.detail=0;return s;}
function box(s,c=[100,40,0],size=[100,40,60],opt={}){const p=C.placePart(s,'struct',c,size,{form:'box',...opt},false);assert.ok(p?.id);return p;}
function uniform(S,p,volume,why){near(S.mass,volume*C.K.structDens,why+' mass',1e-6);near(S.cost,Math.round(C.partBuildCost(p,volume)),why+' cost',1e-6);}
function material(S,id,volume){near(S.info[id]?.materialVolume,volume,'owned material volume for part'+id,1e-6);}

test('coincident structural objects retain editable geometry while shared material is charged once',()=>{
 const s=ship(),a=box(s),original=plain(C.serialize(s).parts[0]),single=C.computeStats(s),b=box(s);const S=C.computeStats(s);near(S.mass,single.mass,'duplicate geometry cannot create a second material mass');near(S.cost,single.cost,'duplicate geometry cannot create a second material bill');near(S.hp,single.hp,'the same shared material cannot create an extra structural HP budget');uniform(S,a,240000,'coincident boxes');assert.equal(s.parts.length,2);assert.deepEqual(plain(C.serialize(s).parts.find(p=>p.id===a.id)),original);near(C.partVolume(a),240000,'full requested object volume stays available to the editor');near(C.partVolume(b),240000);material(S,a.id,240000);material(S,b.id,0);const loaded=C.deserialize(C.serialize(s));const after=C.computeStats(loaded);near(after.mass,S.mass);near(after.cost,S.cost);assert.equal(loaded.parts.length,2);
});

test('a partial structural intersection contributes only its exclusive material and never depends on array order',()=>{
 const s=ship(),a=box(s),b=box(s,[150,40,0]),before=plain(C.serialize(s).parts),S=C.computeStats(s);uniform(S,a,360000,'100×40×60 plus100×40×60 minus50×40×60');material(S,a.id,240000);material(S,b.id,120000);s.parts.reverse();const reordered=C.computeStats(s);near(reordered.mass,S.mass);near(reordered.cost,S.cost);material(reordered,a.id,240000);material(reordered,b.id,120000);assert.deepEqual(plain(C.serialize(s).parts).sort((a,b)=>a.id-b.id),before.sort((a,b)=>a.id-b.id));
});

test('touching or separated structural solids keep their complete material instead of shrinking contact neighbors',()=>{
 for(const x of [200,210]){const s=ship(),a=box(s),b=box(s,[x,40,0]),S=C.computeStats(s);uniform(S,a,480000,'non-overlapping boxes');near(C.partVolume(a),240000);near(C.partVolume(b),240000);assert.equal(s.parts.length,2);}
});

test('a normal structural block owns material over a light block without depending on source array order',()=>{
 const s=ship(),light=box(s);light.light=true;const normal=box(s),S=C.computeStats(s);near(S.mass,240000*C.K.structDens,'normal material cannot be replaced by a coincident lighter scaffold');near(S.cost,Math.round(C.partBuildCost(normal,240000)));material(S,light.id,0);material(S,normal.id,240000);s.parts.reverse();const again=C.computeStats(s);near(again.mass,S.mass);near(again.cost,S.cost);material(again,light.id,0);material(again,normal.id,240000);
});

test('rotated and cut solids use their actual closed material rather than overlapping world bounding boxes',()=>{
 const rotation={yaw:31,pitch:17,roll:23},s=ship(),a=box(s,[100,100,0],[100,40,60],rotation),b=box(s,C.worldStruct(a,[50,0,0]),[100,40,60],rotation),S=C.computeStats(s);uniform(S,a,360000,'rigidly rotated partial union');material(S,a.id,240000);material(S,b.id,120000);
 const cut=ship(),first=box(cut),second=box(cut);cut.solidCuts.push(C.normalizeSolidCut({id:cut.nextId++,shape:'box',c:[100,40,0],s:[20,80,80],structures:true}));const after=C.computeStats(cut);uniform(after,first,192000,'two coincident boxes sharing a20m through cut');material(after,first.id,192000);material(after,second.id,0);assert.equal(cut.parts.length,2);
});

test('hull-owned material is not billed again and independent native equipment keeps its full physical mass and output',()=>{
 const hull=ship(false),empty=C.computeStats(hull),inside=box(hull,[150,80,0],[20,20,20]),covered=C.computeStats(hull);near(covered.mass,empty.mass,'structure entirely inside existing hull material');near(covered.cost,empty.cost,'existing hull material is not purchased twice');material(covered,inside.id,0);near(C.partVolume(inside),8000);
 const s=ship(),host=box(s),device={id:s.nextId++,k:'gen',c:[100,40,0],d:10};s.parts.push(device);const native=plain(C.serialize(s).parts.find(p=>p.id===device.id)),V=C.partVolume(device),one=C.computeStats(s);box(s);const duplicate=C.computeStats(s);near(duplicate.mass,one.mass,'structural union does not remove native generator mass');near(duplicate.cost,one.cost);near(duplicate.power,one.power,'native generation is unchanged by structural ownership');near(C.partVolume(device),V);assert.deepEqual(plain(C.serialize(s).parts.find(p=>p.id===device.id)),native);const clear=ship(),bare=box(clear),base=C.computeStats(clear);near(duplicate.mass-base.mass,V*C.PARTS.gen.dens,'native equipment contributes its entire own material');assert.equal(s.parts.length,3);near(C.partVolume(host),240000);near(C.partVolume(bare),240000);
});
