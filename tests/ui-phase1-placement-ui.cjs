// UI phase 1 (2026-11-12) item 1b: placement is explicit, and touch placement takes two taps.
//  - a canvas tap places only while placement is armed (設置); an open detail view or drawer never arms it;
//  - on touch the first tap shows the preview (ghost) at that spot and places nothing; a second tap on the same
//    spot places it; a tap elsewhere moves the preview; the mouse keeps one click;
//  - continuous placement still works under these rules; 完了 places a pending preview and ends placement.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{test}=require('node:test');
const {setup,fn}=require('./helpers/immediate-design-ui.cjs');
const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const constLine=app.split('\n').find(line=>line.startsWith('const DESIGN_PLACE_TOOLS='));

function harness(options){
 const t=setup(options),r=t.run;
 r(`
 let overlays=0;
 const inspected=[];function designUIInspectTap(h){inspected.push(h);}
 const veTap=()=>false,pick=(px,py)=>py>500?null:hit(1,px,0);
 Gfx.lineSet=()=>{const segs=[];return {segs,cross(p){segs.push(['cross',p.slice()]);},out(){return {pos:new Float32Array(),col:new Uint8Array()};}};};
 const ghostFor=h=>{const ls=Gfx.lineSet();ls.segs.push(['ghost',h.p.slice()]);return ls;};
 view.project=p=>[p[0],100,0];view.cam={r:100};
 const taps=[];function tapHit(tool,h,add){taps.push({tool,p:h?.p?.slice()});designUIStartTap(h);}
 ${constLine}
 `);
 for(const name of ['tapWant','onTap','designTouchPreviewActive','designTouchPlacementTap','designUIDone'])r(fn(name));
 
 return t;
}

test('the external placement check accepts only an armed tool, never the detail view',()=>{
 const t=harness(),r=t.run;
 r('designUI.armed=false;designUI.details=true');assert.equal(r('designExternalPlacementTool()'),false,'details alone does not arm');
 r('designUI.armed=true;designUI.details=false');assert.equal(r('designExternalPlacementTool()'),true);
 assert.match(fn('designExternalPlacementTool'),/designUI\.armed&&/);assert.doesNotMatch(fn('designExternalPlacementTool'),/designUI\.details/);
});

test('a tap without arming does not place, for every placement tool',()=>{
 for(const tool of ['part','fit','userpart','importmesh']){
  const t=harness(),r=t.run;
  r(`designUI.armed=false;designUI.details=true;designUI.drawer=false;currentTool=${JSON.stringify(tool)};onTap(10,100,false)`);
  assert.equal(r('taps.length'),0,tool+': no placement path is entered');assert.equal(r('ship.parts.length'),2);assert.equal(r('ship.fits.length'),0);assert.equal(r('designUI.armed'),false,tool+': the tap did not arm placement');assert.equal(r('inspected.length'),1,tool+': an unarmed tap inspects instead');
  r('designUI.details=false;designUI.drawer=true;onTap(10,100,false)');assert.equal(r('taps.length'),0,tool+': an open drawer does not place');
 }
});

test('the mouse places with one click while armed',()=>{
 const t=harness(),r=t.run;r('onTap(10,100,false,"mouse")');
 assert.equal(r('taps.length'),1);assert.equal(r('ship.parts.length'),3);assert.equal(r('undoStack.length'),1);assert.equal(r('designUI.touchPreview'),null);
 // A call without a pointer type (gamepad cursor, scripts) also keeps the one-click rule.
 const u=harness(),q=u.run;q('onTap(10,100,false)');assert.equal(q('ship.parts.length'),3);
});

test('touch: the first tap previews, a tap elsewhere moves the preview, a second tap on the same spot places',()=>{
 const t=harness(),r=t.run;
 r('onTap(10,100,false,"touch")');
 assert.equal(r('taps.length'),0,'first tap places nothing');assert.equal(r('ship.parts.length'),2);assert.deepEqual(JSON.parse(JSON.stringify(r('designUI.touchPreview.hit.p'))),[10,5,0]);
 assert.equal(r('designUI.touchPreview.lines.segs.some(s=>s[0]==="ghost")'),true,'the ghost is drawn at the tapped spot');assert.equal(r('designTouchPreviewActive()'),true);
 r('onTap(60,100,false,"touch")');assert.equal(r('taps.length'),0,'a tap elsewhere only moves the preview');assert.equal(r('designUI.touchPreview.hit.p[0]'),60);
 r('onTap(70,104,false,"touch")');assert.equal(r('taps.length'),1,'a second tap on the same spot (within the confirm radius) places');
 assert.equal(r('taps[0].p[0]'),60,'placed where the preview was shown, not at the second touch point');assert.equal(r('ship.parts.length'),3);assert.equal(r('designUI.touchPreview'),null);assert.equal(r('designUI.armed'),false,'one-shot placement ends');
});

test('touch on empty space shows no preview and still places nothing',()=>{
 const t=harness(),r=t.run;r('onTap(10,900,false,"touch")');assert.equal(r('designUI.touchPreview'),null);assert.equal(r('ship.parts.length'),2);assert.equal(r('designUI.armed'),true,'the tool stays armed for a corrected tap');
});

test('continuous touch placement: every placement takes its own preview and confirmation',()=>{
 const t=harness({continuous:true}),r=t.run;
 r('onTap(-8,100,false,"touch");onTap(-8,100,false,"touch")');assert.equal(r('ship.parts.length'),3);assert.equal(r('designUI.armed'),true);
 r('onTap(8,100,false,"touch")');assert.equal(r('ship.parts.length'),3,'the next tap previews again');
 r('onTap(8,100,false,"touch")');assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),2);
});

test('完了 places a pending touch preview and ends placement; キャンセル discards it',()=>{
 const t=harness({continuous:true}),r=t.run;
 r('onTap(8,100,false,"touch");designUIDone()');assert.equal(r('ship.parts.length'),3);assert.equal(r('designUI.armed'),false);assert.equal(r('designUI.touchPreview'),null);
 const u=harness(),q=u.run;q('onTap(8,100,false,"touch");designUICancel()');assert.equal(q('ship.parts.length'),2);assert.equal(q('designUI.touchPreview'),null);assert.equal(q('designUI.armed'),false);
});

test('the canvas passes the pointer type to the tap, and the pill names what is placed with 完了 and キャンセル（Esc）',()=>{
 const controls=fn('attachControls');assert.match(controls,/onTap\(e\.clientX, e\.clientY, start\.add, e\.pointerType\)/);
 const bar=fn('designUIBar');assert.match(bar,/［配置中：\$\{designUIPlacementName\(\)\}］/);assert.match(bar,/data-design-action="done"/);assert.match(bar,/キャンセル（Esc）/);assert.match(bar,/data-design-action="cancel"/);
 assert.match(bar,/classList\?\.toggle\('design-armed'/,'the armed glow is a body class (CSS only)');
 const css=fs.readFileSync(path.join(__dirname,'../js/design-ui.css'),'utf8');assert.match(css,/body\.designer-ui\.design-armed \.viewport::after\{/);
});
