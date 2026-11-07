const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{updated}=require(path.join(root,'scripts/update-asset-manifest.cjs'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),manifest=html=>JSON.parse(html.match(/window\.KS_FILES=(\{[^\n]*\});/)[1]);
function verifySources(base,html){
 const m=manifest(html),names=[m.preload,...m.data,...['core','gfx','engine','app'].map(k=>m[k])];
 assert.deepEqual(Object.keys(m.sizes).sort(),[...names].sort(),'sizes use the unversioned manifest paths');
 assert.deepEqual(Object.keys(m.hashes).sort(),[...names].sort(),'every startup source has a checksum');
 for(const name of names){const bytes=fs.readFileSync(path.join(base,name));assert.equal(m.hashes[name],sha(bytes),name+' checksum');assert.equal(m.sizes[name],bytes.length,name+' byte count');}
 const cacheURL=html.match(/<script\b[^>]*\bsrc="(js\/asset-cache\.js[^\"]*)"/)[1];
 assert.equal(cacheURL,'js/asset-cache.js?v='+m.hashes[m.preload].slice(0,12),'the actual script URL carries the cache revision');
}
test('published startup source hashes and sizes match the exact committed files',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');verifySources(root,html);assert.equal(updated(root),html,'the published manifest is current');
});
test('updating source revisions changes the script URL without changing manifest keys and is idempotent',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ks-source-manifest-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const files={'js/asset-cache.js':'const cache=1;','js/lang-en.js':'const language=1;','data/a.js':'const data=1;','js/core.js':'const core=1;','js/gfx.js':'const gfx=1;','js/engine.js':'const engine=1;','js/app.js':'const app=1;'};
 for(const [file,text]of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.writeFileSync(path.join(temp,file),text);}
 const m={preload:'js/asset-cache.js',data:['data/a.js'],core:'js/core.js',gfx:'js/gfx.js',engine:'js/engine.js',app:'js/app.js',sizes:{},hashes:{}};
 const file=path.join(temp,'index.html');fs.writeFileSync(file,'<script>window.KS_FILES='+JSON.stringify(m)+';</script>\n<script src="js/asset-cache.js?v=000000000000"></script>\n<script>window.KS_EN_SRC="js/lang-en.js?v=0000000000";</script>');
 const first=updated(temp);verifySources(temp,first);fs.writeFileSync(file,first);assert.equal(updated(temp),first);
 fs.appendFileSync(path.join(temp,'js/app.js'),'\n// Changed app bytes');fs.appendFileSync(path.join(temp,'js/asset-cache.js'),'\n// Changed cache bytes');
 const next=updated(temp);verifySources(temp,next);assert.notEqual(manifest(first).hashes['js/app.js'],manifest(next).hashes['js/app.js']);assert.notEqual(manifest(first).hashes['js/asset-cache.js'],manifest(next).hashes['js/asset-cache.js']);fs.writeFileSync(file,next);assert.equal(updated(temp),next);
});
