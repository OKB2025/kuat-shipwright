// A compact, tolerance-comparable fingerprint of Core.computeStats output (the design figures).
// Top-level scalars are kept as they are; every top-level object (info, heat, propulsion, skin, ...) becomes
// a summary of all its leaves: count, sum, sum of magnitudes and a path-weighted sum of the numbers, the
// count of true flags and a hash of every string and non-finite value with its path. Any changed, added or
// removed leaf moves the summary; floating-point noise moves the sums only within the tolerance.
const fnv=(text,h=2166136261)=>{for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
function summary(value){
 const out={n:0,s:0,a:0,w:0,t:0,h:2166136261};
 const walk=(v,path,seen)=>{
  if(v==null){out.h=fnv(path+'=null',out.h);return;}
  if(typeof v==='number'){if(!Number.isFinite(v)){out.h=fnv(path+'='+String(v),out.h);return;}out.n++;out.s+=v;out.a+=Math.abs(v);out.w+=v*(1+fnv(path)/4294967296);return;}
  if(typeof v==='boolean'){if(v)out.t++;out.h=fnv(path+'='+v,out.h);return;}
  if(typeof v==='string'){out.h=fnv(path+'='+v,out.h);return;}
  if(typeof v==='function'||typeof v==='symbol')return;
  if(seen.has(v))return;seen.add(v);
  if(ArrayBuffer.isView(v)){out.h=fnv(path+':'+v.constructor.name+v.length,out.h);for(let i=0;i<v.length;i++)walk(v[i],path+'.'+i,seen);}
  else if(Array.isArray(v)){out.h=fnv(path+'[]'+v.length,out.h);v.forEach((x,i)=>walk(x,path+'.'+i,seen));}
  else if(v instanceof Map){out.h=fnv(path+'{map}'+v.size,out.h);for(const [k,x] of v)walk(x,path+'.'+String(k),seen);}
  else if(v instanceof Set){out.h=fnv(path+'{set}'+v.size,out.h);let i=0;for(const x of v)walk(x,path+'.'+i++,seen);}
  else for(const k of Object.keys(v).sort())walk(v[k],path+'.'+k,seen);
  seen.delete(v);
 };
 walk(value,'',new Set());out.h=out.h.toString(16);return out;
}
// The figures as plain JSON: functions dropped, typed arrays as their type, length and sum, Maps and Sets as
// entry lists, repeated references on one path as '$cycle', non-finite numbers as strings.
function plainFigures(v,seen=new WeakSet()){
 if(v==null||typeof v==='boolean'||typeof v==='string')return v;
 if(typeof v==='number')return Number.isFinite(v)?v:String(v);
 if(typeof v==='function'||typeof v==='symbol')return undefined;
 if(ArrayBuffer.isView(v))return {$ta:v.constructor.name,n:v.length,sum:Array.prototype.reduce.call(v,(a,b)=>a+b,0)};
 if(seen.has(v))return '$cycle';seen.add(v);let r;
 if(Array.isArray(v))r=v.map(x=>{const y=plainFigures(x,seen);return y===undefined?null:y;});
 else if(v instanceof Map)r={$map:[...v].map(([k,x])=>[plainFigures(k,seen),plainFigures(x,seen)])};
 else if(v instanceof Set)r={$set:[...v].map(x=>plainFigures(x,seen))};
 else{r={};for(const k of Object.keys(v)){const y=plainFigures(v[k],seen);if(y!==undefined)r[k]=y;}}
 seen.delete(v);return r;
}
// Digest of live figures, or of figures already passed through plainFigures and JSON.
function figuresDigest(live,plain=false){
 const S=plain?live:JSON.parse(JSON.stringify(plainFigures(live))),out={};
 for(const k of Object.keys(S).sort()){const v=S[k];if(typeof v==='function')continue;out[k]=v!==null&&typeof v==='object'?{$:summary(v)}:typeof v==='number'&&!Number.isFinite(v)?String(v):v;}
 out.$warnings=(S.warnings||[]).map(w=>[w.lv,w.code||'',w.text]);
 return out;
}
// Differences beyond the relative tolerance (sums are compared against their sum of magnitudes).
function figuresDiff(expected,actual,tol=1e-9){
 const diffs=[],near=(x,y,scale)=>Math.abs(x-y)<=tol*Math.max(1,Math.abs(scale));
 for(const k of new Set([...Object.keys(expected),...Object.keys(actual)])){
  const a=expected[k],b=actual[k];
  if(!(k in expected)||!(k in actual)){diffs.push(k+': '+(k in expected?'missing':'new'));continue;}
  if(a&&typeof a==='object'&&a.$){const p=a.$,q=b?.$;if(!q){diffs.push(k+': not an object now');continue;}
   if(p.n!==q.n||p.t!==q.t||p.h!==q.h||!near(p.a,q.a,p.a)||!near(p.s,q.s,p.a)||!near(p.w,q.w,2*p.a))diffs.push(k+': '+JSON.stringify(p)+' → '+JSON.stringify(q));continue;}
  if(typeof a==='number'&&typeof b==='number'){if(!near(a,b,Math.max(Math.abs(a),Math.abs(b))))diffs.push(k+': '+a+' → '+b);continue;}
  if(JSON.stringify(a)!==JSON.stringify(b))diffs.push(k+': '+JSON.stringify(a)?.slice(0,200)+' → '+JSON.stringify(b)?.slice(0,200));
 }
 return diffs;
}
module.exports={figuresDigest,figuresDiff,plainFigures,summary};
