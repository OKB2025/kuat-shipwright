// UI phase 1 (2026-11-12) trial / fleet piloting HUD.
// 4a: the rudder gauge moves out of the helm pad to the bottom centre, with a visible 「中央に戻す（X）」 button
//     on the existing 'center' command (the X key and the gamepad already use it).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function extract(name){const m=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(m,name);for(let end=app.indexOf('}',m.index);end>=0;end=app.indexOf('}',end+1)){const s=app.slice(m.index,end+1);try{new vm.Script(s);return s;}catch{}}assert.fail(name);}
const hudSource=extract('trialHudHTML');
// The pad is the markup from its opening tag up to the next top-level HUD element.
const padMarkup=hudSource.slice(hudSource.indexOf('<div class="th-card th-pad">'),hudSource.indexOf('<div class="th-stick"'));

test('4a the rudder gauge sits in its own bottom-centre bar, not in the helm pad',()=>{
 const bar=padMarkup.slice(padMarkup.indexOf('<div class="th-card th-rudderbar"'));
 assert.ok(padMarkup.indexOf('<div class="th-card th-rudderbar"')>0,'the bar follows the pad');
 assert.doesNotMatch(padMarkup.slice(0,padMarkup.indexOf('<div class="th-card th-rudderbar"')),/data-th-row="rudder"/,'no gauge left in the pad');
 assert.match(bar,/data-th-row="rudder"/);assert.match(bar,/data-th="rudder">舵中央</);
 assert.match(bar,/<button type="button" class="th-btn th-center" data-trial-cmd="center" aria-keyshortcuts="X">中央に戻す（X）<\/button>/);
 assert.match(html,/\.th-rudderbar\{position:absolute;left:50%;bottom:var\(--th-gb\);transform:translateX\(-50%\)/);
});

test('4a the centre button, the X key and the gamepad share the centre command',()=>{
 assert.match(app,/else if\(cmd==='center'\)\{trial\.rudder=0;trial\.level=false;\}/);assert.match(app,/KeyX:'center'/);assert.match(app,/down: 'center'/);
 // The turret status line steps above the rudder bar where they would overlap.
 assert.match(extract('trialGunsLayout'),/rudder=box\('\.th-rudderbar'\)[^]*if\(rudder&&rudder\.left<x\+m\.w\/2&&rudder\.right>x-m\.w\/2\)bottom=Math\.max\(bottom,hr\.bottom-rudder\.top\+6\)/);
});

test('4a the gauge still follows the ordered and actual rudder',()=>{
 const update=extract('trialHudUpdate');assert.match(update,/hud\.querySelector\('\[data-th-row="rudder"\]'\)/);assert.match(update,/set\('rudder',TRIAL_RUDDER\[trial\.rudder\+2\]\)/);
});

// 4c (meter only, user decision 2026-11-12: the power order stays fixed, no selectable modes):
//     a reactor-load meter beside the throttle in the trial and fleet piloting HUD (both use trialHudHTML).
test('4c the reactor-load meter sits beside the throttle in the helm pad',()=>{
 const pad=padMarkup.slice(0,padMarkup.indexOf('<div class="th-card th-rudderbar"'));
 assert.ok(pad.indexOf('data-th-throttle')<pad.indexOf('data-th-load')&&pad.indexOf('data-th-load')<pad.indexOf('th-dpad'),'between the throttle and the arrows');
 assert.match(pad,/role="meter" aria-label="炉心負荷" aria-valuemin="0" aria-valuemax="150"/);
 assert.match(hudSource,/<p class="th-power-policy">シールド・艦内設備 → 兵装 → 航行<\/p>/,'the fixed power order is unchanged');
});

test('4c the meter follows trial.power.load with levels at 95% and 115%',()=>{
 const cx=vm.createContext({});
 vm.runInContext(`const nodes={bar:{style:{}},label:{textContent:''}},attrs={};const box={dataset:{},getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v,querySelector:s=>s.includes('loadbar')?nodes.bar:nodes.label};
 const hud={querySelector:()=>box},sourceText=n=>n.textContent;${extract('trialLoadMeter')}`,cx);
 const read=load=>{vm.runInContext(`trialLoadMeter(hud,${load==null?'null':`{load:${load}}`})`,cx);return JSON.parse(vm.runInContext('JSON.stringify({h:nodes.bar.style.height,t:nodes.label.textContent,l:box.dataset.level,v:attrs["aria-valuenow"]})',cx));};
 assert.deepEqual(read(.5),{h:'33.3%',t:'炉心 50%',l:'ok',v:'50'});
 assert.deepEqual(read(1),{h:'66.7%',t:'炉心 100%',l:'wait',v:'100'});
 assert.deepEqual(read(2),{h:'100.0%',t:'炉心 200%',l:'ng',v:'200'},'over 150% the bar is full and the number says how far');
 assert.deepEqual(read(null),{h:'0.0%',t:'炉心 —',l:'none',v:'0'});
 assert.match(extract('trialHudUpdate'),/thrust=pw\?\.engF\?\?0;\n trialLoadMeter\(hud,pw\);/);
});
