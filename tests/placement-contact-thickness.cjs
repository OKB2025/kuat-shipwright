const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
function fixture(roll=70){const ship=C.newShip({L:100,W:100,H:100,assembly:true});ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[60,60,20],roll}];ship.fits=[];ship.nextId=2;return ship;}
function solve(ship,size,mode='horizontal',o=[0,100,0],d=[0,-1,0]){return C.solvePlacement(ship,{id:-1,k:'struct',form:'box',c:[0,0,0],s:size},{mode,parentStructureId:1,hit:C.rayPart(o,d,ship.parts[0])});}

// 2026-11-13 user decision: no fitting (no contact-face cut). Until then a thin plate across a ridge was refused with
// 'minimum-thickness' because the cut would have deleted its roof. Now the requested plate is kept whole, the seat
// sinks it along its contact axis until its whole base reaches the body (here: the lowest ridge flank under the
// footprint), and it is joined by the overlap. A failed solve still leaves the source untouched (checked below).
function seatedWhole(ship,result,axis){
 assert.equal(result.ok,true,result.error);assert.ok(Math.abs(C.partVolume(result.part)-400)<1e-6*400,`the requested plate is kept whole: ${C.partVolume(result.part)}`);assert.equal(result.contact.connected,true);assert.ok(result.contact.overlap,'joined by the overlap');
 // The base (the plate's lowest level along the axis) sits at the lowest body surface under its footprint.
 const b=C.partAABB(result.part),i=axis.findIndex(v=>v!==0),sign=axis[i],others=[0,1,2].filter(k=>k!==i),base=sign>0?b[i]:-b[i+3];let lowest=Infinity;
 for(let u=0;u<=6;u++)for(let v=0;v<=6;v++){const q=[0,0,0];q[others[0]]=b[others[0]]+(b[others[0]+3]-b[others[0]])*(1e-3+u*(1-2e-3)/6);q[others[1]]=b[others[1]]+(b[others[1]+3]-b[others[1]])*(1e-3+v*(1-2e-3)/6);q[i]=sign*200;const h=C.rayPart(q,C.mul(axis,-1),ship.parts[0]);if(h)lowest=Math.min(lowest,C.dot(h.p,axis));}
 // Reaches the lowest surface under the footprint (probes started outside the body); not sunk further than the
 // sampling difference at the footprint edges of a steep flank (0.1 m).
 assert.ok(base<=lowest+1e-3&&base>=lowest-.1,`base ${base} at the lowest surface ${lowest}`);
}
test('a thin plate across a parent ridge is kept whole and joined by the overlap (no fitting)',()=>{
 const ship=fixture(),before=C.publicJSON(ship),result=solve(ship,[20,20,1]);seatedWhole(ship,result,[0,1,0]);assert.equal(C.publicJSON(ship),before,'solving keeps the source and undo input intact');
});

test('a thin vertical side plate on the rolled parent is kept whole and joined by the overlap (no fitting)',()=>{
 const ship=fixture(),before=C.publicJSON(ship),result=solve(ship,[20,1,20],'vertical',[0,0,100],[0,0,-1]);seatedWhole(ship,result,[0,0,1]);assert.equal(C.publicJSON(ship),before);
});

test('an underside thin plate is kept whole and joined by the overlap after reflection (no fitting)',()=>{
 const ship=fixture(-70),result=solve(ship,[20,20,1],'horizontal',[0,-100,0],[0,1,0]);seatedWhole(ship,result,[0,-1,0]);
});

test('a finite parent does not remove valid planar overhang or the unchanged opposite roof',()=>{
 const ship=fixture(0),result=solve(ship,[100,100,3]);assert.equal(result.ok,true,result.error);assert.equal(result.contact.connected,true);
 assert.ok(Math.abs(C.partVolume(result.part)-30000)<.01);const top=C.rayPart([45,100,45],[0,-1,0],result.part);assert.ok(top,'the corner outside the finite parent remains real geometry');assert.ok(Math.abs(top.p[1]-13)<1e-5);
});
