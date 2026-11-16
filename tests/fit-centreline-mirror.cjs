// User report 2026-11-16 (Imperial-class design, a 40 TT triple turret placed on the dorsal apex 0.1 m off the
// centreline with left/right symmetry on): the editor made a mirrored twin 0.2 m away, the two turrets stood in each
// other, the placement was refused for interference and both were reported as floating / with a lost surface.
//  1. A fitting within its own radius of the centreline gets no twin (as Core.placeFit already rules).
//  2. A fitting refused for interference is reported as a clash, not as a floating or lost-surface fitting.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let i=app.indexOf('}',start.index);i>=0;i=app.indexOf('}',i+1)){const code=app.slice(start.index,i+1);try{new vm.Script(code);return code;}catch{}}assert.fail(name);}

test('a mirrored fitting within its own radius of the centreline is placed alone',()=>{
 const ship=C.newShip({L:100,W:60,H:40,assembly:true},'Centreline');ship.parts=[{id:1,k:'struct',form:'box',c:[50,0,0],s:[100,60,20]}];ship.fits=[];ship.nextId=2;
 const context=vm.createContext({C,console,structuredClone,ship,Gfx:{structureSurfaceCandidates:()=>{throw Error('no mirrored request expected');}}});
 vm.runInContext("const designUI={replaceId:null},st={mirror:true,vmirror:false},designParent=id=>ship.parts.find(p=>p.id===id),designCapability=p=>C.placementCapability(p),publicCopy=x=>JSON.parse(C.publicJSON(x)),editorMountShip=()=>ship;",context);
 vm.runInContext(fn('designUIRequests'),context);
 const r=C.FITS.triple40.r;assert.ok(r>1,'the triple turret is wider than the 0.1 m offset');
 for(const z of [0.1,-0.1,0,r*.99]){const part={id:-1,k:'triple40',_fit:true,p:[50,10,z],n:[0,1,0]},request={part,list:'fits',entityKind:'fit',mode:'direct',parentStructureId:1,hostId:1,hit:{p:[50,10,z],n:[0,1,0]}};
  context.part=part;context.request=request;assert.equal(vm.runInContext('designUIRequests(part,request).length',context),1,'z '+z);}
});

test('a fitting refused for interference is reported as a clash, not as floating or with a lost surface',()=>{
 const s=C.newShip({L:300,W:200,H:100,assembly:true},'Clash');s.parts=[{id:1,k:'struct',form:'box',c:[100,10,0],s:[200,160,20]}];s.links=[];s.nextId=2;
 const meta={modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'direct',geometryRevision:1,validationFailed:true,repairRequired:true,repairReason:'placement-interference'};
 s.fits=[2,3].map((id,i)=>({id,k:'triple40',p:[100,20,i?-.1:.1],n:[0,1,0],a:2,ped:0,float:true,mountMode:'top',host:1,local:[0,.5,i?-.0005:.0005],localNormal:[0,1,0],placement:{...meta},tw:i?2:3}));s.nextId=4;
 const L=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s)))),S=C.computeStats(L),bad=(S.warnings||[]).filter(w=>w.lv==='bad').map(w=>w.text);
 assert.ok(bad.some(t=>/重なって取り付けられない装備が 2 基/.test(t)),bad.join(' / '));
 assert.ok(!bad.some(t=>/浮いている|取り付け面を失った/.test(t)),bad.join(' / '));
});
