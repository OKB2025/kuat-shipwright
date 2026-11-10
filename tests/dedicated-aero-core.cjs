const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),ctx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const C=vm.runInContext('Core',ctx),plain=x=>JSON.parse(C.publicJSON(x));
function base(){return C.newShip({L:12,W:8,H:3,assembly:true},'Aero parts');}

test('main wings and solar panels are distinct catalogue parts with shape dimensions',()=>{
 const s=base(),w=C.placePart(s,'wing',[4,1,4],[2,3,.064]),p=C.placePart(s,'solarPanel',[4,1,-4],[2,3,.05]);
 assert.equal(C.PARTS.wing.name,'主翼');assert.equal(C.PARTS.solarPanel.name,'太陽光パネル');
 assert.equal(w.k,'wing');assert.equal(p.k,'solarPanel');assert.equal(w.form,'airfoil');assert.equal(p.form,'outline');
 assert.equal(C.isShapePart(w),true);assert.equal(C.isShapePart(p),true);assert.equal(C.isWing(w),true);assert.equal(C.isWing(p),true);
 assert.equal(C.partLabel(w),'主翼');assert.equal(C.partLabel(p),'太陽光パネル');
 assert.equal(w.wing.solar,undefined);assert.equal(p.wing.solar,true);assert.equal(p.outline.length,6);
 assert.ok(C.partVolume(w)>0);assert.ok(C.partVolume(p)>0);assert.deepEqual(plain(w.s),[2,3,.064]);
 assert.equal(C.allOccupied(s).some(q=>q.id===w.id||q.id===p.id),false,'shaped equipment is not charged as a second interior volume');
});

test('shape placement, mirroring and default apparatus metadata survive paired construction',()=>{
 const s=base(),w=C.placePart(s,'wing',[3.125,1.375,4.625],[.375,.625,.035],{wing:{foil:true,axis:'x',pivot:[3,1,1],open:15,stow:0,T:1}},true),q=s.parts.find(q=>q.id===w.tw);
 assert.ok(q);assert.equal(q.k,'wing');assert.equal(q.wing.foil,true);assert.equal(q.wing.thermal,'high');
 assert.deepEqual(plain(q.c),[3.125,1.375,-4.625]);assert.deepEqual(plain(q.s),plain(w.s));assert.deepEqual(plain(q.wing.pivot),[3,1,-1]);
 const loaded=C.deserialize(C.serialize(s));assert.deepEqual(plain(loaded.parts.find(p=>p.id===q.id).wing),plain(q.wing));
});

test('new apparatus keeps editable panel shape, frame and fold fields after save/load',()=>{
 const s=base(),outline=[[-.5,-.5],[.2,-.5],[.5,-.25],[.5,.3],[-.2,.5],[-.5,.2]];
 const p=C.placePart(s,'solarPanel',[4.125,1.375,-4.625],[3,4,.064],{outline,roll:90,panelFrame:.045,panelRib:.023,panelFold:37,panelKnee:.42});
 const loaded=C.deserialize(C.serialize(s)),q=loaded.parts.find(q=>q.id===p.id);
 for(const k of ['k','form','roll','panelFrame','panelRib','panelFold','panelKnee'])assert.equal(q[k],p[k],k);
 for(const k of ['s','c','outline','wing'])assert.deepEqual(plain(q[k]),plain(p[k]),k);
 assert.ok(C.partAABB(q).every(Number.isFinite));assert.ok(C.structTriangles(q).length>0);
});

test('shape caches survive worker-style transfer and invalidate across a resize or move',()=>{
 const s=base(),p=C.placePart(s,'wing',[4,1,4],[2,3,.064]),before=plain(C.partAABB(p));
 const cache=JSON.parse(JSON.stringify({_aeroWing:p._aeroWing,_aeroMeshPart:p._aeroMeshPart})),copy=plain(p);
 assert.ok(Object.hasOwn(cache._aeroMeshPart,'c'));assert.ok(Object.hasOwn(cache._aeroMeshPart,'s'));
 Object.assign(copy,cache);copy._aeroMeshPart.mesh=copy._aeroWing.mesh;
 assert.deepEqual(plain(C.partAABB(copy)),before);
 copy.s=[copy.s[0],copy.s[1]*2,copy.s[2]];const resized=C.partAABB(copy);
 assert.ok(resized[5]-resized[2]>1.99*(before[5]-before[2]));
 copy.c=[copy.c[0]+.375,copy.c[1]+.125,copy.c[2]];const moved=C.partAABB(copy);
 assert.ok(Math.abs(moved[0]-resized[0]-.375)<.00001);assert.ok(Math.abs(moved[1]-resized[1]-.125)<.00001);
});

test('loading legacy functional structures yields dedicated parts without changing input or membership',()=>{
 const s=base(),o=C.serialize(s);o.parts=[
  {id:1,k:'struct',form:'outline',s:[2,3,.064],c:[4,1,4],outline:[[-.5,-.5],[.5,-.5],[.2,.5],[-.3,.5]],wing:{foil:true,axis:'x',open:15,stow:0,T:1,pivot:[4,1,1],members:{parts:[3],fits:[]}}},
  {id:2,k:'struct',form:'box',s:[2,3,.05],c:[4,1,-4],wing:{solar:true}},
  {id:3,k:'struct',form:'box',s:[.3,.3,.3],c:[4,1,4],label:'wing tip'}
 ];o.nextId=4;o.links=[{kind:'heat',from:'p9',to:'p1'}];
 const before=JSON.stringify(o),loaded=C.deserialize(o),w=loaded.parts.find(p=>p.id===1),p=loaded.parts.find(p=>p.id===2);
 assert.equal(JSON.stringify(o),before);assert.equal(w.k,'wing');assert.equal(p.k,'solarPanel');assert.equal(loaded.parts.find(p=>p.id===3).k,'struct');
 assert.deepEqual(plain(w.s),o.parts[0].s);assert.deepEqual(plain(w.outline),o.parts[0].outline);assert.deepEqual(plain(w.wing.members),{parts:[3],fits:[]});
 assert.deepEqual(plain(p.outline),[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],'legacy rectangular panels remain rectangular');
 assert.equal(loaded.links[0].to,'p1');assert.equal(C.wingMembers(loaded,w).structs[0].id,3);
});

test('the retired external-box migration composes with the dedicated-wing migration',()=>{
 const s=base(),o=C.serialize(s);o.parts=[{id:1,k:'hdisx',d:1,room:[2,3,.064],c:[4,1,4],yaw:12,roll:3}];o.nextId=2;
 const q=C.deserialize(o).parts[0];assert.equal(q.k,'wing');assert.deepEqual(plain(q.s),[2,3,.064]);assert.equal(q.yaw,12);assert.equal(q.roll,3);
});

test('cooling and collection follow useful area while thickness and decorative frame widths do not',()=>{
 const s=base(),w=C.placePart(s,'wing',[4,1,4],[2,3,.06]),p=C.placePart(s,'solarPanel',[4,1,-4],[2,3,.05]);
 const changed=(p,fn)=>{const q=plain(p);fn(q);return q;};
 assert.equal(C.wingCap(changed(w,q=>q.s[2]*=4)),C.wingCap(w));
 assert.equal(C.solarPower(changed(p,q=>q.s[2]*=4)),C.solarPower(p));
 assert.equal(C.solarPower(changed(p,q=>{q.panelFrame*=4;q.panelRib*=4;})),C.solarPower(p));
 assert.equal(C.solarPower(changed(p,q=>q.panelFold=45)),C.solarPower(p));
 assert.equal(C.wingCap(changed(w,q=>q.s[1]*=2)),2*C.wingCap(w));
 assert.equal(C.solarPower(changed(p,q=>q.s[1]*=2)),2*C.solarPower(p));
 assert.equal(C.solarCap(changed(p,q=>q.s[1]*=2)),2*C.solarCap(p));
});

test('small dedicated wings contribute one heat sink and one damageable combat module',()=>{
 const s=base(),w=C.placePart(s,'wing',[4,1,4],[2,3,.06]);C.placePart(s,'gen',[4,1,0],.5,{allowOverlap:true});C.placePart(s,'struct',[5.2,1,0],[.4,.4,.4],{form:'box'});C.placePart(s,'pump',[5.2,1,0],.15,{allowOverlap:true});
 const S=C.computeStats(s),nodes=S.heat.net.dis.filter(d=>d.part===w.id),mods=C.fleetModules(s,S).filter(m=>m.part===w.id);
 assert.equal(nodes.length,1);assert.equal(nodes[0].k,'wing');assert.ok(nodes[0].cap>0);
 assert.ok(C.partVolume(w)<1);assert.equal(mods.length,1);assert.equal(mods[0].k,'dissipator');
});

test('baking a folded panel is pure and fits the complete shape into editable bounds',()=>{
 const s=base(),p=C.placePart(s,'solarPanel',[4.125,1.375,-4.625],[3,4,.064],{panelFold:55,panelKnee:.42,roll:20}),before=C.publicJSON(p),T=C.structTriangles(p),area=C.solarArea(p),baked=C.aeroBake(p);
 assert.ok(baked);assert.equal(C.publicJSON(p),before,'conversion leaves the undo source untouched');
 assert.equal(baked.k,'solarPanel');assert.equal(baked.form,'mesh');assert.ok(baked.s[2]>p.s[2]);
 assert.ok(baked.mesh.v.every(q=>q.every(v=>Math.abs(v)<=.50001)));
 const B=C.structTriangles(baked),points=[];for(let i=0;i<B.length;i+=3)points.push(Array.from(B.slice(i,i+3)));
 for(let i=0;i<T.length;i+=3){const q=Array.from(T.slice(i,i+3));assert.ok(points.some(v=>C.len(C.sub(q,v))<.0002),'all original surface vertices retain their world positions');}
 assert.ok(Math.abs(C.solarArea(baked)-area)/area<.0001,'baked cells keep their actual collection area');
 const o=C.serialize(s);o.parts=[baked];o.nextId=baked.id+1;const loaded=C.deserialize(o).parts[0];
 assert.deepEqual(plain(loaded.s),plain(baked.s));assert.equal(loaded.form,'mesh');assert.ok(C.structTriangles(loaded).length>0);
});

test('editable stock designs use actual dedicated kinds and keep their S-foil or solar roles',()=>{
 const x=C.buildDesign('craft_xwing'),tie=C.buildDesign('craft_tie_ln');
 assert.equal(x.parts.filter(C.isFoil).length,4);assert.equal(x.parts.filter(C.isFoil).every(p=>p.k==='wing'),true);
 assert.equal(tie.parts.some(p=>p.k==='solarPanel'&&p.wing.solar),true);
 assert.equal([...x.parts,...tie.parts].some(p=>p.k==='struct'&&p.wing),false);
});
