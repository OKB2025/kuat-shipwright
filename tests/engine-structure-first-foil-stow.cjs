// While the S-foils are shown stowed (st.foilView 'stow'), the preview holds posed copies of the wing and its
// members. An early structures packet (onEngineStructureGeometry) must leave that preview alone, as the full
// geometry does (onEngineGeometry): it neither turns the stowed view off nor drops the posed copies while the
// originals stay hidden (independent check 2026-11-12). The editor's own functions are taken from js/app.js.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function fn(text,name){const m=new RegExp('function '+name+'\\s*\\(').exec(text);for(let b=text.indexOf('}',m.index);b>=0;b=text.indexOf('}',b+1)){const code=text.slice(m.index,b+1);try{new vm.Script(code);return code;}catch{}}throw new Error(name);}
for(const membersNonShape of [false,true])test(membersNonShape?'a stowed wing with a non-structure member keeps its posed copies':'a stowed wing of structures only stays stowed',()=>{
const cx=vm.createContext({});
vm.runInContext(`let dragSnap=null,bounds=null;const st={foilView:'stow',coded:false};const eng={gen:5,geoGen:4,sentGen:5};
 const wing={id:10,k:'wing',c:[0,0,0]},spar={id:11,k:'struct',c:[0,0,0]},gun={id:12,k:'gun',c:[0,0,0]};
 const ship={saveId:'d',parts:[wing,spar,gun],fits:[]};const meshStore={geos:{},ranges:{}};
 const live={parts:[],fits:[],hide:{parts:new Set(),fits:new Set()},gen:0,queued:null,active:false,pending:false};
 const uploads=[];const view={upload:(k,g)=>uploads.push(k),meshes:{},kind:'gl'};const Gfx={clearPreviewCache(){},meshPreview:(s,parts)=>({preview:{n:parts.length}}),publishPlacementDraftPreview(){}};
 const C={isShapePart:p=>['struct','wing','solarPanel'].includes(p.k)};const engineStatus=()=>{},requestDraw=()=>{},previewInputBusy=()=>false,requestedPart=p=>p,editorCanMeshPart=()=>true;
 // foilPreview(true) puts pose copies (new objects with the same ids) in live.parts and hides the originals.
 const pose=[{...wing,_poseOf:10},{...spar,_poseOf:11}].concat(${membersNonShape}?[{...gun,_poseOf:12}]:[]);
 live.active=true;live.parts=pose;live.fits=[];live.hide.parts=new Set(pose.map(q=>q._poseOf));live.hide.fits=new Set();live.gen=6;`
 +fn(app,'applyGeometry')+fn(app,'onEngineStructureGeometry')+fn(app,'clearPreview')+fn(app,'showPreview'),cx);
const r=vm.runInContext(`const r=onEngineStructureGeometry({gen:5,designId:'d',groups:['struct','plate','refStruct'],geos:{struct:{pos:new Float32Array(3),idx:new Uint32Array(3)}},ranges:{}});
 JSON.stringify({returned:r,foilView:st.foilView,liveActive:live.active,liveParts:live.parts.map(p=>p.id),hidden:[...live.hide.parts]})`,cx);
const o=JSON.parse(r),ids=membersNonShape?[10,11,12]:[10,11];
assert.equal(o.foilView,'stow','the stowed view stays on');assert.equal(o.liveActive,true,'the preview stays active');
assert.deepEqual(o.liveParts,ids,'the posed copies stay in the preview');assert.deepEqual(o.hidden,ids,'the originals stay hidden behind them');
});
