// Display-only localization. Designs, identifiers and simulation data stay intact.
(function(root){
'use strict';
const catalog=root.KS_EN||{},exact=catalog.messages||{},terms=catalog.terms||{},storageKey='yard.language',supported=new Set(['ja','en']);
let saved;try{saved=root.localStorage?.getItem(storageKey);}catch(_){}
let language=supported.has(saved)?saved:/^ja\b/i.test(root.navigator?.language||'ja')?'ja':'en';
const cache=new Map(),originals=new WeakMap(),attributes=new WeakMap(),contexts=new WeakSet();
const hasJapanese=/[\u3040-\u30ff\u3400-\u9fff]/,escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=Object.entries(exact).filter(([s])=>/\{\d+\}/.test(s)&&s.replace(/\{\d+\}/g,'').trim().length>=2).map(([s,to])=>{
 const order=[],parts=s.split(/(\{\d+\})/);return {re:new RegExp('^'+parts.map(p=>/^\{\d+\}$/.test(p)?(order.push(+p.slice(1,-1)),'(.*?)'):escapeRE(p)).join('')+'$'),to,order,weight:s.replace(/\{\d+\}/g,'').length};
}).sort((a,b)=>b.weight-a.weight);
const termKeys=Object.keys(terms).sort((a,b)=>b.length-a.length),termRE=termKeys.length?new RegExp(termKeys.map(escapeRE).join('|'),'g'):null;
function english(value,depth=0){
 const s=String(value??'');if(!hasJapanese.test(s))return s;
 if(Object.hasOwn(exact,s))return exact[s];
 const trimmed=s.trim();if(trimmed!==s)return s.slice(0,s.indexOf(trimmed))+english(trimmed,depth)+s.slice(s.indexOf(trimmed)+trimmed.length);
 if(Object.hasOwn(terms,s))return terms[s];
 if(depth<4&&s.startsWith('— '))return '— '+english(s.slice(2),depth+1);
 if(depth<4&&s.endsWith(' ▸'))return english(s.slice(0,-2),depth+1)+' ▸';
 // Complete templates preserve grammar before individual terms are substituted.
 if(depth<4)for(const p of patterns){const m=p.re.exec(s);if(!m)continue;const args={};p.order.forEach((k,i)=>{args[k]=english(m[i+1],depth+1);});return p.to.replace(/\{(\d+)\}/g,(_,k)=>args[k]??'');}
 // Translate compound labels only when all of their Japanese terms are known.
 if(termRE&&!/[。！？]/.test(s)){const out=s.replace(termRE,k=>' '+terms[k]+' ').replace(/（/g,'(').replace(/）/g,')').replace(/：/g,': ').replace(/・/g,' / ').replace(/\s+/g,' ').trim();if(!hasJapanese.test(out))return out;}
 if(depth<4&&s.includes(' · '))return s.split(' · ').map(p=>english(p,depth+1)).join(' · ');
 return s;
}
function t(value){const s=String(value??'');if(language==='ja'||!hasJapanese.test(s))return s;if(cache.has(s))return cache.get(s);const out=english(s);if(cache.size>=4096)cache.clear();cache.set(s,out);return out;}
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
function watch(){if(observer&&root.document?.documentElement)observer.observe(root.document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrNames});}
function refresh(){const doc=root.document;if(!doc)return;observer?.disconnect();doc.documentElement.lang=language;localize(doc.documentElement);for(const el of doc.querySelectorAll('[data-language]'))el.value=language;watch();}
function announce(){root.dispatchEvent?.(new root.CustomEvent('ks-language-change',{detail:{language}}));}
function setLanguage(value){if(!supported.has(value))return false;language=value;cache.clear();try{root.localStorage?.setItem(storageKey,value);}catch(_){}refresh();announce();return true;}
root.KSI18n={t,english,setLanguage,localize,sourceText,sourceHTML,canvas,refresh,get language(){return language;},get locale(){return language==='en'?'en-US':'ja-JP';}};
if(root.document){
 const init=()=>{
  if(root.MutationObserver)observer=new root.MutationObserver(records=>{observer.disconnect();const nodes=new Set();for(const r of records){if(r.type==='childList')for(const n of r.addedNodes)nodes.add(n);else nodes.add(r.target);}for(const n of nodes)if(n.isConnected)localize(n);watch();});
  root.document.addEventListener('change',e=>{if(e.target.matches?.('[data-language]'))setLanguage(e.target.value);});refresh();
 };
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 root.addEventListener('storage',e=>{if(e.key===storageKey&&supported.has(e.newValue)){language=e.newValue;cache.clear();refresh();announce();}});
}
})(typeof window==='undefined'?globalThis:window);
