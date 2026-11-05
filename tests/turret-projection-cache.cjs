const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));let serial=0;
function fixture(){
 const key='projectionCache'+(++serial),verticesM=[[-5,0,-3],[5,0,-3],[5,4,-3],[-5,4,-3],[-5,0,3],[5,0,3],[5,4,3],[-5,4,3]],faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
 const a={size:[10,4,6],c:[0,2,0],mount:[0,0,0],turretCompartment:{version:1,role:'gunhouse',convexes:[{verticesM,faces}]}};
 C.REFERENCE_ASSETS[key]=a;C.FITS[key]={...C.FITS.pd,key,asset:key,weaponSizing:{factor:1},fm:10,hm:4,wm:6};
 const s=C.newShip({assembly:true,L:100,W:100,H:30},'Projection cache');s.parts=[];
 const p=C.placePart(s,'struct',[0,1,0],[10,6,2],{form:'box',corner:0},false),f={id:s.nextId++,k:key,p:[0,0,0],a:2,ped:0,base:0,low:0,float:false};s.fits=[f];return {s,f,a,p};
}
test('a warmed gunhouse projection reuses its result without reading model coordinates again',()=>{
 const {s,f,a}=fixture(),first=C.turretCompartmentProjection(s,f);assert.ok(first.housingVolume>0&&first.embeddedVolume>0&&first.externalVolume>0);
 const size=a.size;Object.defineProperty(a,'size',{configurable:true,get(){throw Error('cached projection rebuilt model coordinates');}});
 try{for(let i=0;i<20;i++)assert.equal(C.turretCompartmentProjection(s,f),first);}
 finally{Object.defineProperty(a,'size',{configurable:true,writable:true,value:size});}
});
test('fitting edits and envelope edits invalidate warmed results and match an independent cold projection',()=>{
 const {s,f,p}=fixture(),first=C.turretCompartmentProjection(s,f);f.p[1]=1;
 const moved=C.turretCompartmentProjection(s,f);assert.notEqual(moved,first);assert.ok(moved.embeddedVolume<first.embeddedVolume);
 const compareCold=()=>{const copy=JSON.parse(C.publicJSON(s)),other=copy.fits.find(q=>q.id===f.id);assert.deepEqual(plain(C.turretCompartmentProjection(s,f)),plain(C.turretCompartmentProjection(copy,other)));};
 compareCold();p.s[2]=4;const wider=C.turretCompartmentProjection(s,f);assert.notEqual(wider,moved);assert.ok(wider.embeddedVolume>moved.embeddedVolume);compareCold();
 for(const [key,value]of [['assetYaw',37],['ped',.5],['scale',1.1],['tilt',C.norm([.1,.97,.2])]]){const previous=C.turretCompartmentProjection(s,f);f[key]=value;assert.notEqual(C.turretCompartmentProjection(s,f),previous,key);compareCold();}
});
