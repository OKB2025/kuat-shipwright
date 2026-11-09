const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function fn(name){const m=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(m,name);for(let i=app.indexOf('}',m.index);i>=0;i=app.indexOf('}',i+1)){const s=app.slice(m.index,i+1);try{new vm.Script(s);return s;}catch{}}assert.fail(name);}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function setup(){
 const cx=vm.createContext({console}),run=s=>vm.runInContext(s,cx);
 for(const f of['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])run(fs.readFileSync(path.join(root,f),'utf8'));
 run(`const C=Core,tv={add:(a,b,k=1)=>a.map((v,i)=>v+b[i]*k),scale:C.mul,dot:C.dot,len:C.len,norm:C.norm,cross:C.cross};
 const trial={on:true,p:{maxSpeed:1000},stick:{x:0,y:0},keyStick:{x:0,y:0},keys:new Set(),throttle:.373,w:[0,0,0],rudder:0,P:[10000,10000,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],t:0,vf:0,dust:{H:100,pos:[]},rec:{top:0},camF:[1,0,0],aim:{marker:'unchanged'}};
 const trialSystemsUnit=()=>null,trialPropulsionMotion=()=>({acc0:0,acc:0,turn:1}),trialGunnery=()=>{},trialMainOutput=()=>0,trialRateBase=()=>({tau:1}),trialMaxRates=()=>[1,1,1],trialCol=(r,i)=>r.slice(3*i,3*i+3),trialAttitude=()=>({bank:0,pitch:0,f:trialCol(trial.R,0),u:trialCol(trial.R,1),r:trialCol(trial.R,2)}),trialSys=()=>({planet:{radius:0},floor:0}),trialHudUpdate=()=>{};
 const events={},knob={style:{}},classes=new Set(),stick={querySelector:()=>knob,getBoundingClientRect:()=>({left:100,top:200,width:100,height:100}),addEventListener:(n,f)=>events[n]=f,setPointerCapture:id=>stick.captured=id,classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}};
 const hud={querySelector:s=>s==='[data-th-stick]'?stick:null};
 function pointer(type,x,y,id=1,pointerType='touch'){events[type]({clientX:150+x*50,clientY:250+y*50,pointerId:id,pointerType,preventDefault(){}});}
 const keyEvents={},window={addEventListener:(n,f)=>keyEvents[n]=f},document={addEventListener(){}},shot={on:false};
 function key(type,code){keyEvents[type]({code,target:{closest:()=>null,matches:()=>false},preventDefault(){},stopImmediatePropagation(){}});}
 `);
 for(const line of app.split('\n').filter(l=>l.startsWith('const TRIAL_TELEGRAPH=')||l.startsWith('const TRIAL_KEYS=')||l.startsWith('const TRIAL_HOLD=')))run(line);
 for(const n of['trialThrottleCommand','trialSetThrottle','trialThrottleKeys','trialStickInput','trialKeyStick','trialRot','trialFrame','trialStep','trialBindHud','bindTrial'])run(fn(n));
 run('trialBindHud(hud);bindTrial()');return{run};
}
test('mouse and touch joystick pushes lower the actual nose; pulling raises it',()=>{
 for(const kind of['mouse','touch'])for(const dy of[-.8,.8]){const{run}=setup();run(`pointer('pointerdown',0,${dy},7,'${kind}')`);near(run('trialStickInput().y'),dy);run('trialStep(.05)');assert.equal(Math.sign(run('trial.w[2]')),Math.sign(dy),'pitch angular command');assert.equal(Math.sign(run('trial.R[1]')),Math.sign(dy),'actual forward nose elevation');near(run('trial.throttle'),.373);assert.equal(run('trial.aim.marker'),'unchanged');assert.equal(run('trial.camF.join()'),'1,0,0');assert.equal(run('trial.keys.size'),0);}
});
test('right joystick roll keeps its original left and right direction',()=>{
 for(const dx of[-.8,.8]){const{run}=setup();run(`pointer('pointerdown',${dx},0);trialStep(.05)`);near(run('trialStickInput().x'),dx);near(run('trialStickInput().y'),0);assert.equal(Math.sign(run('trial.w[0]')),Math.sign(dx));}
});
test('touch input keeps radial bounds, center dead zone and all release paths',()=>{
 for(const end of['pointerup','pointercancel','lostpointercapture']){const{run}=setup();run("pointer('pointerdown',3,-4,7);pointer('pointermove',0,1,8)");near(run('trial.stick.x'),.6);near(run('trial.stick.y'),-.8);near(run('Math.hypot(trial.stick.x,trial.stick.y)'),1);assert.equal(run('stick.captured'),7);assert.equal(run('classes.has("on")'),true);run(`pointer('${end}',0,0,8)`);near(run('trial.stick.y'),-.8);run(`pointer('${end}',0,0,7)`);near(run('trial.stick.x'),0);near(run('trial.stick.y'),0);assert.equal(run('knob.style.transform'),'');assert.equal(run('classes.has("on")'),false);run("trial.w=[0,0,.1];trial.level=true;pointer('pointerdown',.01,.01);trialStep(.01)");assert.equal(run('trial.level'),true,'existing neutral dead zone does not cancel ongoing leveling');run("pointer('pointermove',.1,.1);trialStep(.01)");assert.equal(run('trial.level'),false,'larger deflections still cancel leveling');}
});
test('actual R/F keyboard events retain pitch direction and W/S retain throttle direction',()=>{
 for(const [code,sign] of[['KeyR',1],['KeyF',-1]]){const{run}=setup();run(`key('keydown','${code}');trialStep(.05)`);assert.equal(Math.sign(run('trial.w[2]')),sign);assert.equal(Math.sign(run('trial.R[1]')),sign);run(`key('keyup','${code}')`);near(run('trial.keyStick.y'),0);}
 for(const [code,sign] of[['KeyW',1],['KeyS',-1]]){const{run}=setup();run(`key('keydown','${code}');trialStep(.05)`);assert.equal(Math.sign(run('trial.throttle-.373')),sign);near(run('trialStickInput().y'),0);run(`key('keyup','${code}')`);assert.equal(run('trial.keys.size'),0);}
});
test('joystick top and bottom labels and accessible instructions match push and pull in both languages',()=>{
 const hud=fn('trialHudHTML');assert.match(hud,/<span class="lab up">下げ<\/span><span class="lab down">上げ<\/span>/);assert.match(hud,/aria-description="上へ押すと機首下げ、下へ引くと機首上げ。左右はロール、離すと中立。"/);
 const{run}=setup();for(const f of['js/lang-en.js','js/i18n.js'])run(fs.readFileSync(path.join(root,f),'utf8'));run("window.KSI18n.setLanguage('en')");assert.equal(run("window.KSI18n.t('操縦桿（ピッチとロール）')"),'Joystick (Pitch and Roll)');assert.equal(run("window.KSI18n.t('上へ押すと機首下げ、下へ引くと機首上げ。左右はロール、離すと中立。')"),'Push up to lower the nose; pull down to raise it. Move left or right to roll; release to center.');
});
