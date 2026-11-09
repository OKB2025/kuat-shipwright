// Exercise the actual KSAudio lifecycle with browser API doubles. These checks
// do not claim that Chromium or the doubles validate iOS ReplayKit recordings.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js','app.js'),'utf8'),start=app.indexOf('// ---- src/45_audio.js ----'),end=app.indexOf('\n/* ============================================================\n   app.js',start);
assert.ok(start>=0&&end>start,'real audio module boundaries');
const source=app.slice(start,end),GESTURES=['pointerdown','pointerup','touchend','keydown','click'];

class Events {
 constructor(){this.listeners=new Map();}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 emit(type){for(const fn of [...this.listeners.get(type)||[]])fn({type,target:this});}
 count(type){return this.listeners.get(type)?.size||0;}
}
class Param {
 constructor(value=0){this.value=value;}
 cancelScheduledValues(){}
 setTargetAtTime(value){this.value=value;}
 setValueAtTime(value){this.value=value;}
 linearRampToValueAtTime(value){this.value=value;}
 exponentialRampToValueAtTime(value){this.value=value;}
 setValueCurveAtTime(values){this.value=values[values.length-1];}
}
class AudioNode {
 constructor(){this.connections=[];for(const key of ['gain','frequency','detune','Q','threshold','knee','ratio','attack','release','delayTime','playbackRate'])this[key]=new Param(key==='gain'?1:0);}
 connect(node){this.connections.push(node);return node;}
 disconnect(){this.connections=[];}
 start(){}
 stop(){}
}
function fixture({session='supported',settings}={}){
 const window=new Events(),document=Object.assign(new Events(),{hidden:false}),trace=[],contexts=[],audio=[],timeouts=new Map(),storage=new Map(),navigator={};let nextTimer=1,nextURL=1,sessionType='auto';
 if(settings)storage.set('ks.audio.v1',JSON.stringify(settings));
 const sessionAPI={get type(){return sessionType;},set type(value){trace.push('session:'+value);if(session==='setter-throws')throw Error('session setter unavailable');sessionType=value;}};
 if(session==='getter-throws')Object.defineProperty(navigator,'audioSession',{get(){throw Error('session getter unavailable');}});
 else if(session!=='absent')navigator.audioSession=sessionAPI;
 class Context extends Events {
  constructor(){super();trace.push('context');this.sampleRate=1000;this.currentTime=0;this.state='suspended';this.destination=new AudioNode();this.resumeCalls=0;this.suspendCalls=0;this.rejectResume=false;this.media=[];contexts.push(this);}
  createGain(){return new AudioNode();}
  createDynamicsCompressor(){return new AudioNode();}
  createWaveShaper(){return new AudioNode();}
  createConvolver(){return new AudioNode();}
  createOscillator(){return new AudioNode();}
  createBufferSource(){return new AudioNode();}
  createBiquadFilter(){return new AudioNode();}
  createDelay(){return new AudioNode();}
  createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {sampleRate,length,duration:length/sampleRate,getChannelData:i=>data[i]};}
  createMediaElementSource(el){const node=new AudioNode();this.media.push({el,node});return node;}
  resume(){this.resumeCalls++;if(this.rejectResume)return Promise.reject(Error('resume needs gesture'));this.state='running';this.emit('statechange');return Promise.resolve();}
  suspend(){this.suspendCalls++;this.state='suspended';this.emit('statechange');return Promise.resolve();}
  interrupt(){this.state='interrupted';this.emit('statechange');}
 }
 class Media extends Events {
  constructor(){super();this.paused=true;this.currentTime=0;this.duration=100;this.src='';this.playCalls=0;this.rejectPlay=false;audio.push(this);}
  canPlayType(){return 'probably';}
  play(){this.playCalls++;if(this.rejectPlay){this.paused=true;return Promise.reject(Object.assign(Error('play needs gesture'),{name:'NotAllowedError'}));}this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
  removeAttribute(name){if(name==='src')this.src='';}
  load(){}
 }
 const setTimeoutFake=(fn,delay=0)=>{const id=nextTimer++;timeouts.set(id,{fn,delay});return id;};
 const runTimers=maxDelay=>{const due=[...timeouts].filter(([,t])=>t.delay<=maxDelay);for(const [id,t]of due){timeouts.delete(id);t.fn();}};
 Object.assign(window,{AudioContext:Context,navigator,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{protocol:'https:'},KSBGM:{test:{id:'test',title:'Fixture',mime:'audio/mp4',b64:'AA==',dur:100,loop:[10,90]}}});
 const context=vm.createContext({window,document,navigator,Audio:Media,console,Blob,URL:{createObjectURL:()=>`blob:test-${nextURL++}`,revokeObjectURL(){}},atob:s=>Buffer.from(s,'base64').toString('binary'),setTimeout:setTimeoutFake,clearTimeout:id=>timeouts.delete(id),setInterval:()=>nextTimer++,clearInterval(){}});
 vm.runInContext(source,context,{filename:'js/app.js[audio]'});
 const settle=async()=>{for(let i=0;i<12;i++){runTimers(0);await Promise.resolve();}};
 return {api:window.KSAudio,window,document,navigator,trace,contexts,audio,storage,settle,runTimers,get sessionType(){return sessionType;},get ctx(){return contexts[0];}};
}
async function recorded(f){
 f.api.configure({tracks:{title:['test']}});assert.equal(f.api.preload('test'),1);await f.settle();
 assert.ok(f.api.state().tracksReady.includes('test'),'fixture is loaded before selecting it');
 await f.api.unlock();await f.settle();f.api.setMusic('title');await f.settle();
 const track=f.audio.find(el=>el.src&&el.currentTime===0&&!el.paused);assert.ok(track,'real player has started its recorded slot');
 track.currentTime=23.5;return track;
}

test('page setup stays silent until a gesture and requests playback before constructing its one audio context',async()=>{
 const f=fixture();assert.deepEqual(f.trace,[]);assert.equal(f.contexts.length,0);
 f.document.emit('pointerdown');await f.settle();
 assert.equal(f.sessionType,'playback');assert.ok(f.trace.indexOf('session:playback')<f.trace.indexOf('context'));
 assert.equal(f.api.state().unlocked,true);assert.equal(f.api.state().ctxState,'running');
 await f.api.unlock();assert.equal(f.contexts.length,1,'unlock never duplicates the sound engine');
 for(const type of GESTURES)assert.equal(f.document.count(type),0,'running engine releases gesture listener '+type);
});

test('unsupported or restricted audioSession does not disable the established sound path',async()=>{
 for(const session of ['absent','getter-throws','setter-throws']){
  const f=fixture({session});assert.equal(await f.api.unlock(),true,session);assert.equal(f.api.state().ctxState,'running',session);
  assert.equal(f.api.sfx('ui_click'),true,session+' retains real synthesized effects');assert.equal(f.contexts.length,1);
 }
});

test('a fresh user gesture reclaims a playback session reset by the platform',async()=>{
 const f=fixture();await f.api.unlock();f.navigator.audioSession.type='auto';f.ctx.interrupt();const before=f.ctx.resumeCalls;
 f.document.emit('touchend');await f.settle();assert.equal(f.sessionType,'playback');assert.equal(f.ctx.state,'running');assert.ok(f.ctx.resumeCalls>before);assert.equal(f.contexts.length,1);
});

test('an interrupted unlocked engine recovers on foreground return without rebuilding or restarting the recorded track',async()=>{
 for(const event of ['focus','pageshow']){
  const f=fixture(),track=await recorded(f),ctx=f.ctx,sources=ctx.media.length,before=ctx.resumeCalls;
  ctx.interrupt();for(const type of GESTURES)assert.equal(f.document.count(type),1,'interruption rearms '+type);
  f.window.emit(event);await f.settle();
  assert.equal(ctx.state,'running',event);assert.ok(ctx.resumeCalls>before);assert.equal(f.contexts.length,1);assert.equal(ctx.media.length,sources);
  assert.equal(f.api.state().track.id,'test');assert.equal(track.currentTime,23.5,'existing track position is retained');
 }
});

test('failed foreground recovery remains retryable by the next user gesture',async()=>{
 const f=fixture();await f.api.unlock();f.ctx.interrupt();f.ctx.rejectResume=true;f.window.emit('focus');await f.settle();
 assert.equal(f.ctx.state,'interrupted');assert.equal(f.document.count('pointerdown'),1);
 f.ctx.rejectResume=false;f.document.emit('pointerdown');await f.settle();assert.equal(f.ctx.state,'running');assert.equal(f.document.count('pointerdown'),0);
 assert.equal(f.contexts.length,1);
});

test('a platform-restored running context resumes the interrupted media slot without a foreground event',async()=>{
 const f=fixture(),track=await recorded(f);f.ctx.interrupt();assert.equal(track.paused,true);assert.equal(f.document.count('pointerdown'),1);
 await f.ctx.resume();await f.settle();assert.equal(track.paused,false);assert.equal(track.currentTime,23.5);assert.equal(f.api.state().track.playing,true);assert.equal(f.document.count('pointerdown'),0);assert.equal(f.ctx.media.length,3);
});

test('foreground events cannot start never-unlocked, muted, zero-volume or hidden audio',async()=>{
 const untouched=fixture();for(const event of ['focus','pageshow'])untouched.window.emit(event);await untouched.settle();assert.equal(untouched.contexts.length,0);
 for(const quiet of [{muted:true},{master:0}]){
  const f=fixture();await f.api.unlock();f.api.settings.set(quiet);f.runTimers(300);await f.settle();const calls=f.ctx.resumeCalls;
  for(const event of ['focus','pageshow'])f.window.emit(event);f.document.emit('visibilitychange');await f.settle();
  assert.equal(f.ctx.resumeCalls,calls);assert.equal(f.ctx.state,'suspended');
 }
 const hidden=fixture();await hidden.api.unlock();hidden.document.hidden=true;hidden.ctx.interrupt();const calls=hidden.ctx.resumeCalls;
 for(const event of ['focus','pageshow'])hidden.window.emit(event);await hidden.settle();assert.equal(hidden.ctx.resumeCalls,calls);
 hidden.document.hidden=false;hidden.document.emit('visibilitychange');await hidden.settle();assert.equal(hidden.ctx.state,'running');
});

test('a rejected recorded-slot resume keeps its retry and resumes at its saved position on a gesture',async()=>{
 const f=fixture(),track=await recorded(f);f.document.hidden=true;f.document.emit('visibilitychange');f.runTimers(350);await f.settle();
 assert.equal(track.paused,true);track.rejectPlay=true;f.document.hidden=false;f.document.emit('visibilitychange');await f.settle();
 const attempts=track.playCalls;assert.equal(track.paused,true);assert.equal(f.document.count('pointerdown'),1,'failed element resume retains a gesture recovery');
 track.rejectPlay=false;f.document.emit('pointerdown');await f.settle();
 assert.ok(track.playCalls>attempts);assert.equal(track.paused,false);assert.equal(track.currentTime,23.5);assert.equal(f.api.state().track.id,'test');assert.equal(f.ctx.media.length,3);
});
