const R='/home/user/kuat-shipwright';const {C}=require(R+'/scripts/update-ship-examples.cjs').loadRuntime(R);
const plain=x=>JSON.parse(JSON.stringify(x));
const res={};
function build(){
 const s=C.newShip({L:8,W:4,H:3,assembly:true},'fields');s.parts=[];s.fits=[];s.nextId=1;C.placePart(s,'struct',[0,1.5,0],[8,4,3],{form:'box'},false);
 const bay={id:s.nextId++,k:'bombBay',c:[0,1,0],d:1.8,room:[.6,1.8,1.8],corner:0,bayRing:true};s.parts.push(bay);
 const t=C.placeFit(s,'ctorp',[2,3,0],[0,1,0],0,false,{oneRound:true});
 const l=C.placeFit(s,'claser',[-2,3,1],[0,1,0],0,false);
 const y=C.placeFit(s,'cpylon',[-2,0,0],[0,-1,0],0,false,{oneRound:true});
 return {s,bay,t:t.fit,te:t.err,l:l.fit,le:l.err,y:y.fit,ye:y.err};
}
const b=build();console.log('placed',!!b.t,b.te,!!b.l,b.le,!!b.y,b.ye);
b.t.magazine=7;b.l.ionBoxM3=1;
let back=C.deserialize(plain(C.serialize(b.s)));
const g=k=>back.fits.find(f=>f.k===k),bb=()=>back.parts.find(p=>p.k==='bombBay');
res.keep={ctorp_oneRound:g('ctorp').oneRound,ctorp_magazine:g('ctorp').magazine,claser_ionBoxM3:g('claser').ionBoxM3,cpylon_oneRound:g('cpylon').oneRound,bay_bayRing:bb().bayRing};
// out of range / wrong kind
const o=plain(C.serialize(b.s));
const fit=k=>o.fits.find(f=>f.k===k);
fit('ctorp').magazine=99;fit('claser').ionBoxM3=99;fit('claser').oneRound=true;fit('claser').magazine=5;
const st=o.parts.find(p=>p.k==='struct');st.bayRing=true;
back=C.deserialize(o);
res.clamp={ctorp_magazine_99:g('ctorp').magazine,claser_ionBoxM3_99:g('claser').ionBoxM3,claser_oneRound:g('claser').oneRound,claser_magazine:g('claser').magazine,struct_bayRing:back.parts.find(p=>p.k==='struct').bayRing};
// more edge cases
const o2=plain(C.serialize(b.s));o2.fits.find(f=>f.k==='ctorp').magazine=-3;o2.fits.find(f=>f.k==='claser').ionBoxM3=0.001;o2.fits.find(f=>f.k==='cpylon').oneRound='yes';o2.parts.find(p=>p.k==='bombBay').bayRing=1;o2.fits.find(f=>f.k==='cpylon').magazine=3;
back=C.deserialize(o2);res.edge={ctorp_magazine_neg3:g('ctorp').magazine,claser_ionBoxM3_0001:g('claser').ionBoxM3,cpylon_oneRound_str:g('cpylon').oneRound,bay_bayRing_1:bb().bayRing,cpylon_magazine:g('cpylon').magazine};
// fixed point with fields
const s1=JSON.stringify(C.serialize(C.deserialize(plain(C.serialize(b.s))))),s2=JSON.stringify(C.serialize(C.deserialize(JSON.parse(s1))));res.fixedPoint=s1===s2;
// mirrored
{const s=C.newShip({L:8,W:4,H:2,assembly:true},'mir');s.parts=[];s.fits=[];s.nextId=1;C.placePart(s,'struct',[0,1,0],[8,4,2],{form:'box'},false);
 const r=C.placeFit(s,'ctorp',[2,2,1],[0,1,0],0,true,{oneRound:true});const ry=C.placeFit(s,'cpylon',[-2,0,1],[0,-1,0],0,true,{oneRound:true});
 res.mirror={err:[r.err,ry.err],ctorp:s.fits.filter(f=>f.k==='ctorp').map(f=>({id:f.id,z:+f.p[2].toFixed(3),oneRound:f.oneRound,tw:f.tw})),cpylon:s.fits.filter(f=>f.k==='cpylon').map(f=>({id:f.id,z:+f.p[2].toFixed(3),oneRound:f.oneRound,tw:f.tw}))};
 const bk=C.deserialize(plain(C.serialize(s)));res.mirrorSaved=bk.fits.map(f=>f.k+':'+f.oneRound);}
// publicJSON carries the fields
{const pj=JSON.parse(C.publicJSON(b.s));res.publicJSON={ctorp_magazine:pj.fits.find(f=>f.k==='ctorp').magazine,ctorp_oneRound:pj.fits.find(f=>f.k==='ctorp').oneRound,claser_ionBoxM3:pj.fits.find(f=>f.k==='claser').ionBoxM3,cpylon_oneRound:pj.fits.find(f=>f.k==='cpylon').oneRound,bay_bayRing:pj.parts.find(p=>p.k==='bombBay').bayRing};
 // patchShip with a publicJSON state changes the fields on a worker-like ship
 const w=C.deserialize(plain(C.serialize(b.s)));const e=C.deserialize(plain(C.serialize(b.s)));e.fits.find(f=>f.k==='ctorp').magazine=3;e.fits.find(f=>f.k==='claser').ionBoxM3=2;delete e.fits.find(f=>f.k==='cpylon').oneRound;e.parts.find(p=>p.k==='bombBay').bayRing=false;
 C.patchShip(w,JSON.parse(C.publicJSON(e)));res.patched={ctorp_magazine:w.fits.find(f=>f.k==='ctorp').magazine,claser_ionBoxM3:w.fits.find(f=>f.k==='claser').ionBoxM3,cpylon_oneRound:w.fits.find(f=>f.k==='cpylon').oneRound,bay_bayRing:w.parts.find(p=>p.k==='bombBay').bayRing};}
console.log(JSON.stringify(res,null,1));
