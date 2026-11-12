// Touching joins for armour and exposure (user decision 2026-11-12, option A): a structure within a few cm
// (SURFACE_CONTACT_GAP, 0.05 m) of the hull covers that skin and its own facing side, as a flush one does; the
// union is counted once. A real gap still exposes both faces. Live, reload and a Worker copy agree.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const close=(a,b,m,t=1e-9)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${m}: ${a} vs ${b}`);
const deck=()=>{const s=C.newShip({L:120,W:50,H:30,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},'gap');s.fits=[];C.ensurePrimaryHull(s);s.nextId=Math.max(...s.parts.map(p=>p.id))+1;return s;};
const withBox=offset=>{const s=deck(),top=C.partAABB(s.parts[0])[4];s.parts.push({id:s.nextId++,k:'struct',form:'box',label:'P',c:[60,top+3+offset,0],s:[16,8,6],yaw:0,pitch:0,offsetX:0,offsetZ:0});s._cache=null;return s;};
const figures=s=>{const st=C.computeStats({...s,_cache:null});return {hullArea:st.hullArea,armorMass:st.armorMass,mass:st.mass,cost:st.cost,aStruct:st.aStruct,skin:st.heat?.skin};};

test('a box 1 mm, 1 cm or 5 cm off the deck covers the deck and its own underside like a flush one; 0.5 m off still exposes both (+256 m², ~+998 t armour)',()=>{
 const flush=figures(withBox(0));
 for(const off of [0.001,0.01,0.05]){const f=figures(withBox(off));for(const k of ['hullArea','armorMass','mass','cost','aStruct','skin'])close(f[k],flush[k],`+${off} m ${k}`,1e-7);}
 const far=figures(withBox(0.5));close(far.hullArea-flush.hullArea,256,'0.5 m gap: deck under the box and its underside are exposed',1e-6);assert.ok(far.armorMass-flush.armorMass>900,'armour for the exposed faces');
});

test('the gap rule gives the same figures live, after a reload and in a Worker copy patched with the editor state',()=>{
 const s=withBox(0.02),live=figures(s),L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));for(const [k,v] of Object.entries(figures(L)))close(v,live[k],'reload '+k);
 const W=withBox(0);C.patchShip(W,JSON.parse(C.publicJSON(C.serialize(s))));W._cache=null;C.refreshPlacementGeometry(W);for(const [k,v] of Object.entries(figures(W)))close(v,live[k],'Worker copy '+k);
});

