const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const {C} = require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain = value => JSON.parse(JSON.stringify(value));

function fn(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\s*\\(').exec(app);
  assert.ok(match, name);
  for (let end = app.indexOf('}', match.index); end >= 0; end = app.indexOf('}', end + 1)) {
    const source = app.slice(match.index, end + 1);
    try { new vm.Script(source); return source; } catch {}
  }
  assert.fail('complete function ' + name);
}

function keyboardHandler() {
  const start=app.indexOf("window.addEventListener('keydown', e => {\n    if(fleet.mode!=='design'||trial.on)return;");
  assert.ok(start>=0,'designer keyboard handler');
  for(let end=app.indexOf('});',start);end>=0;end=app.indexOf('});',end+1)) {
    const source=app.slice(start,end+3);
    try{new vm.Script(source);return source;}catch{}
  }
  assert.fail('complete designer keyboard handler');
}

function setup(extra = []) {
  const context = vm.createContext({C, structuredClone});
  const run = source => vm.runInContext(source, context);
  run(`
    const ship = C.newShip({L:100,W:100,H:100,assembly:true},'Space boundaries');
    ship.parts = [
      {id:1,k:'struct',form:'box',c:[0,0,0],s:[20,20,20]},
      {id:2,k:'cargo',c:[0,0,0],d:2},
      {id:3,k:'engine',equipmentId:'internalTurbine',c:[20,0,0],d:2},
      {id:4,k:'engineCore',c:[0,0,0],d:2},
      {id:5,k:'gen',c:[0,0,0],d:2}
    ];
    ship.fits = [{id:6,k:'pd',p:[0,20,0],n:[0,1,0],a:2},{id:7,k:'brS',p:[0,20,0],n:[0,1,0],a:2}];
    ship.groups = [{id:8,parts:[1,2],fits:[6],groups:[]}];
    ship.nextId=9;
    const fleet={mode:'design'},trial={on:false},voy={open:false};
    const designUI={space:'exterior',drawer:false,details:false,armed:false,layout:null,info:null,sequence:0};
    const st={tab:'edit',editTool:'select',mirror:false,vmirror:false,multi:{parts:new Set(),fits:new Set()},sel:null,xf:{},edOpen:{},view:'normal'};
    const calls=[],notices=[],nodes=new Map(),listeners=new Map();
    const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{hidden:true,scrollTop:0,classList:{remove(){},add(){},toggle(){}},setAttribute(){},focus(){},closest(){return null;},scrollIntoView(){}});return nodes.get(selector);};
    const document={body:{classList:{contains(){return false;},toggle(){}}}};
    const window={addEventListener:(name,callback)=>listeners.set(name,callback)};
    const T=x=>x,esc=String,toast=message=>notices.push(message),findSel=sel=>ship[sel.list]?.find(p=>p.id===sel.id);
    const selItem=()=>st.sel?ship[st.sel.list]?.find(p=>p.id===st.sel.id):null;
    const linkedItems=(list,it)=>multiLinked(list,it);
    const xfReset=()=>calls.push('xfReset'),syncHud=()=>calls.push('syncHud'),requestDraw=()=>calls.push('draw');
    const renderPanel=()=>calls.push('render'),designUIPanel=()=>calls.push('panel'),refreshOverlay=()=>calls.push('overlay');
    const designUIEditSession=()=>designUI.editSession||null;
    const designUIEditCancel=()=>{calls.push('cancel:'+designUI.space);designUI.editSession=null;designUI.drawer=false;};
    const designUICancel=()=>{calls.push('placementCancel');designUI.armed=false;designUI.pending=null;};
    const trenchArmamentCancel=()=>calls.push('trenchCancel'),hideInspect=()=>calls.push('hideInspect');
    function designUIInspectMode(){return false;}
    function designUIOpen(which){calls.push('open:'+which);}
    const trenchArmamentOpen=it=>calls.push('trench:'+it.id);
    const tool=()=> 'edit',shot={on:false},fitLinks=()=>[];
    const xfPos=(list,item)=>list==='parts'?item.c:item.p;
    let view=null;
    let itemDrag=null;
    function snapshot(){return {sel:st.sel,multi:{parts:[...st.multi.parts],fits:[...st.multi.fits]}};}
  `);
  for (const name of ['designCapability','designEntityEditable','designSelectionIds','designSpaceNotice','edGroups','edGroup','edParent','edChain','edLeaves','multiLinked','selN','selClear','selFind','selExpand','selSync','selPick','selGroup','multiItems',...extra]) run(fn(name));
  run(`const selSame=a=>a.parts.size===st.multi.parts.size&&a.fits.size===st.multi.fits.size&&[...a.parts].every(x=>st.multi.parts.has(x))&&[...a.fits].every(x=>st.multi.fits.has(x));const selHasAll=a=>[...a.parts].every(x=>st.multi.parts.has(x))&&[...a.fits].every(x=>st.multi.fits.has(x));`);
  return {run};
}

test('editing follows actual placement capabilities for every built-in part and fitting', () => {
  const {run:r}=setup();
  for(const space of ['exterior','interior']) {
    r('designUI.space='+JSON.stringify(space));
    for(const k of Object.keys(C.PARTS)) {
      const expected=C.placementCapability({k}).space===space;
      assert.equal(r('designEntityEditable("parts",{k:'+JSON.stringify(k)+'})'),expected,space+' part '+k);
    }
    for(const k of Object.keys(C.FITS)) {
      assert.equal(r('designEntityEditable("fits",{k:'+JSON.stringify(k)+'})'),C.FITS[k].placement.space===space,space+' fitting '+k);
    }
  }
});

test('internal turbine nozzles stay exterior while engine bodies and reactors stay interior', () => {
  const {run:r}=setup();
  assert.equal(r('designEntityEditable("parts",ship.parts[2])'),true);
  assert.equal(r('designEntityEditable("parts",ship.parts[3])'),false);
  assert.equal(r('designEntityEditable("parts",ship.parts[4])'),false);
  r(`ship.parts[2].label='内装';ship.parts[2].c=[0,0,0];ship.parts[3].label='外装';ship.parts[3].c=[1000,1000,1000];designUI.space='interior';`);
  assert.equal(r('designEntityEditable("parts",ship.parts[2])'),false,'names and visual location do not change capabilities');
  assert.equal(r('designEntityEditable("parts",ship.parts[3])'),true);
  assert.equal(r('designEntityEditable("parts",ship.parts[4])'),true);
});

test('tapping and group selection cannot add opposite-space edit drivers', () => {
  const {run:r}=setup();
  r(`selPick('parts',1,false,true);const before=JSON.stringify(snapshot());selPick('parts',2,true,true);`);
  assert.equal(r('JSON.stringify(snapshot())===before'),true);
  r('selGroup(ship.groups[0],false)');
  assert.deepEqual(plain(r('snapshot()')),{sel:{list:'parts',id:1},multi:{parts:[1],fits:[6]}});
  r(`selClear();designUI.space='interior';selGroup(ship.groups[0],false)`);
  assert.deepEqual(plain(r('snapshot()')),{sel:{list:'parts',id:2},multi:{parts:[2],fits:[]}});
});

test('selection synchronization removes stale opposite-space IDs and symmetric links', () => {
  const {run:r}=setup();
  r(`st.multi={parts:new Set([1,2,3,4,5]),fits:new Set([6,7])};st.sel={list:'parts',id:2};selSync();`);
  assert.deepEqual(plain(r('[...st.multi.parts]')),[1,3]);
  assert.deepEqual(plain(r('[...st.multi.fits]')),[6,7]);
  assert.equal(r('st.sel.id'),1);
  r(`st.mirror=true;ship.parts[0].tw=2;selPick('parts',1,false,true);`);
  assert.deepEqual(plain(r('[...st.multi.parts]')),[1]);
  r(`designUI.space='interior';selSync();`);
  assert.equal(r('selN()'),0);assert.equal(r('st.sel'),null);
});

test('direct info edit and layout links cannot open an opposite-space editor', () => {
  const {run:r}=setup(['designUIInfoEdit','openLayoutTarget']);
  r(`designUI.info={source:ship,list:'parts',id:2};designUIInfoEdit();openLayoutTarget({list:'parts',id:2});`);
  assert.equal(r('calls.some(x=>x.startsWith("open:")||x.startsWith("trench:"))'),false);
  assert.equal(r('designUI.drawer'),false);
  assert.equal(r('st.sel'),null);
  r(`designUI.info={source:ship,list:'parts',id:1};designUIInfoEdit()`);
  assert.equal(r('calls.at(-1)'),'open:edit');
});

test('derived machinery is gated by the saved nozzle target, and trench charge rows by their saved fitting', () => {
  const {run:r}=setup(['editHitItem']);
  r(`designUI.space='interior';const nozzle=editHitItem({part:{id:-99,k:'machinery',nozzle:3}}),charge=editHitItem({part:{id:-100,k:'machinery',trenchChargeRow:true,weaponIds:[6]}});`);
  assert.equal(r('nozzle.it.id'),3);assert.equal(r('designEntityEditable(nozzle.list,nozzle.it)'),false);
  assert.equal(r('charge.it.id'),6);assert.equal(r('designEntityEditable(charge.list,charge.it)'),false);
});

test('performance hatch links resolve the saved bay and obey its active editing space', () => {
  const {run:r}=setup(['openLayoutTarget']);
  r(`ship.hatches=[{id:9,bay:2}];designUI.drawer=true;designUI.layout='performance';openLayoutTarget({list:'hatches',id:9})`);
  assert.equal(r('designUI.layout'),'performance');assert.equal(r('st.sel'),null);
  r(`designUI.space='interior';openLayoutTarget({list:'hatches',id:9})`);
  assert.deepEqual(plain(r('st.sel')),{list:'parts',id:2});assert.equal(r('designUI.layout'),'edit');
});

test('performance links to missing equipment open its new-placement catalogue only in the correct space', () => {
  const {run:r}=setup(['openLayoutTarget']);
  r(`const palettePick=(type,key)=>calls.push('pick:'+type+':'+key);openLayoutTarget({part:'cargo'})`);
  assert.equal(r('calls.some(value=>value.startsWith("pick:"))'),false);
  r(`designUI.space='interior';openLayoutTarget({part:'cargo'})`);
  assert.deepEqual(plain(r('calls.slice(-2)')),['open:new','pick:part:cargo']);
});

test('derived performance routes open read-only information without selecting an editable saved component', () => {
  const {run:r}=setup(['openLayoutTarget']);
  r(`const route={id:-10,k:'machinery',routeId:'drive-route',drivetrain:true,c:[0,0,0]},enginePickParts=()=>[route];function designUIClose(){designUI.drawer=false;designUI.layout=null;calls.push('close');}designUI.drawer=true;designUI.layout='performance';st.sel={list:'parts',id:1};st.multi.parts.add(1);openLayoutTarget({routeId:'drive-route',drivetrain:true})`);
  assert.equal(r('designUI.drawer'),false);assert.equal(r('st.sel'),null);assert.equal(r('selN()'),0);
  assert.equal(r('designUI.info.part===route'),true);assert.equal(r('designUI.editSession'),undefined);
});

test('space changes cancel the prior draft before clearing selection and retain the open panel kind', () => {
  for(const layout of ['new','edit','list','performance']) {
    const {run:r}=setup(['designUISpace']);
    r(`designUI.drawer=true;designUI.layout=${JSON.stringify(layout)};designUI.info={source:ship,list:'parts',id:1};designUI.editSession={source:ship};designUI.armed=true;designUI.pending={state:'validating'};st.sel={list:'parts',id:1};st.multi.parts.add(1);itemDrag={id:1};designUISpace('interior');`);
    assert.equal(r('calls[0]'),'cancel:exterior','cancel reads the original mode');
    assert.equal(r('designUI.space'),'interior');assert.equal(r('st.view'),'xray');
    assert.equal(r('designUI.editSession'),null);assert.equal(r('designUI.pending'),null);
    assert.equal(r('designUI.info'),null);assert.equal(r('itemDrag'),null);
    assert.equal(r('st.sel'),null);assert.equal(r('selN()'),0);
    assert.equal(r('calls.includes("open:'+layout+'")'),true,layout+' stays the same kind of panel');
  }
});

test('old detail links open the installed list instead of restoring the retired pane', () => {
  const {run:r}=setup(['designUIOpen']);r('designUIOpen("details")');
  assert.equal(r('designUI.layout'),'list');assert.equal(r('designUI.details'),false);
  assert.equal(r('st.tab'),'edit');assert.equal(r('designUI.drawer'),true);
});

test('opposite-space direct selection cannot start an editing session or pointer drag', () => {
  const {run:r}=setup(['designUIEditBegin','dragItemStart']);
  r(`let snapshots=0;const snap=()=>{snapshots++;return '';};designUI.drawer=true;designUI.layout='edit';st.sel={list:'parts',id:2};ship._geoProxy=true;view={ray(){throw Error('opposite-space drag reached geometry');}};designUIEditBegin();`);
  assert.equal(r('designUI.editSession'),undefined);assert.equal(r('snapshots'),0);
  assert.equal(r('dragItemStart(10,20)'),false);assert.equal(r('itemDrag'),null);
});

test('placed rows and transform drivers reject stale opposite-space selections', () => {
  const {run:r}=setup(['edRowShown','xfFollowers','xfDrivers']);
  r(`st.multi={parts:new Set([1,2,3,4,5]),fits:new Set([6,7])};st.sel={list:'parts',id:1};`);
  assert.equal(r('edRowShown("parts",ship.parts[1])'),false);
  assert.equal(r('edRowShown("parts",ship.parts[0])'),true);
  assert.deepEqual(plain(r('xfDrivers().map(d=>d.list+":"+d.it.id).sort()')),['fits:6','fits:7','parts:1','parts:3']);
  r(`designUI.space='interior'`);
  assert.equal(r('edRowShown("fits",ship.fits[0])'),false);
  assert.deepEqual(plain(r('xfDrivers().map(d=>d.list+":"+d.it.id).sort()')),['parts:2','parts:4','parts:5']);
});

test('Ctrl+A selects only the active space through the actual keyboard handler', () => {
  const {run:r}=setup();
  r(keyboardHandler());
  r(`const event={key:'a',code:'KeyA',ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,target:{matches(){return false;},closest(){return false;}},preventDefault(){calls.push('preventDefault');}};listeners.get('keydown')(event);`);
  assert.deepEqual(plain(r('[...st.multi.parts]')),[1,3]);assert.deepEqual(plain(r('[...st.multi.fits]')),[6,7]);
  r(`designUI.space='interior';listeners.get('keydown')(event)`);
  assert.deepEqual(plain(r('[...st.multi.parts]')),[2,4,5]);assert.deepEqual(plain(r('[...st.multi.fits]')),[]);
});

test('installed-list and performance keyboard shortcuts cannot bypass explicit editing', () => {
  for(const layout of ['list','performance']) {
    const {run:r}=setup(['designUIInspectMode']);
    r(`const editDelete=()=>calls.push('MUTATE:delete'),editDuplicate=()=>calls.push('MUTATE:duplicate'),editGroup=()=>calls.push('MUTATE:group'),removeWithPreview=()=>calls.push('MUTATE:fallbackDelete');designUI.drawer=true;designUI.layout=${JSON.stringify(layout)};st.tab=${JSON.stringify(layout==='list'?'edit':'spec')};st.sel={list:'parts',id:1};st.multi.parts.add(1);`);
    r(keyboardHandler());
    r(`for(const key of ['Delete','d','g'])listeners.get('keydown')({key,code:key,ctrlKey:key!=='Delete',metaKey:false,shiftKey:false,altKey:false,target:{matches(){return false;},closest(){return false;}},preventDefault(){}});`);
    assert.equal(r('calls.some(value=>value.startsWith("MUTATE:"))'),false,layout+' stays read-only until Edit');
  }
});

test('clipboard validation gates selected roots while keeping dependent children of either space', () => {
  const {run:r}=setup(['designClipboardEditable','copyWingLinks','multiPaste']);
  r(`const clipboard={v:1,parts:[structuredClone(ship.parts[0]),{...structuredClone(ship.parts[1]),placement:{mode:'clip',hostId:1,geometryRevision:1,requestedGeometry:structuredClone(ship.parts[1])}}],fits:[],drivers:{parts:[1],fits:[]}};const clipRead=()=>clipboard,mutate=(label,apply)=>{calls.push('pasteMutation');apply();return true;};`);
  assert.equal(r('designClipboardEditable(clipboard)'),true,'an exterior root brings its interior child');
  r(`designUI.space='interior';multiPaste()`);
  assert.equal(r('ship.parts.length'),5);assert.equal(r('calls.includes("pasteMutation")'),false);
  r(`designUI.space='exterior';multiPaste()`);
  assert.equal(r('ship.parts.length'),7);assert.deepEqual(plain(r('ship.parts.slice(-2).map(p=>p.k)')),['struct','cargo']);
  assert.equal(r('ship.parts.at(-1).placement.hostId'),r('ship.parts.at(-2).id'),'dependent references follow the copied root');
  r('delete clipboard.drivers');
  assert.equal(r('designClipboardEditable(clipboard)'),true,'legacy clips infer a root from their internal references');
  r(`clipboard.parts[1].placement.hostId=999`);
  assert.equal(r('designClipboardEditable(clipboard)'),false,'an omitted external parent makes that interior item an independent root');
});
