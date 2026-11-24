// Records a 3D replay of an AI dogfight as a video: the craft's own models (built by js/gfx.js fleetGeometry from the example
// designs) flown along the positions and attitudes the simulation recorded.
// usage: KS_TRACE=<trace.json> node scripts/sim-dogfight.cjs <a> <b> 1 <nb> <na>
//        node scripts/record-dogfight-3d.cjs <trace.json> <outdir> [fps=24] [speed=1]
// (outdir is required: nothing is written to docs/. Needs ffmpeg on the PATH.)
// What it is: a replay drawn by this script's own small WebGL view, NOT the game's renderer or its trial screen. The flight (place,
// heading, roll and pitch every 0.25 s, who fired on whom, who was lost) is the simulation's; between records it is interpolated.
// The camera, the trails, the bolts drawn from gun to target, the bursts and the markers on distant craft are this script's.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),trace=JSON.parse(fs.readFileSync(path.resolve(process.argv[2]),'utf8')),out=path.resolve(process.argv[3]),FPS=+(process.argv[4]||24),SPEED=+(process.argv[5]||1);
if(!process.argv[3])throw new Error('usage: record-dogfight-3d.cjs <trace.json> <outdir> [fps] [speed]');fs.mkdirSync(path.join(out,'frames'),{recursive:true});
// The models: every mesh of the craft's fleet geometry, as plain triangles about the model's centre (x forward, y up, z starboard).
const cx=vm.createContext({console:{log(){},warn(){},error(){}},self:{},window:{},document:{createElement(){return {getContext(){return null},style:{}};}},navigator:{userAgent:''},performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const G=vm.runInContext('Gfx',cx),C=vm.runInContext('Core',cx);
function model(key){const g=G.fleetGeometry(C.buildDesign(key)),c=g.center,pos=[],nor=[],col=[];
 for(const m of Object.values(g.meshes)){const q=m.geo;if(!(q.n>0)||!q.pos||!q.nor)continue;const n=q.ni>0?q.ni:q.n%3===0?q.n:0,emi=m.emi||0;
  for(let i=0;i<n;i++){const v=q.ni>0?q.idx[i]:i;pos.push(q.pos[v*3]-c[0],q.pos[v*3+1]-c[1],q.pos[v*3+2]-c[2]);nor.push(q.nor[v*3],q.nor[v*3+1],q.nor[v*3+2]);col.push(q.col?q.col[v*4]:160,q.col?q.col[v*4+1]:160,q.col?q.col[v*4+2]:160,Math.round(255*Math.min(1,emi)));}}
 const b64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');return {key,len:g.length,verts:pos.length/3,pos:b64(new Float32Array(pos)),nor:b64(new Int8Array(nor)),col:b64(new Uint8Array(col))};}

for(const k of ['craft_xwing','craft_tie_ln','craft_tie_in','craft_tie_d'])fs.writeFileSync(path.join(out,k+'.json'),JSON.stringify(model(k)));