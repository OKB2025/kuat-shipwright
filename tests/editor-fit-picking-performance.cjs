const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime(){const cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});return vm.runInContext('({C:Core,G:Gfx})',cx);}
const fit=(k,id=1)=>({id,k,p:[100,30,0],a:2,n:[0,1,0],base:0,low:0,ped:0,float:false});
function triangles(G,f){const s={parts:[],fits:[f],hatches:[]},groups=[G.meshFits(s,null,null,[f]),G.meshReferenceFits(s,null,[f])],T=new Float32Array(groups.reduce((n,g)=>n+g.ni*3,0));let next=0;for(const g of groups)for(let i=0;i<g.ni;i++){T.set(g.pos.subarray(g.idx[i]*3,g.idx[i]*3+3),next);next+=3;}return T;}
function ray(C,T){for(let i=0;i<T.length;i+=9){const a=Array.from(T.subarray(i,i+3)),b=Array.from(T.subarray(i+3,i+6)),c=Array.from(T.subarray(i+6,i+9)),n=C.cross(C.sub(b,a),C.sub(c,a));if(C.len(n)<1e-6)continue;const center=C.mul(C.add(C.add(a,b),c),1/3),normal=C.norm(n);return {o:C.add(center,C.mul(normal,10)),d:C.mul(normal,-1)};}throw Error('no visible triangle');}
function sameBytes(a,b,message){assert.equal(a.length,b.length,message+' triangle count');assert.deepEqual(Buffer.from(a.buffer,a.byteOffset,a.byteLength),Buffer.from(b.buffer,b.byteOffset,b.byteLength),message);}

test('a cold centerline hover over the actual535 Mandator guns does not decode nearby missed assets',()=>{
 const {C,G}=runtime(),raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/mandator2.json.gz')))),s=C.deserialize(raw);let decodes=0;const decode=C.decodeReference;C.decodeReference=(...args)=>{decodes++;return decode(...args);};
 for(const f of s.fits)assert.equal(G.rayFit([4000,5000,0],[0,-1,0],f),null);assert.equal(s.fits.length,535);assert.equal(decodes,0,'complete asset boxes reject unrelated guns before any render or pick mesh is built');
});

test('cold reference picking keeps every exact rendered triangle without generating render materials',()=>{
 const {C,G}=runtime(),kinds=Object.keys(C.FITS).filter(k=>C.FITS[k].asset&&!C.FITS[k].retired);assert.ok(kinds.includes('utl')&&kinds.includes('pd')&&kinds.includes('monCal150Ion'));
 const rayTris=C.rayTris,tones=C.REFERENCE_TONE;let captured=null;C.rayTris=(T,...args)=>{captured=T;return rayTris(T,...args);};let id=1;
 for(const k of kinds)for(const pose of [0,1]){const f=fit(k,id++);f.p=[91234.75,-13456.5,45876.125];f.assetYaw=pose?-63:37;f.assetPitch=C.isBallTurret(k)?pose?-8:24:0;f.scale=pose?1.2:.85;f.ped=30;f.pedSize=3;f.pedShape=pose?'trap':'round';if(C.FITS[k].wallOnly||C.FITS[k].casemate){f.a=5;f.n=f.tilt=[0,0,-1];f.ped=0;}else f.tilt=C.norm([.2,1,.3]);
  const expected=triangles(G,f);if(!expected.length)continue;const {o,d}=ray(C,expected),want=rayTris(expected,o,d);assert.ok(want);captured=null;
  C.REFERENCE_TONE=new Proxy({}, {get(){throw Error('picking must not create render materials');}});let got;try{got=G.rayFit(o,d,f);}finally{C.REFERENCE_TONE=tones;}
  assert.ok(got,k+' remains selectable');sameBytes(captured,expected,k+' exact visible triangle positions and order');assert.equal(got.t,want.t,k+' exact nearest intersection');
 }
});

test('picking reuses a matching progressive preview without transforming its gun a second time',()=>{
 const {C,G}=runtime(),f=fit('utl'),s={parts:[],fits:[f],hatches:[]},expected=triangles(G,f),{o,d}=ray(C,expected);G.meshPreview(s,[],[f],{incremental:true});
 C.referenceFitPoint=()=>{throw Error('the visible gun must not be transformed twice');};C.decodeReference=()=>{throw Error('the visible gun must not be decoded twice');};const hit=G.rayFit(o,d,f);assert.ok(hit);assert.equal(hit.t,C.rayTris(expected,o,d).t);
});

test('an opaque nearer surface rejects a cold fitting before decoding and exact hits obey the same limit',()=>{
 const {C,G}=runtime(),f=fit('utl'),box=C.fitAABB(f),o=[(box[0]+box[3])/2,5000,(box[2]+box[5])/2],d=[0,-1,0],entry=C.rayAABB(o,d,box);assert.ok(entry);let decodes=0;const decode=C.decodeReference;C.decodeReference=(...args)=>{decodes++;return decode(...args);};
 assert.equal(G.rayFit(o,d,f,entry.t-1),null);assert.equal(decodes,0,'occluded guns stay cold');const hit=G.rayFit(o,d,f);assert.ok(hit);assert.equal(G.rayFit(o,d,f,hit.t-.01),null);assert.ok(G.rayFit(o,d,f,hit.t+.01));
 const expected=triangles(G,f),sample=ray(C,expected),want=C.rayTris(expected,sample.o,sample.d);assert.equal(G.rayFit(sample.o,sample.d,f,want.t-.01),null,'origins within broad bounds still use the exact distance limit');
});

test('a stray asset override on a procedural fitting never replaces its actual rendered body',()=>{
 const {C,G}=runtime(),rayTris=C.rayTris;let captured;C.rayTris=(T,...args)=>{captured=T;return rayTris(T,...args);};
 for(const k of ['claser','shipMsl','podCombat']){if(!C.FITS[k])continue;const f={...fit(k),skinAsset:C.FITS.utl.asset,launchPitch:35,launchYaw:27,launcherCols:3,launcherRows:2};const expected=triangles(G,f);if(!expected.length){assert.equal(G.rayFit([100,100,0],[0,-1,0],f),null,k+' has no invented asset body');continue;}const {o,d}=ray(C,expected);captured=null;assert.ok(G.rayFit(o,d,f));sameBytes(captured,expected,k+' keeps the renderer dispatch');}
});

test('clearing a completed draft releases its pick sources while exact selection remains available',()=>{
 const {C,G}=runtime();assert.doesNotThrow(()=>G.clearPreviewCache(null),'initial editor has no prior ship');assert.doesNotThrow(()=>G.clearPreviewCache(undefined),'pre-load cleanup is safe');const f=fit('utl'),s={parts:[],fits:[f],hatches:[]},expected=triangles(G,f),{o,d}=ray(C,expected);G.meshPreview(s,[],[f],{incremental:true});G.clearPreviewCache(s);
 const point=C.referenceFitPoint;let transforms=0;C.referenceFitPoint=(...args)=>{transforms++;return point(...args);};const hit=G.rayFit(o,d,f);assert.ok(hit);assert.equal(hit.t,C.rayTris(expected,o,d).t);assert.ok(transforms>0,'the discarded compact preview is no longer retained for picking');
});
