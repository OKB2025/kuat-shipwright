const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),html=fs.readFileSync(process.env.KS_SPLASH_HTML||path.join(root,'index.html'),'utf8'),start=html.indexOf('const splashEl ='),end=html.indexOf('\nlet workerReady;',start);assert.ok(start>0&&end>start);const source=html.slice(start,end);
class Classes{constructor(...v){this.values=new Set(v);}add(...v){v.forEach(x=>this.values.add(x));}remove(...v){v.forEach(x=>this.values.delete(x));}contains(v){return this.values.has(v);}}
class Target{constructor(){this.listeners=new Map();}addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}dispatch(type,values={}){const event={type,preventDefault(){this.prevented=true;},...values};for(const fn of this.listeners.get(type)||[])fn(event);return event;}}
function setup(mode='pending'){
 const splash=new Target(),window=new Target(),button={hidden:true,focus(){}},body={classList:new Classes()},timers=[],storage=new Map([['yard.draft3','old-or-large-draft-must-remain-byte-identical'],['ks.audio.v1','{"muted":true,"master":0}']]);let calls=0,hiddenInsideAudio=false;
 Object.assign(splash,{classList:new Classes(),style:{setProperty(){}},querySelector:s=>s==='.splash-start'?button:s==='.splash-bar'?{setAttribute(){}}:{textContent:''},remove(){this.removed=true;}});
 Object.assign(window,{KSAudio:{unlock(){calls++;hiddenInsideAudio=splash.classList.contains('out')&&!body.classList.contains('splash-on');if(mode==='throw')throw Error('audio unavailable');if(mode==='reject')return Promise.reject(Error('audio denied'));return new Promise(()=>{});}}});
 const c=vm.createContext({console,window,document:{getElementById:()=>splash,body},navigator:{webdriver:false},location:{search:'?splash'},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});vm.runInContext(source+'\nglobalThis.api={ready:splashReady,go:splashGo,forceGone:()=>{SPL.gone=true;},get gone(){return SPL.gone;}};',c);
 return{api:c.api,splash,window,body,button,timers,storage,get calls(){return calls;},get hiddenInsideAudio(){return hiddenInsideAudio;}};
}
test('a primary pointer release enters before pending audio and repeated compatibility events stay one-shot',()=>{
 const x=setup();x.splash.dispatch('pointerup',{isPrimary:true});assert.equal(x.api.gone,false);x.api.ready();x.splash.dispatch('pointerup',{isPrimary:false});assert.equal(x.api.gone,false);
 x.splash.dispatch('pointerup',{isPrimary:true});assert.equal(x.api.gone,true);assert.equal(x.hiddenInsideAudio,true);assert.equal(x.body.classList.contains('splash-on'),false);x.splash.dispatch('touchend',{touches:[]});x.splash.dispatch('click');assert.equal(x.calls,1);
});
test('a touchend without a synthesized click opens the ready splash and preserves saved data',()=>{
 const x=setup(),before=[...x.storage];x.api.ready();x.splash.dispatch('touchend',{touches:[]});assert.equal(x.api.gone,true);assert.equal(x.splash.classList.contains('out'),true);assert.deepEqual([...x.storage],before);assert.equal(x.calls,1);
});
test('throwing and rejected audio cannot retain the splash or produce an unhandled rejection',async()=>{
 for(const mode of ['throw','reject']){const x=setup(mode);x.api.ready();x.splash.dispatch('click');assert.equal(x.api.gone,true);assert.equal(x.hiddenInsideAudio,true);assert.equal(x.body.classList.contains('splash-on'),false);await new Promise(resolve=>setImmediate(resolve));}
});
test('keyboard entry remains accessible and commits the same one-shot transition',()=>{
 const x=setup();x.api.ready();const e=x.splash.dispatch('keydown',{key:'Enter'});assert.equal(e.prevented,true);assert.equal(x.api.gone,true);assert.equal(x.calls,1);
});
test('pageshow reconciles a restored entered splash without audio or saved-data changes',()=>{
 const x=setup(),before=[...x.storage];x.api.ready();x.api.forceGone();assert.equal(x.splash.classList.contains('out'),false);x.window.dispatch('pageshow',{persisted:true});assert.equal(x.splash.removed,true);assert.equal(x.body.classList.contains('splash-on'),false);assert.equal(x.calls,0);assert.deepEqual([...x.storage],before);
 const y=setup();y.api.ready();y.splash.classList.add('out');y.window.dispatch('pageshow',{persisted:true});assert.equal(y.splash.removed,true);assert.equal(y.api.gone,true);
});
test('pageshow never bypasses actual startup readiness',()=>{const x=setup();x.window.dispatch('pageshow',{persisted:true});assert.equal(x.api.gone,false);assert.equal(x.splash.removed,undefined);assert.equal(x.button.hidden,true);});
