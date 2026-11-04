// FACTION-001 factions the player makes (docs/custom-factions.md): the definition and its checks, the shared faction
// tables it is entered into, the galaxy map, relations, JSON and scenarios, the AI fighting one, what it inherits from
// its base faction (strategic temper, raiding, convoys, boarding troops, garrisons, task-force roles), old data and
// unknown ids falling back, and the faction editor rendering in English.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function runtime(lang=false){const context=vm.createContext({console,navigator:{language:lang?'en-US':'ja-JP'},performance:{now:()=>0}});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js',...(lang?['js/lang-en.js','js/i18n.js']:[])])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 return {context,run:code=>vm.runInContext(code,context),...vm.runInContext('({C:Core,R:Rts,G:Galaxy,GD:Ground,P:YardFleetData.designs})',context)};}
const plain=v=>JSON.parse(JSON.stringify(v)),jp=/[぀-ヿ㐀-鿿]/;
const GUARD={id:'u_guard',name:'星域防衛隊',nameEn:'Sector Guard',short:'防衛隊',color:'#22CC99',emblem:'hex',paint:'dark',eras:['gcw','cw'],home:'corellia',base:'rebel',
 fleet:{caps:['mc75'],escorts:['cr90','nebulonb'],recon:['cr90'],perTg:3},craft:['xwing','awing','bogus'],ground:{name:'防衛連隊',companies:['infantry','armor','recon','infantry'],vehicles:{armor:{t2b:2},recon:{speeder:4,bogus:1}}},
 air:'strip',strategy:'aggressive',enemies:['empire','u_nope'],allies:['rebel']};
const ob=list=>({ctgs:[{tgs:[{ships:list.map((src,i)=>({src,name:src+i}))}]}]});

test('a definition is checked field by field; built-in or malformed ids are refused',()=>{
 const {R}=runtime(),d=R.normalizeFactionDef(GUARD);
 assert.equal(d.color,'#22cc99');assert.deepEqual(plain(d.craft),['xwing','awing']);assert.ok(!('bogus' in d.ground.vehicles.recon));assert.equal(d.fleet.perTg,3);
 assert.deepEqual(plain(d.enemies),['empire','u_nope']);assert.deepEqual(plain(d.allies),['rebel']);
 assert.equal(R.normalizeFactionDef({id:'empire',name:'x'}),null);assert.equal(R.normalizeFactionDef({id:'u_X!'}),null);
 const bare=R.normalizeFactionDef({id:'u_bare'});assert.equal(bare.base,'empire');assert.equal(bare.home,'coruscant');assert.deepEqual(plain(bare.craft),plain(R.CRAFT_MIX.empire));
});

test('registering enters the shared tables, the galaxy and the designer list; unregistering clears them',()=>{
 const {C,R,G}=runtime(),d=R.registerFaction(GUARD);
 assert.ok(R.FACTIONS.u_guard.custom);assert.equal(R.factionBase('u_guard'),'rebel');assert.equal(R.REGIMENT_TEMPLATES.u_guard.name,'防衛連隊');assert.ok(R.DOCTRINE.u_guard);
 assert.equal(C.DESIGN_FACTIONS.u_guard,'星域防衛隊');assert.equal(R.factionDef('u_guard'),d);
 assert.equal(G.allegiance('gcw','corellia'),'u_guard');assert.equal(G.eraOf('u_guard','republic'),'cw');assert.equal(G.eraOf('u_guard','empire'),'gcw');assert.ok(G.factionBearing('gcw','u_guard',G.BY.coruscant.at));
 assert.equal(R.rivalOf('u_guard'),'empire');assert.equal(R.factionRelation('u_guard','rebel'),'ally');assert.equal(R.factionRelation('empire','u_guard'),'enemy');
 assert.ok(R.unregisterFaction('u_guard'));for(const t of [R.FACTIONS,R.CRAFT_MIX,R.REGIMENT_TEMPLATES,C.DESIGN_FACTIONS,G.POWERS])assert.ok(!('u_guard' in t));
 assert.notEqual(G.allegiance('gcw','corellia'),'u_guard');
});

test('faction files round-trip; a scenario carries the factions it uses and brings them back',()=>{
 const {R}=runtime();R.registerFaction(GUARD);
 const back=R.factionsFromJSON(R.factionsJSON());assert.equal(back.length,1);assert.deepEqual(plain(back[0]),plain(R.factionDef('u_guard')));
 assert.throws(()=>R.factionsFromJSON('{"x":1}'));assert.throws(()=>R.factionsFromJSON('nope'));
 const sc=R.normalizeScenario({sides:[{faction:'empire',fleet:ob(['arquitens'])},{faction:'u_guard',control:'ai',fleet:ob(['cr90'])}]});
 assert.deepEqual(plain(sc.factions.map(d=>d.id)),['u_guard']);const text=R.scenarioJSON(sc);
 R.unregisterFaction('u_guard');const sc2=R.scenarioFromJSON(text);
 assert.equal(sc2.sides[1].faction,'u_guard');assert.ok(R.FACTIONS.u_guard?.custom);assert.deepEqual(plain(R.normalizeScenario(sc2)),plain(sc2));
});

test('old scenarios and designs are unchanged; unknown faction ids fall back',()=>{
 const {C,R}=runtime(),old=R.normalizeScenario({sides:[{faction:'republic'},{faction:'cis'}]});
 assert.ok(!('factions' in old));assert.equal(old.sides[0].faction,'republic');
 const ghost=R.normalizeScenario({sides:[{faction:'u_ghost'},{faction:'u_ghost2'}]});assert.equal(ghost.sides[0].faction,'empire');assert.equal(ghost.sides[1].faction,'rebel');
 assert.equal(R.factionOr('u_ghost','cis'),'cis');assert.equal(R.factionBase('u_ghost'),'empire');assert.equal(R.factionDef('u_ghost'),null);
 const ship=C.newShip?C.newShip('frigate'):C.deserialize(C.serialize(C.EXAMPLES.cr90()));ship.faction='u_guard';
 assert.equal(C.deserialize(C.serialize(ship)).faction,'u_guard','a made faction id is kept even where the faction is unknown');
 assert.ok(!C.deserialize({...C.serialize(ship),faction:'u_BAD!'}).faction);
});

test('an AI side of a made faction fights with its own craft, doctrine and posture',()=>{
 const {R,P}=runtime();R.registerFaction(GUARD);const designs=Object.values(P).map(d=>({key:d.key,name:d.name,p:d.p,info:d.info}));
 assert.ok(R.defaultAir(P.imperial.info,'u_guard',[]).every(q=>['xwing','awing'].includes(q.craft)));
 const w0=R.createWorld({seed:3,designs,sides:[{faction:'u_guard',ai:true},{faction:'empire',ai:true}],fleets:[[{design:'cr90',name:'a',tg:1}],[{design:'cr90',name:'b',tg:1}]]});
 assert.equal(w0.sides[0].strategy,'aggressive');assert.ok(R.doctrineOf(w0,0));
 const w=R.scenarioWorld({region:'kuat',seed:77,sides:[{faction:'empire',control:'player',fleet:ob(['arquitens','arquitens','gozanti','gozanti'])},{faction:'u_guard',control:'ai',strategy:'aggressive',fleet:ob(['mc75','nebulonb','cr90','cr90'])}]},designs);
 let fought=false;for(let t=0;t<6*3600&&!w.result;t+=R.TICK){R.tick(w,R.TICK);fought||=w.battles.size>0;}
 assert.ok(fought,'the AI seeks the enemy out');assert.ok(w.result,'and fights to a result');
});

test('what a made faction takes from its base: strategic temper, raiding, convoys, boarders, garrisons, regiments',()=>{
 const {R,GD}=runtime();R.registerFaction(GUARD);R.registerFaction({id:'u_droid',name:'機械連合',base:'cis'});
 assert.deepEqual(plain(R.convoyKit('u_guard')),plain(R.CONVOY_KIT.rebel));assert.deepEqual(plain(R.convoyKit('u_droid')),plain(R.CONVOY_KIT.cis));assert.deepEqual(plain(R.convoyKit('u_ghost')),plain(R.CONVOY_KIT.empire));
 const w={sides:[{faction:'u_guard'},{faction:'rebel'},{faction:'u_droid'},{faction:'cis'}]};
 assert.deepEqual(plain(R.aiPlan(w,0)),plain(R.aiPlan(w,1)));assert.deepEqual(plain(R.aiPlan(w,2)),plain(R.aiPlan(w,3)));
 assert.equal(R.troopRoom({troopCap:10,droidCap:99},'u_droid'),99);assert.equal(R.troopRoom({troopCap:10,droidCap:99},'u_guard'),10);
 const reg=R.makeRegiment('u_guard','r');assert.equal(reg.battalions[0].companies[1].vehicles.t2b,2);
 assert.ok(R.vehicleServes('t2b','u_guard')&&R.vehicleServes('speeder','u_guard'));assert.ok(!R.vehicleServes('atat','u_guard'));
 assert.ok(GD.garrison('u_droid',3).filter(u=>u.kind==='inf').every(u=>u.droid));assert.ok(GD.garrison('u_guard',3).filter(u=>u.kind==='inf').every(u=>!u.droid));
 assert.ok(GD.garrison('u_guard',3).some(u=>u.kind==='veh'&&u.key==='t2b'));
 assert.ok(GD.forcesFromRegiments([R.makeRegiment('u_droid','x')],'u_droid','t').filter(u=>u.kind==='inf').every(u=>u.droid));
});

test('the faction editor, its lists and messages read in English; user names stay as typed',()=>{
 const {context,run,R}=runtime(true);context.KSI18n.setLanguage('en');
 const t=s=>{const out=context.KSI18n.t(s);assert.doesNotMatch(out,jp,s+' => '+out);return out;};
 run(`const C=Core,R=Rts,esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),toast=()=>{},LS={get(){return null},set(){return true}},$=()=>null,
  voy={designs:new Map(),saves:[]},msOwnerMemo={},msSideMemo=new Map(),fLen=v=>v+' m',voyShort=n=>String(n).split('｜')[0],voyDesign=()=>null,voyPlayerDesigns=()=>[],
  voyExampleDesigns=()=>Object.values(YardFleetData.designs).map(d=>({key:d.key,name:d.name,faction:d.faction||R.SIDE_OF[d.side]||'empire',info:d.info,src:'example'})),
  VOY_FLEET_DOCTRINE={rebel:{caps:['mc75'],escorts:['cr90'],recon:[]}},VOY_ROLE_TF={rebel:{seq:['line','raid'],raid:['mc30c','cr90'],recon:['cr90']}},voyRival=f=>R.rivalOf(f),voyDownload=()=>true;`);
 run(app.slice(app.indexOf('function voyFacName(k)'),app.indexOf('function voyDesignOptions(')));
 run(app.slice(app.indexOf('// ---------- FACTION-001 the factions the player makes'),app.indexOf('// ---------- starting a battle ----------')));
 const d=run(`voyFactionInstall(${JSON.stringify(GUARD)})`);assert.equal(d.id,'u_guard');
 assert.deepEqual(plain(run('VOY_ROLE_TF.u_guard')),{seq:['line','raid'],raid:['mc30c','cr90'],recon:['cr90']},'the base\'s role sequence, the faction\'s own recon list');
 run(`voyFactionStart('rebel')`);const html=run('voyFactionHTML({tab:"faction"})');
 for(const s of html.replace(/<(svg|option)[^>]*>[\s\S]*?<\/\1>/g,'').replace(/<[^>]*(translate="no"|data-l10n-skip)[^>]*>[^<]*<\/[^>]*>/g,'').split(/<[^>]*>/).map(x=>x.trim()).filter(Boolean))t(s);
 for(const m of html.matchAll(/(?:label|title|aria-label|placeholder)="([^"]*)"/g))if(jp.test(m[1])&&!/星域防衛隊|防衛隊/.test(m[1]))t(m[1]);
 assert.match(run('voyFactionOptions("empire")'),/★ Sector Guard/,'the English name in English');
 context.KSI18n.setLanguage('ja');assert.match(run('voyFactionOptions("empire")'),/★ 星域防衛隊/);context.KSI18n.setLanguage('en');
 for(const s of ['陣営「Guard」を保存しました','陣営 2 件を読み込みました','銀河帝国のドクトリンを写しました','機甲中隊の車両','保存した設計を準備しています','陣営の形式ではありません','この設計の陣営はこの端末にありません（全陣営として扱います）。'])t(s);
});
