// User report 2026-11-17「デススターが遠距離でただの四角になってる」: the trial's far plane is 90 km, and a ship beyond it was
// drawn as a speck of its projected size, so a 160 km station 195 km away became a square hundreds of pixels wide.
// A ship large enough on screen to be modelled is drawn as its model at any distance (the far plane reaches it); only ships
// too small to model are specks, and a speck is never larger than FLEET_SPECK.maxPx.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const G=vm.runInContext('Gfx',cx);
function scene(length,dist){
 const drawn=[],points={},gl=new Proxy({}, {get:(_,k)=>/^[A-Z_]+$/.test(String(k))?0:()=>{}}),asset={length,center:[0,0,0],bounds:[-length/2,-length/2,-length/2,length/2,length/2,length/2],meshes:{},foils:[],glow:[]};
 const renderer={gl,meshes:{},off:[0,0,0],cam:{target:[0,0,0],fov:.72,r:60,far:90000},canvas:{width:1200,height:850},eye:()=>[0,0,60],fleetCache:new Map([['far',asset]]),look:{shadow:false},drawMesh:name=>drawn.push(name),drawLines:()=>{},drawRays:()=>{},setLights:()=>{},setPoints:(name,pos,col,size)=>{points[name]={pos:Array.from(pos),size:Array.from(size||[])};},drawPoints:()=>{}};
 G.Renderer.prototype.drawFleet.call(renderer,{},{fleet:[{key:'far',pos:[0,0,60-dist]}],lod:true,mode:'trial'});
 return {drawn,speck:points.fleetSpeck||null,renderer,focal:850/(2*Math.tan(.36))};
}
test('a station far beyond the trial far plane is drawn as its model, not as a speck',()=>{
 const r=scene(160000,195000);
 assert.ok(r.drawn.includes('hull'),'the model is drawn: '+r.drawn.join(','));assert.equal(r.speck,null,'no speck for it');
 const s=scene(19000,195000);assert.ok(s.drawn.includes('hull'),'a 19 km ship at 195 km is modelled too');assert.equal(s.speck,null);
});
test('the projection far plane reaches the farthest ship that is modelled',()=>{
 const far=195000+160000,m=G.Renderer.prototype.matrices.call({canvas:{width:1200,height:850},cam:{target:[0,0,0],fov:.72,r:60,th:0,ph:1.2,far:90000},eye:()=>[0,0,60],_fleetFar:far*1.2}),P=m.P;
 // a point on the far side of the station is inside the clip volume
 const q=[0,0,60-far,1],clip=[0,1,2,3].map(i=>P[i]*q[0]+P[4+i]*q[1]+P[8+i]*q[2]+P[12+i]*q[3]);
 assert.ok(clip[3]>0&&Math.abs(clip[2])<=clip[3],`the far side is not clipped (z ${clip[2]}, w ${clip[3]})`);
 const base=G.Renderer.prototype.matrices.call({canvas:{width:1200,height:850},cam:{target:[0,0,0],fov:.72,r:60,th:0,ph:1.2,far:90000},eye:()=>[0,0,60]}).P,c0=[0,1,2,3].map(i=>base[i]*q[0]+base[4+i]*q[1]+base[8+i]*q[2]+base[12+i]*q[3]);
 assert.ok(c0[2]>c0[3],'without the extension the same point is beyond the 90 km far plane');
});
test('a ship too small to model is a speck of at most FLEET_SPECK.maxPx on screen',()=>{
 const r=scene(300,195000);/* 300 m at 195 km: about 1.7 px */
 assert.deepEqual(r.drawn,[],'no model');assert.ok(r.speck,'a speck');assert.equal(r.speck.size.length,1);
 const d=Math.hypot(r.speck.pos[0],r.speck.pos[1],r.speck.pos[2]-60),px=r.speck.size[0]/d*r.focal;
 assert.ok(d<=90000*.9+1,'drawn inside the far plane: '+d);assert.ok(px<=6+1e-6&&px>0,'size on screen '+px);
 assert.ok(Math.abs(px-300/195000*r.focal)<1e-6,'its projected size is kept');
});
// 2026-11-17「普通にもっと遠くからでも確認できるように／大型艦であるほど遠くから見えるように、デススターサイズはほぼ惑星と同レベルで」.
test('specks last 7.5 times farther than before, and a battle station never fades out',()=>{
 const before=300/.15*(850/(2*Math.tan(.36))),seen=d=>!!scene(300,d).speck;
 assert.ok(seen(before*5),'a 300 m ship is still a speck five times beyond the old limit');assert.ok(!seen(before*10),'but not ten times beyond it');
 const ds=scene(160000,1e10);/* 10 million km: 0.016 px */assert.ok(ds.speck,'a 160 km station is a speck at any distance');
 const ships=scene(1600,1e10);assert.equal(ships.speck,null,'a 1.6 km ship is gone at that distance');
});
