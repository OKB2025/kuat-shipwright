const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {Renderer,CompatRenderer}=vm.runInContext('Gfx',cx),systems=vm.runInContext('Galaxy.SYSTEMS',cx),plain=v=>JSON.parse(JSON.stringify(v));
const red=plain(systems.find(s=>s.key==='abregado').v.star.color),sun=[0,0,1],look=(r,color)=>Renderer.prototype.pickLook.call(r,{fleet:[],planet:{sun,star:color?{color}:null}});
test('stellar metadata colors material illumination and a same-direction color change invalidates the light cache',()=>{
 const renderer={},white=plain(look(renderer)),warm=look(renderer,red);assert.deepEqual(plain(warm.sunColor),red);
 for(const k of ['C1','C2','sky','gnd'])for(let i=0;i<3;i++)assert.equal(warm[k][i],white[k][i]*red[i]);
 assert.notEqual(warm.key,white.key);assert.equal(look(renderer,red),warm,'an unchanged illuminant reuses the same light state');
 const next=look(renderer,[.2,.5,1]);assert.notEqual(next,warm);assert.deepEqual(plain(next.sunColor),[.2,.5,1]);
});
test('missing or invalid star colors, white stars, editing and hyperspace preserve their white lighting',()=>{
 const renderer={},white=look(renderer),before=plain(white);assert.deepEqual(plain(look(renderer,[1,1,1])),before);
 for(const invalid of [[0,0,0],[1,NaN,0],[-1,0,0],['red',0,0],[1,0]])assert.deepEqual(plain(look(renderer,invalid)),before);
 const editor=Renderer.prototype.pickLook.call(renderer,{mode:'normal'}),editorRed=Renderer.prototype.pickLook.call(renderer,{mode:'normal',planet:{sun,star:{color:red}}});assert.equal(editorRed,editor);
 const tunnel=Renderer.prototype.pickLook.call(renderer,{fleet:[],hyper:{k:1},planet:{sun,star:{color:red}}});assert.deepEqual(plain(tunnel.sunColor),[1,1,1]);
});
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function fallback(name='fits',flag=255){
 let output;const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:f=>output=f};
 const r=new CompatRenderer({width:24,height:24,clientWidth:24,clientHeight:24,getContext:()=>ctx});r.matrices=()=>({VP:identity});
 const geo={n:3,ni:3,pos:new Float32Array([-.5,-.5,0,.5,-.5,0,0,.5,0]),nor:new Int8Array([0,0,127,0,0,127,0,0,127]),col:new Uint8Array([100,100,100,flag,100,100,100,flag,100,100,100,flag]),idx:new Uint16Array([0,1,2])};
 r.upload(name,geo);return {r,pixel:()=>Array.from(output.data.slice((12*24+12)*4,(12*24+12)*4+3))};
}
test('software fallback reflects the same stellar hue and restores ordinary white rendering between scenes',()=>{
 const {r,pixel}=fallback();r.draw();const original=pixel();r.draw({planet:{sun,star:{color:red}}});const lit=pixel();assert.ok(lit[0]>lit[1]*2&&lit[1]>lit[2]);r.draw();assert.deepEqual(pixel(),original);
});
test('software fallback retains local nozzle, ray and port emission colors under a red illuminant',()=>{
 for(const name of ['nozzle','refEngine','hatchRay','surfaceDevices']){const {r,pixel}=fallback(name,name==='surfaceDevices'?253:255);r.portColor=[.2,.6,1];r.draw();const before=pixel();r.draw({planet:{sun,star:{color:red}}});assert.deepEqual(pixel(),before,name);}
});
test('real RTS sector descriptors carry their named star into piloted and spectator planet lighting without mutating galaxy data',()=>{
 const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({}),run=s=>vm.runInContext(s,context);
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])run(fs.readFileSync(path.join(root,f),'utf8'));
 const fn=name=>{const m=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(m,name);for(let i=app.indexOf('}',m.index);i>=0;i=app.indexOf('}',i+1)){const f=app.slice(m.index,i+1);try{new vm.Script(f);return f;}catch{}}assert.fail(name);};
 run('const C=Core,tv={scale:C.mul},trial={sysKey:"rts",P:[0,6000000,0]};');
 const a=app.indexOf('const SYSTEMS={};'),b=app.indexOf('function trialDust()',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));run(fn('voyWorldLook'));run(fn('voySysDesc'));
 run('const redSector=Rts.makeSector("abregado",13),redSystem=redSector.systems.find(s=>s.planet?.gal==="abregado"),beforeStar=JSON.stringify(SYSTEMS.abregado.star),desc=voySysDesc({sector:redSector},redSystem.id);SYSTEMS.rts=desc;const planet=trialPlanet(),look=Gfx.Renderer.prototype.pickLook.call({},{fleet:[],planet});');
 assert.deepEqual(plain(run('planet.star.color')),red);assert.deepEqual(plain(run('look.sunColor')),red);assert.deepEqual(plain(run('planet.sun')),plain(run('SYSTEMS.abregado.sun')));assert.equal(run('desc.star.name'),run('SYSTEMS.abregado.star.name'));assert.equal(run('planet.star.ang'),run('SYSTEMS.abregado.star.ang'));
 assert.equal(run('desc.star===SYSTEMS.abregado.star'),false);assert.equal(run('desc.star.color===SYSTEMS.abregado.star.color'),false);run('desc.star.color[1]=.9');assert.equal(run('JSON.stringify(SYSTEMS.abregado.star)'),run('beforeStar'));
 run('const whiteSector=Rts.makeSector("kuat",13),whiteSystem=whiteSector.systems.find(s=>s.planet?.gal==="kuat");SYSTEMS.rts=voySysDesc({sector:whiteSector},whiteSystem.id);');assert.equal(run('trialPlanet().star'),null);assert.deepEqual(plain(run('Gfx.Renderer.prototype.pickLook.call({},{fleet:[],planet:trialPlanet()}).sunColor')),[1,1,1]);
});
