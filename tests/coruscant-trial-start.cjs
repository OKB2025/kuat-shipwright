const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function fn(name){const m=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(m,name);for(let i=app.indexOf('}',m.index);i>=0;i=app.indexOf('}',i+1)){const s=app.slice(m.index,i+1);try{new vm.Script(s);return s;}catch{}}assert.fail(name);}
function setup(){
 const cx=vm.createContext({console}),run=s=>vm.runInContext(s,cx);
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])run(fs.readFileSync(path.join(root,f),'utf8'));
 run(`const C=Core,tv={dot:C.dot,norm:C.norm,add:(a,b,k=1)=>C.add(a,C.mul(b,k)),scale:C.mul,cross:C.cross};
 const trial={sysKey:'coruscant',p:{len:12,wCap:0},turrets:[],launchers:[],mode:'trial'},view=null,TRIAL_GUN={targets:0};
 const spaceCineEnd=()=>{},trialDust=()=>{},escortsInit=()=>{},trialFoilReset=()=>{},trialCraftSystemsReset=()=>{};`);
 run(fn('trialFrame'));
 const a=app.indexOf('const SYSTEMS={};'),b=app.indexOf('function trialDust()',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));run(fn('trialReset'));
 return {run,C:run('Core')};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`),plain=x=>JSON.parse(JSON.stringify(x));
test('actual Coruscant reset begins on the night side at the existing orbital altitude with a level right-handed frame',()=>{
 const {run,C}=setup(),before=run('JSON.stringify(SYSTEMS.coruscant)');run('trialReset()');
 const t=run('trial'),s=run('trialSys()'),up=C.norm(t.P),f=t.R.slice(0,3),u=t.R.slice(3,6),r=t.R.slice(6,9),dip=Math.acos(s.planet.radius/C.len(t.P));
 near(C.len(t.P)-s.planet.radius,s.altitude);near(Math.asin(C.dot(up,s.sun)),-dip-4*Math.PI/180);assert.ok(C.dot(up,s.sun)<-.12,'the city-light shader is on the night side');
 for(const v of [f,u,r])near(C.len(v),1);near(C.dot(f,u),0);near(C.dot(f,r),0);near(C.dot(u,r),0);for(let i=0;i<3;i++){near(u[i],up[i]);near(C.cross(f,u)[i],r[i]);}
 assert.deepEqual(plain(t.V),[0,0,0]);assert.equal(t.throttle,0);assert.equal(run('JSON.stringify(SYSTEMS.coruscant)'),before,'starting a trial must not move the sun or rewrite the planet');
});
test('other systems retain their existing start position and attitude, and returning to Coruscant resets deterministically',()=>{
 const {run}=setup();run('trialReset()');const first=run('JSON.stringify({P:trial.P,R:trial.R})');
 run("trial.sysKey='kuat';trialReset()");const t=run('trial'),s=run('trialSys()');assert.deepEqual(plain(t.P),[0,s.planet.radius+s.altitude,0]);assert.deepEqual(plain(t.R),[1,0,0,0,1,0,0,0,1]);
 run("trial.sysKey='coruscant';trialReset()");assert.equal(run('JSON.stringify({P:trial.P,R:trial.R})'),first);
});
