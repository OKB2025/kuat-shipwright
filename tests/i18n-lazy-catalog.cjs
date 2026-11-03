const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('Japanese start without the English catalog translates once the catalog arrives later',()=>{
 const c=vm.createContext({navigator:{language:'ja-JP'}});vm.runInContext(read('js/i18n.js'),c,{filename:'js/i18n.js'});
 assert.equal(c.KSI18n.language,'ja');assert.equal(c.KS_EN,undefined);
 assert.equal(c.KSI18n.english('読み込む'),'読み込む');
 vm.runInContext(read('js/lang-en.js'),c,{filename:'js/lang-en.js'});
 assert.equal(c.KSI18n.english('読み込む'),'Load');
});
test('index.html loads the English catalog only for an English start',()=>{
 const html=read('index.html');assert.ok(!/<script src="js\/lang-en\.js/.test(html));
 const m=html.match(/<script>\/\* The English catalog[\s\S]*?<\/script>\n/);assert.ok(m);
 const body=m[0].replace(/^<script>/,'').replace(/<\/script>\n$/,'');
 const run=(language,saved)=>{const written=[];vm.runInNewContext(body,{window:{},navigator:{language},localStorage:{getItem:()=>saved??null},document:{write:s=>written.push(s)}});return written.length;};
 assert.equal(run('ja-JP'),0);assert.equal(run('en-US'),1);assert.equal(run('ja-JP','en'),1);assert.equal(run('en-US','ja'),0);
});
