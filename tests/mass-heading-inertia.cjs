const assert=require('node:assert/strict'),{test}=require('node:test'),{C,R,unit:baseUnit,plain}=require('./helpers/global-energy-runtime.cjs');
const near=(a,b,k=1e-10,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*k,`${label}: ${a} != ${b}`),length=v=>Math.hypot(...v),add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(v,k)=>v.map(x=>x*k),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),angle=(v,f)=>Math.atan2(length([v[1]*f[2]-v[2]*f[1],v[2]*f[0]-v[0]*f[2],v[0]*f[1]-v[1]*f[0]]),dot(v,f));
function unit(mass=C.INERTIA_MOVEMENT.referenceMassKg){const u=baseUnit();u.p.propulsion={...u.p.propulsion,massKg:mass};u.yaw=0;C.heatOf(u);return u;}
function vectorNear(a,b,k=1e-10){for(let i=0;i<3;i++)near(a[i],b[i],k,'axis'+i);}
function independentUnforced(u,v,forward,t){const speed=length(v)*Math.exp(-C.massDragRate(u)*t),theta0=angle(v,forward),theta=theta0*Math.exp(-C.inertiaAlignmentRate(u)*t),along=dot(v,forward),side=v.map((x,i)=>x-forward[i]*along),sl=length(side);return forward.map((x,i)=>speed*(x*Math.cos(theta)+side[i]/sl*Math.sin(theta)));}
function simpsonPath(u,v,forward,dt){const N=4000,h=dt/N,p=[0,0,0];for(let i=0;i<=N;i++){const q=independentUnforced(u,v,forward,i*h),w=i===0||i===N?1:i%2?4:2;for(let j=0;j<3;j++)p[j]+=q[j]*w*h/3;}return p;}

test('a smooth bounded whole-mass response reproduces the two handling half-lives',()=>{
 const m=C.INERTIA_MOVEMENT;near(C.inertiaAlignmentRate(m.referenceMassKg),Math.LN2/.3);near(C.inertiaAlignmentRate(m.referenceLargeMassKg),Math.LN2/90);const masses=[1,100,m.referenceMassKg,1e6,m.referenceLargeMassKg,1e15],rates=masses.map(C.inertiaAlignmentRate);for(let i=0;i<rates.length;i++){assert.ok(rates[i]>0&&rates[i]<m.maximumRatePerS);if(i)assert.ok(rates[i]<rates[i-1]);}for(const mass of [0,-1,NaN,Infinity])near(C.inertiaAlignmentRate(mass),0);assert.ok(Object.isFrozen(m));
});
test('live small craft turn their existing motion toward the nose while large vessels retain lateral inertia',()=>{
 const small=unit(),large=unit(C.INERTIA_MOVEMENT.referenceLargeMassKg),v=[0,100,0],forward=[1,0,0],a=C.integratePropulsionMotion(small,v,[0,0,0],1,{forward}),b=C.integratePropulsionMotion(large,v,[0,0,0],1,{forward});
 for(const [u,q]of [[small,a],[large,b]]){near(length(q.velocity),100*Math.exp(-C.massDragRate(u)));near(angle(q.velocity,forward),Math.PI/2*Math.exp(-C.inertiaAlignmentRate(u)));}
 assert.ok(angle(a.velocity,forward)<.16);assert.ok(angle(b.velocity,forward)>1.55);assert.ok(a.displacement[1]>0&&a.displacement[0]>0,'the frame follows a curve rather than teleporting onto the nose direction');
});
test('unforced three-dimensional velocity and curved displacement agree with independent integration and frame subdivision',()=>{
 const u=unit(),v=[70,20,-40],forward=[0,1,0],dt=1.2,one=C.integratePropulsionMotion(u,v,[0,0,0],dt,{forward});vectorNear(one.velocity,independentUnforced(u,v,forward,dt));vectorNear(one.displacement,simpsonPath(u,v,forward,dt),2e-9);
 let velocity=v.slice(),position=[0,0,0];for(let i=0;i<120;i++){const q=C.integratePropulsionMotion(u,velocity,[0,0,0],dt/120,{forward});velocity=q.velocity;position=add(position,q.displacement);}vectorNear(one.velocity,velocity,2e-10);vectorNear(one.displacement,position,2e-9);
});
test('zero throttle retains live directional control and does not fabricate engine output, fuel or heat',()=>{
 const u=unit();u.maneuver=0;u.propulsion={actualInputW:0,outputRatio:0};C.shipFuelState(u);const before=plain({heat:u.ht,fuel:u.fuelState,power:u.pw}),q=C.integratePropulsionMotion(u,[0,0,100],[0,0,0],.3,{forward:[1,0,0]});near(angle(q.velocity,[1,0,0]),Math.PI/4);near(C.engineLevel(u),0);near(u.propulsion.actualInputW,0);assert.deepEqual(plain({heat:u.ht,fuel:u.fuelState,power:u.pw}),before);
});
test('lost control, electrical output or fuel never steers a disabled drifting body',()=>{
 for(const stop of ['out','dead','power-loss','reactor','engine','grid','zero-P','heat','fuel']){const u=unit();if(stop==='out')u.out='disabled';if(stop==='dead')u.dead=true;if(stop==='power-loss')u.powerLossDisabled=true;if(stop==='reactor')u.mods[0]=0;if(stop==='engine')u.mods[1]=0;if(stop==='grid')u.gridState={domains:{main:{trip:10}},local:{}};if(stop==='zero-P')u.p.grid.P=0;if(stop==='heat')u.ht.online=false;if(stop==='fuel'){const f=C.shipFuelState(u);f.fuelEnergyJ=f.capacityJ;}const v=[0,100,30],a=[0,-.6,0],dt=.25,q=C.integratePropulsionMotion(u,v,a,dt,{forward:[1,0,0]}),expected=C.integratePropulsionMotion(u.p,v,a,dt);near(q.alignmentRate,0);vectorNear(q.velocity,expected.velocity);vectorNear(q.displacement,expected.displacement);}
});
test('opposite headings turn through a stable finite plane and invalid input never snaps the velocity',()=>{
 const u=unit(),v=[-100,0,0],forward=[1,0,0],q=C.integratePropulsionMotion(u,v,[0,0,0],.01,{forward});assert.ok(q.velocity.every(Number.isFinite));assert.ok(q.velocity[0]<0&&length(q.velocity)>0);near(angle(q.velocity,forward),Math.PI*Math.exp(-C.inertiaAlignmentRate(u)*.01));near(length(q.velocity),100*Math.exp(-C.massDragRate(u)*.01));
 for(const bad of [[0,0,0],[NaN,0,0],[0,Infinity,0],null]){const a=C.integratePropulsionMotion(u,v,[0,0,0],1,{forward:bad}),b=C.integratePropulsionMotion(u.p,v,[0,0,0],1);vectorNear(a.velocity,b.velocity);vectorNear(a.displacement,b.displacement);}
 for(const dt of [0,-1,NaN,Infinity]){const q=C.integratePropulsionMotion(u,v,[1,0,0],dt,{forward});vectorNear(q.velocity,v);vectorNear(q.displacement,[0,0,0]);}vectorNear(C.integratePropulsionMotion(u,[0,0,0],[0,0,0],1,{forward}).velocity,[0,0,0]);
});
test('aligned flight preserves the exact existing paid-thrust and drag solution',()=>{
 const u=unit(),v=[100,0,0],a=[10,0,0],dt=3,q=C.integratePropulsionMotion(u,v,a,dt,{forward:[1,0,0]}),k=C.massDragRate(u),gain=-Math.expm1(-k*dt)/k;near(q.velocity[0],100*Math.exp(-k*dt)+10*gain);near(q.displacement[0],100*gain+10*(dt-gain)/k);near(q.velocity[1],0);near(q.velocity[2],0);
 const higher=C.integratePropulsionMotion(u,v,[20,0,0],dt,{forward:[1,0,0]});assert.ok(higher.velocity[0]>q.velocity[0]);near(C.massDragRate(u),k);
});
test('the actual whole vessel mass controls inertia instead of engine input, equipment style or a table label',()=>{
 const u=unit(),rate=C.inertiaAlignmentRate(u);u.info={mass:1e12};u.p.classKey='venator';u.maneuver=0;u.propulsion={actualInputW:0};near(C.inertiaAlignmentRate(u),rate);u.p.propulsion.massKg*=2;assert.ok(C.inertiaAlignmentRate(u)<rate);
});

function independentForced(u,v,forward,a,dt){
 const k=C.massDragRate(u),rate=C.inertiaAlignmentRate(u),N=6000,h=dt/N;let y=[...v,0,0,0];
 const derivative=q=>{const velocity=q.slice(0,3),s=length(velocity),c=s>0?Math.max(-1,Math.min(1,dot(velocity,forward)/s)):1,theta=Math.acos(c),side=forward.map((f,i)=>f-(s>0?velocity[i]/s:0)*c),sl=length(side),steer=sl>1e-12?rate*theta*s/sl:0;return [...velocity.map((x,i)=>a[i]-k*x+side[i]*steer),...velocity];};
 for(let n=0;n<N;n++){const k1=derivative(y),k2=derivative(y.map((x,i)=>x+k1[i]*h/2)),k3=derivative(y.map((x,i)=>x+k2[i]*h/2)),k4=derivative(y.map((x,i)=>x+k3[i]*h));y=y.map((x,i)=>x+h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);}
 return {velocity:y.slice(0,3),displacement:y.slice(3)};
}
test('simultaneous finite thrust and nose following converge to an independent continuous force reference',()=>{
 const u=unit(),v=[0,100,20],a=[5,-2,4],forward=[1,0,0],dt=1.2,reference=independentForced(u,v,forward,a,dt),one=C.integratePropulsionMotion(u,v,a,dt,{forward});vectorNear(one.velocity,reference.velocity,3e-4);vectorNear(one.displacement,reference.displacement,3e-4);
 let velocity=v.slice(),position=[0,0,0];for(let i=0;i<120;i++){const q=C.integratePropulsionMotion(u,velocity,a,dt/120,{forward});velocity=q.velocity;position=add(position,q.displacement);}vectorNear(velocity,reference.velocity,3e-5);vectorNear(position,reference.displacement,3e-5);
 const k=C.massDragRate(u),gain=-Math.expm1(-k*dt)/k;assert.ok(length(one.velocity)<=length(v)*Math.exp(-k*dt)+length(a)*gain+1e-8,'direction control cannot exceed the paid force/drag speed bound');
});
