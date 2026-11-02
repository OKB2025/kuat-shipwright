const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});const C=vm.runInContext('Core',cx);
function gun(dir=[1,0,0],shell=[]){const mount={id:1,module:0,patch:'test',center:[0,0,0],muzzle:[0,0,0],dir,fixed:true,arcs:[1,1,1,1,1,1],gun:10,ion:0,capacity:100,power:10*C.TT,barrels:1,boltTT:1,crewNeed:0,band:'long'},p={hp:100,len:20,width:20,height:20,grid:{P:100*C.TT,domains:[{id:'main',P:100*C.TT}]},modules:[{k:'weapon',domain:'main',powerConnected:true,size:1,share:1,hits:1,crew:0}],surface:{mounts:[mount],patches:[],shell},wCap:100,gunArcs:[1,1,1,1,1,1],ionArcs:[0,0,0,0,0,0]};return {p,pos:[0,0,0],yaw:0,mods:[1],energy:100,crew:0};}
const target=pos=>({p:{hp:100,len:20,width:20,height:20},pos,yaw:0});
test('fixed surface weapons only deliver fire along the actual nose, side or aft barrel vector',()=>{
 for(const dir of [[1,0,0],[0,0,1],[-1,0,0]]){const u=gun(dir),ahead=target(dir.map(v=>v*1000)),behind=target(dir.map(v=>-v*1000));assert.ok(C.surfaceFleetFire(u,ahead,1000).gun>0);assert.equal(C.surfaceFleetFire(u,behind,1000).gun,0);const side=dir[0]?[0,0,1000]:[1000,0,0];assert.equal(C.surfaceFleetFire(u,target(side),1000).gun,0);}
});
test('actual collision triangles block a diagonal shot through the ship even when six-axis arc samples allow it',()=>{
 const wall=[5,-20,-20,5,20,-20,5,20,20,5,-20,-20,5,20,20,5,-20,20],dir=C.norm([1,0,.3]),foe=target([1000,0,300]),blocked=gun(dir,wall),open=gun(dir,[]);assert.ok(C.surfaceFleetFire(open,foe,1050).gun>0);assert.equal(C.surfaceFleetFire(blocked,foe,1050).gun,0);
});
