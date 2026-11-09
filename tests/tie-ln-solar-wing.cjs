const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js'){const marker='function craftCatalogPrice(type){';assert.equal(source.split(marker).length,2);source=source.replace(marker,'globalThis.__catalogRevisionProbe={get:()=>priceCatalogReady,set:value=>{priceCatalogReady=value;}};\n'+marker);}vm.runInContext(source,cx,{filename:file});}
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9,`${label}: ${a} != ${b}`);
// Build the production example once; the same ship supplies every assertion.
const ship=C.buildDesign('craft_tie_ln'),stats=C.computeStats(ship),panels=ship.parts.filter(p=>p.k==='solarPanel'),preset=C.solarPanelPreset('hex');
if(process.env.KS_TIE_AUDIT_OUTPUT){const dir=path.resolve(process.env.KS_TIE_AUDIT_OUTPUT);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'blueprint.json'),JSON.stringify(C.serialize(ship),null,2)+'\n');fs.writeFileSync(path.join(dir,'stats.json'),JSON.stringify(stats,null,2)+'\n');}
test('TIE/ln wings are two native solar panels with no separately installed framework',()=>{
 assert.equal(panels.length,2);assert.equal(ship.parts.filter(p=>p.label==='太陽電池翼').length,2);
 const removed=new Set(['翼中央ハブ','翼外枠','翼水平桁','翼水平桁フランジ','翼支柱','翼支柱フランジ']);
 assert.equal(ship.parts.filter(p=>removed.has(p.label)).length,0);assert.equal(ship.parts.filter(p=>p.label==='翼支持柱').length,2,'retain the cockpit-to-wing connection columns');
 for(const p of panels){assert.equal(p.form,'outline');assert.deepEqual(plain(p.outline).map(q=>q.join(',')).sort(),plain(preset.outline).map(q=>q.join(',')).sort());near(p.s[0],7.24);near(p.s[1],7.24*preset.aspect);near(p.s[2],.08);assert.equal(p.wing.solar,true);assert.equal(p.panelBracing,preset.panelBracing);near(p.panelFrame,7.24*preset.frameRatio);near(p.panelRib,7.24*preset.ribRatio);assert.ok(C.aeroPanelRibs(p).length>0,'native one-part detailing remains available');}
});
test('the native wing footprint, electricity, cooling and material mass use the real panel part',()=>{
 let solar=0;
 for(const p of panels){const area=Math.abs(C.outlineArea(p.outline))*p.s[0]*p.s[1],volume=C.partVolume(p);near(C.solarArea(p),area);near(C.solarPower(p),area*C.SOLAR.W);near(C.solarCap(p),area*2*C.SOLAR.disW);near(stats.info[p.id].materialMass,volume*C.PARTS.solarPanel.dens);solar+=C.solarPower(p);assert.ok(volume>0);}
 near(stats.solarPower,solar);const wings=stats.wings.filter(w=>panels.some(p=>p.id===w.id));assert.equal(wings.length,2);assert.ok(wings.every(w=>w.solar&&w.solarP>0));
 assert.ok(stats.dims[1]<9,'native panels retain the measured overall craft width');
});
test('mirrored wing identity and editable native panel settings survive save and reload',()=>{
 const [a,b]=panels;assert.equal(a.tw,b.id);assert.equal(b.tw,a.id);near(a.c[0],b.c[0]);near(a.c[1],b.c[1]);near(a.c[2],-b.c[2]);near(a.roll,-b.roll);
 const saved=C.serialize(ship),loaded=C.deserialize(saved),again=C.serialize(loaded),ids=new Set(loaded.parts.map(p=>p.id));assert.equal(ids.size,loaded.parts.length);
 for(const p of panels){const q=loaded.parts.find(q=>q.id===p.id);assert.equal(q.k,'solarPanel');assert.equal(q.tw,p.tw);assert.deepEqual(plain(q.s),plain(p.s));assert.deepEqual(plain(q.outline),plain(p.outline));for(const key of ['panelFrame','panelRib','panelFold','panelKnee','panelSparX','panelBracing'])assert.equal(q[key],p[key],key);near(C.solarPower(q),C.solarPower(p));}
 assert.deepEqual(plain(again.parts),plain(saved.parts));assert.deepEqual(plain(again.links),plain(saved.links));
});


test('fresh factory combat profiles record the native-wing physical revision through cleaning and JSON',()=>{
 const expected={key:'craft_tie_ln',version:C.SHIP_EXAMPLES.craft_tie_ln.physicalRevision};assert.equal(expected.version,2);
 const craft=C.craftPowerProfile(ship,stats),fleet=C.fleetProfile(stats,ship.name,ship);
 for(const p of [craft,fleet]){assert.deepEqual(plain(p.referencePhysicalRevision),expected);assert.equal(C.referencePhysicalProfileCurrent(p,'craft_tie_ln'),true);}
 const clean=C.cleanCraftPowerProfile(plain(craft));assert.ok(clean);assert.deepEqual(plain(clean.referencePhysicalRevision),expected);
 assert.equal(C.referencePhysicalProfileCurrent({...craft,referencePhysicalRevision:undefined},'craft_tie_ln'),false);
});

test('a stale built-in TIE profile rebuilds once and replaces its old mass without rebuilding other types',()=>{
 const fresh=C.craftPowerProfile(ship,stats),stale=plain(fresh);stale.referencePhysicalRevision={key:'craft_tie_ln',version:1};stale.propulsion.massKg=12345;
 const craft=R.CRAFT.tie_ln,fields=['powerProfile','mass','speed','_powerResolved'],before=new Map(fields.map(k=>[k,{has:Object.hasOwn(craft,k),value:craft[k]}])),build=C.buildDesign;let builds=0;
 C.buildDesign=key=>{assert.equal(key,'craft_tie_ln');builds++;return ship;};
 try{craft.powerProfile=stale;craft.mass=12.345;craft._powerResolved=true;const p=R.craftPowerOf(craft);assert.ok(p);assert.notEqual(p,stale);assert.equal(builds,1);near(p.propulsion.massKg,stats.mass*1000);near(craft.mass,stats.mass);assert.equal(C.referencePhysicalProfileCurrent(p,'craft_tie_ln'),true);assert.equal(R.craftPowerOf(craft),p);assert.equal(builds,1);}
 finally{C.buildDesign=build;for(const [k,old]of before)if(old.has)craft[k]=old.value;else delete craft[k];}
});

test('factory revision checks preserve saved custom craft and unrelated built-in snapshots',()=>{
 const stale=plain(C.craftPowerProfile(ship,stats));delete stale.referencePhysicalRevision;stale.propulsion.massKg=12345;
 const custom={name:'Saved old TIE design',design:true,ref:'craft_tie_ln',mass:12.345,powerProfile:stale},other=R.CRAFT.bwing,fields=['powerProfile','mass','speed','_powerResolved'],before=new Map(fields.map(k=>[k,{has:Object.hasOwn(other,k),value:other[k]}])),build=C.buildDesign;
 C.buildDesign=()=>{throw Error('An unrelated or user-authored design must not run the TIE/ln factory');};
 try{const before=plain(stale),normalized=R.craftPowerOf(custom);assert.ok(normalized);near(normalized.propulsion.massKg,12345);near(custom.mass,12.345);assert.deepEqual(plain(stale),before,'normalizing does not mutate the saved source');for(const key of ['id','machineryId','machineryLengthM','machineryRadiusM','machineryOffsetM','effectiveMachineryVolumeM3'])assert.deepEqual(plain(normalized.propulsion.engines.map(e=>e[key])),plain(stale.propulsion.engines.map(e=>e[key])),key);other.powerProfile=stale;other._powerResolved=true;const unrelated=R.craftPowerOf(other);assert.ok(unrelated);near(unrelated.propulsion.massKg,12345);assert.deepEqual(plain(stale),before);}
 finally{C.buildDesign=build;for(const [k,old]of before)if(old.has)other[k]=old.value;else delete other[k];}
});

test('catalogue revision invalidates only stale TIE physics while preserving all quote metadata',()=>{
 const before=plain(C.CRAFT_PRICE_CATALOG),oldReady=cx.__catalogRevisionProbe.get();cx.__catalogRevisionProbe.set(true);
 try{const raw=C.CRAFT_PRICE_CATALOG.entries.tie_ln,row=C.craftCatalogPrice('tie_ln');assert.ok(row);assert.equal(row.powerProfile,null);for(const key of Object.keys(raw))if(key!=='powerProfile')assert.deepEqual(plain(row[key]),plain(raw[key]),key);assert.ok(C.craftCatalogPrice('tie_in').powerProfile);assert.deepEqual(plain(C.CRAFT_PRICE_CATALOG),before);}
 finally{cx.__catalogRevisionProbe.set(oldReady);}
});
