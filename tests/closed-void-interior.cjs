// User decision 2026-11-20「内装にとって外装は構造物パーツが違くても繋がってるなら同じ『船体』として一つのまとまりとして扱われ…」and the
// agreed consequence recorded in docs/handoff-2026-11-20 §2: a space closed in by plates counts as inside the ship.
// Six plates make a closed box; the space inside is in no solid. It is inside while the box is closed and outside when a plate is taken away.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')));
function box(open=false){
 const s=C.newShip({L:100,W:60,H:40,assembly:true},'Plates');s.parts=[];s.fits=[];s.hatches=[];s.links=[];s.groups=[];s.nextId=1;
 const plate=(c,size)=>s.parts.push({id:s.nextId++,k:'struct',form:'box',c,s:size,yaw:0,pitch:0,roll:0});
 // outer 44 x 44 x 44 around [0,0,0], walls 2 m: s is [length x, width z, height y]
 plate([0,-21,0],[44,44,2]);if(!open)plate([0,21,0],[44,44,2]);plate([-21,0,0],[2,44,40]);plate([21,0,0],[2,44,40]);plate([0,0,-21],[40,2,40]);plate([0,0,21],[40,2,40]);
 return s;
}
test('a point in a space closed in by plates is inside the ship; with a plate missing it is outside',()=>{
 const s=box();C.computeStats(s);assert.ok(s._clipEnvelope,'the envelope is built');
 for(const p of s.parts)assert.equal(C.unpiercedInStruct?C.unpiercedInStruct(p,[0,0,0]):false,false,'the centre is in no plate');
 const g=C.envelopeVoidGrid(s);assert.equal(!!g&&g.count>0,true,'a closed void is found');/* 36 x 40 x 40 m inside, in 0.5 m cells, less the cells the walls touch */assert.ok(g.count*g.h**3>36*38*38*.9&&g.count*g.h**3<=40*40*40,'void volume '+g.count*g.h**3);
 for(const q of [[0,0,0],[15,-15,10],[-19.5,19.5,-19.5],[19.9,0,0]])assert.equal(C.insideOriginalEnvelope(s,q),true,'inside: '+q);
 for(const q of [[0,30,0],[40,0,0],[0,0,-23.5],[22.5,22.5,22.5]])assert.equal(C.insideOriginalEnvelope(s,q),false,'outside: '+q);
 const o=box(true);C.computeStats(o);assert.equal(C.envelopeVoidGrid(o)===null,true,'an open box has no closed void');assert.equal(C.insideOriginalEnvelope(o,[0,0,0]),false);
});
test('a room in the closed space is kept whole; in the open box it is cut away',()=>{
 const room=s=>{const p={id:s.nextId++,k:'cargo',c:[0,0,0],d:10,room:[10,10,10]};s.parts.push(p);return p;};
 const s=box(),p=room(s),S=C.computeStats(s);assert.ok((S.info[p.id]?.inside??0)>.99,'inside fraction '+S.info[p.id]?.inside);assert.ok(Math.abs(C.partVolume(p,s)-1000)<1,'volume '+C.partVolume(p,s));
 const o=box(true),q=room(o),SO=C.computeStats(o);assert.ok(!(C.partVolume(q,o)>1)||(SO.info[q.id]?.inside??0)<.01,'the room in the open box is not inside: volume '+C.partVolume(q,o)+', inside '+SO.info[q.id]?.inside);
});
