// A refused interior placement keeps a traced failure record (reason, host, overlapping parts). The editor
// shows its text only while it still describes the item's current failure: same code and same validated
// source. A later success or an older restored state does not show stale text.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
function fixture(){const s=C.newShip({L:300,W:120,H:60,assembly:true},'record');s.parts=[{id:1,k:'struct',form:'trap',taper:.3,c:[150,30,0],s:[100,60,30]}];s.fits=[];s.nextId=2;return s;}
function put(s,part){const r=C.preparePlacementDraft(s,part,{mode:'direct',hostId:1,placementModelVersion:C.PLACEMENT_MODEL_VERSION});assert.equal(r.ok,true,r.error);const i=s.parts.findIndex(p=>p.id===part.id);if(i>=0)s.parts[i]=r.part;else s.parts.push(r.part);s.nextId=Math.max(s.nextId,part.id+1);C.refreshPlacementGeometry(s);return s.parts.find(p=>p.id===part.id);}
test('a reactor crossing its host surface is refused with a traced reason and is named in the output warning',()=>{
 const s=fixture(),q=put(s,{id:2,k:'gen',c:[150,30,0],d:40});
 assert.equal(q.placement.repairReason,'fixed-outside');const rec=C.placementFailureRecord(q);assert.ok(rec);
 assert.equal(rec.detail.reason,'host-boundary');assert.equal(rec.detail.hostId,1);assert.match(rec.error,/配置先の外面をまたいでいます（配置先 #1）/);
 assert.ok(!C.publicJSON(s).includes('_placementFailure'),'the record is not saved');
 const S=C.computeStats(s);assert.deepEqual(Array.from(S.invalidReactorIds),[2]);assert.ok(S.warnings.some(w=>/反応炉 #2 は配置が無効/.test(w.text)));
});
test('the record is not used once it no longer describes the current failure, and is cleared by a success',()=>{
 const s=fixture(),q=put(s,{id:2,k:'gen',c:[150,30,0],d:40});
 const key=q.placement.validationSourceKey;q.placement.validationSourceKey='restored-older-state';assert.equal(C.placementFailureRecord(q),null);q.placement.validationSourceKey=key;
 const ok=put(s,{...JSON.parse(C.publicJSON(q)),d:10});assert.ok(!ok.placement.validationFailed,ok._placementError);assert.equal(ok._placementFailure,undefined);assert.equal(C.placementFailureRecord(ok),null);
});
test('the editor warning prefers the current record over the generic text',()=>{
 const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(app,/T\(C\.placementFailureRecord\?\.\(item\)\?\.error\|\|\(item\?\.placement\?\.validationFailed\?item\?\._placementFailureMessage:null\)\|\|'配置の計算で問題が見つかりました。/);
});
