// usage: node check.cjs <url> <outdir> : the structures' record and the autosave (yard.draft3): open the TIE/ln example, move a structure, wait for
// the Worker's figures, read the draft; reload and read whether the record is used; Ctrl+Z, wait, read the draft; reload again.
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');const url=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({viewport:{width:1280,height:800}}),page=await ctx.newPage();const rep={errors:[],steps:[]};
 page.on('pageerror',e=>rep.errors.push('pageerror: '+String(e.message).slice(0,300)));
 const settled=()=>page.waitForFunction(()=>{const Y=window.__yard;return Y&&Y.eng&&!Y.eng.error&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.geoGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&!!Y.stats;},null,{timeout:900000});
 const read=label=>page.evaluate(label=>{const Y=window.__yard,C=Y.C,s=Y.ship;let d=null;try{d=JSON.parse(localStorage.getItem('yard.draft3')||'null');}catch(e){}
  const q=s.parts.find(p=>p.k==='struct'&&!C.isHullStructure(p));const copy=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));const r=C.structuralMaterial(copy);
  return {label,shipRecordKey:s._structuralRecord?.key||null,draftRecordKey:d?.structuralMaterial?.key||null,draftHasRecord:!!d?.structuralMaterial,draftStructX:d?(d.parts||[]).find(p=>p.id===q?.id)?.c?.[0]??null:null,shipStructX:q?.c?.[0]??null,recordFitsShip:!!r.fromRecord};},label);
 const wait=ms=>page.waitForTimeout(ms);
 try{await page.goto(url);await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>window.__yard.title.hide());
  await page.evaluate(()=>window.__yard.openExample('craft_tie_ln'));await settled();await wait(3000);rep.steps.push(await read('opened'));
  await page.evaluate(()=>{const Y=window.__yard,C=Y.C,s=C.deserialize(JSON.parse(JSON.stringify(C.serialize(Y.ship))));const q=s.parts.find(p=>p.k==='struct'&&!C.isHullStructure(p));q.c[0]+=.05;delete s._structuralRecord;Y.setShip(s);});
  await settled();await wait(4000);rep.steps.push(await read('moved, figures in'));
  await page.reload();await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>document.querySelector('#title [data-title="continue"]').click());await settled();rep.steps.push(await read('reloaded after move'));
  await page.mouse.click(640,420);await page.keyboard.press('Control+z');await settled();await wait(4000);rep.steps.push(await read('after Ctrl+Z (history may be gone after the reload)'));
  // the undo inside one page: move, wait, Ctrl+Z, wait
  await page.evaluate(()=>{const Y=window.__yard,C=Y.C,s=C.deserialize(JSON.parse(JSON.stringify(C.serialize(Y.ship))));const q=s.parts.find(p=>p.k==='struct'&&!C.isHullStructure(p));q.c[0]+=.05;delete s._structuralRecord;Y.setShip(s);});
  await settled();await wait(4000);rep.steps.push(await read('moved again'));
  await page.mouse.click(640,420);await page.keyboard.press('Control+z');await settled();await wait(4000);rep.steps.push(await read('Ctrl+Z, figures in'));
  await page.reload();await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>document.querySelector('#title [data-title="continue"]').click());await settled();rep.steps.push(await read('reloaded after undo'));
 }catch(e){rep.errors.push('script: '+String(e.message).slice(0,400));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(rep,null,1));await b.close();console.log(JSON.stringify(rep,null,1));})();
