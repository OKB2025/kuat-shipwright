const fs=require('fs'),path=require('path');const [dir,root]=process.argv.slice(2);const {figuresDiff}=require(path.join(root,'tests/helpers/figures-digest.cjs'));
for(const f of fs.readdirSync(path.join(dir,'base')).filter(f=>f.endsWith('.json')).sort()){const k=f.replace('.json','');const b=path.join(dir,'base',f),c=path.join(dir,'cand',f);
 if(!fs.existsSync(c)){console.log(k+'\tmissing candidate');continue;}const d=figuresDiff(JSON.parse(fs.readFileSync(b)),JSON.parse(fs.readFileSync(c)));console.log(k+'\t'+(d.length?'DIFF '+d.length+'\t'+d.slice(0,5).join(' | '):'same'));}
