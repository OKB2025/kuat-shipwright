const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),runtime=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),runtime,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',runtime),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`),vector=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let i=app.indexOf('}',start.index);i>=0;i=app.indexOf('}',i+1)){const code=app.slice(start.index,i+1);try{new vm.Script(code);return code;}catch{}}assert.fail(name);}
function setup({part,request,z=true,y=false,fixtureShip,realGfx=false,respond}={}){
 const ship=fixtureShip||C.newShip({L:100,W:60,H:40,assembly:true},'Mirror tests');if(!fixtureShip){ship.parts=[{id:1,k:'struct',c:[50,0,0],s:[100,60,20],tw:2,vt:3},{id:2,k:'struct',c:[50,0,0],s:[100,60,20],tw:1,vt:4},{id:3,k:'struct',c:[50,0,0],s:[100,60,20],tw:4,vt:1},{id:4,k:'struct',c:[50,0,0],s:[100,60,20],tw:3,vt:2}];ship.fits=[];}
 const calls=[],context=vm.createContext({C,console,structuredClone,ship,part,request,calls,respond});
 context.Gfx=realGfx?G:{structureSurfaceCandidates:(s,o,d,parentId,options)=>{const ideal=C.add(o,C.mul(d,.1)),normal=C.norm(C.mul(d,-1)),p=C.add(ideal,C.mul(normal,-.0095909)),axis=Math.abs(normal[1])>Math.abs(normal[2])?1:2,face=axis===1?(normal[1]>0?'top':'bottom'):(normal[2]>0?'stbd':'port'),hit={p,n:normal,u:[1,0,0],face,parentStructureId:parentId,hostSurfaceId:'p'+parentId+':'+face+':exact'};calls.push({o:o.slice(),d:d.slice(),parentId,options,ideal,hit});return respond?respond(hit,calls.at(-1)): [hit];}};
 vm.runInContext(`const designUI={replaceId:null},st={mirror:${z},vmirror:${y}},designParent=id=>ship.parts.find(p=>p.id===id),designCapability=p=>C.placementCapability(p),publicCopy=x=>JSON.parse(C.publicJSON(x)),editorMountShip=()=>ship,partPreview=hit=>({...part,c:C.add(hit.p,[0,2,0])});`,context);
 vm.runInContext(fn('designUIRequests'),context);return{ship,calls,run:code=>vm.runInContext(code,context),rows:()=>vm.runInContext('designUIRequests(part,request)',context),context};
}
function fitRequest(normal=[0,.6,.8],face='stbd'){const p=[10,10,5],part={id:-1,k:'pd',_fit:true,p:p.slice(),n:normal.slice(),tilt:normal.slice(),assetYaw:30};return {part,request:{part,list:'fits',entityKind:'fit',mode:'direct',parentStructureId:1,hostId:1,hostSurfaceId:'p1:source',hit:{p:p.slice(),n:normal.slice(),u:[1,0,0],face}}};}
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;}

test('left/right fitting mirrors adopt the exact local surface point and tied pose without mutating the source',()=>{const input=fitRequest(),before=JSON.stringify(input);freeze(input);const t=setup(input),rows=t.rows(),mirror=rows[1],actual=t.calls[0].hit;vector(mirror.request.hit.p,actual.p);vector(mirror.part.p,actual.p);vector(mirror.request.hit.n,actual.n);vector(mirror.part.n,actual.n);vector(mirror.part.tilt,actual.n);vector(mirror.request.hit.u,actual.u);assert.equal(mirror.request.hit.face,'port');assert.equal(mirror.request.hostSurfaceId,'p2:port:exact');assert.equal(mirror.request.hostId,2);assert.equal(mirror.request.parentStructureId,2);assert.equal(mirror.part.assetYaw,-30);assert.equal(JSON.stringify(input),before);assert.equal(mirror.request.hit===input.request.hit,false);near(t.calls[0].options.maxDistance,.2);near(C.len(C.sub(actual.p,t.calls[0].ideal)),.0095909);});
test('up/down fitting mirrors preserve explicit upright mounting while updating the actual support normal',()=>{const input=fitRequest([0,1,0],'top');input.part.n=[1,0,0];input.part.tilt=true;input.part.mountMode='top';const before=JSON.stringify(input),t=setup({...input,z:false,y:true,respond:hit=>[{...hit,n:C.norm([0,-1,.001])}]}),mirror=t.rows()[1];vector(mirror.part.n,[1,0,0]);assert.equal(mirror.part.tilt,true);assert.equal(mirror.part.mountMode,'bottom');vector(mirror.request.hit.n,C.norm([0,-1,.001]));assert.equal(mirror.request.hit.face,'bottom');assert.equal(mirror.request.parentStructureId,3);assert.equal(JSON.stringify(input),before);});
test('a horizontal source face does not make explicit upright mounting follow an accidentally equal normal',()=>{const input=fitRequest([0,1,0],'top');input.part.mountMode='top';input.part.tilt=false;const t=setup({...input,z:false,y:true,respond:hit=>[{...hit,n:C.norm([0,-1,.001])}]}),mirror=t.rows()[1];vector(mirror.part.n,[0,-1,0]);assert.equal(mirror.part.tilt,false);vector(mirror.request.hit.n,C.norm([0,-1,.001]));});
test('double mirrors reproject each reflected branch on its own mapped parent',()=>{const input=fitRequest(),before=JSON.stringify(input),t=setup({...input,y:true}),rows=t.rows();assert.deepEqual(Array.from(rows,r=>r.symmetry),['','z','y','zy']);assert.deepEqual(Array.from(rows.slice(1),r=>r.request.parentStructureId),[2,3,4]);for(let i=1;i<rows.length;i++){vector(rows[i].part.p,t.calls[i-1].hit.p);vector(rows[i].request.hit.p,t.calls[i-1].hit.p);assert.equal(rows[i].request.hostSurfaceId,t.calls[i-1].hit.hostSurfaceId);}assert.equal(JSON.stringify(input),before);});
test('horizontal and vertical structure copies shift their anchors without rotating the whole structure to the corrected normal',()=>{for(const mode of ['horizontal','vertical']){const part={id:-1,k:'struct',form:'box',c:[10,12,5],s:[8,6,4],yaw:23,pitch:0,roll:0},request={part,mode,parentStructureId:1,hostId:1,contactSide:'port',hit:{p:[10,10,5],n:[0,.6,.8],u:[1,0,0],face:'stbd'}},before=JSON.stringify({part,request}),t=setup({part,request,respond:hit=>[{...hit,n:C.norm([0,.61,-.79])}]}),mirror=t.rows()[1],expected=C.mirrorPart(part,t.ship),delta=C.sub(t.calls[0].hit.p,t.calls[0].ideal);vector(mirror.part.c,C.add(expected.c,delta));assert.equal(mirror.part.yaw,expected.yaw);assert.equal(mirror.part.pitch,expected.pitch);assert.equal(mirror.part.roll,expected.roll);assert.equal(mirror.request.contactSide,'stbd');assert.equal(JSON.stringify({part,request}),before);}});
test('exterior rigid equipment reflects and corrects both source position and request.position for every mirror branch',()=>{const part={id:-1,k:'shield',c:[10,12,5],d:4},request={part,mode:'direct',parentStructureId:1,hostId:1,hit:{p:[10,10,5],n:[0,.6,.8],face:'stbd'}},before=JSON.stringify({part,request}),t=setup({part,request,y:true}),rows=t.rows();vector(rows[0].request.position,part.c);for(let i=1;i<rows.length;i++){vector(rows[i].request.position,rows[i].part.c);const offset=C.sub(rows[i].part.c,rows[i].request.hit.p);vector(offset,[0,rows[i].symmetry.includes('y')?-2:2,0]);}assert.equal(JSON.stringify({part,request}),before);});
test('missing, reversed, different-face, wrong-parent and distant hits never silently retarget mirrored placement',()=>{for(const respond of [()=>[],hit=>[{...hit,n:C.mul(hit.n,-1)}],hit=>[{...hit,face:'top'}],hit=>[{...hit,parentStructureId:99}],(hit,call)=>[{...hit,p:C.add(call.ideal,C.mul(hit.n,.11))}]]){const input=fitRequest(),before=JSON.stringify(input),t=setup({...input,respond});assert.throws(()=>t.rows(),/対称側の取付面を確認できません/);assert.equal(JSON.stringify(input),before);}});

test('the real Mandator hull UI mirror request adopts the 9.59 mm corrected Worker-survey surface and passes strict Core checks',()=>{const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/mandator2.json.gz'))));raw.fits=[];const ship=C.deserialize(raw);ship.parts=ship.parts.filter(p=>p.id===1154);ship.fits=[];ship.links=[];ship.groups=[];const patches=C.surfacePatches(ship,true);ship._client=true;ship._geoProxy={surfaces:patches};const p=[4821.600024566906,452.51667353965956,290.20000526299526],n=[.03555805480321426,.9853393932621,.16685893690326697],face='p1154:top:2:12e2bm3',part={id:-1,k:'utl',_fit:true,p:p.slice(),n:[0,1,0],a:2,ped:0,mountMode:'top'},request={part,list:'fits',entityKind:'fit',mode:'direct',parentStructureId:1154,hostId:1154,hostSurfaceId:face,hit:{p:p.slice(),n:n.slice(),face:'top'}},before=JSON.stringify({part,request}),publicBefore=C.publicJSON(ship),t=setup({part,request,fixtureShip:ship,realGfx:true}),rows=t.rows(),mirror=rows[1],reflected=[p[0],p[1],-p[2]],distance=C.len(C.sub(mirror.request.hit.p,reflected));assert.ok(distance>.0095&&distance<.0097);assert.equal(mirror.request.hostSurfaceId,face);vector(mirror.part.p,mirror.request.hit.p);vector(mirror.part.n,[0,1,0]);assert.equal(C.publicJSON(ship),publicBefore);for(const row of rows){const solved=C.solveFitPlacement(ship,row.part,row.request);assert.equal(solved.ok,true,solved.error);vector(solved.fit.p,row.request.hit.p);}assert.equal(JSON.stringify({part,request}),before);});

test('an unverifiable mirror clears the old confirmation and reports failure before dispatching another Worker job',()=>{const input=fitRequest(),before=JSON.stringify(input),t=setup({...input,respond:()=>[]});t.run(`
 ship.saveId='mirror-failure';Object.assign(designUI,{armed:true,parentId:1,mode:'direct',sequence:0,pending:{operationId:'old',designId:ship.saveId,state:'ready'}});st.tab='mod';
 const eng={gen:2},requests=[],posts=[],diagnostics=[],view={setPlacementDiagnostics:(s,d)=>diagnostics.push(d)};let hoverLines={valid:true};
 const tool=()=> 'fit',designParents=()=>ship.parts,designUIFitDraft=()=>structuredClone(part),designUIBar=()=>{},requestDraw=()=>{},toast=()=>{},YardEngineClient={post:p=>posts.push(p),request:(type,payload)=>{requests.push(payload);throw Error('No failed mirror should reach the Worker')}};
 `);t.run(fn('designUIRejectTap'));t.run(fn('designUIRequest'));t.run('designUIRequest({...request.hit,parentStructureId:1})');assert.equal(t.run('requests.length'),0);assert.equal(t.run('designUI.pending.state'),'failed');assert.equal(t.run('designUI.pending.request'),null);assert.match(t.run('designUI.pending.result.error'),/対称側の取付面を確認できません/);assert.equal(t.run('hoverLines'),null);assert.equal(t.run('diagnostics.at(-1)'),null);assert.equal(JSON.stringify(input),before);});

test('only a verified pending semantic hit can omit its stable face ID for mirrored Worker validation',()=>{
 const input=fitRequest(),t=setup({...input,respond:hit=>{const raw={...hit,semanticPending:true};delete raw.hostSurfaceId;return [raw];}}),rows=t.rows(),mirror=rows[1];
 assert.equal(mirror.request.hostSurfaceId,undefined,'the UI never invents a semantic face ID');
 assert.equal(mirror.request.parentStructureId,2,'the selected mirrored parent stays explicit');
 vector(mirror.request.hit.p,t.calls[0].hit.p);
 assert.equal(mirror.request.hit.semanticPending,undefined,'ephemeral Gfx validation flags are not persisted');
 for(const respond of [hit=>{const raw={...hit};delete raw.hostSurfaceId;return [raw];},hit=>[{...hit,semanticPending:true,hostSurfaceId:''}],hit=>[{...hit,semanticPending:true,hostSurfaceId:undefined,parentStructureId:99}]])assert.throws(()=>setup({...input,respond}).rows(),/対称側の取付面を確認できません/);
});

test('a mirror onto a separately placed (untwinned) parent goes on the structure that carries the reflected surface',()=>{
 // Two independent structures, one on each side, with no tw link: the mirrored fitting must land on #5, not fail on #1.
 const ship=C.newShip({L:100,W:60,H:40,assembly:true},'Separate parents');ship.parts=[{id:1,k:'struct',c:[50,10,10],s:[20,20,10]},{id:5,k:'struct',c:[50,10,-10],s:[20,20,10]}];
 const input=fitRequest([0,0,1],'stbd');input.request.parentStructureId=1;input.request.hostId=1;
 const t=setup({...input,fixtureShip:ship});
 const probe=(o,d,id)=>{const ideal=C.add(o,C.mul(d,.1)),normal=C.norm(C.mul(d,-1));return {p:ideal,n:normal,face:normal[2]>0?'stbd':'port',hostSurfaceId:'s'+id+':'+(normal[2]>0?'stbd':'port'),parentStructureId:id,part:{id}};};
 t.context.Gfx={structureSurfaceCandidates:(s,o,d,id)=>{const side=o[2]>0?1:5;return id===side?[probe(o,d,id)]:[];},placementSurfaceCandidates:(s,o,d)=>[probe(o,d,o[2]>0?1:5)]};
 const rows=t.rows(),mirror=rows[1];
 assert.equal(rows.length,2);assert.equal(mirror.request.parentStructureId,5,'the mirrored mount uses the structure on the other side');assert.equal(mirror.request.hostId,5);
 assert.ok(mirror.request.hit.p[2]<0,'the mirrored point is on the port side');
});

test('an untwinned parent with no structure at the reflected point still refuses the mirror',()=>{
 const ship=C.newShip({L:100,W:60,H:40,assembly:true},'One-sided parent');ship.parts=[{id:1,k:'struct',c:[50,10,10],s:[20,20,10]}];
 const input=fitRequest([0,0,1],'stbd');input.request.parentStructureId=1;input.request.hostId=1;
 const t=setup({...input,fixtureShip:ship});t.context.Gfx={structureSurfaceCandidates:()=>[],placementSurfaceCandidates:()=>[]};
 assert.throws(()=>t.rows(),/対称側の取付面を確認できません/);
});

for(const client of [false,true])test(`real Gfx (${client?'surveyed client':'core'} path): a mirror onto a separate structure on the other side adopts its real face`,()=>{
 let ship=C.deserialize({format:'starship-yard',v:3,name:'Separate real parents',hull:{L:200,W:100,H:60,assembly:true},parts:[{id:1,k:'struct',form:'box',c:[100,20,25],s:[40,20,20]},{id:5,k:'struct',form:'box',c:[100,20,-25],s:[40,20,20]}],fits:[]});
 if(client){ship._client=true;ship._geoProxy={surfaces:C.surfacePatches(ship,true)};}
 const own=G.structureSurfaceCandidates(ship,[100,20,35.1],[0,0,-1],1,{maxDistance:.2})[0];assert.ok(own,'the source face exists on #1');
 const part={id:-1,k:'pd',_fit:true,p:own.p.slice(),n:[0,0,1],tilt:[0,0,1],assetYaw:0},request={part,list:'fits',entityKind:'fit',mode:'direct',parentStructureId:1,hostId:1,hostSurfaceId:own.hostSurfaceId,hit:{p:own.p.slice(),n:[0,0,1],face:own.face}};
 const t=setup({part,request,fixtureShip:ship,realGfx:true}),rows=t.rows(),mirror=rows[1];
 assert.equal(mirror.request.parentStructureId,5);assert.equal(mirror.request.hostId,5);assert.equal(mirror.request.hit.face,'port');
 assert.ok(/^p5:/.test(mirror.request.hostSurfaceId),'a real face ID on #5');vector(mirror.request.hit.p,[100,20,-35]);
});

test('an untwinned parent whose reflected point lies on a structure with the wrong facing still refuses',()=>{
 // #5 is rotated so the reflected probe meets a face pointing the other way: the strict normal check refuses it.
 let ship=C.deserialize({format:'starship-yard',v:3,name:'Wrong facing',hull:{L:200,W:100,H:60,assembly:true},parts:[{id:1,k:'struct',form:'box',c:[100,20,25],s:[40,20,20]},{id:5,k:'struct',form:'box',c:[100,20,-35.05],s:[40,20,0.1]}],fits:[]});
 const own=G.structureSurfaceCandidates(ship,[100,20,35.1],[0,0,-1],1,{maxDistance:.2})[0];
 const part={id:-1,k:'pd',_fit:true,p:own.p.slice(),n:[0,0,1],tilt:[0,0,1],assetYaw:0},request={part,list:'fits',entityKind:'fit',mode:'direct',parentStructureId:1,hostId:1,hostSurfaceId:own.hostSurfaceId,hit:{p:own.p.slice(),n:[0,0,1],face:own.face}};
 const t=setup({part,request,fixtureShip:ship,realGfx:true});let rows=null,error=null;try{rows=t.rows();}catch(e){error=e;}
 if(rows)assert.ok(rows[1].request.parentStructureId===5&&C.dot(rows[1].request.hit.n,[0,0,-1])>0,'only an outward port face on #5 can be adopted');else assert.match(error.message,/対称側の取付面を確認できません/);
});

test('a pinned host that differs from the parent is never retargeted',()=>{
 const ship=C.newShip({L:100,W:60,H:40,assembly:true},'Pinned host');ship.parts=[{id:1,k:'struct',c:[50,10,10],s:[20,20,10]},{id:5,k:'struct',c:[50,10,-10],s:[20,20,10]}];
 const input=fitRequest([0,0,1],'stbd');input.request.parentStructureId=1;input.request.hostId=7;
 const t=setup({...input,fixtureShip:ship});t.context.Gfx={structureSurfaceCandidates:()=>[],placementSurfaceCandidates:(s,o,d)=>[{p:C.add(o,C.mul(d,.1)),n:C.mul(d,-1),face:'port',hostSurfaceId:'p5:port',parentStructureId:5,part:{id:5}}]};
 assert.throws(()=>t.rows(),/対称側の取付面を確認できません/);
});
