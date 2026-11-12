#!/usr/bin/env node
// Real UI/Worker proof of anchored height edits, opt-in repeat placement,
// information-window duplication and the weapon-filter carousels.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),url=process.argv[2]||'http://127.0.0.1:8000/';
const output=path.resolve(process.argv[3]||path.join(root,'docs/benchmarks/height-placement-regression.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['index.html','js/core.js','js/app.js','js/gfx.js','js/engine.js','js/worker.js','js/design-ui.css','js/i18n.js','js/lang-en.js'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const report={status:'RUNNING',date:new Date().toISOString(),sourceSha256:hashes(),harnessSha256:sha(fs.readFileSync(__filename)),
 scope:'Native input and actual rendering/Worker updates for a small Core-generated physical fixture. No injected meshes, fake Worker results or performance claims.',
 conditions:{graphics:'Chromium SwiftShader',touch:true,safari:'Not tested'},errors:[],stages:[]};
fs.mkdirSync(path.dirname(output),{recursive:true});
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const stage=name=>{report.stages.push({name,at:new Date().toISOString()});save();};
const near=(a,b,eps=1e-4)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps,`${a} differs from ${b}`);
async function frames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function settled(page){await page.waitForFunction(()=>{const Y=window.__yard;if(Y?.eng.error)throw Error(Y.eng.error);return Y?.eng.adoptedGen>=Y?.eng.gen&&Y?.eng.geoGen>=Y?.eng.gen&&Y?.eng.statsGen>=Y?.eng.gen;},null,{timeout:90000});await frames(page);}
async function seed(page,{child=true,nested=false}={}){
 return page.evaluate(({child,nested})=>{
  const Y=window.__yard,C=Y.C,s=C.newShip({L:240,W:180,H:100,assembly:true},'Native height regression');
  Object.assign(s,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[240,180,20],label:'Parent'}],fits:[],hatches:[],links:[],groups:[],detail:0,autoHabitation:false,nextId:2,saveId:'native-height-regression'});
  if(child){const p={id:2,k:'struct',form:'box',c:[-45,20,0],s:[20,20,40],taper:0,label:'Height child'},r=C.solvePlacement(s,p,{mode:'horizontal',contactFit:'cut',position:p.c,parentStructureId:1,hit:{p:[-45,10,0],n:[0,1,0]}});if(!r.ok)throw Error(r.code+': '+r.error);const a=C.acceptPlacementResult(s,r);if(!a.ok)throw Error(a.error);}
  if(nested){const p={id:3,k:'struct',form:'box',c:[-45,45,0],s:[8,8,10],taper:0,label:'Nested child'},r=C.solvePlacement(s,p,{mode:'horizontal',contactFit:'cut',position:p.c,parentStructureId:2,hit:{p:[-45,40,0],n:[0,1,0]}});if(!r.ok)throw Error(r.code+': '+r.error);const a=C.acceptPlacementResult(s,r);if(!a.ok)throw Error(a.error);}
  Y.setShip(s);Y.title.hide();Object.assign(Y.st,{tab:'edit',group:'shape',part:'struct',partTool:'place',editTool:'select',view:'normal',sel:null,mirror:false,vmirror:false});Y.renderPanel();Y.draw();
  return{parts:s.parts.length,ids:s.parts.map(p=>p.id)};
 },{child,nested});
}
async function aim(page){
 await page.evaluate(()=>{const Y=window.__yard,v=Y.view(),d=Y.C.norm([.1,.65,1]);v.off=[0,-25,0];Object.assign(v.cam,{ortho:true,r:330,th:Math.atan2(d[2],d[0]),ph:Math.acos(d[1]),target:[0,0,0]});Y.draw();});await frames(page);
}
async function closeInfo(page){const button=page.locator('[data-design-info-close]');if(await button.isVisible())await button.tap();}
async function headerActions(page){
 const result=await page.locator('#dock[data-design-layout="new"]').evaluate(dock=>{
  const header=dock.querySelector('.design-drawer-head'),buttons=[...header.querySelectorAll('[data-design-action="close"],[data-design-action="arm"]')];
  return{closeCount:dock.querySelectorAll('[data-design-action="close"]').length,footerCancelCount:dock.querySelectorAll('[data-design-action="cancel"]').length,
   buttons:buttons.map(button=>{const r=button.getBoundingClientRect(),h=header.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{action:button.dataset.designAction,text:button.textContent,withinHeader:r.top>=h.top-1&&r.bottom<=h.bottom+1,reachable:hit===button||button.contains(hit),x:r.x,right:r.right,y:r.y,bottom:r.bottom};})};
 });
 assert.equal(result.closeCount,1,'new placement has one cancellation control');assert.equal(result.footerCancelCount,0,'the old footer does not duplicate cancellation');assert.equal(result.buttons.length,2);
 assert.ok(result.buttons.every(button=>button.withinHeader&&button.reachable&&button.x>=0),'both adjacent header actions are reachable');assert.ok(result.buttons.find(button=>button.action==='close').text.includes('取消'));
 assert.ok(Math.abs(result.buttons[0].y-result.buttons[1].y)<4,'cancel and place stay beside one another');return result;
}
async function openAncestors(locator){
 for(let i=0;i<12;i++){
  const handle=await locator.evaluateHandle(el=>{const closed=[];for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)closed.unshift(p);return closed[0]||null;}),element=handle.asElement();
  if(!element){await handle.dispose();return;}const summary=await element.$(':scope > summary');await summary.scrollIntoViewIfNeeded();await summary.click();await handle.dispose();
 }
 throw Error('Too many closed field ancestors');
}
async function pickPart(page,id){
 await closeInfo(page);await aim(page);
 const point=await page.evaluate(id=>{
  const Y=window.__yard,C=Y.C,p=Y.ship.parts.find(p=>p.id===id),b=C.partAABB(p),v=Y.view(),candidates=[];
  for(const xf of [.5,.15,.85,.35,.65])for(const zf of [.5,.15,.85,.35,.65])candidates.push([b[0]+(b[3]-b[0])*xf,b[4],b[2]+(b[5]-b[2])*zf]);
  for(const q of candidates){const pixel=v.project(q).slice(0,2),hit=Y.pick(...pixel,{parts:true,fits:false});if(document.elementFromPoint(...pixel)===v.canvas&&hit?.part?.id===id)return pixel;}
  throw Error('No visible native target for part '+id);
 },id);
 await page.mouse.click(...point);await page.locator('#designInfoWindow').waitFor();
 assert.equal(await page.evaluate(()=>window.__yard.st.sel?.id),id);return point;
}
async function partState(page,id=2){return page.evaluate(id=>{const Y=window.__yard,C=Y.C,p=Y.ship.parts.find(p=>p.id===id);return{c:p.c,s:p.s,bounds:C.partAABB(p),volume:C.partVolume(p),form:p.form,taper:p.taper,angles:[p.yaw||0,p.pitch||0,p.roll||0],parent:p.placement?.parentStructureId,anchor:p.placement?.surfaceAnchor,requested:p.placement?.requestedGeometry,gen:Y.eng.gen,adopted:Y.eng.adoptedGen,geometry:!!p._placementGeometry,error:p._placementError||null};},id);}
async function observeUploads(page){
 await page.evaluate(()=>{
  window.__heightUploads=[];window.__heightStrictRequests=[];
  const request=YardEngineClient.request;YardEngineClient.request=function(type,payload){if(type==='placement')window.__heightStrictRequests.push({type,gen:payload.gen});return request.apply(this,arguments);};
  for(const Type of [Gfx.Renderer,Gfx.CompatRenderer]){if(!Type?.prototype||Type.prototype.__heightObserver)continue;Type.prototype.__heightObserver=true;const upload=Type.prototype.upload;
   Type.prototype.upload=function(key,g){const result=upload.apply(this,arguments);if(this.canvas?.id==='cv'&&['preview','previewRef'].includes(key)&&g?.ni>0){const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];let nonFinite=0;for(let i=0;i<g.ni;i++){const offset=g.idx[i]*3;for(let a=0;a<3;a++){const q=g.pos[offset+a];if(!Number.isFinite(q))nonFinite++;bounds[a]=Math.min(bounds[a],q);bounds[a+3]=Math.max(bounds[a+3],q);}}window.__heightUploads.push({key,bounds,nonFinite,indices:g.ni,gen:window.__yard.eng.gen,at:performance.now()});}return result;};
  }
 });
}
async function heatReadouts(page){
 const result=await page.evaluate(()=>{const Y=window.__yard;return{rates:Y.C.heatReadoutRates(Y.stats?.heat),rows:[...document.querySelectorAll('#designMetrics [data-design-metric]')].map(el=>{const r=el.getBoundingClientRect();return{metric:el.dataset.designMetric,label:el.querySelector('dt').getAttribute('aria-label'),text:el.querySelector('dd').textContent,visible:r.width>0&&r.height>0&&getComputedStyle(el).visibility==='visible'};})};});
 assert.equal(result.rows.length,2);for(const key of ['equipmentMaxHeatW','rejectionCapacityW'])assert.ok(Number.isFinite(result.rates[key])&&result.rates[key]>=0);for(const row of result.rows){assert.equal(row.visible,true);assert.ok(row.text.trim()&&row.text.trim()!=='—'&&!/NaN|Infinity/.test(row.text));const value=row.metric==='equipment-heat'?result.rates.equipmentMaxHeatW:result.rates.rejectionCapacityW;if(value===0)assert.equal(parseFloat(row.text),0);}
 return result;
}
async function heightEdit(page){
 await seed(page);await settled(page);await aim(page);await pickPart(page,2);
 await page.locator('[data-design-info-edit]').tap();const height=page.locator('#panel input[type="number"][data-sl="eh"]').first();
 // Open the actual size disclosure through its summary rather than editing DOM state.
 await openAncestors(height);
 await height.scrollIntoViewIfNeeded();await frames(page);const before=await partState(page);near(before.bounds[1],10);near(before.bounds[4],40);
 assert.equal(await page.locator('#dock [data-design-action="edit-cancel"]').count(),1);assert.equal(await page.locator('#dock [data-design-action="edit-apply"]').count(),0,'editing has no explicit apply action');
 await page.evaluate(()=>{window.__heightUploads=[];});await height.fill('100');await height.press('Tab');await frames(page);
 const immediate=await partState(page);near(immediate.c[1]-immediate.s[2]/2,0);near(immediate.s[2],100);near(immediate.bounds[4],100);assert.equal(immediate.form,before.form);assert.equal(immediate.taper,before.taper);assert.deepEqual(immediate.angles,before.angles);for(const axis of [0,2])near(immediate.c[axis],before.c[axis]);assert.deepEqual(immediate.s.slice(0,2),before.s.slice(0,2));
 await page.screenshot({path:output.replace(/\.json$/,'.height-edit.jpg'),type:'jpeg',quality:85});
 await page.locator('#dock .design-drawer-head [data-design-action="close"]').tap();await settled(page);const after=await partState(page);near(after.c[1],50);near(after.bounds[1],10);near(after.bounds[4],100);near(after.volume,36000,.01);assert.deepEqual(after.anchor,before.anchor);assert.equal(after.parent,before.parent);assert.deepEqual(after.angles,before.angles);assert.equal(after.error,null);const thermal=await heatReadouts(page);
 const uploads=await page.evaluate(gen=>window.__heightUploads.filter(item=>item.gen>gen),before.gen);assert.ok(uploads.length,'height editing uploads real preview geometry');
 for(const item of uploads){assert.equal(item.nonFinite,0);near(item.bounds[4],100);assert.ok(Math.abs(item.bounds[1])<1e-4||Math.abs(item.bounds[1]-10)<1e-4,'preview is the new requested or new fitted solid, not an old slab at the new centre');}
 await page.screenshot({path:output.replace(/\.json$/,'.height-fitted.jpg'),type:'jpeg',quality:85});
 await page.locator('#btnUndo').tap();await settled(page);const undone=await partState(page);near(undone.s[2],40);near(undone.bounds[1],10);near(undone.bounds[4],40);
 await pickPart(page,2);await page.locator('[data-design-info-edit]').tap();const cancelledHeight=page.locator('#panel input[type="number"][data-sl="eh"]').first();await openAncestors(cancelledHeight);await cancelledHeight.scrollIntoViewIfNeeded();await cancelledHeight.fill('70');await cancelledHeight.press('Tab');await page.locator('[data-design-action="edit-cancel"]').tap();await settled(page);const cancelled=await partState(page);near(cancelled.s[2],40);near(cancelled.bounds[1],10);near(cancelled.bounds[4],40);
 return{before,immediate,after,uploads,closeCommits:true,undo:undone,cancelRollsBack:cancelled,thermal};
}
async function duplicate(page){
 await seed(page,{child:true,nested:true});await settled(page);await pickPart(page,2);const before=await page.evaluate(()=>window.__yard.ship.parts.map(p=>p.id));
 const action=page.locator('[data-design-info-duplicate]');assert.equal(await action.textContent(),'複製');await action.tap();await frames(page);
 const result=await page.evaluate(ids=>{const Y=window.__yard;return{parts:Y.ship.parts.length,selected:Y.st.sel,copies:Y.ship.parts.filter(p=>!ids.includes(p.id)).map(p=>({id:p.id,label:p.label,parent:p.placement?.parentStructureId,unresolvedParent:p.placement?.unresolvedParentId})),infoVisible:document.querySelector('#designInfoWindow').getBoundingClientRect().height>0,editorOpen:!!document.querySelector('[data-design-edit-session]')};},before);
 assert.equal(result.parts,before.length+2);assert.equal(result.copies.length,2);const rootCopy=result.copies.find(p=>p.label==='Height child');assert.ok(rootCopy);assert.ok(result.copies.some(p=>p.parent===rootCopy.id),'the nested child is copied with its new parent');assert.equal(result.infoVisible,true);assert.equal(result.editorOpen,false);
 await page.screenshot({path:output.replace(/\.json$/,'.duplicate-info.jpg'),type:'jpeg',quality:85});await page.locator('#btnUndo').tap();await settled(page);assert.deepEqual(await page.evaluate(()=>window.__yard.ship.parts.map(p=>p.id)),before);return{...result,oneUndoRemovesBoth:true};
}
async function openPlacement(page,{repeat=false,mirror=false,assertDefault=false}={}){
 await page.locator('[data-design-open="new"]').tap();await page.locator('[data-palpick="part:struct"]').tap();
 await headerActions(page);
 const checkbox=page.locator('[data-design-continuous]');if(assertDefault)assert.equal(await checkbox.isChecked(),false,'ordinary placement is the default');await checkbox.setChecked(repeat);
 for(const [key,want]of [['mirror',mirror],['vmirror',false]]){const b=page.locator('[data-design-symmetry="'+key+'"]');if((await b.getAttribute('aria-pressed')==='true')!==want)await b.tap();}
 for(const key of ['sl','sw','sh']){const field=page.locator('#panel input[type="number"][data-sl="'+key+'"]').first();await openAncestors(field);await field.scrollIntoViewIfNeeded();await field.fill('20');await field.press('Tab');}
 await page.locator('[data-design-action="arm"]').tap();await frames(page);
}
async function target(page,candidates){return page.evaluate(candidates=>{const Y=window.__yard,v=Y.view(),placing=!document.querySelector('#designPlacementBar')?.hidden;for(const [x,z]of candidates){const pixel=v.project([x,10,z]).slice(0,2),hit=Y.pick(...pixel,{parts:!placing,fits:false});if(document.elementFromPoint(...pixel)===v.canvas&&(hit?.parentStructureId??hit?.part?.id)===1)return{pixel,point:hit.p};}throw Error('No clear real parent target');},candidates);}
async function placement(page){
 await seed(page,{child:false});await settled(page);await aim(page);await closeInfo(page);await openPlacement(page,{assertDefault:true});
 const first=await target(page,[[65,45],[65,-45],[-70,45]]);await page.mouse.click(...first.pixel);await frames(page);
 assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),2);assert.equal(await page.locator('#designPlacementBar').isVisible(),false,'single placement disarms immediately');
 const next=await target(page,[[-70,-45],[-70,45],[70,-45]]);await page.mouse.click(...next.pixel);await frames(page);assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),2,'the next ordinary tap cannot add another part');assert.equal(await page.locator('#designInfoWindow').isVisible(),true);await settled(page);
 await closeInfo(page);await openPlacement(page,{repeat:true});const second=await target(page,[[-70,45],[-70,-45]]);await page.mouse.click(...second.pixel);await frames(page);assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),3);assert.equal(await page.locator('#designPlacementBar').isVisible(),true);
 const third=await target(page,[[70,-45],[0,-45]]);await page.mouse.click(...third.pixel);await frames(page);assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),4);assert.equal(await page.locator('#designPlacementBar').isVisible(),true);
 await page.screenshot({path:output.replace(/\.json$/,'.repeat-placement.jpg'),type:'jpeg',quality:85});await page.locator('#designPlacementBar [data-design-action="cancel"]').tap();await settled(page);
 await seed(page,{child:false});await settled(page);await aim(page);await openPlacement(page,{repeat:false,mirror:true});const mirrored=await target(page,[[60,45],[-60,45]]);await page.mouse.click(...mirrored.pixel);await frames(page);
 const batch=await page.evaluate(()=>window.__yard.ship.parts.filter(p=>p.id!==1).map(p=>({id:p.id,tw:p.tw,pending:p.placement?.pendingGeometry})));assert.equal(batch.length,2);assert.equal(batch[0].tw,batch[1].id);assert.equal(batch[1].tw,batch[0].id);assert.equal(await page.locator('#designPlacementBar').isVisible(),false);
 await page.locator('#btnUndo').tap();await settled(page);assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),1);
 return{defaultSingle:true,nextTapSelectsOnly:true,checkedRepeatAddsTwo:true,symmetryBatch:batch,symmetrySingleUndo:true,strictRequests:await page.evaluate(()=>window.__heightStrictRequests)};
}
async function edge(page,row,direction){
 const carousel=page.locator('.design-weapon-filters .design-carousel').nth(row),button=carousel.locator('[data-design-carousel-step="'+direction+'"]');
 for(let i=0;i<30&&!await button.isDisabled();i++){
  try{await button.tap({timeout:1200});}catch(error){if(await button.isDisabled())break;throw error;}
  await page.waitForTimeout(350);
 }
 assert.equal(await button.isDisabled(),true,'the carousel reaches and marks its end');await frames(page);return carousel;
}
async function swipe(page,track){
 const r=await track.boundingBox(),x0=r.x+r.width*.8,x1=r.x+r.width*.2,y=r.y+r.height/2,session=await page.context().newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y,radiusX:2,radiusY:2}]});
 for(let i=1;i<=6;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*i/6,y,radiusX:2,radiusY:2}]});await page.waitForTimeout(20);}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(350);await session.detach();
}
async function carousels(page){
 const profiles=[];for(const [width,height]of [[1280,588],[390,844]]){
  await page.setViewportSize({width,height});await page.locator('[data-design-open="new"]').tap();const weapon=page.locator('[data-design-category="weapon"]');await weapon.scrollIntoViewIfNeeded();await weapon.tap();await frames(page);
  const before=await page.evaluate(()=>window.__yard.C.publicJSON(window.__yard.ship)),rows=page.locator('.design-weapon-filters .design-carousel');assert.equal(await rows.count(),2);
  const record={width,height,header:await headerActions(page),rows:[]};for(const index of [1,0]){
   const carousel=await edge(page,index,1),track=carousel.locator('[data-design-carousel-track]'),last=track.locator('button').last();
   const state=await track.evaluate(el=>{const box=el.getBoundingClientRect(),last=el.lastElementChild.getBoundingClientRect();return{scrollLeft:el.scrollLeft,width:el.clientWidth,total:el.scrollWidth,last:{x:last.x,right:last.right},track:{x:box.x,right:box.right}};});
   assert.ok(state.last.x>=state.track.x-1&&state.last.right<=state.track.right+1,'the final complete tab is visible');assert.ok(state.track.x>=0&&state.track.right<=width,'the viewport itself is not clipped');
   const leftBefore=state.scrollLeft;await last.tap();await frames(page);const leftAfter=await page.locator('.design-weapon-filters .design-carousel').nth(index).locator('[data-design-carousel-track]').evaluate(el=>el.scrollLeft);near(leftAfter,leftBefore,1);record.rows.push({...state,index,scrollRetained:true});
  }
  await page.screenshot({path:output.replace(/\.json$/,'.carousel-'+width+'.jpg'),type:'jpeg',quality:85});
  const first=await edge(page,0,-1),track=first.locator('[data-design-carousel-track]');if(await track.evaluate(el=>el.scrollWidth>el.clientWidth+1)){await swipe(page,track);record.nativeSwipe=await track.evaluate(el=>el.scrollLeft);assert.ok(record.nativeSwipe>0,'native touch pans the carousel');}
  const allTypes=page.locator('[data-design-weapon-type="all"]');await allTypes.scrollIntoViewIfNeeded();await allTypes.tap();const output40=page.locator('[data-design-weapon-output="40"]');await output40.scrollIntoViewIfNeeded();await output40.tap();await frames(page);
  record.perBarrel40=await page.locator('[data-design-catalog] [data-palpick]').evaluateAll(els=>els.map(el=>el.dataset.palpick));for(const key of ['single40','twin40Dome','twin40','triple40','oct40'])assert.ok(record.perBarrel40.includes('fit:'+key),'40TT per barrel includes '+key);
  const triple=page.locator('[data-palpick="fit:triple40"]');await triple.scrollIntoViewIfNeeded();await triple.tap();const stats=page.locator('dl[data-design-weapon-stats]');await stats.scrollIntoViewIfNeeded();await frames(page);
  record.weaponStats=await stats.locator('dd[data-weapon-stat]').evaluateAll(els=>els.map(el=>({stat:el.dataset.weaponStat,value:el.dataset.value,text:el.textContent})));
  assert.equal(record.weaponStats.length,5);assert.ok(record.weaponStats.every(item=>item.value!==''&&Number.isFinite(Number(item.value))));near(Number(record.weaponStats.find(item=>item.stat==='output').value),40);assert.ok(Number(record.weaponStats.find(item=>item.stat==='power').value)>0);
  await page.screenshot({path:output.replace(/\.json$/,'.weapon-stats-'+width+'.jpg'),type:'jpeg',quality:85});
  assert.equal(await page.evaluate(()=>window.__yard.C.publicJSON(window.__yard.ship)),before,'carousel navigation and filtering cannot mutate the ship');profiles.push(record);await page.locator('#dock .design-drawer-head [data-design-action="close"]').tap();
 }
 return profiles;
}
async function interiorPlacement(page){
 const rows=[];await page.setViewportSize({width:1280,height:720});
 for(const kind of ['cargo','battery']){
  await seed(page,{child:false});await settled(page);
  await page.evaluate(()=>{const Y=window.__yard;Y.st.roomSize=[4,4,4];Y.st.size={...Y.st.size,cargo:4,battery:4};Y.st.sizeCraft={...Y.st.sizeCraft,cargo:4,battery:4};});
  await page.locator('[data-design-space="exterior"]').tap();await page.locator('[data-design-space="interior"]').tap();await aim(page);
  await page.locator('[data-design-open="new"]').tap();await page.locator('[data-design-category="all"]').tap();const part=page.locator('[data-palpick="part:'+kind+'"]');await part.scrollIntoViewIfNeeded();await part.tap();await frames(page);
  assert.equal(await page.locator('[data-design-host]').count(),0,'interior equipment has no host selector');assert.equal(await page.locator('[data-design-interior-anchor]').count(),1,'the primary hull anchor is shown');await page.locator('[data-design-continuous]').setChecked(false);await headerActions(page);await page.locator('[data-design-action="arm"]').tap();await frames(page);
  assert.equal(await page.locator('#dock[data-design-layout="new"]').isVisible(),false,'automatic interior placement can return to the ship without a dropdown choice');
  const tap=await target(page,[[65,45],[-70,-45],[0,0]]);await page.mouse.click(...tap.pixel);await frames(page);assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),2);assert.equal(await page.locator('#designPlacementBar').isVisible(),false);
  await settled(page);const after=await page.evaluate(kind=>{const Y=window.__yard,C=Y.C,p=Y.ship.parts.find(p=>p.k===kind);return{kind:p.k,id:p.id,host:p.placement?.hostId,mode:p.placement?.mode,room:p.room,d:p.d,volume:C.partVolume(p),pending:!!p.placement?.pendingGeometry,failed:!!p.placement?.validationFailed,error:p._interiorPlacementError||p._placementError||null,bounds:C.partAABB(p)};},kind);
  assert.equal(after.host,1);assert.equal(after.pending,false);assert.equal(after.failed,false);assert.equal(after.error,null);assert.ok(after.volume>0);if(kind==='battery')near(after.d,4);else assert.deepEqual(after.room,[4,4,4]);rows.push({requestedDimensions:[4,4,4],automaticHostSelected:true,tap,after});
 }
 await page.screenshot({path:output.replace(/\.json$/,'.interior-auto-host.jpg'),type:'jpeg',quality:85});await page.locator('[data-design-space="exterior"]').tap();return rows;
}
async function venatorHatches(page){
 const archive='assets/source/ship-example-blueprints/venator.json.gz',bytes=zlib.gunzipSync(fs.readFileSync(path.join(root,archive))),raw=JSON.parse(bytes),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/manifest.json')));
 assert.equal(sha(bytes),manifest.models.venator.sha256,'use the authenticated saved Venator');
 const fixture=await page.evaluate(raw=>{
  const Y=window.__yard,C=Y.C,s=C.deserialize(raw,{deferPlacementGeometry:true}),ids=new Set(s.hatches.flatMap(h=>[h.hullOwner,h.bay]).filter(id=>id!=null)),originalParts=s.parts.length,originalFits=s.fits.length;
  s.parts=s.parts.filter(p=>ids.has(p.id));s.fits=[];s.links=[];s.groups=[];s.airWings=[];s.groundForces=[];s.autoHabitation=false;s.saveId='native-venator-hatches';
  Y.setShip(s);Y.title.hide();Object.assign(Y.st,{tab:'edit',part:'struct',group:'shape',view:'normal',editTool:'select',sel:null,mirror:false,vmirror:false});Y.renderPanel();Y.draw();
  return{originalParts,originalFits,retainedPartIds:s.parts.map(p=>p.id),hatchIds:s.hatches.map(h=>h.id),ownerId:s.hatches.find(h=>h.id===56).hullOwner};
 },raw);
 assert.deepEqual([...fixture.retainedPartIds].sort((a,b)=>a-b),[32,48,55,57,363]);assert.equal(fixture.hatchIds.length,5);await settled(page);await closeInfo(page);
 const target=await page.evaluate(id=>{
  const Y=window.__yard,C=Y.C,owner=Y.ship.parts.find(p=>p.id===id),hit=C.rayPart([700,1000,20],[0,-1,0],owner);if(!hit)throw Error('The authored Venator roof ray misses');
  const v=Y.view(),direction=C.norm([0,1,.25]);v.off=hit.p.map(value=>-value);Object.assign(v.cam,{ortho:true,r:900,th:Math.atan2(direction[2],direction[0]),ph:Math.acos(direction[1]),target:[0,0,0]});Y.draw();return{p:hit.p,owner:id};
 },fixture.ownerId);await frames(page);
 const pixel=await page.evaluate(target=>{const Y=window.__yard,pixel=Y.view().project(target.p).slice(0,2),hit=Y.pick(...pixel,{parts:true,fits:false});if(document.elementFromPoint(...pixel)!==Y.view().canvas||hit?.part?.id!==target.owner)throw Error('The native Venator roof tap does not select its real owner');return pixel;},target);
 await page.mouse.click(...pixel);await page.locator('#designInfoWindow [data-design-hatch-controls]').waitFor();assert.equal(await page.locator('#designInfoWindow [data-design-hatch-action="open"]').count(),5);
 const state=()=>page.evaluate(()=>{const Y=window.__yard,C=Y.C,h=Y.ship.hatches.find(h=>h.id===56),owner=Y.ship.parts.find(p=>p.id===h.hullOwner);return{open:h.open,localOpen:owner.hullData.hatches.find(p=>p.id===h.hullHatch).open,active:C.aviationHatchActive(Y.ship,h),area:C.hatchOpenArea(Y.ship,h),gen:Y.eng.gen};});
 const before=await state();assert.equal(before.open,0);assert.equal(before.active,true);const open=page.locator('#designInfoWindow [data-design-hatch-id="56"][data-design-hatch-action="open"]');await open.scrollIntoViewIfNeeded();assert.equal(await open.isDisabled(),false);await open.tap();await settled(page);
 const after=await state();assert.equal(after.open,1);assert.equal(after.localOpen,1);assert.equal(after.active,true);assert.ok(after.area>0);
 await page.locator('#designInfoWindow [data-design-hatch-id="56"][data-design-hatch-action="close"]').scrollIntoViewIfNeeded();await page.screenshot({path:output.replace(/\.json$/,'.venator-hatch-open.jpg'),type:'jpeg',quality:85});
 await page.locator('#btnUndo').tap();await settled(page);const undone=await state();assert.equal(undone.open,0);assert.equal(undone.localOpen,0);
 return{archive,unpackedSha256:sha(bytes),...fixture,scope:'Five authentic owner/bay parts and all five hatches; other264 parts,59 fittings, links, aircraft and ground-force configuration omitted for UI-only verification. No hull or hatch geometry simplified.',target,pixel,listedHatches:5,before,after,oneUndo:undone};
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}),page=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true,locale:'ja-JP'}),served={},pending=[];
 page.on('pageerror',error=>{report.errors.push(error.stack||String(error));save();});page.on('response',response=>{const file=new URL(response.url()).pathname.replace(/^\//,'')||'index.html';if(files.includes(file))pending.push(response.body().then(bytes=>served[file]=sha(bytes)).catch(error=>report.errors.push(file+': '+error.message)));});page.setDefaultTimeout(20000);save();
 try{
  await page.addInitScript(()=>localStorage.setItem('yard.language','ja'));await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:180000});assert.equal(await page.evaluate(()=>YardEngineClient.mode),'worker');report.renderer=await page.evaluate(()=>window.__yard.view()?.kind);assert.equal(report.renderer,'webgl');await observeUploads(page);stage('booted-real-worker');
  report.height=await heightEdit(page);stage('height-and-undo');report.duplicate=await duplicate(page);stage('info-duplicate-descendants');report.placement=await placement(page);assert.deepEqual(report.placement.strictRequests,[]);stage('single-repeat-and-symmetry');report.carousels=await carousels(page);stage('landscape-and-portrait-carousel');report.interior=await interiorPlacement(page);stage('automatic-interior-host');report.venator=await venatorHatches(page);stage('authentic-venator-owned-hatch');
  await Promise.all(pending);report.servedSourceSha256=served;report.servedSourceMatches=Object.fromEntries(['index.html','js/core.js','js/app.js','js/gfx.js','js/engine.js','js/design-ui.css'].map(file=>[file,served[file]===report.sourceSha256[file]]));assert.ok(Object.values(report.servedSourceMatches).every(Boolean));report.sourceSha256After=hashes();report.sourceStable=JSON.stringify(report.sourceSha256)===JSON.stringify(report.sourceSha256After);assert.equal(report.sourceStable,true);report.glError=await page.evaluate(()=>window.__yard.view().gl.getError());assert.equal(report.glError,0);assert.deepEqual(report.errors,[]);report.status='PASS';report.completedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,output,stages:report.stages}));
 }catch(error){report.status='ERROR';report.error=error.stack||String(error);report.failure=await page.evaluate(()=>{const Y=window.__yard;return Y?{parts:Y.ship.parts.map(p=>({id:p.id,c:p.c,s:p.s,placement:p.placement,error:p._placementError})),engine:{gen:Y.eng.gen,adopted:Y.eng.adoptedGen,geo:Y.eng.geoGen,stats:Y.eng.statsGen,error:String(Y.eng.error||'')},uploads:window.__heightUploads}:null;}).catch(()=>null);report.sourceSha256After=hashes();save();await page.screenshot({path:output.replace(/\.json$/,'.failed.jpg'),type:'jpeg',quality:85}).catch(()=>{});throw error;
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
