const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),source=JSON.parse(fs.readFileSync(path.join(root,'assets/source/imperial-ii-user-layout/imperial-ii-upload.json'))),plain=v=>JSON.parse(C.publicJSON(v));
const sheetPoints=[[20,139,0],[80,139,0],[80,139,100],[140,139,0],[140,139,100],[140,139,233.6],[140,139,-233.6],[180,139,0],[180,139,100],[180,139,233.6],[180,139,-233.6]];
const primary=s=>s.parts.find(p=>p.id===178),upper=s=>primary(s).hullData.solidCuts.find(c=>c.id===2),lower=s=>primary(s).hullData.solidCuts.find(c=>c.id===3),top=c=>c.c[1]+c.s[2]/2,bottom=c=>c.c[1]-c.s[2]/2;

test('both Imperial recipes remove the real engine-bay sheet by correcting only the upper opening lower edge',()=>{
 const old=C.deserialize(plain(source)),before=upper(old),input=JSON.stringify(source);
 assert.ok(Math.abs(bottom(before)-top(lower(old))-.01)<1e-10,'the original cuts leave one centimetre of real material');
 for(const point of sheetPoints)assert.equal(C.inPart(primary(old),point),true,'the old sheet occupies the reported opening');
 for(const key of ['imperial','imperial2']){
  const current=C.SHIP_EXAMPLES[key].build(),cut=upper(current),expected=plain(before);expected.c[1]=202.52;expected.s[2]=127.07;
  assert.deepEqual(plain(cut),expected,'all other authored vertices, cut dimensions, rotation and mirroring remain exact');
  assert.ok(Math.abs(top(cut)-top(before))<1e-10,'the outer upper opening boundary does not move');
  assert.ok(Math.abs(top(lower(current))-bottom(cut)-.01)<1e-10,'the two openings overlap by a centimetre');
  for(const point of sheetPoints)assert.equal(C.inPart(primary(current),point),false,'the corrected opening contains no sheet');
 }
 assert.equal(JSON.stringify(source),input,'the original attached blueprint is immutable');
});

test('actual indexed structure rendering has no horizontal sheet across the engine openings',()=>{
 const triangles=s=>{const stripped=plain(s.format==='starship-yard'?s:C.serialize(s));stripped.parts=stripped.parts.filter(p=>p.id===178);stripped.fits=[];stripped.hatches=[];const g=G.meshParts(C.deserialize(stripped),{}).g.struct,out=[];for(let i=0;i<g.ni;i+=3){const p=[0,1,2].map(j=>Array.from(g.pos.slice(g.idx[i+j]*3,g.idx[i+j]*3+3))),ys=p.map(q=>q[1]),xs=p.map(q=>q[0]);if(Math.max(...ys)-Math.min(...ys)<1e-4&&Math.abs(ys[0]-139)<.03&&Math.min(...xs)<185&&Math.min(...xs)>-20&&Math.max(...xs)<250)out.push(p);}return out;};
 assert.ok(triangles(source).length>0,'the regression exercises the real old rendered plate');
 assert.equal(triangles(C.SHIP_EXAMPLES.imperial.build()).length,0,'the corrected physical hull produces no plate mesh in the openings');
});
