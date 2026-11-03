// Display-only localization. Designs, identifiers and simulation data stay intact.
(function(root){
'use strict';
const storageKey='yard.language',supported=new Set(['ja','en']);
let saved;try{saved=root.localStorage?.getItem(storageKey);}catch(_){}
let language=supported.has(saved)?saved:/^ja\b/i.test(root.navigator?.language||'ja')?'ja':'en';
const cache=new Map(),originals=new WeakMap(),attributes=new WeakMap(),contexts=new WeakSet();
const hasJapanese=/[\u3040-\u30ff\u3400-\u9fff]/,escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// v13 LOAD The English catalog (js/lang-en.js, 0.9 MB) is compiled on first use and, on a published page, fetched
// only when English is chosen or is the browser's language: a Japanese session neither downloads nor walks it.
let catalog=null,exact={},terms={},patterns=[],termRE=null;
function prepare(){
 const c=root.KS_EN;if(!c)return false;if(c===catalog)return true;
 catalog=c;exact=c.messages||{};terms=c.terms||{};
 patterns=Object.entries(exact).filter(([s])=>/\{\d+\}/.test(s)&&s.replace(/\{\d+\}/g,'').trim().length>=2).map(([s,to])=>{
  const order=[],parts=s.split(/(\{\d+\})/);return {re:new RegExp('^'+parts.map((p,i)=>/^\{\d+\}$/.test(p)?(order.push(+p.slice(1,-1)),parts[i-1]?.endsWith('第')?'(\\d+)':'(.*?)'):escapeRE(p)).join('')+'$'),to,order,weight:s.replace(/\{\d+\}/g,'').length};
 }).sort((a,b)=>b.weight-a.weight);
 const termKeys=Object.keys(terms).sort((a,b)=>b.length-a.length);termRE=termKeys.length?new RegExp(termKeys.map(escapeRE).join('|'),'g'):null;
 englishMemo.clear();cache.clear();return true;
}
// The catalog's address: the page names it (data-catalog, with the catalog's own version stamp), else next to this script.
const catalogSrc=(()=>{try{const el=root.document?.currentScript,c=el?.dataset?.catalog;if(c)return new URL(c,root.document.baseURI).href;const s=el?.src||'';return /i18n\.js/.test(s)?s.replace(/i18n\.js/,'lang-en.js'):null;}catch(_){return null;}})();
let catalogLoad=null;
function loadCatalog(){
 if(root.KS_EN)return Promise.resolve(true);
 const doc=root.document;if(!catalogSrc||!doc)return Promise.resolve(false);
 if(!catalogLoad)catalogLoad=new Promise(resolve=>{const el=doc.createElement('script');el.src=catalogSrc;el.onload=()=>resolve(!!root.KS_EN);el.onerror=()=>{catalogLoad=null;el.remove();resolve(false);};(doc.head||doc.documentElement).appendChild(el);})
  .then(ok=>{if(ok&&language==='en'){cache.clear();refresh();announce();}return ok;});
 return catalogLoad;
}
// English at start: while the page is still parsing, the catalog is written in as the next script so the first
// paint is already English (as when it was a page script); otherwise it is loaded and the page re-translated.
if(language==='en'&&!root.KS_EN&&catalogSrc){
 let written=false;try{if(root.document.readyState==='loading'){root.document.write('<script src="'+catalogSrc.replace(/"/g,'&quot;')+'"><\/script>');written=true;}}catch(_){}
 if(!written)setTimeout(loadCatalog,0);
}
// Translations are pure functions of the source text: remember them (bounded), since the same labels are
// translated over and over by the DOM observer and every canvas frame.
const englishMemo=new Map();
function english(value,depth=0){if(!prepare())return String(value??'');if(depth)return englishRaw(value,depth);const k=String(value??'');let v=englishMemo.get(k);if(v===undefined){v=englishRaw(k,0);if(englishMemo.size>20000)englishMemo.clear();englishMemo.set(k,v);}return v;}
function englishRaw(value,depth=0){
 const s=String(value??'');if(!hasJapanese.test(s))return s;
 if(Object.hasOwn(exact,s))return exact[s];
 const trimmed=s.trim();if(trimmed!==s)return s.slice(0,s.indexOf(trimmed))+english(trimmed,depth)+s.slice(s.indexOf(trimmed)+trimmed.length);
 if(Object.hasOwn(terms,s))return terms[s];
 if(depth<8&&s.startsWith('— '))return '— '+english(s.slice(2),depth+1);
 if(depth<8&&s.endsWith(' ▸'))return english(s.slice(0,-2),depth+1)+' ▸';
 // Complete templates preserve grammar before individual terms are substituted.
 let partial=s,remaining=(s.match(/[\u3040-\u30ff\u3400-\u9fff]/g)||[]).length;
 const consider=out=>{const n=(out.match(/[\u3040-\u30ff\u3400-\u9fff]/g)||[]).length;if(n<remaining){partial=out;remaining=n;}return n===0;};
 // Keep looking when a broad template leaves a nested label untranslated.
 // Skip unchanged captures to avoid consuming the recursion budget on itself.
 if(depth<8)for(const p of patterns){const m=p.re.exec(s);if(!m||m.slice(1).includes(s))continue;const args={};p.order.forEach((k,i)=>{args[k]=english(m[i+1],depth+1);});const out=p.to.replace(/\{(\d+)\}/g,(_,k)=>args[k]??'');if(consider(out))return out;}
 // Translate compound labels only when all of their Japanese terms are known.
 if(termRE&&!/[。！？]/.test(s)){const out=s.replace(termRE,k=>' '+terms[k]+' ').replace(/（/g,'(').replace(/）/g,')').replace(/：/g,': ').replace(/・/g,' / ').replace(/\s+/g,' ').trim();if(!hasJapanese.test(out))return out;}
 if(depth<8&&s.includes(' · ')){const out=s.split(' · ').map(p=>english(p,depth+1)).join(' · ');if(consider(out))return out;}
 return partial;
}
function t(value){const s=String(value??'');if(language==='ja'||!hasJapanese.test(s))return s;if(!prepare())return s;if(cache.has(s))return cache.get(s);const out=english(s);if(cache.size>=4096)cache.clear();cache.set(s,out);return out;}
const skip='script,style,[translate="no"],[data-l10n-skip],[contenteditable]:not([contenteditable="false"])';
function ignored(n){return !!(n.nodeType===1?n:n.parentElement)?.closest?.(skip);}
function textNode(n){if(ignored(n)||n.parentElement?.closest('textarea'))return;const prev=originals.get(n),current=n.nodeValue,source=prev&&current===prev.shown?prev.source:current,shown=t(source);originals.set(n,{source,shown});if(current!==shown)n.nodeValue=shown;}
const attrNames=['aria-label','aria-description','aria-valuetext','title','placeholder','alt','label'];
function localize(el){
 if(!el||ignored(el))return;if(el.nodeType===3){textNode(el);return;}if(![1,9,11].includes(el.nodeType))return;
 if(el.nodeType===1){
  if(el.tagName==='OPTION'&&!el.hasAttribute('value'))el.setAttribute('value',el.textContent);
  let rec=attributes.get(el);if(!rec){rec={};attributes.set(el,rec);}
  for(const name of attrNames){const current=el.getAttribute(name);if(current==null){delete rec[name];continue;}const prev=rec[name],source=prev&&current===prev.shown?prev.source:current,shown=t(source);rec[name]={source,shown};if(current!==shown)el.setAttribute(name,shown);}
 }
 for(const child of el.childNodes||[])localize(child);
}
function sourceText(n){if(!n)return '';if(n.nodeType===3){const r=originals.get(n);return r&&n.nodeValue===r.shown?r.source:n.nodeValue;}return Array.from(n.childNodes||[],sourceText).join('');}
function sourceHTML(el){if(!el)return '';const copy=el.cloneNode(true);function restore(from,to){if(from.nodeType===3){to.nodeValue=sourceText(from);return;}const rec=attributes.get(from);if(rec)for(const [name,v]of Object.entries(rec))if(from.getAttribute(name)===v.shown)to.setAttribute(name,v.source);for(let i=0;i<from.childNodes.length;i++)restore(from.childNodes[i],to.childNodes[i]);}restore(el,copy);return copy.innerHTML;}
function canvas(ctx){if(!ctx||contexts.has(ctx))return ctx;contexts.add(ctx);for(const key of ['fillText','strokeText','measureText']){const original=ctx[key];if(typeof original==='function')ctx[key]=function(text,...args){return original.call(this,t(text),...args);};}return ctx;}
let observer;
// v13 LOAD In Japanese the page is shown as written: no observer and no walks, except one walk to put the Japanese
// back after English was shown.
let shownEnglish=false;
function watch(){if(observer&&language==='en'&&root.document?.documentElement)observer.observe(root.document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrNames});}
function refresh(){const doc=root.document;if(!doc)return;observer?.disconnect();doc.documentElement.lang=language;if(language==='en'||shownEnglish){localize(doc.documentElement);shownEnglish=language==='en'&&prepare();}for(const el of doc.querySelectorAll('[data-language]'))el.value=language;watch();}
function announce(){root.dispatchEvent?.(new root.CustomEvent('ks-language-change',{detail:{language}}));}
function setLanguage(value){if(!supported.has(value))return false;language=value;cache.clear();try{root.localStorage?.setItem(storageKey,value);}catch(_){}if(value==='en')loadCatalog();refresh();announce();return true;}
root.KSI18n={t,english,setLanguage,loadCatalog,localize,sourceText,sourceHTML,canvas,refresh,get language(){return language;},get locale(){return language==='en'?'en-US':'ja-JP';}};
if(root.document){
 const init=()=>{
  if(root.MutationObserver)observer=new root.MutationObserver(records=>{observer.disconnect();const nodes=new Set();for(const r of records){if(r.type==='childList')for(const n of r.addedNodes)nodes.add(n);else nodes.add(r.target);}for(const n of nodes)if(n.isConnected)localize(n);watch();});
  root.document.addEventListener('change',e=>{if(e.target.matches?.('[data-language]'))setLanguage(e.target.value);});refresh();
 };
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 root.addEventListener('storage',e=>{if(e.key===storageKey&&supported.has(e.newValue)){language=e.newValue;cache.clear();if(language==='en')loadCatalog();refresh();announce();}});
}
})(typeof window==='undefined'?globalThis:window);
