const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(process.env.KS_TEST_ROOT,f),'utf8'),cx);
const C=vm.runInContext('Core',cx);
for(const key of ['craft_tie_ln','craft_tie_in','craft_tie_d','craft_xwing']){
 const x=C.buildDesign(key),p=C.fleetProfile(C.computeStats(x),x.name,x);
 function hit(fields,random){const u=C.fleetUnit('target',key,p,1),o=Object.assign(C.combatIncoming(),fields);
  C.combatResolve({time:0,rand:()=>random,ev(){},sunk(){},out(){}},u,o,0,C.fleetSystems(u));return u;}
 const energy=1e-15;
 const fragile=key==='craft_tie_ln'||key==='craft_tie_in';
 const loc={point:[0,0,0],direct:energy,energy};
 const body=hit({direct:energy,shotE:energy,shotN:1,hits:[loc]},.99999);
 assert.equal(body.dead,fragile);
 if(fragile){assert.equal(body.secLost.length,1);assert.equal(body.sec[body.secLost[0]].s,0);
  assert.equal(hit({direct:energy,shotE:energy,shotN:1},0).dead,false);
  assert.equal(hit({blasts:[{n:1,tt:energy}]},.5).dead,true);
  assert.equal(hit({},.5).dead,false);}
 console.log(key,'OK');
}
