const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),run=code=>vm.runInContext(code,context),plain=x=>JSON.parse(JSON.stringify(x));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,precisePartSize=p=>C.isReactor(p)||['engine','hyper','shield','localShield'].includes(p.k);
let ship;
const st={size:{},sizeCraft:{},placeBy:{},structSize:[180,110,60],roomSize:[120,60,24]};
const panel={innerHTML:''},$=selector=>selector==='#panel'?panel:null;
const esc=s=>String(s??''),num=(n,d=0)=>Number(n).toFixed(d),fmtM=n=>n+' m',rgb=c=>'rgb('+c.join(',')+')',sizeOut=(k,n)=>n+' m';
const activeEquipment=()=>null,equipmentCard=id=>'<button data-equipment="'+id+'"></button>',partList=()=>'',markTabs=()=>{},renderPanelInfo=()=>{},updateHint=()=>{},refreshOverlay=()=>{};
const findSel=()=>null,partInfoHTML=()=>'',selItem=()=>ship.parts[0],twinOfItem=()=>null;
const fitBtn=(k,on,data)=>'<button data-'+data+'="'+k+'"></button>',PED_SHAPES=[['round','round']],storeCapText=()=>'';
function reset(small=true){
 ship={name:'test',hull:small?{L:20,W:12,H:4}:{L:300,W:100,H:40},shipClass:small?'starfighter':'frigate',parts:[],fits:[],armor:{hull:.01,cit:0},keel:'std'};
 Object.assign(st,{tab:'mod',group:'power',part:'gen',partTool:'place',fit:'htl',fitTool:'place',bridge:'podBridge',bridgeTool:'place',bridgeMode:'body',size:{gen:110},sizeCraft:{},placeBy:Object.fromEntries(Object.keys(C.PARTS).map(k=>[k,'inside'])),structSize:[180,110,60],roomSize:[120,60,24],structForm:'trap',structTaper:0,structPlate:false,structLight:false,sel:null,ped:0,pedShape:'round',pedSize:1,engineDir:[-1,0,0],fill:[.2,.8]});
}
`);
section('const PART_KEYS =','// v23 (UI-008)');
section('const CMD_LABEL =','const tabKey =');
section('function seg(','function silhouette(');
section('function partCard(','function fitBtn(');
section('function basePartEditor()','function baseFitEditor(');
section('function baseRenderPanel()','function sizeOut(');
section('function unalignedPartPreview(','function notchBox(');
section('let paletteShip=null;','// v23 Item selection');
run('const PLACE=[["inside","内蔵"],["partial","一部露出"],["outside","外付け"]];reset();');

test('all hull classes offer the same weapons, placeable parts, command rooms and bridge navigation',()=>{
 for(const small of [true,false]){
  context.small=small;run('reset(small);');
  const offered=plain(run('PART_KEYS.filter(partOffered).sort()')),weapons=plain(run('weaponKeys()'));
  assert.ok(offered.includes('cockpit'));assert.ok(offered.includes('command'));assert.ok(offered.includes('pump'));
  assert.ok(weapons.includes('claser'));assert.ok(weapons.includes('htl'));assert.equal(new Set(weapons).size,weapons.length);
  assert.deepEqual(plain(run('layoutGroups().find(g=>g[0]==="command")')),['command','指揮・艦橋']);
  run('openCommandMenu("body");craftPaletteGuard();');assert.equal(run('st.tab'),'bridge');assert.equal(run('st.bridgeMode'),'body');
  run('openCommandMenu("windows");craftPaletteGuard();');assert.equal(run('st.tab'),'bridge');assert.equal(run('st.bridgeMode'),'windows');
  run('openCommandMenu("rooms");craftPaletteGuard();');assert.equal(run('st.tab'),'mod');assert.equal(run('st.group'),'command');assert.equal(run('C.PARTS[st.part].group'),'command');
  if(small){context.smallOffered=offered;context.smallWeapons=weapons.slice().sort();}
  else{assert.deepEqual(offered,plain(context.smallOffered));assert.deepEqual(weapons.slice().sort(),plain(context.smallWeapons));}
 }
});

test('compact hulls prioritize small equipment without filtering capital components or replacing valid selections',()=>{
 run('reset(true);st.fit="htl";st.part="pump";craftPaletteGuard();');
 assert.equal(run('weaponKeys()[0]'),'claser');assert.equal(run('st.fit'),'htl');assert.equal(run('st.part'),'pump');
 assert.equal(run('paletteParts("power")[0]'),'gen');
 run('ship={...ship,hull:{L:300,W:100,H:40},shipClass:"frigate"};st.part="cockpit";st.fit="claser";craftPaletteGuard();');
 assert.equal(run('st.part'),'cockpit');assert.equal(run('st.fit'),'claser');assert.equal(run('weaponKeys()[0]'),'refVen');
});

test('every catalogue part has finite placement defaults even when no previous per-hull size exists',()=>{
 for(const small of [true,false]){
  context.small=small;run('reset(small);st.size={};st.sizeCraft={};');
  const entries=plain(run('PART_KEYS.filter(partOffered).map(k=>({k,value:pSize(k)}))'));
  for(const entry of entries)assert.ok(Number.isFinite(entry.value)&&entry.value>0,entry.k);
  run('setPSize("cockpit",1.25);');assert.equal(run('pSize("cockpit")'),1.25);assert.equal(run('st.sizeCraft.cockpit'),1.25);
  run('setPSize("gen",small?.75:25);');assert.equal(run('pSize("gen")'),small?.75:25);
 }
});

test('small hull palette renders standard equipment and both weapon scales with valid slider dimensions',()=>{
 run('reset(true);craftPaletteGuard();baseRenderPanel();');
 assert.match(run('panel.innerHTML'),/data-equipment=/);assert.doesNotMatch(run('panel.innerHTML'),/NaN|undefined/);
 run('st.part="pump";baseRenderPanel();');assert.match(run('panel.innerHTML'),/data-part="pump"/);assert.doesNotMatch(run('panel.innerHTML'),/NaN|undefined/);
 run('st.tab="arm";baseRenderPanel();');assert.match(run('panel.innerHTML'),/data-fit="htl"/);assert.match(run('panel.innerHTML'),/data-fit="claser"/);
});

test('room dimensions used for preview match the editable placement dimensions on either hull class',()=>{
 for(const small of [true,false]){
  context.small=small;run('reset(small);craftPaletteGuard();st.part="cargo";st.roomSize=[2,1,.5];');
  const preview=plain(run('unalignedPartPreview({kind:"section",p:[5,2,0],n:[0,1,0]})'));
  assert.deepEqual(preview.room,[2,1,.5]);assert.ok(Number.isFinite(preview.d));
  run('st.roomSize[0]=3;');assert.deepEqual(preview.room,[2,1,.5],'placement preview must copy room dimensions');
 }
});

test('palette initialization supplies compact working sizes once without overriding later custom sizes',()=>{
 run('reset(true);craftPaletteGuard();');
 const initial=plain(run('({struct:st.structSize,room:st.roomSize})'));
 assert.ok(initial.struct[0]<20);assert.ok(initial.room[0]<20);
 run('st.structSize=[35,20,4];st.roomSize=[22,9,4];craftPaletteGuard();');
 assert.deepEqual(plain(run('st.structSize')),[35,20,4]);assert.deepEqual(plain(run('st.roomSize')),[22,9,4]);
});

test('editing sub-metre equipment and rooms does not clamp them to capital-size minimums',()=>{
 for(const small of [true,false]){
  context.small=small;run('reset(small);ship.parts=[{id:1,k:"cockpit",c:[5,2,0],d:1.25}];st.sel={list:"parts",id:1};');
  let html=run('basePartEditor()');assert.match(html,/data-sl="ed"[^>]*value="1\.25"/);assert.doesNotMatch(html,/NaN|undefined/);
  const min=Number(html.match(/data-sl="ed"[^>]*min="([^"]+)"/)[1]);assert.ok(min<=1.25);
  run('ship.parts[0]={id:1,k:"cargo",c:[5,2,0],d:1,room:[2,1,.5]};');
  html=run('basePartEditor()');assert.match(html,/data-sl="room2"[^>]*min="0\.05"[^>]*value="0\.5"/);
 }
});
