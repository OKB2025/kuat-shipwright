const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),start=html.indexOf(" const root = document.documentElement, W = window, LS_KEY = 'yard.rotFlip'"),end=html.indexOf('})();',start),source='(()=>{'+html.slice(start,end)+'})();';
function setup(){const context=vm.createContext({});const run=code=>vm.runInContext(code,context);run(`
 const classes=()=>({s:new Set(),contains(k){return this.s.has(k)},toggle(k,on){if(on)this.s.add(k);else this.s.delete(k)}});
 const root={clientWidth:390,clientHeight:844,classList:classes(),style:{setProperty(){}}};
 const body={classList:classes()};body.classList.toggle('title-open',true);
 const listeners={},observers=[],frames=[];const window={localStorage:{getItem(){return null}},matchMedia(){return{matches:true,addEventListener(){}}},addEventListener(k,f){listeners[k]=f},dispatchEvent(){},requestAnimationFrame(f){frames.push(f)}};
 Object.defineProperties(window,{innerWidth:{configurable:true,get(){return 390}},innerHeight:{configurable:true,get(){return 844}}});
 class Element{getBoundingClientRect(){return{x:20,y:100,left:20,top:100,right:120,bottom:150,width:100,height:50}}}
 class MouseEvent{get clientX(){return 50}get clientY(){return 120}}
 class MutationObserver{constructor(f){observers.push(f)}observe(){}}
 class Event{constructor(type){this.type=type}}
 class DOMRect{constructor(x,y,width,height){Object.assign(this,{x,y,width,height,left:x,top:y,right:x+width,bottom:y+height})}}
 const document={documentElement:root,body,addEventListener(){}};
 `);run(source);return{run};}
test('portrait design uses physical viewport and pointer coordinates while retaining the title rotation',()=>{const t=setup();assert.equal(t.run('window.KSRotate.on'),true);assert.equal(t.run('window.innerWidth'),844);t.run("body.classList.toggle('designer-ui',true);body.classList.toggle('title-open',false);observers[0]()");assert.equal(t.run('window.KSRotate.on'),false);assert.equal(t.run('window.innerWidth'),390);assert.equal(t.run('window.innerHeight'),844);assert.equal(t.run('new MouseEvent().clientX'),50);assert.equal(t.run('new MouseEvent().clientY'),120);assert.equal(t.run('new Element().getBoundingClientRect().width'),100);assert.equal(t.run("root.classList.contains('ks-rot')"),false);});
test('leaving the design screen restores the existing fleet and flight coordinate rotation',()=>{const t=setup();t.run("body.classList.toggle('designer-ui',true);body.classList.toggle('title-open',false);observers[0]();body.classList.toggle('designer-ui',false);observers[0]()");assert.equal(t.run('window.KSRotate.on'),true);assert.equal(t.run('window.innerWidth'),844);assert.equal(t.run('window.innerHeight'),390);assert.equal(t.run('new MouseEvent().clientX'),120);assert.equal(t.run('new MouseEvent().clientY'),340);assert.equal(t.run('new Element().getBoundingClientRect().width'),50);});
