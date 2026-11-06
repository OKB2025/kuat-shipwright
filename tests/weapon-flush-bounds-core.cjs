const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
function fixture(){const ship=C.newShip({L:240,W:200,H:140,assembly:true},'Flush weapons');ship.parts=[];ship.fits=[];ship.nextId=1;ship.armor={hull:0,cit:0};C.placePart(ship,'struct',[120,50,0],[200,160,100],{form:'box'},false);return ship;}
test('new weapons default to zero additional height and fixed lasers/launchers cannot grow a pedestal',()=>{
 for(const k of ['pd','htl','claser','claserH','cturret','ctorp','cmsl','cbomb','cpylon','msl','itl']){const ship=fixture(),r=C.placeFit(ship,k,[120,100,0],[0,1,0],undefined,false);assert.ok(r.fit,r.err);near(r.fit.ped,0);if(!C.fitHasPedestal(k)){for(const key of ['ped','base','low','slope'])near(r.fit[key],0);near(C.len(C.sub(C.fitOrigin(r.fit),r.fit.p)),0);const f={...plain(r.fit),ped:12,base:7,low:-8,slope:3,pedShape:'trap',pedSize:3};C.mountFit(ship,f);for(const key of ['ped','base','low','slope'])near(f[key],0);assert.equal(f.pedShape,undefined);assert.equal(f.pedSize,undefined);near(f.p[1],100);}}
 const ship=fixture(),r=C.placeFit(ship,'pd',[120,100,0],[0,1,0],3,false);near(r.fit.ped,3);const before=plain(r.fit);assert.equal(C.normalizeFitMount(r.fit),r.fit);assert.deepEqual(plain(r.fit),before,'an explicit articulated pedestal is retained');
});
test('legacy fixed lift is normalized on import while articulated height survives saving',()=>{
 for(const k of ['claser','cmsl','msl','itl','pd']){const ship=fixture(),r=C.placeFit(ship,k,[120,100,0],[0,1,0],0,false);assert.ok(r.fit,r.err);const saved=plain(C.serialize(ship)),f=saved.fits[0];f.ped=7;f.pedShape='trap';f.pedSize=2;const loaded=C.deserialize(saved),out=loaded.fits[0];if(C.fitHasPedestal(k)){near(out.ped,7);assert.equal(out.pedShape,'trap');}else{near(out.ped,0);assert.equal(out.pedShape,undefined);assert.equal(out.pedSize,undefined);near(C.len(C.sub(C.fitOrigin(out),out.p)),0);const twice=C.deserialize(C.serialize(loaded));near(twice.fits[0].ped,0);}}
});
test('craft bounds enclose actual body/store vertices in every mounting frame without a spherical clearance box',()=>{
 const kinds=['claser','claserH','cturret','ctorp','cmsl','cbomb','cpylon'];
 for(const k of kinds)for(let axis=0;axis<6;axis++)for(const scale of [.5,1,2]){const f={id:1,k,p:[9.75,-3.2,2.4],a:axis,ped:0,base:0,low:0,float:false,scale,...(k==='cturret'?{assetYaw:31}:{} )},meshes=[G.meshFits({fits:[f]}),G.meshReferenceFits({fits:[f]})],b=C.fitAABB(f);assert.ok(meshes.some(g=>g.ni>0));for(const g of meshes)for(let i=0;i<g.ni;i++){const j=g.idx[i]*3;for(let a=0;a<3;a++)assert.ok(g.pos[j+a]>=b[a]-4e-5&&g.pos[j+a]<=b[a+3]+4e-5,`${k} axis${axis} scale${scale} vertex${g.pos[j+a]} outside ${b}`);}}
 const f={id:1,k:'claser',p:[0,0,0],a:2,ped:0,base:0,low:-99,pedSize:3,pedShape:'trap'},b=C.fitAABB(f);near(b[5]-b[2],C.FITS.claser.wm);assert.ok(b[4]-b[1]<.33);assert.ok(b[3]-b[0]<2.5,'the2.6m laser has its own long,thin body envelope');
});
test('dirty fixed offsets cannot affect the displayed origin, bounds or emitted mesh',()=>{
 for(const k of ['claser','cmsl','msl','itl']){const a={id:1,k,p:[10,0,0],a:2,base:0,ped:0,low:0,slope:0,float:false},b={...a,base:7,ped:12,low:-8,pedShape:'trap',pedSize:3};assert.deepEqual(plain(C.fitOrigin(b)),plain(C.fitOrigin(a)));assert.deepEqual(plain(C.fitAABB(b)),plain(C.fitAABB(a)));const A=G.meshFits({fits:[a]}),B=G.meshFits({fits:[b]});assert.equal(B.ni,A.ni);assert.deepEqual(Array.from(B.pos.slice(0,B.n*3)),Array.from(A.pos.slice(0,A.n*3)));}
});
test('thin craft fittings reject coincident hardware while touching and separate mounts remain legal',()=>{
 for(const k of ['claser','claserH','cturret','ctorp','cmsl','cbomb','cpylon'])for(let axis=0;axis<6;axis++){const a={id:1,k,p:[0,0,0],a:axis,base:0,ped:0,low:0,float:false},s={fits:[a]},b={...a,id:2,p:a.p.slice()};assert.ok(C.fitClash(s,b),k+' coincident frame'+axis+' must collide despite a narrow body');const box=C.fitAABB(a),span=box[3]-box[0];b.p=[span+.01,0,0];assert.equal(C.fitClash(s,b),null,k+' separated mounts');b.p=[span,0,0];assert.equal(C.fitClash(s,b),null,k+' touching bounds');}
});
test('left-right mirroring uses the thin physical envelope rather than the barrel-length clearance radius',()=>{
 for(const k of ['claser','claserH','ctorp','cmsl']){const s=fixture(),r=C.placeFit(s,k,[120,100,.318],[0,1,0],0,true);assert.ok(r.fit,r.err);assert.equal(s.fits.length,2,k+' has room for the reflected thin mount');near(s.fits[0].p[2],-s.fits[1].p[2]);assert.equal(s.fits[0].tw,s.fits[1].id);assert.equal(C.fitClash(s,s.fits[0]),null);}
 const s=fixture();assert.ok(C.placeFit(s,'claser',[120,100,0],[0,1,0],0,true).fit);assert.equal(s.fits.length,1,'a fitting on the symmetry plane is not duplicated');
});
