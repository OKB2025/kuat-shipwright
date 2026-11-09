// v24 Resizing a hull part carries its own cuts with it (docs/hull-part-scaling-v24.md).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function fixture(){
 const ship=C.newShip({L:400,W:100,H:60,sec:'warship',plan:'wedge'},'scaling fixture'),p=C.ensurePrimaryHull(ship);assert.ok(p);
 const d=p.hullData;d.solidCuts=[{id:900,shape:'box',c:[100,30,20],s:[40,10,6],rotation:[0,0,0],mirror:true,structures:false}];
 d.trenches=[{id:901,side:'both',from:.3,to:.7,level:.5,height:12,depth:8,taper:false,chine:true}];
 d.subs=[{id:902,b:[10,5,-4,30,15,4]}];d.cuts=[{id:903,side:'both',edge:'top',inset:10,slope:30,from:0,to:1,prop:false}];
 return {ship,p};
}
test('doubling the length, height and width scales the cuts about the stern, keel and centreline',()=>{
 const {ship,p}=fixture();C.setHullStructureDimensions(ship,p,[800,150,120]);const d=p.hullData;
 const q=d.solidCuts[0];near(q.c[0],200);near(q.c[1],60);near(q.c[2],30);near(q.s[0],80);near(q.s[1],15);near(q.s[2],12);
 near(d.trenches[0].height,24);near(d.trenches[0].depth,12);near(d.trenches[0].from,.3);
 assert.equal(JSON.stringify(d.subs[0].b.map(v=>+v.toFixed(9))),JSON.stringify([20,10,-6,60,30,6]));near(d.cuts[0].inset,15);
 near(p.hullProfile.L,800);near(p.hullProfile.W,150);near(p.hullProfile.H,120);
});
test('editing the part size directly is picked up the same way, and an unchanged size changes nothing',()=>{
 const {ship,p}=fixture();p.s=[200,100,60];C.hullStructureShip(ship,p);near(p.hullData.solidCuts[0].c[0],50);near(p.hullData.solidCuts[0].s[0],20);
 const before=JSON.stringify(p.hullData.solidCuts);C.setHullStructureDimensions(ship,p,[200,100,60]);assert.equal(JSON.stringify(p.hullData.solidCuts),before);
});
test('a rotated cutter scales each of its own axes by how far it stretches',()=>{
 const {ship,p}=fixture();p.hullData.solidCuts[0].rotation=[0,90,0];C.setHullStructureDimensions(ship,p,[800,100,60]);const q=p.hullData.solidCuts[0];
 near(q.s[0],40);near(q.s[1],20);near(q.s[2],6);
});
