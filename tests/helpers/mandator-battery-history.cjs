// Authenticate the PR61 battery-layout publication as history. Later engine
// changes must not retag its real runtime, catalogue, figures or audit.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const DIRECTORY='assets/source/mandator-battery-history',REPORT='docs/benchmarks/mandator-battery-layout-refit.json',COMMIT='bb1ba9b0445fb1578747f84773aff212ca141899';
const EXPECTED=Object.freeze({manifest:'2d8db9f674b1b4703b1f0c0dce76f8fd5ec03523b470ae066ea79fcdb3e1c0d3',report:'119be98e3398c35df5129504b269c0e51759247abb223fe196bf9406ceca5fd2',core:'c303ba286c9b7b286585e405dc59bb43065f10e82fe84e24bd784090d4788523',fleet:'b36f7364955f4d5b16257e6d414966a4fa715beb8378223b32a61dff77243a82',figures:'0048c4f7f7f2180e861cc902a41cde2612ac01535597a3f66512c48bfe58c8c6'});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function readMandatorBatteryHistory(root){
 const directory=path.join(root,DIRECTORY),manifestBytes=fs.readFileSync(path.join(directory,'manifest.json'));
 assert.equal(sha(manifestBytes),EXPECTED.manifest,'the battery-layout history manifest cannot be relabelled');
 const manifest=JSON.parse(manifestBytes);assert.equal(manifest.commit,COMMIT);
 const bytes={};for(const [source,row]of Object.entries(manifest.files)){
  const packed=fs.readFileSync(path.join(directory,row.file));assert.equal(sha(packed),row.gzipSha256,source+' authentic compressed snapshot');
  const raw=zlib.gunzipSync(packed);assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256,source+' authentic snapshot bytes');bytes[source]=raw;
 }
 assert.equal(sha(bytes['js/core.js']),EXPECTED.core);assert.equal(sha(bytes['data/fleet.js']),EXPECTED.fleet);assert.equal(sha(bytes['tests/helpers/example-figures.json']),EXPECTED.figures);
 const reportBytes=fs.readFileSync(path.join(root,REPORT));assert.equal(sha(reportBytes),EXPECTED.report,'the original battery-layout audit is retained');assert.equal(manifest.report.path,REPORT);assert.equal(manifest.report.sha256,EXPECTED.report);
 const report=JSON.parse(reportBytes);assert.equal(report.sourceSha256['js/core.js'],EXPECTED.core);
 for(const [source,digest]of Object.entries(report.sourceSha256))if(source!=='js/core.js')assert.equal(sha(fs.readFileSync(path.join(root,source))),digest,source+' retained physical source for the historical runtime');
 return {manifest,bytes,report,historical:true,currentRuntimeClaimed:false};
}
const cache=new Map();
function loadMandatorBatteryHistory(root){
 root=path.resolve(root);if(cache.has(root))return cache.get(root);
 const saved=readMandatorBatteryHistory(root),context=vm.createContext({console,performance});
 for(const file of ['data/reference.js','data/imperial2.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 for(const file of ['data/fleet.js','js/core.js'])vm.runInContext(saved.bytes[file].toString(),context,{filename:'historical:'+file});
 const runtime=vm.runInContext('({C:Core,data:YardFleetData})',context),result={...saved,...runtime,figures:JSON.parse(saved.bytes['tests/helpers/example-figures.json'])};cache.set(root,result);return result;
}
module.exports={readMandatorBatteryHistory,loadMandatorBatteryHistory,constants:Object.freeze({DIRECTORY,REPORT,COMMIT,EXPECTED})};
