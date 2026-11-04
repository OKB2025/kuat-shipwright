const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
function fixture(){const s=C.newShip({L:240,W:200,H:140,assembly:true},'AA platforms');s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};const host=C.placePart(s,'struct',[120,50,0],[200,160,100],{form:'box'},false);return {s,host};}
function install(s,hit,size,mirror=false){const p=C.sponsonPreview(hit,size);assert.ok(p);return C.placePart(s,p.k,p.c,p.s,p,mirror);}

test('sponsons make a horizontal deck rooted into hull or structure walls, including sloped and fore/aft walls',()=>{
 for(const n of [[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[.5,.4,.7]]){
  const hit={kind:'hull',p:[120,60,80],n},p=C.sponsonPreview(hit),out=C.norm([n[0],0,n[2]]),fr=C.structFrame(p),T=C.structTriangles(p);
  assert.equal(p.k,'struct');assert.equal(p.sponson,true);assert.equal(p.form,'chamfer');near(C.dot(fr.rt,out),1);near(fr.up[1],1);near(p.c[1],57.5);
  const outward=[],heights=[];for(let i=0;i<T.length;i+=3){const q=Array.from(T.slice(i,i+3));outward.push(C.dot(C.sub(q,hit.p),out));heights.push(q[1]);}
  near(Math.min(...outward),-4);near(Math.max(...outward),16);near(Math.max(...heights),60);near(Math.min(...heights),55);
 }
 const {s,host}=fixture(),p=install(s,{kind:'part',part:host,p:[120,60,80],n:[0,0,1]});assert.ok(C.inStruct(host,[120,57.5,78]));assert.ok(C.inStruct(p,[120,57.5,78]),'the root overlaps the host rather than floating outside it');
 const deck=C.rayEnv(s,[120,70,89],[0,-1,0],{structOnly:true});assert.equal(deck.part.id,p.id);near(deck.p[1],60);near(deck.n[1],1);
});

test('wall validation rejects horizontal faces, fitted equipment, compartments, section cuts and invalid coordinates',()=>{
 const good={kind:'hull',p:[120,60,80],n:[0,0,1]};assert.ok(C.canPlaceSponson(good));
 for(const h of [null,{...good,kind:'section'},{...good,n:[0,1,0]},{...good,n:[0,-1,0]},{...good,n:[0,0,0]},{...good,n:[NaN,0,1]},{...good,p:[120,Infinity,80]},{...good,fit:{k:'pd'}},{...good,kind:'part',part:{k:'gen'}},{...good,kind:'part',part:{k:'wing'}},{...good,kind:'part'}]){assert.equal(C.canPlaceSponson(h),false);assert.equal(C.sponsonPreview(h),null);}
 assert.deepEqual(plain(C.sponsonPreview(good,[Infinity,-20,999]).s),[24,10,40]);assert.deepEqual(plain(C.sponsonPreview(good,[999,999,-2]).s),[200,120,2]);
});

test('mirrors and save/reload retain ordinary editable geometry and the local deck marker',()=>{
 const {s,host}=fixture(),p=install(s,{kind:'part',part:host,p:[120,60,80],n:[0,0,1]},[36,28,6],true),pair=s.parts.find(q=>q.id===p.tw),vertical=C.vmirrorPart(p,s);
 assert.ok(pair.sponson);near(pair.c[2],-p.c[2]);assert.ok(vertical.sponson);near(vertical.c[0],p.c[0]);
 vertical.id=s.nextId++;p.vt=vertical.id;vertical.vt=p.id;s.parts.push(vertical);
 const loaded=C.deserialize(C.serialize(s));for(const q of [p,pair,vertical]){const a=loaded.parts.find(x=>x.id===q.id);assert.equal(a.sponson,true);assert.equal(a.label,'張出し砲座');assert.deepEqual(plain(a.s),[36,28,6]);assert.deepEqual(plain(C.partAABB(a)),plain(C.partAABB(q)));}
 loaded.parts[0].sponson=true;const raw=plain(C.serialize(loaded));raw.parts.push({id:99,k:'gen',d:10,c:[120,50,0],sponson:true});assert.equal(C.deserialize(raw).parts.find(q=>q.id===99).sponson,undefined,'compartments cannot be imported as mounting decks');
});

test('a point-defense turret stays on the selected lower deck under an overhang, including mirrored mounts and reload',()=>{
 const {s,host}=fixture(),p=install(s,{kind:'part',part:host,p:[120,60,80],n:[0,0,1]},undefined,true);
 C.placePart(s,'struct',[120,100,91],[50,35,5],{form:'box'},true);
 const r=C.placeFit(s,'pd',[120,60,89],[0,1,0],0,true,{localMount:true});assert.ok(r.fit,r.err);assert.equal(s.fits.length,2);
 for(const f of s.fits){near(f.p[1],60);assert.equal(f.localMount,true);assert.equal(f.float,false);near(f.base,0);}
 const loaded=C.deserialize(C.serialize(s));C.remount(loaded);for(const f of loaded.fits){near(f.p[1],60);assert.equal(f.localMount,true);assert.equal(f.float,false);}
 const top=C.rayEnv(s,[120,200,89],[0,-1,0],{structOnly:true});assert.ok(top.p[1]>100,'the fixture includes a higher deck that an unrestricted mount would select');
});
