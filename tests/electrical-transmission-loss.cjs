const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),near=(a,b,e=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`),source=(id,powerW)=>({id,domain:'main',powerW}),load=(id,port,requestedInputW,kind='engines')=>({id,port,domain:'main',requestedInputW,kind}),link=(from,to,cap,efficiency,extra={})=>({from,to,cap,efficiency,ok:true,...extra});
function conserved(result){near(result.draw,result.delivered+result.feedLossW);near(result.draw,result.sources.reduce((n,s)=>n+s.drawW,0));near(result.feedLossW,result.edgeLosses.reduce((n,l)=>n+l.heatW,0));near(result.delivered,Object.values(result.granted).reduce((a,b)=>a+b,0));for(const s of result.sources)assert.ok(s.drawW>=0&&s.drawW<=s.availableW*(1+1e-10));for(const l of result.edgeLosses){near(l.inputW,l.outputW+l.heatW);near(l.heatW,Object.values(l.byKind).reduce((a,b)=>a+b,0));near(l.heatW,Object.values(l.byConsumer).reduce((a,b)=>a+b,0));}}

test('a lossless circuit retains existing delivered watts without creating line heat',()=>{
 const result=C.allocateConnectedPower({sources:[source('reactor',100)],links:[link('reactor','engine',100)],loads:[load('drive','engine',100)]});near(result.draw,100);near(result.delivered,100);near(result.feedLossW,0);assert.equal(result.edgeLosses.length,0);near(result.sourceFunding.drive.reactor,100);near(result.funding.drive.reactor,100);conserved(result);
});

test('one electrical feed debits sent watts and separates received watts from its own heat',()=>{
 const result=C.allocateConnectedPower({sources:[source('reactor',100)],links:[link('reactor','engine',100,.8,{routeId:'wire'})],loads:[load('drive','engine',100)]});near(result.draw,100);near(result.engines,80);near(result.feedLossW,20);near(result.sourceFunding.drive.reactor,100);near(result.funding.drive.reactor,80);assert.equal(result.edgeLosses.length,1);const line=result.edgeLosses[0];assert.equal(line.routeId,'wire');near(line.inputW,100);near(line.outputW,80);near(line.heatW,20);near(line.byKind.engines,20);near(line.byConsumer.drive,20);conserved(result);
});

test('two electrical stages conserve power separately and cumulatively',()=>{
 const result=C.allocateConnectedPower({sources:[source('reactor',100)],links:[link('reactor','bus',100,.9,{routeId:'first'}),link('bus','engine',100,.8,{routeId:'second'})],loads:[load('drive','engine',100)]});near(result.draw,100);near(result.engines,72);near(result.feedLossW,28);const first=result.edgeLosses.find(l=>l.routeId==='first'),second=result.edgeLosses.find(l=>l.routeId==='second');near(first.inputW,100);near(first.outputW,90);near(first.heatW,10);near(second.inputW,90);near(second.outputW,72);near(second.heatW,18);near(result.sourceFunding.drive.reactor,100);near(result.funding.drive.reactor,72);conserved(result);
});

test('each conductor capacity limits its input before that conductor loses energy',()=>{
 const result=C.allocateConnectedPower({sources:[source('reactor',100)],links:[link('reactor','bus',100,.9),link('bus','engine',30,.8)],loads:[load('drive','engine',100)]});near(result.draw,100/3);near(result.engines,24);near(result.feedLossW,100/3-24);const final=result.edgeLosses.find(l=>l.to==='engine');near(final.inputW,30);near(final.outputW,24);near(final.heatW,6);conserved(result);
});

test('parallel branches spend a lossy shared source trunk once and keep per-consumer heat attribution',()=>{
 const links=[link('reactor','bus',100,.8,{routeId:'common'}),link('bus','left',100,.9,{routeId:'left'}),link('bus','right',100,.5,{routeId:'right'})],loads=[load('left','left',90),load('right','right',50)];
 for(const order of [loads,loads.slice().reverse()]){const result=C.allocateConnectedPower({sources:[source('reactor',100)],links,loads:order});near(result.draw,100);near(result.granted.left,36);near(result.granted.right,20);near(result.delivered,56);near(result.feedLossW,44);near(result.sourceFunding.left.reactor,50);near(result.sourceFunding.right.reactor,50);const common=result.edgeLosses.find(l=>l.routeId==='common');near(common.heatW,20);near(common.byConsumer.left,10);near(common.byConsumer.right,10);conserved(result);}
});

test('an authored shared capacity is charged in upstream watts once even when represented by several edges',()=>{
 const group={capacityGroup:'same-circuit',groupCap:100},serial=C.allocateConnectedPower({sources:[source('reactor',1000)],links:[link('reactor','bus',1000,.9,group),link('bus','engine',1000,.8,group)],loads:[load('drive','engine',1000)]});near(serial.draw,100);near(serial.engines,72);near(serial.feedLossW,28);conserved(serial);
 const parallel=C.allocateConnectedPower({sources:[source('reactor',1000)],links:[link('reactor','engine',1000,.8,group),link('reactor','other',1000,1,group)],loads:[load('drive','engine',80),load('other','other',100)]});near(parallel.draw,100);near(parallel.granted.drive,40);near(parallel.granted.other,50);near(parallel.feedLossW,10);conserved(parallel);
});

test('fixed loads and allocation priorities consume the same finite sent-watt budget as propulsion',()=>{
 const links=[link('reactor','bus',100,.8),link('bus','engine',100),link('bus','weapon',100),link('bus','hotel',100)];
 for(const mode of ['balanced','weapons']){const result=C.allocateConnectedPower({sources:[source('reactor',100)],links,loads:[load('engine','engine',100),load('weapon','weapon',100,'weapons'),load('hotel','hotel',10,'fixed')],mode});near(result.draw,100);near(result.granted.hotel,10);near(result.granted[mode==='weapons'?'weapon':'engine'],70);near(result.granted[mode==='weapons'?'engine':'weapon'],0);near(result.feedLossW,20);const trunk=result.edgeLosses.find(l=>l.from==='reactor');near(trunk.byKind.fixed,2.5);near(trunk.byKind[mode==='weapons'?'weapons':'engines'],17.5);conserved(result);}
});

test('different source paths retain their own delivered and sent contributions',()=>{
 const result=C.allocateConnectedPower({sources:[source('weak',40),source('healthy',60)],links:[link('weak','engine',100,.5,{routeId:'lossy'}),link('healthy','engine',100,1)],loads:[load('drive','engine',100)]});near(result.draw,100);near(result.engines,80);near(result.feedLossW,20);near(result.sourceFunding.drive.weak,40);near(result.sourceFunding.drive.healthy,60);near(result.funding.drive.weak,20);near(result.funding.drive.healthy,60);conserved(result);
});

test('invalid efficiencies, severed links and nonfinite cumulative gains cannot supply power',()=>{
 for(const efficiency of [0,-.1,1.1,NaN,Infinity,'0.9']){const result=C.allocateConnectedPower({sources:[source('reactor',100)],links:[link('reactor','engine',100,efficiency)],loads:[load('drive','engine',100)]});near(result.draw,0);near(result.engines,0);near(result.feedLossW,0);conserved(result);}
 for(const links of [[link('reactor','engine',100,.9,{ok:false})],[link('reactor','bus',100,1e-320),link('bus','engine',100,.9)]]){const result=C.allocateConnectedPower({sources:[source('reactor',100)],links,loads:[load('drive','engine',100)]});near(result.draw,0);near(result.engines,0);near(result.feedLossW,0);conserved(result);}
});

test('a lossy cycle cannot circulate energy or create power without a source',()=>{
 const links=[link('reactor','a',100,.9),link('a','b',100,.8),link('b','a',100,.5),link('a','engine',100)];const live=C.allocateConnectedPower({sources:[source('reactor',100)],links,loads:[load('drive','engine',100)]});near(live.draw,100);near(live.engines,90);near(live.feedLossW,10);assert.equal(live.edgeLosses.some(l=>l.from==='b'),false);conserved(live);const dead=C.allocateConnectedPower({sources:[],links,loads:[load('drive','engine',100)]});near(dead.draw,0);near(dead.engines,0);near(dead.feedLossW,0);conserved(dead);
});

test('shared outlets use actual received power once and keep line heat separate from machinery heat',()=>{
 const input=1e18,wattsPerNewton=2e9,engines=[4,5].map(id=>({id,machineryId:3,powerNode:'p'+id,heatNode:'p3',domain:'main',valid:true,available:true,connected:true,outletAvailable:true,pathCapacityW:input,ratedInputW:input,ratedThrustN:input/wattsPerNewton,wattsPerNewton,direction:[1,0,0]})),profile={version:1,engines,massKg:1e6,ratedThrustN:input/wattsPerNewton,ratedAccelMps2:input/wattsPerNewton/1e6,accelerationLimitMps2:1e9},links=[link('p1','p3',input,.9,{routeId:'electrical'}),link('p3','p4',input),link('p3','p5',input)],context={sources:[source('p1',input)],links,throttle:1,mode:'balanced'};
 const result=C.solveShipPropulsion(profile,context);near(result.power.draw,input);near(result.actualInputW,.9*input);near(result.actualThrustN,.9*input/wattsPerNewton);near(result.wasteHeatW,.045*input);near(result.power.feedLossW,.1*input);near(result.ratedInputW,input);near(result.engines.reduce((n,e)=>n+e.actualInputW,0),.9*input);conserved(result.power);
 const stopped=C.solveShipPropulsion(profile,{...context,throttle:0});near(stopped.power.draw,0);near(stopped.actualInputW,0);near(stopped.wasteHeatW,0);near(stopped.power.feedLossW,0);conserved(stopped.power);
});
