// UI phase 1 (2026-11-12) item 5a: clamped help notes (.note.clamp) get a 「？」 marker and, on a pointer that can
// hover, a tooltip with the full text — only when the text is actually cut off. Overflow is measured for all
// notes in one animation frame, and no title is put on notes that are not truncated.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function extract(name){const m=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(m,name);for(let end=app.indexOf('}',m.index);end>=0;end=app.indexOf('}',end+1)){const s=app.slice(m.index,end+1);try{new vm.Script(s);return s;}catch{}}assert.fail(name);}
function setup(){
 const cx=vm.createContext({});
 vm.runInContext(`const frames=[],log=[];let noteClampFrame=0;
 const requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
 function note(text,scroll,client,full=false){const cls=new Set(['note','clamp',...(full?['full']:[])]),attrs={};return {text,dataset:{},
  get scrollHeight(){log.push('read');return scroll;},get clientHeight(){log.push('read');return client;},
  classList:{contains:c=>cls.has(c),toggle:(c,on)=>{log.push('write');on?cls.add(c):cls.delete(c);}},
  getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>{log.push('write');attrs[k]=v;},removeAttribute:k=>{log.push('write');delete attrs[k];},attrs,cls};}
 const notes=[note('短い説明',20,20),note('長い説明 とても長い説明',60,30),note('開いた説明',60,60,true),note('隠れた説明',0,0)];
 const document={querySelectorAll:s=>s==='.note.clamp'?notes:[]},sourceText=n=>n.text;
 ${extract('scheduleNoteClampMarkers')}${extract('noteClampMeasure')}`,cx);
 return code=>vm.runInContext(code,cx);
}

test('several requests share one animation frame',()=>{
 const r=setup();r('scheduleNoteClampMarkers();scheduleNoteClampMarkers();scheduleNoteClampMarkers()');assert.equal(r('frames.length'),1);
 r('frames[0]()');r('scheduleNoteClampMarkers()');assert.equal(r('frames.length'),2,'a new frame after the first ran');
});

test('only a truncated note gets the marker class and the full-text title; the rest get no title',()=>{
 const r=setup();r('scheduleNoteClampMarkers();frames[0]()');
 assert.deepEqual(JSON.parse(r('JSON.stringify(notes.map(n=>[n.cls.has("clamp-cut"),n.attrs.title??null]))')),[[false,null],[true,'長い説明 とても長い説明'],[false,null],[false,null]]);
 const log=JSON.parse(r('JSON.stringify(log)'));assert.ok(log.lastIndexOf('read')<log.indexOf('write'),'all layout reads come before any write');
});

test('a note that stops being truncated loses its marker and title',()=>{
 const r=setup();r('noteClampMeasure(notes);notes[1].cls.add("full");noteClampMeasure(notes)');
 assert.equal(r('notes[1].cls.has("clamp-cut")'),false);assert.equal(r('notes[1].attrs.title'),undefined);
});

test('the panel schedules the measurement after it is built, when a note opens, a section opens or the window resizes',()=>{
 assert.match(app.slice(app.indexOf('function organizePanel('),app.indexOf('let noteClampFrame=0;')),/scheduleNoteClampMarkers\(\);\n\}\n\/\/ 5a/);assert.match(extract('compactSpec'),/scheduleNoteClampMarkers\(\);/);
 assert.match(app,/note\.classList\.toggle\('full'\);scheduleNoteClampMarkers\(\);/);assert.match(app,/panel\.addEventListener\('toggle',\(\)=>scheduleNoteClampMarkers\(\),true\);/);
 assert.match(html,/\.panel \.note\.clamp\.clamp-cut::after\{content:"？"/);assert.match(html,/@media \(hover:hover\)\{\.panel \.note\.clamp\.clamp-cut\{cursor:help\}/);
 assert.doesNotMatch(app,/n\.classList\.add\('clamp'\);?n\.title/,'titles are not added to every note');
});
