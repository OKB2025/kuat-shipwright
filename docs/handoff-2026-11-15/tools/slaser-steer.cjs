const fs=require('fs'),vm=require('vm'),path=require('path'),root=path.resolve(process.argv[2]);const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const mk=(id,team,pos)=>({id,team,pos,p:{len:1600,width:800,height:400},yaw:0});
const u={id:'ds',team:0,pos:[0,0,0],yaw:0,p:{len:160000,width:160000,height:160000,sw:[{k:'slaser',aim:'bow',mz:[80000,0,0]}]}},w=u.p.sw[0];
for(const deg of [0,10,20,25,40]){const t=mk('t',1,[400000*Math.cos(deg*Math.PI/180),0,400000*Math.sin(deg*Math.PI/180)]);const tr=C.swBeamTrace(u,w,[t]);console.log('target at',deg,'deg: hit',tr.hit?.id||null,'beam bearing',(Math.atan2(tr.axis[2],tr.axis[0])*180/Math.PI).toFixed(1));}
const fr=mk('f',0,[300000,0,30000]),foe=mk('e',1,[400000,0,-60000]);const tr=C.swBeamTrace(u,w,[fr,foe]);console.log('friend nearer than the enemy: hit',tr.hit?.id,'bearing',(Math.atan2(tr.axis[2],tr.axis[0])*180/Math.PI).toFixed(1));
