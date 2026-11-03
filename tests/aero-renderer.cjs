const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),c=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',c);
function fixture(k,extra={}){const ship=C.newShip({L:12,W:8,H:4,assembly:true});ship.detail=0;const part=C.placePart(ship,k,[6,2,5],[3,4,.08],extra,false);return {ship,part};}
function colors(geo){const out=new Set();for(let i=0;i<geo.n;i++)out.add(Array.from(geo.col.slice(i*4,i*4+3)).join(','));return out;}
test('a dedicated solar panel renders a dark collector and a contrasting perimeter and diagonal frame under one part ID',()=>{
 const {ship,part}=fixture('solarPanel'),g=G.meshParts(ship,{coded:false}),mesh=g.g.struct;
 assert.equal(part.k,'solarPanel');assert.equal(ship.parts.length,1);
 assert.ok(colors(mesh).has('35,43,57'));assert.ok(colors(mesh).has('154,161,169'));
 for(let i=0;i<mesh.n;i++)assert.equal(mesh.col[i*4+3],254,'collector and frame suppress generated cabin lights');
 assert.ok(C.aeroPanelRibs(part).length>0);assert.ok(mesh.ni>C.structTriangles(part).length/3);
 assert.equal(Object.keys(g.ranges).length,1);assert.ok(g.ranges[part.id].some(r=>r[0]==='struct'));
});
test('a dedicated wing renders its six-corner section without a cosmetic structural host',()=>{
 const {ship,part}=fixture('wing'),g=G.meshParts(ship,{coded:false});
 assert.equal(part.k,'wing');assert.equal(part.form,'airfoil');assert.equal(ship.parts.filter(p=>p.k==='struct').length,0);
 assert.ok(g.g.struct.ni>0);assert.ok(g.ranges[part.id]);
 for(let i=0;i<g.g.struct.n;i++)assert.equal(g.g.struct.col[i*4+3],251,'a wing keeps an ordinary exterior armor skin without the solar collector material flag');
});
test('bending a panel moves its collector and ribs together, without modifying its saved shape',()=>{
 const {ship,part}=fixture('solarPanel',{panelFold:35,panelKnee:.35}),before=C.publicJSON(ship),g=G.meshParts(ship,{coded:false});
 const tris=C.structTriangles(part),ribs=C.aeroPanelRibs(part),ys=[];for(let i=1;i<tris.length;i+=3)ys.push(tris[i]);
 assert.ok(Math.max(...ys)-Math.min(...ys)>.5);assert.ok(g.g.struct.ni>0);assert.ok(ribs.every(Number.isFinite));
 assert.equal(C.publicJSON(ship),before);
});

test('baking a folded collector keeps its support bars thin rather than using its envelope as sheet thickness',()=>{
 const {part}=fixture('solarPanel',{panelFold:60,panelFrame:.06,panelRib:.035}),bounds=T=>[0,1,2].flatMap(a=>{const v=Array.from(T).filter((x,i)=>i%3===a);return [Math.min(...v),Math.max(...v)];});
 const before=bounds(C.aeroPanelRibs(part)),baked=C.aeroBake(part),after=bounds(C.aeroPanelRibs(baked));
 assert.ok(baked.s[2]>part.s[2]*5);
 before.forEach((x,i)=>assert.ok(Math.abs(x-after[i])<.1,`support envelope ${i}: ${x} -> ${after[i]}`));
});

test('a selected solar panel outlines its physical edges without drawing triangulation as extra support bars',()=>{
 const {part}=fixture('solarPanel'),lines=G.lineSet();lines.part(part,[100,200,255,255]);const out=lines.out();
 assert.equal(out.pos.length,18*6,'six edges on each face and six thickness edges');
 assert.ok(out.pos.length<C.structTriangles(part).length*2,'internal triangle diagonals are hidden');
 const raw=C.structTriangles(part);for(let i=0;i<out.pos.length;i+=3){const v=Array.from(out.pos.slice(i,i+3));assert.ok(Array.from({length:raw.length/3},(_,j)=>[raw[j*3],raw[j*3+1],raw[j*3+2]]).some(q=>q.every((x,a)=>Math.abs(x-v[a])<1e-6)));}
});
