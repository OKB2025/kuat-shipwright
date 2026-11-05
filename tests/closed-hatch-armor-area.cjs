const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {figuresDigest,figuresDiff}=require('./helpers/figures-digest.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime(legacy){
 const cx=vm.createContext({console,performance,__armorCloneCount:0});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
  let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js'){
   if(legacy){const guard="if(!ship.hatches.some(h=>isSlidingHatch(ship,h)&&clamp(h.open??0,0,1)!==0))return currentArea;";assert.ok(source.includes(guard));source=source.replace(guard,"if(!ship.hatches.some(h=>isSlidingHatch(ship,h)))return currentArea;");}
   const clone='const state=serialize(ship);for(const h of state.hatches)if(isSlidingHatch(state,h))h.open=0;';assert.ok(source.includes(clone));source=source.replace(clone,'globalThis.__armorCloneCount++;'+clone);
  }vm.runInContext(source,cx,{filename:file});
 }return {C:vm.runInContext('Core',cx),cx};
}
const current=runtime(false),legacy=runtime(true);
function fixture(C,open=0,mixed=false){
 const s=C.newShip({L:100,W:80,H:30},'Closed hangar armor'),bay=C.placePart(s,'hangar',[50,12,0],10,{room:[25,25,14],autoFit:false},false),h=C.openBay(s,bay,'top','open');h.motion='slide';h.open=open;
 if(mixed){const b=C.openBay(s,bay,'bottom','open');b.motion='slide';b.open=0;}return s;
}
test('fully closed sliding hatches retain the exact figures without rebuilding an identical closed-door clone',()=>{
 const a=fixture(current.C),b=fixture(legacy.C),before=current.cx.__armorCloneCount,old=legacy.cx.__armorCloneCount;
 const now=figuresDigest(current.C.computeStats(a)),expected=figuresDigest(legacy.C.computeStats(b));assert.deepEqual(figuresDiff(expected,now),[]);assert.equal(current.cx.__armorCloneCount,before);assert.ok(legacy.cx.__armorCloneCount>old);
});
test('partly open and mixed sliding doors keep the original closed-door armor calculation',()=>{
 for(const mixed of [false,true]){const a=fixture(current.C,.5,mixed),b=fixture(legacy.C,.5,mixed),before=current.cx.__armorCloneCount;
  assert.deepEqual(figuresDiff(figuresDigest(legacy.C.computeStats(b)),figuresDigest(current.C.computeStats(a))),[]);assert.ok(current.cx.__armorCloneCount>before);
 }
});
