const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(root){const cx=vm.createContext({console:{log(){},warn(){},error:console.error}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});return {C:vm.runInContext('Core',cx),F:vm.runInContext('YardFleetData',cx)};}
function run({C,F},key,mode,secs=40){const P=()=>JSON.parse(JSON.stringify(F.designs[key].p));const a=C.fleetUnit('a',key,P(),0),b=C.fleetUnit('b',key,P(),1);b.pos=[0,0,8000];b.manual=true;
 a.order={...a.order,...(mode!=='stop'?{type:'move',point:[5e7,0,0]}:{type:'hold'}),target:'b',fire:mode!=='move'};const B=C.fleetBattle([a,b],true);B.seed=7;
 let n=0,w=0,e=0,fill=0;for(let t=0;t<secs;t+=.25){C.fleetTick(B,.25,{});if(t>=5&&!b.out){n++;w+=a.pw?.wpn||0;e+=a.propulsion?.actualInputW||0;fill=Math.max(fill,a.ht.qJ/a.ht.capacityJ);}}
 const g=a.p.grid;return (w/n/g.P*100).toFixed(0)+'/'+(e/n/g.P*100).toFixed(0)+' 蓄熱'+(fill*100).toFixed(0)+'%'+(a.out?' '+a.out:'');}
const base=load(process.argv[2]),cand=load(require('node:path').resolve(__dirname,'../../..'));
console.log('艦 | 停止+射撃 基準→変更後 | 全速+射撃 基準→変更後 | 全速のみ 基準→変更後   (武装/エンジン、炉出力比%)');
for(const k of 'executor,mandator2,subjugator,recusantDn,providenceDn,imperial,imperial2,mc80home,mc75,mc80liberty,venator,recusant,providence,munificent,acclamator,dreadnaught,mc30c,arquitens,nebulonb'.split(','))console.log(k+' | '+['stop','both','move'].map(m=>run(base,k,m)+' → '+run(cand,k,m)).join(' | '));
