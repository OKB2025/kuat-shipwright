// Every hull-baked hatch of the stored examples: openArea (if any) and the area of its cut box (hatchOpenArea without openArea, fully open).
// usage: node openarea-vs-box.cjs <out.tsv>
const zlib=require('zlib'),fs=require('fs'),path=require('path');const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const rows=['key\thatch\tface\topenArea\tcutBox\tratio'];let over=0,n=0,withArea=0;
for(const k of fs.readdirSync('data/examples').sort()){const f=`data/examples/${k}/design.json.gz`;if(!fs.existsSync(f))continue;const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(f))));
 for(const p of s.parts.filter(p=>p.hullData?.hatches?.length)){const local=C.hullStructureShip(s,p);for(const a of p.hullData.hatches){n++;const box=C.hatchOpenArea(local,{...a,openArea:undefined},1);const oa=Number.isFinite(a.openArea)?a.openArea:null;if(oa!=null)withArea++;if(oa!=null&&oa>box*(1+1e-9))over++;rows.push([k,a.id,a.face,oa==null?'-':oa.toFixed(1),box.toFixed(1),oa==null?'-':(oa/box).toFixed(4)].join('\t'));}}}
rows.push(`# hatches ${n}, with openArea ${withArea}, openArea above the cut box ${over}`);fs.writeFileSync(process.argv[2],rows.join('\n')+'\n');console.log(rows.slice(-1)[0]);
