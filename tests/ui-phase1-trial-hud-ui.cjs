// UI phase 1 (2026-11-12) trial / fleet piloting HUD.
// 4a: the rudder gauge moves out of the helm pad into its own bar. Layout 2026-11-13 (user request): the bar sits
//     under the pad in the helm column at the left edge, with the rudder arrows; 「水平」 and 「中央に戻す」 are one
//     button 「水平・舵中央」 beside the stick ('neutral': rudder centre and level). X and Z keep their own commands.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function extract(name){const m=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(m,name);for(let end=app.indexOf('}',m.index);end>=0;end=app.indexOf('}',end+1)){const s=app.slice(m.index,end+1);try{new vm.Script(s);return s;}catch{}}assert.fail(name);}
const hudSource=extract('trialHudHTML');
// The pad is the markup from its opening tag up to the next top-level HUD element.
const padMarkup=hudSource.slice(hudSource.indexOf('<div class="th-left" data-th-left><div class="th-card th-pad">'),hudSource.indexOf('<div class="th-stick"'));

test('4a the rudder gauge sits in its own bar under the helm pad, in the left helm column',()=>{
 assert.ok(padMarkup.startsWith('<div class="th-left" data-th-left><div class="th-card th-pad">'),'the helm column holds the pad');
 const bar=padMarkup.slice(padMarkup.indexOf('<div class="th-card th-rudderbar"'));
 assert.ok(padMarkup.indexOf('<div class="th-card th-rudderbar"')>0,'the bar follows the pad');
 assert.doesNotMatch(padMarkup.slice(0,padMarkup.indexOf('<div class="th-card th-rudderbar"')),/data-th-row="rudder"|data-trial-cmd="rudder[+-]"/,'no gauge or arrows left in the pad');
 assert.match(bar,/data-trial-cmd="rudder-"[^]*data-th-row="rudder"[^]*data-trial-cmd="rudder\+"/,'arrows on both sides of the gauge');assert.match(bar,/data-th="rudder">舵中央</);
 assert.match(hudSource,/<button type="button" class="th-btn th-level" data-trial-cmd="neutral"[^>]*>水平・舵中央<\/button>/);
 const css=fs.readFileSync(path.join(root,'js/design-ui.css'),'utf8');
 assert.match(css,/#trialHud \.th-left\{position:absolute;left:var\(--th-gl\);top:50%;transform:translateY\(-50%\)/,'left edge, vertically centred');
});

test('4a the X key and the gamepad keep the centre command; the merged button centres the rudder and levels',()=>{
 assert.match(app,/else if\(cmd==='center'\)\{trial\.rudder=0;trial\.level=false;\}/);assert.match(app,/else if\(cmd==='neutral'\)\{trial\.rudder=0;trial\.level=true;\}/);assert.match(app,/KeyX:'center'/);assert.match(app,/down: 'center'/);
 // The fire-control status sits along the bottom edge, beside the helm column only where they meet.
 assert.match(extract('trialGunsLayout'),/lo=\(left&&left\.bottom>hr\.bottom-edge-band\?left\.right:hr\.left\)\+10/);
});

test('4a the gauge still follows the ordered and actual rudder',()=>{
 const update=extract('trialHudUpdate');assert.match(update,/hud\.querySelector\('\[data-th-row="rudder"\]'\)/);assert.match(update,/set\('rudder',TRIAL_RUDDER\[trial\.rudder\+2\]\)/);
});

// 4c (meter only, user decision 2026-11-12: the power order stays fixed, no selectable modes):
//     a reactor-load meter beside the throttle in the trial and fleet piloting HUD (both use trialHudHTML).
test('4c the reactor-load meter sits beside the throttle in the helm pad, with the stored-heat gauge next to it',()=>{
 const pad=padMarkup.slice(0,padMarkup.indexOf('<div class="th-card th-rudderbar"'));
 assert.ok(pad.indexOf('data-th-throttle')<pad.indexOf('data-th-load')&&pad.indexOf('data-th-load')<pad.indexOf('data-th-heat'),'throttle, reactor load, stored heat');
 assert.match(pad,/role="meter" aria-label="炉心負荷" aria-valuemin="0" aria-valuemax="150"/);assert.match(pad,/data-th-heat role="meter" aria-label="蓄熱"/);
 // The power order is fixed: shown in the fleet screen, with no control in the piloting HUD (2026-11-13).
 assert.match(extract('fleetPowerHTML'),/シールド・艦内設備 → 兵装 → 航行/,'the fixed power order is unchanged');
 assert.doesNotMatch(hudSource,/data-trial-cmd="power"|id="thPower"/,'no power-order button or panel');assert.doesNotMatch(app,/KeyP:'pnext'|select: 'pnext'/,'no key or pad button opens it');
 // The reactor load and thrust are not repeated in the fire-control status.
 assert.doesNotMatch(extract('trialHudUpdate'),/it\(lCls,'炉心負荷'|it\('wait','推力'/);
});

test('4c the meter follows trial.power.load with levels at 95% and 115%',()=>{
 const cx=vm.createContext({});
 vm.runInContext(`const nodes={bar:{style:{}},label:{textContent:''}},attrs={};const box={dataset:{},getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v,querySelector:s=>s.includes('loadbar')?nodes.bar:nodes.label};
 const hud={querySelector:()=>box},sourceText=n=>n.textContent;${extract('trialLoadMeter')}`,cx);
 const read=load=>{vm.runInContext(`trialLoadMeter(hud,${load==null?'null':`{load:${load},P:1e9}`})`,cx);return JSON.parse(vm.runInContext('JSON.stringify({h:nodes.bar.style.height,t:nodes.label.textContent,l:box.dataset.level,v:attrs["aria-valuenow"]})',cx));};
 assert.deepEqual(read(.5),{h:'33.3%',t:'炉心 50%',l:'ok',v:'50'});
 assert.deepEqual(read(1),{h:'66.7%',t:'炉心 100%',l:'wait',v:'100'});
 assert.deepEqual(read(2),{h:'100.0%',t:'炉心 200%',l:'ng',v:'150'},'over 150% the bar is full, the number says how far and aria-valuenow stays within the meter range');
 assert.deepEqual(read(null),{h:'0.0%',t:'炉心 —',l:'none',v:'0'});
 vm.runInContext('trialLoadMeter(hud,{load:0,engF:0,got:null,P:0})',cx);assert.equal(vm.runInContext('nodes.label.textContent',cx),'炉心 —','power lost (no reactor output): a dash, not 0 %');
 assert.match(extract('trialHudUpdate'),/thrust=pw\?\.engF\?\?0;\n trialLoadMeter\(hud,pw\);/);
});
