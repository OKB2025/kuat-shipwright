const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),html=fs.readFileSync(process.env.KS_SPLASH_HTML||path.join(root,'index.html'),'utf8'),start=html.indexOf('const splashEl ='),end=html.indexOf('\nlet workerReady;',start);assert.ok(start>0&&end>start);const source=html.slice(start,end);
class Classes{constructor(...v){this.values=new Set(v);}add(...v){v.forEach(x=>this.values.add(x));}remove(...v){v.forEach(x=>this.values.delete(x));}contains(v){return this.values.has(v);}}
class Target{
 constructor(parent=null){this.parent=parent;this.listeners=new Map();}
 addEventListener(type,fn,options={}){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push({fn,capture:options===true||!!options.capture,once:!!options.once});}
 removeEventListener(type,fn,options={}){const capture=options===true||!!options.capture;this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x.fn!==fn||x.capture!==capture));}
 contains(target){for(let node=target;node;node=node.parent)if(node===this)return true;return false;}
 dispatch(type,values={}){
  const event={type,target:this,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;},...values},path=[];
  for(let node=event.target;node;node=node.parent)path.push(node);
  const invoke=(node,capture)=>{event.currentTarget=node;for(const x of [...node.listeners.get(type)||[]])if(x.capture===capture){x.fn(event);if(x.once)node.removeEventListener(type,x.fn,{capture});if(event.immediate)break;}};
  for(const node of [...path].reverse()){invoke(node,true);if(event.stopped)return event;}
  for(const node of path){invoke(node,false);if(event.stopped)break;}
  return event;
 }
}
function setup(mode='pending',{documentAudio=false}={}){
 const window=new Target(),document=new Target(window),body=Object.assign(new Target(document),{classList:new Classes()}),splash=new Target(body),button=Object.assign(new Target(splash),{hidden:true,focus(){}}),label=new Target(button),outside=new Target(body),timers=[],audioTrace=[],storage=new Map([['yard.draft3','old-or-large-draft-must-remain-byte-identical'],['ks.audio.v1','{"muted":true,"master":0}']]);let calls=0,hiddenInsideAudio=false;
 Object.assign(splash,{classList:new Classes(),style:{setProperty(){}},querySelector:s=>s==='.splash-start'?button:s==='.splash-bar'?{setAttribute(){}}:{textContent:''},remove(){this.removed=true;this.parent=null;}});
 const audioInit=origin=>{const hidden=splash.classList.contains('out')&&!body.classList.contains('splash-on');audioTrace.push({origin,hidden});return hidden;};
 Object.assign(window,{KSAudio:{unlock(){calls++;hiddenInsideAudio=audioInit('splash unlock');if(mode==='throw')throw Error('audio unavailable');if(mode==='reject')return Promise.reject(Error('audio denied'));return new Promise(()=>{});}}});
 // KSAudio installs document-capture gestures before the splash's own target
 // listeners run. Include that ancestor path so ordering failures are visible.
 if(documentAudio)for(const type of ['pointerdown','pointerup','touchend','keydown','click'])document.addEventListener(type,()=>audioInit('document capture'),true);
 Object.assign(document,{getElementById:()=>splash,body});
 const c=vm.createContext({console,window,document,navigator:{webdriver:false},location:{search:'?splash'},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});vm.runInContext(source+'\nglobalThis.api={ready:splashReady,go:splashGo,forceGone:()=>{SPL.gone=true;},get gone(){return SPL.gone;}};',c);
 return{api:c.api,splash,window,document,body,button,label,outside,timers,storage,audioTrace,get calls(){return calls;},get hiddenInsideAudio(){return hiddenInsideAudio;}};
}
test('the first ready pointerdown or touchstart enters even if release and click never arrive',()=>{
 for(const type of ['pointerdown','touchstart']){
  const x=setup('pending',{documentAudio:true}),before=[...x.storage];x.api.ready();x.label.dispatch(type,{isPrimary:true,touches:[{}]});
  assert.equal(x.api.gone,true,type);assert.equal(x.body.classList.contains('splash-on'),false);assert.equal(x.hiddenInsideAudio,true);assert.equal(x.calls,1);
  assert.ok(x.audioTrace.length);assert.ok(x.audioTrace.every(x=>x.hidden),'audio graph initialization sees the dismissed splash');assert.deepEqual([...x.storage],before);
 }
});
test('window capture dismisses the ready splash before document audio capture or target handlers',()=>{
 for(const [type,values] of [['pointerdown',{isPrimary:true}],['pointerup',{isPrimary:true}],['touchend',{touches:[]}],['click',{}],['keydown',{key:'Enter'}]]){
  const x=setup('pending',{documentAudio:true});x.api.ready();let goneAtTarget=false;x.button.addEventListener(type,()=>{goneAtTarget=x.api.gone;});x.button.dispatch(type,values);
  assert.equal(x.api.gone,true,type);assert.equal(goneAtTarget,true,type);assert.equal(x.audioTrace[0].origin,'splash unlock',type);assert.ok(x.audioTrace.every(x=>x.hidden),type);
 }
});
test('early gestures respect readiness, splash containment and primary single-touch input',()=>{
 const x=setup();for(const type of ['pointerdown','touchstart','pointerup','touchend','click']){x.label.dispatch(type,{isPrimary:true,touches:[]});assert.equal(x.api.gone,false,type);}assert.equal(x.calls,0);
 x.api.ready();for(const type of ['pointerdown','touchstart','pointerup','touchend','click','keydown']){x.outside.dispatch(type,{isPrimary:true,touches:[],key:'Enter'});assert.equal(x.api.gone,false,type);}assert.equal(x.calls,0);
 x.label.dispatch('pointerdown',{isPrimary:false});x.label.dispatch('touchstart',{touches:[{},{}]});x.label.dispatch('keydown',{key:'Escape'});assert.equal(x.api.gone,false);assert.equal(x.calls,0);
 x.label.dispatch('touchstart',{touches:[{}]});assert.equal(x.api.gone,true);assert.equal(x.calls,1);
});
test('pointer, touch and click compatibility events commit entry and start splash audio only once',()=>{
 const x=setup('pending',{documentAudio:true});x.api.ready();for(const [type,values] of [['pointerdown',{isPrimary:true}],['touchstart',{touches:[{}]}],['pointerup',{isPrimary:true}],['touchend',{touches:[]}],['click',{}]])x.label.dispatch(type,values);
 assert.equal(x.api.gone,true);assert.equal(x.calls,1);assert.equal(x.timers.length,1);assert.ok(x.audioTrace.every(x=>x.hidden));
});
test('a primary pointer release enters before pending audio and repeated compatibility events stay one-shot',()=>{
 const x=setup();x.splash.dispatch('pointerup',{isPrimary:true});assert.equal(x.api.gone,false);x.api.ready();x.splash.dispatch('pointerup',{isPrimary:false});assert.equal(x.api.gone,false);
 x.splash.dispatch('pointerup',{isPrimary:true});assert.equal(x.api.gone,true);assert.equal(x.hiddenInsideAudio,true);assert.equal(x.body.classList.contains('splash-on'),false);x.splash.dispatch('touchend',{touches:[]});x.splash.dispatch('click');assert.equal(x.calls,1);
});
test('a touchend without a synthesized click opens the ready splash and preserves saved data',()=>{
 const x=setup(),before=[...x.storage];x.api.ready();x.splash.dispatch('touchend',{touches:[]});assert.equal(x.api.gone,true);assert.equal(x.splash.classList.contains('out'),true);assert.deepEqual([...x.storage],before);assert.equal(x.calls,1);
});
test('throwing and rejected audio cannot retain the splash or produce an unhandled rejection',async()=>{
 for(const mode of ['throw','reject'])for(const type of ['pointerdown','touchstart','click']){const x=setup(mode,{documentAudio:true});x.api.ready();x.label.dispatch(type,{isPrimary:true,touches:[{}]});assert.equal(x.api.gone,true,type);assert.equal(x.hiddenInsideAudio,true);assert.equal(x.body.classList.contains('splash-on'),false);assert.ok(x.audioTrace.every(x=>x.hidden));await new Promise(resolve=>setImmediate(resolve));}
});
test('keyboard entry remains accessible and commits the same one-shot transition',()=>{
 for(const key of ['Enter',' ']){const x=setup('pending',{documentAudio:true});x.api.ready();const e=x.button.dispatch('keydown',{key});assert.equal(e.prevented,true);assert.equal(x.api.gone,true);assert.equal(x.calls,1);assert.ok(x.audioTrace.every(x=>x.hidden));}
});
test('pageshow reconciles a restored entered splash without audio or saved-data changes',()=>{
 const x=setup(),before=[...x.storage];x.api.ready();x.api.forceGone();assert.equal(x.splash.classList.contains('out'),false);x.window.dispatch('pageshow',{persisted:true});assert.equal(x.splash.removed,true);assert.equal(x.body.classList.contains('splash-on'),false);assert.equal(x.calls,0);assert.deepEqual([...x.storage],before);
 const y=setup();y.api.ready();y.splash.classList.add('out');y.window.dispatch('pageshow',{persisted:true});assert.equal(y.splash.removed,true);assert.equal(y.api.gone,true);
});
test('pageshow never bypasses actual startup readiness',()=>{const x=setup();x.window.dispatch('pageshow',{persisted:true});assert.equal(x.api.gone,false);assert.equal(x.splash.removed,undefined);assert.equal(x.button.hidden,true);});
