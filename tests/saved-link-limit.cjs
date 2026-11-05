const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console}),plain=v=>JSON.parse(JSON.stringify(v));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx);
function link(i){return {kind:i%2?'heat':'power',from:'p'+(i+1),to:'f'+(-i-1),cap:1e20+i*1e12};}
test('large capital power and heat link lists survive normalization and blueprint round trips beyond 4000',()=>{
 // Exercise transport with small real device records rather than building an
 // Executor hull and thousands of articulated weapons just to test saving.
 const ship=C.newShip({L:1000,W:100,H:100,plan:'rect',sec:'rect'},'Capital routing persistence fixture');
 ship.parts=Array.from({length:66},(_,i)=>({id:i+1,k:i?'battery':'gen',c:[100+i*2,50,0],d:1}));ship.fits=[];ship.nextId=67;ship.links=[];
 for(const from of ship.parts)for(const to of ship.parts)if(from!==to){ship.links.push({kind:'power',from:'p'+from.id,to:'p'+to.id,cap:1e24+from.id*1e18});ship.links.push({kind:'heat',from:'p'+from.id,to:'p'+to.id,cap:1e20+to.id*1e14});}
 assert.equal(ship.links.length,8580);assert.ok(ship.links.filter(l=>l.kind==='power').length>4000);assert.ok(ship.links.filter(l=>l.kind==='heat').length>4000);
 const expected=plain(ship.links),normalized=C.normalizeLinks(ship.links);assert.deepEqual(plain(normalized),expected);
 const saved=C.serialize(ship);assert.deepEqual(plain(saved.links),expected);const loaded=C.deserialize(JSON.parse(JSON.stringify(saved)));assert.deepEqual(plain(loaded.links),expected);assert.deepEqual(plain(C.serialize(loaded).links),expected,'a second save retains every finite capacity and endpoint');
});
test('saved power and heat routes remain bounded at 32000 entries',()=>{
 assert.equal(C.LINK_LIMIT,32000);const input=Array.from({length:C.LINK_LIMIT+31},(_,i)=>link(i)),expected=input.slice(0,C.LINK_LIMIT),normalized=C.normalizeLinks(input);assert.equal(normalized.length,C.LINK_LIMIT);assert.deepEqual(plain(normalized),expected);
 const ship=C.newShip({L:100,W:30,H:20},'Link limit');ship.parts=[];ship.fits=[];ship.links=input;const saved=C.serialize(ship);assert.equal(saved.links.length,C.LINK_LIMIT);assert.deepEqual(plain(C.deserialize(JSON.parse(JSON.stringify(saved))).links),expected);
});
test('route persistence filters invalid records and drops invalid capacities without adding unlimited numeric values',()=>{
 assert.equal(C.normalizeLinks(null),undefined);assert.equal(C.normalizeLinks({}),undefined);assert.equal(C.normalizeLinks([]),undefined);
 const input=[null,{},42,{kind:'beam',from:'p1',to:'p2'},{kind:'power',from:1,to:'p2'},{kind:'heat',from:'pp1',to:'p2'},{kind:'power',from:'p1.5',to:'f2'},{kind:'heat',from:'p1000000000',to:'p2'},
  {kind:'power',from:'p1',to:'f-200',cap:1e26,ignored:'untrusted extra field'},{kind:'heat',from:'f-200',to:'p999999999',cap:0},...[-1,Infinity,NaN,'42'].map(cap=>({kind:'power',from:'p2',to:'p3',cap}))];
 const normalized=C.normalizeLinks(input);assert.deepEqual(plain(normalized),[{kind:'power',from:'p1',to:'f-200',cap:1e26},{kind:'heat',from:'f-200',to:'p999999999',cap:0},...Array.from({length:4},()=>({kind:'power',from:'p2',to:'p3'}))]);assert.ok(normalized.every(l=>l.cap==null||Number.isFinite(l.cap)&&l.cap>=0));
 const ship=C.newShip({L:100,W:30,H:20},'Filtered links');ship.parts=[];ship.fits=[];ship.links=input;const saved=C.serialize(ship),loaded=C.deserialize(JSON.parse(JSON.stringify(saved)));assert.deepEqual(plain(saved.links),plain(normalized));assert.deepEqual(plain(loaded.links),plain(normalized));
});
