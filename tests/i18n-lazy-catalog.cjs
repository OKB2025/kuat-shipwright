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
test('ion volley labels and current overload effects translate after the English catalogue loads',()=>{
 const c=vm.createContext({navigator:{language:'ja-JP'}});vm.runInContext(read('js/i18n.js'),c,{filename:'js/i18n.js'});
 assert.equal(c.KSI18n.english('イオン斉射 350 TT'),'イオン斉射 350 TT');vm.runInContext(read('js/lang-en.js'),c,{filename:'js/lang-en.js'});
 assert.equal(c.KSI18n.english('イオン斉射 350 TT'),'Ion Volley 350 TT');assert.equal(c.KSI18n.english('イオン斉射 350 TT・60×45×16 m'),'Ion Volley 350 TT · 60×45×16 m');
 const effect='機首方向に固定したイオン砲。漏出したイオンエネルギーが、接続された電力・電子系統に過負荷を与える。';assert.equal(c.KSI18n.english(effect),'A forward-firing ion cannon. Leaked ion energy can overload connected electrical and electronic systems.');
 assert.equal(c.KSI18n.english('雷撃・近距離砲戦'),'Torpedo Strikes and Close-range Gunnery');assert.equal(c.KSI18n.english('イオン砲と航空攻撃を連携'),'Coordinate Ion Fire and Air Strikes');
 for(const [source,target]of Object.entries(c.KS_EN.messages)){assert.doesNotMatch(source,/対シールド|シールドに3倍で効き/);assert.doesNotMatch(target,/Against Shields|Triple effectiveness against shields|triple damage to shields/);}
});
