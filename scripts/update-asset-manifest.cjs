#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function updated(root){
 const file=path.join(root,'index.html'),html=fs.readFileSync(file,'utf8'),pattern=/window\.KS_FILES=(\{[^\n]*\});/,m=html.match(pattern);if(!m)throw Error('Missing source manifest');
 const manifest=JSON.parse(m[1]);manifest.preload='js/asset-cache.js';const names=[manifest.preload,...manifest.data,...['core','gfx','engine','app'].map(k=>manifest[k])];
 manifest.sizes={};manifest.hashes={};for(const name of names){const bytes=fs.readFileSync(path.join(root,name));manifest.sizes[name]=bytes.length;manifest.hashes[name]=crypto.createHash('sha256').update(bytes).digest('hex');}
 const cacheHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'js/asset-cache.js'))).digest('hex').slice(0,12);
 const languageHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'js/lang-en.js'))).digest('hex').slice(0,10);
 return html.replace(pattern,'window.KS_FILES='+JSON.stringify(manifest)+';').replace(/(<script\b[^>]*\bsrc=")js\/asset-cache\.js(?:\?v=[a-f0-9]+)?(?=")/,'$1js/asset-cache.js?v='+cacheHash).replace(/window\.KS_EN_SRC="js\/lang-en\.js\?v=[a-f0-9]+"/,'window.KS_EN_SRC="js/lang-en.js?v='+languageHash+'"');
}
if(require.main===module){const root=path.resolve(__dirname,'..'),file=path.join(root,'index.html'),next=updated(root);if(process.argv.includes('--check')){if(next!==fs.readFileSync(file,'utf8')){console.error('Source manifest is stale');process.exitCode=1;}}else{fs.writeFileSync(file,next);console.log('Updated verified source download manifest');}}
module.exports={updated};
