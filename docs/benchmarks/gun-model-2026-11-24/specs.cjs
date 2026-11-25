// New turbolaser specs from the agreed rules (study, not game code). usage: node specs.cjs <repo>
const path=require('path'),root=process.argv[2];const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root),A=C.REFERENCE_ASSETS;
const Lref=19.01,kV=0.06313782219884272,A0=29*1.10,R0=0.861,tail=0.171,KC=+(process.env.KC||1);let x0=0.0113,Ak=5.951;
const MC={monCal200Triple:1.45,monCal200:1.75,monCal150Ion:1.5,monCal80:1.55,monCal34:1.0};
const fmt=x=>{if(x>=1e3)return (x/1e3).toPrecision(3)+' PT';if(x>=1)return +x.toPrecision(3)+' TT';if(x>=1e-3)return +(x*1e3).toPrecision(3)+' GT';return +(x*1e6).toPrecision(3)+' MT';};
const dl=Ekt=>Math.sqrt(0.01+(Ekt-20)*0.15/780);
{const ex=(E,b,L)=>L-(1+KC*Math.log((dl(E*1e9)/b)**2)),SP=process.env.SPLIT?+process.env.SPLIT:1,e1=ex(40,.74,19.01)*SP,e2=ex(175,1.09,26.3)*SP,t=(40-R0)/(30-R0);let lo=1e-9,hi=1e6;for(let i=0;i<300;i++){const x=Math.sqrt(lo*hi),r=Math.log(1+e2/x)/Math.log(1+e1/x);if(r>t)hi=x;else lo=x;}x0=Math.sqrt(lo*hi);Ak=(30-R0)/Math.log(1+e1/x0);console.log('KC',KC,'ISD extra',e1.toFixed(2),'175 extra',e2.toFixed(2),'x0',x0.toPrecision(3),'A',Ak.toFixed(2));}
const V0=(()=>{const E=1e9,b=1.10,L=29.0,m=1+KC*Math.log((dl(E)/b)**2);return (L-m)*(1-(+process.env.SPLIT||0))*Math.PI/4*b*b;})();
const rows=[];
for(const [k,d] of Object.entries(C.FITS)){const e=(d.tt||0)+(d.ion||0);if(!(e>0)||!d.asset)continue;const laser=/^claser|^cturret|^pd$|^monCalPD$/.test(k)||(/レーザー/.test(d.name)&&!/ターボ/.test(d.name));if(laser)continue;
 const a=A[d.asset],bs=a?.barrelCenters||[];if(!bs.length)continue;const n=d.barrels||1,bolt=d.boltTT??e/n,b=bs[0],ion=(d.ion||0)>0,ball=C.isBallTurret(k);
 const full=Math.max(...bs.map(b=>b.fullLengthM??Math.hypot(...b.muzzle.map((v,i)=>v-b.root[i])))),ex=Math.max(...bs.map(b=>b.photoVisibleReachM??(b.muzzle[0]-(b.exposedStartX??b.root[0]))));
 let L,how;const front=b.exposedStartX??b.root[0],body=front-(a.bounds?.[0]?.[0]??front);
 if(k==='oct40'){L=19.01;how='根元〜砲口';}
 else if(MC[k]){L=MC[k]*d.wm+.75*body;how='図面 ×'+MC[k];}
 else if(ion){L=ball?(b.muzzle[0]-front)+.75*body:full;how='イオン（モデル）';}
 else if(ball){L=(b.muzzle[0]-front)+.75*body;how='球 3/4';}
 else if(Math.abs(ex-full)<.01){L=d.fm*2/3;how='固定 2/3';}else{L=full;how='全長';}
 let bore=b.boreRadiusM>0?2*b.boreRadiusM:b.outerRadiusM>0?2*b.outerRadiusM*.6:0.74;bore=Math.max(bore,0.45);
 const Ekt=bolt*1e9,minCoil=1+KC*Math.log((dl(Ekt)/bore)**2),extra=L-minCoil,c=L/Lref,V=process.env.SUBJ?d.fm*d.wm*d.hm:C.weaponChargeSpec({k,p:[0,0,0]}).targetVolume,charge=bolt*(1+c)/((process.env.SUBJ?3.1027e-4:kV)*V),coilL=process.env.SPLIT?minCoil+Math.max(0,extra)*(+process.env.SPLIT):L,coolV=Math.max(0,L-coilL)*Math.PI/4*bore*bore,Vt=d.fm*d.wm*d.hm,cool=process.env.TURRET?Math.sqrt(bolt)*8982/Vt*(ball?.5:1):process.env.SPLIT?(coolV>0?Math.sqrt(bolt)*V0/coolV*(ball?.5:1):Infinity):Math.sqrt(bolt)*A0/(L*bore)*(ball?.5:1),gap=process.env.COOL_EQ?charge:ion?charge:Math.max(charge,cool/n);
 const hold=extra<0?null:R0+Ak*Math.log(1+(coilL-minCoil)/x0),rng=hold==null?null:hold+tail*Math.log(Ekt/1e3);
 rows.push({coilL,coolV:process.env.TURRET?Vt:coolV,name:d.short||d.name,n,bolt,L,how,bore,minCoil,extra,hold,rng,charge,cool,gap,ps:bolt/gap,old:e/d.cycle});}
rows.sort((a,b)=>b.bolt-a.bolt||b.ps-a.ps);const s=x=>x==null?'—':x>=100?x.toFixed(0):x>=10?x.toFixed(1):x.toFixed(2);
console.log('砲|門|1発|コイル|冷却部m3|砲身|口径|最低コイル|超過|100%距離|射程|1発充電|冷却|間隔|火力/秒|今の火力/秒');
for(const r of rows)console.log([r.name,r.n,fmt(r.bolt),s(r.coilL),s(r.coolV),s(r.L)+'（'+r.how+'）',r.bore.toFixed(2),s(r.minCoil),s(r.extra),s(r.hold),s(r.rng),s(r.charge),s(r.cool),s(r.gap),fmt(r.ps),fmt(r.old)].join('|'));
