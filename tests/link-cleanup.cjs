// 2026-11-23 A removed part or gun takes its designer power and heat lines with it. The user's Imperial I / II remodels
// held a line p65 → f39 to a gun that was in neither design (left behind when the gun was deleted) and it showed as
// 「給電経路のない設備が … 系統あります（断線）」 (user: 「給電、熱経路は確認して実際の問題なのかバグなのかを確認してから直して」).
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const load=k=>C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz')))));

test('removing a gun or a part drops the lines that end on it, and keeps the others',()=>{
 const s=load('cr90'),gun=s.fits.find(f=>C.FITS[f.k].cat==='w'),parts=s.parts.filter(p=>!C.isShapePart(p)).slice(0,2),[a,b]=parts;assert.ok(gun&&a&&b);
 s.links=[{kind:'power',from:'p'+a.id,to:'f'+gun.id,cap:1},{kind:'heat',from:'f'+gun.id,to:'p'+b.id},{kind:'heat',from:'p'+a.id,to:'p'+b.id}];
 C.removeItem(s,'fits',gun.id,false);assert.deepEqual(s.links.map(l=>l.from+'>'+l.to),['p'+a.id+'>p'+b.id]);
 C.removeItem(s,'parts',b.id,false);assert.equal(s.links,undefined,'the last line went with the part');
});

test('the user ISD remodel designs keep no line to a missing gun or part',()=>{
 for(const k of ['i','ii']){const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'docs/handoff-2026-11-20/refs/imperial-'+k+'-1600m-remodel-2026-11-23.json.gz'))));
  const ids=new Set([...raw.parts.map(p=>'p'+p.id),...raw.fits.map(f=>'f'+f.id)]);assert.deepEqual(raw.links.filter(l=>!ids.has(l.from)||!ids.has(l.to)).map(l=>l.from+'>'+l.to),['p65>f39'],'the source design (kept as given)');}
});
