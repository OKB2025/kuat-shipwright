#!/usr/bin/env node
// Observe the real app's existing audio output; this does not emulate iOS ReplayKit.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const {chromium}=require('playwright'),url=process.env.KS_AUDIO_URL||'http://127.0.0.1:8003/';
 const output=path.resolve(process.argv[2]||path.join(root,'docs/benchmarks/recording-music-browser.json'));
 const sourceFiles=['index.html','js/app.js'],hashes=()=>Object.fromEntries(sourceFiles.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
 const report={status:'RUNNING',startedAt:new Date().toISOString(),sourceSha256:hashes(),harnessSha256:sha(fs.readFileSync(__filename)),scope:'Real public recorded BGM, synthesized music and effects in the actual application. The production AudioNode connection to its normal destination is retained. A test-only parallel tap of the existing final master gain feeds MediaRecorder and an AnalyserNode. No BGM replacement, generated test tone or simulation clock changes.',conditions:{browser:'Chromium on Linux',safari:'Not tested',iOSScreenRecording:'Not tested; these audio files are test-tap MediaRecorder output, not OS screen recordings.',interruption:'Controlled pause of the actual playing HTMLAudioElement and actual AudioContext.suspend followed by a trusted browser pointer gesture. This tests recovery with both real layers stopped, not reproduction of an iOS audio-session interruption.'},errors:[],consoleErrors:[],stages:[],recordings:[]};
 fs.mkdirSync(path.dirname(output),{recursive:true});const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 let browser,page;const stage=name=>{report.stages.push({name,at:new Date().toISOString()});save();console.log(name);};
 const state=()=>page.evaluate(()=>({audio:window.KSAudio.state(),ctx:window.__audioProbe.ctx.state,masterGain:window.__audioProbe.master.gain.value,elements:(window.__audioElements||[]).map(el=>({paused:el.paused,time:el.currentTime,ended:el.ended})),audioSessionSupported:!!navigator.audioSession,audioSessionType:navigator.audioSession?.type||null}));
 async function record(name){
  const capture=await page.evaluate(async()=>{
   const p=window.__audioProbe,chunks=[],samples=[],rec=new MediaRecorder(p.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:128000});
   const done=new Promise((resolve,reject)=>{rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onerror=e=>reject(Error(e.error?.message||'MediaRecorder failed'));rec.onstop=resolve;});
   const floats=new Float32Array(p.analyser.fftSize),timer=setInterval(()=>{p.analyser.getFloatTimeDomainData(floats);let sum=0,peak=0;for(const x of floats){sum+=x*x;peak=Math.max(peak,Math.abs(x));}samples.push({rms:Math.sqrt(sum/floats.length),peak});},40);
   rec.start();await new Promise(r=>setTimeout(r,1800));rec.stop();clearInterval(timer);await done;
   const blob=new Blob(chunks,{type:rec.mimeType}),bytes=await blob.arrayBuffer(),audio=await p.ctx.decodeAudioData(bytes.slice(0));let sum=0,peak=0,count=0;
   for(let c=0;c<audio.numberOfChannels;c++)for(const x of audio.getChannelData(c)){sum+=x*x;peak=Math.max(peak,Math.abs(x));count++;}
   const b64=await new Promise(resolve=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result).split(',')[1]);fr.readAsDataURL(blob);});
   return{mimeType:rec.mimeType,bytes:bytes.byteLength,duration:audio.duration,sampleRate:audio.sampleRate,channels:audio.numberOfChannels,rms:Math.sqrt(sum/count),peak,analyserSamples:samples,b64};
  });
  const file=output.replace(/\.json$/,'.'+name+'.webm'),bytes=Buffer.from(capture.b64,'base64');delete capture.b64;fs.writeFileSync(file,bytes);
  assert.ok(capture.duration>1,'recorded audio must contain actual samples');assert.ok(capture.rms>1e-5&&capture.peak>1e-4,name+' must contain audible nonzero production audio');
  const row={name,file:path.relative(root,file),sha256:sha(bytes),...capture,state:await state()};report.recordings.push(row);save();return row;
 }
 try{
  save();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl']});
  page=await browser.newPage({viewport:{width:1000,height:720},locale:'ja-JP'});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  await page.route('https://static.cloudflareinsights.com/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* Test-local telemetry acknowledgement. */'}));
  await page.addInitScript(()=>{
   const media=AudioContext.prototype.createMediaElementSource;window.__audioElements=[];
   AudioContext.prototype.createMediaElementSource=function(el){const source=media.call(this,el);window.__audioElements.push(el);return source;};
   const connect=AudioNode.prototype.connect;
   AudioNode.prototype.connect=function(destination,...args){
    const result=connect.call(this,destination,...args);
    if(!window.__audioProbe&&destination===this.context.destination&&this instanceof GainNode){
     const ctx=this.context,analyser=ctx.createAnalyser(),tap=ctx.createMediaStreamDestination();analyser.fftSize=2048;
     connect.call(this,analyser);connect.call(this,tap);window.__audioProbe={ctx,master:this,analyser,stream:tap.stream};
    }
    return result;
   };
  });
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.KSAudio,{timeout:60000});
  await page.mouse.click(12,12);await page.waitForFunction(()=>window.KSAudio.state().ctxState==='running',{timeout:30000});
  await page.waitForFunction(()=>window.KSAudio.state().track?.playing,{timeout:60000});await page.waitForTimeout(2300);
  report.initial=await state();assert.equal(report.initial.audio.musicSource,'classic');assert.ok(report.initial.audio.track.playing);
  await record('recorded-before');stage('Public recorded BGM reaches the existing final output and the parallel recording tap');
  report.beforeInterruption=await state();await page.evaluate(()=>{for(const el of window.__audioElements)if(!el.paused)el.pause();return window.__audioProbe.ctx.suspend();});
  await page.waitForFunction(()=>window.__audioProbe.ctx.state==='suspended');report.interrupted=await state();
  await page.mouse.click(12,12);await page.waitForFunction(()=>window.__audioProbe.ctx.state==='running',{timeout:10000});
  await page.waitForTimeout(350);report.afterInterruption=await state();assert.ok(report.afterInterruption.audio.track.playing);assert.ok(report.afterInterruption.audio.track.time>report.beforeInterruption.audio.track.time);await record('recorded-recovered');stage('Trusted pointer input restores the actually suspended context and paused recorded BGM without resetting its position');
  await page.evaluate(()=>window.KSAudio.settings.set({muted:true}));await page.waitForTimeout(500);report.muted=await state();
  assert.equal(report.muted.audio.settings.muted,true);assert.equal(report.muted.ctx,'suspended');assert.equal(report.muted.audio.track.playing,false);assert.ok(report.muted.masterGain<report.initial.masterGain*.01);
  await page.mouse.click(12,12);await page.waitForTimeout(500);report.mutedAfterGesture=await state();assert.equal(report.mutedAfterGesture.audio.settings.muted,true);assert.equal(report.mutedAfterGesture.ctx,'suspended');assert.equal(report.mutedAfterGesture.audio.track.playing,false);stage('Mute stops the context and recorded player and retains user settings across recovery gestures');
  await page.evaluate(()=>window.KSAudio.settings.set({muted:false}));await page.mouse.click(12,12);await page.waitForFunction(()=>window.__audioProbe.ctx.state==='running');
  await page.waitForTimeout(350);await record('recorded-unmuted');
  await page.evaluate(()=>window.KSAudio.settings.set({musicSource:'synth'}));await page.waitForTimeout(2400);report.synth=await state();assert.equal(report.synth.audio.musicSource,'synth');await record('synth');stage('Synthesized fallback music remains audible after changing source');
  await page.evaluate(()=>{window.KSAudio.settings.set({music:0,sfx:1});});await page.waitForTimeout(500);
  await page.evaluate(()=>{window.__audioEffectTimer=setInterval(()=>window.KSAudio.sfx('laser_light',{gain:.7}),300);});
  await record('effects-only');await page.evaluate(()=>clearInterval(window.__audioEffectTimer));stage('Real effect synthesis remains audible with music volume at zero');
  report.final=await state();report.sourceSha256After=hashes();report.sourceStable=JSON.stringify(report.sourceSha256)===JSON.stringify(report.sourceSha256After);assert.equal(report.sourceStable,true,'production source changed during recording validation');
  report.harnessStable=report.harnessSha256===sha(fs.readFileSync(__filename));assert.equal(report.harnessStable,true);assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);
  report.status='PASS';report.completedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,recordings:report.recordings.map(r=>({name:r.name,rms:r.rms,peak:r.peak,duration:r.duration})),output}));
 }catch(error){report.status='ERROR';report.error=error.stack||String(error);report.failure=await state().catch(()=>null);report.sourceSha256After=hashes();save();throw error;}finally{await browser?.close();}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
