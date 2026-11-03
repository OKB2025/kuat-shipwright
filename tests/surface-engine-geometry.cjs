const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),{performance}=require('node:perf_hooks');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function fixture(){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const name of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),cx,{filename:name});
 const engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');vm.runInContext(engine.slice(0,engine.indexOf('/* Interface-side connection')),cx,{filename:'js/engine.js'});
 const {C,G,E}=vm.runInContext('({C:Core,G:Gfx,E:YardEngine})',cx),pending=[];
 const scope={postMessage(message){if(message.type==='ready')return;const i=pending.findIndex(p=>message.type==='error'?p.id===message.id||p.gen===message.gen:message.type===p.type&&(p.id==null?message.gen===p.gen:message.id===p.id));if(i<0)return;const p=pending.splice(i,1)[0];message.type==='error'?p.reject(new Error(message.message)):p.resolve(message);}};
 E.listenWorker(scope);let gen=0,id=0;
 const request=(data,type)=>new Promise((resolve,reject)=>{pending.push({...data,type,resolve,reject});scope.onmessage({data});});
 const update=(ship,what='all',reset=false)=>request({type:'update',gen:++gen,state:C.publicJSON(ship),what:[what],reset,stats:false},'geometry');
 const op=(ship,options={})=>request({type:'op',id:++id,gen:++gen,state:C.publicJSON(ship),op:'surfaceAuto',args:[options]},'op');
 const ship=C.newShip({L:80,W:60,H:40,plan:'rect',sec:'rect'},'Live surface engine');ship.parts=[];ship.fits=[];ship.nextId=1;ship.armor={hull:0,cit:0};ship.detail=0;
 return{C,G,ship,update,op};
}
const plain=v=>JSON.parse(JSON.stringify(v));
function key(g){assert.ok(g);return JSON.stringify({pos:Array.from(g.pos.slice(0,g.n*3)),idx:Array.from(g.idx.slice(0,g.ni))});}

test('live geometry updates replace and restore hull skin after equipment Apply, Undo and Redo',async()=>{
 const {C,G,ship,update}=fixture(),base=await update(ship,'all',true),saved=C.publicJSON(ship),physical=Array.from(C.hullGeo(ship).tris);
 const face=C.surfacePatches(ship).find(p=>p.host==='hull'&&p.face==='port');assert.ok(face?.exposed);
 assert.equal(C.setSurfaceConfig(ship,face.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:1,limit:4},battery:{count:0}}).ok,true);
 const edited=C.publicJSON(ship),changed=await update(ship);
 assert.ok(changed.geos.hull,'a surface mode edit must invalidate the worker hull cache');assert.notEqual(key(changed.geos.hull),key(base.geos.hull));assert.equal(key(changed.geos.hull),key(G.meshHull(JSON.parse(changed.state))));
 const undo=await update(JSON.parse(saved));assert.equal(key(undo.geos.hull),key(base.geos.hull),'Undo must restore the complete opaque hull without reloading');
 const redo=await update(JSON.parse(edited));assert.equal(key(redo.geos.hull),key(changed.geos.hull),'Redo must remove the selected skin again');assert.deepEqual(Array.from(C.hullGeo(ship).tris),physical,'rendering a recess must retain the common physical collision envelope');
});

test('moving a structure across an equipment hull face refreshes the live exposed-skin mask',async()=>{
 const {C,G,ship,update}=fixture(),face=C.surfacePatches(ship).find(p=>p.host==='hull'&&p.face==='port');
 C.setSurfaceConfig(ship,face.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:1,limit:2},battery:{count:0}});
 const first=await update(ship,'all',true),cover={id:ship.nextId++,k:'struct',form:'box',c:[10,20,-35],s:[26,12,44],taper:0};ship.parts.push(cover);
 const covered=await update(ship,'parts');assert.ok(covered.geos.hull,'part edits can change hull equipment exposure');assert.notEqual(key(covered.geos.hull),key(first.geos.hull));assert.equal(key(covered.geos.hull),key(G.meshHull(JSON.parse(covered.state))));
 cover.c=[10,20,-100];const revealed=await update(ship,'parts');assert.equal(key(revealed.geos.hull),key(first.geos.hull));assert.equal(key(revealed.geos.hull),key(G.meshHull(JSON.parse(revealed.state))));
});

test('the background operation returns an automatic equipment plan without changing the caller design',async()=>{
 const {C,ship,op}=fixture(),before=C.publicJSON(ship),result=await op(ship,{equipment:{limit:3},allocation:{cooling:50,sensors:25,habitation:25}});
 assert.equal(result.result.ok,true);assert.ok(result.result.ids.length>0);assert.equal(C.publicJSON(ship),before);const loaded=JSON.parse(result.state),rows=C.surfaceReport(loaded).patches.filter(p=>result.result.ids.includes(p.id));
 assert.ok(rows.every(p=>p.config.functionMode==='equipment'&&p.config.battery.count===0));assert.equal(loaded.fits.length,0);assert.ok(loaded.parts.some(p=>p.surfacePatch));assert.ok(rows.every(p=>p.cells.filter(c=>c.role!=='weapons').length<=3));assert.deepEqual(plain(rows.map(p=>p.id).sort()),plain(result.result.ids.slice().sort()));
});
