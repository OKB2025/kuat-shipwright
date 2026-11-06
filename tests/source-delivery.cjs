const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), {test} = require('node:test');
const {createHash, webcrypto} = require('node:crypto');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const boot = html.slice(html.lastIndexOf('<script>\n/*'), html.lastIndexOf('</script>\n\n<!-- Cloudflare')).replace(/^<script>\n/, '');
const files = {data:['data/reference.js','data/textures.js','data/imperial2.js','data/fleet.js'], core:'js/core.js', gfx:'js/gfx.js', engine:'js/engine.js', app:'js/app.js', worker:'js/worker.js'};
const all = [...files.data, files.core, files.gfx, files.engine, files.app];
const engineFiles = ['data/reference.js', 'data/imperial2.js', files.core, files.gfx, files.engine];
const digest = sources => createHash('sha256').update(Buffer.concat(sources.map(s => createHash('sha256').update(s).digest()))).digest('hex').slice(0,20);
const tick = () => new Promise(resolve => setImmediate(resolve));
async function load(options = {}) {
  const configuredFiles = {...files, data:options.dataOrder || files.data};
  const configuredAll = [...configuredFiles.data, files.core, files.gfx, files.engine, files.app];
  const origin = options.file ? 'file:///app/index.html' : 'https://example.test/app/index.html' + (options.inline?'?inline':'');
  const current = Object.fromEntries(configuredAll.map(f => [f, '// ' + f + ' current\n']));
  current[files.gfx] += options.gfx || 'const currentRenderer = true;\n';
  const stale = {...current, [files.gfx]: '// old gfx from before the release\n'};
  const requests = [], scripts = [], workers = [], errors = [], urls = new Map(), timers = new Set();
  const status = {textContent: ''}; let paintedStatus = '';
  let nextURL = 1, appLoaded = false;
  class BrowserURL extends URL {
    static createObjectURL(blob) { const url = 'blob:source-' + nextURL++; urls.set(url,blob); return url; }
    static revokeObjectURL(url) { urls.delete(url); }
  }
  class FakeWorker {
    constructor(url) {
      if (options.workerFails) throw new Error('worker refused');
      assert.ok(url.startsWith('blob:'), 'the worker must not refetch worker.js or its unversioned dependencies');
      workers.push(this); this.terminated = false;
      urls.get(url).text().then(source => {
        this.source = source;
        this.stamp = JSON.parse(source.match(/self.KS_SOURCE_STAMP=(.*?);\n/)[1]);
        this.onmessage?.({data:{type:'ready'}});
      });
    }
    terminate() { this.terminated = true; }
  }
  const document = {baseURI:origin, readyState:'complete', querySelector:selector=>selector==='#titleStatus'?status:null, getElementById:()=>null,
    createElement:() => ({remove(){}}), body:{appendChild(script) {
      (async () => {
        const blob = urls.get(script.src);
        if (blob && options.rejectBlob) { script.onerror(); return; }
        let source;
        if (blob) {
          source = await blob.text();
          if (options.rejectBlobAt && source === current[options.rejectBlobAt]) {
            await cx.KSBoot.workerReady; // Reject after the shared worker is already ready.
            script.onerror(); return;
          }
        }
        else {
          const u = new URL(script.src, origin), file = u.pathname.replace(/^\/app\//,'');
          source = u.protocol === 'file:' || u.searchParams.has('_ksload') ? current[file] : stale[file];
        }
        scripts.push({url:script.src, source, stamp:cx.KS_SOURCE_STAMP, status:status.textContent, paintedStatus});
        script.onload();
        if (source === current[files.app]) appLoaded = true;
      })().catch(error => errors.push(error));
    }}};
  const cx = vm.createContext({console:{warn(){}, error:e=>errors.push(e)}, document, location:new URL(origin), navigator:{webdriver:true},
    URL:BrowserURL, Blob, crypto:options.noCrypto?undefined:webcrypto, Uint8Array,
    requestAnimationFrame:fn=>setImmediate(()=>{paintedStatus=status.textContent;fn();}),
    setTimeout:(fn, ms) => { const timer = setTimeout(fn, ms); timer.unref?.(); timers.add(timer); return timer; }, clearTimeout,
    KS_FILES:{...configuredFiles, sizes:options.noSizes?undefined:Object.fromEntries(configuredAll.map(f=>[f,999]))}});
  cx.window = cx;
  if (!options.noWorker) cx.Worker = FakeWorker;
  if (!options.noFetch) cx.fetch = async (url, init = {}) => {
    requests.push({url, ...init});
    if (url === options.failFetch) throw new Error('temporary source failure');
    const source = init.cache === 'no-cache' ? current[url] : stale[url];
    if (options.streaming) {
      const bytes = new TextEncoder().encode(source); let done = false;
      return {ok:true, body:{getReader:()=>({read:async()=>done?{done:true}:(done=true,{done:false,value:bytes})})}};
    }
    return {ok:true, arrayBuffer:async()=>new TextEncoder().encode(source).buffer};
  };
  vm.runInContext(boot, cx, {filename:'index.html bootstrap'});
  for (let n = 0; !appLoaded && !errors.length && n < 1000; n++) await new Promise(resolve=>setTimeout(resolve,1));
  await tick();
  const worker = await cx.KSBoot.workerReady.then(value=>value,()=>null);
  for (const timer of timers) clearTimeout(timer);
  assert.equal(errors.length,0, errors.map(String).join('\n'));
  assert.ok(appLoaded, 'the app must finish loading');
  return {cx, current, stale, requests, scripts, workers, worker};
}

test('revalidation replaces stale cached gfx and the worker executes the exact page source snapshot', async () => {
  const r = await load({streaming:true});
  assert.deepEqual(r.requests.map(x=>x.url),all);
  assert.ok(r.requests.every(x=>x.cache==='no-cache'),'revalidate without disabling HTTP storage');
  assert.deepEqual(r.scripts.map(x=>x.source),all.map(f=>r.current[f]));
  assert.ok(r.worker);
  const prefix = `self.__ksWorker=true;self.KS_SOURCE_STAMP=${JSON.stringify(r.cx.KS_SOURCE_STAMP)};\n`;
  assert.equal(r.worker.source,prefix+engineFiles.map(f=>r.current[f]+'\n').join(''));
  assert.equal(r.worker.stamp,digest(engineFiles.map(f=>r.current[f])));
  assert.equal(r.cx.KS_SOURCE_STAMP,r.worker.stamp);
  assert.equal(r.scripts.find(s=>s.source===r.current[files.engine]).stamp,r.worker.stamp,'identity is available before engine execution');
});

const publishedData = JSON.parse(html.match(/window\.KS_FILES=(\{[^\n]+\});/)[1]).data;
for (const [name, dataOrder] of [['published planet-texture order', publishedData], ['reordered data dependencies', [...publishedData].reverse()]]) {
  test(name+' keeps both ship-design dependencies in the worker snapshot', async () => {
    const r = await load({dataOrder});
    assert.deepEqual(r.scripts.map(s=>s.source),[...dataOrder, files.core, files.gfx, files.engine, files.app].map(f=>r.current[f]));
    assert.ok(r.worker, 'visual data cannot force the engine to fall back to the interface thread');
    const prefix = `self.__ksWorker=true;self.KS_SOURCE_STAMP=${JSON.stringify(r.cx.KS_SOURCE_STAMP)};\n`;
    assert.equal(r.worker.source,prefix+engineFiles.map(f=>r.current[f]+'\n').join(''));
    assert.equal(r.worker.stamp,digest(engineFiles.map(f=>r.current[f])));
    assert.equal(r.worker.stamp,r.cx.KS_SOURCE_STAMP);
  });
}

test('unchanged sources retain their identity; a renderer edit changes both thread identities', async () => {
  const a = await load(), b = await load(), c = await load({gfx:'const changedRenderer = true;\n'});
  assert.equal(a.cx.KS_SOURCE_STAMP,b.cx.KS_SOURCE_STAMP);
  assert.notEqual(a.cx.KS_SOURCE_STAMP,c.cx.KS_SOURCE_STAMP);
  assert.equal(c.worker.stamp,c.cx.KS_SOURCE_STAMP);
});

test('stale or missing progress sizes cannot disable revalidation or source identity', async () => {
  const r = await load({noSizes:true});
  assert.equal(r.requests.length,all.length);
  assert.equal(r.worker.stamp,r.cx.KS_SOURCE_STAMP);
});

test('startup paints the current loading stage before the core and app scripts execute', async () => {
  const r = await load();
  const core = r.scripts.find(s=>s.source===r.current[files.core]);
  const app = r.scripts.find(s=>s.source===r.current[files.app]);
  assert.equal(core.status,'設計計算を準備中…');
  assert.equal(core.paintedStatus,core.status,'core execution cannot leave an older loading stage painted');
  assert.equal(app.status,'設計画面を準備中…');
  assert.equal(app.paintedStatus,app.status,'app startup cannot hide its stage behind the previous88% label');
});

for (const [name, options] of [['Worker unavailable',{noWorker:true}],['Worker refused',{workerFails:true}],['inline requested',{inline:true}]]) {
  test(name+' retains the verified page snapshot for inline rendering', async () => {
    const r = await load(options);
    assert.equal(r.worker,null);
    assert.deepEqual(r.scripts.map(x=>x.source),all.map(f=>r.current[f]));
    assert.equal(r.cx.KS_SOURCE_STAMP,digest(engineFiles.map(f=>r.current[f])));
  });
}

for (const [name, options] of [['fetch unavailable',{noFetch:true}],['blob scripts refused',{rejectBlob:true}],['one fetch failed',{failFetch:files.gfx}],['later blob script refused',{rejectBlobAt:files.gfx}]]) {
  test(name+' uses cache-busted HTTP scripts, inline rendering, and no disk identity', async () => {
    const r = await load(options), fallback = r.scripts.filter(s=>!s.url.startsWith('blob:'));
    assert.ok(fallback.length);
    const tokens = fallback.map(s=>new URL(s.url).searchParams.get('_ksload'));
    assert.ok(tokens.every(Boolean)); assert.equal(new Set(tokens).size,1);
    assert.equal(r.worker,null);
    assert.equal(r.cx.KS_SOURCE_STAMP,null);
    assert.ok(r.workers.every(w=>w.terminated));
    if (options.rejectBlobAt) assert.equal(r.workers.length,1,'an already ready worker must be retired before script fallback');
    assert.deepEqual(r.scripts.map(x=>x.source),all.map(f=>r.current[f]));
  });
}

test('file:// loading uses unchanged relative script paths without network fetch or disk caching', async () => {
  const r = await load({file:true});
  assert.equal(r.requests.length,0);
  assert.deepEqual(r.scripts.map(s=>s.url),all);
  assert.equal(r.worker,null); assert.equal(r.cx.KS_SOURCE_STAMP,null);
});

test('missing crypto keeps identical main/worker rendering but disables persistent identity', async () => {
  const r = await load({noCrypto:true});
  assert.ok(r.worker); assert.equal(r.worker.stamp,null); assert.equal(r.cx.KS_SOURCE_STAMP,null);
});
