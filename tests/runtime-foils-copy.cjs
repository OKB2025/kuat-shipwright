const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),run=code=>vm.runInContext(code,context),plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C={...Core,mountFit:(s,f)=>{const p=s.parts.find(p=>p.id===f.host);f.p=Core.add(p.c,f.local||[0,1,0]);}};
let ship,clipboard,history=[];
const st={multi:{parts:new Set(),fits:new Set()},pasteMode:'same',multiStep:2,mirror:false,vmirror:false,xf:{step:20}};
const publicCopy=q=>JSON.parse(Core.publicJSON(q)),clipRead=()=>clipboard,toast=()=>{},sndUI=()=>{},esc=s=>s,fmtM=v=>v+' m';
const mutate=(label,fn)=>{history.push(Core.publicJSON(ship));fn();return true;};
const multiItems=()=>({parts:ship.parts.filter(p=>st.multi.parts.has(p.id)),fits:ship.fits.filter(f=>st.multi.fits.has(f.id))});
const xfDrivers=()=>{const m=multiItems();return ['parts','fits'].flatMap(list=>m[list].map(it=>({list,it,fol:[]})));};
const xfBox=(list,q)=>list==='parts'?Core.partAABB(q):[q.p[0]-1,q.p[1]-1,q.p[2]-1,q.p[0]+1,q.p[1]+1,q.p[2]+1];
const xfUnion=boxes=>[0,1,2].map(a=>Math.min(...boxes.map(b=>b[a]))).concat([0,1,2].map(a=>Math.max(...boxes.map(b=>b[a+3]))));
const xfCheck=()=>new Map(),edGroups=()=>[],edLeaves=()=>({parts:[],fits:[]}),edParent=()=>null;
const seatFit=(f,p,n)=>{f.p=p;f.n=n;};
function reset(){
 const wing=(parts,fits,pivot)=>({foil:true,axis:'x',open:15,stow:0,T:1,feed:1,reinf:0,pivot,members:{parts,fits}});
 ship={hull:{L:100,H:20,W:40,assembly:true},nextId:100,parts:[
  {id:1,k:'struct',form:'trap',c:[10,4,8],s:[6,10,1],tw:3,wing:wing([2,8],[5,9],[9,4,5])},
  {id:2,k:'struct',form:'trap',c:[11,4,12],s:[2,1,1],tw:4},
  {id:3,k:'struct',form:'trap',c:[10,4,-8],s:[6,10,1],tw:1,wing:wing([4],[6],[9,4,-5])},
  {id:4,k:'struct',form:'trap',c:[11,4,-12],s:[2,1,1],tw:2},
  {id:8,k:'struct',form:'trap',c:[50,4,8],s:[2,1,1]},
 ],fits:[
  {id:5,k:'claser',host:1,p:[10,5,8],local:[0,1,0],a:2,tw:6},
  {id:6,k:'claser',host:3,p:[10,5,-8],local:[0,1,0],a:2,tw:5},
  {id:9,k:'claser',host:8,p:[50,5,8],local:[0,1,0],a:2},
 ]};
 st.multi={parts:new Set([1,2,3,4]),fits:new Set([5,6])};st.pasteMode='same';st.mirror=false;st.vmirror=false;st.multiStep=2;st.xf.step=20;st.sel=null;history=[];
 clipboard={v:1,from:{L:100,H:20,W:40},...publicCopy(multiItems())};
}
`);
section('function copyWingLinks(', 'function multiPanelHTML(');
section('function editDuplicate(', 'function editDelete(');
run('reset();');

test('duplicate remaps foil assemblies and translates hinges while retaining hosts and mirrored twins',()=>{
 run('reset();');const originals=plain(run('multiItems()'));
 run('editDuplicate();');
 const copies=plain(run('multiItems()')),offset=copies.parts[0].c[0]-originals.parts[0].c[0];
 assert.ok(offset>0);assert.equal(copies.parts.length,4);assert.equal(copies.fits.length,2);
 const [wing,member,twin,twinMember]=copies.parts;
 assert.deepEqual(wing.wing.members,{parts:[member.id],fits:[copies.fits[0].id]});
 assert.deepEqual(twin.wing.members,{parts:[twinMember.id],fits:[copies.fits[1].id]});
 assert.deepEqual(wing.wing.pivot,originals.parts[0].wing.pivot.map((v,a)=>v+(a===0?offset:0)));
 assert.deepEqual(twin.wing.pivot,originals.parts[2].wing.pivot.map((v,a)=>v+(a===0?offset:0)));
 assert.equal(wing.tw,twin.id);assert.equal(twin.tw,wing.id);assert.equal(member.tw,twinMember.id);
 assert.equal(copies.fits[0].host,wing.id);assert.equal(copies.fits[1].host,twin.id);assert.equal(copies.fits[0].tw,copies.fits[1].id);
 assert.deepEqual(copies.fits[0].p,originals.fits[0].p.map((v,a)=>v+(a===0?offset:0)));
 assert.deepEqual(plain(run('publicCopy({parts:ship.parts.filter(p=>p.id<100&&p.id!==8),fits:ship.fits.filter(f=>f.id<100&&f.id!==9)})')),originals);
 assert.equal(run('history.length'),1);
});

test('copy and scaled paste remap only included members and transform the explicit hinge in ship coordinates',()=>{
 run('reset();ship.hull={...ship.hull,L:200,H:60,W:20};st.pasteMode="scale";multiPaste();');
 const copies=plain(run('multiItems()')),[wing,member,twin]=copies.parts;
 assert.deepEqual(wing.c,[20,12,4]);assert.deepEqual(wing.wing.pivot,[18,12,2.5]);assert.deepEqual(twin.wing.pivot,[18,12,-2.5]);
 assert.deepEqual(wing.wing.members,{parts:[member.id],fits:[copies.fits[0].id]});
 assert.equal(wing.tw,twin.id);assert.equal(copies.fits[0].host,wing.id);assert.equal(copies.fits[0].tw,copies.fits[1].id);
 assert.deepEqual(copies.fits[0].p,[20,15,4]);assert.equal(run('clipboard.parts[0].wing.members.parts[0]'),2);
 assert.deepEqual(plain(run('clipboard.parts[0].wing.pivot')),[9,4,5]);
});

test('copying a foil without any carried children drops source references and keeps automatic roots automatic',()=>{
 for(const action of ['editDuplicate();','multiPaste();']){
  run('reset();delete ship.parts[0].wing.pivot;st.multi={parts:new Set([1]),fits:new Set()};clipboard={v:1,from:{L:100,H:20,W:40},...publicCopy(multiItems())};'+action);
  const wing=plain(run('multiItems().parts[0]'));
  assert.equal(Object.hasOwn(wing.wing,'members'),false);assert.equal(Object.hasOwn(wing.wing,'pivot'),false);assert.equal(Object.hasOwn(wing,'tw'),false);
  assert.deepEqual(plain(run('ship.parts[0].wing.members')),{parts:[2,8],fits:[5,9]});
 }
});

test('legacy multi-move shifts each explicit hinge once with the part and mirrors displacement for symmetric pairs',()=>{
 run('reset();st.mirror=true;multiMove(2,1);');
 assert.deepEqual(plain(run('ship.parts[0].c')),[10,4,10]);assert.deepEqual(plain(run('ship.parts[0].wing.pivot')),[9,4,7]);
 assert.deepEqual(plain(run('ship.parts[2].c')),[10,4,-10]);assert.deepEqual(plain(run('ship.parts[2].wing.pivot')),[9,4,-7]);
 assert.deepEqual(plain(run('ship.parts[0].wing.members')),{parts:[2,8],fits:[5,9]});
 assert.deepEqual(plain(run('ship.fits[0].p')),[10,5,10]);assert.deepEqual(plain(run('ship.fits[1].p')),[10,5,-10]);
 assert.equal(run('history.length'),1);
 run('reset();delete ship.parts[0].wing.pivot;multiMove(0,1);');assert.equal(run('Object.hasOwn(ship.parts[0].wing,"pivot")'),false);
});
