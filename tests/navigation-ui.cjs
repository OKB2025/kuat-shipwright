const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function source(name){const m=new RegExp('^(?:async )?function '+name+'\\(','m').exec(app);assert.ok(m,name);let end=m.index;for(let i=0;i<500;i++){end=app.indexOf('\n',end+1);assert.ok(end>=0,name+' end');const candidate=app.slice(m.index,end);try{new vm.Script('('+candidate+')');return candidate;}catch{}}throw Error('Unclosed function '+name);}
function setup(){
 const c=vm.createContext({console,setTimeout,clearTimeout});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});
 vm.runInContext(`const C=Core,R=Rts;let messages=[],renders=0,hidden=0,MS=null,msLoaded=false,msLoading=null;const MS_KEY='mission',MS_CLOUD='cloud',MS_RULES={hyper:1800,minJump:1200,foeMax:4},SYSTEMS=Object.fromEntries(Galaxy.SYSTEMS.map(s=>[s.key,{...s,planet:{radius:100},altitude:50}]));
 const esc=x=>String(x??''),num=String,tv={scale:(v,k)=>v.map(x=>x*k),norm:v=>v.map(x=>x/(Math.hypot(...v)||1))},trial={on:true,sysKey:'kuat',mode:'test',jump:null,navigation:null,p:{maxSpeed:100},R:[1,0,0,0,1,0,0,0,1]},GMAP={trial:{sel:'coruscant'}},msUI={foe:'f',cloud:{pulled:false},battle:null};
 const toast=x=>messages.push(x),trialPowerFactor=()=>1,trialHyperClass=()=>2,trialCol=()=>[1,0,0],trialFrame=()=>[1,0,0,0,1,0,0,0,1],galArrivalDir=()=>[1,0,0],spaceCineEnd=()=>{},trialMapShow=()=>{},escortsPlace=()=>{},trialDust=()=>{},trialSys=()=>SYSTEMS[trial.sysKey],gmSysCardHTML=(k,h)=>'<section data-key="'+k+'">'+h+'</section>',gmLegendHTML=()=>'',gmListHTML=()=>'';
 // This harness isolates route selection; actual power and burst motion use
 // real units in hyperspace-trial-physics.cjs. Supply the command dependencies.
 const trialSystemsUnit=()=>null,trialThrottleCommand=()=>trial.throttle??0,trialSetThrottle=v=>{trial.throttle=v;},trialJumpReadinessText=()=>'';
 const voyObTgs=ob=>ob.ctgs.flatMap(c=>c.tgs),voyObShips=ob=>voyObTgs(ob).flatMap(t=>t.ships),msSortieTgs=st=>voyObTgs(st.ob),msReadyShips=t=>t.ships,msHyper=()=>2,msAt=(st,id)=>st.at[id]||st.home,msSave=()=>{msNavigationNormalize(MS);},msScreenRender=()=>renders++,hideTitle=()=>hidden++,renderTitle=()=>renders++;let titleVisible=()=>false;
 let stored=null;const LS={get:()=>stored,set:(k,v)=>{stored=v;}},unpack=async x=>JSON.parse(x),msLoad=()=>MS;`,c);
 vm.runInContext(app.split('\n').find(l=>l.startsWith('const jumpSeconds=')),c);
 for(const name of ['trialDurText','trialJumpSecs','msJumpSeconds','gmPathText','navigationPlanHTML','trialJump','trialArrive','trialMapSide','msValid','msNavigationNormalize','msLoadAsync','msLog','msAdvance','msSortiePlan','msSortieEta','msBattleGo'])vm.runInContext(source(name),c,{filename:'app:'+name});
 return {c,run:s=>vm.runInContext(s,c)};
}

test('the real manual jump command uses the first mandatory stop and preserves the selected final destination after arrival',()=>{
 const {run}=setup(),plan=JSON.parse(run('JSON.stringify(Galaxy.itinerary("kuat","coruscant"))'));assert.ok(plan.segments.length>1);
 run('trialJump("coruscant")');assert.equal(run('trial.jump.dest'),plan.next);assert.equal(run('trial.jump.final'),'coruscant');assert.equal(run('trial.navigation.final'),'coruscant');
 run('trialArrive(trial.jump.dest);trial.jump=null');assert.equal(run('trial.sysKey'),plan.next);assert.equal(run('trial.navigation.waiting'),true);
 const html=run('trialMapSide()');assert.match(html,new RegExp('data-next-stop="'+plan.stops[1]+'"'));assert.match(html,/data-final-destination="coruscant"/);assert.match(html,/停止後は次のジャンプを改めて指示/);
 run('trialJump("coruscant")');assert.equal(run('trial.jump.dest'),plan.stops[1]);assert.equal(run('trial.jump.t'),0);
});

test('a manual main-route command keeps one continuous jump across intermediate systems',()=>{
 const {run}=setup();run(`let mainPair;for(const a of Galaxy.SYSTEMS){for(const b of Galaxy.SYSTEMS){const p=Galaxy.itinerary(a.key,b.key);if(p?.segments.length===1&&p.segments[0].kind==='trunk'&&p.segments[0].legs.length>1){mainPair=[a.key,b.key];break;}}if(mainPair)break;}`);assert.ok(run('mainPair'));run('trial.sysKey=mainPair[0];trialJump(mainPair[1])');assert.equal(run('trial.jump.dest'),run('mainPair[1]'));run('trialArrive(mainPair[1])');assert.equal(run('trial.navigation'),null);
});

test('the actual fleet-card jump handler resumes the saved final destination through a fresh first-segment command',()=>{
 const {run,c}=setup();run(`const dsn=YardFleetData.designs.mc80home,w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[dsn],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:dsn.key}],[]]}),g=[...w.groups.values()][0];let p;for(const s of w.sector.systems){const q=R.routeItinerary(w.sector,g.sys,s.id);if(q?.segments.length>1){p=q;break;}}g.navigation={version:1,final:p.final,stop:g.sys,remaining:p.stops.slice(),waiting:true};const voy={sel:{dest:null},cmd:{type:'jump'}},d={vact:'jump'},voyClock=String,voyRenderSide=()=>renders++;`);
 const line=app.split('\n').find(l=>l.includes("if (d.vact === 'jump' && g)"));assert.ok(line);vm.runInContext('(()=>{'+line+'})()',c);
 assert.equal(run('g.spool.dest'),run('p.next'));assert.equal(run('g.spool.t'),0);assert.equal(run('g.navigation.final'),run('p.final'));assert.equal(run('voy.sel.dest'),null);
});

test('mission movement advances only to this segment and persists a pending plan until another explicit command',async()=>{
 const {run}=setup();run(`MS={version:1,faction:'rebel',home:'kuat',t:0,started:false,at:{t:'kuat'},ob:{ctgs:[{tgs:[{id:'t',ships:[{id:'s'}]}]}]},foes:[{id:'f',sys:'coruscant',until:1e12}],log:[]};`);
 const stops=JSON.parse(run('JSON.stringify(Galaxy.itinerary("kuat","coruscant").stops)'));assert.ok(stops.length>=3);
 await run('msBattleGo()');assert.equal(run('MS.at.t'),stops[0]);assert.equal(run('MS.navigation.t.final'),'coruscant');assert.equal(run('MS.navigation.t.waiting'),true);assert.equal(run('hidden'),0);assert.ok(run('MS.t')>0);
 run('msAdvance(MS,600)');assert.equal(run('MS.at.t'),stops[0]);assert.equal(run('MS.navigation.t.waiting'),true);
 await run('msBattleGo()');assert.equal(run('MS.at.t'),stops[1]);assert.equal(run('MS.navigation.t.final'),'coruscant');assert.equal(run('hidden'),0);
});

test('local mission save reload rebuilds pending stops from the real graph and sanitizes old or malformed navigation fields',async()=>{
 const {run}=setup();run(`stored=JSON.stringify({version:1,faction:'rebel',home:'kuat',at:{t:'kuat'},ob:{ctgs:[{tgs:[{id:'t',ships:[]}]}]},foes:[],navigation:{t:{version:1,final:'coruscant',stop:'not-a-system',remaining:'bad'}}});`);
 await run('msLoadAsync()');assert.equal(run('MS.at.t'),'kuat');assert.equal(run('MS.navigation.t.waiting'),true);assert.equal(run('MS.navigation.t.stop'),'kuat');assert.ok(run('Array.isArray(MS.navigation.t.remaining)'));
 const before=run('JSON.stringify(MS.navigation)');run('stored=JSON.stringify(MS);msLoaded=false;MS=null');await run('msLoadAsync()');assert.equal(run('JSON.stringify(MS.navigation)'),before);
 run('stored=JSON.stringify({...MS,navigation:{t:{version:1,final:"missing"}}});msLoaded=false;MS=null');await run('msLoadAsync()');assert.equal(run('Object.keys(MS.navigation).length'),0);
 run('stored=JSON.stringify({...MS,navigation:undefined});msLoaded=false;MS=null');await run('msLoadAsync()');assert.equal(run('Object.keys(MS.navigation).length'),0);
});

test('cloud mission restore applies the same itinerary validation before consumers can read saved fields',async()=>{
 const {run,c}=setup();vm.runInContext(source('msCloudPull'),c);run(`stored=null;msLoaded=true;MS=null;msUI.cloud.pulled=false;const cloudState={version:1,faction:'rebel',home:'kuat',savedAt:2,at:{t:'kuat'},ob:{ctgs:[{tgs:[{id:'t',ships:[]}]}]},foes:[],navigation:{t:{version:1,final:'coruscant',remaining:null}}};const Store={db:true,init:async()=>{},col:()=>({doc:()=>({get:async()=>({exists:true,data:()=>({kind:'mission',savedAt:2,data:JSON.stringify(cloudState)})})})})};`);
 // The real cloud callback is asynchronous and intentionally returns no Promise.
 run('titleVisible=()=>true');run('msCloudPull()');await new Promise(resolve=>setTimeout(resolve,20));assert.equal(run('MS.at.t'),'kuat');assert.equal(run('MS.navigation.t.final'),'coruscant');assert.equal(run('Array.isArray(MS.navigation.t.remaining)'),true);
});
