const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const cx=vm.createContext({console,setTimeout:fn=>{cx.timers.push(fn);return cx.timers.length;}}),run=code=>vm.runInContext(code,cx);cx.timers=[];
 run(`let ship={parts:[{id:1,c:[0,0,0]}],fits:[{id:2,p:[0,0,0]}]},S=null,prevS=null,view={uploads:[],meshes:{},upload(k,g){this.uploads.push({k,g});},setGlow(){},setLines(){}},bounds=[],lastOp='',dragSnap=null,dragLabel='';
 const dirty={draw:false,overlay:false},st={coded:false,tab:'mod',foilView:null},fleet={mode:'design'},undoStack=[],redoStack=[],posts=[],previews=[];
 let serializations=0,overlays=0,saves=0;
 const C={publicJSON:s=>{serializations++;return JSON.stringify(s);}},$=()=>null,requestDraw=()=>dirty.draw=true,refreshOverlay=()=>overlays++,scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>saves++,snap=()=>JSON.stringify(ship),YardEngineClient={post:msg=>posts.push(msg)},Gfx={meshPreview:(s,parts,fits)=>{const g={parts:parts.map(p=>({id:p.id,c:p.c.slice()})),fits:fits.map(f=>({id:f.id,p:f.p.slice()}))};previews.push(g);return {preview:g};}};
 `);
 const section=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));};
 section('// ---------- background engine ----------','// ---------- live preview ----------');
 section('// ---------- live preview ----------','// Exterior view skips machinery');
 section('function beginDrag(label)','function undo()');
 run('eng.ready=true;');return{run,cx};
}
test('rapid drag events update one preview per frame and dispatch only the released design',()=>{
 const {run,cx}=setup();run("beginDrag('move');for(let i=1;i<=30;i++){ship.parts[0].c=[i,0,0];queuePreview('parts',[ship.parts[0]]);touch('parts');}");
 assert.equal(run('previews.length'),0,'input handlers must not synchronously rebuild meshes');assert.equal(run('overlays'),0);assert.equal(run('serializations'),0,'no whole-design serialization while holding a control');assert.equal(cx.timers.length,0,'drag samples must not queue full engine rebuilds');assert.equal(run('dirty.overlay'),true);
 run('flushLivePreview()');assert.equal(run('previews.length'),1);assert.deepEqual(plain(run('previews[0].parts')), [{id:1,c:[30,0,0]}]);
 run("ship.parts[0].c=[31,0,0];queuePreview('parts',[ship.parts[0]]);touch('parts');flushLivePreview();endDrag();");assert.equal(run('previews.length'),2);assert.equal(run('undoStack.length'),1);assert.equal(cx.timers.length,1);cx.timers.shift()();
 assert.equal(run('posts.length'),1);assert.deepEqual(plain(run('JSON.parse(posts[0].state).parts[0].c')),[31,0,0]);assert.deepEqual(plain(run('posts[0].what')),['parts']);assert.equal(run('posts[0].gen'),31);
});
test('a frame previews both parts and fittings, and cancellation discards unrendered edits',()=>{
 const {run}=setup();run("queuePreview('parts',[ship.parts[0]]);queuePreview('fits',[ship.fits[0]]);flushLivePreview();");assert.equal(run('previews.length'),1);assert.equal(run('previews[0].parts.length'),1);assert.equal(run('previews[0].fits.length'),1);
 run("queuePreview('parts',[ship.parts[0]]);clearPreview();flushLivePreview();");assert.equal(run('previews.length'),1);assert.equal(run('live.active'),false);assert.equal(run('live.queued'),null);
});
test('a worker completion during a drag performs no upload, state adoption or statistics rendering',()=>{
 const {run}=setup();run("eng.gen=4;eng.sentGen=3;eng.waiting=true;beginDrag('move');onEngineGeometry({gen:3,geos:{hull:{id:'hull-3'}},state:'invalid if adopted'});onEngineStats({gen:3,geos:{parts:{}},stats:{}});");assert.equal(run('view.uploads.length'),0);assert.equal(run('eng.geoGen'),0);assert.equal(run('eng.statsGen'),0);assert.equal(run('S'),null);assert.equal(run('eng.waiting'),false);
});
test('deferred hull and hatch meshes survive a newer part-only update',()=>{
 const {run}=setup();run("eng.gen=2;eng.sentGen=2;onEngineGeometry({gen:1,geos:{hull:{id:'resized'},hatchOpen:{id:'opened'},struct:{id:'old part'}},dims:[200,40,30]});onEngineGeometry({gen:2,geos:{struct:{id:'moved part'}}});");
 assert.deepEqual(plain(run('view.uploads.map(x=>[x.k,x.g.id])')),[['hull','resized'],['hatchOpen','opened'],['struct','moved part']]);assert.deepEqual(plain(run('meshStore.dims')),[200,40,30]);assert.equal(run('meshStore.pendingGeometry'),null);assert.equal(run('eng.geoGen'),2);
});

test('a response from a previous design cannot seed deferred meshes for the newly loaded design',()=>{
 const {run}=setup();run("eng.gen=10;eng.designGen=10;eng.sentGen=10;onEngineGeometry({gen:9,geos:{hull:{id:'previous design'}}});onEngineGeometry({gen:10,geos:{struct:{id:'current design'}}});");assert.deepEqual(plain(run('view.uploads.map(x=>x.g.id)')),['current design']);assert.equal(run('meshStore.pendingGeometry'),undefined);
});

test('a fast current worker response clears a queued preview before it can cover the final mesh',()=>{
 const {run}=setup();run("eng.gen=1;eng.sentGen=1;queuePreview('parts',[ship.parts[0]]);onEngineGeometry({gen:1,geos:{struct:{id:'finished'}}});flushLivePreview();");assert.equal(run('previews.length'),0);assert.equal(run('live.queued'),null);assert.equal(run('view.uploads.length'),1);
});

test('a same-generation worker response waits until release and then requests fresh derived caches',()=>{
 const {run,cx}=setup();run("eng.gen=5;eng.sentGen=5;eng.waiting=true;beginDrag('move');onEngineGeometry({gen:5,geos:{hull:{id:'ready'}},state:'invalid if adopted'});onEngineStats({gen:5,stats:{}});");assert.equal(run('view.uploads.length'),0);assert.equal(run('S'),null);assert.equal(run('eng.geoGen'),0);assert.equal(cx.timers.length,0);
 run('endDrag()');assert.equal(cx.timers.length,1);cx.timers.shift()();assert.equal(run('posts.length'),1);assert.equal(run('posts[0].gen'),5);assert.deepEqual(plain(run('posts[0].what')),['all']);
});
