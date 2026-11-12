// UI phase 1 (2026-11-12) item 2c: the small edit window keeps its behaviour (Esc and 閉じる apply the edit,
// 取消 reverts) and gains explicit buttons fixed at its bottom: 適用（Enter） (the existing edit-apply action)
// and 取消（破棄）. Enter applies, but never while the user types in a field. The status says what Esc does.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function extract(name){const m=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(m,name);for(let end=app.indexOf('}',m.index);end>=0;end=app.indexOf('}',end+1)){const s=app.slice(m.index,end+1);try{new vm.Script(s);return s;}catch{}}assert.fail(name);}
function setup(){
 const cx=vm.createContext({});
 vm.runInContext(`let session={},applied=0;const designUI={drawer:true,layout:'edit'};const designUIEditSession=()=>session,designUIEditApply=()=>{applied++;session=null;};
 const nodes={};const $=s=>nodes[s]||null;
 function key(target,extra={}){let prevented=false;const e={key:'Enter',target,preventDefault(){prevented=true;},...extra};const handled=designUIEditKey(e);return {handled,prevented};}
 const field=tag=>({closest:s=>s.split(',').some(x=>x.trim().split(/[\\[:]/)[0]===tag)?{}:null});
 ${extract('designUIEditKey')}${extract('designUIEditFooter')}${extract('designUIEditStatus')}`,cx);
 return code=>vm.runInContext(code,cx);
}

test('Enter applies the open edit from the window, the canvas or the page',()=>{
 const r=setup();assert.deepEqual(JSON.parse(JSON.stringify(r('key(field("div"))'))),{handled:true,prevented:true});assert.equal(r('applied'),1);
 assert.equal(r('key(field("div")).handled'),false,'nothing to apply once the session is closed');assert.equal(r('applied'),1);
});

test('Enter never applies while typing in a numeric field or other control',()=>{
 for(const tag of ['input','textarea','select','button','summary']){const r=setup();assert.equal(r(`key(field(${JSON.stringify(tag)})).handled`),false,tag);assert.equal(r('applied'),0,tag);}
 const r=setup();assert.equal(r('key(field("div"),{isComposing:true}).handled'),false,'IME composition');assert.equal(r('key(field("div"),{shiftKey:true}).handled'),false);assert.equal(r('key(field("div"),{key:"a"}).handled'),false);assert.equal(r('applied'),0);
 assert.equal(r('designUI.layout="new";key(field("div")).handled'),false,'only the edit window');
});

test('the footer holds 取消（破棄） and 適用（Enter） on the existing actions, and the status explains Esc',()=>{
 const r=setup();r("nodes['#designEditFooter']={hidden:true,innerHTML:'',firstChild:null};designUIEditFooter(true)");
 const html=r("nodes['#designEditFooter'].innerHTML");assert.equal(r("nodes['#designEditFooter'].hidden"),false);
 assert.match(html,/data-design-action="edit-cancel"[^>]*>取消（破棄）</);assert.match(html,/data-design-action="edit-apply">適用（Enter）</);
 r("designUIEditFooter(false)");assert.equal(r("nodes['#designEditFooter'].hidden"),true);
 r("nodes['[data-design-edit-status]']={textContent:''};var T=x=>x;designUIEditStatus()");assert.match(r("nodes['[data-design-edit-status]'].textContent"),/^Esc・閉じるでも変更を適用します。破棄で編集前に戻します。$/);
 // The actions are the ones already wired in bindDesignUI, and Enter goes through designUIEditKey.
 assert.match(app,/else if\(action==='edit-apply'\)designUIEditApply\(\);/);assert.match(app,/if\(e\.key==='Enter'&&document\.body\.classList\.contains\('designer-ui'\)\)\{designUIEditKey\(e\);return;\}/);
 assert.match(app,/id="designEditFooter" data-design-edit-footer hidden/);
});
