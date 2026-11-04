const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console,navigator:{language:'en-US'}}),jp=/[\u3040-\u30ff\u3400-\u9fff]/;
for(const file of ['js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
function translated(source){const out=cx.KSI18n.t(source);assert.doesNotMatch(out,jp,source+' => '+out);return out;}
function translatedHTML(html){for(const text of html.split(/<[^>]*>/))if(text.trim())translated(text);for(const m of html.matchAll(/(?:aria-label|title|placeholder)="([^"]*)"/g))translated(m[1]);}
function helper(name){const start=app.indexOf('function '+name+'(');assert.ok(start>=0,name+' exists');const end=app.indexOf('\nfunction ',start+1);assert.ok(end>start,name+' has a function boundary');return app.slice(start,end);}
vm.runInContext(`const st={structPlacement:'sponson',sponsonSize:[24,20,5]},esc=String,num=(v,d=0)=>Number(v).toFixed(d),fmtM=v=>v+' m';
const seg=(id,items,current)=>items.map(([key,label])=>'<button data-'+id+'="'+key+'">'+label+'</button>').join('');
const slider=(id,label,value)=>'<label>'+label+'<input data-sl="'+id+'" value="'+value+'"></label>';
`,cx);
for(const name of ['sponsonPlacementControls','sponsonControls'])vm.runInContext(helper(name),cx);

test('sponson placement controls and their weapon shortcut translate through the display catalog',()=>{
 const mode=vm.runInContext('sponsonPlacementControls()',cx),controls=vm.runInContext('sponsonControls()',cx);
 assert.match(mode,/通常の構造物/);assert.match(mode,/張出し砲座/);translatedHTML(mode);
 assert.match(controls,/壁に沿う長さ/);assert.match(controls,/張出しの奥行き/);assert.match(controls,/砲座の厚さ/);assert.match(controls,/点防御を配置する/);translatedHTML(controls);
 for(const key of ['張出し砲座を作る','艦側・構造物の壁に砲座を張り出し、その上へ武装を設置できます。','船体・構造物の側面をタップしてください','壁をタップして水平な張出し砲座を作る']){assert.ok(app.includes(key),'UI uses '+key);translated(key);}
 assert.match(translated('張出し砲座'),/Sponson/);assert.equal(translated('点防御を配置する'),'Place Point Defense');
});
