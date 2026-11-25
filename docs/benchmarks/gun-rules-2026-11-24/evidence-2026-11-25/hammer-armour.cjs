// The Sphyrna's armour patches from above and from the side, coloured by thickness, with the line the hammer's plating starts at.
// usage: node hammer-armour.cjs <root> <out.png>
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');
const [root,out]=process.argv.slice(2),cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/hammerhead/design.json.gz')))));C.syncCompartments(s);C.remount(s);
const hull=s.parts.find(p=>p.skinAsset==='sphyrna_hull'),F=C.structureArmorFaces(s,hull),PX=9,W=1180,col=t=>t>=1.9?'#c0392b':t>=.5?'#e67e22':'#9aa7b1';
const tris=q=>{const T=q.triangles||[],o=[];for(let i=0;i+8<T.length;i+=9)o.push([[T[i],T[i+1],T[i+2]],[T[i+3],T[i+4],T[i+5]],[T[i+6],T[i+7],T[i+8]]]);return o;};
let svg='';const view=(title,y0,pick,ax,sign,order,off=0)=>{svg+=`<text x="10" y="${y0-170}" font-size="15" font-weight="bold">${title}</text>`;const Q=F.filter(pick).sort(order);
 for(const q of Q)for(const t of tris(q))svg+=`<polygon points="${t.map(p=>(60+p[0]*PX).toFixed(1)+','+(y0-sign*(p[ax]-off)*PX).toFixed(1)).join(' ')}" fill="${col(q.thickness)}" stroke="${col(q.thickness)}" stroke-width=".4"/>`;
 svg+=`<line x1="${60+88*PX}" y1="${y0-160}" x2="${60+88*PX}" y2="${y0+190}" stroke="#000" stroke-dasharray="6 4"/><text x="${60+88*PX+4}" y="${y0-148}" font-size="12">x = 88 m</text>`;
 for(let x=0;x<=110;x+=10)svg+=`<line x1="${60+x*PX}" y1="${y0+196}" x2="${60+x*PX}" y2="${y0+202}" stroke="#333"/><text x="${60+x*PX-8}" y="${y0+216}" font-size="11">${x}</text>`;};
view('from above (top faces): z across',190,q=>q.face==='top',2,1,(a,b)=>a.center[1]-b.center[1]);
view('from below (bottom faces)',560,q=>q.face==='bottom',2,1,(a,b)=>b.center[1]-a.center[1]);
view('from starboard (stbd faces): y up',1010,q=>q.face==='stbd',1,1,(a,b)=>a.center[2]-b.center[2],24);
svg=svg.replace(/y0/g,'');
const fore=F.filter(q=>q.face==='fore'),head=F.filter(q=>q.center[0]>=88),area=(L,f)=>L.filter(f).reduce((n,q)=>n+q.area,0).toFixed(0);
const legend=`grey 0.2 m, orange 0.6 m, red 2.0 m (forward faces are not in these three views: ${area(fore,q=>q.center[0]>=88)} m² of them forward of x = 88 m at 2.0 m, ${area(fore,q=>q.center[0]<88)} m² aft of it at 0.2 m). Patches forward of the line: ${head.length} of ${F.length}; ${area(head,()=>true)} m² of ${area(F,()=>true)} m².`;
const html=`<html><body style="margin:0;background:#fff"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="1260" font-family="sans-serif">${svg}<text x="10" y="1240" font-size="12">${legend}</text></svg></body></html>`;
(async()=>{const {chromium}=require('playwright'),br=await chromium.launch({args:['--no-sandbox']}),pg=await br.newPage({viewport:{width:W,height:1260},deviceScaleFactor:1});await pg.setContent(html);await pg.screenshot({path:out});await br.close();console.log(legend);})();
