// ---- src/45_audio.js ----
// 45_audio.js — KSAudio: synthesized orchestral BGM and SFX (Web Audio only; no samples, all themes original).
// createEngine(ctx, dest) builds the graph on any BaseAudioContext, so the same code renders offline for tests.
(function () {
'use strict';
const W = typeof window !== 'undefined' ? window : globalThis;
if (W.KSAudio && W.KSAudio.__ks) return;
const AC = W.AudioContext || W.webkitAudioContext, OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext;

// ---------- small helpers ----------
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const mtof = m => 440*Math.pow(2, (m - 69) / 12);
const smooth = x => { x = clamp(x,0,1); return x*x*(3 - 2*x); };
function rng(a) { a = a >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15,1 | a); t = t + Math.imul(t ^ t >>> 7,61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const PCN = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
const pcOf = s => (PCN[s[0]] + (s[1] === 'b' ? -1 : s[1] === '#' ? 1 : 0) + 12) % 12;
function nm(s) { const m = /^([A-G])(b|#)?(-?\d)$/.exec(s); if (!m) throw new Error('note ' + s); return 12*(+m[3] + 1) + PCN[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0); }
function mel(str) { const out = []; let t = 0; for (const tok of str.split(/\s+/)) { if (!tok || tok === '|') continue; const p = tok.split(':'), d = +p[1]; if (p[0] !== 'r') out.push([nm(p[0]), t, d]); t += d; } out.len = t; return out; }
const QUAL = {'': [0,4,7], m: [0,3,7],7: [0,4,7,10], m7: [0,3,7,10], maj7: [0,4,7,11], sus: [0,5,7], sus2: [0,2,7], dim: [0,3,6], m7b5: [0,3,6,10],5: [0,7], add9: [0,4,7,2], madd9: [0,3,7,2],6: [0,4,7,9], m6: [0,3,7,9],9: [0,4,7,10,2], aug: [0,4,8]};
function chord(s) { const m = /^([A-G][b#]?)([^/]*)(?:\/([A-G][b#]?))?$/.exec(s); const r = pcOf(m[1]), iv = QUAL[m[2]]; if (!iv) throw new Error('chord ' + s); return {r, pcs: iv.map(i => (r + i) % 12), b: m[3] ? pcOf(m[3]) : r, q: m[2]}; }
function prog(str) { const out = []; let t = 0; for (const tok of str.split(/\s+/)) { if (!tok || tok === '|') continue; const p = tok.split(':'), d = +(p[1] || 4); out.push({c: chord(p[0]), t, d}); t += d; } out.len = t; return out; }
function vlead(pcs, prev, lo, hi, n) {
 const cand = []; for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) cand.push(m);
 if (!prev || prev.length !== n) { const s = Math.max(0, Math.floor((cand.length - n) / 2)); return cand.slice(s, s + n); }
 const out = [], used = {};
 for (let i = n - 1; i >= 0; i--) { let best = cand[0], bs = 1e9; for (const c of cand) { if (out.includes(c)) continue; const s = Math.abs(c - prev[i]) + (used[c % 12] ? 2.6 : 0) + (i === n - 1 && c % 12 === pcs[0] ? -.4 : 0); if (s < bs) { bs = s; best = c; } } out.push(best); used[best % 12] = 1; }
 return out.sort((a, b) => a - b);
}
const lowNote = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12; // lowest midi >= lo with that pitch class

// ---------- generated buffers (shared per context) ----------
function makeNoise(ctx, sec) { const n = Math.floor(ctx.sampleRate*sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = rng(9); for (let i = 0; i < n; i++) d[i] = r()*2 - 1; return b; }
function makeCrackle(ctx, sec) { const n = Math.floor(ctx.sampleRate*sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = rng(21); for (let i = 0; i < n; i++) if (r() < .0022) { const a = (r()*.8 + .2)*(r() < .5 ? -1 : 1), len = 1 + (r()*9 | 0); for (let k = 0; k < len && i + k < n; k++) d[i + k] = a*(1 - k / len)*(k & 1 ? -1 : 1); i += len; } return b; }
function makeBrown(ctx, sec) { const sr = ctx.sampleRate, n = Math.floor(sr*sec), m = Math.floor(sr*.05), x = new Float32Array(n + m), r = rng(5); let y = 0, ss = 0;
 for (let i = 0; i < n + m; i++) { y = y*.996 + (r()*2 - 1)*.06; x[i] = y; ss += y*y; }
 const k = .5 / Math.sqrt(ss / (n + m)), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (i < m ? x[i]*(i / m) + x[n + i]*(1 - i / m) : x[i])*k; return b; }
function makePink(ctx, sec) { const sr = ctx.sampleRate, n = Math.floor(sr * sec), m = Math.floor(sr * .05), x = new Float32Array(n + m), r = rng(17); let b0 = 0, b1 = 0, b2 = 0, ss = 0;
 for (let i = 0; i < n + m; i++) { const w = r() * 2 - 1; b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; x[i] = b0 + b1 + b2 + w * .1848; ss += x[i] * x[i]; }
 const k = .5 / Math.sqrt(ss / (n + m)), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (i < m ? x[i] * (i / m) + x[n + i] * (1 - i / m) : x[i]) * k; return b; }
function makeGrit(ctx, sec) { const sr = ctx.sampleRate, n = Math.floor(sr*sec), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), r = rng(13); let e = 0, nx = 0; for (let i = 0; i < n; i++) { if (i >= nx) { e = .25 + r()*.75; nx = i + (sr*(.002 + r()*.006) | 0); } e *= .9994; d[i] = (r()*2 - 1)*e; } return b; }
function makeIR(ctx, sec) {
 const sr = ctx.sampleRate, n = Math.floor(sr*sec), b = ctx.createBuffer(2, n, sr);
 for (let ch = 0; ch < 2; ch++) {
  const d = b.getChannelData(ch), r = rng(ch ? 77 : 33); let lp = 0;
  for (let i = 0; i < n; i++) { const x = i / sr, c = .92 - .78*Math.min(1, x / sec); lp += c*((r()*2 - 1) - lp); const pre = x < .012 ? x / .012 : 1; d[i] = lp*Math.exp(-3.1*x)*pre*(1 - i / n); }
  for (let k = 0; k < 7; k++) { const at = Math.floor(sr*(.011 + .013*k + r()*.009)); if (at < n) d[at] += (r() < .5 ? -1 : 1)*(.5 - k*.05); }
 }
 return b;
}
function clipCurve() { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1)*2 - 1, a = Math.abs(x); c[i] = Math.sign(x)*(a < .6 ? a : .6 + .36*Math.tanh((a - .6) / .36)); } return c; }

// ---------- the engine ----------
function createEngine(ctx, dest, opt) {
 opt = opt || {};
 const E = {ctx, intensity: 0, stats: {started: 0, thinned: 0, stolen: 0, dropped: 0, peakVoices: 0}};
 E.noise = makeNoise(ctx,2.2); E.crackle = makeCrackle(ctx,1.6); E.ir = makeIR(ctx,2.6); E.brown = makeBrown(ctx,2.5); E.pink = makePink(ctx,2.5); E.grit = makeGrit(ctx,1.6);
 const satC = new Float32Array(1024); for (let i = 0; i < 1024; i++) satC[i] = .6*Math.tanh(3.5*(i / 511.5 - 1)) / Math.tanh(3.5);
 let made = 0;
 const G = v => { const g = ctx.createGain(); g.gain.value = v; made++; return g; };
 E.G = G;
 const sum = G(1), comp = ctx.createDynamicsCompressor(), trim = G(.72), lim = ctx.createDynamicsCompressor(), clip = ctx.createWaveShaper();
 comp.threshold.value = -20; comp.knee.value = 16; comp.ratio.value = 2.6; comp.attack.value = .012; comp.release.value = .3;
 lim.threshold.value = -5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .12;
 clip.curve = clipCurve(); clip.oversample = '2x';
 E.hide = G(1); E.vol = G(.7);
 sum.connect(comp); comp.connect(trim); trim.connect(lim); lim.connect(clip); clip.connect(E.hide); E.hide.connect(E.vol); E.vol.connect(dest || ctx.destination);
 const conv = ctx.createConvolver(); conv.buffer = E.ir; const revOut = G(.9); conv.connect(revOut); revOut.connect(sum);
 E.mDry = G(1); E.mWet = G(1); const mVol = G(.55), mVolW = G(.55), duck = G(1), duckW = G(1);
 E.mDry.connect(mVol); mVol.connect(duck); duck.connect(sum); E.mWet.connect(mVolW); mVolW.connect(duckW); duckW.connect(conv);
 E.stDry = G(1); E.stWet = G(1); const stV = G(.55), stVW = G(.55);
 E.stDry.connect(stV); stV.connect(sum); E.stWet.connect(stVW); stVW.connect(conv);
 E.sDry = G(1); E.sWet = G(1); const sVol = G(.7), sVolW = G(.7);
 E.sDry.connect(sVol); sVol.connect(sum); E.sWet.connect(sVolW); sVolW.connect(conv);
 const ramp = (p, v, tc) => { const t = ctx.currentTime; p.cancelScheduledValues(t); p.setTargetAtTime(v, t, tc || .05); };
 E.apply = s => {
  ramp(E.vol.gain, s.muted ? 0 : s.master,.04);
  for (const g of [mVol, mVolW, stV, stVW]) ramp(g.gain, s.music,.08);
  ramp(sVol.gain, s.sfx,.04); ramp(sVolW.gain, s.sfx,.04);
 };
 E.duck = (t, hold, depth) => { for (const g of [duck, duckW]) { const p = g.gain; p.cancelScheduledValues(t); p.setTargetAtTime(depth, t,.08); p.setTargetAtTime(1, t + hold,.7); } };
 E.setHidden = h => { const p = E.hide.gain, t = ctx.currentTime; p.cancelScheduledValues(t); p.setTargetAtTime(h ? 0 : 1, t, h ? .07 : .15); };

 // Finished notes are disconnected explicitly (graves), so the render thread never keeps pulling dead chains until GC.
 let curV = null, curN = null; const graves = [];
 const reg = (node, t0, t1) => { made++; node.start(t0); node.stop(t1); if (curV) curV.src.push([node, t1]); if (curN && t1 > curN.e) curN.e = t1; return node; };
 E.osc = (type, f, t0, t1, det) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; return reg(o, t0, t1); };
 E.nz = (t0, t1, rate, buf) => { const s = ctx.createBufferSource(); made++; s.buffer = buf || E.noise; s.loop = true; if (rate) s.playbackRate.value = rate; s.start(t0, Math.random()*1.5); s.stop(t1); if (curV) curV.src.push([s, t1]); if (curN && t1 > curN.e) curN.e = t1; return s; };
 E.flt = (type, f, q, g) => { const b = ctx.createBiquadFilter(); made++; b.type = type; b.frequency.value = f; try { b.frequency.automationRate = 'k-rate'; } catch (e) {} if (q != null) b.Q.value = q; if (g != null) b.gain.value = g; return b; };
 E.sat = () => { const w = ctx.createWaveShaper(); made++; w.curve = satC; return w; };
 E.dly = mx => { made++; return ctx.createDelay(mx || .05); };
 E.pan = v => { if (!ctx.createStereoPanner) return G(1); const p = ctx.createStereoPanner(); p.pan.value = clamp(v,-1,1); return p; };
 E.nOut = (dst, wet, pan) => { const g = G(0); let o = g; if (pan) { o = E.pan(pan); g.connect(o); } o.connect(dst.d); if (curN) curN.o.push(o); if (wet > 0 && dst.w) { const w = G(wet); o.connect(w); w.connect(dst.w); if (curN) curN.o.push(w); } return g; };
 E.note = (f, a, b, c, d, e, g, h) => { curN = {e: 0, o: []}; try { f(E, a, b, c, d, e, g, h); } finally { if (curN.o.length) graves.push(curN); curN = null; } };
 const sweepGraves = () => { const now = ctx.currentTime - .05; let j = 0; for (let i = 0; i < graves.length; i++) { const g = graves[i]; if (g.e < now) { for (const n of g.o) try { n.disconnect(); } catch (e) {} } else graves[j++] = g; } graves.length = j; };
 E.graves = () => graves.length;

 const voices = [], lastAt = {}, pend = []; let tok = 14, tokT = 0;
 E.DEFER = .25; E.RATE = opt.rate || 60; // voice starts per second (token bucket); priority >= 4 always passes
 E.VOICE_CAP = opt.voiceCap || 24; E.BUDGET = opt.budget || 320;
 E.voices = () => { const t = ctx.currentTime; let n = 0; for (const v of voices) if (v.t1 > t && v.t0 <= t + .05) n++; return n; };
 const kill = (v, t) => { E.stats.stolen++; v.gv.e = t + .05; const p = v.gate.gain; p.cancelScheduledValues(t); p.setValueAtTime(v.g, t); p.linearRampToValueAtTime(0, t + .035); for (const [s, st] of v.src) if (st > t + .045) try { s.stop(t + .045); } catch (e) {} v.t1 = t + .045; };
 E.sfx = (name, p) => {
  const R = E.SFX[name]; if (!R) return false;
  p = p || {};
  const t = Math.max(ctx.currentTime, p.at != null ? p.at : ctx.currentTime + .004) + Math.max(0, +p.delay || 0);
  if (t > ctx.currentTime + E.DEFER) { if (pend.length < 512) pend.push([t, name, p]); return true; } // built just in time by advance()
  const la = lastAt[name];
  if (la != null && t >= la && t - la < R.gap) { E.stats.thinned++; return false; }
  const g = clamp(p.gain == null ? 1 : +p.gain || 0,0,1.5)*R.vol; if (g < .004) return false;
  if (t > tokT) { tok = Math.min(14, tok + (t - tokT)*E.RATE); tokT = t; }
  if (tok < 1 && R.pri < 4) { E.stats.thinned++; return false; } tok = Math.max(0, tok - 1);
  for (let i = voices.length - 1; i >= 0; i--) if (voices[i].t1 <= t) voices.splice(i,1);
  let same = 0, oldest = null; for (const v of voices) if (v.n === name && v.t1 > t) { same++; if (!oldest || v.t0 < oldest.t0) oldest = v; }
  if (same >= R.cap) { kill(oldest, t); voices.splice(voices.indexOf(oldest),1); }
  for (let k = 0; k < 8; k++) {
   let sw = R.w || 16; for (const v of voices) sw += v.w;
   if (voices.length < E.VOICE_CAP && sw <= E.BUDGET) break;
   let w = null; for (const v of voices) if (!w || v.pri < w.pri || v.pri === w.pri && v.g*(v.t1 - t) < w.g*(w.t1 - t)) w = v;
   if (!w || w.pri > R.pri) { E.stats.dropped++; return false; }
   kill(w, t); voices.splice(voices.indexOf(w),1);
  }
  const gate = G(g), pn = E.pan(p.pan || 0), gv = {e: 0, o: [pn]};
  gate.connect(pn); pn.connect(E.sDry); if (R.wet) { const w = G(R.wet); pn.connect(w); w.connect(E.sWet); gv.o.push(w); }
  const v = {n: name, t0: t, t1: t + 1, g, pri: R.pri, gate, src: [], gv, w: 0}, m0 = made;
  curV = v;
  try { v.t1 = t + R.f(E, t, gate, clamp(p.pitch || 1,.25,4), p); } finally { curV = null; }
  for (const s of v.src) if (s[1] > v.t1) v.t1 = s[1];
  v.w = R.w = made - m0 + 3;
  gv.e = v.t1 + .05; graves.push(gv); voices.push(v); lastAt[name] = t; E.stats.started++; E.last = v;
  let n = 0; for (const x of voices) if (x.t0 <= t && x.t1 > t) n++;
  if (n > E.stats.peakVoices) E.stats.peakVoices = n;
  return true;
 };

 // ----- loops (engines, passing craft): continuous voices outside the one-shot caps; pitch via detune
 E.loop = (name, p) => {
  const R = E.LOOPS[name]; if (!R) return null; p = p || {};
  const out = G(0), pn = E.pan(p.pan || 0), w = G(R.wet || .15), mix = G(R.vol), L = {out, pn, src: [], det: [], extra: [w, mix]};
  out.connect(pn); pn.connect(E.sDry); pn.connect(w); w.connect(E.sWet); mix.connect(out);
  const keep = curV; curV = L; try { R.f(E, mix, L); } finally { curV = keep; }
  const c = 1200 * Math.log2(clamp(+p.pitch || 1, .25, 4)); for (const d of L.det) d.value = c;
  E.loopSet(L, {gain: p.gain == null ? 1 : p.gain}, .6); return L;
 };
 const glide = (q, v, t, r) => { q.cancelScheduledValues(t); q.setValueAtTime(q.value, t); q.linearRampToValueAtTime(v, t + r); };
 E.loopSet = (L, p, rt) => {
  const t = ctx.currentTime, r = rt || .12;
  if (p.gain != null) glide(L.out.gain, clamp(+p.gain || 0, 0, 1.5), t, r);
  if (p.pitch != null) { const c = 1200 * Math.log2(clamp(+p.pitch || 1, .25, 4)); for (const d of L.det) glide(d, c, t, r); }
  if (p.pan != null && L.pn.pan) glide(L.pn.pan, clamp(+p.pan || 0, -1, 1), t, r);
 };
 E.loopStop = (L, f) => {
  const t = ctx.currentTime; f = Math.max(.02, f == null ? .5 : +f || 0); glide(L.out.gain, 0, t, f);
  for (const [s] of L.src) try { s.stop(t + f + .05); } catch (e) {}
  graves.push({e: t + f + .1, o: [L.pn].concat(L.extra)});
 };
 E.players = []; E.scene = null;
 E.playScene = (name, o) => {
  const def = E.SCENES[name]; if (!def) return null;
  const t = ctx.currentTime + .06, fade = o && o.fade != null ? o.fade : 1.6;
  for (const pl of E.players) if (!pl.once && !pl.dead) pl.stop(t,1.8);
  const pl = new Player(E, def, o || {}, t, fade, false); E.players.push(pl); E.scene = pl; return pl;
 };
 E.stopMusic = fade => { const t = ctx.currentTime + .02; for (const pl of E.players) if (!pl.once && !pl.dead) pl.stop(t, fade == null ? 1.8 : fade); E.scene = null; };
 E.stinger = (name, o) => {
  const def = E.STINGERS[name]; if (!def) return null;
  const t = ctx.currentTime + .05 + (o && o.delay || 0), pl = new Player(E, def, o || {}, t,0, true);
  E.players.push(pl); E.duck(t, def.hold || 3, def.duck == null ? .3 : def.duck); pl.advance(t + .15); return pl;
 };
 E.setIntensity = x => { E.intensity = clamp(+x || 0,0,1); for (const pl of E.players) if (!pl.dead && pl.def.layers) pl.setLayers(); };
 E.advance = until => { sweepGraves();
  if (pend.length) { pend.sort((a, b) => a[0] - b[0]); let k = 0; while (k < pend.length && pend[k][0] <= until + .1) k++; for (const [t, n, p] of pend.splice(0, k)) E.sfx(n, Object.assign({}, p, {at: t, delay: 0})); }
  for (let i = E.players.length - 1; i >= 0; i--) { const pl = E.players[i]; pl.advance(until); if (pl.gone(ctx.currentTime)) { pl.free(); E.players.splice(i,1); } } };
 E.SFX = SFX; E.LOOPS = LOOPS; E.SCENES = SCENES; E.STINGERS = STINGERS;
 return E;
}

function Player(E, def, o, t, fade, once) {
 const ctx = E.ctx;
 this.E = E; this.def = def; this.once = once; this.fac = FLAVOR[o.faction] ? o.faction : 'none'; this.flv = FLAVOR[this.fac];
 this.out = E.G(fade > 0 ? 0 : 1); this.outW = E.G(fade > 0 ? 0 : 1);
 this.out.connect(once ? E.stDry : E.mDry); this.outW.connect(once ? E.stWet : E.mWet);
 if (fade > 0) for (const g of [this.out, this.outW]) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fade); }
 const nL = def.layers || 1; this.L = []; this.lv = [];
 for (let i = 0; i < nL; i++) { const d = E.G(i ? 0 : 1), w = E.G(i ? 0 : 1); d.connect(this.out); w.connect(this.outW); this.L.push({d, w}); this.lv.push({v: i ? 0 : 1, tg: i ? 0 : 1, t: t}); }
 this.t0 = t; this.sec = null; this.i = 0; this.dead = 0; this.end = once ? Infinity : 0;
 this.rnd = rng((o.seed || 0) + (def.seed || 1)*977 + (this.fac.length*31));
 this.st = {}; this.tr = (def.tr || 0) + (this.flv.tr || 0);
 if (nL > 1) this.setLayers(true);
 this.advance(t + .12);
}
Player.prototype.setLayers = function (now) {
 const E = this.E, t = E.ctx.currentTime, x = E.intensity, f = this.def.layers;
 for (let i = 1; i < f; i++) {
  const tg = i === 1 ? smooth((x - .18) / .3) : smooth((x - .55) / .3), l = this.lv[i];
  l.v = this.level(i, t); l.tg = tg; l.t = t;
  for (const g of [this.L[i].d.gain, this.L[i].w.gain]) { g.cancelScheduledValues(t); if (now) g.setValueAtTime(tg, t); else g.setTargetAtTime(tg, t,.9); }
 }
};
Player.prototype.level = function (i, t) { const l = this.lv[i]; return l.tg + (l.v - l.tg)*Math.exp(-Math.max(0, t - l.t) / .9); };
Player.prototype.stop = function (t, fade) {
 if (this.dead) return; this.dead = t + fade + .1;
 for (const g of [this.out.gain, this.outW.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade); }
};
Player.prototype.gone = function (now) { return this.dead ? now > this.dead + 3 : this.once && now > this.end + 4; };
Player.prototype.free = function () { try { this.out.disconnect(); this.outW.disconnect(); } catch (e) {} };
Player.prototype.advance = function (until) {
 const E = this.E;
 for (let guard = 0; guard < 64; guard++) {
  if (this.dead && this.t0 > this.dead) return;
  if (!this.sec) {
   if (this.once && this.played) return;
   const s = new Sec(); this.def.next(this, s); s.ev.sort((a, b) => a.t - b.t); this.sec = s; this.i = 0; this.spb = 60 / (s.bpm || this.def.bpm || 100) / (this.flv.tempo || 1); this.played = 1;
   if (this.once) this.end = this.t0 + s.len*this.spb;
  }
  const q = this.sec.ev, spb = this.spb;
  while (this.i < q.length) {
   const e = q[this.i], at = this.t0 + e.t*spb; if (at > until) break; this.i++;
   if (this.dead && at > this.dead) continue;
   if (e.L && this.level(e.L, at) < .015 && this.lv[e.L].tg < .015) continue;
   E.note(e.f, at, e.d*spb, e.m + (e.f.perc ? 0 : this.tr), e.v, this.L[e.L || 0], e.x || {});
  }
  const end = this.t0 + this.sec.len*spb;
  if (this.i >= q.length && end <= until) { this.t0 = end; this.sec = null; if (this.once) return; continue; }
  return;
 }
};
function Sec() { this.ev = []; this.len = 0; }
Sec.prototype.n = function (t, d, f, m, v, L, x) { this.ev.push({t, d, f, m, v, L: L || 0, x}); return this; };

// ---------- instruments: f(E, time, seconds, midi, velocity 0..1, layer {d,w}, extra) ----------
function adsr(p, t, a, pk, s, dk, t1, r) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(pk, t + a); if (s < 1) p.setTargetAtTime(pk*s, t + a, dk); p.setTargetAtTime(0, Math.max(t1, t + a), r / 4); }
const sweep = (p, a, b, t, d) => { p.setValueAtTime(a, t); p.exponentialRampToValueAtTime(b, t + d); };
function vib(E, t, end, rate, cents, delay, os) { const l = E.osc('sine', rate*(.94 + Math.random()*.12), t, end), g = E.G(0), hz = os[0].frequency.value*cents*.000578; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(hz, t + delay); l.connect(g); for (const o of os) g.connect(o.frequency); }
const I = {};
I.brass = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), br = x.br || 1, t1 = t + d, r = x.r || .22, end = t1 + r + .05, sfz = x.sfz, a = x.a || (sfz ? .014 : .05);
 const out = E.nOut(dst, x.wet == null ? .32 : x.wet, x.pan), lp = E.flt('lowpass', f*1.1, x.q || 1.3), F = lp.frequency;
 F.setValueAtTime(f*1.1, t); F.linearRampToValueAtTime(Math.min(9000, f*(2.6 + 6.5*v)*br), t + a + .02);
 F.setTargetAtTime(Math.min(7000, f*(1.5 + 2.8*v)*br), t + a + .02, sfz ? .06 : .28); F.setTargetAtTime(f*1.15, t1, r / 3);
 const os = x.one ? [E.osc('sawtooth', f, t, end)] : [E.osc('sawtooth', f, t, end,-4), E.osc('sawtooth', f, t, end,5)];
 for (const o of os) { o.frequency.setValueAtTime(f*.986, t); o.frequency.linearRampToValueAtTime(f, t + .06); o.connect(lp); }
 if (d > .6 && x.vib !== 0) vib(E, t, end,5.2, x.vib || 8,.4, os);
 lp.connect(out); adsr(out.gain, t, a,.17*v*(x.lv || 1), sfz ? .38 : .8, sfz ? .07 : .3, t1, r);
};
I.horn = (E, t, d, m, v, dst, x) => I.brass(E, t, d, m, v, dst, Object.assign({br: .55, a: .075, vib: 6, wet: .42, lv: 1.15}, x));
I.tpt = (E, t, d, m, v, dst, x) => I.brass(E, t, d, m, v, dst, Object.assign({br: 1.2, a: .035, lv: .85}, x));
I.tbn = (E, t, d, m, v, dst, x) => I.brass(E, t, d, m, v, dst, Object.assign({br: .8, q: 1.8, a: .045, lv: 1.1}, x));
I.str = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), a = x.a || .32, r = x.r || .7, t1 = t + d, end = t1 + r + .05;
 const out = E.nOut(dst, x.wet == null ? .45 : x.wet, x.pan), lp = E.flt('lowpass', Math.min(7500, f*(x.br || 5)),.5);
 const os = [E.osc('sawtooth', f, t, end,-9), E.osc('sawtooth', f, t, end,2), E.osc('sawtooth', f, t, end,10)];
 if (x.vib !== 0) vib(E, t, end,5.4, x.vib || 7,.3, os); for (const o of os) o.connect(lp);
 let last = lp;
 if (x.trem) { const tg = E.G(.55), l = E.osc('sine', x.trem, t, end), lg = E.G(.45); l.connect(lg); lg.connect(tg.gain); lp.connect(tg); last = tg; }
 last.connect(out); adsr(out.gain, t, a,.06*v,.9,.5, t1, r);
};
I.stac = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), end = t + d + .14, out = E.nOut(dst, x.wet == null ? .22 : x.wet, x.pan), lp = E.flt('lowpass',8000,.9), F = lp.frequency;
 F.setValueAtTime(Math.min(9000, f*(x.br || 10)), t); F.setTargetAtTime(f*2.4, t + .01, x.dry ? .03 : .06);
 for (const c of [-7,7]) E.osc('sawtooth', f, t, end, c).connect(lp);
 lp.connect(out); const g = out.gain; g.setValueAtTime(0, t); g.linearRampToValueAtTime(.085*v, t + .006); g.setTargetAtTime(.04*v, t + .006, x.dry ? .025 : .05); g.setTargetAtTime(0, t + d,.025);
};
I.harp = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), dec = x.dec || 1.4, end = t + dec*1.3, out = E.nOut(dst, x.wet == null ? .5 : x.wet, x.pan), lp = E.flt('lowpass', Math.min(9000, f*8),.7);
 lp.frequency.setTargetAtTime(f*2, t + .005, dec*.25);
 const o = E.osc('triangle', f, t, end), o2 = E.osc('sine', f*2, t, end), g2 = E.G(.3); g2.gain.setTargetAtTime(0, t, dec*.15);
 o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(out);
 const g = out.gain; g.setValueAtTime(0, t); g.linearRampToValueAtTime(.15*v, t + .004); g.setTargetAtTime(0, t + .004, dec*.3);
};
I.pizz = (E, t, d, m, v, dst, x) => I.harp(E, t, d, m, v*1.2, dst, Object.assign({dec: .42, wet: .3}, x));
I.cel = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), dec = x.dec || 1.1, end = t + dec*1.4, out = E.nOut(dst, x.wet == null ? .55 : x.wet, x.pan);
 const car = E.osc('sine', f, t, end), mod = E.osc('sine', f*(x.ratio || 4), t, end), mg = E.G(f*(x.idx || 1.5));
 mg.gain.setTargetAtTime(f*.08, t,.1); mod.connect(mg); mg.connect(car.frequency); car.connect(out);
 const g = out.gain; g.setValueAtTime(0, t); g.linearRampToValueAtTime(.1*v, t + .003); g.setTargetAtTime(0, t + .003, dec*.3);
};
const FORM = {o: [[430,6,1], [820,8,.5], [2700,10,.12]], a: [[700,5,1], [1150,7,.55], [2600,10,.15]], u: [[320,6,1], [720,8,.3], [2400,10,.07]]};
I.choir = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), a = x.a || .7, r = x.r || 1.1, t1 = t + d, end = t1 + r + .05, out = E.nOut(dst, x.wet == null ? .6 : x.wet, x.pan), src = E.G(1);
 const os = [E.osc('sawtooth', f, t, end,-11), E.osc('sawtooth', f, t, end,9)]; vib(E, t, end,4.7,10,.45, os); for (const o of os) o.connect(src);
 for (const [ff, q, gg] of FORM[x.vow || 'o']) { const b = E.flt('bandpass', ff, q), g = E.G(gg*2.6); src.connect(b); b.connect(g); g.connect(out); }
 adsr(out.gain, t, a,.11*v,.92,.6, t1, r);
};
I.timp = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), dec = x.dec || .85, out = E.nOut(dst, x.wet == null ? .38 : x.wet, x.pan);
 const o = E.osc('sine', f*1.07, t, t + dec*6); sweep(o.frequency, f*1.07, f, t,.08); o.connect(out);
 for (const [k, a, dk] of [[1.505,.42,.45], [1.99,.24,.3], [2.44,.12,.2]]) { const p = E.osc('sine', f*k, t, t + dec*2.5), g = E.G(a); g.gain.setTargetAtTime(0, t, dec*dk); p.connect(g); g.connect(out); }
 const n = E.nz(t, t + .07), bp = E.flt('bandpass', Math.min(2800, f*7),.9), ng = E.G(.55); ng.gain.setTargetAtTime(0, t,.014); n.connect(bp); bp.connect(ng); ng.connect(out);
 const g = out.gain; g.setValueAtTime(0, t); g.linearRampToValueAtTime(.4*v, t + .004); g.setTargetAtTime(0, t + .004, dec);
};
I.snare = (E, t, d, m, v, dst, x) => {
 const out = E.nOut(dst, x.wet == null ? .3 : x.wet, x.pan), n = E.nz(t, t + .4), hp = E.flt('highpass',1500,.7), pk = E.flt('peaking',4300,1,5);
 n.connect(hp); hp.connect(pk); pk.connect(out);
 const b = E.osc('triangle',215, t, t + .12), bg = E.G(.7); sweep(b.frequency,215,150, t,.05); bg.gain.setTargetAtTime(0, t,.022); b.connect(bg); bg.connect(out);
 const g = out.gain; g.setValueAtTime(0, t); g.linearRampToValueAtTime(.24*v, t + .002); g.setTargetAtTime(0, t + .002, x.dec || .05);
};
I.snare.perc = true;
I.drum = (E, t, d, m, v, dst, x) => {
 const f = x.f || 55, dec = x.dec || .3, out = E.nOut(dst, x.wet == null ? .3 : x.wet, x.pan);
 const o = E.osc('sine', f*2.3, t, t + dec*5); sweep(o.frequency, f*2.3, f, t,.07); o.connect(out);
 const n = E.nz(t, t + .05), lp = E.flt('lowpass',1100,.7), ng = E.G(.6); ng.gain.setTargetAtTime(0, t,.01); n.connect(lp); lp.connect(ng); ng.connect(out);
 const g = out.gain; g.setValueAtTime(0, t); g.linearRampToValueAtTime(.4*v, t + .003); g.setTargetAtTime(0, t + .003, dec);
};
I.drum.perc = true;
I.cym = (E, t, d, m, v, dst, x) => {
 const dec = x.dec || 1.3, sw = x.sw ? d : 0, out = E.nOut(dst, x.wet == null ? .5 : x.wet, x.pan), n = E.nz(t, t + sw + dec*4.5), hp = E.flt('highpass',5200,.6), pk = E.flt('peaking',9000,.8,6);
 n.connect(hp); hp.connect(pk); pk.connect(out);
 const g = out.gain; g.setValueAtTime(0, t);
 if (sw) { g.linearRampToValueAtTime(.002, t + .01); g.exponentialRampToValueAtTime(.1*v, t + sw); g.setTargetAtTime(0, t + sw,.1); }
 else { g.linearRampToValueAtTime(.12*v, t + .003); g.setTargetAtTime(.045*v, t + .003,.07); g.setTargetAtTime(0, t + .12, dec); }
};
I.cym.perc = true;
I.metal = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), dec = x.dec || .22, out = E.nOut(dst, x.wet == null ? .35 : x.wet, x.pan);
 const car = E.osc('sine', f, t, t + dec*5), mod = E.osc('sine', f*1.414, t, t + dec*5), mg = E.G(f*2.4); mg.gain.setTargetAtTime(f*.3, t, dec*.5);
 mod.connect(mg); mg.connect(car.frequency); const hp = E.flt('highpass',280,.7); car.connect(hp); hp.connect(out);
 const g = out.gain; g.setValueAtTime(0, t); g.linearRampToValueAtTime(.09*v, t + .002); g.setTargetAtTime(0, t + .002, dec);
};
I.flute = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), r = x.r || .25, t1 = t + d, end = t1 + r + .05, out = E.nOut(dst, x.wet == null ? .5 : x.wet, x.pan);
 const o = E.osc('sine', f, t, end), o2 = E.osc('triangle', f, t, end,3), g2 = E.G(.35); vib(E, t, end,5.1,11,.3, [o, o2]);
 o.connect(out); o2.connect(g2); g2.connect(out);
 const n = E.nz(t, end), bp = E.flt('bandpass', Math.min(8000, f*2),2), ng = E.G(.14); n.connect(bp); bp.connect(ng); ng.connect(out);
 adsr(out.gain, t, x.a || .08,.09*v,.85,.3, t1, r);
};
I.reed = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), r = x.r || .2, t1 = t + d, end = t1 + r + .05, out = E.nOut(dst, x.wet == null ? .45 : x.wet, x.pan);
 const o = E.osc('square', f, t, end), lp = E.flt('lowpass', Math.min(5000, f*3.2),.9); vib(E, t, end,5,7,.35, [o]);
 o.connect(lp); lp.connect(out); adsr(out.gain, t, x.a || .06,.045*v,.85,.3, t1, r);
};
I.sub = (E, t, d, m, v, dst, x) => { const f = mtof(m), t1 = t + d, r = x.r || .3, out = E.nOut(dst,0); E.osc('sine', f, t, t1 + r + .05).connect(out); adsr(out.gain, t, x.a || .02,.2*v,.85,.3, t1, r); };
I.drone = (E, t, d, m, v, dst, x) => {
 const f = mtof(m), t1 = t + d, r = x.r || 2.5, end = t1 + r + .05, out = E.nOut(dst, x.wet == null ? .5 : x.wet), lp = E.flt('lowpass',320,2.5);
 const l = E.osc('sine', x.lfo || .07, t, end), lg = E.G(x.sweep || 260); l.connect(lg); lg.connect(lp.frequency);
 for (const c of [-6,6]) E.osc('sawtooth', f, t, end, c).connect(lp);
 lp.connect(out); adsr(out.gain, t, x.a || 2.2,.07*v,1,1, t1, r);
};
I.steam = (E, t, d, m, v, dst, x) => {
 const out = E.nOut(dst, x.wet == null ? .7 : x.wet, x.pan), n = E.nz(t, t + d + 1.2), bp = E.flt('bandpass', x.f || 700,.9);
 bp.frequency.setValueAtTime(x.f || 700, t); bp.frequency.linearRampToValueAtTime((x.f || 700)*1.8, t + d);
 n.connect(bp); bp.connect(out); const g = out.gain; g.setValueAtTime(0, t); g.linearRampToValueAtTime(.05*v, t + d*.6); g.setTargetAtTime(0, t + d*.6, d*.25);
};

// ---------- sound effects: f(E, t, out, pitch, opts) -> seconds ----------
// v1.2: voiced after measured references (energy in the mids, bright onsets that darken, long natural tails).
const ENV = (E, t, a, pk, tau, hold) => { const g = E.G(0), p = g.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(pk, t + a); if (hold) p.setValueAtTime(pk, t + a + hold); p.setTargetAtTime(0, t + a + (hold || 0), tau); return g; };
const jit = k => 1 + (Math.random() - .5) * k;
const life = (a, hold, tau) => a + (hold || 0) + tau * (tau > .5 ? 5 : 6);
function nzf(E, out, t, dur, type, f0, f1, q, a, pk, tau, hold, buf, rate) {
 const n = E.nz(t, t + Math.max(dur, life(a, hold, tau)), rate, buf), b = E.flt(type, f0, q); if (f1 && f1 !== f0) sweep(b.frequency, f0, f1, t, dur * .8);
 const g = ENV(E, t, a, pk, tau, hold); n.connect(b); b.connect(g); g.connect(out); return b;
}
function tone(E, out, t, dur, type, f0, f1, a, pk, tau, sd, hold) {
 const o = E.osc(type, f0, t, t + Math.max(dur, life(a, hold, tau))); if (f1 && f1 !== f0) sweep(o.frequency, f0, f1, t, sd || dur * .5);
 const g = ENV(E, t, a, pk, tau, hold); o.connect(g); g.connect(out); return o;
}
// sub boom: sine sweep into soft saturation
function boom(E, out, t, f0, f1, sd, pk, tau) { const o = E.osc('sine', f0, t, t + sd + life(.003, 0, tau)); sweep(o.frequency, f0, f1, t, sd); const g = ENV(E, t, .003, pk, tau), sh = E.sat(); o.connect(g); g.connect(sh); sh.connect(out); }
// rumble: brown noise through a closing low-pass; am adds a slow (or fast, rate) swell
function rumble(E, out, t, dur, f0, f1, pk, a, tau, hold, am, rate, buf) {
 const end = t + Math.max(dur, life(a, hold, tau)), n = E.nz(t, end, 1, buf || E.brown), lp = E.flt('lowpass', f0, .8); if (f1 !== f0) sweep(lp.frequency, f0, f1, t, dur * .9);
 const g = ENV(E, t, a, pk, tau, hold); n.connect(lp);
 if (am) { const m = E.G(1 - am * .5), r = rate || .7, lg = E.G(am * .5); for (const k of [1, 2.9]) E.osc('sine', r * k * jit(.3), t, end).connect(lg); lg.connect(m.gain); lp.connect(m); m.connect(g); } else lp.connect(g);
 g.connect(out);
}
const crunch = (E, out, t, f0, f1, dur, pk, tau) => nzf(E, out, t, dur, 'bandpass', f0, f1, .6, .002, pk * 2.8, tau, 0, E.grit);
const snapT = (E, out, t, pk, f) => nzf(E, out, t, .03, 'highpass', f || 2200, 0, .7, .0006, pk, .008);
const thock = (E, out, t, f, pk, tau) => tone(E, out, t, tau * 6, 'sine', f, f * .5, .002, pk, tau, tau * 1.2);
function metalHit(E, out, t, base, pk, tau) {
 const c = E.osc('sine', base, t, t + life(0, 0, tau)), m = E.osc('sine', base * 1.41, t, t + life(0, 0, tau)), mg = E.G(base * 2.2); mg.gain.setTargetAtTime(base * .3, t, tau * .6); m.connect(mg); mg.connect(c.frequency);
 const g = ENV(E, t, .002, pk * 1.6, tau); c.connect(g); g.connect(out); tone(E, out, t, tau * 4, 'sine', base * 2.76 * jit(.04), 0, .002, pk * .5, tau * .6);
}
// feed-forward comb: peaks every 1/d Hz; the delay drifts d0 -> d1 so the teeth slide down (the blaster "ring")
function comb(E, src, t, d0, d1, sd, g) { const o = E.G(1), dl = E.dly(), k = E.G(g); dl.delayTime.setValueAtTime(d0, t); dl.delayTime.linearRampToValueAtTime(d1, t + sd); src.connect(o); src.connect(dl); dl.connect(k); k.connect(o); return o; }
// a discharge: white noise -> comb -> darkening low-pass -> envelope (bright onset that closes to the mids)
function bolt(E, out, t, o) {
 const end = t + life(o.a, o.hold, o.tau), n = E.nz(t, end), c = comb(E, n, t, o.d0, o.d1, o.sd || 1.4, o.g || .9), lp = E.flt('lowpass', o.f0, .7), F = lp.frequency;
 F.setValueAtTime(o.f0, t); F.exponentialRampToValueAtTime(o.f1, t + o.fs); F.exponentialRampToValueAtTime(o.f2, t + o.fs + (o.fl || 1));
 const hp = E.flt('highpass', o.hp || 90, .7), g = ENV(E, t, o.a, o.pk, o.tau, o.hold); c.connect(lp); lp.connect(hp); hp.connect(g); g.connect(out);
}
const body = (E, out, t, dur, f0, f1, q, a, pk, tau, hold) => nzf(E, out, t, dur, 'bandpass', f0, f1, q, a, pk, tau, hold, E.pink);
// a descending zap tone through a band-pass
function zap(E, out, t, type, f0, f1, sd, bp, pk, tau, q) { const b = E.flt('bandpass', bp, q || .8); b.connect(out); tone(E, b, t, sd + tau * 6, type, f0, f1, .002, pk, tau, sd); }

const SFX = {};
const def = (name, gap, cap, pri, vol, wet, f) => { SFX[name] = {gap, cap, pri, vol, wet, f}; };

// --- weapons (turbolaser family: light / medium / heavy share one voice: comb-ringing discharge + zap + mid body)
def('turbolaser_light', .04, 5, 2, 1.1, .12, (E, t, o, p) => {
 p *= jit(.08);
 bolt(E, o, t, {d0: .00098 / p, d1: .00108 / p, sd: 1.2, f0: 6000, f1: 2300, fs: .12, f2: 1100, fl: .9, a: .003, pk: .7, tau: .28, hold: .15, hp: 150});
 const ring = E.flt('lowpass', 3000, .7); ring.connect(o);
 for (const [ty, k, a] of [['sawtooth', 1, .12], ['square', 2, .03]]) tone(E, ring, t, 1, ty, 1020 * p * k, 950 * p * k, .02, a, .2, .9, .06);
 zap(E, o, t, 'sawtooth', 1900 * p, 700 * p, .1, 1500 * p, .2, .07);
 body(E, o, t, .8, 420, 300, .7, .005, 1.5, .24, .15); tone(E, o, t, .5, 'sine', 140 * p, 80 * p, .003, .3, .1, .08); nzf(E, o, t, .8, 'lowpass', 150, 0, .7, .005, .35, .25, 0, E.brown); return 1.5;
});
def('turbolaser', .04, 5, 2, 1.4, .12, (E, t, o, p) => {
 p *= jit(.08);
 bolt(E, o, t, {d0: .00085 / p, d1: .00125 / p, sd: 1.4, f0: 6500, f1: 2200, fs: .18, f2: 950, fl: 1.1, a: .004, pk: .85, tau: .3, hold: .22});
 zap(E, o, t, 'sawtooth', 1150 * p, 260 * p, .14, 1300 * p, .35, .1);
 body(E, o, t, 1.6, 400, 280, .6, .006, 1.7, .3, .22);
 tone(E, o, t, .6, 'sine', 150 * p, 75 * p, .003, .3, .1, .08); nzf(E, o, t, 1, 'lowpass', 150, 0, .7, .005, .4, .3, 0, E.brown); return 2;
});
def('turbolaser_heavy', .05, 4, 3, 1.25, .15, (E, t, o, p) => {
 p *= jit(.06);
 bolt(E, o, t, {d0: .0013 / p, d1: .002 / p, sd: 1.8, f0: 6500, f1: 1500, fs: .2, f2: 750, fl: 1.3, a: .006, pk: .9, tau: .38, hold: .3});
 zap(E, o, t, 'sawtooth', 900 * p, 170 * p, .2, 900 * p, .55, .14);
 body(E, o, t, 2, 340, 230, .6, .008, 1.7, .36, .3); nzf(E, o, t, 1.6, 'lowpass', 200, 0, .7, .008, .75, .42, .04, E.brown);
 boom(E, o, t, 105 * p, 50 * p, .2, .3, .22); snapT(E, o, t, .3, 1800); return 2.2;
});
// starfighter guns: the same family, short and high
def('laser_light', .04, 6, 1, 6, .05, (E, t, o, p) => {
 p *= jit(.1);
 bolt(E, o, t, {d0: .0007 / p, d1: .00078 / p, sd: .3, f0: 4500, f1: 2600, fs: .05, f2: 1800, fl: .3, a: .002, pk: .5, tau: .07, hp: 400});
 zap(E, o, t, 'sawtooth', 2200 * p, 1100 * p, .08, 1600 * p, .6, .065, .9); zap(E, o, t, 'square', 3000 * p, 1400 * p, .07, 2200 * p, .14, .05);
 body(E, o, t, .2, 520, 420, .8, .002, 1.2, .07); return .4;
});
def('point_defense', .04, 4, 1, 1.6, .12, (E, t, o, p) => {
 [[0, 1], [.09 + Math.random() * .02, .7]].forEach(([d, k]) => { const q = p * jit(.1);
  zap(E, o, t + d, 'sawtooth', 2800 * q, 1100 * q, .06, 2000 * q, .4 * k, .07, .7); nzf(E, o, t + d, .1, 'highpass', 2400, 0, .7, .001, .45 * k, .07);
  body(E, o, t + d, .5, 380, 300, .7, .002, .8 * k, .16); tone(E, o, t + d, .2, 'sine', 160 * q, 90 * q, .002, .3 * k, .07, .05); });
 return 1;
});
// ion: bright crack, then a crackling low-mid electric body that swells and sags
function ionBody(E, o, t, p, hold, tau, lo) {
 nzf(E, o, t, .12, 'highpass', 2200, 0, .7, .001, hold > .5 ? .3 : .45, .045);
 nzf(E, o, t, .6, 'bandpass', 1200 * p, 700 * p, .7, .1, 1.3, tau, hold, E.crackle, .9 + Math.random() * .25);
 const lp = E.flt('lowpass', 1300, 1), c = E.osc('sawtooth', 118 * p, t, t + life(.1, hold, tau)), m = E.osc('sine', 31 * p, t, t + life(.1, hold, tau)), mg = E.G(45);
 m.connect(mg); mg.connect(c.frequency); const g = ENV(E, t, .1, .42, tau, hold); c.connect(lp); lp.connect(g); g.connect(o);
 body(E, o, t, .5, 420, 320, .7, .08, lo * 1.4, tau * 1.1, hold); nzf(E, o, t, .5, 'lowpass', 130, 0, .7, .08, lo * .4, tau, hold, E.brown);
}
def('ion', .05, 4, 2, 1.75, .16, (E, t, o, p) => { ionBody(E, o, t, p, .3, .15, .6); zap(E, o, t, 'square', 3200 * p, 900 * p, .1, 2500 * p, .3, .05); return 1.2; });
def('ion_heavy', .06, 3, 3, .9, .2, (E, t, o, p) => {
 ionBody(E, o, t, p * .85, .85, .55, .8);
 bolt(E, o, t + .15, {d0: .0012, d1: .0021, sd: 2.6, f0: 4200, f1: 2600, fs: .4, f2: 1000, fl: 2, a: .3, pk: .7, tau: .7, hold: .4, hp: 250});
 zap(E, o, t, 'square', 2600 * p, 600 * p, .16, 2000 * p, .1, .08); nzf(E, o, t, 2, 'lowpass', 160, 0, .7, .05, .3, .6, .6, E.brown); return 3.6;
});
// missiles: launch pop, then a held rocket hiss over a low roar, crackling as it burns out
def('missile', .06, 3, 2, 1, .2, (E, t, o, p) => {
 nzf(E, o, t, 1.2, 'bandpass', 2800 * p, 2300 * p, .6, .012, .95, .3, .72);
 body(E, o, t, 1.2, 380, 300, .7, .15, .8, .3, .55);
 rumble(E, o, t, 1.2, 240, 150, 1.05, .1, .35, .55, .3, 11);
 nzf(E, o, t + .05, 1.2, 'bandpass', 1500, 900, .8, .05, .35, .3, .6, E.crackle); return 2.1;
});
def('torpedo', .08, 3, 2, 1, .3, (E, t, o, p) => {
 boom(E, o, t, 72 * p, 32 * p, .18, .45, .2); nzf(E, o, t, 1.6, 'bandpass', 1900 * p, 1500 * p, .6, .03, .8, .4, 1);
 rumble(E, o, t, 1.8, 200, 120, 1.1, .05, .5, 1, .3, 7);
 const lp = E.flt('lowpass', 1200, .8), tr = E.G(.7), l = E.osc('sine', 6, t, t + 2.8), lg = E.G(.3); l.connect(lg); lg.connect(tr.gain); lp.connect(tr); tr.connect(o);
 [[150, 190], [226, 286]].forEach(([a, b]) => { const x = E.osc('sine', a * p, t, t + 2.8); sweep(x.frequency, a * p, b * p, t, .6); const g = ENV(E, t, .1, .3, .6, .4); x.connect(g); g.connect(lp); });
 return 2.8;
});

// --- impacts: mostly low-mid, short plateau, ~1-1.5 s
def('hit_shield', .04, 5, 1, 1.8, .15, (E, t, o, p) => {
 nzf(E, o, t, .2, 'lowpass', 900, 0, .7, .003, .4, .05, 0, E.pink);
 rumble(E, o, t, 1, 950 * p, 520 * p, 1.3, .07, .14, .55, .45, 4.3, E.pink); rumble(E, o, t, 1, 220, 160, .55, .07, .14, .52);
 tone(E, o, t, 1.2, 'sine', 78 * p, 56 * p, .05, .25, .2, .5, .33); nzf(E, o, t, .4, 'bandpass', 900 * p, 500 * p, 1.5, .01, .15, .12); return 1.2;
});
def('hit_hull', .04, 4, 1, 1.05, .14, (E, t, o, p) => {
 p *= jit(.1); snapT(E, o, t, .25, 1500);
 nzf(E, o, t, .8, 'lowpass', 1800 * p, 420 * p, .8, .002, .85, .18, .03); nzf(E, o, t, 1, 'lowpass', 1100 * p, 380 * p, .7, .004, .9, .22, .04, E.pink);
 metalHit(E, o, t, 150 * p, .34, .3); boom(E, o, t, 110 * p, 55 * p, .12, .3, .14); crunch(E, o, t, 1000, 480, .3, .55, .1);
 nzf(E, o, t, .8, 'lowpass', 220, 0, .7, .01, .3, .24, .05, E.brown); return 1.3;
});
def('turret_destroyed', .06, 3, 3, 1.35, .16, (E, t, o, p) => {
 p *= jit(.1); snapT(E, o, t, .25, 1800); boom(E, o, t, 95 * p, 45 * p, .18, .2, .2);
 crunch(E, o, t, 1500 * p, 650 * p, .5, .45, .2); nzf(E, o, t, 1, 'lowpass', 1000, 380, .7, .01, 1, .24, .05, E.pink); nzf(E, o, t, .8, 'lowpass', 200, 0, .7, .01, .2, .22, .03, E.brown);
 nzf(E, o, t + .08, 1.1, 'bandpass', 3000, 2200, .7, .05, 2.2, .4, .2, E.crackle, 1.1); metalHit(E, o, t + .05, 210 * p, .16, .22); return 1.2;
});
// --- explosions: a pink-noise body closing toward the low mids, a modest sub, grit crunch, debris crackle
function blast(E, o, t, s, p, quiet) { // s: size 0..1
 body(E, o, t, 1 + 2.5 * s, (520 - 120 * s) * p, (300 - 80 * s) * p, .55, .008 + .12 * s, 2.1, .2 + .35 * s, .15 + .6 * s);
 rumble(E, o, t, 1 + 2 * s, 260, 140, .6 + .45 * s, .02 + .1 * s, .25 + .4 * s, .15 + .6 * s);
 boom(E, o, t, (95 - 25 * s) * p, (48 - 12 * s) * p, .15 + .35 * s, .3 + .15 * s, .18 + .3 * s);
 crunch(E, o, t, (1400 - 300 * s) * p, (520 - 120 * s) * p, .4 + .5 * s, .25 + .05 * s, .14 + .2 * s);
 if (!quiet) snapT(E, o, t, .85 - .5 * s, 1400);
}
def('explosion_small', .06, 4, 3, 1.1, .15, (E, t, o, p) => { p *= jit(.12); blast(E, o, t, .12, p); nzf(E, o, t + .05, .9, 'highpass', 1500, 0, .7, .02, .35, .22, .06, E.crackle); return 1.4; });
def('explosion_fighter', .08, 3, 3, 1.25, .2, (E, t, o, p) => {
 p *= jit(.1); nzf(E, o, t, 1.8, 'lowpass', 1500 * p, 520 * p, .7, .3, 1.3, .38, .28, E.pink); rumble(E, o, t, 1.6, 300, 160, .65, .26, .4, .3, .25, 11);
 nzf(E, o, t, 1.2, 'bandpass', 850 * p, 500 * p, .6, .3, .3, .32, .2, E.grit); boom(E, o, t + .2, 85 * p, 42 * p, .3, .15, .3);
 nzf(E, o, t + .15, 1.6, 'bandpass', 3000, 2000, .8, .2, 1, .35, .4, E.crackle); return 2.2;
});
def('explosion_large', .09, 2, 4, .7, .25, (E, t, o, p) => {
 p *= jit(.08); blast(E, o, t, .75, p);
 const d = .5 + Math.random() * .4; blast(E, o, t + d, .35, p * .9, 1);
 nzf(E, o, t + .15, 3, 'bandpass', 3000, 2000, .8, .15, .7, .8, .5, E.crackle, .9); return 3.6;
});
// capital ship death: a chain of blasts over a held body, then the fall-off (~6 s)
def('ship_destroyed', .2, 2, 5, .65, .28, (E, t, o, p) => {
 blast(E, o, t, .9, p, 1);
 rumble(E, o, t, 4.5, 420 * p, 300, .6, .05, .8, 2.6, .3, .9, E.pink); body(E, o, t, 4.5, 320, 240, .6, .05, 2.1, .8, 2.6); rumble(E, o, t, 4.5, 200, 120, .25, .05, .8, 2.6);
 let d = .4; for (let i = 0; i < 6; i++) { blast(E, o, t + d, (.3 + .4 * Math.random()) * (i === 3 ? 1.4 : 1), p * jit(.2), 1); d += .35 + Math.random() * .35; }
 nzf(E, o, t + .3, 4.5, 'bandpass', 2200, 1500, .7, .3, .4, .9, 2.8, E.crackle, .8);
 return 6;
});
// --- hyperspace: arrival = sudden whoosh-burst that settles into a falling rumble; departure = its counterpart (rise, then a short burst)
def('hyperspace_in', .15, 2, 4, 1.45, .22, (E, t, o, p) => {
 nzf(E, o, t, 1, 'bandpass', 1100 * p, 240 * p, .5, .02, .9, .28);
 nzf(E, o, t, 1.2, 'lowpass', 800 * p, 200 * p, .7, .02, 1, .36, .05, E.pink);
 rumble(E, o, t, 1.4, 360 * p, 110, 1, .03, .38, .2); boom(E, o, t, 80 * p, 36 * p, .3, .3, .28);
 tone(E, o, t, 1, 'sawtooth', 230 * p, 70 * p, .02, .1, .3, .8); return 1.9;
});
def('hyperspace_out', .15, 2, 4, 1.35, .3, (E, t, o, p) => {
 const T = .95, b = E.flt('bandpass', 200, .6), n = E.nz(t, t + T + .3), g = E.G(0), q = g.gain;
 sweep(b.frequency, 200 * p, 2200 * p, t, T); q.setValueAtTime(.001, t); q.exponentialRampToValueAtTime(.8, t + T); q.setTargetAtTime(0, t + T, .05); n.connect(b); b.connect(g); g.connect(o);
 const r = E.flt('lowpass', 180, .8), bn = E.nz(t, t + T + .3, 1, E.pink), rg = E.G(0); sweep(r.frequency, 180, 900, t, T); rg.gain.setValueAtTime(.001, t); rg.gain.exponentialRampToValueAtTime(1.1, t + T); rg.gain.setTargetAtTime(0, t + T, .06); bn.connect(r); r.connect(rg); rg.connect(o);
 const w = E.osc('sawtooth', 70 * p, t, t + T + .2), wl = E.flt('lowpass', 900, 1), wg = E.G(0); sweep(w.frequency, 70 * p, 330 * p, t, T); wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(.16, t + T); wg.gain.setTargetAtTime(0, t + T, .04); w.connect(wl); wl.connect(wg); wg.connect(o);
 boom(E, o, t + T, 90 * p, 38 * p, .25, .3, .2); nzf(E, o, t + T, .7, 'lowpass', 900, 250, .7, .005, .9, .22, 0, E.pink); rumble(E, o, t + T, .9, 300, 110, .6, .01, .3, .05); return T + 1.1;
});
// --- alerts: one long klaxon blare (rises into pitch), harmonics kept low
def('alarm', 1.2, 1, 5, 1.75, .2, (E, t, o, p) => {
 const lp = E.flt('lowpass', 700, 1.2), g = E.G(0), q = g.gain; lp.connect(g); g.connect(o); sweep(lp.frequency, 2600, 700, t, .35);
 q.setValueAtTime(0, t); q.linearRampToValueAtTime(.5, t + .4); q.setValueAtTime(.5, t + 1.25); q.setTargetAtTime(0, t + 1.25, .2);
 for (const [ty, k, a] of [['sawtooth', 1, .55], ['square', 1.004, .3], ['sawtooth', .5, .18]]) { const x = E.osc(ty, 300 * p * k, t, t + 2.4), xg = E.G(a); x.frequency.setValueAtTime(300 * p * k, t); x.frequency.linearRampToValueAtTime(365 * p * k, t + .32); x.connect(xg); xg.connect(lp); }
 return 2.3;
});
// --- passing craft (one-shots with a doppler-ish sweep and pan glide; x.pan sign picks the direction)
function pass(E, o, t, x, T, build) {
 const dir = x.pan < 0 ? -1 : 1, pn = E.pan(-dir * .8); if (pn.pan) { pn.pan.setValueAtTime(-dir * .8, t); pn.pan.linearRampToValueAtTime(dir * .85, t + T); } pn.connect(o);
 const sw = E.G(0), q = sw.gain; q.setValueAtTime(.001, t); q.exponentialRampToValueAtTime(1, t + T * .5); q.setTargetAtTime(0, t + T * .5, T * .16); sw.connect(pn);
 const dop = (param, f) => { param.setValueAtTime(f * 1.1, t); param.linearRampToValueAtTime(f * 1.06, t + T * .42); param.linearRampToValueAtTime(f * .92, t + T * .58); param.linearRampToValueAtTime(f * .9, t + T * 1.2); };
 build(sw, dop); return T * 1.25;
}
def('flyby_fighter', .15, 3, 2, 4.1, .22, (E, t, o, p, x) => pass(E, o, t, x, 1.5, (sw, dop) => {
 const b = E.flt('bandpass', 760 * p, .6); b.connect(sw);
 for (const [ty, k, a] of [['sawtooth', 1, .5], ['square', 2.01, .12]]) { const s = E.osc(ty, 390 * p * k, t, t + 2); dop(s.frequency, 390 * p * k); const g = E.G(a); s.connect(g); g.connect(b); }
 const n = E.nz(t, t + 2), nb = E.flt('bandpass', 1100, .8), ng = E.G(.25); n.connect(nb); nb.connect(ng); ng.connect(sw);
}));
function shuttleTone(E, t, sw, dop, p, end, hum, whine, wl, low, lpf) {
 const lp = E.flt('lowpass', lpf, .8); lp.connect(sw);
 for (const [k, a] of [[1, .5], [1.5, .25]]) { const s = E.osc('sawtooth', hum * p * k, t, end); dop(s.frequency, hum * p * k); const g = E.G(a); s.connect(g); g.connect(lp); }
 const w = E.osc('sine', whine * p, t, end), wg = E.G(wl); dop(w.frequency, whine * p); w.connect(wg); wg.connect(sw);
 const n = E.nz(t, end, 1, E.pink), nl = E.flt('lowpass', low, .7), ng = E.G(.9); n.connect(nl); nl.connect(ng); ng.connect(sw);
}
def('shuttle_light', .3, 2, 2, 1.2, .25, (E, t, o, p, x) => pass(E, o, t, x, 3.6, (sw, dop) => shuttleTone(E, t, sw, dop, p, t + 4.6, 86, 3600, .18, 240, 300)));
def('shuttle_heavy', .3, 2, 2, 1.65, .25, (E, t, o, p, x) => pass(E, o, t, x, 4.4, (sw, dop) => shuttleTone(E, t, sw, dop, p, t + 5.6, 86, 4400, .03, 520, 650)));

// ---------- loops: f(E, t, out, L) builds a continuous voice; L.det collects detune params for pitch control ----------
const LOOPS = {};
const ldef = (name, vol, wet, f) => { LOOPS[name] = {vol, wet, f}; };
const forever = 1e6;
function lsrc(E, L, type, f, gain, out, filt) { const s = type === 'brown' || type === 'white' ? E.nz(0, forever, 1, type === 'brown' ? E.brown : 0) : E.osc(type, f, E.ctx.currentTime, E.ctx.currentTime + forever); L.det.push(s.detune); const g = E.G(gain); if (filt) { s.connect(filt); filt.connect(g); } else s.connect(g); g.connect(out); return s; }
function lam(E, out, rate, depth) { const m = E.G(1 - depth), l = E.osc('sine', rate, E.ctx.currentTime, E.ctx.currentTime + forever), lg = E.G(depth); l.connect(lg); lg.connect(m.gain); m.connect(out); return m; }
// big ships: deep breathing hum; medium: a little higher with a flutter; small: brighter hum with a thin whine
function engine(E, out, L, hum, low, whine, wl, am, br, sw) {
 const a = lam(E, out, am, .12), b = lam(E, a, br, .14), lp = E.flt('lowpass', hum * 4.5, .7), lp2 = E.flt('lowpass', hum * 7, .7), lb = E.flt('lowpass', low, .7);
 lsrc(E, L, 'brown', 0, 1.1, b, lb); lsrc(E, L, 'sawtooth', hum, sw || .32, b, lp); lsrc(E, L, 'sawtooth', hum * 2.006, .12, b, lp2); lsrc(E, L, 'sine', whine, wl, b);
}
ldef('engine_large', .42, .2, (E, out, L) => engine(E, out, L, 55, 210, 1060, .02, 37, .33));
ldef('engine_medium', .37, .2, (E, out, L) => engine(E, out, L, 66, 260, 1320, .022, 9, .25));
ldef('engine_small', .42, .18, (E, out, L) => engine(E, out, L, 90, 420, 1600, .03, 3.2, .4, .45));
ldef('fighter', 1, .15, (E, out, L) => { const a = lam(E, out, 9.9, .2), b = E.flt('bandpass', 760, .6); b.connect(a); lsrc(E, L, 'sawtooth', 390, .5, b); lsrc(E, L, 'square', 784, .16, b); lsrc(E, L, 'white', 0, .25, a, E.flt('bandpass', 1400, .8)); });
ldef('shuttle_light', .28, .2, (E, out, L) => { const a = lam(E, out, 19, .1), lp = E.flt('lowpass', 290, .8); lsrc(E, L, 'sawtooth', 86, .5, a, lp); lsrc(E, L, 'sine', 3600, .16, a); lsrc(E, L, 'brown', 0, .9, a, E.flt('lowpass', 260, .7)); });
ldef('shuttle_heavy', .34, .2, (E, out, L) => { const a = lam(E, out, 12, .14), lp = E.flt('lowpass', 650, .8); lsrc(E, L, 'sawtooth', 86, .5, a, lp); lsrc(E, L, 'sawtooth', 129, .25, a, lp); lsrc(E, L, 'sine', 4400, .03, a); lsrc(E, L, 'brown', 0, .9, a, E.flt('lowpass', 520, .7)); });

// --- unchanged from v1.1: interface, designer, generic flyby, hangar, comms
def('ui_click',.03,3,3,.6,.05, (E, t, o, p) => { thock(E, o, t,190*p,.5,.022); nzf(E, o, t,.03, 'bandpass',1900*p,0,2,.0008,.26,.008); snapT(E, o, t,.09,4000); return .12; });
def('ui_toggle',.03,3,3,.58,.05, (E, t, o, p) => { thock(E, o, t,230*p,.45,.02); nzf(E, o, t,.03, 'bandpass',2600*p,0,2,.0008,.24,.007); thock(E, o, t + .038,145*p,.38,.022); nzf(E, o, t + .038,.03, 'bandpass',1500*p,0,2,.0008,.2,.008); return .16; });
def('ui_confirm',.05,3,3,.52,.14, (E, t, o, p) => { thock(E, o, t,160*p,.45,.035); [[440,0], [659.3,.075]].forEach(([f, d]) => { tone(E, o, t + d,.5, 'triangle', f*p,0,.004,.2,.09); tone(E, o, t + d,.3, 'sine', f*.5*p,0,.004,.14,.07); }); return .5; });
def('ui_error',.08,2,3,.55,.06, (E, t, o, p) => { const lp = E.flt('lowpass',750,1.2); lp.connect(o); [0,.13].forEach(d => { tone(E, lp, t + d,.22, 'square',110*p,98*p,.004,.26,.05,.1,.06); thock(E, o, t + d,120*p,.35,.03); }); return .45; });
def('place',.04,3,3,.6,.14, (E, t, o, p) => { boom(E, o, t,110*p,55*p,.08,.35,.08); thock(E, o, t,240*p,.45,.04); nzf(E, o, t,.06, 'bandpass',1600*p,0,2,.001,.42,.02); nzf(E, o, t + .075,.03, 'bandpass',3000*p,0,1.5,.0006,.28,.006); thock(E, o, t + .075,320*p,.2,.014); return .45; });
def('remove',.04,3,3,.58,.14, (E, t, o, p) => { nzf(E, o, t,.03, 'bandpass',2600*p,0,1.5,.0006,.28,.007); thock(E, o, t,270*p,.4,.015); boom(E, o, t + .05,90*p,55*p,.07,.3,.07); nzf(E, o, t + .05,.35, 'bandpass',1200*p,250*p,1.3,.02,.25,.07,.04); return .55; });
def('snap',.035,3,3,.55,.16, (E, t, o, p) => {
 snapT(E, o, t,.3,4000); boom(E, o, t,135*p,60*p,.05,.4,.05);
 const c = E.osc('sine',740*p, t, t + .45), m = E.osc('sine',1110*p, t, t + .45), mg = E.G(700*p); mg.gain.setTargetAtTime(0, t,.03); m.connect(mg); mg.connect(c.frequency); const g = ENV(E, t,.002,.16,.06); c.connect(g); g.connect(o); return .45;
});
def('flyby',.15,3,2,.65,.25, (E, t, o, p, x) => {
 const dir = x.pan < 0 ? -1 : 1, pn = E.pan(-dir*.8); if (pn.pan) { pn.pan.setValueAtTime(-dir*.8, t); pn.pan.linearRampToValueAtTime(-dir*.2, t + .7); pn.pan.linearRampToValueAtTime(dir*.85, t + 1.25); } pn.connect(o);
 const sw = E.G(0), q = sw.gain; q.setValueAtTime(.001, t); q.exponentialRampToValueAtTime(1, t + .86); q.setTargetAtTime(0, t + .86,.3); sw.connect(pn);
 const lp = E.flt('lowpass',1300,1); lp.frequency.setValueAtTime(1300, t); lp.frequency.linearRampToValueAtTime(2200, t + .85); lp.frequency.exponentialRampToValueAtTime(500, t + 1.6); lp.connect(sw);
 for (const [k, a] of [[1,.34], [1.5,.12]]) { const f = 120*p*k, s = E.osc('sawtooth', f*1.22, t, t + 2.2); s.frequency.setValueAtTime(f*1.22, t); s.frequency.linearRampToValueAtTime(f*1.17, t + .65); s.frequency.exponentialRampToValueAtTime(f*.8, t + 1.05); s.frequency.linearRampToValueAtTime(f*.76, t + 2); const g = E.G(a); s.connect(g); g.connect(lp); }
 const b = E.flt('bandpass',2200,.8); b.frequency.setValueAtTime(2200*p, t); b.frequency.linearRampToValueAtTime(2000*p, t + .7); b.frequency.exponentialRampToValueAtTime(700*p, t + 1.1); const ng = E.G(.42); E.nz(t, t + 2.2).connect(b); b.connect(ng); ng.connect(sw);
 const rl = E.flt('lowpass',450,.8), rg = E.G(1); E.nz(t, t + 2.2,1, E.brown).connect(rl); rl.connect(rg); rg.connect(sw);
 return 2.2;
});
def('launch',.1,3,2,.8,.3, (E, t, o, p) => {
 metalHit(E, o, t,180*p,.28,.25); boom(E, o, t,90*p,40*p,.12,.8,.15); snapT(E, o, t,.4,1800);
 rumble(E, o, t + .04,.8,300*p,1500*p,.7,.05,.25,.2); nzf(E, o, t + .06,.7, 'bandpass',700*p,3000*p,1.5,.03,.4,.2,.1);
 const lp = E.flt('lowpass',500,1); sweep(lp.frequency,500,1800, t + .3,.9); lp.connect(o); tone(E, lp, t + .3,1.8, 'sawtooth',60*p,220*p,.15,.38,.4,.9,.4);
 rumble(E, o, t + .3,1.6,420,220,.55,.2,.5,.6); return 2.6;
});
def('dock',.2,2,2,.8,.3, (E, t, o, p) => {
 boom(E, o, t,80*p,38*p,.12,.6,.15); metalHit(E, o, t,140*p,.35,.35); snapT(E, o, t,.4,1800);
 for (const d of [.22,.4]) { thock(E, o, t + d,150*p,.55,.05); nzf(E, o, t + d,.03, 'bandpass',2200*p,0,1.5,.0006,.3,.006); }
 nzf(E, o, t + .5,1.4, 'highpass',3500,0,.7,.05,.22,.4,.05); tone(E, o, t + .5,2, 'sine',55*p,0,.1,.3,.5,0,.2); return 2.2;
});
def('comms',.3,2,3,.5,.1, (E, t, o, p) => {
 const r = E.flt('bandpass',1500,.5); r.connect(o); thock(E, o, t,170*p,.3,.02);
 nzf(E, r, t,.06, 'bandpass',2400,0,1.5,.002,.2,.025); tone(E, r, t + .035,.1, 'sine',1100*p,0,.003,.2,.03,0,.045); tone(E, r, t + .115,.1, 'sine',1650*p,0,.003,.2,.03,0,.05);
 nzf(E, r, t + .2,.06, 'bandpass',2200,0,1.5,.002,.09,.025); return .4;
});

// ---------- arrangement helpers (all times in beats) ----------
const line = (s, t0, M, f, v, L, x, tr) => { for (const [m, t, d] of M) s.n(t0 + t, d, f, m + (tr || 0), v, L, x); };
function pad(P, key, s, t0, C, f, lo, hi, n, v, L, x) { let prev = P.st[key]; for (const {c, t, d} of C) { const vs = vlead(c.pcs, prev, lo, hi, n); vs.forEach((m, i) => s.n(t0 + t, d + .05, f, m, v, L, Object.assign({pan: n > 1 ? (i / (n - 1) - .5)*.7 : 0, vib: f === I.choir ? 10 : 0}, x))); prev = vs; } P.st[key] = prev; }
function bass(s, t0, C, f, lo, v, L, x) { for (const {c, t, d} of C) s.n(t0 + t, d, f, lowNote(c.b, lo), v, L, x); }
function stack(c, lo, n) { const out = []; for (let m = lowNote(c.pcs[0], lo); out.length < n; m++) if (c.pcs.includes(m % 12)) out.push(m); return out; }
function arp(s, t0, C, f, lo, idx, step, v, L, x, dl) { for (const {c, t, d} of C) { const st = stack(c, lo,9); for (let k = 0; k*step < d - 1e-6; k++) s.n(t0 + t + k*step, step*(dl || 1.6), f, st[idx[k % idx.length]], v*(k % 4 ? .8 : 1), L, x); } }
function perc(s, t0, pat, step, f, m, v, L, x) { for (let i = 0; i < pat.length; i++) { const ch = pat[i]; if (ch !== '.') s.n(t0 + i*step, step, f, m, v*(ch === 'X' ? 1 : ch === 'x' ? .68 : .35), L, x); } }
function roll(s, t, beats, f, m, v0, v1, step, L, x) { const n = Math.round(beats / step); for (let k = 0; k < n; k++) s.n(t + k*step, step, f, m, (v0 + (v1 - v0)*k / n)*(.9 + .02*(k*7 % 10)), L, x); }
function gliss(s, t, beats, lo, pcs, n, v, f, L) { const st = beats / n; for (let m = lo, k = 0; k < n; m++) if (pcs.includes(m % 12)) { s.n(t + k*st,.5, f || I.harp, m, v*(.7 + .3*k / n), L || 0, {dec: 1.3}); k++; } }
const chordAt = (C, t) => { for (const e of C) if (t >= e.t && t < e.t + e.d) return e.c; return C[C.length - 1].c; };
const nearest = (pcs, tg, lo, hi) => { let b = lo, bd = 1e9; for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12) && Math.abs(m - tg) < bd) { bd = Math.abs(m - tg); b = m; } return b; };
function scaleFor(c, base) { let sc = base.slice(); for (const p of c.pcs) if (!sc.includes(p)) { sc = sc.filter(q => Math.min((q - p + 12) % 12, (p - q + 12) % 12) !== 1); sc.push(p); } return sc; }
const CELLS = [[3,1,2,2], [2,2,4], [4,2,2], [1.5,.5,2,4], [2,1,1,4], [6,2], [-2,2,2,2], [-1,1,2,4], [-4,1,1,2], [3,1,4]];
function gen(P, s, t0, C, base, f, lo, hi, v, L, x) {
 let cur = P.st.mel || Math.round((lo + hi) / 2); const mid = (lo + hi) / 2;
 C.forEach(({c, t}, ci) => {
  const sc = scaleFor(c, base), cell = CELLS[P.rnd()*CELLS.length | 0], nn = cell.filter(z => z > 0).length; let tt = t, i = 0;
  const up = ci < C.length / 2 ? cur < hi - 4 : cur < mid - 4;
  for (const z of cell) {
   if (z < 0) { tt -= z; continue; }
   let m;
   if (i === 0 || i === nn - 1) m = nearest(c.pcs, cur + (up ? 2 : -2)*(P.rnd() < .6 ? 1 : 0), lo, hi);
   else { const dir = up ? 1 : -1; m = cur + dir; for (let g = 0; g < 3 && !sc.includes(((m % 12) + 12) % 12); g++) m += dir; if (m < lo || m > hi) m = cur - dir*2; }
   s.n(t0 + tt, z*.96, f, m, v*(i === 0 ? 1 : .86), L, x); cur = m; tt += z; i++;
  }
 });
 P.st.mel = cur;
}

// ---------- faction flavours (kept light) ----------
// empire: darker key, low brass and male choir; republic: noble horns and harp; cis: mechanical percussion; rebel: brighter, trumpet-led
const FLAVOR = {none: {}, empire: {tr: -2, low: 1, choir: 1}, republic: {tr: 1, noble: 1}, cis: {tr: -1, mech: 1, tempo: 1.04}, rebel: {tr: 2, bright: 1}};
const SCENES = {}, STINGERS = {};
const nextK = P => (P.st.k = P.st.k == null ? 0 : P.st.k + 1);

// ---------- title: an original hymn-like theme in E-flat, brass chorale over strings ----------
const TT = {
 I: [prog('Eb:4 | Cb/Eb:4 | Ab/Eb:4 | Bbsus/Eb:2 Bb/Eb:2'), mel('G4:2 F4:1 Bb4:1 | Eb5:4')],
 A: [prog('Eb:4 | Ab:3 Bb:1 | Cm:2 Ab:2 | Bbsus:2 Bb:2 | Eb:4 | G:4 | Ab:2 Bb:2 | Eb:4'), mel('G4:2 F4:1 Bb4:1 | Eb5:3 D5:1 | C5:1.5 Bb4:.5 Ab4:1 G4:1 | F4:4 | G4:2 F4:1 Bb4:1 | B4:3 D5:1 | C5:2 D5:2 | Eb5:4')],
 B: [prog('Cm:4 | Ab:4 | Fm:4 | G:4 | Ab:4 | Fm7:4 | Cb:4 | Bbsus:2 Bb:2'), mel('G4:3 Ab4:.5 G4:.5 | Eb4:2 C5:2 | Bb4:1.5 Ab4:.5 G4:1 F4:1 | G4:2 D4:2 | C5:3 Eb5:1 | Ab5:2 G5:1 F5:1 | Eb5:1.5 Db5:.5 Cb5:2 | Bb4:2 C5:1 D5:1')],
 T: [prog('Eb:4 | Cb:4 | Ab:4 | Eb:4'), mel('G5:2 F5:1 Bb5:1 | Eb6:4')]
};
SCENES.title = {bpm: 72, seed: 1, next(P, s) {
 const k = nextK(P), f = P.flv, name = k === 0 ? 'I' : ['A', 'A2', 'B', 'A3', 'T'][(k - 1) % 5], [C, M] = TT[name[0]];
 const lead = f.bright ? I.tpt : I.horn, big = name === 'A3';
 s.len = C.len;
 pad(P, 'sp', s,0, C, I.str,50,70,4, name === 'I' || name === 'T' ? .42 : big ? .68 : .52,0, {a: name === 'I' ? 1.6 : .7, r: 1.3});
 bass(s,0, C, I.str,36,.55,0, {a: .5, r: 1.1, br: 3}); bass(s,0, C, I.sub,31,.22,0, {a: .3, r: .8});
 if (f.choir) pad(P, 'sc', s,0, C, I.choir,46,62,3,.42,0, {vow: 'o', a: 1.2, r: 1.5});
 if (f.mech && name !== 'I' && name !== 'T') perc(s,0, 'x.o.x.o.'.repeat(C.len / 8),.5, I.metal,84,.3,0, {dec: .12, wet: .5});
 const harpV = f.noble ? .5 : .32;
 if (name === 'I') {
  line(s,0, M, I.horn,.5,0, {wet: .6}); line(s,8, M, I.cel,.45,0, {},12);
  arp(s,0, C.slice(1), I.harp,55, [0,1,2,3,4,5,4,3],.5,.42,0);
  roll(s,12,4, I.timp,46,.15,.65,.125,0, {dec: .35}); s.n(13,3, I.cym,0,.55,0, {sw: 1});
 } else if (name === 'A') {
  line(s,0, M, lead,.7,0, {wet: .45});
  arp(s,0, C, I.harp,51, [0,1,2,1],1, harpV,0);
  pad(P, 'tb', s,0, C.slice(4), I.tbn,46,63,3,.32,0, {a: .2});
  s.n(0,1, I.timp,39,.45,0, {dec: 1});
 } else if (name === 'A2') {
  line(s,0, M, I.tpt,.62,0, {wet: .4}); line(s,0, M, I.horn,.5,0, {},-12);
  pad(P, 'tb', s,0, C, I.tbn, f.low ? 34 : 46, f.low ? 52 : 63,3,.42,0, {a: .15});
  for (const {c, t} of C) s.n(t,1, I.timp, lowNote(c.r,38),.42,0, {dec: .8});
  s.n(29,3, I.cym,0,.5,0, {sw: 1});
 } else if (name === 'B') {
  line(s,0, M, I.str,.72,0, {a: .22, r: .7, wet: .5}); line(s,0, M, I.flute,.3,0, {},12);
  pad(P, 'hp', s,0, C, I.horn,53,70,3,.38,0, {a: .3});
  arp(s,0, C, I.harp,48, [0,2,1,3],1, harpV,0);
  roll(s,12,4, I.timp,43,.1,.45,.125,0, {dec: .35}); roll(s,28,4, I.timp,46,.15,.7,.125,0, {dec: .35}); s.n(29,3, I.cym,0,.6,0, {sw: 1});
 } else if (big) {
  s.n(0,1, I.cym,0,.8);
  line(s,0, M, lead,.85,0, {wet: .4}); line(s,0, M, I.tpt, f.bright ? .62 : .48,0, {},12);
  pad(P, 'tb', s,0, C, I.tbn, f.low ? 34 : 43, f.low ? 55 : 62,4,.55,0, {a: .12});
  for (const {c, t} of C) s.n(t,1, I.timp, lowNote(c.r,38),.6,0, {dec: .9});
  roll(s,12,4, I.timp,46,.2,.7,.125,0, {dec: .3}); roll(s,28,3, I.timp,46,.25,.8,.125,0, {dec: .3}); s.n(31,1, I.timp,39,.9,0, {dec: 1.4});
  arp(s,0, C, I.harp,55, [0,1,2,3],.5, harpV*.8,0);
 } else {
  line(s,0, M, I.cel,.38,0, {dec: 1.8}); s.n(8,8, I.horn,63,.38,0, {wet: .6});
  arp(s,0, C, I.harp,55, [0,1,2,3,4,3,2,1],.5,.3,0);
 }
 return s;
}};

// ---------- yard: slow, modal, industrial-orchestral; generative walk through harmonic palettes ----------
const YP = [
 ['Dm:8 | G/D:8 | Bb:8 | C:8', [2,4,5,7,9,11,0]],
 ['Fmaj7:8 | C/E:8 | Dm7:8 | Bb:8', [5,7,9,10,0,2,4]],
 ['Gm:8 | Eb:8 | Bb:8 | F:8', [7,9,10,0,2,3,5]],
 ['Dm:8 | Bb:8 | Gm:8 | A:8', [2,4,5,7,9,10,1]],
 ['Dm:8 | Bbm:8 | F:8 | Asus:4 A:4', [2,4,5,7,9,10,0]]
].map(([c, sc]) => [prog(c), sc]);
const YNEXT = [[1,3,4], [2,0], [3,1], [0,4], [0,1]];
const YT = mel('r:2 D4:2 E4:2 F4:2 | A4:4 G4:4 | r:2 F4:2 G4:2 A4:2 | Bb4:4 A4:2 G4:2');
const YMP = ['x...x.x.x...x...', 'x..x..x...x..x..', 'x.......x.x.....', '..x...x...x...x.'];
SCENES.yard = {bpm: 63, seed: 2, next(P, s) {
 const st = P.st, f = P.flv, k = nextK(P);
 st.p = k === 0 ? 0 : YNEXT[st.p][P.rnd()*YNEXT[st.p].length | 0];
 const [C, base] = YP[st.p];
 let tx = k === 0 ? 0 : P.rnd()*4 | 0; if (tx === st.tx) tx = (tx + 1) % 4; st.tx = tx;
 s.len = 32;
 s.n(0,32, I.drone, lowNote(C[0].c.r,38),.75,0, {a: 3, r: 4});
 pad(P, 'yp', s,0, C, I.str,50,67,3,.38,0, {a: 2.4, r: 2.6, br: 3, vib: 4});
 bass(s,0, C, I.str,36,.3,0, {a: 2, r: 2.4, br: 2.5});
 const mp = YMP[st.mp = (st.mp == null ? 0 : st.mp + 1 + (P.rnd()*2 | 0)) % YMP.length];
 if (k === 0 || P.rnd() < .7) for (const {c, t} of C) for (let i = 0; i < 16; i++) if (mp[i] === 'x') s.n(t + i*.5,.5, I.metal, nearest(c.pcs, i % 8 ? 79 : 67,60,86),.2 + .1*P.rnd(),0, {dec: .35, wet: .75, pan: P.rnd() - .5});
 if (f.mech) for (const {t} of C) perc(s, t, 'x.x.x.x.x.x.x.x.',.5, I.metal,91,.14,0, {dec: .06, wet: .4});
 if (P.rnd() < .55) s.n(6 + (P.rnd()*18 | 0),5, I.steam,0,.7,0, {f: 450 + P.rnd()*650});
 if (f.choir) pad(P, 'yc', s,0, C, I.choir,43,57,3,.35,0, {vow: 'o', a: 2.5, r: 3});
 if (tx === 0) {
  if (st.p === 0 && k % 3 === 0) line(s,0, YT, f.bright ? I.tpt : I.horn,.5,0, {wet: .55});
  else for (const {c, t} of C) s.n(t + 2,6, I.cel, nearest(c.pcs,74,69,81),.3,0, {dec: 2.2});
 } else if (tx === 1) {
  arp(s,0, C, I.pizz,38, [0,2,1,2],1,.42,0);
  arp(s,0, C, I.cel,72, [0,1,2,3,2,1,2,3],.5,.22,0, {dec: 1.5});
 } else if (tx === 2) {
  gen(P, s,0, C, base, P.rnd() < .5 ? I.horn : I.reed,57,74,.48,0, {wet: .55});
  arp(s,0, C, I.harp,50, [0,1,2,3],2, f.noble ? .45 : .3,0);
 } else {
  pad(P, 'yv', s,0, C, I.choir,50,64,3,.4,0, {vow: 'u', a: 2.6, r: 3});
  gen(P, s,0, C, base, I.flute,69,84,.38,0);
 }
 if (k % 2 === 1) s.n(0,1, I.timp, lowNote(C[0].c.r,38),.25,0, {dec: 1.4});
 return s;
}};

// ---------- voyage: exploratory, Lydian colour, chromatic-mediant travel; 8th-note pulse ----------
const VS = {
 V1: [prog('A:4 | B/A:4 | F#m:4 | D:4 | A:4 | C:4 | G:4 | Esus:2 E:2'), mel('C#5:2 E5:1.5 D#5:.5 | F#5:2 D#5:1 B4:1 | C#5:3 A4:1 | B4:1 A4:1 F#4:2 | C#5:2 E5:1.5 D#5:.5 | E5:2 G5:2 | D5:1.5 B4:.5 G4:2 | A4:2 G#4:2')],
 V2: [prog('F#m:4 | D:4 | A:4 | E:4 | F#m:4 | D:4 | Bm:4 | Esus:2 E:2'), mel('A4:3 B4:1 | F#4:4 | E4:2 A4:2 | B4:4 | C#5:3 D5:1 | A4:4 | B4:2 D5:2 | E5:4')],
 V3: [prog('A:4 | F:4 | Db:4 | Esus:2 E:2 | A:4 | C:4 | D:4 | E:4'), mel('E4:4 | F4:4 | F4:4 | E4:4 | E4:4 | E4:4 | F#4:4 | G#4:4')]
};
SCENES.voyage = {bpm: 96, seed: 3, next(P, s) {
 const k = nextK(P), f = P.flv, name = ['V1', 'V2', 'V3'][k % 3], cyc = (k / 3 | 0) % 2, [C, M] = VS[name];
 s.len = 32;
 arp(s,0, C, cyc ? I.pizz : I.stac,45, [0,2,3,2,0,2,3,2],.5,.42,0, {br: 7}, cyc ? 1.6 : .9);
 for (const {c, t, d} of C) for (let b = 0; b < d; b += 2) s.n(t + b,1, I.timp, lowNote(c.r,38), b ? .2 : .32,0, {dec: .45});
 pad(P, 'vp', s,0, C, I.str,52,72,4,.36,0, {a: .9, r: 1.2});
 bass(s,0, C, I.str,33,.45,0, {a: .2, r: .6, br: 3});
 if (f.mech) for (const {t, d} of C) perc(s, t, 'x.xx'.repeat(d),.25, I.metal,86,.16,0, {dec: .05, wet: .3});
 if (f.choir) pad(P, 'vc', s,0, C, I.choir,45,60,3,.32,0, {vow: 'o', a: 1.2});
 if (name === 'V1') {
  line(s,0, M, cyc ? I.horn : I.flute, cyc ? .62 : .55,0, {wet: .5}, cyc ? -12 : 0);
  if (cyc && f.bright) line(s,0, M, I.tpt,.35,0, {});
  arp(s,0, C, I.harp,57, [0,1,2,3],1, f.noble ? .42 : .26,0);
 } else if (name === 'V2') {
  line(s,0, M, cyc ? I.str : I.reed, cyc ? .62 : .6,0, {wet: .5, a: .12});
  pad(P, 'vh', s,0, C, I.horn,53,67,3,.3,0, {a: .4});
 } else {
  line(s,0, M, I.horn,.48,0, {wet: .55});
  arp(s,0, C, I.cel,69, [0,1,2,3,4,3,2,1],.5,.24,0, {dec: 1.2});
  gliss(s,0,1,57, C[0].c.pcs,9,.35);
  s.n(14,2, I.cym,0,.4,0, {sw: 1});
 }
 s.n(0,1, I.drum,0,.35,0, {f: 70, dec: .4});
 return s;
}};

// ---------- battle: driving 3+3+2 string ostinato; layers 0 patrol / 1 engaged / 2 full ----------
const BS = {
 P: [prog('Dm:8 | Bb:8 | Gm:8 | A:8'), mel('A4:8 | F4:8 | G4:6 F4:2 | E4:8')],
 B1: [prog('Dm:4 | Dm:4 | Bb:4 | C:4 | Dm:4 | Dm:4 | Eb:4 | A:4'), mel('A4:.5 D5:.5 F5:1 E5:.5 D5:.5 E5:1 | D5:3 r:1 | Bb4:.5 D5:.5 F5:1 G5:1 F5:1 | E5:1.5 D5:.5 C5:1 G4:1 | A4:.5 D5:.5 F5:1 E5:.5 D5:.5 E5:1 | D5:2 A5:2 | G5:1.5 F5:.5 Eb5:1 D5:1 | C#5:4')],
 B2: [prog('Gm:4 | Eb:4 | Dm:4 | Bb:4 | Gm:4 | Eb:4 | Asus:2 A:2 | A:4'), mel('D5:1 G5:1 Bb5:1.5 A5:.5 | G5:2 Eb5:2 | F5:1 E5:.5 D5:.5 A4:2 | Bb4:1 D5:1 F5:2 | G5:1.5 A5:.5 Bb5:1 G5:1 | Bb5:2 G5:2 | E5:1 D5:1 C#5:2 | E5:4')],
 B3: [prog('Dm:4 | Bbm:4 | Dm:4 | Bbm:4 | Gm:4 | Eb:4 | Dm/A:2 A:2 | A:4'), mel('D4:4 | Db4:4 | D4:4 | F4:4 | G4:4 | G4:4 | F4:2 E4:2 | E4:4')]
};
const OST = [0,0,12,0,0,12,0,7,0,0,12,0,0,12,7,-1], ACC = [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0];
const SN = ['X..X..X.X..X..X.', 'x.oX.ox.x.oX.oxx'], STAB = ['X.....X...X.....', 'X.......X.X.X...'];
SCENES.battle = {bpm: 144, seed: 4, layers: 3, next(P, s) {
 const st = P.st, f = P.flv, k = nextK(P), x = P.E.intensity;
 let name = 'P'; if (x >= .3 || st.c && x >= .2) { st.c = (st.c || 0) + 1; name = ['B1', 'B2', 'B1', 'B3'][(st.c - 1) % 4]; }
 const [C, M] = BS[name]; s.len = 32;
 bass(s,0, C, I.str,38,.5,0, {a: .12, r: .5, br: 3}); bass(s,0, C, I.sub,31,.25,0, {a: .05});
 for (let b = 0; b < 8; b++) s.n(b*4,1, I.timp, lowNote(chordAt(C, b*4).r,38), b % 2 ? .28 : .42,0, {dec: .6});
 pad(P, 'bc', s,0, C, f.choir ? I.choir : I.horn,50,65,3, f.choir ? .45 : .3,0, {a: .8, r: 1, vow: 'o', wet: .5, one: 1});
 arp(s,0, C, I.stac,50, [0,2],.5,.32,0, {br: 6},.8);
 if (name === 'P') { line(s,0, M, I.horn,.42,0, {wet: .55}); s.n(0,32, I.str,81,.2,0, {a: 2, r: 1.5, trem: 11, wet: .6}); }
 if (f.noble && name === 'P') gliss(s,0,1,50, C[0].c.pcs,10,.3);
 for (let b = 0; b < 8; b++) {
  const c = chordAt(C, b*4), r = lowNote(c.r,45), third = c.pcs.includes((c.r + 4) % 12) ? 4 : 3;
  for (let i = 0; i < 16; i++) s.n(b*4 + i*.25,.22, I.stac, r + (OST[i] < 0 ? third : OST[i]), ACC[i] ? .62 : .4,1, {dry: f.mech, br: ACC[i] ? 11 : 7});
  perc(s, b*4, SN[b % 2],.25, I.snare,0, f.low ? .55 : .45,1);
  s.n(b*4,.5, I.drum,0,.4,1, {f: 88, dec: .2}); s.n(b*4 + 2,.5, I.drum,0,.32,1, {f: 80, dec: .2});
  if (f.mech) perc(s, b*4, 'x.xx.xx.x.xx.x.x',.25, I.metal,88,.2,1, {dec: .05, wet: .25});
 }
 pad(P, 'bh', s,0, C, I.horn,53,69,3,.46,1, {a: .12, one: 1});
 for (let i = 0; i < 4; i++) s.n(28 + i*.25,.25, I.drum,0,.4 + i*.1,1, {f: 110 - i*10, dec: .18});
 for (let b = 0; b < 8; b++) {
  const c = chordAt(C, b*4), lowv = vlead(c.pcs, null, f.low ? 38 : 45, f.low ? 55 : 60,3), hi = nearest(c.pcs,69,62,74), pat = STAB[b % 2];
  for (let i = 0; i < 16; i++) if (pat[i] !== '.') { const t = b*4 + i*.25; for (const m of lowv) s.n(t,.45, I.tbn, m,.8,2, {sfz: 1, r: .1, one: 1}); s.n(t,.4, I.tpt, hi,.75,2, {sfz: 1, r: .1}); }
  const tr = lowNote(c.r,38); s.n(b*4,.5, I.timp, tr,.75,2, {dec: .4}); s.n(b*4 + 1.5,.5, I.timp, tr,.5,2, {dec: .35}); s.n(b*4 + 2,.5, I.timp, tr + 7 > 57 ? tr - 5 : tr + 7,.6,2, {dec: .35});
  s.n(b*4,.5, I.drum,0,.6,2, {f: 56, dec: .32}); s.n(b*4 + 2,.5, I.drum,0,.42,2, {f: 56, dec: .28});
 }
 if (name === 'B3') { line(s,0, M, I.tbn,.8,2, {wet: .35}); line(s,0, M, I.horn,.6,2, {one: 1},12); }
 else if (name !== 'P') { line(s,0, M, I.brass,.85,2, {wet: .35, br: f.bright ? 1.15 : .85, lv: 1.25}); if (f.bright) line(s,0, M, I.tpt,.35,2, {one: 1},12); }
 else line(s,0, M, I.tpt,.45,2, {one: 1},12);
 s.n(0,1, I.cym,0,.7,2); s.n(28,4, I.cym,0,.5,2, {sw: 1}); roll(s,28,4, I.snare,0,.2,.7,.125,2);
 return s;
}};

// ---------- stingers (one-shot, 3-6 s; the scene ducks under them) ----------
// ---------- result screens (v1.4): the synthesized stand-ins for the recorded result music ----------
// victory: the title chorale, a little slower; defeat: the yard's slow modal walk, slower still.
SCENES.victory = {bpm: 66, seed: 5, next: SCENES.title.next};
SCENES.defeat = {bpm: 52, seed: 6, next: SCENES.yard.next};

STINGERS.victory = {bpm: 100, hold: 4.6, duck: .22, next(P, s) {
 const C = prog('Cb:2 Db:2 Eb:5'), M = mel('Eb5:1 Gb5:1 F5:1 Ab5:1 G5:5'); s.len = 9;
 line(s,0, M, I.tpt,.85,0, {wet: .45}); line(s,0, M, I.horn,.6,0, {},-12);
 pad(P, 'v', s,0, C, I.horn,53,67,3,.55,0, {a: .05}); pad(P, 'vs', s,0, C, I.str,55,79,4,.58,0, {a: .12, r: 1.4});
 bass(s,0, C, I.tbn,34,.62,0); bass(s,0, C, I.sub,31,.3,0);
 s.n(0,1, I.timp,47,.6); s.n(2,1, I.timp,49,.65); roll(s,4.5,2.5, I.timp,51,.3,.8,.125,0, {dec: .3}); s.n(7,2, I.timp,39,.95,0, {dec: 1.5});
 roll(s,2,2, I.snare,0,.2,.75,.125); s.n(4,1, I.cym,0,.85); s.n(7,1, I.cym,0,.6,0, {dec: 2});
 gliss(s,4,1,63, [3,7,10],12,.45);
}};
STINGERS.defeat = {bpm: 84, hold: 5.2, duck: .18, next(P, s) {
 const C = prog('Cm:2 Ab:2 Fm:1 Cm:3'), M = mel('G4:1.5 F4:.5 Eb4:2 F4:1 C4:3'); s.len = 8;
 line(s,0, M, I.horn,.62,0, {wet: .6});
 pad(P, 'd', s,0, C, I.str,48,67,4,.48,0, {a: .5, r: 1.8, br: 3}); pad(P, 'dc', s,0, C, I.choir,43,58,3,.5,0, {vow: 'o', a: .9, r: 2});
 bass(s,0, C, I.str,36,.5,0, {a: .4, r: 1.6, br: 2}); bass(s,0, C, I.sub,31,.3,0, {a: .3});
 roll(s,0,1.5, I.timp,43,.45,.15,.125,0, {dec: .4}); s.n(5,1, I.timp,36,.7,0, {dec: 1.8}); s.n(4,2, I.cym,0,.25,0, {sw: 1});
}};
STINGERS.alert = {bpm: 120, hold: 2.8, duck: .32, next(P, s) {
 s.len = 7;
 for (const m of [38,45,50]) s.n(0,.6, I.tbn, m,.9,0, {sfz: 1}); for (const m of [62,63]) s.n(0,.6, I.tpt, m,.72,0, {sfz: 1});
 s.n(0,1, I.timp,38,1,0, {dec: .7}); s.n(0,1, I.drum,0,.8,0, {f: 45, dec: .5});
 [62,63,64,65].forEach((m, i) => { s.n(.5 + i,1.05, I.str, m,.55 + i*.1,0, {a: .05, r: .2, trem: 13}); s.n(.5 + i,1.05, I.str, m - 12,.45 + i*.1,0, {a: .05, r: .2, trem: 13}); });
 roll(s,2,2.5, I.snare,0,.15,.8,.125); roll(s,2,2.5, I.timp,45,.2,.8,.125,0, {dec: .3});
 for (const m of [38,46,50]) s.n(4.5,1.2, I.tbn, m,.95,0, {sfz: 1}); for (const m of [62,65,70]) s.n(4.5,1.2, I.tpt, m,.8,0, {sfz: 1});
 s.n(4.5,1, I.timp,38,1,0, {dec: 1}); s.n(4.5,1, I.cym,0,.8);
}};
STINGERS.jump = {bpm: 100, hold: 3.2, duck: .4, next(P, s) {
 s.len = 7;
 gliss(s,0,1.5,50, [2,4,6,8,9,11,1],15,.45);
 for (const m of [50,57,62,66,68,69]) s.n(0,3.2, I.str, m,.48,0, {a: 1.1, r: 1.2});
 s.n(0,3, I.cym,0,.5,0, {sw: 1});
 for (const m of [50,57,62,66]) s.n(3,3, I.horn, m,.55,0, {a: .08}); s.n(3,3, I.tpt,69,.45); s.n(3,3, I.tpt,76,.32);
 s.n(3,1, I.timp,38,.6,0, {dec: 1.2});
 [74,78,81,86].forEach((m, i) => s.n(3 + i*.25,.5, I.cel, m,.4,0, {dec: 1.6}));
}};

// ---------- recorded tracks: <base>bgm_<id>.js (base64 AAC) -> Blob URL -> <audio> -> MediaElementSource -> music bus ----------
// Streams from an element (never decodeAudioData: minutes of PCM would not fit a phone). Synth music covers loading and absence.
const XF = 2, TK = {tracks: {}, stingers: {}, base: 'data/', mime: 'audio/mp4; codecs="mp4a.40.2"'}, trk = {}, sceneIdx = {};
let els = null, cur = null, pend = null, stT = null, noData = false, noCodec = null, anyLoaded = false, needPrime = false, silent = null, lastEvict = 0;
const nowS = () => Date.now() / 1000;
// a browser without AAC (e.g. some Chromium builds) keeps the synthesized score
const canPlay = () => { if (noCodec === null && hasDoc) try { noCodec = !new Audio().canPlayType(TK.mime); } catch (e) { noCodec = true; } return !noCodec; };
const trackMode = sc => S.musicSource !== 'synth' && !noData && canPlay() && !!(TK.tracks[sc] && TK.tracks[sc].length);
const hasTracks = () => !noData && canPlay() && (Object.keys(TK.tracks).some(k => TK.tracks[k] && TK.tracks[k].length) || Object.keys(TK.stingers).length > 0);
const notify = () => { for (const f of subs) try { f(S); } catch (e) {} };
function silentUrl() {
 if (silent) return silent;
 const n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, s) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i)); };
 w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
 for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
 return silent = URL.createObjectURL(new Blob([b], {type: 'audio/wav'}));
}
// three players: two alternate for crossfades (music bus, ducked by stingers), one for stinger tracks (not ducked)
function mkEls() {
 if (els || !eng || !ctx.createMediaElementSource || !hasDoc) return els;
 els = [0, 1, 2].map(i => { const el = new Audio(), g = ctx.createGain(); el.preload = 'auto'; g.gain.value = 0; el.addEventListener('error', () => trackError(i)); try { ctx.createMediaElementSource(el).connect(g); } catch (e) {} g.connect(i < 2 ? eng.mDry : eng.stDry); return {el, g, id: null, tok: 0, was: 0}; });
 return els;
}
// iOS lets an element play later without a gesture only if it already played inside one: play a silent clip during unlock
function prime() { if (!mkEls()) return; needPrime = false; for (const s of els) if (!s.id && s.el.paused) { s.el.src = silentUrl(); const p = s.el.play(); if (p && p.then) p.then(() => { if (!s.id) s.el.pause(); }, () => { needPrime = true; }); } resumeEls(); }
function loadTrack(id) {
 const r = trk[id] || (trk[id] = {id, st: 'idle', meta: {id}}); r.last = nowS();
 if (r.st === 'ready') return Promise.resolve(r);
 if (r.bad) return Promise.reject(new Error('track ' + id + ' unplayable'));
 if (r.st === 'loading') return r.p;
 if (noData || !hasDoc) return Promise.reject(new Error('no track data'));
 r.st = 'loading';
 return r.p = new Promise((res, rej) => {
  const fail = () => { r.st = 'error'; rej(new Error('track ' + id)); };
  const got = () => { const K = (W.KSBGM || {})[id]; if (!K || !K.b64) return fail(); blobify(K, r).then(() => { r.st = 'ready'; anyLoaded = true; r.last = nowS(); res(r); }, fail); };
  if ((W.KSBGM || {})[id] && W.KSBGM[id].b64) return got();
  const url = TK.base + 'bgm_' + id + '.js', none = () => { if (!anyLoaded) { noData = true; notify(); } fail(); }; // no data folder (single-file build): stop trying
  const viaScript = () => { const s = document.createElement('script'); s.src = url; s.async = true; s.onload = () => { s.remove(); got(); }; s.onerror = () => { s.remove(); none(); }; (document.head || document.documentElement).appendChild(s); };
  // preferred: fetch the bytes and decode the base64 span ourselves, so no multi-MB script source or string stays alive
  if (!W.fetch || /^file:/.test(W.location && W.location.protocol)) return viaScript();
  W.fetch(url).then(q => { if (!q.ok) throw {http: q.status}; return q.arrayBuffer(); }).then(b => fromBytes(new Uint8Array(b), r)).then(() => { r.st = 'ready'; anyLoaded = true; r.last = nowS(); res(r); }, e => e && e.http ? none() : e && e.fmt ? fail() : viaScript());
 });
}
const B64 = new Uint8Array(256); 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach((c, i) => { B64[c.charCodeAt(0)] = i; });
async function fromBytes(u, r) { // data file bytes: ...Object.assign({meta json},{b64:"..."});
 const find = (p, from) => { const c = p.charCodeAt(0); for (let i = u.indexOf(c, from); i >= 0; i = u.indexOf(c, i + 1)) { let k = 1; while (k < p.length && u[i + k] === p.charCodeAt(k)) k++; if (k === p.length) return i; } return -1; };
 const a = find('Object.assign(', 0), m = find(',{b64:"', a); if (a < 0 || m < 0) throw {fmt: 1};
 const K = JSON.parse(new TextDecoder().decode(u.subarray(a + 14, m))), s = m + 7, e = u.indexOf(34, s); if (e < 0) throw {fmt: 1};
 let n = e - s; while (n && u[s + n - 1] === 61) n--;
 const out = new Uint8Array(n * 3 >> 2), full = s + (n & ~3); let o = 0;
 for (let i = s; i < full;) { const stop = Math.min(full, i + (1 << 20)); for (; i < stop; i += 4) { const v = B64[u[i]] << 18 | B64[u[i + 1]] << 12 | B64[u[i + 2]] << 6 | B64[u[i + 3]]; out[o++] = v >> 16; out[o++] = v >> 8 & 255; out[o++] = v & 255; } await new Promise(f => setTimeout(f, 0)); }
 if (n & 3) { const x = B64[u[full]], y = B64[u[full + 1]]; out[o++] = x << 2 | y >> 4; if ((n & 3) > 2) out[o++] = (y & 15) << 4 | B64[u[full + 2]] >> 2; }
 r.url = URL.createObjectURL(new Blob([out.subarray(0, o)], {type: K.mime || 'audio/mp4'}));
 r.meta = {id: K.id || r.id, title: K.title, credit: K.credit, url: K.url, dur: K.dur};
}
async function blobify(K, r) { // base64 -> bytes in 1 MiB slices, yielding to the page between slices
 const b = K.b64, parts = [], CH = 1 << 20;
 for (let i = 0; i < b.length; i += CH) { const s = atob(b.slice(i, i + CH)), u = new Uint8Array(s.length); for (let j = 0; j < s.length; j++) u[j] = s.charCodeAt(j); parts.push(u); await new Promise(f => setTimeout(f, 0)); }
 r.url = URL.createObjectURL(new Blob(parts, {type: K.mime || 'audio/mp4'}));
 r.meta = {id: K.id || r.id, title: K.title, credit: K.credit, url: K.url, dur: K.dur}; delete K.b64;
}
function trackError(i) { // the element could not play this track: drop it and let the synthesized score take over
 const s = els && els[i]; if (!s || !s.id || s.el.src === silent) return; const r = trk[s.id]; if (r) { r.bad = true; if (r.url) URL.revokeObjectURL(r.url); r.url = null; r.st = 'error'; }
 s.id = null; if (cur && cur.slot === s) { cur = null; if (curScene) startScene(curScene, want.opts, true); }
}
function fadeTo(s, v, t, d) { const g = s.g.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + d); }
function playOn(s, r) {
 r.last = nowS(); s.tok++; if (s.id !== r.id || s.el.src !== r.url) { s.el.src = r.url; s.id = r.id; }
 try { s.el.currentTime = 0; } catch (e) {}
 const p = s.el.play(); if (p && p.catch) p.catch(e => { if (e && e.name === 'NotAllowedError') { s.was = 1; needPrime = true; attach(); } });
}
function stopLater(s) { const tok = s.tok; setTimeout(() => { if (s.tok === tok && (!cur || cur.slot !== s)) { s.el.pause(); s.was = 0; } }, XF * 1000 + 200); }
function playTrack(id, scene) {
 const r = trk[id]; if (!r || r.st !== 'ready' || !mkEls()) return false;
 const t = ctx.currentTime, a = cur && cur.slot, s = a === els[0] ? els[1] : els[0];
 if (a) { fadeTo(a, 0, t, XF); stopLater(a); }
 fadeTo(s, 0, t, .01); playOn(s, r); fadeTo(s, 1, t + .02, XF);
 cur = {id, scene, slot: s, adv: 0, pre: 0}; pend = null; return true;
}
function stopTrack() { if (!cur) return; const s = cur.slot; fadeTo(s, 0, ctx.currentTime, XF); cur = null; stopLater(s); }
function nextIn(sc) { const L = TK.tracks[sc]; return L[((sceneIdx[sc] || 0) + 1) % L.length]; }
function trackTick() {
 if (cur) {
  const el = cur.slot.el, d = el.duration, left = d - el.currentTime, sc = cur.scene; trk[cur.id].last = nowS();
  if (d > 0 && !el.paused) {
   if (left < 45 && !cur.pre) { cur.pre = 1; loadTrack(nextIn(sc)).catch(() => {}); }
   if (left < XF + .25 && !cur.adv) { cur.adv = 1; const L = TK.tracks[sc], id = L[sceneIdx[sc] = ((sceneIdx[sc] || 0) + 1) % L.length]; loadTrack(id).then(() => { if (cur && cur.scene === sc && curScene === sc && trackMode(sc)) playTrack(id, sc); }, () => {}); }
  }
 }
 const n = nowS(); if (n - lastEvict < 15) return; lastEvict = n;
 // forget blobs nobody needs soon (kept: the playing/pending track, the next one in the scene, stinger tracks while a track scene runs)
 const keep = new Set([cur && cur.id, pend && pend.id, stT && n < stT.end ? stT.id : null]);
 if (curScene && trackMode(curScene)) { keep.add(nextIn(curScene)); for (const k in TK.stingers) keep.add(TK.stingers[k]); }
 for (const id in trk) { const r = trk[id]; if (r.st !== 'ready' || keep.has(id) || n - r.last < 90) continue;
  for (const s of els || []) if (s.id === id && s.el.paused) { s.el.removeAttribute('src'); s.el.load(); s.id = null; }
  URL.revokeObjectURL(r.url); r.url = null; r.st = 'idle'; }
}
function trackStinger(name) {
 const id = S.musicSource !== 'synth' && !noData && TK.stingers[name]; if (!id) return false;
 const r = trk[id]; if (!r || r.st !== 'ready' || !mkEls()) { loadTrack(id).catch(() => {}); return false; }
 const s = els[2], t = ctx.currentTime, dur = r.meta.dur || 30;
 fadeTo(s, 1, t, .02); playOn(s, r); eng.duck(t + .05, Math.max(1, dur - 1.5), .3); stT = {id, end: nowS() + dur}; return true;
}
function pauseEls() { for (const s of els || []) if (!s.el.paused) { s.was = 1; s.el.pause(); } }
function resumeEls() { for (const s of els || []) if (s.was) { s.was = 0; const p = s.el.play(); if (p && p.catch) p.catch(() => {}); } }
// Start loading tracks ahead of need (e.g. the title music while the title screen waits for a tap): no audio
// context is needed to fetch and decode the data, only to play it. Returns how many were asked for.
function preload(ids) {
 if (S.musicSource === 'synth' || noData || !canPlay()) return 0; let n = 0;
 for (const id of [].concat(ids || [])) if (typeof id === 'string' && /^[\w-]+$/.test(id)) { loadTrack(id).catch(() => {}); n++; }
 return n;
}
function trackInfo() {
 const ids = []; for (const k in TK.tracks) for (const id of TK.tracks[k] || []) if (!ids.includes(id)) ids.push(id); for (const k in TK.stingers) if (!ids.includes(TK.stingers[k])) ids.push(TK.stingers[k]);
 return ids.map(id => { const K = (W.KSBGM || {})[id] || {}, m = trk[id] ? trk[id].meta : {}; return {id, title: m.title || K.title || null, credit: m.credit || K.credit || null, url: m.url || K.url || null, dur: m.dur || K.dur || null}; });
}

// ---------- realtime wrapper: one AudioContext after the first gesture ----------
const KEY = 'ks.audio.v1', DEF = {master: .7, music: .55, sfx: .7, muted: false, musicSource: 'classic'};
const hasDoc = typeof document !== 'undefined';
const isHidden = () => hasDoc && !!document.hidden;
function normS(s, base) { const o = Object.assign({}, base || DEF); if (s && typeof s === 'object') { for (const k of ['master', 'music', 'sfx']) { const v = s[k]; if (v !== null && v !== '' && isFinite(+v)) o[k] = clamp(+v,0,1); } if (typeof s.muted === 'boolean') o.muted = s.muted; if (s.musicSource === 'classic' || s.musicSource === 'synth') o.musicSource = s.musicSource; } return o; }
function loadS() { try { return normS(JSON.parse(W.localStorage.getItem(KEY) || 'null')); } catch (e) { return normS(null); } }
function saveS() { try { W.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
let S = loadS(), ctx = null, eng = null, timer = 0, everRan = false, want = {scene: null, opts: {}}, curScene = null, curFac = 'none', intensity = 0, vtok = 0;
const subs = new Set(), quiet = () => S.muted || S.master <= 0;
function tick() { if (eng && ctx.state === 'running') { eng.advance(ctx.currentTime + .12); trackTick(); } }
function ensure() {
 if (ctx) return true; if (!AC) return false;
 try { ctx = new AC({latencyHint: 'interactive'}); } catch (e) { try { ctx = new AC(); } catch (e2) { return false; } }
 eng = createEngine(ctx, ctx.destination); eng.apply(S); eng.setIntensity(intensity); configure();
 timer = setInterval(tick,25);
 if (ctx.addEventListener) ctx.addEventListener('statechange', () => { if (ctx.state === 'running') { everRan = true; detach(); } });
 if (want.scene) startScene(want.scene, want.opts);
 for (const h of loops) if (!h.L) h.L = eng.loop(h.name, h.o);
 if (isHidden()) eng.setHidden(true);
 return true;
}
function unlock() {
 if (!ensure()) return Promise.resolve(false);
 if (hasTracks() && (!els || needPrime)) prime(); // inside the gesture (iOS)
 const done = () => { if (ctx.state === 'running') { everRan = true; detach(); tick(); if (quiet()) applyS(); } return ctx.state === 'running'; };
 if (ctx.state !== 'running' && !isHidden()) { try { const p = ctx.resume(); if (p && p.then) return p.then(done, () => false); } catch (e) {} }
 return Promise.resolve(done());
}
const EVTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
const onGesture = () => { unlock(); };
function attach() { if (hasDoc) for (const e of EVTS) document.addEventListener(e, onGesture, true); }
function detach() { if (hasDoc) for (const e of EVTS) document.removeEventListener(e, onGesture, true); }
function onVis() {
 if (!ctx) return; const tok = ++vtok;
 if (isHidden()) { eng.setHidden(true); setTimeout(() => { if (tok === vtok && isHidden()) { pauseEls(); if (ctx.state === 'running') ctx.suspend().catch(() => {}); } },320); }
 else { const go = () => { if (tok === vtok) { eng.setHidden(false); tick(); if (!quiet()) resumeEls(); } }; if (ctx.state !== 'running' && everRan && !quiet()) ctx.resume().then(go, go); else go(); }
}
function applyS() {
 if (!eng) return; eng.apply(S);
 if (quiet()) setTimeout(() => { if (quiet()) { pauseEls(); if (ctx.state === 'running') ctx.suspend().catch(() => {}); } },260);
 else if (ctx.state !== 'running' && everRan && !isHidden()) ctx.resume().then(() => { tick(); resumeEls(); }, () => {});
 else if (!isHidden()) resumeEls();
}
// a scene plays its recorded track list (classic) or the synthesized score; synth also covers a track that is still loading
function startScene(scene, o, force) {
 const fac = FLAVOR[o && o.faction] ? o.faction : 'none', tm = !!scene && trackMode(scene);
 if (!force && scene && scene === curScene && fac === curFac && (tm ? cur && cur.scene === scene || pend && pend.scene === scene : eng.scene && !eng.scene.dead)) return;
 curScene = scene; curFac = fac;
 if (!scene) { stopTrack(); pend = null; eng.stopMusic(o && o.fade); return; }
 const synth = () => { const p = eng.scene; if (!p || p.dead || p.def !== SCENES[scene] || p.fac !== fac) eng.playScene(scene, {faction: fac, fade: o && o.fade, seed: Math.random()*1e6 | 0}); };
 if (!tm) { stopTrack(); pend = null; synth(); tick(); return; }
 const L = TK.tracks[scene]; let i = sceneIdx[scene];
 if (!force || i == null) i = sceneIdx[scene] = i == null ? 0 : (i + 1) % L.length;
 const id = L[i], r = trk[id];
 for (const k in TK.stingers) loadTrack(TK.stingers[k]).catch(() => {});
 if (r && r.st === 'ready') { eng.stopMusic(XF); playTrack(id, scene); }
 else { stopTrack(); synth(); pend = {scene, id}; loadTrack(id).then(() => { if (pend && pend.id === id && curScene === scene && trackMode(scene)) { eng.stopMusic(XF); playTrack(id, scene); } }, () => { if (pend && pend.id === id) pend = null; }); }
 tick();
}
function setMusic(scene, o) {
 if (scene != null && scene !== '' && !SCENES[scene]) return false;
 want = {scene: scene || null, opts: o || {}};
 if (eng) startScene(want.scene, want.opts);
 return true;
}
const audible = () => eng && ctx.state === 'running' && !isHidden() && !quiet();
function sfx(name, o) { return audible() && S.sfx > 0 ? eng.sfx(name, o) : false; }
function stinger(name, o) { if (!audible() || !STINGERS[name]) return false; if (trackStinger(name)) { tick(); return true; } eng.stinger(name, {faction: o && FLAVOR[o.faction] ? o.faction : curFac, delay: o && o.delay}); tick(); return true; }
let cfg = {};
function configure(o) { cfg = Object.assign(cfg, o || {}); if (o && (o.tracks || o.trackStingers || o.trackBase != null || o.trackMime)) setTracks(o); if (eng) { if (cfg.voiceCap) eng.VOICE_CAP = clamp(cfg.voiceCap | 0,4,64); if (cfg.rate) eng.RATE = clamp(+cfg.rate,5,400); if (cfg.nodeBudget) eng.BUDGET = clamp(cfg.nodeBudget | 0,40,2000); } return {voiceCap: eng ? eng.VOICE_CAP : cfg.voiceCap || 24, rate: eng ? eng.RATE : cfg.rate || 60, nodeBudget: eng ? eng.BUDGET : cfg.nodeBudget || 320, tracks: TK.tracks, trackStingers: TK.stingers, trackBase: TK.base}; }
function setTracks(o) {
 const ok = id => typeof id === 'string' && /^[\w-]+$/.test(id);
 if (o.tracks && typeof o.tracks === 'object') { TK.tracks = {}; for (const k in o.tracks) if (SCENES[k]) TK.tracks[k] = [].concat(o.tracks[k] || []).filter(ok); }
 if (o.trackStingers && typeof o.trackStingers === 'object') { TK.stingers = {}; for (const k in o.trackStingers) if (STINGERS[k] && ok(o.trackStingers[k])) TK.stingers[k] = o.trackStingers[k]; }
 if (o.trackBase != null) { TK.base = String(o.trackBase); noData = false; anyLoaded = false; }
 if (o.trackMime) { TK.mime = String(o.trackMime); noCodec = null; }
 notify(); if (eng && curScene) startScene(curScene, want.opts, true);
}
const loops = new Set();
function loop(name, o) {
 if (!LOOPS[name]) return null;
 const h = {name, o: Object.assign({gain: 1, pitch: 1, pan: 0}, o || {}), L: null, stopped: false,
  set(p) { if (!h.stopped) { Object.assign(h.o, p || {}); if (h.L) eng.loopSet(h.L, p || {}); } return h; },
  stop(f) { if (h.stopped) return; h.stopped = true; loops.delete(h); if (h.L) eng.loopStop(h.L, f); h.L = null; }};
 loops.add(h); if (eng) h.L = eng.loop(name, h.o);
 return h;
}
function setIntensity(x) { intensity = clamp(+x || 0,0,1); if (eng) eng.setIntensity(intensity); }
const settings = {
 get: () => Object.assign({}, S),
 set(p) { const was = S.musicSource; S = normS(p, S); saveS(); applyS(); if (S.musicSource !== was && eng && curScene) startScene(curScene, want.opts, true); notify(); return Object.assign({}, S); }
};

// ---------- the settings control (scoped .ksa-* styles, app tokens with fallbacks) ----------
const CSS = '.ksa{display:grid;gap:8px;font:13px/1.4 var(--font-ui,system-ui,sans-serif);color:var(--fg,#dbe5e8)}' +
 '.ksa-mute{justify-self:start;display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:4px 12px 4px 9px;border-radius:8px;border:1px solid var(--line-2,#2e404b);background:var(--raise,#1a2730);color:inherit;font:inherit;font-weight:700;cursor:pointer}' +
 '.ksa-mute svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.ksa-x,.ksa-mute[aria-pressed=true] .ksa-w{display:none}' +
 '.ksa-mute[aria-pressed=true]{color:var(--accent,#f0a03a);border-color:var(--accent,#f0a03a);background:var(--accent-soft,rgba(240,160,58,.15))}.ksa-mute[aria-pressed=true] .ksa-x{display:inline}' +
 '.ksa-row{display:grid;grid-template-columns:4.4em minmax(0,1fr) 2.4em;align-items:center;gap:10px}.ksa-l{font-size:12.5px;color:var(--muted,#8fa2ab)}' +
 '.ksa-row input{width:100%;min-width:0;margin:0;accent-color:var(--accent,#f0a03a)}.ksa-v{font:600 14px/1 var(--font-display,system-ui,sans-serif);font-variant-numeric:tabular-nums;text-align:right}.ksa-muted .ksa-row{opacity:.5}' +
 '.ksa-seg{grid-column:2/4;justify-self:start;display:inline-flex;border:1px solid var(--line-2,#2e404b);border-radius:8px;overflow:hidden}.ksa-seg button{border:0;background:none;color:inherit;font:inherit;font-weight:700;padding:4px 12px;min-height:30px;cursor:pointer}.ksa-seg button+button{border-left:1px solid var(--line-2,#2e404b)}.ksa-seg button[aria-pressed=true]{background:var(--accent,#f0a03a);color:var(--accent-ink,#1c1306)}.ksa-row[hidden]{display:none}';
function mountSettings(el) {
 if (!hasDoc || !el || !el.appendChild) return null;
 if (!document.getElementById('ksa-style')) { const st = document.createElement('style'); st.id = 'ksa-style'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); }
 const root = document.createElement('div'); root.className = 'ksa'; root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'サウンド設定');
 root.innerHTML = '<button type="button" class="ksa-mute" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="ksa-w" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="ksa-x" d="M16 9l6 6M22 9l-6 6"/></svg><span>ミュート</span></button>' +
  [['master', '音量'], ['music', '音楽'], ['sfx', '効果音']].map(([k, l]) => '<label class="ksa-row"><span class="ksa-l">' + l + '</span><input type="range" min="0" max="100" step="1" data-k="' + k + '" aria-label="' + l + '"><output class="ksa-v" data-o="' + k + '"></output></label>').join('') +
  '<div class="ksa-row ksa-src" hidden><span class="ksa-l">BGM</span><span class="ksa-seg" role="group" aria-label="BGM"><button type="button" data-src="classic">クラシック</button><button type="button" data-src="synth">合成</button></span></div>';
 const btn = root.querySelector('.ksa-mute'), lab = btn.querySelector('span');
 const src = root.querySelector('.ksa-src');
 const sync = s => { src.hidden = !hasTracks(); for (const b of src.querySelectorAll('button')) b.setAttribute('aria-pressed', s.musicSource === b.dataset.src ? 'true' : 'false'); btn.setAttribute('aria-pressed', s.muted ? 'true' : 'false'); lab.textContent = s.muted ? 'ミュート中' : 'ミュート'; root.classList.toggle('ksa-muted', s.muted);
  for (const inp of root.querySelectorAll('input[data-k]')) { const v = Math.round(s[inp.dataset.k]*100); if (+inp.value !== v) inp.value = v; root.querySelector('[data-o="' + inp.dataset.k + '"]').textContent = v; } };
 src.addEventListener('click', e => { const v = e.target && e.target.dataset && e.target.dataset.src; if (v && v !== S.musicSource) settings.set({musicSource: v}); });
 btn.addEventListener('click', () => { const m = !S.muted; settings.set({muted: m}); if (!m) setTimeout(() => sfx('ui_toggle'),120); });
 root.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.k; if (!k) return; const p = {}; p[k] = +e.target.value / 100; if (k === 'master' && S.muted && p[k] > 0) p.muted = false; settings.set(p); });
 root.addEventListener('change', e => { if (e.target && e.target.dataset && e.target.dataset.k === 'sfx') sfx('ui_click'); });
 subs.add(sync); sync(S); el.appendChild(root);
 return {el: root, destroy() { subs.delete(sync); root.remove(); }};
}

// ---------- offline rendering (tests, previews) ----------
function renderOffline(seconds, setup, o) {
 o = o || {}; const sr = o.sampleRate || 44100, off = new OAC(2, Math.ceil(sr*seconds), sr), e = createEngine(off, off.destination, {offline: true});
 e.apply(Object.assign({}, DEF, {master: 1, music: 1, sfx: 1}, o.settings || {}));
 const r = (setup && setup(e)) || {}, acts = (r.at || []).slice().sort((a, b) => a[0] - b[0]), step = .25;
 const run = t => { for (const a of acts) if (!a.done && a[0] <= t + 1e-6) { a.done = 1; a[1](e); } e.advance(t + step + .15); };
 run(0);
 for (let t = step; t < seconds - .01; t += step) { const tt = t; off.suspend(tt).then(() => { run(tt); off.resume(); }); }
 return off.startRendering().then(b => { b.engineStats = e.stats; return b; });
}
const atten = (d, near, far) => { near = near || 1; far = far || near*12; d = +d || 0; return d <= near ? 1 : d >= far ? 0 : near / d*smooth((far - d) / (far - near)); };
const panX = (x, w) => clamp((x / (w || 1))*2 - 1,-1,1)*.85;

const API = {__ks: 1, version: '1.4.0', unlock, configure, preload, trackInfo, loop, setMusic, setIntensity, stinger, sfx, settings, mountSettings, state() {
 return {unlocked: everRan, ctxState: ctx ? ctx.state : 'none', scene: curScene, faction: curFac, requested: want.scene, intensity, voices: eng ? eng.voices() : 0, players: eng ? eng.players.length : 0, loops: loops.size, pendingNodes: eng ? eng.graves() : 0, hidden: isHidden(), musicSource: S.musicSource, track: cur ? {id: cur.id, scene: cur.scene, time: +cur.slot.el.currentTime.toFixed(2), playing: !cur.slot.el.paused} : null, trackPending: pend ? pend.id : null, stingerTrack: stT && nowS() < stT.end ? stT.id : null, tracksAvailable: hasTracks(), tracksReady: Object.keys(trk).filter(k => trk[k].st === 'ready'), settings: Object.assign({}, S), stats: eng ? JSON.parse(JSON.stringify(eng.stats)) : null, time: ctx ? +ctx.currentTime.toFixed(3) : 0};
}, renderOffline, createEngine, atten, panX, names: {scenes: Object.keys(SCENES), stingers: Object.keys(STINGERS), sfx: Object.keys(SFX), loops: Object.keys(LOOPS), factions: Object.keys(FLAVOR).filter(k => k !== 'none')}};
W.KSAudio = API;
attach();
if (hasDoc) document.addEventListener('visibilitychange', onVis);
})();

/* ============================================================
   app.js — UI, tools, panels, persistence, exercises (v2).
   ============================================================ */
(() => {
'use strict';
const C = Core;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// ---------- formatting ----------
const SUP = {'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻'};
const num = (v, d) => v.toLocaleString('ja-JP', {maximumFractionDigits: d || 0, minimumFractionDigits: d || 0});
function ja(v, d) {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + '兆';
  if (a >= 1e8) return (v / 1e8).toFixed(a >= 1e10 ? 0 : a >= 1e9 ? 1 : 2) + '億';
  if (a >= 1e4) return num(Math.round(v / 1e4)) + '万';
  return num(v, d || 0);
}
function sci(v) {
  if (!v) return '0';
  const e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
  return m.toFixed(1) + '×10' + String(e).split('').map(c => SUP[c]).join('');
}
const fLen = (m) => Math.abs(m) >= 10000 ? (m / 1000).toFixed(1) + ' km' : Math.abs(m) < 100 && Math.abs(m - Math.round(m)) > .04 ? (Math.round(m * 10) / 10).toFixed(1) + ' m' : num(Math.round(m)) + ' m';
const fMass = (t) => ja(t) + ' t';
const fW = (w) => sci(w) + ' W';
const reactorOutputText = (p) => { const power = C.reactorPower(p); return `${fW(power)} · ${num(power / C.ISD_W, 6)} ISD`; };
const precisePartSize = (p) => C.isReactor(p) || ['engine','hyper','shield','localShield'].includes(p.k);
const fTT = (v) => v>0&&v<.001?(v*1e6).toLocaleString('ja-JP',{maximumFractionDigits:2})+' MT':v>0&&v<1?(v*1000).toLocaleString('ja-JP',{maximumFractionDigits:2})+' GT':fLargeTT(v);
const fLargeTT = (tt) => tt >= 1e5 ? (tt / 1000).toFixed(1) + ' PT' : tt > 0 && tt < 10 ? num(tt, 1) + ' TT' : num(Math.round(tt)) + ' TT';
const fG = (g) => num(Math.round(g)) + ' G';
const fCr = (c) => ja(c) + ' cr';
const fPct = (v) => Math.round(v * 100) + '%';
const fTime = (s) => s == null ? '—' : s < 60 ? Math.round(s) + '秒' : Math.floor(s / 60) + '分' + String(Math.round(s % 60)).padStart(2, '0') + '秒';
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// ---------- state ----------
const PART_KEYS = Object.keys(C.PARTS).filter(k=>!['machinery','capacitor'].includes(k));
const WEAPONS = ['refVen','refISD','refIon','refSide','oct40','casemate40','casemateMid','casemateLight','triple40','quad200','pd', 'ltl', 'mtl', 'htl', 'stl', 'utl', 'ionL', 'ion', 'msl', 'trc'];
const BRIDGES = ['podBridge','podAir','podHangar','podCombat'];
// v21 Craft weapons (starfighters, shuttles); capital turrets stay off a craft's palette and the reverse.
const CRAFT_WEAPONS = ['claser', 'claserH', 'cion', 'cturret', 'ctorp', 'cmsl', 'cbomb'];
const craftDesign = () => !!ship && C.isCraft(ship);
const weaponKeys = () => craftDesign() ? CRAFT_WEAPONS : WEAPONS;
// Parts offered: a craft takes its own kit; a capital ship everything but the craft-only parts.
const partOffered = k => craftDesign() ? C.craftPart(k) : C.PARTS[k].group !== 'craft';
// Part sizes are kept apart for craft and capital ships (metres vs tens of metres).
const pSize = k => craftDesign() ? (st.sizeCraft[k] ?? C.partLimits(ship, k).def) : st.size[k];
const setPSize = (k, v) => { if (craftDesign()) st.sizeCraft[k] = v; else st.size[k] = v; };
const TABS = [['hull', '船体'], ['mod', '区画および艤装'], ['systems','系統'], ['launch', '航空隊'], ['ground', '地上部隊'], ['spec', '性能']];
// 削る・装甲 live inside 船体; their editors keep their own tab keys.
const HULL_SUB = [['hull', '船体の形'], ['carve', '削る'], ['armor', '装甲']];
const TAB_NAMES = {...Object.fromEntries(TABS), carve: '削る', armor: '装甲', bridge: '艦橋'};
// Weapons and the bridge live inside 区画および艤装 as groups of their own.
const armMode = () => st.tab === 'arm' || st.tab === 'mod' && st.group === 'weapons';
function layoutGroups() { const cr = craftDesign(), out = []; for (const e of Object.entries(C.GROUPS)) { if (e[0] !== 'weapons' && !PART_KEYS.some(k => C.PARTS[k].group === e[0] && partOffered(k))) continue; out.push(e); if (e[0] === 'command' && !cr) out.push(['bridge', '艦橋']); } return out; }
const BRIDGE_SUB = [['body', '艦橋本体'], ['windows', '艦橋ポッド']];
function bridgeSubHTML() { return `<div class="pgroup command-sub"><h4>艦橋</h4>${seg('cmdsub', BRIDGE_SUB, st.bridgeMode === 'windows' ? 'windows' : 'body')}</div>`; }
// The bridge editor lives inside 区画 → 指揮; its state keeps the 'bridge' key.
const tabKey = () => st.tab === 'bridge' ? 'mod' : st.tab === 'carve' || st.tab === 'armor' ? 'hull' : st.tab;
function markTabs() { $$('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tabKey()))); }
const PLACE = [['inside', '内蔵'], ['partial', '一部露出'], ['outside', '外付け']];
const st = {
  tab: 'hull', part: 'gen', partTool: 'place',
  placeBy: {gen: 'inside', shield: 'partial', hyper: 'inside', engine: 'partial', hangar: 'inside'},
  size: {gen: 110, shield: 34, hyper: 50, engine: 60, hangar: 45},
  structSize: [180, 110, 60], structTaper: 0.2, fill: [0.3, 0.8], sizeCraft: {},
  sel: null, hatchA: null,
  fit: 'htl', fitTool: 'place', bridge: 'podBridge', bridgeTool: 'place', ped: 2, pedShape: 'round', pedSize: 1,
  carveTool: 'solid', razee: {side: 'both', edge: 'top', inset: 60, slope: 50, from: 0.1, to: 1, prop: true}, notch: {l: 120, w: 80, d: 40}, notchStructures: false,
  mirror: true, view: 'normal', coded: false, cut: {x: 1, y: 1, z: 1},
  simOpp: 'destroyer', dockCollapsed: false,
};
st.group='power';st.structPlate=false;st.structLight=false;st.structPlateT=1;st.structForm='trap';st.structAngles=[10,10,15,15];st.structYaw=0;st.structOffsetX=0;st.structOffsetZ=0;st.reactor=null;st.engineDir=[-1,0,0];st.trench={side:'both',depth:20,height:16,level:.5,from:0,to:1};
for(const k of PART_KEYS){if(st.size[k]==null)st.size[k]=C.PARTS[k].def||40;if(!st.placeBy[k])st.placeBy[k]='inside';}
let ship = null, S = null, prevS = null, view = null, bounds = [0, 0, 0, 1, 1, 1];
const undoStack = [], redoStack = [];
let lastOp = '', dragSnap = null, dragLabel = '';

// ---------- view / rendering ----------
const dirty = {draw: true};
let statsTimer = 0, hoverLines = null;
function requestDraw() { dirty.draw = true; }

// ---------- background engine ----------
// Geometry, compartment clipping, mounts and performance run in the engine
// (a worker when available). Edits only record what changed; the newest
// design is sent whenever the engine is free, so dragging never queues work.
const eng = {ready: false, gen: 0, sentGen: 0, geoGen: 0, adoptedGen: 0, statsGen: 0, waiting: false, scheduled: false, what: new Set(), reset: true, fitOnGeometry: true, quiet: false, label: '', labelGen: 0, mode: 'none', ms: null};
const meshStore = {geos: {}, glow: null, grid: null, ranges: null};
function touch(what) {   // geometry or design changed
  if (!ship) return;
  eng.gen++; eng.what.add(what || 'all');
  if (live.queued) { const q = live.queued; live.queued = null; showPreview(q.list, q.items); }
  else if (live.active) live.gen = eng.gen;
  kickEngine(); engineStatus(); refreshOverlay(); dirty.draw = true;
}
function kickEngine() {
  if (!eng.ready || eng.waiting || eng.scheduled) return;
  eng.scheduled = true;
  setTimeout(sendEngineUpdate, 0);
}
function sendEngineUpdate() {
  eng.scheduled = false;
  if (!eng.ready || eng.waiting || !ship || eng.sentGen === eng.gen) return;
  eng.waiting = true; eng.sentGen = eng.gen;
  const msg = {type: 'update', gen: eng.gen, reset: eng.reset, state: C.publicJSON(ship), what: [...eng.what], view: {coded: st.coded, habitation: !!st.showHabitation}};
  eng.what.clear(); eng.reset = false;
  YardEngineClient.post(msg);
}
function enginePending() { return eng.adoptedGen < eng.gen; }
function engineStatus() {
  const el = $('#engineStatus'); if (!el) return;
  const geo = eng.geoGen < eng.gen, stats = eng.statsGen < eng.gen;
  el.hidden = !(geo || stats) || fleet.mode !== 'design';
  el.textContent = !eng.ready ? '設計エンジンを起動中…' : geo ? '形状を計算中…' : '性能を計算中…';
  el.classList.toggle('geo', geo);
  $('#statstrip')?.classList.toggle('stale', stats);
  $('#specSide')?.classList.toggle('stale', stats);
}
function uploadStored() {
  if (!view) return;
  for (const [k, g] of Object.entries(meshStore.geos)) if (g) view.upload(k, g);
  if (meshStore.glow) view.setGlow(meshStore.glow, C.engineGlowRGB(ship?.engineGlow));
  if (meshStore.grid) view.setLines('grid', meshStore.grid);
}
function applyGeometry(msg) {
  for (const [k, g] of Object.entries(msg.geos || {})) { if (!g) continue; meshStore.geos[k] = g; if (view) view.upload(k, g); }
  if (msg.glow) { meshStore.glow = msg.glow; view?.setGlow(msg.glow, C.engineGlowRGB(ship?.engineGlow)); }
  if (msg.grid) { meshStore.grid = msg.grid; view?.setLines('grid', msg.grid); }
  if (msg.ranges !== undefined && msg.geos && Object.keys(msg.geos).length) meshStore.ranges = msg.ranges;
  if (msg.fitRanges) meshStore.fitRanges = msg.fitRanges;
  if (msg.bounds) bounds = msg.bounds;
  if (msg.dims) meshStore.dims = msg.dims;
  requestDraw();
}
// While the engine rebuilds a resized hull, the old hull mesh is stretched to
// the new length, beam and depth so the change is visible at once.
const HULL_MESHES = ['hull', 'refHull', 'keel', 'hatchOpen', 'hatchRay', 'refHatches'];
function liveScale() {
  const d = meshStore.dims, hp = ship?.hull; if (!d || !hp) return null;
  const s = [hp.L / d[0], hp.H / d[2], hp.W / d[1]];
  if (s.every(v => Math.abs(v - 1) < 1e-6)) return null;
  const out = {}; for (const k of HULL_MESHES) out[k] = s; return out;
}
// Derived state from the engine (mounts, bay openings, clipped and merged rooms)
// is adopted only when the design has not changed since the request.
function adoptEngineState(msg) {
  const src = JSON.parse(msg.state);
  C.patchShip(ship, src, ['parts', 'fits', 'hatches']);
  if (Number.isFinite(src.nextId)) ship.nextId = Math.max(ship.nextId, src.nextId);
  const c = msg.caches; if (!c) return;
  const ids = {parts: new Map(ship.parts.map(p => [p.id, p])), fits: new Map(ship.fits.map(f => [f.id, f])), hatches: new Map(ship.hatches.map(h => [h.id, h]))};
  const seen = new Set();
  const ref = (v) => v.$r === 'ship' ? ship : (ids[v.$r]?.get(v.id) || null);
  const fix = (v) => {
    if (!v || typeof v !== 'object' || ArrayBuffer.isView(v) || seen.has(v)) return;
    seen.add(v);
    if (v instanceof Map) { for (const [k, x] of v) { if (x && x.$r) v.set(k, ref(x)); else fix(x); } return; }
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const x = v[i]; if (x && x.$r) v[i] = ref(x); else fix(x); } return; }
    for (const k of Object.keys(v)) { const x = v[k]; if (x && typeof x === 'object' && x.$r) v[k] = ref(x); else fix(x); }
  };
  fix(c);
  for (const k of Object.keys(ship)) if (k[0] === '_' && !['_client'].includes(k)) delete ship[k];
  Object.assign(ship, c.ship);
  for (const l of ['parts', 'fits', 'hatches']) for (const it of ship[l]) {
    for (const k of Object.keys(it)) if (k[0] === '_') delete it[k];
    const x = c.items[l][it.id]; if (x) Object.assign(it, x);
  }
  ship._client = true; ship._geoProxy = c.geoProxy;
  if (ship._cache) ship._lockedCache = ship._cache;
  eng.adoptedGen = msg.gen;
}
function onEngineGeometry(msg) {
  eng.waiting = false;
  if (msg.gen >= eng.geoGen) { eng.geoGen = msg.gen; applyGeometry(msg); eng.ms = msg.totalMs; if (live.active && msg.gen >= live.gen) clearPreview(); }
  if (msg.gen === eng.gen && msg.state) {
    adoptEngineState(msg);
    if (eng.fitOnGeometry) { eng.fitOnGeometry = false; fitCamera(eng.keepCam); }
    hideBusyOverlay();
    refreshOverlay(); renderPanelInfo(); updateAviationUI(); refreshDerivedPanel(); autosave();
    if (titleVisible()) { titleStatus(); titleShipView(); }
  }
  if (eng.gen > eng.sentGen) kickEngine();
  engineStatus();
}
function onEngineStats(msg) {
  if (msg.geos && msg.gen >= eng.geoGen) applyGeometry(msg);
  if (msg.gen < eng.statsGen) return;
  eng.statsGen = msg.gen;
  prevS = S; S = msg.stats;
  renderStrip(); renderSpecTargets(); if (st.tab === 'systems' || armMode() && st.sel?.list === 'fits' && !dragSnap) renderPanel();
  if (st.tab !== 'spec' && st.tab !== 'sim') renderPanelInfo();
  updateAviationUI(); updateGroundUI();
  if (JSON.stringify(S?.ungrounded || null) !== JSON.stringify(prevS?.ungrounded || null)) refreshOverlay();
  if (msg.gen === eng.gen) {
    if (prevS && eng.label && !eng.quiet && msg.gen >= eng.labelGen) toastDiff(eng.label, prevS, S);
    const ug = x => (x?.ungrounded?.parts.length || 0) + (x?.ungrounded?.fits.length || 0);
    if (prevS && ug(S) > ug(prevS)) toast(`接地していない部品があります（赤枠 ${ug(S)} 個）。船体か、船体につながる部品に接するよう動かしてください`);
    eng.label = ''; eng.quiet = false;
  }
  engineStatus();
}
function onEngineError(msg) {
  console.error('engine:', msg.message, msg.stack);
  if (msg.job === 'update') { eng.waiting = false; if (msg.gen === eng.gen) { eng.geoGen = eng.statsGen = eng.adoptedGen = msg.gen; hideBusyOverlay(); } engineStatus(); toast('計算できませんでした：' + esc(msg.message)); if (eng.gen > eng.sentGen) kickEngine(); }
}
// Panels that show derived values refresh after the engine reports, unless the
// person is in the middle of dragging a control.
function refreshDerivedPanel() {
  if (dragSnap || fleet.mode !== 'design') return;
  const a = document.activeElement;
  if (a && a.closest && a.closest('#panel') && a.matches('input, select, textarea')) return;
  const it = selItem();
  if (['systems', 'launch'].includes(st.tab) || (st.tab === 'mod' && it && (it.k === 'hangar' || it._packingGroup || C.isInternal(it))) || (armMode() && st.sel?.list === 'fits')) renderPanel();
}
function engineHello(mode) {
  eng.mode = mode; eng.ready = true;
  YardEngineClient.on('geometry', onEngineGeometry);
  YardEngineClient.on('stats', onEngineStats);
  YardEngineClient.on('error', onEngineError);
  kickEngine(); engineStatus();
}
// ---------- live preview ----------
// An edited part or fitting is drawn at once from its requested shape, and its
// stale copy in the engine's meshes is hidden, until the engine catches up.
const live = {parts: [], fits: [], hide: {parts: new Set(), fits: new Set()}, gen: 0, queued: null, active: false};
function queuePreview(list, items) { live.queued = {list, items: items.filter(Boolean)}; }
function showPreview(list, items, removedIds) {
  if (!view || !ship) return;
  const sel = items.filter(Boolean);
  if (!live.active) { live.parts = []; live.fits = []; live.hide.parts.clear(); live.hide.fits.clear(); }
  const add = (arr, xs) => { for (const x of xs) if (!arr.includes(x)) arr.push(x); };
  if (list === 'parts') add(live.parts, sel); else add(live.fits, sel);
  for (const it of sel) live.hide[list].add(it.id);
  for (const id of removedIds || []) live.hide[list].add(id);
  live.parts = live.parts.filter(p => ship.parts.includes(p)); live.fits = live.fits.filter(f => ship.fits.includes(f));
  live.active = true; live.gen = eng.gen;
  try {
    const g = Gfx.meshPreview(ship, live.parts, live.fits, {coded: st.coded});
    for (const k of ['preview', 'previewRef', 'previewFits', 'previewRefFits']) view.upload(k, g[k]);
  } catch (e) { console.error(e); }
  requestDraw();
}
function clearPreview() {
  if (!live.active) return;
  live.active = false; live.parts = []; live.fits = []; live.hide.parts.clear(); live.hide.fits.clear();
  if (view) for (const k of ['preview', 'previewRef', 'previewFits', 'previewRefFits']) if (view.meshes?.[k]) { if (view.kind === 'compat') delete view.meshes[k]; else view.meshes[k].count = 0; }
  requestDraw();
}
// Exterior view skips machinery the performance pass found fully enclosed by
// the hull and structures. Bays behind hatches, model skins and anything not
// yet re-measured after an edit are always drawn.
const CULL_MESHES = new Set(['gen', 'shield', 'hyper']);
const cull = {key: '', ids: []};
function enclosedParts() {
  if (st.view !== 'normal' || fleet.mode !== 'design' || !S || !S.info || eng.statsGen !== eng.geoGen || ship.solidCuts?.length) return [];
  const key = eng.statsGen + ':' + ship.parts.length;
  if (cull.key === key) return cull.ids;
  const bays = new Set(ship.hatches.map(h => h.bay));
  cull.key = key; cull.ids = ship.parts.filter(p => p.k !== 'struct' && p.k !== 'hangar' && p.k !== 'engine' && !p.skinAsset && !bays.has(p.id) && S.info[p.id] && S.info[p.id].exposed === 0 && !S.info[p.id].overlap).map(p => p.id);
  return cull.ids;
}
function liveHidden() {
  const enclosed = enclosedParts();
  if (!live.active && !enclosed.length) return null;
  const out = {}, put = (ranges, ids, only) => { if (!ranges) return; for (const id of ids) for (const [name, s0, n] of ranges[id] || []) if (!only || only.has(name)) (out[name] || (out[name] = [])).push([s0, n]); };
  if (live.active) { put(meshStore.ranges, live.hide.parts); put(meshStore.fitRanges, live.hide.fits); }
  put(meshStore.ranges, enclosed, CULL_MESHES);
  for (const k in out) out[k].sort((a, b) => a[0] - b[0]);
  return out;
}
let busyT = 0;
function showBusyOverlay(text) { const el = $('#busy'); if (!el || titleVisible()) return; $('#busyText').textContent = text || '設計を展開中…'; clearTimeout(busyT); busyT = setTimeout(() => { el.hidden = false; }, 120); }
function hideBusyOverlay() { clearTimeout(busyT); const el = $('#busy'); if (el) el.hidden = true; }
// ---------- loading screen (v17) ----------
// Every change of scene — a flight, a battle, the 3D view of a fleet battle —
// loads behind a full-screen camera roll: moments captured from the player's
// own 3D views, and painted stills until there are enough of those. The
// fleet's clock is held while it shows (voy.loading).
const LS_SHOTS='yard.shots1';
const LOAD_TIPS=[
 '航行不能になった艦は、任務群のジャンプを止めます。「回収」か「自沈」を選びましょう。',
 '補給線は母港の星系から航路沿いに延びます。敵艦のいる星系は越えられません。',
 '補給の回復力は艦隊全体で分け合います。あちこちで同時に戦うと、修理と補充が追いつきません。',
 '味方艦が射線上にいると主砲は撃てません。艦どうしの間隔に注意しましょう。',
 '艦どうしがぶつかると船体が損傷します。軽い艦ほど大きな傷を負います。',
 '母艦がハイパースペースに入るまでに戻れなかった艦載機は失われます。',
 '航行不能の艦は惑星の重力に引かれて落ちていきます。牽引ビームで捕まえれば止められます。',
 '戦術図で艦をタップすると、1回目でその任務群、2回目でその艦を選びます。',
 '「命令」で作戦図と戦術図を開きます。3D視点に戻るには「3D視点」を押します。',
 'ハイパードライブの準備中は砲撃できず、被弾している間は準備が止まります。',
 '母港の星系では、破壊された機器の交換や乗員の補充まで行えます。',
 '船体破断・爆沈・航行不能。艦の最期はその壊れ方で決まります。'
];
const load={on:false,timer:0,tipT:0,n:0,w:0,h:0,gap:0,pool:[],tip:Math.floor(Math.random()*12)};
const shots={list:(()=>{try{const l=JSON.parse(LS.get(LS_SHOTS)||'[]');return Array.isArray(l)?l.filter(x=>x&&typeof x.u==='string'&&x.u.startsWith('data:image/')).slice(0,12):[];}catch(e){return [];}})(),last:0,painted:null};
function loadShow(text,title){
 const el=$('#loadScreen');if(!el)return;$('#lsText').textContent=text||'準備中…';$('#lsTitle').textContent=title||'出撃準備';
 if(load.on)return;load.on=true;hideBusyOverlay();el.classList.remove('out');el.hidden=false;loadLayout();loadFill();
 clearInterval(load.timer);load.timer=setInterval(loadAdvance,2000);loadTip();clearInterval(load.tipT);load.tipT=setInterval(loadTip,5600);
}
function loadHide(){
 const el=$('#loadScreen');if(!el||!load.on)return;load.on=false;clearInterval(load.timer);clearInterval(load.tipT);el.classList.add('out');
 setTimeout(()=>{if(load.on)return;el.hidden=true;el.classList.remove('out');const s=$('#lsStrip');if(s)s.innerHTML='';},420);
}
// Hidden once the new scene has drawn a frame or two.
function loadHideSoon(){requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(loadHide,60)));}
function loadLayout(){
 const el=$('#loadScreen'),W=innerWidth,H=innerHeight,w=Math.round(Math.max(200,Math.min(W*.6,H*.52*16/9,780))),h=Math.round(w*9/16),gap=Math.round(w*.06);
 Object.assign(load,{w,h,gap});el.style.setProperty('--ls-w',w+'px');el.style.setProperty('--ls-h',h+'px');el.style.setProperty('--ls-gap',gap+'px');
}
function loadTip(){const t=$('#lsTip');if(!t)return;load.tip=(load.tip+1)%LOAD_TIPS.length;t.textContent='ヒント：'+LOAD_TIPS[load.tip];}
function loadFrame(it){const f=document.createElement('div');f.className='ls-frame';const img=new Image();img.alt='';img.decoding='async';img.src=it.src;f.append(img);const c=document.createElement('span');c.className='ls-cap';c.textContent=it.cap;f.append(c);return f;}
function loadFill(){
 const own=shots.list.map(s=>({src:s.u,cap:s.c})),painted=paintedStills().slice();for(let i=painted.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[painted[i],painted[j]]=[painted[j],painted[i]];}
 load.pool=own.length>=4?own:own.concat(painted);load.n=0;
 const strip=$('#lsStrip');strip.innerHTML='';for(let i=0;i<7;i++)strip.append(loadFrame(load.pool[load.n++%load.pool.length]));loadPlace(false);
}
function loadPlace(anim){
 const strip=$('#lsStrip');if(!strip)return;const k=3,step=load.w+load.gap;
 strip.style.transition=anim?'transform .8s cubic-bezier(.62,.04,.24,1)':'none';strip.style.transform=`translateX(${-(k*step+load.w/2)-(anim?step:0)}px)`;
 [...strip.children].forEach((f,i)=>f.classList.toggle('on',i===k+(anim?1:0)));
}
function loadAdvance(){
 if(!load.on)return;const strip=$('#lsStrip');if(!strip||!load.pool.length)return;loadPlace(true);
 setTimeout(()=>{if(!load.on)return;strip.firstElementChild?.remove();strip.append(loadFrame(load.pool[load.n++%load.pool.length]));loadPlace(false);},840);
}
// ---- the player's own moments ----
// A frame of the 3D view, grabbed right after it is drawn: cropped to 16:9,
// kept small, the latest few remembered in this browser.
function shotSoon(kind,delay=0){if(!trial.on||load.on)return;const now=performance.now();if(now-(shots.last||0)<12000)return;const at=now+delay*1000;if(!trial.shotAt||at<trial.shotAt)trial.shotAt=at;}
function shotCaption(){
 const B=trial.battle,f=B?.rts&&voy.w&&B.follow!=null?voy.w.units.get(B.follow):null,me=B?.me,who=f?.name||me?.name||trial.asset?.design?.name||'',sys=trialSys()?.name||'';
 const t=voy.w&&trial.rts?'T+'+voyClock(voy.w.time):new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
 return [sys&&sys+'星系',shipShort(who),t].filter(Boolean).join(' · ');
}
function shotCapture(){
 const src=view?.canvas;if(!src||!src.width||!src.height||load.on)return;
 try{const W=480,H=270,c=shots.cv||(shots.cv=document.createElement('canvas'));c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true}),sw=src.width,sh=src.height,k=Math.min(sw/16,sh/9);
  g.drawImage(src,(sw-k*16)/2,(sh-k*9)/2,k*16,k*9,0,0,W,H);
  // A frame of nearly nothing (black space, a fade) is not worth keeping.
  const px=g.getImageData(0,0,W,H).data;let sum=0,n=0;for(let i=0;i<px.length;i+=4*61){sum+=px[i]+px[i+1]+px[i+2];n++;}if(sum/n<22)return;
  shots.list.unshift({u:c.toDataURL('image/jpeg',.74),c:shotCaption(),t:Date.now()});shots.list=shots.list.slice(0,12);shots.last=performance.now();LS.set(LS_SHOTS,JSON.stringify(shots.list.slice(0,6)));
 }catch(e){shots.last=performance.now();}
}
// Called after each 3D frame: a capture when one is due, and one every 45 s.
function shotTick(now){
 if(trial.shotAt&&now>=trial.shotAt){trial.shotAt=0;shotCapture();return;}
 if(!trial.shotAt&&!trial.jump&&now-(trial.startedAt||now)>4500&&now-(shots.last||0)>45000)trial.shotAt=now+200;
}
// ---- painted stills ----
// Until the player has a roll of their own: an orbit, hyperspace, a task
// group, a battle, the sector map and a hull plan, painted once per visit.
function paintedStills(){
 if(shots.painted)return shots.painted;const out=[];let seed=(Date.now()%100000)+7;const R=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const mk=(fn,cap)=>{try{const c=document.createElement('canvas');c.width=480;c.height=270;const g=c.getContext('2d');fn(g,480,270,R);out.push({src:c.toDataURL('image/jpeg',.82),cap});}catch(e){}};
 mk(paintOrbit,'記録 · クワット軌道');mk(paintHyper,'記録 · ハイパースペース');mk(paintFleet,'記録 · 第1合同任務群');mk(paintBattle,'記録 · 交戦');mk(paintMap,'作戦図 · クワット宙域');mk(paintPlan,'設計局 · 船体図');
 shots.painted=out;return out;
}
function paintStars(g,W,H,R,n){for(let i=0;i<n;i++){const b=R(),s=b>.97?1.6:b>.85?1.1:.7;g.fillStyle=`rgba(${200+R()*55|0},${210+R()*45|0},255,${.25+b*.7})`;g.fillRect(R()*W,R()*H,s,s);}}
// A wedge-hulled warship seen from above and astern, bow toward ang.
function paintWedge(g,x,y,s,ang,lit=1){
 g.save();g.translate(x,y);g.rotate(ang);
 const hull=g.createLinearGradient(0,-s*.3,0,s*.3);hull.addColorStop(0,`rgba(${150*lit|0},${160*lit|0},${170*lit|0},1)`);hull.addColorStop(.55,`rgba(${78*lit|0},${84*lit|0},${92*lit|0},1)`);hull.addColorStop(1,'#1d2227');
 g.fillStyle=hull;g.beginPath();g.moveTo(s,0);g.lineTo(-s*.62,-s*.36);g.lineTo(-s*.7,0);g.lineTo(-s*.62,s*.36);g.closePath();g.fill();
 g.strokeStyle='rgba(20,24,28,.7)';g.lineWidth=Math.max(.5,s*.012);g.beginPath();g.moveTo(s*.9,0);g.lineTo(-s*.66,0);g.stroke();
 g.fillStyle=`rgba(${120*lit|0},${128*lit|0},${136*lit|0},1)`;g.fillRect(-s*.52,-s*.09,s*.26,s*.18);g.fillRect(-s*.46,-s*.05,s*.12,s*.1);
 for(const k of [-.2,0,.2]){const e=g.createRadialGradient(-s*.7,k*s,0,-s*.7,k*s,s*.12);e.addColorStop(0,'rgba(220,240,255,.95)');e.addColorStop(.35,'rgba(120,190,255,.6)');e.addColorStop(1,'rgba(60,120,255,0)');g.fillStyle=e;g.beginPath();g.arc(-s*.7,k*s,s*.12,0,Math.PI*2);g.fill();}
 g.restore();
}
function paintGlow(g,x,y,r,c0,c1){const e=g.createRadialGradient(x,y,0,x,y,r);e.addColorStop(0,c0);e.addColorStop(1,c1);g.fillStyle=e;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
function paintOrbit(g,W,H,R){
 g.fillStyle='#03060a';g.fillRect(0,0,W,H);paintStars(g,W,H,R,260);
 const cx=W*.75,cy=H*2.15,r=H*1.65,p=g.createRadialGradient(cx-r*.3,cy-r*.75,r*.2,cx,cy,r);p.addColorStop(0,'#5a8fb0');p.addColorStop(.55,'#1c4a66');p.addColorStop(.85,'#0b2130');p.addColorStop(1,'#040a10');
 g.fillStyle=p;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.fill();
 g.strokeStyle='rgba(120,190,255,.55)';g.lineWidth=5;g.beginPath();g.arc(cx,cy,r+2,Math.PI*1.08,Math.PI*1.82);g.stroke();g.strokeStyle='rgba(170,220,255,.25)';g.lineWidth=14;g.beginPath();g.arc(cx,cy,r+6,Math.PI*1.1,Math.PI*1.8);g.stroke();
 g.globalCompositeOperation='lighter';paintGlow(g,W*.12,H*.16,70,'rgba(255,240,210,.9)','rgba(255,200,140,0)');g.globalCompositeOperation='source-over';
 paintWedge(g,W*.44,H*.47,W*.2,-.18,1.05);paintWedge(g,W*.73,H*.28,W*.06,-.22,.8);paintWedge(g,W*.2,H*.62,W*.045,-.15,.7);
}
function paintHyper(g,W,H,R){
 const bg=g.createRadialGradient(W/2,H/2,0,W/2,H/2,W*.7);bg.addColorStop(0,'#c9e6ff');bg.addColorStop(.08,'#2f5f9c');bg.addColorStop(.45,'#0a1630');bg.addColorStop(1,'#02040a');g.fillStyle=bg;g.fillRect(0,0,W,H);
 g.globalCompositeOperation='lighter';
 for(let i=0;i<700;i++){const a=R()*Math.PI*2,r0=20+R()*W*.2,r1=r0+40+R()*W*.6,b=.25+R()*.7;g.strokeStyle=`rgba(${150+R()*100|0},${200+R()*55|0},255,${b*.55})`;g.lineWidth=.6+R()*1.6;g.beginPath();g.moveTo(W/2+Math.cos(a)*r0,H/2+Math.sin(a)*r0*.8);g.lineTo(W/2+Math.cos(a)*r1,H/2+Math.sin(a)*r1*.8);g.stroke();}
 paintGlow(g,W/2,H/2,60,'rgba(240,250,255,.95)','rgba(120,180,255,0)');g.globalCompositeOperation='source-over';paintWedge(g,W*.5,H*.62,W*.14,-Math.PI/2+.06,.9);
}
function paintFleet(g,W,H,R){
 g.fillStyle='#04070c';g.fillRect(0,0,W,H);g.globalCompositeOperation='lighter';paintGlow(g,W*.3,H*.4,W*.45,'rgba(90,50,130,.35)','rgba(20,10,40,0)');paintGlow(g,W*.75,H*.7,W*.4,'rgba(30,110,130,.3)','rgba(10,30,40,0)');g.globalCompositeOperation='source-over';
 paintStars(g,W,H,R,200);
 [[.22,.66,.09],[.37,.52,.13],[.55,.4,.17],[.73,.3,.11],[.86,.22,.07]].forEach(([x,y,s],i)=>paintWedge(g,W*x,H*y,W*s,-.42,.75+i*.06));
}
function paintBattle(g,W,H,R){
 g.fillStyle='#050608';g.fillRect(0,0,W,H);paintStars(g,W,H,R,150);
 g.globalCompositeOperation='lighter';paintGlow(g,W*.68,H*.36,90,'rgba(255,170,90,.55)','rgba(120,40,10,0)');paintGlow(g,W*.7,H*.35,26,'rgba(255,245,220,.95)','rgba(255,160,80,0)');
 for(let i=0;i<70;i++){const fromL=R()<.55,x0=fromL?W*(.1+R()*.3):W*(.6+R()*.3),y0=H*(.3+R()*.5),dx=(fromL?1:-1)*(14+R()*20),dy=(R()-.5)*6;g.strokeStyle=fromL?'rgba(110,255,140,.85)':'rgba(255,90,70,.85)';g.lineWidth=1.6;g.beginPath();g.moveTo(x0,y0);g.lineTo(x0+dx,y0+dy);g.stroke();}
 for(let i=0;i<5;i++)paintGlow(g,W*(.55+R()*.35),H*(.25+R()*.5),8+R()*14,'rgba(255,220,160,.9)','rgba(255,120,40,0)');
 g.globalCompositeOperation='source-over';paintWedge(g,W*.24,H*.58,W*.16,-.05,.95);paintWedge(g,W*.14,H*.36,W*.08,-.08,.8);
 g.save();g.translate(W*.72,H*.5);g.scale(-1,1);paintWedge(g,0,0,W*.13,.1,.7);g.restore();
}
function paintMap(g,W,H,R){
 g.fillStyle='#071019';g.fillRect(0,0,W,H);g.strokeStyle='rgba(104,194,219,.08)';g.lineWidth=1;for(let x=0;x<W;x+=24){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}for(let y=0;y<H;y+=24){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
 const pts=Array.from({length:26},()=>[20+R()*(W-40),16+R()*(H-32)]);
 g.strokeStyle='rgba(104,194,219,.3)';g.lineWidth=1;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts.map((q,j)=>[j,Math.hypot(q[0]-a[0],q[1]-a[1])]).filter(q=>q[0]!==i).sort((x,y)=>x[1]-y[1]).slice(0,2);for(const [j] of b){g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(pts[j][0],pts[j][1]);g.stroke();}}
 const route=pts.slice().sort((a,b)=>a[0]-b[0]).filter((_,i)=>i%4===0);g.strokeStyle='rgba(240,160,58,.85)';g.lineWidth=2.4;g.beginPath();route.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();
 for(const p of pts){g.fillStyle='rgba(200,230,240,.85)';g.beginPath();g.arc(p[0],p[1],2.4,0,Math.PI*2);g.fill();}
 for(const p of [route[1],route[route.length-2]]){if(!p)continue;g.strokeStyle='rgba(240,160,58,.9)';g.lineWidth=1.5;g.beginPath();g.arc(p[0],p[1],8,0,Math.PI*2);g.stroke();}
}
function paintPlan(g,W,H,R){
 g.fillStyle='#0a2236';g.fillRect(0,0,W,H);g.strokeStyle='rgba(160,210,255,.1)';for(let x=0;x<W;x+=12){g.lineWidth=x%60?1:1.6;g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}for(let y=0;y<H;y+=12){g.lineWidth=y%60?1:1.6;g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
 g.strokeStyle='rgba(225,240,255,.85)';g.lineWidth=1.4;g.beginPath();g.moveTo(W*.88,H*.5);g.lineTo(W*.14,H*.2);g.lineTo(W*.1,H*.5);g.lineTo(W*.14,H*.8);g.closePath();g.stroke();
 g.beginPath();for(const k of [.3,.45,.6,.75]){g.moveTo(W*k,H*.5-(W*.88-W*k)/(W*.74)*H*.3);g.lineTo(W*k,H*.5+(W*.88-W*k)/(W*.74)*H*.3);}g.stroke();
 g.strokeRect(W*.2,H*.42,W*.12,H*.16);g.setLineDash([4,4]);g.beginPath();g.moveTo(W*.1,H*.5);g.lineTo(W*.9,H*.5);g.stroke();g.setLineDash([]);
 g.strokeStyle='rgba(240,160,58,.85)';g.beginPath();g.moveTo(W*.1,H*.9);g.lineTo(W*.88,H*.9);g.moveTo(W*.1,H*.87);g.lineTo(W*.1,H*.93);g.moveTo(W*.88,H*.87);g.lineTo(W*.88,H*.93);g.stroke();
 g.fillStyle='rgba(240,160,58,.95)';g.font='600 12px ui-monospace, monospace';g.textAlign='center';g.fillText('1,600 m',W*.49,H*.885);
}

function loop(now=performance.now()) {
  renderHealth.loops=(renderHealth.loops||0)+1;
  if(document.hidden){requestAnimationFrame(loop);return;}
  // A fleet battle's maps laid over its 3D view run the world; the view waits underneath.
  if(trial.on&&voy.orders&&voy.open&&trial.rts){try{voyLoop(now);}catch(e){console.error(e);}trial.last=0;requestAnimationFrame(loop);return;}
  if(trial.on){try{if(view&&!renderHealth.lost&&!renderRetryTimer)trialLoop(now);}catch(e){renderingFailed(e);}requestAnimationFrame(loop);return;}
  if(voy.open){try{voyLoop(now);}catch(e){console.error(e);}requestAnimationFrame(loop);return;}
  if(fleet.mode!=='design'){try{if(!renderHealth.lost&&!renderRetryTimer)fleetLoop(now);}catch(e){renderingFailed(e);}requestAnimationFrame(loop);return;}
  if (view && ship && !renderHealth.lost && !renderRetryTimer) {
    view.onTextureReady=requestDraw;
    try {
      if (titleCam.base) titleOrbit(now);
      if (dirty.draw || (renderHealth.mode==='webgl' && now-renderHealth.lastFrame>1500)) {
        if(meshStore.glow&&view.glowKey!==(ship.engineGlow||'')){view.glowKey=ship.engineGlow||'';view.setGlow(meshStore.glow,C.engineGlowRGB(ship.engineGlow));}
        const drawn=view.draw({mode: st.view, clip: null, paint:ship.paint,lights:ship.lights,engineGlow:ship.engineGlow,hullLength:ship.hull.L,reference:ship.reference, hidden: liveHidden(), meshScale: liveScale()});
        if(drawn!==false){dirty.draw=false;renderHealth.frames++;renderHealth.lastFrame=now;renderHealth.failures=0;}
      }
    } catch (e) { renderingFailed(e); }
  }
  requestAnimationFrame(loop);
}
function fitCamera(keepAngles) {
  if(fleet.mode!=='design'){fleetFit();return;}
  if(!view)return;
  if (!ship._geoProxy) { eng.fitOnGeometry = true; eng.keepCam = keepAngles; return; }
  const b = bounds, c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, 0];
  view.off = [-c[0], -c[1], -c[2]];
  const size = Math.max(b[3] - b[0], (b[5] - b[2]) * 1.2, (b[4] - b[1]) * 2) + 4;
  view.cam.target = [0, 0, 0];
  view.cam.r = size * 1.05 / Math.tan(view.cam.fov / 2) * 0.62;
  if (!keepAngles) { view.cam.ortho=false; view.cam.th = 0.85; view.cam.ph = 1.02; }
  requestDraw();
}
const CAMS = {iso: [0.85, 1.02], top: [Math.PI / 2, 0.0006], side: [Math.PI / 2, Math.PI / 2], front: [0, Math.PI / 2], back: [Math.PI, Math.PI / 2], bottom:[Math.PI/2,Math.PI-.0006]};

// ---------- ship lifecycle & history ----------
function setShip(s, opts) {
  if(fleet.mode!=='design')fleetSetMode('design');
  if(ship && !(opts&&opts.keepHistory)){undoStack.push(snap());if(undoStack.length>60)undoStack.shift();redoStack.length=0;}
  if (s.retiredRooms) { const n = s.retiredRooms; delete s.retiredRooms; setTimeout(() => toast(`居住区・兵員室 ${n} 区画を外しました（v19 から乗員と兵員は船内の空き容積に乗ります）`), 400); }
  if (s.vehicleBays) { const n = s.vehicleBays; delete s.vehicleBays; setTimeout(() => toast(`車両格納区画 ${n} 区画を機体格納の格納区画に変えました（v20 から車両は航空機と同じ格納庫に寸法で入ります。ハッチか、ハッチにつながる格納区画に接するようにしてください）`), 700); }
  ship = s; s._client = true; S = null; prevS = null; st.sel = null; st.multi = {parts: new Set(), fits: new Set()}; st.hatchA = null; resetSolidCutter();
  // Loading another design remains undoable. The engine starts from scratch.
  eng.reset = true; eng.fitOnGeometry = true; eng.keepCam = !!(opts && opts.keepCam);
  meshStore.geos = {}; meshStore.ranges = null; if (view) { for (const k of Object.keys(view.meshes || {})) if (view.meshes[k]) view.meshes[k].count = 0; }
  showBusyOverlay(opts?.busyText);
  touch('all');
  hideInspect(); updateName(); renderPanel(); scheduleStats(0); updateUndo(); autosave();
}
function snap() { return JSON.stringify(C.serialize(ship)); }
function restore(json) {
  // Undo keeps the editor's objects (and their caches) and patches the design.
  const s = C.deserialize(JSON.parse(json)), src = JSON.parse(C.publicJSON(s));
  if (ship.saveId != null) src.saveId = ship.saveId;
  C.patchShip(ship, src); ship._client = true; reconcileSolidCutter();
  const sel = st.sel; st.sel = sel && findSel(sel) ? sel : null; st.hatchA = null;
  touch('all'); hideInspect(); renderPanel(); scheduleStats(60); updateUndo(); autosave();
}
function mutate(label, fn, what, opts) {
  const before = snap();
  let res;
  try { res = fn(); } catch (e) { console.error(e); sndUI('ui_error'); toast(esc(e.message||'操作できませんでした')); return false; }
  if (snap() === before) { if (!(opts && opts.silent)) toast(typeof res === 'string' ? res : '変化はありません'); return false; }
  sndEdit(label);

  undoStack.push(before); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0;
  lastOp = label; touch(what || 'all'); scheduleStats(opts && opts.quiet ? -1 : 60); updateUndo(); autosave();
  return res == null ? true : res;
}
function beginDrag(label) { if (!dragSnap) { dragSnap = snap(); dragLabel = label; } }
function endDrag() {
  if (!dragSnap) return;
  if (snap() !== dragSnap) { undoStack.push(dragSnap); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; lastOp = dragLabel; scheduleStats(30); updateUndo(); autosave(); }
  dragSnap = null;
}
function undo() { if (!undoStack.length) return; redoStack.push(snap()); lastOp = '元に戻す'; restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snap()); lastOp = 'やり直し'; restore(redoStack.pop()); }
function updateUndo() { $('#btnUndo').disabled = !undoStack.length; $('#btnRedo').disabled = !redoStack.length; }
function updateName() { $('#shipName').textContent = ship.name; }
// Performance figures arrive from the engine after each edit settles.
function scheduleStats(delay) {
  eng.quiet = delay < 0;
  if (lastOp) { eng.label = lastOp; eng.labelGen = eng.gen; lastOp = ''; }
}

// ---------- selection ----------
function findSel(sel) { const l = ship[sel.list]; return l ? l.find(q => q.id === sel.id) : null; }
function selItem() { return st.sel ? findSel(st.sel) : null; }
function twinOfItem(list, it) { return it && it.tw ? ship[list].find(q => q.id === it.tw) : null; }

// ---------- picking ----------
function visibleAt(p, clip) { return !clip || (p[0] <= clip[0] + 0.01 && p[1] <= clip[1] + 0.01 && p[2] <= clip[2] + 0.01); }
function envHit(o, d, clip, opts) {
  let oo = o.slice(), acc = 0;
  for (let k = 0; k < 12; k++) {
    const h = C.rayEnv(ship, oo, d, opts);
    if (!h) return null;
    h.t += acc;
    if (visibleAt(h.p, clip)) return h;
    const step = (h.t - acc) + 0.05; acc += step; oo = C.add(oo, C.mul(d, step));
  }
  return null;
}
function sectionHit(o, d, clip) {
  if (!clip) return null;
  let t = 0, n = null;
  for (let a = 0; a < 3; a++) {
    if (o[a] > clip[a]) { if (d[a] >= 0) return null; const ta = (clip[a] - o[a]) / d[a]; if (ta > t) { t = ta; n = [0, 0, 0]; n[a] = 1; } }
  }
  if (!n) return null;
  const q = C.add(o, C.mul(d, t + 0.01));
  if (!visibleAt(q, clip) || !C.inEnv(ship, q)) return null;
  return {t, p: q, n, kind: 'section'};
}
function partHit(o, d, clip, filter) {
  let best = null;
  for (const pt of [...ship.parts,...C.commandCompartments(ship),...C.weaponCapacitors(ship),...C.missileCells(ship)]) {
    if (filter && !filter(pt)) continue;
    const h = C.rayPart(o, d, pt);
    if (h && visibleAt(h.p, clip) && (!best || h.t < best.t)) { best = h; best.part = pt; best.kind = 'part'; }
  }
  return best;
}
function fitHit(o, d) {
  let best = null;
  for (const f of ship.fits) { const h = C.rayAABB(o, d, C.fitAABB(f)); if (h && (!best || h.t < best.t)) best = {t: h.t, fit: f, p: h.p}; }
  return best;
}
function pick(px, py, want) {
  if (!view || !ship || !ship._geoProxy) return null;
  const r = view.ray(px, py); if (!r) return null;
  return pickRay(r.o, r.d, want);
}
// The same hit test along a world ray (the tutorial taps through it).
function pickRay(o, d, want) {
  if (!ship || !ship._geoProxy) return null;
  let h = null;
  if (st.view === 'xray' && want.parts) h = partHit(o, d, null, (pt) => pt.k !== 'struct') || envHit(o, d, null, {structOnly: false});
  else h = envHit(o, d, null);
  if (want.fits) { const f = fitHit(o, d); if (f && (!h || f.t < h.t)) return {fit: f.fit, t: f.t, p: f.p}; }
  return h;
}

// ---------- tools ----------
function tool() {
  switch (st.tab) {
    case 'mod': return st.group==='weapons'?(st.fitTool==='place'?'fit':st.fitTool==='remove'?'unfit':st.fitTool==='multi'?'multi':'adjust'):st.partTool === 'select' ? 'select' : st.partTool === 'multi' ? 'multi' : st.partTool === 'remove' ? 'unpart' : 'part';
    case 'launch': return 'select';
    case 'arm': return st.fitTool === 'place' ? 'fit' : st.fitTool === 'remove' ? 'unfit' : st.fitTool === 'multi' ? 'multi' : 'adjust';
    case 'bridge': if(st.bridgeMode==='body')return st.partTool==='select'?'select':st.partTool==='multi'?'multi':st.partTool==='remove'?'unpart':'part';return st.bridgeTool === 'place' ? 'fit' : st.bridgeTool === 'remove' ? 'unfit' : 'adjust';
    case 'carve': return st.carveTool === 'solid' ? 'solid' : st.carveTool === 'notch' ? 'notch' : 'inspect';
    default: return 'inspect';
  }
}
function curFit() { return st.tab === 'bridge' ? st.bridge : st.fit; }
function hintText() {
  const t = tool();
  switch (t) {
    case 'multi': return '区画・構造物・装備をタップして選択に追加／もう一度で解除';
    case 'unpart': return '撤去する区画・構造物をタップ（対称の相手も外れます）';
    case 'part': {
      const spec=activeEquipment();if(spec)return `面をタップして${spec.name}を配置${spec.k==='engine'?'（寸法で推力が変化）':''}`;
      const k = st.part, nm = C.PARTS[k].name;
      if (k === 'struct') return `面をタップして${st.structPlate ? '装甲外板' : st.structLight ? '軽構造' : '構造物'}（${st.structSize.map(v => Math.round(v)).join('×')} m${st.structPlate ? `・装甲 ${num(st.structPlateT, 1)} m` : ''}）を据える`;
      return `面をタップして${nm}（${fmtM(pSize(k))}・${PLACE.find(p => p[0] === st.placeBy[k])[1]}）を置く`;
    }
    case 'select': return st.tab==='launch'?'航空区画を選んで出口を設定。航空隊の機種と機数は下の欄で編集できます':st.sel?.list === 'parts' ? '選択中の区画は枠ごとドラッグで移動・別の区画はタップで選択' : st.view === 'normal' ? '区画をタップで選択（内部は透視で）・選ぶとドラッグで移動' : '区画をタップで選択・選ぶとドラッグで移動';
    case 'fit': return (C.FITS[curFit()].pod?`構造物・艦橋本体の壁をタップして${C.FITS[curFit()].name}を設置`:`面をタップして${C.FITS[curFit()].short}を設置（${weaponTiltMode(curFit())?'斜面では面に沿って傾ける':'傾斜には支持台'}）`)+(ship?.parts.some(p=>p.plate)?'・装甲外板には付けられません':'');
    case 'unfit': return '撤去する装備をタップ';
    case 'adjust': return st.sel?.list === 'fits' ? '選択中の装備はドラッグで面に沿って移動・別の装備はタップで選択' : '装備をタップして選択・選ぶとドラッグで移動';
    case 'notch': return `外面をタップして ${st.notch.l}×${st.notch.w}×深さ${st.notch.d} m を切り欠く`;
    case 'solid': return st.cutterAction === 'move' ? 'ドラッグでカッターを移動。重ね終えたら「重なりを切り取る」' : st.cutterAction === 'camera' ? 'ドラッグで視点を回転。半透明の立体が切り取る範囲です' : '船体をタップしてカッターを置く。寸法と位置を調整してから切り取る';
    default: return 'タップで詳細を表示';
  }
}
function updateHint() { const h = $('#hint'); if (h) h.textContent = hintText(); }
function extentAlong(k, size, n) {
  const sh = C.PARTS[k].shape;
  if (sh === 'sphere') return size / 2;
  if (sh === 'cube') return size / 2 * (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]));
  const l = size * C.PARTS[k].ratio; return Math.abs(n[0]) * l / 2 + Math.hypot(n[1], n[2]) * size / 2;
}
function partPreview(hit){let p=unalignedPartPreview(hit);const tpl=activeTemplate('parts',p.k);if(tpl){const own=Object.fromEntries(Object.entries(p).filter(([,v])=>v!==undefined));p=Object.assign(JSON.parse(JSON.stringify(tpl.data)),own,{id:-1});}p.c=C.alignedPosition(ship,p.c,st.alignment);return p;}
function unalignedPartPreview(hit) {
  const spec=activeEquipment();if(spec)return equipmentPreview(hit,spec);
  const k = st.part;
  if (k === 'struct') {
    const [l, w, hh] = st.structSize, n = hit.n, ax = Math.abs(n[1]) >= Math.abs(n[2]) && Math.abs(n[1]) >= Math.abs(n[0]) ? 1 : Math.abs(n[2]) >= Math.abs(n[0]) ? 2 : 0;
    const ext = [l / 2, hh / 2, w / 2][ax], c = hit.p.slice();
    if (hit.kind !== 'section') c[ax] += Math.sign(n[ax] || 1) * ext * 0.6;
    return C.alignStructure({id:-1,k,c,s:[l,w,hh],pitch:st.structPitch||0,roll:st.structRoll||0,taper:st.structTaper,form:st.structForm,skinAsset:st.structForm==='reference'?st.skinAsset:undefined,angles:st.structAngles.slice(),yaw:st.structYaw,offsetX:st.structOffsetX,offsetZ:st.structOffsetZ,...(st.structForm==='shell'?{shellCurve:st.shellCurve??1,shellThick:st.shellThick??3,shellFlip:!!st.shellFlip}:{}),...(st.structPlate?{plate:true,plateT:st.structPlateT}:st.structLight?{light:true}:{})},hit,st.surfaceMode);
  }
  const size = pSize(k);
  let c;
  if (hit.kind === 'section') c = hit.p.slice();
  else {
    const e = C.PARTS[k].shape==='cube'?(Math.abs(hit.n[0])*st.roomSize[0]+Math.abs(hit.n[1])*st.roomSize[2]+Math.abs(hit.n[2])*st.roomSize[1])/2:extentAlong(k, size, hit.n), mode = st.placeBy[k];
    const mg = craftDesign() ? .03 : 1, off = mode === 'inside' ? -(e + mg) : mode === 'partial' ? -e * 0.4 : e * 0.92;
    c = C.add(hit.p, C.mul(hit.n, off));
  }
  return {id:-1,k,c,d:size,...(C.PARTS[k].shape==='cube'?{room:craftDesign()?[size*1.4,size,size*.8].map(v=>+v.toFixed(2)):(st.roomSize||[120,60,24]).slice()}:{}),...(k==='engine'?{dir:st.engineDir.slice(),reactor:st.reactor}:{}),...(k==='astromech'?{dir:[0,1,0]}:{}),...(k==='cockpit'?{seats:1}:{})};
}
function notchBox(hit) {
  const n = hit.n, a = Math.abs(n[0]) > Math.abs(n[1]) && Math.abs(n[0]) > Math.abs(n[2]) ? 0 : Math.abs(n[1]) >= Math.abs(n[2]) ? 1 : 2;
  const {l, w, d} = st.notch, big = Math.max(ship.hull.W, ship.hull.H, ship.hull.L) * 0.6, p = hit.p, s = Math.sign(n[a] || 1);
  const b = [0, 0, 0, 0, 0, 0], half = [0, 0, 0];
  if (a === 0) { half[1] = w / 2; half[2] = l / 2; } else if (a === 1) { half[0] = l / 2; half[2] = w / 2; } else { half[0] = l / 2; half[1] = w / 2; }
  for (let k = 0; k < 3; k++) {
    if (k === a) { const lo = s > 0 ? p[k] - d : p[k] - big, hi = s > 0 ? p[k] + big : p[k] + d; b[k] = lo; b[k + 3] = hi; }
    else { b[k] = p[k] - half[k]; b[k + 3] = p[k] + half[k]; }
  }
  return b;
}
function ghostFor(hit) {
  const t = tool(), ls = Gfx.lineSet(), ok = [95, 196, 138, 255], ng = [236, 106, 92, 255], cy = [105, 195, 220, 255];
  if (!hit) return null;
  if (t === 'part' && !hit.fit && hit.kind !== undefined) {
    const pt = partPreview(hit);
    ls.part(pt, pt.k!=='struct'&&C.hardConflicts(ship,pt).length?ng:ok);
    if (st.mirror && Math.abs(pt.c[2]) > 2) { const q = C.mirrorPart(pt,ship); ls.part(q, [95, 196, 138, 150]); }
    if (st.vmirror) { const v = C.vmirrorPart(pt, ship); ls.part(v, [95, 196, 138, 120]); if (st.mirror && Math.abs(pt.c[2]) > 2) ls.part(C.mirrorPart(v, ship), [95, 196, 138, 90]); }
  } else if (t === 'fit' && hit.p && !hit.fit && hit.kind !== 'section') {
    const k = curFit(), d = C.FITS[k],normal=weaponPlacementNormal(k,hit.n);
    let a = 2; if (d.cat !== 'b') { let bv = -2; for (let i = 0; i < 6; i++) { const v = C.dot(C.AXES[i], normal); if (v > bv) { bv = v; a = i; } } }
    const tilt=weaponTiltMode(k)?C.fitTilt(normal):null;
    const f = C.mountFit(ship, {id:-1,k,p:alignFitPoint(hit.p,hit.n).slice(),n:normal.slice(),a,ped:st.ped,...(['trench','casemate'].includes(st.weaponMount)&&d.cat==='w'?{localMount:true}:{}),...(tilt?{tilt}:{})});
    const bad = f.float || (d.casemate&&Math.abs(normal[1])>.65) || (d.cat === 'b' && !d.window && hit.n[1] < 0.2) || C.fitClash(ship, f);
    ls.box(C.fitAABB(f), bad ? ng : ok);
  } else if ((t === 'unfit' || t === 'adjust' || t === 'inspect') && hit.fit) {
    ls.box(C.fitAABB(hit.fit), t === 'unfit' ? ng : cy);
  } else if (t === 'select' && hit.part) {
    ls.part(hit.part, cy);
  } else if (t === 'notch' && (hit.kind === 'hull' || st.notchStructures && hit.part?.k === 'struct')) {
    ls.box(notchBox(hit), ng);
  } else return null;
  return ls;
}
function refreshOverlay() {
  if (!view || !ship) return;
  refreshSolidCutterOverlay();
  const ls = Gfx.lineSet(), it = selItem(), cy = [105, 195, 220, 255];
  // While the engine recomputes, outline the part's requested shape, not its old merged cells.
  const shape = (p) => p && (enginePending() && p._packing ? {...p, _packing: undefined} : p);
  if (it && st.sel.list === 'parts' && (st.tab === 'mod'||st.tab==='launch'||st.tab==='bridge'&&st.bridgeMode==='body')) {
    ls.part(shape(it), cy); const tw = twinOfItem('parts', it); if (tw) ls.part(shape(tw), [105, 195, 220, 140]);
    const vt = it.vt != null ? ship.parts.find(q => q.id === it.vt) : null; if (vt) { ls.part(shape(vt), [105, 195, 220, 140]); const vtw = twinOfItem('parts', vt); if (vtw) ls.part(shape(vtw), [105, 195, 220, 100]); }
  }
  // Parts that touch neither the hull nor anything connected to it are outlined in red.
  if (S?.ungrounded && fleet.mode === 'design') { const red = [255, 86, 76, 255], gp = new Set(S.ungrounded.parts), gf = new Set(S.ungrounded.fits); for (const p of ship.parts) if (gp.has(p.id)) ls.part(shape(p), red); for (const f of ship.fits) if (gf.has(f.id)) ls.box(C.fitAABB(f), red); }
  if (tool() === 'multi') { const am = [240, 170, 70, 255]; for (const p of ship.parts) if (st.multi.parts.has(p.id)) ls.part(shape(p), am); for (const f of ship.fits) if (st.multi.fits.has(f.id)) ls.box(C.fitAABB(f), am); }
  if (it && st.sel.list === 'fits' && (armMode() || st.tab === 'bridge')) { ls.box(C.fitAABB(it), cy); for (const l of fitLinks(it)) ls.box(C.fitAABB(l.fit), [105, 195, 220, 130]);const room=C.commandCompartments(ship).find(p=>p.windowId===it.id);if(room)ls.part(room,[142,229,192,255]); }
  const base = ls.out();
  if (hoverLines) {
    const h = hoverLines.out(), pos = new Float32Array(base.pos.length + h.pos.length), col = new Uint8Array(base.col.length + h.col.length);
    pos.set(base.pos); pos.set(h.pos, base.pos.length); col.set(base.col); col.set(h.col, base.col.length);
    view.setLines('ghost', {pos, col});
  } else view.setLines('ghost', base);
  requestDraw();
}
function onHover(px, py) {
  if(fleet.mode!=='design'||trial.on)return;
  if (!ship || !view) return;
  const t = tool();
  if(t === 'solid') return;
  hoverLines = ghostFor(pick(px, py, {parts: t === 'select' || t === 'multi' || t === 'unpart', fits: t === 'unfit' || t === 'adjust' || t === 'inspect' || t === 'fit' || t === 'multi'}));
  refreshOverlay();
}
function clearHover() { hoverLines = null; refreshOverlay(); }

function onTap(px, py) {
  if(trial.on)return;
  if(fleet.mode!=='design'){fleetTap(px,py);return;}
  if(!view)return;
  const t = tool();
  if(t === 'solid') { if(st.cutterAction === 'place') { const hit=pick(px,py,{parts:true,fits:false}); if(hit?.p)placeSolidCutter(hit);else toast('カッターを重ねる船体・構造物をタップしてください'); } return; }
  tapHit(t, pick(px, py, tapWant(t)));
}
// Alignment snaps the placement point, except along the face normal (that
// coordinate stays on the tapped face).
function alignFitPoint(p, n) { if (!st.alignment || st.alignment === 'none') return p; const q = C.alignedPosition(ship, p, st.alignment); for (let a = 0; a < 3; a++) if (Math.abs(n[a]) > .7) q[a] = p[a]; return q; }
function tapWant(t) { return {parts: t === 'select' || t === 'multi' || t === 'unpart' || t === 'inspect' || (t === 'notch' && st.notchStructures), fits: t !== 'part' && t !== 'notch' && t !== 'unpart'}; }
function tapHit(t, hit) {
  hoverLines = null;
  switch (t) {
    case 'inspect': showInspect(hit); break;
    case 'select':
      if(hit?.part?.windowId||hit?.part?.weaponId){openLayoutTarget({list:'fits',id:hit.part.windowId||hit.part.weaponId});break;}
      if (hit && hit.part) { if(st.tab==='launch'&&hit.part.k!=='hangar'){toast('航空区画を選択してください');break;}st.sel = {list: 'parts', id: hit.part.id}; renderPanel(); }
      else { st.sel = null; renderPanel(); toast(st.view === 'normal' ? '内部の区画は「透視」で選べます' : '区画が見つかりません'); }
      break;
    case 'part': {
      if (!hit || hit.fit) { toast('船体か構造物の面をタップしてください'); break; }
      const pv = partPreview(hit), k = pv.k;
      let made = null;
      if (mutate(`${C.PARTS[k].name}を配置`, () => { made = C.placePart(ship, k, pv.c, k === 'struct' ? pv.s : pv.d, pv, st.mirror); try { placeVerticalParts(made); } catch (e) { removeLinked('parts', made); made = null; throw e; } }, 'parts') && made) {
        showPreview('parts', linkedItems('parts', made));
        st.sel = {list: 'parts', id: made.id}; renderPanel();
      }
      break;
    }
    case 'fit': {
      if (!hit || hit.kind === 'section') { toast('船体の外面をタップしてください'); break; }
      if (hit.fit) { toast('その場所には装備があります'); break; }
      const k = curFit(); let err = null, made = null;
      mutate(C.FITS[k].short + 'を設置', () => { const opts = {localMount:['trench','casemate'].includes(st.weaponMount),tilt:weaponTiltMode(k)}, r = C.placeFit(ship, k, alignFitPoint(hit.p, hit.n), weaponPlacementNormal(k,hit.n), st.ped, st.mirror, opts); err = r.err; made = r.fit; if (made) { placeVerticalFits(made, k, st.ped, opts); applyPedDefaults(made); applyFitTemplate(made); } }, 'fits', {silent: true});
      if (err) toast(err); else if (made) { showPreview('fits', linkedItems('fits', made)); st.sel = {list: 'fits', id: made.id}; renderPanel(); }
      break;
    }
    case 'multi': multiToggle(hit); break;
    case 'unpart':
      if (hit && hit.part && hit.part.id > 0 && ship.parts.some(p => p.id === hit.part.id)) { removeWithPreview('撤去', 'parts', ship.parts.find(p => p.id === hit.part.id)); if (st.sel?.list === 'parts' && !findSel(st.sel)) st.sel = null; renderPanel(); }
      else toast(st.view === 'normal' ? '撤去する区画・構造物をタップしてください（内部の区画は「透視」で選べます）' : '撤去する区画・構造物をタップしてください');
      break;
    case 'unfit':
      if (hit && hit.fit) removeWithPreview('撤去', 'fits', hit.fit);
      else toast('撤去する装備をタップしてください');
      break;
    case 'adjust':
      if (hit && hit.fit) { st.sel = {list: 'fits', id: hit.fit.id}; showInspect(hit); renderPanel(); }
      else { st.sel = null; renderPanel(); }
      break;
    case 'notch':
      if (!hit || (hit.kind !== 'hull' && !(st.notchStructures && hit.part?.k === 'struct'))) { toast('船体・対象構造の外面をタップしてください'); break; }
      mutate('切り欠き', () => {
        const b = notchBox(hit); ship.subs.push({id: ship.nextId++, structures:st.notchStructures, b});
        if (st.mirror && b[2] > 1) ship.subs.push({id: ship.nextId++, structures:st.notchStructures, b: [b[0], b[1], -b[5], b[3], b[4], -b[2]]});
        else if (st.mirror && b[5] < -1) ship.subs.push({id: ship.nextId++, structures:st.notchStructures, b: [b[0], b[1], -b[5], b[3], b[4], -b[2]]});
      }, 'hull');
      renderPanel();
      break;
  }
  refreshOverlay(); updateHint();
}

// ---------- inspect ----------
function showInspect(hit) {
  const box = $('#inspect');
  if (!hit) { hideInspect(); return; }
  let html = '';
  if (hit.fit) {
    const f = hit.fit, d = C.FITS[f.k];
    html = `<b>${esc(d.name)}</b>`;
    const ped = f.base + f.ped;
    html += `<div class="ins-row">支持台 ${ped.toFixed(1)} m（自動 ${f.base.toFixed(1)}＋追加 ${f.ped.toFixed(1)}）・${esc(C.AXNAME[f.a])}${f.tilt?` · 面に沿って ${Math.round(Math.acos(C.clamp(C.dot(f.tilt,C.AXES[f.a]),-1,1))*180/Math.PI)}° 傾斜`:''}</div>`;
    if (d.cat === 'w') {
      const arc = (S && S.fitInfo[f.id]) || C.fireArcs(ship, f);
      if (d.tt) html += `<div class="ins-row">一斉射 ${fTT(d.tt)}・電力 ${fW(d.power)}</div>`;
      const fd = S && S.feedInfo && S.feedInfo[f.id]; if (fd) html += `<div class="ins-row">配電路 ${ja(fd[0])} m³（${feedSrc(fd)} ${num(fd[1])} m）</div>`;
      if (Array.isArray(arc)) html += `<div class="arcs">${C.SECTORS.map((s, k) => `<span><i>${s.name}</i><em style="--w:${Math.round(arc[k] * 100)}%"></em><b>${Math.round(arc[k] * 100)}</b></span>`).join('')}</div><div class="ins-note">射界（%）：各方向へ撃てる割合</div>`;
    } else {
      const vw = S && S.fitInfo[f.id];
      html += `<div class="ins-row">視界 ${vw != null ? fPct(vw) : '—'}・乗員 ${d.crew}名</div>`;
    }
  } else if (hit.part) {
    html = partInfoHTML(hit.part);
  } else if (hit.p) {
    const x = hit.p[0], sb = C.sectionBase(ship.hull, Math.max(0, Math.min(ship.hull.L, x))), kb = C.keelAt(ship, x);
    html = `<b>船体</b><div class="ins-row">艦尾から ${fLen(x)}・この断面 幅 ${fLen(sb.hw * 2)} × 高さ ${fLen(sb.h)}</div>`;
    if (kb) html += `<div class="ins-row">竜骨 幅 ${fLen(kb.w)} × 高さ ${fLen(kb.h)}</div>`;
    html += `<div class="ins-row">外殻装甲 ${ship.armor.hull.toFixed(2)} m</div>`;
  }
  box.innerHTML = html + '<button type="button" class="ins-x" aria-label="閉じる">×</button>';
  box.hidden = false;
}
function hideInspect() { const b = $('#inspect'); if (b) b.hidden = true; }
function partInfoHTML(pt) {
  const d = C.PARTS[pt.k], V = C.partVolume(pt), inf = S && S.info[pt.id];
  let h = `<b>${esc(C.partLabel(pt))}</b><div class="ins-row">${pt.k === 'struct'||pt.room ? `${(pt.room||pt.s).map(v => Math.round(v)).join('×')} m` : `${pt.k === 'hangar' ? '一辺' : '直径'} ${precisePartSize(pt) ? num(pt.d, 2) + ' m' : fLen(pt.d)}`}・体積 ${ja(V)} m³</div>`;
  if (C.isReactor(pt)) h += `<div class="ins-row" data-reactor-output>発電出力（体積換算） ${reactorOutputText(pt)}</div>`;
  if (pt.k === 'automation') { const V2 = C.partVolume(pt); h += `<div class="ins-row" data-auto-output>受け持てる持ち場 ${num(Math.floor(V2 / C.AUTO_M3_PER_CREW))} 名分 · 消費電力 ${fW(V2 / C.AUTO_M3_PER_CREW * C.AUTO_W_PER_CREW)}${S && S.autoCrew ? `<br>艦全体で ${num(S.autoCrew)} 名分を受け持ち中（全持ち場の ${fPct(S.autoCrew / Math.max(1, S.crewBase))}）` : ''}</div>`; }
  if (pt.k === 'battery') { const ci = S && S.feedCellInfo && S.feedCellInfo[pt.id], cap = ci ? ci[0] : V * C.CELL_ENERGY_DENSITY / C.CELL_DISCHARGE_S; h += `<div class="ins-row" data-cell-output>蓄電量 ${sci(V * C.CELL_ENERGY_DENSITY)} J · 武装へ出せる電力 ${fW(cap)}${ci ? `<br>近くの武装へ給電中 ${fW(ci[1])}（${fPct(ci[1] / Math.max(1, cap))}）` : ''}</div>`; }
  if (['shield','localShield'].includes(pt.k)) h += `<div class="ins-row" data-equipment-performance>シールド出力（体積換算） ${fW(V * C.K.shieldW)}<br>蓄積容量 ${sci(C.shieldLoad(pt))} J</div>`;
  if (pt.k === 'hyper') h += `<div class="ins-row" data-equipment-performance>有効容量 ${ja(C.hyperCapacity(pt))} m³・跳躍消費 ${fW(C.hyperCapacity(pt) * C.K.hyperW)}</div>${S ? `<div class="ins-row">艦全体の主機クラス ${S.hyperClass == null ? 'なし' : num(S.hyperClass, 1)}</div>` : ''}`;
  if (pt.k === 'engine') h += `<div class="ins-row" data-equipment-performance>推力（寸法換算） ${sci(C.nozzleThrust(pt))} N<br>消費電力（寸法換算） ${fW(C.nozzleDemand(pt))}</div>`;
  if (pt.k === 'hangar') h += `<div class="ins-row">${esc(C.AVIATION_ROLES[pt.airRole]||'格納・発着兼用')} · 容量 ${C.hangarCapacity(pt).toFixed(2)} サイズ${inf ? (inf.acc ? '・発着路接続' : '・発着路未接続') : ''}</div>`;
  if(pt.k==='engine'){const r=C.reactorFor(ship,pt),path=C.enginePaths(ship).find(q=>q.nozzle===pt.id);h+=`<div class="ins-row">${r?'接続炉 #'+r.id:'炉に未接続'}${path?'・自動機関 '+ja(C.partVolume(path))+' m³':''}</div>`;}
  if (pt.k === 'engine' && inf) h += `<div class="ins-row">${inf.vent ? '噴射口が開いています' : '噴射口が塞がり推力ゼロ'}</div>`;
  if (inf && pt.k !== 'struct') h += `<div class="ins-row">船体内 ${fPct(inf.inside)}・表面の露出 ${fPct(inf.exposed)}${inf.overlap ? '・<span class="neg">他の区画と重なっています</span>' : ''}</div>`;
  if (pt.k === 'struct' && pt.plate) h += `<div class="ins-row">装甲外板・厚さ ${num(C.plateThickness(pt), 1)} m${inf ? `・表面の露出 ${fPct(inf.exposed)}` : ''}<br>武装・艦橋ポッドは取り付けられません</div>`;
  else if (pt.k === 'struct' && pt.light) h += `<div class="ins-row">軽構造・質量と強度は通常の構造物の ¼</div>`;
  return h;
}

// ---------- toast ----------
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.innerHTML = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
function toastDiff(label, a, b) {
  const items = [];
  const pct = (x, y) => x > 0 ? (y - x) / x : 0;
  const add = (name, v, good) => { if (Math.abs(v) >= 0.005) items.push([Math.abs(v), `<span class="${(v > 0) === good ? 'up' : 'down'}">${name} ${v > 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%</span>`]); };
  add('質量', pct(a.mass, b.mass), false);
  add('加速', pct(a.accelG, b.accelG), true);
  add('表面積', pct(a.area, b.area), false);
  add('出力', pct(a.power, b.power), true);
  add('一斉射', pct(a.alphaTot, b.alphaTot), true);
  add('シールド', pct(a.shieldPct, b.shieldPct), true);
  add('搭載機', pct(a.slots, b.slots), true);
  items.sort((x, y) => y[0] - x[0]);
  toast(`<b>${esc(label)}</b>${items.slice(0, 3).map(x => x[1]).join('')}`);
}

// ---------- stat strip & spec ----------
function renderStrip() {
  if (!S) return;
  const warn = S.warnings.filter(w => w.lv !== 'info');
  const bad = warn.some(w => w.lv === 'bad');
  $('#statstrip').innerHTML = `
    <span class="ss"><i>全長</i><b>${fLen(S.hullLen)}</b></span>
    <span class="ss"><i>質量</i><b>${fMass(S.mass)}</b></span>
    <span class="ss"><i>出力</i><b>×${S.xISD >= 0.1 ? S.xISD.toFixed(2) : S.xISD.toFixed(3)}<small>ISD</small></b></span>
    <span class="ss"><i>加速</i><b>${fG(S.accelG)}</b></span>
    <span class="ss"><i>一斉射</i><b>${fTT(S.alphaTot)}</b></span>
    <span class="ss-flag ${bad ? 'bad' : warn.length ? 'warn' : 'ok'}" aria-label="警告 ${warn.length} 件">${warn.length ? warn.length : '✓'}</span>`;
}
function bar(frac, cls) { return `<span class="bar ${cls || ''}"><em style="width:${Math.max(0, Math.min(100, frac * 100)).toFixed(1)}%"></em></span>`; }
function radar(S) {
  const sc = scores(S), n = 6, R = 62, cx = 90, cy = 82;
  const pt = (k, r) => [cx + Math.sin(k / n * Math.PI * 2) * r, cy - Math.cos(k / n * Math.PI * 2) * r];
  let grid = '';
  for (const f of [0.33, 0.66, 1]) grid += `<polygon points="${sc.map((_, k) => pt(k, R * f).join(',')).join(' ')}" class="rg"/>`;
  const axes = sc.map((_, k) => { const p = pt(k, R); return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" class="rg"/>`; }).join('');
  const poly = sc.map((s, k) => pt(k, R * Math.max(0.04, s.v / 100)).join(',')).join(' ');
  const labels = sc.map((s, k) => { const p = pt(k, R + 13); return `<text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle" class="rl">${s.k}</text>`; }).join('');
  return `<svg class="radar" viewBox="0 0 180 168" role="img" aria-label="性能レーダー">${grid}${axes}<polygon points="${poly}" class="rp"/>${labels}</svg>`;
}
function scores(S) {
  const cl = (v) => Math.max(0, Math.min(100, v));
  const fpd = S.mass > 0 ? S.alphaBest / (S.mass / 1e6) : 0;
  return [
    {k: '火力', v: cl(100 * (1 - Math.exp(-fpd / 100)))},
    {k: '防御', v: cl(40 * Math.min(1, S.shieldPct / 1.5) + 35 * Math.min(1, S.armorHull / 1.5) + 25 * S.protectedFrac)},
    {k: '速力', v: cl(100 * Math.min(1, S.accelG / 4000))},
    {k: '航空', v: cl(100 * Math.min(1, (S.cls.hangarFrac || 0) / 0.3))},
    {k: '超空間', v: S.hyperClass ? cl(100 * (6 - S.hyperClass) / 5.5) : 0},
    {k: '耐久', v: cl(60 * Math.min(1, S.aStruct / Math.max(1e-9, S.aThrust || 1) / 1.5) + 40 * (1 - S.vuln))},
  ];
}
function specHTML(S) {
  if (!S) return '<p class="muted">計算中…</p>';
  const P = S.power || 1, d = S.draw, cmb = d.weapons + d.shields + 0.35 * d.engines + d.hotel + d.ray;
  const scale = Math.max(P, cmb);
  const segs = [['兵装', d.weapons, 'w'], ['シールド', d.shields, 's'], ['機関', 0.35 * d.engines, 'e'], ['その他', d.hotel + d.ray, 'o']];
  const maxSec = Math.max(1, ...S.alpha);
  const comp = [['gen', S.frac.gen], ['shield', S.frac.shield], ['hyper', S.frac.hyper], ['engine', S.frac.engine], ['hangar', S.frac.hangar]].filter(x => x[1] > 0);
  const rest = Math.max(0, 1 - comp.reduce((a, b) => a + b[1], 0));
  const warnHTML = S.warnings.length ? S.warnings.map(inspectionHTML).join('') : '<li class="w-ok">大きな問題はありません。</li>';
  return `
  <div class="spec-head">
    <div class="spec-cls"><span class="role">${esc(S.cls.role)}</span><span class="clsname">${esc(C.shipClassFor(S.hullLen, ship.shipClass).name)}</span><small class="firepower-class">火力区分 ${esc(S.cls.name)}</small></div>
    ${radar(S)}
  </div>
  <dl class="kv">
    <div><dt>全長×全幅×全高</dt><dd>${fLen(S.dims[0])} × ${fLen(S.dims[1])} × ${fLen(S.dims[2])}</dd></div>
    <div><dt>質量</dt><dd>${fMass(S.mass)}<small>装甲 ${fMass(S.armorMass)}</small></dd></div>
    <div><dt>主機出力</dt><dd>${fW(S.power)}<small>ISD比 ×${S.xISD.toFixed(2)}</small></dd></div>
    <div><dt>一斉射（全砲）</dt><dd>${fTT(S.alphaTot)}<small>主射界 ${fTT(S.alphaBest)}</small></dd></div>
    <div><dt>最大加速</dt><dd>${fG(S.accelG)}<small>MGLT ${S.MGLT}</small></dd></div>
    <div><dt>ハイパードライブ</dt><dd>${S.hyperClass ? 'クラス ' + S.hyperClass.toFixed(1) : 'なし'}<small>${S.hyperClass ? (S.jumpOK ? '跳躍電力 可' : '跳躍電力 不足') : ''}</small></dd></div>
    <div><dt>シールド強度</dt><dd>${fPct(S.shieldPct)}<small>${fW(S.shieldP)}</small></dd></div>
    <div><dt>装甲</dt><dd>外殻 ${S.armorHull.toFixed(2)} m<small>集中防御 ${S.armorCit.toFixed(1)} m${S.plateArea>0?` · 装甲外板 ${S.armorPlate.toFixed(1)} m（表面の ${fPct(S.plateShare||0)}）`:''}</small></dd></div>
    <div><dt>搭載機</dt><dd>${num(Math.floor(S.slots))} 機<small>容量 ${(S.aviation?.capacity||0).toFixed(2)} サイズ · 発艦可能 ${num(S.deployableSlots??S.slots)} 機</small></dd></div>
    <div><dt>格納サイズ</dt><dd>${num(C.shipStowSize(S.dims), 1)}<small>この艦を他の艦の格納庫に積むときの大きさ（艦載機1機分 = 1）${S.aviation?.shipEmbarked ? ` · 搭載艦 ${num(S.aviation.shipEmbarked)} 隻` : ''}</small></dd></div>
    <div><dt>乗員</dt><dd${S.habit < 1 ? ' class="neg"' : ''}>${num(S.crewAboard ?? S.crew)} / ${num(S.crew)} 名<small>${S.habit >= 1 ? '全員乗艦' : '不足 ' + num(S.crew - (S.crewAboard ?? 0)) + ' 名'} · うち武装 ${num(S.weaponCrew || 0)} 名 · 乗艦可能 ${num(S.personCapacity ?? S.crewCapacity ?? 0)} 名（配電路 ${ja(S.feedVolume || 0)} m³ を除く）${(S.autoCrew || 0) > 0 ? ` · 自動化 ${num(S.autoCrew)} 名分` : ''}</small></dd></div>
    <div><dt>兵員枠</dt><dd>${num(S.troopCapacity || 0)} 名<small>乗艦可能から定員を除いた人数${S.ground?.troops?.used || S.ground?.droids?.used ? ` · 搭載 ${[S.ground.troops.used ? num(S.ground.troops.embarked) + ' 名' : '', S.ground.droids.used ? '停止保管ドロイド ' + num(S.ground.droids.embarked) + ' 体' : ''].filter(Boolean).join('・')}` : ''}</small></dd></div>
    <div><dt>残り内容積</dt><dd>${ja(S.unassignedVolume || 0)} m³<small>内容積 ${ja(S.envelopeVolume || 0)} m³ の ${fPct((S.unassignedVolume || 0) / Math.max(1, S.envelopeVolume || 0))} · うち武装の配電路 ${ja(S.feedVolume || 0)} m³（${fPct(S.feedShare || 0)}）${(S.vlsCount || S.extCount) ? ` · ミサイル VLS ${num(S.vlsCount || 0)} 基（${ja(S.vlsVolume || 0)} m³）・外置き ${num(S.extCount || 0)} 基` : ''}</small></dd></div>
    <div><dt>建造費</dt><dd>${fCr(S.cost)}</dd></div>
    <div><dt>体積／表面積</dt><dd>${S.VS.toFixed(1)} m<small>${ja(S.volume)} m³ ／ ${ja(S.area)} m²</small></dd></div>
  </dl>
  ${S.craft?craftCombatHTML(S):''}
  <h4>電力配分（戦闘時）</h4>
  <div class="pbar" role="img" aria-label="戦闘時の電力配分">${segs.map(([n, v, c]) => `<em class="p-${c}" style="width:${(v / scale * 100).toFixed(2)}%" title="${n}"></em>`).join('')}${cmb > P ? `<i class="pmark" style="left:${(P / scale * 100).toFixed(2)}%"></i>` : ''}</div>
  <div class="plegend">${segs.map(([n, v, c]) => `<span><i class="p-${c}"></i>${n} ${S.power > 0 ? Math.round(v / P * 100) + '%' : '—'}</span>`).join('')}<span class="${S.rc === 0 ? 'neg' : ''}">兵装充電 ${fPct(S.rc)}</span></div>
  <h4>加速の上限</h4>
  <div class="lim"><span>推力</span>${bar(S.thrustG / Math.max(S.thrustG, S.structG, 1), 'b-e')}<b>${fG(S.thrustG)}</b></div>
  <div class="lim"><span>縦強度</span>${bar(S.structG / Math.max(S.thrustG, S.structG, 1), 'b-s')}<b>${fG(S.structG)}</b></div>
  ${S.weakAt != null ? `<p class="note">最弱断面：艦尾から ${fLen(S.weakAt)}。質量を削るか、構造物や竜骨を太くすると上がります。</p>` : ''}
  <h4>射界別の一斉射</h4>
  <div class="sect">${C.SECTORS.map((s, k) => `<div class="lim"><span>${s.name}</span>${bar(S.alpha[k] / maxSec, 'b-w')}<b>${fTT(S.alpha[k])}</b></div>`).join('')}</div>
  <p class="note">主射界効率 ${fPct(S.arcEff)}・点防御 ${S.aa.toFixed(0)}・ミサイル ${fTT(S.mslSalvo)}／20秒・命中補正 ${fPct(S.accuracy)}</p>
  ${bandRatesHTML(S)}${skinFacesHTML(S)}
  <h4>船体容積の内訳</h4>
  <div class="cbar">${comp.map(([k, f]) => `<em style="width:${(f * 100).toFixed(2)}%;background:${rgb(C.PARTS[k].col)}" title="${C.PARTS[k].name}"></em>`).join('')}<em style="width:${(rest * 100).toFixed(2)}%;background:var(--line-2)" title="その他"></em></div>
  <div class="clegend">${comp.map(([k, f]) => `<span><i style="background:${rgb(C.PARTS[k].col)}"></i>${C.PARTS[k].name} ${(f * 100).toFixed(1)}%</span>`).join('')}<span><i style="background:var(--line-2)"></i>空き容積（乗員・兵員の居住） ${(rest * 100).toFixed(1)}%</span></div>
  <p class="note">重要区画の防護 ${fPct(S.protectedFrac)}・ジェネレーター露出 ${fPct(S.genExpFrac)}・開放容積（格納庫）${fPct(S.cls.hangarFrac || 0)}${S.frac.struct > 0 ? `・構造物 ${ja(S.frac.struct * S.hullVolume)} m³` : ''}${S.plateArea > 0 ? `・装甲外板 ${ja(S.plateArea)} m²（装甲 ${fMass(S.plateMass || 0)}）` : ''}</p>
  <h4>点検</h4>
  <ul class="warns">${warnHTML}</ul>`;
}
// v21 A craft's figures as a carrier's complement in the voyage (the same scale as the craft types there).
function craftCombatHTML(S){
 const c=C.craftCombat(ship,S);if(!c)return '';const row=(k,v,n)=>`<div><dt>${k}</dt><dd>${v}<small>${n}</small></dd></div>`;
 return `<h4>艦載機としての性能（航行）</h4><dl class="kv">${row('速度',`${num(c.speed)} m/s`,`約 ${num(Math.round(c.speed/20))} MGLT・加速 ${fG(c.accelG)} から`)}${row('空戦',c.aa,`機首の砲と機動性${c.shield?'・シールド':''}${c.role==='bomber'?'（爆撃機は空戦が苦手）':''}`)}${row('対艦',num(c.strike),'魚雷・ミサイル・爆弾と砲')}${row('耐久',c.armor,`質量 ${fMass(S.mass)}${c.shield?'・シールドあり':''}`)}${row('役割',esc(S.cls.role),`格納サイズ ${num(c.size,1)}`)}</dl><p class="note">速度は MGLT（公式の亜光速性能）1 につき 20 m/s（インペリアル級 60 MGLT＝1,200 m/s）。比較：Xウイング（100 MGLT）速度 2,000・空戦 1.25・対艦 160・耐久 1.2、TIE/ln（100 MGLT）2,000・1.0・10・0.6、Aウイング（120 MGLT）2,400。空母の「航空隊」で機種に「設計した機体」としてこの設計（保存したもの）を選ぶと、航行ではこの性能で出撃します。</p>`;
}
function renderSpecTargets() {
  if(fleet.mode!=='design'){fleetRender();return;}
  const side = $('#specSide');
  if (isWide()) side.innerHTML = `<div class="spec-title"><h3>性能諸元</h3></div>` + trialCardHTML(true) + specHTML(S);
  if (st.tab === 'spec') { const p = $('#panel .spec-wrap'); if (p) p.innerHTML = specHTML(S); }
}
const isWide = () => window.matchMedia('(min-width: 1000px)').matches;

// ---------- panels ----------
// v18 The engine light colour: a named colour or the picker's #rrggbb (unset is blue-white).
const engineHex=v=>'#'+C.engineGlowRGB(v).map(x=>x.toString(16).padStart(2,'0')).join('');
function setEngineGlow(v){if(!ship||!C.engineGlowOK(v))return;v=v.toLowerCase();if((ship.engineGlow||'blue')===v)return;mutate('バーニア光の色',()=>{if(v==='blue')delete ship.engineGlow;else ship.engineGlow=v;},'view');renderPanel();requestDraw();}
function seg(name, opts, cur) {
  return `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-${name}="${v}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
}
function slider(id, label, v, min, max, step, out) {
  return `<label class="sl"><span class="sl-l">${label}</span><input type="range" id="sl-${id}" data-sl="${id}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${label}"><input class="sl-num" type="number" data-sl="${id}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${label} 数値"><output id="out-${id}">${out}</output></label>`;
}
function silhouette(hp) {
  const pts = [], n = 28;
  for (let k = 0; k <= n; k++) { const t = k / n, w = C.profileAt(hp,t)[1]; pts.push([4 + t * 92, 20 - w * 15]); }
  for (let k = n; k >= 0; k--) { const t = k / n, w = C.profileAt(hp,t)[1]; pts.push([4 + t * 92, 20 + w * 15]); }
  return `<svg viewBox="0 0 100 40" aria-hidden="true"><polygon points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/></svg>`;
}
function partCard(k, sel) {
  const d = C.PARTS[k];
  return `<button type="button" class="part${sel ? ' on' : ''}" data-part="${k}" aria-pressed="${sel}"><i class="sw sh-${d.shape}" style="background:${rgb(d.col)}"></i><span class="pn">${d.name}</span><span class="pd">${esc(d.desc)}</span></button>`;
}
function fitBtn(k, sel, data) {
  const d = C.FITS[k];
  const spec = d.tt ? fTT(d.tt) : d.ion ? `対シールド ${d.ion}TT` : d.msl ? `${d.msl}TT／20秒` : d.sensor ? `視界係数 ${d.sensor}` : '牽引';
  return `<button type="button" class="fitb${sel ? ' on' : ''}" data-${data}="${k}" aria-pressed="${sel}"><span class="fn">${esc(d.name)}</span><span class="fs">${spec}・${d.pod?`直径 ${Math.round(d.fm)} m・高さ ${d.wm} m`:`${Math.round(d.fm)}×${Math.round(d.wm)}×${Math.round(d.hm)} m`}</span><span class="fd">${esc(d.desc)}${d.cycle?' 連射間隔 '+d.cycle+'秒。':''}</span></button>`;
}
const fmtM = (v) => Math.abs(v) < 20 && Math.abs(v - Math.round(v)) > .004 ? `${(Math.round(v * 100) / 100).toFixed(Math.abs(v) < 2 ? 2 : 1)} m` : `${Math.round(v)} m`;
function basePartEditor() {
  const it = selItem(); if (!it || st.sel.list !== 'parts') return '';
  const d = C.PARTS[it.k], hp = ship.hull, tw = twinOfItem('parts', it);
  let h = `<div class="editor"><div class="ed-head"><b>${esc(C.partLabel(it))}</b>${tw ? '<span class="tag">左右対</span>' : ''}<button type="button" class="btn sm ghost" data-desel>選択解除</button><button type="button" class="btn sm danger" data-delsel>撤去</button></div>
    <p class="note tight">位置は艦尾・船底・中心線からの距離です。</p>
    <div class="sliders">
    ${slider('ex', '前後 X', Math.round(it.c[0]), Math.round(-hp.L * 0.1), Math.round(hp.L * 1.1), 1, fmtM(it.c[0]))}
    ${slider('ey', '高さ Y', Math.round(it.c[1]), Math.round(-hp.H * 0.8), Math.round(hp.H * 3.5), 1, fmtM(it.c[1]))}
    ${slider('ez', '左右 Z', Math.round(it.c[2]), Math.round(-hp.W * 0.75), Math.round(hp.W * 0.75), 1, fmtM(it.c[2]))}`;
  if (it.k === 'struct' && it.form === 'reference' && C.equipmentSpec(it)) {
    h += `</div><p class="note tight">${esc(C.equipmentSpec(it).name)}は実寸の機器で、大きさは変えられません（${fmtM(it.s[0])} × ${fmtM(it.s[1])} × ${fmtM(it.s[2])}）。</p><div class="sliders">`;
  } else if (it.k === 'struct') {
    h += slider('el', '長さ', Math.round(it.s[0]), 10, Math.round(hp.L), 1, fmtM(it.s[0]))
      + slider('ew', '幅', Math.round(it.s[1]), 5, Math.round(hp.W * 1.2), 1, fmtM(it.s[1]))
      + slider('eh', '高さ', Math.round(it.s[2]), 5, Math.round(Math.max(60, hp.H * 1.5)), 1, fmtM(it.s[2]))
      + (['loft', 'roundloft', 'shell', 'arc', 'ellipsoid', 'outline', 'reference'].includes(it.form) ? '' : slider('et', '上すぼまり', Math.round((it.taper || 0) * 100), 0, 80, 1, Math.round((it.taper || 0) * 100) + '%'));
  } else if (it.room) {
    h += it.room.map((v,i)=>slider('room'+i,['長さ','幅','高さ'][i],v,4,[hp.L,hp.W,hp.H][i],1,fmtM(v))).join('');
  } else if (it.k === 'hangar') {
    h += `</div><div class="pgroup chips">${C.PARTS.hangar.sizes.map(s => `<button type="button" class="chip" data-hsize="${s}" aria-pressed="${it.d === s}">${s} m</button>`).join('')}</div><div class="sliders">`;
  } else if (d.fixed) {
    h += `</div><p class="note tight">固定寸法：直径 ${fmtM(it.d)}・長さ ${fmtM(it.length || C.partDims(it).l)}（この兵器の大きさは変えられません）</p><div class="sliders">`;
  } else if (C.equipmentSpec(it) && !C.parametricEngine(it) && it.k !== 'engine') {
    h += `</div><p class="note tight">${esc(C.equipmentSpec(it).name)}は実寸の機器で、大きさは変えられません。</p><div class="sliders">`;
  } else if (!C.parametricEngine(it)) {
    const precise = precisePartSize(it);
    h += slider('ed', '直径', precise ? it.d : Math.round(it.d), d.min, precise ? C.DESIGN_LIMITS.diameter : Math.max(it.d,Math.min(C.DESIGN_LIMITS.diameter,Math.max(d.max,hp.H*1.5))), precise ? .1 : 1, precise ? num(it.d, 2) + ' m' : fmtM(it.d));
  }
  h += `</div><div class="ed-info" id="edinfo">${partInfoHTML(it).replace(/^<b>[^<]*<\/b>/, '')}</div></div>`;
  return h;
}
function baseFitEditor() {
  const it = selItem(); if (!it || st.sel.list !== 'fits') return '';
  const d = C.fitSpec(it);
  return `<div class="editor"><div class="ed-head"><b>${esc(d.name)}</b><button type="button" class="btn sm ghost" data-desel>選択解除</button><button type="button" class="btn sm danger" data-delsel>撤去</button></div>
    ${fitPairHTML(it)}${fitPositionSliders(it)}
    <h4>支持台</h4>${seg('pedshapesel', PED_SHAPES, it.pedShape || 'round')}
    <div class="sliders">${slider('pedsel', '追加の高さ', it.ped.toFixed(1), 0, Math.max(60, Math.round(d.r * 4)), 0.5, `${it.ped.toFixed(1)} m`)}${slider('pedsizesel', '大きさ', Math.round((it.pedSize || 1) * 100), 40, 250, 5, Math.round((it.pedSize || 1) * 100) + '%')}</div>
    <p class="note" id="pedinfo">傾斜に合わせた自動の高さ ${it.base.toFixed(1)} m ＋ 追加 ${it.ped.toFixed(1)} m。高くすると射界が開けますが、標的にもなりやすくなります。</p></div>`;
}
function partList() {
  const items = ship.parts.filter(p => !(p.tw && p.id > p.tw));
  const nh = ship.parts.filter(p => p.k === 'hangar').length;
  if (!items.length && !nh) return '<p class="note">区画はまだありません。</p>';
  return `<div class="plist">${items.map(p => `<button type="button" class="chip${st.sel && st.sel.id === p.id ? ' on' : ''}" data-selpart="${p.id}"><i class="sw sh-${C.PARTS[p.k].shape}" style="background:${rgb(C.PARTS[p.k].col)}"></i>${esc(C.partLabel(p))}${p.k === 'struct' ? '' : ' ' + (p.room?p.room.map(Math.round).join('×'):Math.round(p.d)) + 'm'}${p.tw ? ' ×2' : ''}</button>`).join('')}${nh ? `<span class="chip ghost">航空区画 ${nh} 個</span>` : ''}</div>`;
}
function baseRenderPanel() {
  const p = $('#panel');
  if (!ship) return;
  if (st.sel && !findSel(st.sel)) st.sel = null;
  markTabs();
  let h = '';
  const hp = ship.hull;
  switch (st.tab) {
    case 'hull': {
      // The hull type is chosen when a design starts; editing keeps its outline controls.
      h = `<div class="pgroup sliders">
        ${slider('bowW', '艦首先端の絞り率（幅・厚み）', hp.bowW * 100, .5, 100, .1, `${num(hp.bowW * 100,1)}%`)}
        ${hp.plan === 'arrow' ? slider('stern', '艦尾幅', Math.round(hp.stern * 100), 20, 100, 1, `${Math.round(hp.stern * 100)}%`) : ''}
        ${hp.plan === 'arrow' && !hp.stations?.length ? slider('maxAt', '最大幅の位置（艦尾から）', Math.round((hp.maxAt ?? .3) * 100), 5, 90, 1, `${Math.round((hp.maxAt ?? .3) * 100)}% · ${fLen((hp.maxAt ?? .3) * hp.L)}`) : ''}
      </div>${hp.plan === 'arrow' && hp.stations?.length ? '<p class="note">断面を設計済みのため、最大幅の位置は下の表の「幅 %」で調整します。</p>' : ''}
      <div class="pgroup"><h4>断面</h4>${seg('sec', Object.entries(C.SECTIONS), hp.sec)}</div>
      <div class="pgroup"><h4>竜骨（主構造）</h4>${seg('keel', Object.entries(C.KEELS).map(([k, v]) => [k, v.name]), ship.keel || 'std')}<p class="note">竜骨は船底の中央を通る主構造で、縦強度の柱です。透視で見えます。区画が竜骨を断ち切ると、その断面は弱くなります。</p></div>

      <div class="pgroup row2"><button type="button" class="btn" id="btnClear">${confirmClear ? 'もう一度押すと区画と装備をすべて外します' : '区画と装備をすべて外す'}</button></div>`;
      break;
    }
    case 'mod': {
      const k = st.part;
      h = `<div class="pgroup">${seg('parttool', [['place', '配置'], ['select', '選択・調整'], ['multi', '複数選択'], ['remove', '撤去']], st.partTool)}</div>`;
      if (st.partTool === 'place') {
        h += `<div class="parts">${PART_KEYS.filter(t=>C.PARTS[t].group===st.group&&partOffered(t)).map(t => partCard(t, k === t&&!activeEquipment())).join('')}${craftDesign()?'':Object.values(C.EQUIPMENT).filter(d=>d.group===st.group).map(d=>equipmentCard(d.id)).join('')}</div>`;
        if (k === 'struct') {
          h += `<div class="pgroup sliders"><h4>構造物の大きさ</h4>
            ${craftDesign() ? slider('sl', '長さ', Math.min(st.structSize[0], hp.L), .05, Math.max(1, hp.L), .05, fmtM(st.structSize[0])) + slider('sw', '幅', Math.min(st.structSize[1], hp.W * 1.6), .05, Math.max(1, hp.W * 1.6), .05, fmtM(st.structSize[1])) + slider('sh', '高さ', Math.min(st.structSize[2], hp.H * 1.5), .02, Math.max(1, hp.H * 1.5), .02, fmtM(st.structSize[2])) : `${slider('sl', '長さ', st.structSize[0], 10, Math.round(hp.L), 1, fmtM(st.structSize[0]))}
            ${slider('sw', '幅', st.structSize[1], 5, Math.round(hp.W * 1.2), 1, fmtM(st.structSize[1]))}
            ${slider('sh', '高さ', st.structSize[2], 5, Math.round(Math.max(60, hp.H * 1.5)), 1, fmtM(st.structSize[2]))}`}
            ${['loft', 'roundloft', 'shell', 'arc', 'ellipsoid', 'outline', 'reference'].includes(st.structForm) ? '' : slider('st', '上すぼまり', Math.round(st.structTaper * 100), 0, 80, 1, Math.round(st.structTaper * 100) + '%')}</div>
            <p class="note">構造物は面の上に3割ほど沈めて据えます。船台構造物で反応炉の張り出しを覆うと露出が減り、縦強度も上がります。</p>`;
        } else {
          if (k === 'hangar') h += `<div class="pgroup"><h4>自動充填のセルサイズ</h4><div class="chips">${C.PARTS.hangar.sizes.map(s => `<button type="button" class="chip" data-psize="${s}" aria-pressed="${st.size.hangar === s}">${s} m</button>`).join('')}</div></div>`;
          else if(C.PARTS[k].fixed) h += `<div class="pgroup"><h4>固定寸法</h4><p class="note">直径 ${fmtM(C.PARTS[k].def)}・長さ ${fmtM(C.PARTS[k].def * C.PARTS[k].ratio)}。${C.SUPERWEAPONS[k]?.aim === 'bow' ? '艦首方向に固定して置きます。' : '置いた側の舷側方向に固定して置きます（左右対称で一対）。'}給電する炉は最寄りの炉に自動で接続し、選択して変えられます。</p></div>`;
          else if(!activeEquipment()&&(C.PARTS[k].shape!=='cube'||craftDesign())) h += craftDesign() ? (()=>{const lm=C.partLimits(ship,k);return `<div class="pgroup sliders">${slider('psize', '直径', pSize(k), lm.min, lm.max, .05, sizeOut(k, pSize(k)))}</div>`;})() : `<div class="pgroup sliders">${slider('psize', '直径', st.size[k], C.PARTS[k].min, precisePartSize({k}) ? C.DESIGN_LIMITS.diameter : Math.min(C.DESIGN_LIMITS.diameter,Math.max(C.PARTS[k].max,hp.H*1.5)), precisePartSize({k}) ? .1 : 1, sizeOut(k, st.size[k]))}</div>`;
          h += `<div class="pgroup"><h4>置き方</h4>${seg('place', PLACE, st.placeBy[k])}<p class="note">内蔵：面の内側に収める／一部露出：3割ほど外に出す／外付け：面の外に据える。船内の任意の位置には「座標を指定して配置」を使います。</p></div>`;
          if (k === 'hangar') h += `<div class="pgroup sliders"><h4>自動充填</h4>
            ${slider('ffrom', '範囲（艦尾側）', Math.round(st.fill[0] * 100), 0, 95, 1, Math.round(st.fill[0] * 100) + '%')}
            ${slider('fto', '範囲（艦首側）', Math.round(st.fill[1] * 100), 5, 100, 1, Math.round(st.fill[1] * 100) + '%')}
            <div class="row2"><button type="button" class="btn primary" id="btnFill">空きを ${st.size.hangar} m 格納庫で埋める</button><button type="button" class="btn ghost" id="btnUnfill">航空区画をすべて外す</button></div>
            <p class="note">ほかの区画と竜骨を避けて、船体の内側だけを埋めます。</p></div>`;
        }
      } else if (st.partTool === 'multi') {
        h += multiPanelHTML();
      } else if (st.partTool === 'remove') {
        h += '<p class="note keep">撤去する区画・構造物を3D表示でタップします。左右・上下対称がオンなら対の部品も外れます。「元に戻す」で取り消せます。</p>';
      } else {
        h += partEditor() || '<p class="note">区画をタップするか、下の一覧から選んでください。</p>';
      }
      h += `<div class="pgroup"><h4>配置済みの区画</h4>${partList()}</div><div class="pinfo" id="pinfo"></div>`;
      break;
    }
    case 'launch':
      h = aviationPanelHTML()+`<div class="pinfo" id="pinfo"></div>`;
      break;
    case 'arm':
      h = `<div class="pgroup">${seg('fittool', [['place', '設置'], ['adjust', '調整・射界'], ['remove', '撤去'], ['multi', '複数選択']], st.fitTool)}</div>
      ${st.fitTool === 'adjust' ? (fitEditor() || '<p class="note">装備をタップして選んでください。</p>') : ''}${st.fitTool === 'multi' ? multiPanelHTML() : ''}
      ${st.fitTool === 'place' ? `<div class="pgroup sliders"><h4>支持台（新設時）</h4>${seg('pedshape', PED_SHAPES, st.pedShape)}${slider('ped', '追加の高さ', st.ped, 0, 40, 0.5, `${st.ped} m`)}${slider('pedsize', '大きさ', Math.round(st.pedSize * 100), 40, 250, 5, Math.round(st.pedSize * 100) + '%')}</div>` : ''}
      <div class="fits">${weaponKeys().map(k => fitBtn(k, st.fit === k, 'fit')).join('')}</div>
      <p class="note">砲塔は実寸で、新しく置くと砲身は艦首を向きます。傾斜面では接地面の高低差だけ支持台が自動で伸び、砲は水平を保ちます。「調整」で1基ずつ支持台の形・高さ・大きさを変えられます。</p>
      <div class="pinfo" id="pinfo"></div>`;
      break;
    case 'bridge':
      h = `<div class="pgroup">${seg('bridgetool', [['place', '設置'], ['adjust', '調整'], ['remove', '撤去']], st.bridgeTool)}</div>
      ${st.bridgeTool === 'adjust' ? (fitEditor() || '<p class="note">艦橋をタップして選んでください。</p>') : ''}
      ${st.bridgeTool === 'place' ? `<div class="pgroup sliders">${slider('ped', '支持台の追加の高さ（新設時）', st.ped, 0, 40, 0.5, `${st.ped} m`)}</div>` : ''}
      <div class="fits">${BRIDGES.map(k => fitBtn(k, st.bridge === k, 'bridge')).join('')}</div>
      <p class="note">艦橋は上向きの面に置きます。周囲が開けているほど視界（命中補正）が上がります。</p>
      <div class="pinfo" id="pinfo"></div>`;
      break;
    case 'armor':
      h = `<div class="pgroup sliders">
        ${craftDesign() ? slider('arh', '外殻装甲の厚さ', ship.armor.hull, 0, .2, .001, `${(ship.armor.hull * 1000).toFixed(0)} mm`) : slider('arh', '外殻装甲の厚さ', ship.armor.hull, 0, C.ARMOR_MAX.hull, 0.05, `${ship.armor.hull.toFixed(2)} m`)}
        ${slider('arc', '集中防御（重要区画の囲い）', ship.armor.cit, 0, C.ARMOR_MAX.cit, 0.1, `${ship.armor.cit.toFixed(1)} m`)}
      </div>
      <p class="note">外殻装甲の質量は表面積に比例します。削って凹凸を増やすほど同じ厚さでも重くなります。集中防御はジェネレーター・シールド発生器・ハイパードライブの表面だけを囲み、露出した反応炉の弱点を補います。</p>
      <div class="pinfo" id="pinfo"></div>`;
      break;
    case 'carve': {
      const r = st.razee;
      h = `<div class="pgroup carve-tools">${seg('carvetool', [['solid', '立体で切る'], ['trench', 'トレンチ'], ['razee', '斜め削り'], ['notch', '面から切る'], ['plan', '平面の台形']], st.carveTool)}</div>`;
      if (st.carveTool === 'solid') h += solidCutPanelHTML();
      else if (st.carveTool === 'trench') h += trenchPanelHTML();
      else if (st.carveTool === 'plan') h += planCutControls();
      else if (st.carveTool === 'razee') {
        h += `<div class="pgroup razee">
          <p class="note">断面の角を斜めに削ぎ、台形にします。竜骨は残るので質量だけが減り、加速と縦強度の余裕が上がります。表面積は変わり、装甲とシールドの負担に響きます。</p>
          ${seg('rzside', [['both', '両舷'], ['port', '左舷'], ['stbd', '右舷']], r.side)}
          ${seg('rzedge', [['top', '上縁'], ['bottom', '下縁'], ['both', '上下']], r.edge)}
          <div class="sliders">
            ${slider('rzinset', '削り幅', r.inset, 2, Math.round(hp.W / 2), 1, fmtM(r.inset))}
            ${slider('rzslope', '傾斜の高さ', r.slope, 2, Math.round(hp.H), 1, fmtM(r.slope))}
            ${slider('rzfrom', '範囲（艦尾側）', Math.round(r.from * 100), 0, 95, 1, `${Math.round(r.from * 100)}%`)}
            ${slider('rzto', '範囲（艦首側）', Math.round(r.to * 100), 5, 100, 1, `${Math.round(r.to * 100)}%`)}
          </div>
          <label class="check"><input type="checkbox" id="rzprop" ${r.prop ? 'checked' : ''}> 船幅のすぼまりに合わせる</label>
          <button type="button" class="btn primary" id="btnRazee">ラザー化を加える</button>
        </div>`;
      } else {
        const n = st.notch;
        h += `<div class="pgroup sliders">
          ${slider('nl', '長さ', n.l, 5, Math.round(hp.L / 2), 1, fmtM(n.l))}
          ${slider('nw', '幅', n.w, 5, Math.round(hp.W), 1, fmtM(n.w))}
          ${slider('nd', '深さ', n.d, 2, Math.round(Math.max(hp.H, hp.W / 2)), 1, fmtM(n.d))}</div>
          ${seg('notchstructures', [['no','船体のみ'],['yes','船体と構造']], st.notchStructures?'yes':'no')}<p class="note">対象の外面をタップすると、その面から箱形に切り欠きます。格納庫の開口や砲座の段差に使えます。</p>`;
      }
      if(st.carveTool !== 'solid')h += `<details class="pgroup"><summary>ほかの加工の一覧</summary>${cutList()}</details>`;
      h += `<div class="pinfo" id="pinfo"></div>`;
      break;
    }
    case 'spec':
      h = `<div class="spec-wrap">${specHTML(S)}</div>`;
      break;
    case 'sim':
      h = simHTML();
      break;
  }
  p.innerHTML = h;
  renderPanelInfo();
  updateHint(); refreshOverlay();
  if (st.tab === 'sim') ensureOpponents();
}
function sizeOut(k, d) {
  const pt = {k, d, c: [0, 0, 0]}, V = C.partVolume(pt);
  if (C.isReactor(pt)) return `${num(d, 2)} m・${reactorOutputText(pt)}`;
  if (['shield','localShield'].includes(k)) return `${num(d, 2)} m・${fW(V * C.K.shieldW)}・蓄積 ${sci(C.shieldLoad(pt))} J`;
  if (k === 'hyper') return `${num(d, 2)} m・有効容量 ${ja(C.hyperCapacity(pt))} m³`;
  if (k === 'engine') return `${num(d, 2)} m・推力 ${sci(C.nozzleThrust(pt))} N`;
  return `${d} m`;
}
function cutList() {
  const rows = [];
  for (const c of ship.cuts) {if(c.type==='planTrapezoid'){rows.push(`<li><span><b>平面の台形切削</b>${{both:'両舷',port:'左舷',stbd:'右舷'}[c.side]} · ${Math.round(c.from*100)}〜${Math.round(c.to*100)}% · 中央幅 ${Math.round(ship.hull.W*c.remainingWidth)} m</span><button class="btn sm ghost" data-delcut="${c.id}">取り消す</button></li>`);continue;} rows.push(`<li><span><b>ラザー化</b>${{both: '両舷', port: '左舷', stbd: '右舷'}[c.side]}・${{top: '上縁', bottom: '下縁', both: '上下'}[c.edge]}・幅 ${Math.round(c.inset)} m・高さ ${Math.round(c.slope)} m・${Math.round(c.from * 100)}〜${Math.round(c.to * 100)}%</span><button type="button" class="btn sm ghost" data-delcut="${c.id}">取り消す</button></li>`);}
  for (const s of ship.subs) rows.push(`<li><span><b>切り欠き</b>${Math.round(s.b[3] - s.b[0])}×${Math.round(s.b[5] - s.b[2])}×${Math.round(Math.min(s.b[4] - s.b[1], 9999))} m・艦尾から ${Math.round((s.b[0] + s.b[3]) / 2)} m</span><button type="button" class="btn sm ghost" data-delsub="${s.id}">取り消す</button></li>`);
  return rows.length ? `<ul class="ilist">${rows.join('')}</ul>` : '<p class="note">まだ削っていません。</p>';
}
function renderPanelInfo() {
  const box = $('#pinfo'); if (!box || !S) return;
  let h = '';
  switch (armMode() ? 'arm' : st.tab) {
    case 'mod': h = `<div class="mini"><span>出力 ${fW(S.power)}（ISD比 ×${S.xISD.toFixed(2)}）</span><span>推力 ${fG(S.thrustG)}</span><span>シールド ${fPct(S.shieldPct)}</span><span>ハイパー ${S.hyperClass ? 'クラス' + S.hyperClass.toFixed(1) : 'なし'}</span><span>搭載機 ${num(Math.floor(S.slots))}</span><span>反応炉の露出 ${fPct(S.genExpFrac)}</span></div>`; break;
    case 'launch': { const a=S.aviation||C.aviationStatus(ship,S.info),closed=S.slidingHatches>0&&S.launch===0; h=`<div class="mini"><span>搭載 ${num(a.embarkedCount)} 機</span><span>${a.usedSize.toFixed(2)} / ${a.capacity.toFixed(2)} サイズ</span><span>発艦可能 ${num(a.deployableCount)} 機</span><span>${closed?'ハッチ閉鎖中':'発艦 '+S.launch.toFixed(2)+' 機/秒'}</span>${a.overflowSize>0?`<span class="neg">容量超過 ${a.overflowSize.toFixed(2)} サイズ</span>`:''}</div>`; break; }
    case 'arm': h = `<div class="mini"><span>一斉射 ${fTT(S.alphaTot)}</span><span>主射界 ${fTT(S.alphaBest)}（${fPct(S.arcEff)}）</span><span>兵装電力 ${Math.round(S.draw.weapons / Math.max(1, S.power) * 100)}%</span><span>配電路 ${fPct(S.feedShare || 0)}</span><span>兵装充電 ${fPct(S.rc)}</span></div>`; break;
    case 'bridge': h = `<div class="mini"><span>艦橋 ${S.bridges} 基</span><span>平均視界 ${fPct(S.view)}</span><span>命中補正 ${fPct(S.accuracy)}</span></div>`; break;
    case 'armor': h = `<div class="mini"><span>装甲質量 ${fMass(S.armorMass)}</span><span>表面積 ${ja(S.area)} m²</span><span>重要区画の防護 ${fPct(S.protectedFrac)}</span><span>脆弱性 ${fPct(S.vuln)}</span><span>加速 ${fG(S.accelG)}</span></div>`; break;
    case 'carve': h = `<div class="mini"><span>質量 ${fMass(S.mass)}</span><span>表面積 ${ja(S.area)} m²</span><span>体積／表面積 ${S.VS.toFixed(1)} m</span><span>加速 ${fG(S.accelG)}</span><span>縦強度 ${fG(S.structG)}</span></div>`; break;
  }
  box.innerHTML = h;
  const ei = $('#edinfo'), it = selItem();
  if (ei && it && st.sel.list === 'parts') ei.innerHTML = partInfoHTML(it).replace(/^<b>[^<]*<\/b>/, '');
}

// ---------- hull edits ----------
let confirmClear = false, confirmT = 0;
// Resizing the hull keeps internal compartments where they are by default.
// Items that sit on the outer surface (weapons, windows, structures, exposed
// machinery, notches) move with the surface so they stay attached.
st.hullFollow = 'surface';
const HULL_FOLLOW = [['surface', '外装だけ追従'], ['scale', 'すべて比率で追従'], ['keep', 'すべて位置を保持']];
function scaleContents(fx, fy, fz, mode = 'scale') {
  if (mode === 'keep') return;
  const sc = (p) => [p[0] * fx, p[1] * fy, p[2] * fz], outer = (p) => mode === 'scale' || p.k === 'struct' || !C.isInternal(p);
  const moved = new Set();
  for (const p of ship.parts) if (outer(p)) { p.c = sc(p.c); moved.add(p.id); }
  for (const h of ship.hatches) { if (h.bay && !moved.has(h.bay)) continue; h.a = sc(h.a); h.b = sc(h.b); if(h.portal&&!h.bay&&h.cut){h.cut=sc(h.cut.slice(0,3)).concat(sc(h.cut.slice(3)));} }
  for (const f of ship.fits) f.p = sc(f.p);
  for (const s of ship.subs) { const cx = (s.b[0] + s.b[3]) / 2, cy = (s.b[1] + s.b[4]) / 2, cz = (s.b[2] + s.b[5]) / 2, hx = (s.b[3] - s.b[0]) / 2, hy = (s.b[4] - s.b[1]) / 2, hz = (s.b[5] - s.b[2]) / 2; s.b = [cx * fx - hx, cy * fy - hy, cz * fz - hz, cx * fx + hx, cy * fy + hy, cz * fz + hz]; }
}
function setHullDims(L, W, H) {
  const hp = ship.hull, lim = C.DESIGN_LIMITS;
  const cr = C.isCraft(ship), r = v => cr ? Math.round(v * 100) / 100 : v;
  L = C.clamp(r(L), cr ? 1.5 : 60, lim.length); W = C.clamp(r(W), cr ? .5 : 20, lim.width); H = C.clamp(r(H), cr ? .3 : 10, lim.height);
  const fx = L / hp.L, fy = H / hp.H, fz = W / hp.W;
  scaleContents(fx, fy, fz, st.hullFollow); hp.L = L; hp.W = W; hp.H = H;
}
// Length, beam and depth: class-aware range, 1 m steps, typed values and nudges.
function refitOnGeometry() { eng.fitOnGeometry = true; eng.keepCam = true; }
function syncHullInputs(except) {
  const hp = ship.hull;
  for (const k of ['L', 'W', 'H']) { for (const q of $$(`#panel [data-sl="${k}"]`)) if (q !== except) q.value = Math.round(hp[k]); const o = $('#out-' + k); if (o) o.textContent = fLen(hp[k]) + (k === 'L' ? '' : ` · 全長比 ${(hp[k] / hp.L * 100).toFixed(1)}%`); }
}
function hullDimsHTML() {
  const hp = ship.hull, cls = C.shipClassFor(hp.L, ship.shipClass), lim = C.DESIGN_LIMITS;
  // v21 Craft hulls size in 0.1 m steps from a few metres.
  const cr = !!cls.craft, stp = cr ? .1 : 1, lo = cr ? Math.min(cls.min, hp.L) : Math.max(60, Math.min(cls.min, hp.L)), hi = Math.min(lim.length, Math.max(cls.max, hp.L));
  const wMax = Math.min(lim.width, Math.max(cr ? 4 : 60, Math.round(hp.L * 1.2), hp.W)), hMax = Math.min(lim.height, Math.max(cr ? 3 : 40, Math.round(hp.L * .6), hp.H));
  const nudge = (k) => `<div class="nudges" role="group" aria-label="${{L: '全長', W: '全幅', H: '全高'}[k]}の微調整">${(cr ? [-1, -.1, .1, 1] : [-10, -1, 1, 10]).map(d => `<button type="button" class="chip" data-nudge="${k}" data-step="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)} m</button>`).join('')}</div>`;
  return `<div class="pgroup blueprint-card hull-dims"><h4>艦種と寸法</h4>
    <label class="field-label">艦種（全長の範囲）<select data-shipclass>${shipClassList(cls.id).map(c => `<option value="${c.id}" ${c.id === cls.id ? 'selected' : ''}>${esc(c.name)} · ${fLen(c.min)}〜${fLen(c.max)}</option>`).join('')}</select></label>
    <p class="note">${esc(cls.note)}</p>
    <div class="sliders">${slider('L', '全長', Math.round(hp.L * 10) / 10, lo, hi, stp, fLen(hp.L))}${nudge('L')}${slider('W', '全幅', Math.round(hp.W * 10) / 10, cr ? .5 : 20, wMax, stp, fLen(hp.W) + ` · 全長比 ${(hp.W / hp.L * 100).toFixed(1)}%`)}${nudge('W')}${slider('H', '全高', Math.round(hp.H * 10) / 10, cr ? .3 : 10, hMax, stp, fLen(hp.H) + ` · 全長比 ${(hp.H / hp.L * 100).toFixed(1)}%`)}${nudge('H')}</div>
    <label class="check"><input type="checkbox" data-hullratio ${st.hullRatio ? 'checked' : ''}> 全長を変えるとき幅と高さも同じ比率で変える</label>
    <h4>寸法を変えたときの搭載物</h4>${seg('hullfollow', HULL_FOLLOW, st.hullFollow)}
    <p class="note">${st.hullFollow === 'surface' ? '格納庫・貨物庫などの内部区画は位置と寸法を保ちます。武装・艦橋ポッド・構造物・露出した機関は外板に合わせて移動します。' : st.hullFollow === 'scale' ? 'すべての区画と装備の位置を船体寸法の比率で移動します。区画の大きさは変わりません。' : '区画も装備も位置を保ちます。外板から離れた装備は浮いた扱いになります。'}</p></div>`;
}

// ---------- exercise ----------
const OPP = ['frigate', 'destroyer', 'carrier', 'heavy', 'bc'];
function simHTML(){return `<div class="pgroup"><h4>艦隊戦</h4><p>この艦を含む艦隊を編成し、同規模の敵艦隊とリアルタイムで戦います。戦場は3Dで見守り、「命令」から作戦図と戦術図を開いて指揮します。どの艦も3Dで操艦できます。</p><button class="btn primary" data-voyopen="fleet">艦隊戦を開く</button><button class="btn" data-mode="review">観閲式を開く</button></div>`;}
function ensureOpponents(){}
function runSim(){voyOpenWithCurrent();}

// ---------- engine-side operations ----------
// Building an example and auto-filling bays are long searches; they run in the
// engine while the interface stays responsive.
async function openExample(key) {
  showBusyOverlay('配置見本を準備中…');
  try {
    const r = await YardEngineClient.request('build', {key});
    const s = JSON.parse(r.state);
    st.coded = false; st.view = 'normal'; st.tab = 'hull'; syncHud();
    setShip(s, {busyText: '配置見本を展開中…'}); autosave();
    toast('配置見本を開きました。全区画を編集できます。');
    return s;
  } catch (e) { console.error(e); hideBusyOverlay(); toast('見本を開けませんでした：' + esc(e.message || '')); if (!ship) showTitle('load'); return null; }
}
async function fillHangarsRemote() {
  if (!ship) return;
  const before = snap(); showBusyOverlay('空き容積に航空区画を配置中…');
  try {
    const r = await YardEngineClient.request('op', {gen: eng.gen, state: C.publicJSON(ship), op: 'fillHangars', args: [st.size.hangar, st.fill[0], st.fill[1], st.mirror]});
    if (!r.result) { hideBusyOverlay(); toast('空きが見つかりませんでした'); return; }
    C.patchShip(ship, JSON.parse(r.state)); ship._client = true;
    undoStack.push(before); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0;
    lastOp = '格納庫を自動充填'; touch('parts'); scheduleStats(60); updateUndo(); autosave();
    toast(`格納庫を ${r.result} 個並べました`); renderPanel();
  } catch (e) { console.error(e); hideBusyOverlay(); toast('自動充填できませんでした：' + esc(e.message || '')); }
}

// ---------- persistence ----------
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};
let saveT = 0;
function autosave() { clearTimeout(saveT); saveT = setTimeout(() => { if (!ship) return; LS.set('yard.draft3', snap()); LS.set('yard.draft3.meta', JSON.stringify({name: ship.name, L: ship.hull.L, savedAt: Date.now()})); }, 1200); }
async function pack(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === 'function') {
    try {
      const cs = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const buf = new Uint8Array(await new Response(cs).arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return 'z1:' + btoa(s);
    } catch (e) { /* fall through */ }
  }
  return 'j1:' + json;
}
async function unpack(str) {
  if (str.startsWith('j1:')) return JSON.parse(str.slice(3));
  if (str.startsWith('z1:')) {
    const b = atob(str.slice(3)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    const ds = new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(ds).text());
  }
  return JSON.parse(str);
}
const Store = {
  db: null, uid: null, ready: false, p: null,
  init() { this.p = this.p || this._init(); return this.p; },
  async _init() {
    try {
      const cl = window.claude;
      if (cl && typeof cl.use === 'function') {
        const [db, user] = await Promise.all([cl.use('db'), cl.use('user')]);
        if (db && user) { const id = await user.id(); if (id) { this.db = db; this.uid = id; } }
      }
    } catch (e) { this.db = null; }
    this.ready = true; if (!$('#sheet').hidden) renderSaves();
  },
  col() { return this.db.collection('data/users/' + this.uid); },
  async list() {
    await this.init();
    if (this.db) {
      const snapq = await this.col().get();
      return snapq.docs.filter(d => d.exists).map(d => Object.assign({id: d.id}, d.data())).filter(d => d.kind === 'ship').sort((a, b) => b.savedAt - a.savedAt);
    }
    try { return JSON.parse(LS.get('yard.saves') || '[]'); } catch (e) { return []; }
  },
  async save(rec) {
    await this.init();
    if (this.db) { await this.col().doc(rec.id).set(rec); return 'cloud'; }
    const all = await this.list(); const i = all.findIndex(x => x.id === rec.id);
    if (i >= 0) all[i] = rec; else all.unshift(rec);
    if (!LS.set('yard.saves', JSON.stringify(all))) throw new Error('このブラウザでは保存できません。書き出しを使ってください。');
    return 'local';
  },
  async remove(id) {
    await this.init();
    if (this.db) { await this.col().doc(id).delete(); return; }
    const all = (await this.list()).filter(x => x.id !== id); LS.set('yard.saves', JSON.stringify(all));
  },
};
async function saveCurrent() {
  if (!S) return;
  const btn = $('#btnSave'); btn.disabled = true;
  try {
    const data = await pack(C.serialize(ship));
    if (data.length > 2000000) throw new Error('設計が大きすぎて保存できません。書き出しを使ってください。');
    const id = ship.saveId || ('ship-' + Date.now().toString(36));
    const where = await Store.save({id, kind: 'ship', name: ship.name, savedAt: Date.now(), cls: S.cls.role + '／' + S.cls.name, len: Math.round(S.hullLen), data});
    st.carrySaves = null;
    ship.saveId = id;
    toast(where === 'cloud' ? '保存しました（あなたのアカウント）' : '保存しました（この端末）');
    renderSaves();
  } catch (e) { toast(esc(e.message || '保存できませんでした')); }
  btn.disabled = false;
}
let delConfirm = null;
async function renderSaves() {
  const box = $('#saves'); if (!box) return;
  const where = Store.db ? 'アカウントに保存（どの端末からでも開けます）' : 'この端末のブラウザに保存';
  $('#saveWhere').textContent = Store.ready ? where : '保存先を確認中…';
  let list = [];
  try { list = await Store.list(); } catch (e) { box.innerHTML = '<li class="muted">一覧を読めませんでした。</li>'; return; }
  box.innerHTML = list.length ? list.map(r => `<li><div><b>${esc(r.name)}</b><span>${esc(r.cls || '')}・${fLen(r.len || 0)}・${new Date(r.savedAt).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span></div><button type="button" class="btn sm" data-load="${esc(r.id)}">開く</button><button type="button" class="btn sm ghost" data-del="${esc(r.id)}">${delConfirm === r.id ? '本当に削除' : '削除'}</button></li>`).join('') : '<li class="muted">保存した設計はまだありません。</li>';
}
async function loadSaved(id) {
  try {
    const rec = (await Store.list()).find(r => r.id === id); if (!rec) throw new Error('見つかりません');
    const s = C.deserialize(await unpack(rec.data)); s.saveId = rec.id;
    setShip(s); closeSheet(); toast(`「${esc(s.name)}」を開きました`);
  } catch (e) { toast('開けませんでした：' + esc(e.message || '')); }
}
async function exportDesign() {
  const json = JSON.stringify(C.serialize(ship));
  const fname = (ship.name || 'ship').replace(/[\\/:*?"<>|]/g, '_') + '.json';
  let dl = null;
  try { if (window.claude && window.claude.use) dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({filename: fname, data: json}); toast('書き出しました'); return; }
    catch (e) { if (e && e.code === 'declined') { toast('書き出しを取りやめました'); return; } }
  }
  // Inside the Claude viewer a page cannot start a download itself; fall through to the copyable text.
  if(!window.claude)try{const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=fname;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('設計図を書き出しました');return;}catch(e){}
  const ta = $('#ioText'); ta.value = json; $('#ioBox').hidden = false; ta.focus(); ta.select();
  toast('下の欄の文字列をコピーして保管してください');
}
function importText(txt) {
  try { const s = C.deserialize(JSON.parse(txt)); setShip(s); closeSheet(); toast(`「${esc(s.name)}」を読み込みました`); return true; }
  catch (e) { toast('読み込めませんでした：' + esc(e.message || '形式を確認してください')); return false; }
}
function openSheet() { $('#sheet').hidden = false; $('#sheetBg').hidden = false; $('#nameInput').value = ship.name; renderSaves(); }
function closeSheet() { $('#sheet').hidden = true; $('#sheetBg').hidden = true; $('#ioBox').hidden = true; delConfirm = null; }

// ---------- pointer / camera controls ----------
// ---------- dragging the selected compartment, structure or fitting ----------
// Press on the selected item (its outline box) and drag. Compartments slide in
// the horizontal plane (a vertical plane when the view is nearly level);
// structures resting on a deck keep resting on it; fittings follow the surface.
let itemDrag = null, itemDragTouch = 0;
function dragItemStart(px, py) {
  itemDrag = null;
  if (fleet.mode !== 'design' || !view || !ship?._geoProxy || !st.sel) return false;
  const t = tool(); if (t !== 'select' && t !== 'adjust') return false;
  const it = selItem(), list = st.sel.list; if (!it || (list !== 'parts' && list !== 'fits')) return false;
  const r = view.ray(px, py); if (!r) return false;
  let best = null;
  for (const q of linkedItems(list, it)) {
    const b = (list === 'parts' ? C.partAABB(q) : C.fitAABB(q)).slice(), pad = Math.max(2, .06 * Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]));
    for (let k = 0; k < 3; k++) { b[k] -= pad; b[k + 3] += pad; }
    const h = C.rayAABB(r.o, r.d, b); if (h && (!best || h.t < best.t)) best = {t: h.t, q, p: h.p || C.add(r.o, C.mul(r.d, h.t))};
  }
  if (!best) return false;
  const q = best.q, level = Math.abs(r.d[1]) < .35, normal = level ? (Math.abs(r.d[0]) > Math.abs(r.d[2]) ? [1, 0, 0] : [0, 0, 1]) : [0, 1, 0];
  const D = {list, id: q.id, grab: best.p, normal, c0: list === 'parts' ? q.c.slice() : q.p.slice(), skip: new Set(linkedItems(list, q)), seat: null};
  if (list === 'parts' && q.k === 'struct' && !level) { const y = dragSupportY(q.c, D.skip); if (y != null && q.c[1] - y >= -1 && q.c[1] - y <= q.s[2] * 1.2 + 4) D.seat = q.c[1] - y; }
  itemDrag = D; return true;
}
function dragSupportY(c, skip) {
  const top = Math.max(ship.hull.H * 4, 2000), h = C.rayEnv(ship, [c[0], c[1] + top, c[2]], [0, -1, 0], {skipSet: skip});
  if (!h) return null;
  // Look under the item itself, not on something stacked above it.
  if (h.p[1] > c[1] + 1) { const below = C.rayEnv(ship, [c[0], c[1], c[2]], [0, -1, 0], {skipSet: skip}); return below ? below.p[1] : null; }
  return h.p[1];
}
function dragItemMove(px, py) {
  const D = itemDrag; if (!D || !ship) return;
  const r = view.ray(px, py); if (!r) return;
  if (!D.moving) { D.moving = true; beginDrag(D.list === 'parts' ? 'ドラッグで移動' : '装備をドラッグで移動'); st.sel = {list: D.list, id: D.id}; }
  if (D.list === 'parts') {
    const den = C.dot(r.d, D.normal); if (Math.abs(den) < 1e-6) return;
    const t = C.dot(C.sub(D.grab, r.o), D.normal) / den; if (t < 0) return;
    const c = C.add(D.c0, C.sub(C.add(r.o, C.mul(r.d, t)), D.grab));
    if (D.seat != null) { const y = dragSupportY(c, D.skip); if (y != null) c[1] = y + D.seat; }
    editSel(it => { it.c = c; });
  } else {
    const f = ship.fits.find(q => q.id === D.id); if (!f) return;
    const h = C.rayEnv(ship, r.o, r.d, {structOnly: true}); if (!h) return;
    moveFitTo(f, h.p, h.n);
  }
  const now = performance.now(); if (now - itemDragTouch > 90) { itemDragTouch = now; touch(D.list); scheduleStats(400); }
  requestDraw();
}
function moveFitTo(f, p, n0) {
  const d = C.FITS[f.k], n = d.cat === 'w' ? weaponPlacementNormal(f.k, n0) : n0;
  const set = (g, q, m) => { g.p = q.slice(); g.n = C.norm(m); if (g.mountAxis == null) g.a = C.AXES.reduce((i, x, j) => C.dot(x, g.n) > C.dot(C.AXES[i], g.n) ? j : i, 0); const tl = g.mountAxis == null && !g.localMount && weaponTiltMode(g.k) ? C.fitTilt(g.n) : null; if (tl) g.tilt = tl; else delete g.tilt; delete g.local; delete g.localNormal; delete g.host; try { C.mountFit(ship, g); } catch (e) { g.float = true; } };
  const links = fitLinks(f);
  set(f, p, n);
  for (const l of links) { let q = p, m = n; if (l.y) { q = C.vmirrorPoint(ship, q); m = [m[0], -m[1], m[2]]; } if (l.z) { q = C.mirrorP(q); m = C.mirrorP(m); } set(l.fit, q, m); }
  queuePreview('fits', [f, ...links.map(l => l.fit)]);
}
function dragItemEnd(cancel) {
  const D = itemDrag; itemDrag = null; if (!D?.moving) return;
  if (cancel && dragSnap) { const old = dragSnap; dragSnap = null; restore(old); return; }
  touch(D.list); endDrag(); scheduleStats(30);
  const it = D.list === 'fits' ? ship.fits.find(q => q.id === D.id) : null;
  if (it?.float) toast(C.FITS[it.k].window ? '艦橋ポッドは構造物の壁に移してください' : 'この位置には据え付けられません。面の上へ移してください');
  renderPanel(); requestDraw();
}
function attachControls(canvas) {
  const ptrs = new Map();
  let mode = null, start = null, last = null, pinch = null, moved = false;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (trial.on || shot.on) {   // trial flights and screenshots: drag only looks around, pinch only zooms
      if (ptrs.size === 1) { start = {x: e.clientX, y: e.clientY, t: performance.now()}; last = {x: e.clientX, y: e.clientY}; moved = false; mode = 'trialPending'; }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2}; mode = 'pinch'; }
      return;
    }
    if (ptrs.size === 1) {
      start = {x: e.clientX, y: e.clientY, t: performance.now()};
      last = {x: e.clientX, y: e.clientY}; moved = false;
      mode = (e.button === 2 || e.button === 1 || e.shiftKey) ? 'pan' : 'pending';
      if(mode === 'pending' && cutterDragStart(e.clientX,e.clientY)) mode='cutter';
      else if(mode === 'pending' && e.button === 0 && dragItemStart(e.clientX,e.clientY)) mode='itemPending';
      if (e.pointerType !== 'mouse') onHover(e.clientX, e.clientY);
    } else if (ptrs.size === 2) {
      cutterDragEnd(false);if(mode === 'item' || mode === 'itemPending')dragItemEnd(true);
      const [a, b] = [...ptrs.values()];
      pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2};
      mode = 'pinch'; clearHover();
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') onHover(e.clientX, e.clientY); return; }
    ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (mode === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      view.cam.r = Math.max(20, Math.min(400000, view.cam.r * pinch.d / Math.max(1, d)));
      pan(mx - pinch.mx, my - pinch.my);
      pinch = {d, mx, my}; requestDraw(); return;
    }
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    if(mode === 'cutter'){cutterDragMove(e.clientX,e.clientY);last={x:e.clientX,y:e.clientY};moved=true;return;}
    if(mode === 'itemPending' && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 7){mode='item';moved=true;clearHover();}
    if(mode === 'item'){dragItemMove(e.clientX,e.clientY);last={x:e.clientX,y:e.clientY};return;}
    if ((mode === 'pending' || mode === 'trialPending') && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 7) { mode = 'rotate'; moved = true; clearHover(); }
    if (mode === 'rotate') {
      view.cam.th += dx * 0.009; view.cam.ph = Math.max(0.0006, Math.min(Math.PI - 0.02, view.cam.ph - dy * 0.009)); requestDraw();
    } else if (mode === 'pan') { pan(dx, dy); requestDraw(); moved = true; }
    last = {x: e.clientX, y: e.clientY};
  });
  const end = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if(mode === 'cutter')cutterDragEnd(false);
    if(mode === 'item')dragItemEnd(false);
    if(mode === 'itemPending'){itemDrag=null;if(ptrs.size === 0)onTap(e.clientX, e.clientY);}
    if (mode === 'pending' && ptrs.size === 0 && !moved && performance.now() - start.t < 900) onTap(e.clientX, e.clientY);
    if (mode === 'trialPending' && ptrs.size === 0 && performance.now() - start.t < 600 && !shot.on) trialCommand('fireTap');
    if (ptrs.size === 0) { mode = null; pinch = null; if (e.pointerType !== 'mouse') clearHover(); }
    else if (ptrs.size === 1) { const p = [...ptrs.values()][0]; last = {x: p.x, y: p.y}; mode = 'rotate'; moved = true; }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if(mode==='cutter')cutterDragEnd(true); if(mode==='item'||mode==='itemPending')dragItemEnd(true); if (!ptrs.size) mode = null; });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptrs.size) clearHover(); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.cam.r = Math.max(20, Math.min(400000, view.cam.r * (1 + Math.sign(e.deltaY) * Math.min(0.25, Math.abs(e.deltaY) * 0.0015)))); requestDraw(); }, {passive: false});
  function pan(dx, dy) {
    const m = view.matrices(), V = m.V, h = canvas.clientHeight || 1;
    const k = 2 * view.cam.r * Math.tan(view.cam.fov / 2) / h;
    const right = [V[0], V[4], V[8]], up = [V[1], V[5], V[9]];
    for (let a = 0; a < 3; a++) view.cam.target[a] += (-dx * right[a] + dy * up[a]) * k;
  }
}

// ---------- events ----------
// Copy a mirrored shape into an existing twin, keeping the twin's own links.
function assignMirror(target, q) {
  const id = target.id, tw = target.tw, vt = target.vt;
  for (const k of Object.keys(target)) if (!k.startsWith('_') && !Object.hasOwn(q, k)) delete target[k];
  Object.assign(target, q, {id}); delete target.tw; delete target.vt;
  if (tw != null) target.tw = tw; if (vt != null) target.vt = vt;
}
function copyFitSettings(from, to) { to.ped = from.ped; if (from.width) to.width = from.width; if (from.height) to.height = from.height; for (const k of ['commandDepth', 'commandHeight', 'commandEnabled', 'chargeSalvos', 'chargeDepth', 'chargeScale', 'scale']) if (from[k] != null) to[k] = from[k]; }
// Fittings placed with 左右対称 / 上下対称 keep links to their counterparts
// (tw: across the centreline, vt: top/bottom). Edits follow those links unless
// 「対の武装も同時に編集」 is switched off; the symmetry toggles only decide
// how new fittings are placed.
st.fitPairEdit = true;
function fitLinks(f) {
  if (!f || st.fitPairEdit === false) return [];
  const find = id => id == null ? null : ship.fits.find(q => q.id === id), tw = find(f.tw), vt = find(f.vt), vtw = (vt && find(vt.tw)) || (tw && find(tw.vt));
  const out = []; if (tw) out.push({fit: tw, z: true, y: false}); if (vt) out.push({fit: vt, z: false, y: true}); if (vtw && vtw !== tw && vtw !== vt) out.push({fit: vtw, z: true, y: true});
  return out;
}
const FIT_SYNC_KEYS = ['ped', 'pedShape', 'pedSize', 'scale', 'width', 'height', 'commandDepth', 'commandHeight', 'commandEnabled', 'chargeSalvos', 'chargeDepth', 'chargeScale', 'localMount'];
function syncFitTwin(from, to, link) {
  if (to.k !== from.k) { to.k = from.k; for (const k of ['skinAsset', 'mountOffset', 'mountAxis']) if (from[k] === undefined) delete to[k]; }
  for (const k of FIT_SYNC_KEYS) { if (from[k] === undefined) delete to[k]; else to[k] = JSON.parse(JSON.stringify(from[k])); }
  // A mirror image turns the other way: one flip negates the train angle, two restore it.
  if (from.assetYaw != null || to.assetYaw != null) to.assetYaw = (from.assetYaw || 0) * ((link.z ? -1 : 1) * (link.y ? -1 : 1));
}
function editSel(fn) {   // live edit of the selected part/fit (and its mirrored twins)
  const it = selItem(); if (!it) return;
  if (st.sel.list === 'fits') { const links = fitLinks(it); fn(it); C.enforceEquipment(it); for (const l of links) syncFitTwin(it, l.fit, l); queuePreview('fits', [it, ...links.map(l => l.fit)]); return; }
  const list = st.sel.list, find = (id) => id == null ? null : ship[list].find(q => q.id === id), tw = st.mirror ? twinOfItem(list, it) : null;
  fn(it);C.enforceEquipment(it);
  if (tw) {
    if(list==='parts')assignMirror(tw,C.mirrorPart(it,ship));
    else copyFitSettings(it, tw);
  } else if (it.tw && list === 'parts' && !st.mirror) { const t2 = twinOfItem(list, it); if (t2) { delete t2.tw; delete it.tw; } }
  const vt = find(it.vt); let vtw = null;
  if (vt && st.vmirror) {
    vtw = st.mirror ? find(vt.tw) : null;
    if (list === 'parts') { assignMirror(vt, C.vmirrorPart(it, ship)); if (vtw) assignMirror(vtw, C.mirrorPart(vt, ship)); }
    else { copyFitSettings(it, vt); if (vtw) copyFitSettings(it, vtw); }
  } else if (vt && !st.vmirror && list === 'parts') { delete vt.vt; delete it.vt; }
  queuePreview(list, [it, tw, vt && st.vmirror ? vt : null, vtw]);
}
const PED_SHAPES = [['round', '円形'], ['trap', '台形']];
// Switching from 編集 to 設置 keeps what was just being edited ready to place:
// the same kind, size and settings, apart from where it sits.
const TEMPLATE_SKIP = ['id', 'tw', 'vt', 'c', 'p', 'n', 'a', 'tilt', 'host', 'local', 'localNormal', 'base', 'low', 'slope', 'float', 'surfaceNormal', 'pitch', 'roll', 'mountAxis', 'mountOffset', 'localMount', 'batteryZone', 'assetYaw'];
// v21 'scale' is not carried: the player cannot make a turret larger or smaller than its standard.
const FIT_TEMPLATE_KEYS = ['width', 'height', 'chargeSalvos', 'chargeDepth', 'chargeScale', 'commandDepth', 'commandHeight', 'commandEnabled', 'pedShape', 'pedSize', 'skinAsset'];
function templateFor(it, list) { const data = JSON.parse(JSON.stringify(it, (k, v) => k.startsWith('_') ? undefined : v)); for (const k of TEMPLATE_SKIP) delete data[k]; return {list, k: it.k, equipmentId: list === 'parts' ? (C.equipmentSpec(it)?.id || null) : null, data}; }
function activeTemplate(list, k) { const t = st.template; if (!t || t.list !== list || t.k !== k) return null; if (list === 'parts' && (t.equipmentId || null) !== (activeEquipment()?.id || null)) return null; return t; }
function carryToPlace() {
  const it = selItem(); if (!it || !st.sel) return; const list = st.sel.list;
  if (list === 'parts' && !ship.parts.includes(it)) return;
  st.template = templateFor(it, list);
  if (list === 'parts') {
    const spec = C.equipmentSpec(it);
    if (spec?.group === 'bridge') { st.tab = 'bridge'; st.bridgeMode = 'body'; st.bridgeEquipment = spec.id; }
    else if (spec) { st.group = spec.group; st.part = it.k; st.equipmentId = spec.id; if (it.k === 'engine') st.engineSizes[spec.id] = {d: it.d, engineLength: it.engineLength}; }
    else {
      st.equipmentId = null; st.part = it.k; if (st.tab === 'mod') st.group = C.PARTS[it.k].group;
      if (it.k === 'struct') { st.structSize = it.s.slice(); st.structForm = it.form || 'box'; st.structTaper = it.taper || 0; st.structAngles = (it.angles || [0, 0, 0, 0]).slice(); st.structYaw = it.yaw || 0; st.structOffsetX = it.offsetX || 0; st.structOffsetZ = it.offsetZ || 0; if (it.form === 'reference') st.skinAsset = it.skinAsset; }
      else if (it.room) st.roomSize = it.room.slice(); else if (it.d) setPSize(it.k, it.d);
      if (it.k === 'engine' && it.dir) st.engineDir = it.dir.slice();
    }
  } else {
    if (C.FITS[it.k].window) st.bridge = it.k; else st.fit = it.k;
    st.ped = it.ped || 0; st.pedShape = it.pedShape || 'round'; st.pedSize = it.pedSize || 1;
  }
  st.sel = null; toast(`${list === 'parts' ? C.partLabel(it) : C.FITS[it.k].name} を同じ設定で設置できます`);
}
function applyFitTemplate(f) {
  const t = activeTemplate('fits', f.k); if (!t) return;
  for (const q of linkedItems('fits', f)) for (const k of FIT_TEMPLATE_KEYS) if (t.data[k] != null) q[k] = JSON.parse(JSON.stringify(t.data[k]));
}
function applyPedDefaults(f) {
  if (C.FITS[f.k].window || C.FITS[f.k].cat === 'b') return;
  for (const q of linkedItems('fits', f)) { if (st.pedShape === 'trap') q.pedShape = 'trap'; if (Math.abs(st.pedSize - 1) > 1e-6) q.pedSize = st.pedSize; }
}
function linkedItems(list, it) {
  if (!it) return [];
  const find = (id) => id == null ? null : ship[list].find(q => q.id === id), v = find(it.vt);
  return [it, find(it.tw), v, v ? find(v.tw) : null].filter(Boolean);
}
function removeWithPreview(label, list, it) {
  const ids = linkedItems(list, it).map(q => q.id);
  if (mutate(label, () => removeLinked(list, it), list === 'parts' ? 'parts' : 'fits')) showPreview(list, [], ids);
}
// Removing an item also removes the copies its active symmetry created.
function removeLinked(list, it) {
  const find = (id) => id == null ? null : ship[list].find(q => q.id === id), ids = new Set([it.id]);
  if (st.mirror && it.tw) ids.add(it.tw);
  if (st.vmirror && it.vt) { ids.add(it.vt); const v = find(it.vt); if (st.mirror && v?.tw) ids.add(v.tw); }
  for (const id of ids) C.removeItem(ship, list, id, false);
  for (const q of ship[list]) { if (ids.has(q.tw)) delete q.tw; if (ids.has(q.vt)) delete q.vt; }
}
// Vertical copies for parts placed with 上下対称 on (and their left-right twins).
function placeVerticalParts(made) {
  if (!st.vmirror || !made) return [];
  const src = [made, made.tw != null ? ship.parts.find(q => q.id === made.tw) : null].filter(Boolean);
  if (src.some(p => p.skinAsset)) { toast('参照モデルの部品は上下対称に配置できません'); return []; }
  const pairs = [];
  try {
    for (const p of src) {
      const q = C.vmirrorPart(p, ship);
      if (Math.abs(q.c[1] - p.c[1]) < Math.max(1, C.partDims(p).r * .05)) continue;
      const v = C.placePart(ship, q.k, q.c, p.k === 'struct' ? q.s : q.d, q, false);
      for (const [k, val] of Object.entries(q)) if (!['id', 'tw', 'vt', 'c'].includes(k) && !k.startsWith('_') && v[k] === undefined) v[k] = JSON.parse(JSON.stringify(val));
      p.vt = v.id; v.vt = p.id; pairs.push(v);
    }
  } catch (e) {
    for (const v of pairs) C.removeItem(ship, 'parts', v.id, false);
    for (const p of src) delete p.vt;
    throw new Error('上下対称の位置で他の区画と干渉します。上下対称を切るか、位置を変えてください');
  }
  if (pairs.length === 2) { pairs[0].tw = pairs[1].id; pairs[1].tw = pairs[0].id; }
  return pairs;
}
function placeVerticalFits(f, k, ped, opts) {
  if (!st.vmirror || !f) return 0;
  const src = [f, f.tw != null ? ship.fits.find(q => q.id === f.tw) : null].filter(Boolean), made = [];
  for (const g of src) {
    const n = g.n || C.AXES[g.a], p = C.vmirrorPoint(ship, g.p), n2 = [n[0], -n[1], n[2]];
    if (Math.abs(n[1]) < .2 && Math.abs(p[1] - g.p[1]) < Math.max(1, C.FITS[k].r)) continue;
    const r = C.placeFit(ship, k, p, n2, ped, false, opts);
    if (r.err || !r.fit) continue;
    copyFitSettings(g, r.fit); g.vt = r.fit.id; r.fit.vt = g.id; made.push(r.fit);
  }
  if (made.length === 2) { made[0].tw = made[1].id; made[1].tw = made[0].id; }
  return made.length;
}
function bind() {
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    if (tabKey() === b.dataset.tab && !st.dockCollapsed) { st.dockCollapsed = true; $('#dock').classList.add('collapsed'); return; }
    st.dockCollapsed = false; $('#dock').classList.remove('collapsed');
    st.tab = b.dataset.tab; st.hatchA = null; hideInspect(); renderPanel();
  });
  $('#statstrip').addEventListener('click', () => { st.tab = isWide() ? st.tab : 'spec'; st.dockCollapsed = false; $('#dock').classList.remove('collapsed'); renderPanel(); });
  $('#panel').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if(blockedHullControl(b))return;const d = b.dataset;
    if (d.hullsub) { st.tab = d.hullsub; st.sel = null; st.hatchA = null; hideInspect(); renderPanel(); syncHud(); requestDraw(); return; }
    if (d.notchstructures) { st.notchStructures=d.notchstructures==='yes';renderPanel(); }
    else if (d.parttool) { if (d.parttool === 'place' && st.partTool !== 'place') carryToPlace(); st.partTool = d.parttool; renderPanel(); }
    else if (d.part) { st.template=null;st.equipmentId=null;if(st.structForm==='reference'){st.structForm='trap';delete st.skinAsset;}st.part = d.part; st.partTool = 'place'; renderPanel(); }
    else if (d.place) { st.placeBy[st.part] = d.place; renderPanel(); }
    else if (d.psize) { st.size.hangar = +d.psize; renderPanel(); }
    else if (d.hsize) { mutate('格納庫の大きさ', () => editSel(it => { it.d = +d.hsize; }), 'parts'); renderPanel(); }
    else if (d.selpart) { st.sel = {list: 'parts', id: +d.selpart}; st.partTool = 'select'; renderPanel(); }
    else if ('desel' in d) { st.sel = null; renderPanel(); }
    else if ('fitpair' in d) { st.fitPairEdit = st.fitPairEdit === false; renderPanel(); refreshOverlay(); }
    else if ('delsel' in d) {
      const it = selItem(); if (!it) return;
      const list = st.sel.list;
      if (list === 'fits') {   // the editor removes the pair it edits
        const ids = new Set([it.id, ...fitLinks(it).map(l => l.fit.id)]);
        if (mutate('撤去', () => { for (const id of ids) C.removeItem(ship, 'fits', id, false); for (const q of ship.fits) { if (ids.has(q.tw)) delete q.tw; if (ids.has(q.vt)) delete q.vt; } }, 'fits')) showPreview('fits', [], [...ids]);
      } else removeWithPreview('撤去', list, it);
      st.sel = null; renderPanel();
    }
    else if (d.fittool) { if (d.fittool === 'place' && st.fitTool !== 'place') carryToPlace(); st.fitTool = d.fittool; if (d.fittool !== 'adjust') st.sel = null; renderPanel(); }
    else if (d.pedshape) { st.pedShape = d.pedshape; renderPanel(); }
    else if (d.pedshapesel) { mutate('支持台の形', () => editSel(it => { if (d.pedshapesel === 'trap') it.pedShape = 'trap'; else delete it.pedShape; }), 'fits'); renderPanel(); }
    else if (d.fit) { st.template = null; st.fit = d.fit; st.fitTool = 'place'; st.sel = null; renderPanel(); }
    else if (d.bridgetool) { if (d.bridgetool === 'place' && st.bridgeTool !== 'place') carryToPlace(); st.bridgeTool = d.bridgetool; if (d.bridgetool !== 'adjust') st.sel = null; renderPanel(); }
    else if (d.bridge) { st.template = null; st.bridgeMode='windows';st.bridge = d.bridge; st.bridgeTool = 'place'; st.sel = null; renderPanel(); }
    else if (d.carvetool) { st.carveTool = d.carvetool; renderPanel(); }
    else if (d.hull) {
      const P = C.HULLS[d.hull], hp = ship.hull;
      mutate(`${P.name}船体`, () => { setHullDims(hp.L, Math.round(hp.L * P.W / P.L), Math.round(hp.L * P.H / P.L)); delete ship.hull.stations; Object.assign(ship.hull, {plan: P.plan, sec: P.sec, bowW: P.bowW, bowH: P.bowH, stern: P.stern, name: P.name}); C.normalizeBow(ship.hull); }, 'hull');
      refitOnGeometry(); renderPanel();
    }
    else if (d.hullfollow) { st.hullFollow = d.hullfollow; renderPanel(); }
    else if (d.nudge) {
      const k = d.nudge, step = +d.step, v = hp[k] + step;
      mutate({L: '全長', W: '全幅', H: '全高'}[k] + 'の微調整', () => setHullDims(k === 'L' ? v : hp.L, k === 'W' ? v : hp.W, k === 'H' ? v : hp.H), 'hull', {quiet: true});
      refitOnGeometry(); renderPanel();
    }
    else if (d.sec) { mutate('断面', () => { ship.hull.sec = d.sec; }, 'hull'); renderPanel(); }
    else if (d.keel) { mutate('竜骨', () => { ship.keel = d.keel; }, 'hull'); renderPanel(); }
    else if (d.rzside) { st.razee.side = d.rzside; renderPanel(); }
    else if (d.rzedge) { st.razee.edge = d.rzedge; renderPanel(); }
    else if (d.delcut) { mutate('ラザー化を取り消す', () => { ship.cuts = ship.cuts.filter(c => c.id !== +d.delcut); }, 'hull'); renderPanel(); }
    else if (d.delsub) { mutate('切り欠きを取り消す', () => { ship.subs = ship.subs.filter(c => c.id !== +d.delsub); }, 'hull'); renderPanel(); }
    else if (d.opp) { st.simOpp = d.opp; $$('#panel .opp').forEach(x => { x.classList.toggle('on', x.dataset.opp === d.opp); x.setAttribute('aria-pressed', String(x.dataset.opp === d.opp)); }); }
    else if (b.id === 'btnFill') fillHangarsRemote();
    else if (b.id === 'btnUnfill') { mutate('航空区画を外す', () => { ship.parts = ship.parts.filter(p => p.k !== 'hangar'); }, 'parts'); renderPanel(); }
    else if (b.id === 'btnRazee') { const r = st.razee; mutate('ラザー化', () => { ship.cuts.push({id: ship.nextId++, side: r.side, edge: r.edge, inset: r.inset, slope: r.slope, from: Math.min(r.from, r.to - 0.02), to: r.to, prop: r.prop}); }, 'hull'); renderPanel(); }
    else if (b.id === 'btnClear') {
      if (!confirmClear) { confirmClear = true; renderPanel(); clearTimeout(confirmT); confirmT = setTimeout(() => { confirmClear = false; if (st.tab === 'hull') renderPanel(); }, 4000); return; }
      confirmClear = false;
      mutate('区画と装備をすべて外す', () => { ship.parts = []; ship.fits = []; ship.hatches = []; }, 'all'); st.sel = null; renderPanel();
    }
    else if (b.id === 'btnSim') runSim();
  });
  $('#panel').addEventListener('input', e => {if(blockedHullControl(e.target))return;
    const t = e.target;
    if(t.dataset.sl&&t.value==='')return;
    if (t.id === 'rzprop') { st.razee.prop = t.checked; return; }
    const k = t.dataset.sl; if (!k) return;
    const v=Math.max(+t.min,Math.min(+t.max,Number(t.value)||0)),out=$('#out-'+k),hp=ship.hull;
    $$('[data-sl="'+k+'"]').forEach(q=>{if(q!==t)q.value=v;});
    const live = (label, what, fn, txt) => { beginDrag(label); fn(); touch(what); if (out) out.textContent = txt; scheduleStats(350); };
    switch (k) {
      case 'L': live('全長', 'hull', () => { const r = v / hp.L; setHullDims(v, st.hullRatio ? hp.W * r : hp.W, st.hullRatio ? hp.H * r : hp.H); }, fLen(v)); syncHullInputs(t); break;
      case 'W': live('全幅', 'hull', () => setHullDims(hp.L, v, hp.H), fLen(v) + ` · 全長比 ${(v / hp.L * 100).toFixed(1)}%`); break;
      case 'H': live('全高', 'hull', () => setHullDims(hp.L, hp.W, v), fLen(v) + ` · 全長比 ${(v / hp.L * 100).toFixed(1)}%`); break;
      case 'bowW': live('艦首の幅・厚み', 'hull', () => { hp.bowW = v / 100; if(hp.stations)hp.stations.at(-1)[1]=Math.max(.005,v/100); C.normalizeBow(hp); }, v + '%'); break;
      case 'maxAt': live('最大幅の位置', 'hull', () => { hp.maxAt = v / 100; }, `${v}% · ${fLen(v / 100 * hp.L)}`); break;
      case 'stern': live('艦尾幅', 'hull', () => { hp.stern = v / 100; if(hp.stations)hp.stations[0][1]=Math.max(.01,v/100); }, v + '%'); break;
      case 'ex': live('移動', 'parts', () => editSel(it => { it.c[0] = v; }), fmtM(v)); break;
      case 'ey': live('移動', 'parts', () => editSel(it => { it.c[1] = v; }), fmtM(v)); break;
      case 'ez': live('移動', 'parts', () => editSel(it => { it.c[2] = v; }), fmtM(v)); break;
      case 'ed': live('大きさ', 'parts', () => editSel(it => { if (C.PARTS[it.k]?.fixed || (C.equipmentSpec(it) && it.k !== 'engine')) return; it.d = v; }), precisePartSize(selItem() || {}) ? num(v, 2) + ' m' : fmtM(v)); break;
      case 'el': live('大きさ', 'parts', () => editSel(it => { if (it.form === 'reference' && C.equipmentSpec(it)) return; it.s[0] = v; }), fmtM(v)); break;
      case 'ew': live('大きさ', 'parts', () => editSel(it => { if (it.form === 'reference' && C.equipmentSpec(it)) return; it.s[1] = v; }), fmtM(v)); break;
      case 'eh': live('大きさ', 'parts', () => editSel(it => { if (it.form === 'reference' && C.equipmentSpec(it)) return; it.s[2] = v; }), fmtM(v)); break;
      case 'et': live('すぼまり', 'parts', () => editSel(it => { it.taper = v / 100; }), v + '%'); break;
      case 'pedsel': live('支持台の高さ', 'fits', () => { editSel(it => { it.ped = v; }); }, `${v.toFixed(1)} m`); { const it = selItem(), pi = $('#pedinfo'); if (it && pi) pi.textContent = `傾斜に合わせた自動の高さ ${it.base.toFixed(1)} m ＋ 追加 ${it.ped.toFixed(1)} m。高くすると射界が開けますが、標的にもなりやすくなります。`; } break;
      case 'arh': live('外殻装甲', 'none', () => { ship.armor.hull = v; }, craftDesign() ? `${(v * 1000).toFixed(0)} mm` : `${v.toFixed(2)} m`); break;
      case 'arc': live('集中防御', 'none', () => { ship.armor.cit = v; }, `${v.toFixed(1)} m`); break;
      case 'psize': setPSize(st.part, v); if (out) out.textContent = sizeOut(st.part, v); updateHint(); break;
      case 'sl': st.structSize[0] = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'sw': st.structSize[1] = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'sh': st.structSize[2] = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'st': st.structTaper = v / 100; if (out) out.textContent = v + '%'; break;
      case 'ffrom': st.fill[0] = v / 100; if (out) out.textContent = v + '%'; break;
      case 'fto': st.fill[1] = v / 100; if (out) out.textContent = v + '%'; break;
      case 'ped': st.ped = v; if (out) out.textContent = `${v} m`; break;
      case 'pedsize': st.pedSize = v / 100; if (out) out.textContent = v + '%'; break;
      case 'pedsizesel': live('支持台の大きさ', 'fits', () => editSel(it => { if (v === 100) delete it.pedSize; else it.pedSize = v / 100; }), v + '%'); break;
      case 'rzinset': st.razee.inset = v; if (out) out.textContent = fmtM(v); break;
      case 'rzslope': st.razee.slope = v; if (out) out.textContent = fmtM(v); break;
      case 'rzfrom': st.razee.from = v / 100; if (out) out.textContent = v + '%'; break;
      case 'rzto': st.razee.to = v / 100; if (out) out.textContent = v + '%'; break;
      case 'nl': st.notch.l = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'nw': st.notch.w = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'nd': st.notch.d = v; if (out) out.textContent = fmtM(v); updateHint(); break;
    }
  });
  $('#panel').addEventListener('change', e => {
    const k = e.target.dataset.sl; if (!k) return;
    if (dragSnap) { endDrag(); if (['L', 'W', 'H'].includes(k)) { refitOnGeometry(); renderPanel(); } else renderPanelInfo(); }
  });
  $('#panel').addEventListener('change', e => {
    const t = e.target;
    if ('yardenginecolor' in t.dataset) { setEngineGlow(t.value); return; }
    if ('hullratio' in t.dataset) { st.hullRatio = t.checked; return; }
    if ('shipclass' in t.dataset) {
      const c = C.SHIP_CLASSES.find(c => c.id === t.value), hp = ship.hull; if (!c) return;
      if (hp.L >= c.min && hp.L <= c.max) { mutate(`艦種を${c.name}に`, () => { ship.shipClass = c.id; }, 'view'); renderPanel(); return; }
      const L = c.def, r = L / hp.L;
      mutate(`${c.name}の全長`, () => { ship.shipClass = c.id; setHullDims(L, hp.W * r, hp.H * r); }, 'hull'); refitOnGeometry(); renderPanel();
    }
  });
  // HUD
  $('#chipMirror').addEventListener('click', () => { st.mirror = !st.mirror; syncHud(); });
  $('#viewSeg').addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (!b) return; st.view = b.dataset.view; syncHud(); requestDraw(); updateHint(); });
  $('#chipCode').addEventListener('click', () => { st.coded = !st.coded; syncHud(); touch('view'); requestDraw(); });
  $('#camSeg').addEventListener('click', e => { const b = e.target.closest('button[data-cam]'); if (!b) return; if(!view)return;const c = CAMS[b.dataset.cam]; view.cam.ortho=b.dataset.cam!=='iso'; view.cam.th = c[0]; view.cam.ph = c[1]; view.cam.target = [0, 0, 0]; requestDraw(); });
  $('#chipVMirror').addEventListener('click', () => { st.vmirror = !st.vmirror; syncHud(); updateHint(); });
  $('#btnTitle').addEventListener('click', () => { closeSheet(); showTitle(); });
  $('#btnHome')?.addEventListener('click', () => { if (trial.on) trialStop(); closeSheet(); showTitle(); });
  $('#inspect').addEventListener('click', e => { if (e.target.closest('.ins-x')) hideInspect(); });
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnMenu').addEventListener('click', openSheet);
  $('#shipName').addEventListener('click', openSheet);
  $('#sheetBg').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'btnClose') closeSheet();
    else if (b.id === 'btnSave') saveCurrent();
    else if (b.id === 'btnExport') exportDesign();
    else if (b.id === 'btnCopy') { const ta = $('#ioText'); try { await navigator.clipboard.writeText(ta.value); toast('コピーしました'); } catch (err) { ta.focus(); ta.select(); toast('選択しました。コピーしてください'); } }
    else if (b.id === 'btnImportText') importText($('#ioText').value);
    else if (b.id === 'btnShowImport') { $('#ioText').value = ''; $('#ioBox').hidden = false; $('#ioText').focus(); }
    else if (b.id === 'btnSample') { closeSheet(); openExample('venator'); }
    else if (b.dataset.newhull) {
      const P = C.HULLS[b.dataset.newhull], s = C.newShip(Object.assign({}, P), '新設計艦');
      setShip(s); closeSheet(); st.tab = 'hull'; renderPanel(); toast(`${P.name}の白紙の船体を用意しました`);
    }
    else if (b.dataset.load) loadSaved(b.dataset.load);
    else if (b.dataset.del) {
      if (delConfirm !== b.dataset.del) { delConfirm = b.dataset.del; renderSaves(); return; }
      delConfirm = null; try { await Store.remove(b.dataset.del); toast('削除しました'); } catch (err) { toast('削除できませんでした'); } renderSaves();
    }
  });
  $('#nameInput').addEventListener('input', e => { ship.name = e.target.value.slice(0, 40) || '無名艦'; updateName(); autosave(); });
  $('#fileInput').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;if(f.size>2000000){toast('設計図は2MB以内にしてください');return;}
    const rd = new FileReader(); rd.onload = () => importText(String(rd.result)); rd.readAsText(f); e.target.value = '';
  });
  window.addEventListener('keydown', e => {
    if(fleet.mode!=='design'||trial.on)return;
    if (e.target.matches('input, textarea, select')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (shot.on && (e.key === 'Escape' || e.code === 'KeyH')) { e.preventDefault(); shotSet(false); return; }
    if (!mod && !e.altKey && e.code === 'KeyH' && !document.body.classList.contains('title-open')) { e.preventDefault(); shotSet(true); return; }
    if (mod && tool() === 'multi' && ['c', 'x', 'v'].includes(e.key.toLowerCase())) { e.preventDefault(); const k = e.key.toLowerCase(); if (k === 'v') multiPaste(); else if (multiCopy()) { if (k === 'x') multiDelete('切り取り'); else toast('コピーしました'); } renderPanel(); refreshOverlay(); return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (e.key === 'Escape') { if (!$('#sheet').hidden) closeSheet(); else { st.hatchA = null; st.sel = null; hideInspect(); renderPanel(); } }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selItem()) { const it = selItem(), list = st.sel.list; removeWithPreview('撤去', list, it); st.sel = null; renderPanel(); }
  });
  window.addEventListener('resize', () => { requestDraw(); renderSpecTargets(); });
  const mq = window.matchMedia('(min-width: 1000px)');
  const onMq = () => { if (mq.matches && st.tab === 'spec') { st.tab = 'mod'; renderPanel(); } renderSpecTargets(); requestDraw(); };
  if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);
}
function syncHud() {
  $('#chipMirror').setAttribute('aria-pressed', String(st.mirror));
  $$('#viewSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === st.view)));
  $('#chipCode').setAttribute('aria-pressed', String(st.coded));
  $('#chipVMirror').setAttribute('aria-pressed', String(!!st.vmirror));
  renderRail();
}

// ---------- boot ----------
function readDraft(hot) {
  let s = null;
  try { if (hot && hot.design) s = C.deserialize(hot.design); } catch (e) { s = null; }
  if (!s) { try { const d = LS.get('yard.draft3') || LS.get('yard.draft2'); if (d) s = C.deserialize(JSON.parse(d)); } catch (e) { s = null; } }
  return s;
}
function collectSources() {
  // Classic single-page layout (no boot loader): reuse this page's inline scripts.
  const scripts = Array.from(document.scripts).map(s => s.text || '');
  const pick = (needle) => scripts.find(t => t.includes(needle)) || '';
  const coreText = pick('const Core = (() =>'), gfx = pick('const Gfx = (() =>'), engine = pick('const YardEngine = (() =>');
  return coreText && gfx && engine ? [coreText, gfx, engine] : null;
}
function start(hot) {
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="false" class="tab-${k}">${l}</button>`).join('');
  $('#newHulls').innerHTML = Object.entries(C.HULLS).map(([k, v]) => `<button type="button" class="hullcard" data-newhull="${k}">${silhouette(v)}<span>${v.name}</span></button>`).join('');
  $('#refGrid').innerHTML = [...exampleList(false), ...exampleList(true)].map(e => `<button class="btn" data-reference="${e.key}">${esc(e.name)}<small>${esc(e.side)} · ${esc(exampleLine(e))}</small></button>`).join('');
  restoreRenderer(false,false);bindRendering();
  bind();bindEngineering();bindRealism();bindReference();bindAviation();bindFleet();bindSurface();bindPlanCuts();bindLayout();bindSolidCuts();bindTitle();bindTutorial();bindGround();bindTrial();bindMulti();bindDockToggle();bindShot();bindVoyage();bindRail();bindPalette();bindSound();
  if (hot && hot.ui) { for (const k of ['tab', 'part', 'partTool', 'mirror', 'view', 'coded', 'fit', 'bridge', 'bridgeMode', 'bridgeEquipment', 'equipmentId', 'group', 'ped']) if (hot.ui[k] != null) st[k] = hot.ui[k]; }
  if(!BRIDGES.includes(st.bridge))st.bridge='podBridge';
  if(!['body','windows'].includes(st.bridgeMode))st.bridgeMode='body';
  if(!Object.hasOwn(C.EQUIPMENT,st.bridgeEquipment)||C.EQUIPMENT[st.bridgeEquipment].group!=='bridge')st.bridgeEquipment='isdBridge';
  if(!Object.hasOwn(C.EQUIPMENT,st.equipmentId)||C.EQUIPMENT[st.equipmentId].group==='bridge')st.equipmentId=null;
  if (st.view === 'cut') st.view = 'xray';
  if (st.tab === 'bridge') st.tab = 'mod';
  if (st.tab === 'sim' || st.tab === 'arm') st.tab = st.tab === 'arm' ? 'mod' : 'spec';
  syncHud();
  requestAnimationFrame(loop);
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    window.claude.hot.snapshot(() => ({design: ship ? C.serialize(ship) : null, ui: {tab: st.tab, part: st.part, partTool: st.partTool, mirror: st.mirror, view: st.view, coded: st.coded, fit: st.fit, bridge: st.bridge, bridgeMode:st.bridgeMode,bridgeEquipment:st.bridgeEquipment,equipmentId:st.equipmentId,group:st.group,ped: st.ped}}));
  }
  Store.init();
  window.__yard = {get ship() { return ship; }, get stats() { return S; }, get retryTimer() { return renderRetryTimer; }, kickLoop: () => requestAnimationFrame(loop), st, draw: requestDraw, renderPanel: () => renderPanel(), fleet, fleetSetMode, renderHealth, restoreRenderer, view: () => view, setShip, C, pick, onTap, touch, eng, openExample, title: titleApi, meshStore, trial, trialCommand, trialStep: dt => trialStep(dt), trialCamera: dt => trialCamera(dt), trialStart: o => trialStart(o), trialJump: k => trialJump(k), spaceBattleLaunch: () => spaceBattleLaunch(), spaceStep: dt => spaceStep(dt), fleetAsset: k => fleetAsset(k), SYSTEMS, JUMP};
  const boot = window.KSBoot, draft = readDraft(hot);
  const engineStart = YardEngineClient.start(boot ? null : collectSources(), boot ? {workerReady: boot.workerReady} : {});
  engineStart.then(mode => { engineHello(mode); boot?.step('engine', 'done'); titleStatus(); }).catch(e => { console.error(e); toast('設計エンジンを起動できませんでした'); });
  boot?.step('view', 'done');
  // The draft is prepared behind the title screen so "途中から設計" opens at once.
  if (draft) { boot?.step('draft', 'run'); setShip(draft, {keepHistory: true}); }
  else boot?.step('draft', 'skip');
  if (boot || hot?.title) showTitle(); else if (!draft) openExample('venator');
}

// ---------- title screen ----------
// The examples are listed by class, size and purpose only.
const EXAMPLE_PURPOSE = {venator: '艦隊戦・艦載機運用', imperial: '艦隊主力・星系制圧', executor: '艦隊旗艦・指揮', cr90: '護衛・高速輸送', dreadnaught: '艦隊戦・護衛', gozanti: '輸送・護衛', gr75: '物資輸送', heraklon: '貨物・旅客輸送', lucrehulk: 'ドロイド軍の司令・母艦', munificent: '通信中継・艦隊戦', nebulonb: '船団護衛', providence: '艦隊旗艦・艦載機運用', recusant: '艦隊戦', reptransport: '兵員・物資輸送', mc80home: '艦隊旗艦・イオン砲と艦載機', mc80liberty: '主力・イオン砲戦', mc75: '旗艦・イオン砲戦', providenceDn: '艦隊旗艦・強襲揚陸', recusantDn: '重砲撃戦', mc30c: '雷撃・イオン砲でシールド剥ぎ', mandator2: '艦隊旗艦・重砲撃戦', acclamator: '強襲揚陸・兵員輸送', arquitens: '護衛・哨戒', hammerhead: '護衛・武装輸送・体当たり', onager: '長距離砲撃・攻城（超兵器）', subjugator: 'ハイパーイオン砲で艦隊を無力化・撃滅'};
const EXAMPLES = [
  {key: 'venator', name: 'ヴェネター級', len: 1137, side: '銀河共和国'},
  {key: 'imperial', name: 'インペリアル級', len: 1600, side: '銀河帝国'},
  {key: 'executor', name: 'エグゼクター級', len: 19000, side: '銀河帝国'},
  // Ships measured from attached models (src/ships/*.js).
  ...Object.values(C.SHIP_EXAMPLES).map(d => ({key: d.key, name: d.name, len: d.length, role: d.role, side: d.side, craft: !!d.craft})),
].map(e => ({...e, purpose: EXAMPLE_PURPOSE[e.key] || e.role || ''}));
// v21 Example craft (starfighters, small craft) are listed apart from the ships, once craft are open in the designer.
const exampleList = craft => EXAMPLES.filter(e => !!e.craft === craft && (!craft || CRAFT_OPEN));
const examplePurpose = (key, fallback = '') => EXAMPLE_PURPOSE[key] || C.SHIP_EXAMPLES[key]?.role || fallback;
const exampleLine = e => `${fLen(e.len)} · ${e.purpose}`;
const titleState = {mode: 'top', panel: null, cls: 'destroyer', hull: 'wedge', L: 1600, W: 785, H: 262, name: '新設計艦'};
const titleApi = {show: () => showTitle(), hide: () => hideTitle(), get visible() { return !$('#title')?.hidden; }};
function titleVisible() { const t = $('#title'); return !!t && !t.hidden; }
// The title orbits the prepared design behind the menu.
const titleCam = {base: null, last: 0};
function titleShipView() {
  const on = titleVisible() && !!ship && !!ship._geoProxy && fleet.mode === 'design';
  document.body.classList.toggle('title-ship', on);
  if (on && view && !titleCam.base) { fitCamera(false); titleCam.base = view.cam.target.slice(); view.cam.ph = 1.18; view.cam.r *= 1.05; }
  requestDraw();
}
function titleOrbit(now) {
  if (!titleCam.base || !view || !document.body.classList.contains('title-ship')) return;
  const dt = titleCam.last ? Math.min(.1, (now - titleCam.last) / 1000) : 0; titleCam.last = now;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) view.cam.th += dt * .06;
  const m = view.matrices(), V = m.V, wide = window.innerWidth > 760, k = view.cam.r * Math.tan(view.cam.fov / 2) * (wide ? .42 : 0);
  const up = wide ? 0 : view.cam.r * Math.tan(view.cam.fov / 2) * .38;
  view.cam.target = [0, 1, 2].map(a => titleCam.base[a] - V[a * 4] * k + V[a * 4 + 1] * up);
  dirty.draw = true;
}
function showTitle(panel) {
  const t = $('#title'); if (!t) return;
  t.hidden = false; document.body.classList.add('title-open'); titleCam.base = null; titleCam.last = 0; titleShipView();
  hideBusyOverlay(); if (panel === 'voyage' || panel === 'design') { titleState.mode = panel; titleState.panel = null; } else { titleState.panel = panel || null; if (panel) titleState.mode = 'design'; } renderTitle();
  setTimeout(() => t.querySelector('.tmenu:not([disabled])')?.focus?.({preventScroll: true}), 30);
}
function hideTitle() {
  const t = $('#title'); if (!t) return;
  t.hidden = true; document.body.classList.remove('title-open', 'title-ship');
  if (titleCam.base && view) { titleCam.base = null; fitCamera(false); }
  if (ship && !ship._geoProxy) showBusyOverlay('設計を展開中…');
  requestDraw(); renderSpecTargets();
}
function draftMeta() { try { return JSON.parse(LS.get('yard.draft3.meta') || 'null'); } catch (e) { return null; } }
function titleStatus() {
  const s = $('#titleStatus'); if (!s) return;
  if (!eng.ready) { s.textContent = '設計エンジンを起動中…'; return; }
  window.KSBoot?.engineReady?.();
  const draftReady = ship && ship._geoProxy;
  if (ship && !draftReady) { s.textContent = '下書きを先読み中…（すぐに開始できます）'; return; }
  if (ship) window.KSBoot?.step('draft', 'done');
  window.KSBoot?.ready?.();
  s.textContent = `準備完了 · 計算は${eng.mode === 'worker' ? 'バックグラウンドのワーカー' : 'この画面'}で実行します`;
}
function renderTitle() {
  const menu = $('#titleMenu'); if (!menu) return;
  const meta = draftMeta();
  for (const b of $$('#titleMenu .tmenu')) b.disabled = false;
  const mission = $('#titleMenu [data-title="mission"]'); if (mission) mission.disabled = true;
  for (const g of $$('#titleMenu [data-tgroup]')) g.hidden = g.dataset.tgroup !== (titleState.mode || 'top');
  const cont = $('#titleMenu [data-title="continue"]');
  if (cont) {
    cont.disabled = !ship;
    $('#titleDraft').textContent = ship ? `「${ship.name}」 · ${fLen(ship.hull.L)} · ${C.shipClassFor(ship.hull.L, ship.shipClass).name}${meta?.savedAt ? ' · ' + new Date(meta.savedAt).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : ''}` : '下書きはありません';
  }
  for (const b of $$('#titleMenu .tmenu')) b.setAttribute('aria-pressed', String(b.dataset.title === titleState.panel));
  const panel = $('#titlePanel');
  panel.hidden = !titleState.panel;
  if (titleState.panel === 'new') panel.innerHTML = titleNewHTML();
  else if (titleState.panel === 'load') { panel.innerHTML = titleLoadHTML(); renderTitleSaves(); }
  else if (titleState.panel === 'patrol') { panel.innerHTML = titlePatrolHTML(); renderTitlePatrolSaves(); }
  else if (titleState.panel === 'sound') { panel.innerHTML = soundSettingsHTML(); const el = $('#soundSettings'); if (el && window.KSAudio) window.KSAudio.mountSettings(el); else if (el) el.innerHTML = '<p class="note">この端末では音を鳴らせません（Web Audio に対応していません）。</p>'; }
  else if (titleState.panel === 'credits') panel.innerHTML = `<div class="tpanel-head"><h2>使用素材とライセンス</h2><button type="button" class="btn ghost sm" data-title-back>戻る</button></div>${$$('#sheet .src').map(e => `<p class="src">${e.innerHTML}</p>`).join('')}`;
  else panel.innerHTML = '';
  titleStatus();
}
// v21 Craft classes size in 0.1 m steps.
// v21 Starfighters and small craft: the craft classes, the twelve measured craft examples, carrying a designed
// craft in a carrier's air wing and the trial camera at their scale are all in, so the lists offer them.
const CRAFT_OPEN = true;
const shipClassList = cur => C.SHIP_CLASSES.filter(c => CRAFT_OPEN || !c.craft || c.id === cur);
const titleCraft = () => !!C.SHIP_CLASSES.find(c => c.id === titleState.cls)?.craft;
const titleRound = v => titleCraft() ? Math.max(.1, Math.round(v * 10) / 10) : Math.round(v);
function titleHullDims(P, L) { return {L, W: titleRound(L * P.W / P.L), H: titleRound(L * P.H / P.L)}; }
function titleNewHTML() {
  const t = titleState, cls = C.SHIP_CLASSES.find(c => c.id === t.cls) || C.SHIP_CLASSES.find(c => c.id === 'destroyer');
  return `<div class="tpanel-head"><h2>新規設計</h2><button type="button" class="btn ghost sm" data-title-back>戻る</button></div>
  <h3>1 · 艦種</h3><div class="tclass">${shipClassList(t.cls).map(c => `<button type="button" class="tcard" data-title-class="${c.id}" aria-pressed="${c.id === t.cls}"><b>${esc(c.name)}</b><span>${fLen(c.min)}〜${fLen(c.max)}</span><small>${esc(c.note)}</small></button>`).join('')}</div>
  <h3>2 · 船体の型</h3><div class="hulls">${Object.entries(C.HULLS).map(([k, v]) => `<button type="button" class="hullcard" data-title-hull="${k}" aria-pressed="${k === t.hull}">${silhouette(v)}<span>${v.name}</span></button>`).join('')}</div>
  <h3>3 · 寸法</h3><div class="sliders">${(() => { const cr = !!cls.craft, stp = cr ? .1 : 1; return slider('tL', '全長', t.L, cls.min, cls.max, stp, fLen(t.L)) + slider('tW', '全幅', t.W, cr ? .5 : 20, Math.min(C.DESIGN_LIMITS.width, Math.max(cr ? 4 : 60, Math.round(t.L * 1.2))), stp, fLen(t.W)) + slider('tH', '全高', t.H, cr ? .3 : 10, Math.min(C.DESIGN_LIMITS.height, Math.max(cr ? 3 : 40, Math.round(t.L * .6))), stp, fLen(t.H)); })()}</div>
  <p class="note">全長は艦種の範囲で1 m単位。全幅・全高は船体の型の比率から始まり、個別に調整できます。設計中も「船体」タブで変更できます。</p>
  <label class="field-label">艦名<input type="text" data-title-name value="${esc(t.name)}" maxlength="40"></label>
  <button type="button" class="btn primary tgo" data-title-start>この船体で設計を始める</button>`;
}
function titleLoadHTML() {
  const grid = list => [...new Set(list.map(e => e.side))].map(side => `<p class="eyebrow">${esc(side)}</p><div class="ref-grid">${list.filter(e => e.side === side).map(e => `<button type="button" class="btn" data-title-example="${e.key}">${esc(e.name)}<small>${esc(exampleLine(e))}</small></button>`).join('')}</div>`).join(''), crafts = exampleList(true);
  return `<div class="tpanel-head"><h2>設計図を読み込む</h2><button type="button" class="btn ghost sm" data-title-back>戻る</button></div>
  <h3>保存した設計</h3><ul class="saves" id="titleSaves"><li class="muted">一覧を確認中…</li></ul>
  <h3>ファイル・文字列</h3><div class="iorow"><label class="btn file-btn">設計図ファイル（.json）を選ぶ<input type="file" data-title-file accept=".json,application/json"></label></div>
  <details class="trench-editor"><summary>設計図の文字列を貼り付ける</summary><textarea data-title-text spellcheck="false" aria-label="設計図の文字列"></textarea><button type="button" class="btn sm primary" data-title-import>この文字列を読み込む</button></details>
  <h3>配置見本</h3>${grid(exampleList(false))}${crafts.length ? `<h3>小型機の見本（スターファイター・小型艇）</h3>${grid(crafts)}` : ''}
  <p class="note">見本は全区画を編集できます。大型艦は準備に時間がかかります。</p>`;
}
// Patrol: one ship flown through a system — the design on the board, a saved
// design or one of the examples.
// The options are kept: the system to start in, and up to four escorts.
const patrolOpt = (() => { try { const o = JSON.parse(LS.get('yard.patrol1') || 'null'); if (o && typeof o === 'object') return {sys: typeof o.sys === 'string' ? o.sys : 'kuat', escorts: Array.isArray(o.escorts) ? o.escorts.filter(k => typeof k === 'string').slice(0, 4) : []}; } catch (e) {} return {sys: 'kuat', escorts: []}; })();
function patrolSave() { LS.set('yard.patrol1', JSON.stringify(patrolOpt)); }
const PATROL_ESCORTS = 4;
function titlePatrolHTML() {
  const ex = Object.values(YardFleetData?.designs || {}), sides = [...new Set(ex.map(d => d.side))], sysList = Object.values(SYSTEMS).filter(x => x.key !== 'rts');
  if (!SYSTEMS[patrolOpt.sys] || patrolOpt.sys === 'rts') patrolOpt.sys = 'kuat';patrolOpt.escorts = patrolOpt.escorts.filter(k => YardFleetData?.designs?.[k]);
  const esc1 = patrolOpt.escorts, count = k => esc1.filter(x => x === k).length;
  return `<div class="tpanel-head"><h2>パトロール</h2><button type="button" class="btn ghost sm" data-title-back>戻る</button></div>
  <p class="note">選んだ星系を旗艦で航行します。輸送船や貨物船などの民間船がハイパースペースから出入りし、惑星との間を行き来します（民間船は照準の対象外です）。ときおり敵対勢力の艦艇が出現して交戦になり、撃退すればパトロールを続けます。星図からほかの星系へジャンプもできます。</p>
  <h3>1 · 星系</h3><div class="tclass">${sysList.map(x => `<button type="button" class="tcard" data-patrol-sys="${x.key}" aria-pressed="${x.key === patrolOpt.sys}"><b>${esc(x.name)}</b><small>${esc(x.short)}${x.planet.ring ? '' : ''}</small></button>`).join('')}</div>
  <h3>2 · 随伴艦（AI）<small class="tp-count">${esc1.length} / ${PATROL_ESCORTS} 隻</small></h3><p class="note">旗艦の後方で隊形を組んで続き、ハイパースペースにも同行し、旗艦が狙う目標に援護射撃します。タップで追加、もう一度で外します（同じ艦を複数も可：右上の＋）。</p>
  <div class="ref-grid tp-escorts">${sides.map(side => ex.filter(d => d.side === side).sort((a, b) => b.info.len - a.info.len).map(d => { const n = count(d.key); return `<button type="button" class="btn${n ? ' on' : ''}" data-patrol-esc="${esc(d.key)}" aria-pressed="${n > 0}">${esc(String(d.name).split('｜')[0])}${n > 1 ? ` ×${n}` : ''}<small>${fLen(d.info.len)}</small>${n ? `<i class="tp-plus" data-patrol-more="${esc(d.key)}" role="button" aria-label="もう1隻">＋</i>` : ''}</button>`; }).join('')).join('')}</div>
  ${esc1.length ? '<button type="button" class="btn sm ghost" data-patrol-esc-clear>随伴艦をすべて外す</button>' : ''}
  <h3>3 · 旗艦を選んで出発</h3>
  ${ship ? `<h4>設計中の艦</h4><div class="ref-grid"><button type="button" class="btn" data-title-patrol="current">${esc(ship.name)}<small>${fLen(ship.hull.L)} · ${esc(C.shipClassFor(ship.hull.L, ship.shipClass).name)}</small></button></div>` : ''}
  <h4>保存した設計</h4><div class="ref-grid" id="titlePatrolSaves"><p class="muted">一覧を確認中…</p></div>
  <h4>作例</h4>${sides.map(side => `<p class="eyebrow">${esc(side)}</p><div class="ref-grid">${ex.filter(d => d.side === side).sort((a, b) => b.info.len - a.info.len).map(d => `<button type="button" class="btn" data-title-patrol="${esc(d.key)}">${esc(String(d.name).split('｜')[0])}<small>${fLen(d.info.len)} · ${esc(examplePurpose(d.key, d.cls || ''))}</small></button>`).join('')}</div>`).join('')}
  <p class="note">大型艦は準備に時間がかかります。</p>`;
}
async function renderTitlePatrolSaves() {
  const box = $('#titlePatrolSaves'); if (!box) return; let list = [];
  try { list = await Store.list(); } catch (e) { box.innerHTML = '<p class="muted">一覧を読めませんでした。</p>'; return; }
  box.innerHTML = list.length ? list.map(r => `<button type="button" class="btn" data-title-patrol="save:${esc(r.id)}">${esc(r.name)}<small>${fLen(r.len || 0)}</small></button>`).join('') : '<p class="muted">保存した設計はまだありません。</p>';
}
async function renderTitleSaves() {
  const box = $('#titleSaves'); if (!box) return;
  let list = [];
  try { list = await Store.list(); } catch (e) { box.innerHTML = '<li class="muted">一覧を読めませんでした。</li>'; return; }
  box.innerHTML = list.length ? list.map(r => `<li><div><b>${esc(r.name)}</b><span>${esc(r.cls || '')}・${fLen(r.len || 0)}・${new Date(r.savedAt).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span></div><button type="button" class="btn sm" data-title-saved="${esc(r.id)}">開く</button></li>`).join('') : '<li class="muted">保存した設計はまだありません。</li>';
}
function titleStartNew() {
  const t = titleState, P = C.HULLS[t.hull] || C.HULLS.wedge;
  const s = C.newShip(Object.assign({}, P, {L: t.L, W: t.W, H: t.H}), (t.name || '新設計艦').slice(0, 40));
  s.hullLocked = false; s.shipClass = t.cls;
  if (C.SHIP_CLASSES.find(c => c.id === t.cls)?.craft) s.armor = {hull: .01, cit: 0};
  st.tab = 'hull'; st.sel = null;
  setShip(s, {keepHistory: true}); hideTitle(); renderPanel();
  toast(`${C.shipClassFor(t.L, t.cls).name}・${P.name}の船体を用意しました`);
}
// On a phone, starting the game asks for the full screen held in landscape —
// where the browser allows it (Android; iOS and some embedded views do not);
// elsewhere the turned layout (KSRotate) keeps the game sideways as before.
let landscapeAsked = false;
function landscapeTry(force) {
  if (landscapeAsked && !force) return; landscapeAsked = true;
  if (!force && !(window.matchMedia && matchMedia('(pointer: coarse)').matches)) return;
  const lock = () => { try { const p = screen.orientation?.lock?.('landscape'); if (p && p.catch) p.catch(() => { if (force) toast('この環境では画面の向きを固定できません（端末を横にしてください）'); }); } catch (e) {} };
  try {
    const de = document.documentElement, fs = de.requestFullscreen || de.webkitRequestFullscreen;
    if (!document.fullscreenElement && fs) { const p = fs.call(de, {navigationUI: 'hide'}); if (p && p.then) p.then(lock, () => { lock(); }); else lock(); } else lock();
  } catch (e) { lock(); }
}
function bindTitle() {
  const t = $('#title'); if (!t) return;
  t.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('landscape' in d) { landscapeTry(true); return; }
    if (d.titleMode === 'design' || d.titleMode === 'voyage') landscapeTry(false);
    if ('titleCredits' in d) { titleState.panel = 'credits'; renderTitle(); return; }
    if ('titleSound' in d) { titleState.panel = 'sound'; renderTitle(); return; }
    if ('titleBack' in d) { titleState.panel = null; renderTitle(); return; }
    if (d.titleMode) { titleState.mode = d.titleMode; titleState.panel = null; renderTitle(); setTimeout(() => t.querySelector(`[data-tgroup="${d.titleMode}"] .tmenu:not([disabled]):not(.tback)`)?.focus?.({preventScroll: true}), 20); return; }
    if (d.title === 'patrol') { titleState.panel = titleState.panel === 'patrol' ? null : 'patrol'; renderTitle(); return; }
    if (d.title === 'fleetbattle' || d.title === 'orbat') { hideTitle(); voy.saves = await Store.list().catch(() => []); voyOpen('setup', d.title === 'orbat' ? 'orbat' : 'sortie'); return; }
    if (d.titlePatrol) { voyPatrol(d.titlePatrol); return; }
    if (d.patrolSys) { if (SYSTEMS[d.patrolSys]) { patrolOpt.sys = d.patrolSys; patrolSave(); renderTitle(); } return; }
    if ('patrolEscClear' in d) { patrolOpt.escorts = []; patrolSave(); renderTitle(); return; }
    if (e.target.closest('[data-patrol-more]')) { const k = e.target.closest('[data-patrol-more]').dataset.patrolMore; if (patrolOpt.escorts.length < PATROL_ESCORTS) patrolOpt.escorts.push(k); else toast(`随伴艦は ${PATROL_ESCORTS} 隻までです`); patrolSave(); renderTitle(); return; }
    if (d.patrolEsc) { const k = d.patrolEsc, i = patrolOpt.escorts.indexOf(k); if (i >= 0) patrolOpt.escorts = patrolOpt.escorts.filter(x => x !== k); else if (patrolOpt.escorts.length < PATROL_ESCORTS) patrolOpt.escorts.push(k); else toast(`随伴艦は ${PATROL_ESCORTS} 隻までです`); patrolSave(); renderTitle(); return; }
    if (d.title === 'continue') { if (ship) hideTitle(); return; }
    if (d.title === 'new' || d.title === 'load') { titleState.panel = titleState.panel === d.title ? null : d.title; renderTitle(); return; }
    if (d.titleClass) { const c = C.SHIP_CLASSES.find(c => c.id === d.titleClass); if (!c) return; titleState.cls = c.id; Object.assign(titleState, titleHullDims(C.HULLS[titleState.hull], c.def)); renderTitle(); return; }
    if (d.titleHull) { titleState.hull = d.titleHull; Object.assign(titleState, titleHullDims(C.HULLS[d.titleHull], titleState.L)); renderTitle(); return; }
    if ('titleStart' in d) { titleStartNew(); return; }
    if (d.titleExample) { hideTitle(); await openExample(d.titleExample); return; }
    if (d.titleSaved) { hideTitle(); loadSaved(d.titleSaved); return; }
    if ('titleImport' in d) { const txt = t.querySelector('[data-title-text]')?.value || ''; if (importText(txt)) hideTitle(); return; }
  });
  t.addEventListener('input', e => {
    const k = e.target.dataset.sl, x = e.target;
    if ('titleName' in x.dataset) { titleState.name = x.value; return; }
    if (!['tL', 'tW', 'tH'].includes(k) || x.value === '') return;
    const v = C.clamp(titleRound(Number(x.value) || 0), +x.min, +x.max), cr = titleCraft();
    if (k === 'tL') { const r = titleState.L > 0 ? v / titleState.L : 1; titleState.L = v; titleState.W = Math.max(cr ? .5 : 20, titleRound(titleState.W * r)); titleState.H = Math.max(cr ? .3 : 10, titleRound(titleState.H * r)); }
    else titleState[k[1]] = v;
    for (const kk of ['tL', 'tW', 'tH']) { const val = titleState[kk[1]]; t.querySelectorAll(`[data-sl="${kk}"]`).forEach(q => { if (q !== x) q.value = val; }); const o = t.querySelector('#out-' + kk); if (o) o.textContent = fLen(val); }
  });
  t.addEventListener('change', e => {
    const x = e.target;
    if ('titleFile' in x.dataset) { const f = x.files && x.files[0]; if (!f) return; if (f.size > 2000000) { toast('設計図は2MB以内にしてください'); return; } const rd = new FileReader(); rd.onload = () => { if (importText(String(rd.result))) hideTitle(); }; rd.readAsText(f); x.value = ''; }
    if (['tL', 'tW', 'tH'].includes(x.dataset.sl)) renderTitle();
  });
  t.addEventListener('keydown', e => { if (e.key === 'Escape' && titleState.panel) { titleState.panel = null; renderTitle(); } });
}
const deg=v=>`${Math.round(v)}°`;
function structureControls(p,selected){
  const angles=p.angles||[0,0,0,0],prefix=selected?'e':'s',form=p.form||'trap';
  return `<div class="pgroup shape-options"><h4>構造物の形</h4>${surfaceControls(p,selected)}${seg(selected?'editform':'structform',Object.entries(C.STRUCT_SHAPES).filter(([k])=>k!=='reference'||p.skinAsset),form)}
    <div class="sliders">${slider(prefix+'yaw','回転',p.yaw||0,-180,180,1,deg(p.yaw||0))}
    ${['trap','cone','chamfer'].includes(form)?angles.map((v,i)=>slider(prefix+'angle'+i,['後面の傾斜','前面の傾斜','左壁の傾斜','右壁の傾斜'][i],v,-45,65,1,deg(v))).join(''):''}
    ${!['reference','outline','loft','roundloft','arc','ellipsoid','shell'].includes(form)?slider(prefix+'offsetX','上面 前後',p.offsetX||0,-300,300,1,fmtM(p.offsetX||0))+slider(prefix+'offsetZ','上面 左右',p.offsetZ||0,-200,200,1,fmtM(p.offsetZ||0)):''}
    ${form==='shell'?slider(prefix+'shellCurve','反り（外へ膨らむ量）',Math.round((p.shellCurve??1)*100),-100,100,1,Math.round((p.shellCurve??1)*100)+'%')+slider(prefix+'shellThick','板厚',p.shellThick??3,.5,20,.5,fmtM(p.shellThick??3)):''}</div>
    ${form==='shell'?`<label class="check-row"><input type="checkbox" data-shellflip="${prefix}" ${p.shellFlip?'checked':''}> 内縁を右舷側に置く（板の向きを左右反転）</label>`:''}
    <p class="note">${form==='outline'?'配置後、輪郭の頂点・前後の甲板傾斜・左右への下げ量を編集できます。':['loft','roundloft'].includes(form)?'配置後、前後断面の幅・天井・床と上端の左右絞りを編集できます。':form==='shell'?'内縁（上端）から外縁（下端）へ湾曲して下がる薄い外殻板です。左右対称で置くと左右一対の板になり、配置後は前後の断面ごとに板の幅・内縁と外縁の高さ・左右位置を変えて、木の葉形などに形を変えられます。反りを 0 にすると平板、負の値で内側へ凹みます。':'傾斜角は垂直からの角度。正の値で内側へ絞ります。各壁は独立して調整できます。'}</p></div>${plateControls(p,selected)}`;
}
// Armoured plating: the structure's exposed skin becomes armour of the chosen
// thickness; weapons and pods cannot be mounted on it.
function plateControls(p,selected){
  const kind=selected?(p.plate?'plate':p.light?'light':'frame'):(st.structPlate?'plate':st.structLight?'light':'frame'),on=kind==='plate',t=selected?C.plateThickness(p):st.structPlateT;
  return `<div class="pgroup plate-options"><h4>構造の種類</h4>${seg(selected?'editplate':'structplate',[['frame','構造物'],['light','軽構造'],['plate','装甲外板']],kind)}
    ${on?`<div class="sliders">${slider(selected?'plateT':'newPlateT','装甲の厚さ',t,C.PLATE.min,C.PLATE.max,.1,num(t,1)+' m')}</div>${selected?'':'<button type="button" class="btn sm" data-plateflat>板状の寸法にする（120×60×4 m）</button>'}`:''}
    <p class="note">${kind==='plate'?'装甲外板は、露出した表面が指定の厚さの装甲板になる構造物です。内側は船内として区画を置けますが、外板の上には武装・艦橋ポッドなどの装備を取り付けられません。分離主義艦の曲面外殻のように、骨組みや船体を覆う外装に使います。':kind==='light'?'軽構造は、アンテナ・塔・骨組みのような細い構造物です。質量と強度が通常の構造物の ¼ になり、大きく張り出しても加速を損ないにくい代わりに、被弾で失われやすくなります。':'構造物は船体と同じ密度・強度の張り出しです。外側には武装や艦橋ポッドを取り付けられます。'}</p></div>`;
}
// v21 A superweapon's controls: the reactor feeding it (the same choice as a nozzle's) and, for the beam, the default fire mode.
function superweaponControls(p){
  const w=(S?.superweapons||[]).find(x=>x.id===p.id),r=C.reactorFor(ship,p),source=p.reactor==null?'auto':String(p.reactor),aim=C.SUPERWEAPONS[p.k].aim==='bow'?'艦首方向（固定）':p.dir?.[2]<0?'左舷方向（固定）':'右舷方向（固定）';
  return `<div class="pgroup route-card"><h4>超兵器</h4><p class="note tight">射界：${aim}${w&&!w.open?' · <span class="neg">砲口が船外に出ていません</span>':''}</p>
    <label class="field-label">給電する炉（直結）<select data-reactor="selected"><option value="auto" ${source==='auto'?'selected':''}>最寄りの炉へ自動接続</option>${ship.parts.filter(C.isReactor).map(q=>`<option value="${q.id}" ${source===String(q.id)?'selected':''}>${esc(C.PARTS[q.k].name)} #${q.id} · ${reactorOutputText(q)}</option>`).join('')}</select></label>
    ${p.k==='sbeam'?`<h4>射撃の型（既定）</h4>${seg('swmode',[['beam','ビーム照射'],['pulse','パルス一撃']],p.fireMode||'beam')}<p class="note">ビームは一定時間照射してシールドを破りやすく、貫通力に優れます。パルスは一撃の大威力で、シールドの無い艦なら破断させます。戦闘中にも切り替えられます。</p>`:''}
    ${w&&w.ok?superweaponFigures(w):''}
    <p class="note">${r?`給電：${C.PARTS[r.k].name} #${r.id}`:'<span class="neg">給電する炉がありません</span>'}。撃つとこの炉が過負荷になり、しばらく出力が落ちます。</p></div>`;
}
// v21 What the weapon does with this ship's reactors: charge time, one shot's energy, the overload, and
// for the ion cannon the share of power left when the main reactor is knocked out.
function superweaponFigures(w){
 const K=C.SW_COMBAT[w.k];if(!K)return '';const sec=t=>t>=90?`${(t/60).toFixed(1)} 分`:`${Math.round(t)} 秒`,row=(k,v)=>`<div><dt>${k}</dt><dd>${v}</dd></div>`;
 // v21.2 range and arc as figures, with a top view of the envelope (superweaponArcSVG)
 const dg=(K.cone*180/Math.PI).toFixed(1),side=w.aim==='port'?'左舷':'右舷',wide=2*K.range*Math.tan(K.cone)/1000;
 return `<dl class="engineering-stats">${row('充電',`${sec(w.chargeT)}（炉出力の ${Math.round(K.share*100)}% を充電に回す）`)}${row('一撃のエネルギー',`${ja(K.E)} TT`+(w.k==='sbeam'?`（ビームは ${K.beamT} 秒かけて照射）`:''))}${row('射程',`${Math.round(K.range/1000)} km（砲口から）`)}${row('射界',w.aim==='bow'?`艦首方向 ±${dg}° の細い円錐（射程端で幅 ${wide.toFixed(1)} km）。砲身の延長線上に船体がかかる艦にも当たる`:`${side}方向 ±${dg}° の円錐（射程端で幅 ${Math.round(wide)} km）。範囲内の全艦に波及`)}${row('過負荷',`給電炉の出力が ${Math.round(K.over.floor*100)}% に落ち、${K.over.T} 秒かけて戻る`)}${w.k==='hion'?row('命中した敵艦',`主炉が ${K.down} 秒停止。副炉が全出力の ${Math.round(K.auxMin*100)}% に満たない艦は全電源を失う`):''}</dl>${superweaponArcSVG(w)}`;
}
// v21.2 A top view of the envelope to scale (bow to the right, starboard down): the selected weapon's cone out to
// its range with 10 km marks, the ship's other superweapons faintly, and the ship at the same scale (drawn no
// smaller than a mark) at their apex.
function superweaponArcSVG(w){
 if(!ship)return '';const L=ship.hull.L||1000,B=ship.hull.W||L*.4,list=(S?.superweapons||[]).filter(x=>x.ok||x.id===w.id),col=k=>k==='hion'?'#a58cff':'#ff8a5c';
 const geo=x=>{const p=ship.parts.find(q=>q.id===x.id),K=C.SW_COMBAT[x.k],d=p?.dir||[1,0,0],h=(p?.length||0)/2,m=p?[p.c[0]-L/2+d[0]*h,p.c[2]+d[2]*h]:[0,0];return {x,K,m,ang:x.aim==='bow'?0:x.aim==='port'?-Math.PI/2:Math.PI/2};};
 const gs=list.map(geo);let x0=-L/2,x1=L/2,z0=-B/2,z1=B/2;
 for(const g of gs)for(const a of [g.ang-g.K.cone,g.ang,g.ang+g.K.cone]){const px=g.m[0]+Math.cos(a)*g.K.range,pz=g.m[1]+Math.sin(a)*g.K.range;x0=Math.min(x0,px,g.m[0]);x1=Math.max(x1,px,g.m[0]);z0=Math.min(z0,pz,g.m[1]);z1=Math.max(z1,pz,g.m[1]);}
 const pad=16,W0=300,s=Math.min((W0-pad*2)/(x1-x0),(230-pad*2)/(z1-z0)),H0=Math.round((z1-z0)*s+pad*2+12),ox=pad+((W0-pad*2)-(x1-x0)*s)/2-x0*s,oy=pad-z0*s,P=(x,z)=>[ox+x*s,oy+z*s],f=v=>v.toFixed(1);
 const sector=(g,on)=>{const a=P(...g.m),r=g.K.range*s,p1=[a[0]+Math.cos(g.ang-g.K.cone)*r,a[1]+Math.sin(g.ang-g.K.cone)*r],p2=[a[0]+Math.cos(g.ang+g.K.cone)*r,a[1]+Math.sin(g.ang+g.K.cone)*r];
  let h=`<path d="M${f(a[0])} ${f(a[1])}L${f(p1[0])} ${f(p1[1])}A${f(r)} ${f(r)} 0 0 1 ${f(p2[0])} ${f(p2[1])}Z" fill="${col(g.x.k)}" fill-opacity="${on?.2:.07}" stroke="${col(g.x.k)}" stroke-opacity="${on?.95:.45}" stroke-width="${on?1.4:.8}"${on?'':' stroke-dasharray="3 3"'}/>`;
  if(on){for(let d=10000;d<g.K.range;d+=10000){const q=d*s,e1=[a[0]+Math.cos(g.ang-g.K.cone)*q,a[1]+Math.sin(g.ang-g.K.cone)*q],e2=[a[0]+Math.cos(g.ang+g.K.cone)*q,a[1]+Math.sin(g.ang+g.K.cone)*q];h+=`<path d="M${f(e1[0])} ${f(e1[1])}A${f(q)} ${f(q)} 0 0 1 ${f(e2[0])} ${f(e2[1])}" fill="none" stroke="${col(g.x.k)}" stroke-opacity=".5" stroke-dasharray="2 2"/>`;}
   const e=[a[0]+Math.cos(g.ang)*r,a[1]+Math.sin(g.ang)*r],bow=g.x.aim==='bow',tx=bow?Math.min(e[0],W0-4):e[0],ty=bow?e[1]-Math.max(6,Math.sin(g.K.cone)*r)-4:e[1]+(g.x.aim==='port'?-4:12);
   h+=`<text x="${f(tx)}" y="${f(ty)}" text-anchor="${bow?'end':'middle'}" fill="${col(g.x.k)}" font-size="10" font-weight="700">${g.K.range/1000} km · ±${(g.K.cone*180/Math.PI).toFixed(1)}°</text>`;}
  return h;};
 const k=Math.max(1,10/(L*s)),c=P(0,0),hull=[[L/2,0],[-L/2,B/2],[-L/2,-B/2]].map(([x,z])=>[c[0]+x*s*k,c[1]+z*s*k]);
 const body=gs.filter(g=>g.x.id!==w.id).map(g=>sector(g,false)).join('')+gs.filter(g=>g.x.id===w.id).map(g=>sector(g,true)).join('');
 return `<figure class="sw-arc"><svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="${esc(C.SW_COMBAT[w.k].name)}の射界（上面図・縮尺どおり）">${body}<polygon points="${hull.map(q=>q.map(f).join(',')).join(' ')}" fill="currentColor" fill-opacity=".85"/><text x="4" y="${H0-4}" fill="currentColor" fill-opacity=".6" font-size="9.5">上面図・縮尺どおり（艦首 ▶ · 右舷 ▼）${k>1.05?' · 艦は拡大':''}</text></svg></figure>`;
}
function engineControls(p,selected){
  const source=p.reactor==null?'auto':String(p.reactor),dir=p.dir||[-1,0,0],yaw=Math.atan2(dir[2],-dir[0])*180/Math.PI,pitch=Math.asin(Math.max(-1,Math.min(1,dir[1])))*180/Math.PI;
  const r=C.reactorFor(ship,p),path=selected?C.enginePaths(ship).find(x=>x.nozzle===p.id):null;
  return `<div class="pgroup route-card"><h4>炉 → 自動推進機関 → ノズル</h4><label class="field-label">接続する炉<select data-reactor="${selected?'selected':'new'}"><option value="auto" ${source==='auto'?'selected':''}>最寄りの炉へ自動接続</option><option value="0" ${source==='0'?'selected':''}>接続しない</option>${ship.parts.filter(C.isReactor).map(q=>`<option value="${q.id}" ${source===String(q.id)?'selected':''}>${esc(C.PARTS[q.k].name)} #${q.id} · X ${Math.round(q.c[0])} m</option>`).join('')}</select></label>
    <div class="sliders">${slider(selected?'engineYaw':'newEngineYaw','左右の向き',Math.round(yaw),-70,70,1,deg(yaw))}${slider(selected?'enginePitch':'newEnginePitch','上下の向き',Math.round(pitch),-60,60,1,deg(pitch))}</div>
    <p class="note">${r?`接続先：${C.PARTS[r.k].name} #${r.id}`:'接続炉なし'}${path?` · 長さ ${fLen(path.seg.l)} · 占有 ${ja(C.partVolume(path))} m³`:''}<br>炉とノズルを動かすと機関も変形します。ノズルの追加で炉の出力は増えません。</p></div>`;
}
function v3PartEditor(){
  let h=basePartEditor(),p=selItem();if(!p||st.sel.list!=='parts')return h;
  let extra=p.k==='struct'?structureControls(p,true):p.k==='engine'?engineControls(p,true):'';
  if(C.isSuperweapon(p))extra+=superweaponControls(p);
  else if(C.PARTS[p.k].shape==='cyl')extra+=`<div class="pgroup"><h4>円筒の向き</h4>${seg('partaxis',[['x','前後'],['y','上下'],['z','左右']],Math.abs(p.dir?.[1]||0)>.9?'y':Math.abs(p.dir?.[2]||0)>.9?'z':'x')}</div>`;
  if(p.k==='struct')extra+=`<button class="btn sm" data-duplicate="${p.id}">構造物を複製</button>`;
  return h+extra;
}
// Position of a placed fitting. Pods move along their wall and up or down it;
// deck fittings move fore/aft and port/starboard and re-seat on the surface.
function fitPositionSliders(f){
  const hp=ship.hull;
  if(C.FITS[f.k].window){
    // Fore/aft walls slide port-starboard; side walls slide fore-aft.
    const host=ship.parts.find(q=>q.id===f.host),n=f.n||C.AXES[f.a],side=Math.abs(n[2])>Math.abs(n[0]),c=host?host.c:f.p,span=host?Math.max(...host.s)/2+10:60,y0=host?host.c[1]-host.s[2]/2-5:0,y1=host?host.c[1]+host.s[2]/2+5:hp.H*2;
    const axis=side?['fitX','前後 X',0]:['fitZ','左右 Z',2],v=f.p[axis[2]];
    return `<h4>位置</h4><div class="sliders">${slider(axis[0],axis[1],Math.round(v*10)/10,Math.floor(c[axis[2]]-span),Math.ceil(c[axis[2]]+span),.5,fmtM(v))}${slider('fitY','高さ Y',Math.round(f.p[1]*10)/10,Math.floor(y0),Math.ceil(y1),.5,fmtM(f.p[1]))}</div><p class="note">取り付けた壁に沿って動きます。3D画面でポッドをドラッグしても動かせます。</p>`;
  }
  return `<h4>位置</h4><div class="sliders">${slider('fitX','前後 X',Math.round(f.p[0]),Math.round(-hp.L*.1),Math.round(hp.L*1.1),1,fmtM(f.p[0]))}${slider('fitZ','左右 Z',Math.round(f.p[2]),Math.round(-hp.W*.75),Math.round(hp.W*.75),1,fmtM(f.p[2]))}</div><p class="note">面に沿って据え直します。3D画面で装備をドラッグしても動かせます。</p>`;
}
function fitPairHTML(f){
  const find=id=>id==null?null:ship.fits.find(q=>q.id===id),tw=find(f.tw),vt=find(f.vt),vtw=(vt&&find(vt.tw))||(tw&&find(tw.vt)),n=[tw,vt,vtw].filter(Boolean).length;if(!n)return '';
  return `<div class="pair-edit"><span class="pair-tags">${tw?'<span class="tag">左右対</span>':''}${vt?'<span class="tag">上下対</span>':''}${vtw?'<span class="tag">対角</span>':''}</span><button type="button" class="chip" data-fitpair aria-pressed="${st.fitPairEdit!==false}">${st.fitPairEdit!==false?`対の武装 ${n} 基も同時に編集`:'この武装だけ編集'}</button></div>`;
}
function fitEditor(){
  const p=selItem();if(!p||st.sel.list!=='fits'||!C.FITS[p.k].window)return baseFitEditor();
  return `<div class="editor"><div class="ed-head"><b>${esc(C.FITS[p.k].name)}</b><button class="btn sm ghost" data-desel>選択解除</button><button class="btn sm danger" data-delsel>撤去</button></div>${fitPairHTML(p)}${fitPositionSliders(p)}<p class="note">ポッドは標準寸法（直径 ${fmtM(C.FITS[p.k].fm)}・高さ ${fmtM(C.FITS[p.k].wm)}）で、大きさは変えられません。</p><p class="note">構造物・艦橋本体の側面や前後の壁にのみ取り付けられます。甲板・船体には取り付けられません。背後に指揮区画を確保します。</p></div>`;
}
function v3RenderPanel(){
  if(!ship)return;
  if(st.tab==='systems'){
    markTabs();
    $('#panel').innerHTML=systemsHTML();updateHint();return;
  }
  baseRenderPanel();
  const panel=$('#panel');
  if(st.tab==='mod'&&st.partTool==='place'){
    const parts=panel.querySelector('.parts');if(parts)parts.insertAdjacentHTML('beforebegin',`<div class="pgroup">${seg('group',layoutGroups(),st.group)}</div>`);
    if(st.part==='struct')panel.insertAdjacentHTML('beforeend',structureControls({form:st.structForm,skinAsset:st.skinAsset,angles:st.structAngles,yaw:st.structYaw,offsetX:st.structOffsetX,offsetZ:st.structOffsetZ,shellCurve:st.shellCurve,shellThick:st.shellThick,shellFlip:st.shellFlip},false));
    if(st.part==='engine')panel.insertAdjacentHTML('beforeend',engineControls({k:'engine',c:[0,0,0],d:pSize('engine'),dir:st.engineDir,reactor:st.reactor},false));
    panel.insertAdjacentHTML('beforeend',coordinateControls());
  }
  if(st.tab==='bridge'){
    panel.innerHTML=`<div class="pgroup">${seg('group',layoutGroups(),'bridge')}</div>`+bridgeSubHTML()+bridgePanel();
  }
  if(st.tab==='armor')panel.insertAdjacentHTML('beforeend',`<div class="pgroup sliders"><h4>シールドの目標強度</h4>${slider('shieldTarget','標準に対して',(ship.shieldTarget||1)*100,10,300,5,Math.round((ship.shieldTarget||1)*100)+'%')}<p class="note">目標強度 × 外表面積で必要電力が決まります。発生器の容量と給電が不足すると実効強度が下がります。</p></div>`);
}
function trenchPanelHTML(){
  const t=st.trench;
  return `<div class="pgroup trench-editor"><h3>上下を開いてトレンチを作る</h3><p class="note">上部と下部の船体を同じ量ずつ離します。指定した上下の間隔を艦尾から艦首まで保ち、元の甲板と船底の傾斜を残します。</p>
  ${seg('trside',[['both','左右両舷'],['port','左舷'],['stbd','右舷']],t.side)}
  <div class="sliders">${slider('trHeight','上下の間隔',t.height,2,Math.min(500,Math.max(50,Math.round(ship.hull.H))),1,fmtM(t.height))}${slider('trDepth','奥壁の後退量',t.depth,2,Math.min(800,Math.max(20,Math.round(ship.hull.W/3))),1,fmtM(t.depth))}</div>
  <details><summary>分割位置・前後の範囲</summary><div class="sliders">${slider('trLevel','船体を上下に分ける位置',t.level*100,10,90,1,Math.round(t.level*100)+'%')}${slider('trFrom','艦尾側の開始位置',t.from*100,0,95,1,Math.round(t.from*100)+'%')}${slider('trTo','艦首側の終了位置',t.to*100,5,100,1,Math.round(t.to*100)+'%')}</div><div class="row2"><button class="btn sm" data-trench-range="all">全長に適用</button><button class="btn sm" data-trench-range="middle">中央70%に適用</button></div><p class="note">船体の一部だけに作っても、上下の船体は全長にわたって同じ間隔だけ離れるので、端で段差はできません。溝は指定した範囲だけに入ります。削った面には溝を付けません。</p></details>
  <button class="btn primary" id="btnTrench">上下を開いて作成</button></div>
  <div class="pgroup"><h4>設置済みトレンチ</h4><ul class="ilist">${(ship.trenches||[]).map(q=>`<li><span><b>${q.mode==='split'?'一定間隔':'従来の切削'} · ${q.side==='both'?'両舷':q.side==='port'?'左舷':'右舷'}</b>上下 ${fmtM(q.height)} / 後退 ${fmtM(q.depth)}</span><div class="cutter-list-actions">${q.mode!=='split'?`<button class="btn sm" data-gap-trench="${q.id}">一定間隔に変更</button>`:''}<button class="btn sm ghost" data-deltrench="${q.id}">撤去</button></div></li>`).join('')||'<li>トレンチはまだありません。</li>'}</ul></div>`;
}
function hpWidth(){return ship.hull.W;}
function systemsHTML(){
  const rs=ship.parts.filter(C.isReactor),eng=ship.parts.filter(p=>p.k==='engine'),routes=C.enginePaths(ship),S0=S;
  return `<div class="flow-intro"><span class="eyebrow">ENGINEERING / 03</span><h3>炉とノズルで機関を組む</h3><p>接続された機関は自動生成され、航空区画の自動充填から除外されます。</p><button class="btn primary" data-internal>内部を透視する</button></div>
  <h4>動力の接続</h4>${rs.map(r=>`<div class="system-card"><button class="system-title" data-goto="${r.id}"><i style="background:${rgb(C.PARTS[r.k].col)}"></i>${C.PARTS[r.k].name} #${r.id}<span>${fW(C.reactorPower(r))}</span></button>${eng.filter(e=>C.reactorFor(ship,e)?.id===r.id).map(e=>{const path=routes.find(p=>p.nozzle===e.id);return `<button class="engine-row" data-goto="${e.id}"><span>↳ ノズル #${e.id} · ⌀${Math.round(e.d)} m</span><b>${path?fLen(path.seg.l):'接続不可'}</b></button>`;}).join('')||'<p class="note">接続されたノズルはありません。</p>'}</div>`).join('')||'<p class="note">先に主反応炉か補助反応炉を配置してください。</p>'}
  ${eng.filter(e=>!C.reactorFor(ship,e)).map(e=>`<button class="engine-row neg" data-goto="${e.id}">未接続ノズル #${e.id}</button>`).join('')}
  ${S0?`<h4>区画の能力</h4><dl class="engineering-stats">${[['自動機関の占有',ja(S0.engineVolume)+' m³'],['反応物貯蔵',ja(S0.fuelVolume)+' m³'],['巡航時持続',S0.fuelHours.toFixed(1)+' 時間'],['反応物供給能力',fPct(S0.supplyRatio)],['慣性制御 対応質量',fMass(S0.inertialSupport)],['構造維持 対応質量',fMass(S0.integritySupport)],['リパルサー 支持質量',fMass(S0.repulsorSupport)],['乗艦可能',num(S0.personCapacity??S0.crewCapacity)+' 名'],['自動化装置の受け持ち',num(S0.autoCrew||0)+' 名分'],['兵員枠（定員を除く）',num(S0.troopCapacity)+' 名'],['車両の搭載',num(S0.vehicleCapacity)+' 両'],['航空整備',num(S0.serviceCapacity)+' 機分'],['貨物容量',fMass(S0.cargoCapacity)]].map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`:''}
  `;
}
function bindEngineering(){
  $('#panel').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.group==='bridge'){st.equipmentId=null;st.tab='bridge';st.bridgeMode=st.bridgeMode==='windows'?'windows':'body';st.sel=null;st.partTool='place';renderPanel();return;}
    if(d.group){st.equipmentId=null;if(st.structForm==='reference'){st.structForm='trap';delete st.skinAsset;}st.tab='mod';st.group=d.group;if(st.group!=='weapons')st.part=PART_KEYS.find(k=>C.PARTS[k].group===st.group);st.partTool='place';renderPanel();}
    if(d.cmdsub){if(d.cmdsub==='rooms'){st.tab='mod';st.group='command';st.part=PART_KEYS.find(k=>C.PARTS[k].group==='command')||st.part;st.partTool='place';st.equipmentId=null;}else{st.tab='bridge';st.bridgeMode=d.cmdsub;st.sel=null;st.partTool='place';}renderPanel();return;}
    if(d.structform){st.structForm=d.structform;renderPanel();}
    if(d.structplate){st.structPlate=d.structplate==='plate';st.structLight=d.structplate==='light';renderPanel();updateHint();}
    if('plateflat'in d){st.structSize=[120,60,4];renderPanel();updateHint();}
    if(d.editplate){const lbl={plate:'装甲外板にする',light:'軽構造にする',frame:'通常の構造物にする'}[d.editplate]||'構造の種類';mutate(lbl,()=>editSel(p=>{if(p.k!=='struct')return;if(d.editplate==='plate'){p.plate=true;p.plateT=C.plateThickness(p);delete p.light;}else if(d.editplate==='light'){delete p.plate;delete p.plateT;p.light=true;}else{delete p.plate;delete p.plateT;delete p.light;}}),'parts');renderPanel();}
    if(d.editform){mutate('構造物の形状',()=>editSel(p=>{p.form=d.editform;if(d.editform!=='reference'){delete p.skinAsset;delete p.equipmentId;}}),'parts');renderPanel();}
    if(d.swmode&&['beam','pulse'].includes(d.swmode)){mutate('超兵器の射撃の型',()=>editSel(p=>{if(C.isSuperweapon(p)&&p.k==='sbeam')p.fireMode=d.swmode;}),'parts');renderPanel();}
    if(d.partaxis){mutate('円筒の向き',()=>editSel(p=>p.dir=d.partaxis==='y'?[0,1,0]:d.partaxis==='z'?[0,0,1]:[1,0,0]),'parts');renderPanel();}
    if(d.duplicate){const p=selItem();if(!p)return;let q;mutate('構造物を複製',()=>{q=C.placePart(ship,'struct',[p.c[0],p.c[1]+p.s[2],p.c[2]],p.s,p,false);},'parts');if(q)st.sel={list:'parts',id:q.id};renderPanel();}
    if(d.trside){st.trench.side=d.trside;st.showTrench=true;renderPanel();}
    if(b.id==='btnTrench'){if(st.trench.from>=st.trench.to){toast('艦尾側端を艦首側端より手前にしてください');return;}mutate('上下を開いてトレンチを作成',()=>{ship.trenches||=[];ship.trenches.push({...st.trench,id:ship.nextId++,mode:'split',taper:false});},'hull');st.showTrench=true;renderPanel();}
    if(d.gapTrench){mutate('トレンチを一定間隔に変更',()=>{const t=ship.trenches.find(t=>t.id===+d.gapTrench);if(t){t.mode='split';t.taper=false;}},'hull');renderPanel();}
    if(d.trenchRange){st.trench.from=d.trenchRange==='all'?0:.15;st.trench.to=d.trenchRange==='all'?1:.85;renderPanel();}
    if(d.deltrench){mutate('トレンチを撤去',()=>ship.trenches=ship.trenches.filter(t=>t.id!==+d.deltrench),'hull');renderPanel();}
    if(d.goto){st.sel={list:'parts',id:+d.goto};st.tab='mod';st.partTool='select';st.view='xray';syncHud();renderPanel();requestDraw();}
    if('internal'in d){st.view='xray';syncHud();requestDraw();}
    if('commandroom'in d){st.equipmentId=null;st.tab='mod';st.group='command';st.part='command';st.partTool='place';renderPanel();}
    if(b.id==='btnAtCoordinates'){const c=['X','Y','Z'].map(a=>Number($('#newP'+a).value));if(c.some(v=>!Number.isFinite(v)||Math.abs(v)>C.DESIGN_LIMITS.coordinate)){toast('座標を確認してください');return;}st.newPos=c;const p=partPreview({p:c,n:[0,1,0],kind:'section'});let made;mutate('座標に区画を配置',()=>{made=C.placePart(ship,p.k,p.c,p.k==='struct'?p.s:p.d,p,st.mirror);try{placeVerticalParts(made);}catch(e){removeLinked('parts',made);made=null;throw e;}},'parts');if(made){st.sel={list:'parts',id:made.id};st.partTool='select';renderPanel();}}
  });
  $('#panel').addEventListener('change',e=>{
    const t=e.target;if(!t.dataset.reactor)return;
    const val=t.value==='auto'?null:+t.value;
    if(t.dataset.reactor==='new')st.reactor=val;
    else mutate('接続する炉',()=>editSel(p=>{if(val==null)delete p.reactor;else p.reactor=val;}),'parts');
    renderPanel();
  });
  $('#panel').addEventListener('input',e=>{
    const k=e.target.dataset.sl;if(!k||e.target.value==='')return;const v=Math.max(+e.target.min,Math.min(+e.target.max,Number(e.target.value)||0)),out=$('#out-'+k);
    const live=(fn,what='parts')=>{beginDrag('設計を調整');fn();touch(what);scheduleStats(350);};
    if(/^([es])angle[0-3]$/.test(k)){const i=+k.at(-1);if(k[0]==='e')live(()=>editSel(p=>{p.angles||=[0,0,0,0];p.angles[i]=v;}));else st.structAngles[i]=v;if(out)out.textContent=deg(v);}
    if(['eshellCurve','sshellCurve','eshellThick','sshellThick'].includes(k)){const prop=k.slice(1),val=prop==='shellCurve'?v/100:v;if(k[0]==='e')live(()=>editSel(p=>{if(p.form==='shell')p[prop]=val;}));else st[prop]=val;if(out)out.textContent=prop==='shellCurve'?Math.round(v)+'%':fmtM(v);}
    if(['eyaw','syaw','eoffsetX','eoffsetZ','soffsetX','soffsetZ'].includes(k)){const prop=k.slice(1);if(k[0]==='e')live(()=>editSel(p=>p[prop]=v));else st['struct'+prop[0].toUpperCase()+prop.slice(1)]=v;if(out)out.textContent=prop==='yaw'?deg(v):fmtM(v);}
    if(k.startsWith('tr')){const map={trDepth:'depth',trHeight:'height',trLevel:'level',trFrom:'from',trTo:'to'};if(map[k]){st.trench[map[k]]=k==='trDepth'||k==='trHeight'?v:v/100;if(out)out.textContent=k==='trDepth'||k==='trHeight'?fmtM(v):v+'%';}}
    if(['engineYaw','enginePitch','newEngineYaw','newEnginePitch'].includes(k)){
      const make=dir=>{let y=Math.atan2(dir[2],-dir[0]),p=Math.asin(dir[1]);if(k.endsWith('Yaw'))y=v*Math.PI/180;else p=v*Math.PI/180;return [-Math.cos(y)*Math.cos(p),Math.sin(p),Math.sin(y)*Math.cos(p)];};
      if(k.startsWith('new'))st.engineDir=make(st.engineDir);else live(()=>editSel(p=>p.dir=make(p.dir||[-1,0,0])));if(out)out.textContent=deg(v);
    }
    if(['fitX','fitZ','fitY','fitAlong'].includes(k)){const f=selItem();if(f&&st.sel.list==='fits'){beginDrag('装備の位置');const p=f.p.slice();if(k==='fitX')p[0]=v;else if(k==='fitZ')p[2]=v;else if(k==='fitY')p[1]=v;else{const fr=C.windowFrame(f),host=ship.parts.find(q=>q.id===f.host),cur=C.dot(C.sub(f.p,host?host.c:[0,0,0]),fr.fw);for(let a=0;a<3;a++)p[a]+=fr.fw[a]*(v-cur);}moveFitTo(f,p,f.n||C.AXES[f.a]);touch('fits');scheduleStats(350);if(out)out.textContent=fmtM(v);}}

    if(k==='shieldTarget'){live(()=>ship.shieldTarget=v/100,'none');if(out)out.textContent=v+'%';}
  });
  $('#sheet').addEventListener('click',e=>{const b=e.target.closest('[data-reference]');if(!b)return;closeSheet();openExample(b.dataset.reference);});
  window.addEventListener('pagehide',()=>{if(ship)LS.set('yard.draft3',JSON.stringify(C.serialize(ship)));});
}

st.roomSize=[120,60,24];
// v21 Keep the palette choices valid when the design changes between craft and capital ship.
function craftPaletteGuard(){if(!ship)return;const gs=layoutGroups();if(st.group!=='weapons'&&st.group!=='bridge'&&!gs.some(g=>g[0]===st.group))st.group=craftDesign()?'craft':'power';if(st.part&&!partOffered(st.part))st.part=PART_KEYS.find(k=>C.PARTS[k].group===st.group&&partOffered(k))||'struct';if(craftDesign()&&st.group==='bridge')st.group='craft';const wk=weaponKeys();if(!wk.includes(st.fit))st.fit=wk[0];if(craftDesign()&&st.structSize[0]>ship.hull.L)st.structSize=[Math.max(.2,+(ship.hull.L*.3).toFixed(2)),Math.max(.2,+(ship.hull.W*.3).toFixed(2)),Math.max(.05,+(ship.hull.H*.1).toFixed(2))];}
function renderPanel(){craftPaletteGuard();
  if(fleet.mode!=='design'){fleetRender();return;}
  refreshSolidCutterOverlay();

  if(ship&&st.tab==='mod'&&st.group==='weapons'){compartmentWeaponsPanel();organizePanel();return;}
  if(ship&&st.tab==='ground'){markTabs();$('#panel').innerHTML=groundPanelHTML();updateHint();refreshOverlay();return;}
  v3RenderPanel();if(!ship)return;const panel=$('#panel');
  if(st.tab==='hull'){
    panel.insertAdjacentHTML('afterbegin',`<div class="pgroup"><label><input type="checkbox" data-assembly ${ship.hull.assembly?'checked':''}> 船体を独立した構造パーツで組み立てる</label><p class="note">有効時は一体船体を表示せず、配置した船殻だけを容積・質量・内部区画の境界に使います。環状船体や分離したポッドを作れます。長さ・幅・高さは設計範囲です。</p><label><input type="checkbox" data-corehull ${ship.hull.core?'checked':''}> 船体をコア船体にする</label><p class="note">ルクレハルク級の中央球体（コアシップ）のように、小さな船体の周りを構造物で大きく組む艦に使います。全長・艦種・損傷区画・艦隊戦での大きさを、構造物を含めた全体で計算します。</p></div>`);
    const rows=ship.hull.stations||C.planStations(ship.hull).map(t=>C.profileAt(ship.hull,t)),deckOK=ship.hull.sec!=='ellipse';
    panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>船体断面・艦尾を設計</h4><p class="note">艦尾から艦首へ。肩の張り出し・舷側の切り込み・艦首の薄さを個別に作れます。幅・厚さ・上下位置は船体寸法に対する割合。甲板（上面）・船底（下面）の平らな幅は各断面の幅に対する割合です。舷側帯・帯位置は装甲楔形の舷側にある垂直帯の厚さと高さ位置（各断面の厚さに対する割合）で、断面ごとに変えられます。艦首の末端2断面は幅・厚さが同率で連動し、船体の幅：高さを保ちます（表の下のチェックで解除できます）。断面と断面の間の「＋」で、その位置に断面を追加します。菱形は上下が頂点です。装甲楔形も甲板・船底幅を0%にすれば尖ります。</p><div class="station-scroll"><table class="station-table"><thead><tr><th>前後 %</th><th>幅 %</th><th>厚さ %</th><th>上下 %</th><th>甲板 %</th><th>船底 %</th><th>舷側帯 %</th><th>帯位置 %</th><th></th></tr></thead><tbody>${rows.map((a,i)=>`<tr>${[a[0],a[1],a[2],a[3]??0,a[4]??ship.hull.deckWidth??.52,a[5]??ship.hull.keelWidth??0,a[6]??ship.hull.belt??.13,a[7]??ship.hull.chineHeight??.5].map((v,j)=>`<td><input aria-label="断面${i+1} ${['前後位置','幅','厚さ','上下位置','甲板幅','船底幅','舷側帯の厚さ','舷側帯の上下位置'][j]}" type="number" inputmode="decimal" data-station="${i}" data-axis="${j}" value="${Math.round(v*1000)/10}" min="${[0,.5,.5,-50,0,0,2,20][j]}" max="${[100,150,150,80,98,98,98,80][j]}" step=".1" ${(j===0&&(i===0||i===rows.length-1))||(j===2&&C.bowStation({...ship.hull,stations:rows},i))||(j>=4&&!deckOK)?'disabled':''} ${j===2&&C.bowStation({...ship.hull,stations:rows},i)?'title="艦首は幅と厚さが連動しています。表の下のチェックを外すと個別に変更できます"':''}></td>`).join('')}<td>${i&&i<rows.length-1?`<button class="btn sm ghost" data-dropstation="${i}" aria-label="断面${i+1}を削除">×</button>`:''}</td></tr>${i<rows.length-1?`<tr class="station-gap"><td colspan="9"><button type="button" class="station-add" data-insertstation="${i}" ${rows.length>=32?'disabled':''} aria-label="断面${i+1}と断面${i+2}の間に断面を追加"><b aria-hidden="true">＋</b>${num((a[0]+rows[i+1][0])*50,1)}% に断面を追加</button></td></tr>`:''}`).join('')}</tbody></table></div><label class="check"><input type="checkbox" data-bowlink ${ship.hull.bowFree?'':'checked'}> 艦首の末端2断面は幅と厚さを連動する（船体の幅：高さの比を保つ）</label>${ship.hull.sec!=='warship'?`<p class="note">${deckOK?'甲板・船底の幅を変えると、断面は今の形に近い「装甲楔形」へ切り替わります。':'楕円断面では甲板・船底の幅は使いません。'}</p>`:''}<div class="sliders">${slider('deckWidth','上甲板の幅',Math.round((ship.hull.deckWidth??.52)*100),0,98,1,Math.round((ship.hull.deckWidth??.52)*100)+'%')}${slider('keelWidth','船底の平坦幅',Math.round((ship.hull.keelWidth??0)*100),0,95,1,Math.round((ship.hull.keelWidth??0)*100)+'%')}${slider('hullStart','本体船殻の艦尾位置',Math.round((ship.hull.start||0)*1000)/10,0,60,.1,Math.round((ship.hull.start||0)*ship.hull.L)+' m')}${slider('chineHeight','舷側帯の上下位置',Math.round((ship.hull.chineHeight??.5)*100),20,80,1,Math.round((ship.hull.chineHeight??.5)*100)+'%')}${slider('belt','舷側帯の厚さ',Math.round((ship.hull.belt??.13)*100),2,45,1,Math.round((ship.hull.belt??.13)*100)+'%')}</div></div>`);
    panel.insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>外板スキン</h4>${seg('yardpaint',[['neutral','無塗装'],['republic','共和国の赤帯'],['dark','暗色'],['cis','分離主義の青灰色']],ship.paint||'neutral')}<p class="field-label">窓明かり（トレンチ・構造物の壁）</p>${seg('yardlights',[['white','白'],['blue','青'],['warm','暖色'],['off','消灯']],ship.lights||'white')}<p class="field-label">バーニア光（エンジン噴射の色）</p>${seg('yardengine',Object.entries(C.ENGINE_GLOWS).map(([k,v])=>[k,`<i class="swatch" style="background:rgb(${v.rgb.join(',')})"></i>${v.name}`]),C.ENGINE_GLOWS[ship.engineGlow||'blue']?ship.engineGlow||'blue':'')}<label class="engine-pick"><input type="color" data-yardenginecolor value="${engineHex(ship.engineGlow)}"><span>任意の色${ship.engineGlow&&!C.ENGINE_GLOWS[ship.engineGlow]?`（${ship.engineGlow}）`:''}</span></label><div class="sliders">${slider('yardDetail','トレンチ内の設備密度',ship.detail??1,0,2,.5,String(ship.detail??1))}</div><p class="note">スキンは塗装・装甲継ぎ目のみで、指揮能力は追加されません。指揮所は「艦橋」から艦橋本体やポッドを配置します。</p></div>`);
  }
  if(st.tab==='mod'&&st.partTool==='place'&&C.PARTS[st.part].shape==='cube')panel.insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>区画の寸法</h4><div class="sliders">${st.roomSize.map((v,i)=>slider('newRoom'+i,['長さ','幅','高さ'][i],v,4,[ship.hull.L,ship.hull.W,ship.hull.H][i],1,fmtM(v))).join('')}</div><p class="note">立方体に限らず、飛行甲板・貨物甲板のような薄く長い区画を配置できます。</p></div>`);
  if(st.tab==='mod')panel.insertAdjacentHTML('afterbegin','<div class="note compartment-rule">内部区画は外殻内に収容。箱形区画の干渉は必要容積を保って自動統合します。主炉・シールド・エンジンと外装機器は張出し可能。</div>');
  referencePanel(panel);layoutPanel(panel);
  if(st.tab==='hull')panel.insertAdjacentHTML('afterbegin',hullDimsHTML());
  if(st.tab==='bridge'&&st.bridgeMode==='body')panel.insertAdjacentHTML('beforeend',surfaceControls({},false));
  if(['hull','carve','armor'].includes(st.tab))panel.insertAdjacentHTML('afterbegin',`<div class="pgroup hull-sub">${seg('hullsub',HULL_SUB,st.tab)}</div>`);
  if(st.tab==='spec')panel.insertAdjacentHTML('afterbegin',trialCardHTML());
  organizePanel();
}
function partEditor(){
  let html=v3PartEditor(),p=selItem();if(!p||st.sel.list!=='parts')return html;
  html+=`<div class="pgroup"><label class="field-label">区画名<input type="text" data-partlabel value="${esc(p.label||C.PARTS[p.k].name)}" maxlength="80"></label></div>`;
  if((p.k==='struct'&&!['reference','outline','loft','roundloft','arc','ellipsoid','dome','cylinder','cone','shell'].includes(p.form))||(p.room&&!p.outline)){html+=`<div class="pgroup"><h4>平面の輪郭</h4>${p.k==='struct'&&p.form!=='chamfer'?'<button class="btn sm" data-chamfer>切隅・平面台形にする</button>':''}<div class="sliders">${slider('aftWidth','艦尾側の幅',Math.round((p.aftWidth??1)*100),3,150,1,Math.round((p.aftWidth??1)*100)+'%')}${slider('foreWidth','艦首側の幅',Math.round((p.foreWidth??1)*100),3,150,1,Math.round((p.foreWidth??1)*100)+'%')}${slider('corner','隅を落とす',Math.round((p.corner??.12)*100),0,45,1,Math.round((p.corner??.12)*100)+'%')}</div><p class="note">甲板・艦橋の角や、船首へ細くなる区画を再現できます。</p></div>`;}
  if(C.PARTS[p.k].shape==='cube'&&!p.room)html+='<button class="btn" data-roomconvert>長さ・幅・高さを個別に編集</button>';
  if(p.room&&!p.outline)html+='<button class="btn" data-roomoutline>区画の輪郭を頂点で編集する</button>';
  if(p.room&&p.outline)html+='<p class="note">輪郭区画の発着には、矩形の飛行・ドッキング区画を隣接させて接続します。</p>';
  if(p.room)html+='<div class="pgroup"><button class="btn" data-fitroom>区画を外殻内に収める</button><p class="note">位置を保ち、前後・幅・高さを同じ比率で縮小します。実際の占有・容量にも反映されます。</p></div>';
  if(p.k==='struct')html+=`<div class="pgroup"><h4>構造物のスキン</h4>${seg('partskin',[['armor','装甲板'],['service','整備機器'],['plain','追加模様なし']],p.skin||'armor')}<p class="note">スキンは外板の模様です。指揮所が必要なら艦橋ポッドを壁に取り付けます。</p><label>構造物の塗色 <input type="color" data-partpaint value="${p.paint||'#ced2d6'}"></label></div>`;
  if(C.PARTS[p.k].shape==='cyl'&&!C.PARTS[p.k].fixed)html+=`<div class="sliders">${slider('cylLength','筒の長さ',p.length||C.partDims(p).l,4,p.k==='hyper'?C.DESIGN_LIMITS.partSize:Math.min(C.DESIGN_LIMITS.partSize,ship.hull.L),p.k==='hyper'?.1:1,p.k==='hyper'?num(p.length||C.partDims(p).l,2)+' m':fmtM(p.length||C.partDims(p).l))}</div>`;
  if(p.k==='engine'&&!C.parametricEngine(p))html+=`<div class="pgroup"><h4>ノズル前方の機関胴</h4><div class="sliders">${slider('bodyLength','機関胴の長さ',p.bodyLength||p.d*2.2,4,ship.hull.L*.6,1,fmtM(p.bodyLength||p.d*2.2))}${slider('bodyRadius','機関胴の径',Math.round((p.bodyRadius??.52)*200),60,160,1,Math.round((p.bodyRadius??.52)*200)+'%')}</div><p class="note">ノズルと平行な機関胴と、炉へつながる供給部を自動占有します。汎用ノズルの機関胴は炉との間隔の62%以内に収まります。</p></div>`;
  if(C.isInternal(p)&&C.PARTS[p.k].shape==='cube'&&!ship.hatches.some(h=>h.bay===p.id)&&!['flight','dock'].includes(p.airRole))html+=`<div class="pgroup blueprint-card"><label><input type="checkbox" data-autofit ${p.autoFit!==false?'checked':''}> 干渉時に容積を保って自動統合</label><p class="note">近くの区画と用途・必要容積を分けたまま統合し、空き空間に形を組み替えます。指定した位置・寸法は基準形状として保持します。</p></div>`;
  if(p._packingGroup)html+=packingInfoHTML(p);
  if(C.isInternal(p))html+=`<div class="pgroup blueprint-card"><h4>外殻内に自動切取り</h4><p>使用できる体積 <b>${Math.round((p._packing?.retained??p._clip?.retained??1)*100)}%</b></p><p class="note">船体・構造物の内側だけを容量と質量に算入します。指定寸法は保持。外へ広げるには先に構造物を追加してください。</p></div>`;
  if((p.k==='struct'&&p.form==='outline')||(p.room&&p.outline)){const rows=C.outlinePoints(p);html+=`<div class="pgroup"><h4>輪郭の頂点と甲板の傾斜</h4><p class="note">中心を0%、艦尾−50%・艦首50%、左舷−50%・右舷50%として輪郭を編集します。凹形の段差も作れます。</p><table class="station-table"><thead><tr><th>前後 %</th><th>左右 %</th><th>辺</th></tr></thead><tbody>${rows.map((a,i)=>`<tr>${a.map((v,j)=>`<td><input type="number" aria-label="輪郭${i+1} ${j?'左右':'前後'}" data-outline="${i}" data-axis="${j}" value="${Math.round(v*10000)/100}" min="-200" max="200" step=".5"></td>`).join('')}<td><button class="btn sm" data-addvertex="${i}">＋</button>${rows.length>3?`<button class="btn sm" data-dropvertex="${i}">×</button>`:''}</td></tr>`).join('')}</tbody></table><div class="sliders">${slider('deckSlope','艦首へ向かう甲板の傾斜',p.deckSlope||0,-45,45,.1,deg(p.deckSlope||0))}${slider('ridge','中心から舷側へ下げる量',p.ridge||0,-300,300,1,fmtM(p.ridge||0))}</div><p class="note">寸法・輪郭・傾斜は外観、船内容積、衝突判定すべてに反映します。</p></div>`;}
  if(p.k==='struct'&&['loft','roundloft','shell'].includes(p.form)){const sh=p.form==='shell',rows=C.structRows(p),lab=sh?['前後','板の幅','内縁の高さ','外縁の高さ','左右移動']:['前後','幅','天井','床','左右移動'];html+=`<div class="pgroup"><h4>${sh?'曲面板の前後断面':'構造物の前後断面'}</h4><p class="note">${sh?'断面ごとに、内縁から外縁までの板の幅、内縁（上端）と外縁（下端）の高さ、左右位置を変えられます。両端の幅を狭めると木の葉形の板になります。':'幅・天井・床を断面ごとに変え、傾斜甲板や長い艦橋外殻を作れます。舷側への下げ量を指定すると山形に、負の値で谷形に曲がります。'}</p><table class="station-table"><thead><tr>${lab.map(a=>`<th>${a.replace('左右移動','左右')} %</th>`).join('')}<th></th></tr></thead><tbody>${rows.map((a,i)=>`<tr>${[...a.slice(0,4),a[4]||0].map((v,j)=>`<td><input type="number" aria-label="構造断面${i+1} ${lab[j]}" data-loft="${i}" data-axis="${j}" value="${Math.round(v*1000)/10}" step=".1" ${(j===0&&(i===0||i===rows.length-1))||(j===2&&C.bowStation({...ship.hull,stations:rows},i))?'disabled':''}></td>`).join('')}<td>${i>0&&i<rows.length-1?`<button class="btn sm" data-droploft="${i}">×</button>`:''}</td></tr>`).join('')}</tbody></table><button class="btn sm" data-addloft>構造断面を追加</button>${sh?`<label class="check-row"><input type="checkbox" data-stripes ${p.stripes?.length?'checked':''}> 縦の識別帯（板に沿った青い帯）</label>`:`<div class="sliders">${slider('ridge','中心から舷側へ下げる量',p.ridge||0,-300,300,1,fmtM(p.ridge||0))}${slider('corner','隅を落とす',Math.round((p.corner??.07)*100),0,45,1,Math.round((p.corner??.07)*100)+'%')}${slider('wallInset','上端の左右絞り',Math.round((p.wallInset??0)*100),0,80,1,Math.round((p.wallInset??0)*100)+'%')}</div>`}</div>`;}
  if(p.k==='engine'&&!C.parametricEngine(p))html+=`<div class="pgroup"><h4>拡張ノズル</h4><div class="sliders">${slider('nozzleLength','ノズルの奥行き',p.nozzleLength||p.d*.32,2,300,1,fmtM(p.nozzleLength||p.d*.32))}${slider('throatRatio','奥の噴出口の径',Math.round((p.throatRatio??.34)*100),18,80,1,Math.round((p.throatRatio??.34)*100)+'%')}</div></div>`;
  if(p.k==='hangar')html+=aviationPartHTML(p);
  if(p.k==='struct'&&p.form==='arc')html+=`<div class="pgroup"><h4>環状船体の空洞と開き</h4>${[['arcInner','内径の比率',(p.arcInner??.65)*100,5,95],['arcStart','円弧の開始角',p.arcStart??30,-180,180],['arcSweep','円弧の角度',p.arcSweep??300,5,360]].map(([k,n,v,lo,hi])=>`<label>${n}<input type="number" data-arc="${k}" value="${v}" min="${lo}" max="${hi}" step="1"></label>`).join('')}<p class="note">360°で閉じた環。0°は艦首側です。内径を広げると船内容積と質量が減ります。</p></div>`;
  if(p.k==='struct')html+=`<div class="pgroup"><label><input type="checkbox" data-bands ${p.bands?.length?'checked':''}> 青色の識別帯</label><p class="note">構造物の塗装です。艦橋ポッドや指揮区画は追加しません。</p></div>`;
  return html;
}
function bindRealism(){
  $('#panel').addEventListener('change',e=>{if(blockedHullControl(e.target))return;const t=e.target;if('assembly'in t.dataset){mutate('船体の組立方式',()=>ship.hull.assembly=t.checked,'all');renderPanel();}if('corehull'in t.dataset){mutate('コア船体',()=>{if(t.checked)ship.hull.core=true;else delete ship.hull.core;},'all');renderPanel();}if('bands'in t.dataset){mutate('識別塗装',()=>editSel(p=>p.bands=t.checked?[[.18,.205],[.235,.25],[.68,.71],[.73,.745]]:[]),'parts');renderPanel();}if('stripes'in t.dataset){mutate('曲面板の識別帯',()=>editSel(p=>{if(p.form!=='shell')return;if(t.checked)p.stripes=[[.28,.36],[.5,.58]];else delete p.stripes;}),'parts');renderPanel();}if(t.dataset.shellflip){if(t.dataset.shellflip==='e')mutate('曲面板の向き',()=>editSel(p=>{if(p.form==='shell')p.shellFlip=t.checked;}),'parts');else st.shellFlip=t.checked;renderPanel();}if('arc'in t.dataset){const k=t.dataset.arc,v=Number(t.value);if(!Number.isFinite(v))return;mutate('環状船体の形状',()=>editSel(p=>p[k]=k==='arcInner'?C.clamp(v/100,.05,.95):k==='arcSweep'?C.clamp(v,5,360):C.clamp(v,-180,180)),'parts');renderPanel();}});
  const ensureStations=()=>{ship.hull.stations||=C.planStations(ship.hull).map(t=>C.profileAt(ship.hull,t));return ship.hull.stations;};
  $('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||blockedHullControl(b))return;const d=b.dataset;
    if(d.addvertex!=null||d.dropvertex!=null){mutate('輪郭の頂点を編集',()=>editSel(p=>{const a=C.outlinePoints(p).map(q=>q.slice());if(d.addvertex!=null&&a.length<96){const i=+d.addvertex,b=a[(i+1)%a.length];a.splice(i+1,0,a[i].map((v,j)=>(v+b[j])/2));}else if(d.dropvertex!=null&&a.length>3)a.splice(+d.dropvertex,1);if(C.validOutline(a))p.outline=a;else toast('輪郭の線が交差するため変更できません');}),'parts');renderPanel();}
    if('addloft'in d){mutate('構造断面を追加',()=>editSel(p=>{p.loft||=C.structRows(p).map(a=>a.slice());if(p.loft.length>=32)return;let i=0;for(let j=1;j<p.loft.length-1;j++)if(p.loft[j+1][0]-p.loft[j][0]>p.loft[i+1][0]-p.loft[i][0])i=j;const t=(p.loft[i][0]+p.loft[i+1][0])/2;p.loft.splice(i+1,0,C.loftProfile(p,t));}),'parts');renderPanel();}
    if(d.droploft){mutate('構造断面を削除',()=>editSel(p=>p.loft.splice(+d.droploft,1)),'parts');renderPanel();}
    if('addstation'in d){mutate('船体断面を追加',()=>{const a=ensureStations();if(a.length>=32)return;let i=0;for(let j=1;j<a.length-1;j++)if(a[j+1][0]-a[j][0]>a[i+1][0]-a[i][0])i=j;const t=(a[i][0]+a[i+1][0])/2;a.splice(i+1,0,C.profileAt(ship.hull,t));C.normalizeBow(ship.hull);},'hull');renderPanel();}
    if(d.insertstation!=null){const i=+d.insertstation;mutate('船体断面を追加',()=>{const a=ensureStations();if(a.length>=32||i<0||i>=a.length-1)return;const t=(a[i][0]+a[i+1][0])/2;a.splice(i+1,0,C.profileAt(ship.hull,t));C.normalizeBow(ship.hull);},'hull');renderPanel();return;}
    if(d.dropstation){mutate('船体断面を削除',()=>{ensureStations().splice(+d.dropstation,1);C.normalizeBow(ship.hull);},'hull');renderPanel();}
    if(d.partskin){mutate('構造物のスキン',()=>editSel(p=>p.skin=d.partskin),'parts');renderPanel();}
    if(d.yardpaint){mutate('船体の塗装',()=>ship.paint=d.yardpaint,'all');renderPanel();}
    if(d.yardlights&&C.SHIP_LIGHT_KINDS.includes(d.yardlights)){mutate('窓明かり',()=>ship.lights=d.yardlights,'view');renderPanel();requestDraw();}
    if(d.yardengine){setEngineGlow(d.yardengine);return;}
    if('roomoutline'in d){mutate('区画の輪郭を編集',()=>editSel(p=>{const a=p.aftWidth??1,b=p.foreWidth??1;p.outline=[[-.5,-a/2],[.5,-b/2],[.5,b/2],[-.5,a/2]];}),'parts');renderPanel();}
    if('roomconvert'in d){mutate('区画寸法を分離',()=>editSel(p=>C.setRoomSize(p,[p.d,p.d,p.d])),'parts');renderPanel();}
    if('fitroom'in d){mutate('区画を外殻内に調整',()=>editSel(p=>C.fitRoomToEnvelope(ship,p)),'parts');renderPanel();}
    if('chamfer'in d){mutate('平面輪郭を編集',()=>editSel(p=>p.form='chamfer'),'parts');renderPanel();}
  });
  $('#panel').addEventListener('change',e=>{if(blockedHullControl(e.target))return;const t=e.target;
    if(t.dataset.door){if(dragSnap)endDrag();renderPanelInfo();}
    if(t.dataset.outline!=null){const i=+t.dataset.outline,j=+t.dataset.axis,v=+t.value/100;if(!Number.isFinite(v))return;mutate('輪郭の頂点を移動',()=>editSel(p=>{const a=C.outlinePoints(p).map(q=>q.slice());a[i][j]=C.clamp(v,-2,2);if(C.validOutline(a))p.outline=a;else toast('輪郭の線が交差するため変更できません');}),'parts');renderPanel();}
    if(t.dataset.loft!=null){const i=+t.dataset.loft,j=+t.dataset.axis,v=+t.value/100;if(!Number.isFinite(v))return;mutate('構造断面を調整',()=>editSel(p=>{p.loft||=C.structRows(p).map(a=>a.slice());const a=p.loft;if(j===0)a[i][j]=C.clamp(v,a[i-1][0]+.003,a[i+1][0]-.003);else if(j===1)a[i][j]=C.clamp(v,.02,2);else if(j===2)a[i][j]=C.clamp(v,a[i][3]+.03,1.5);else if(j===3)a[i][j]=C.clamp(v,0,a[i][2]-.03);else a[i][j]=C.clamp(v,-2,2);}),'parts');renderPanel();}
    if('bowlink'in t.dataset){mutate('艦首の幅と厚さの連動',()=>{ensureStations();if(t.checked)delete ship.hull.bowFree;else ship.hull.bowFree=true;C.normalizeBow(ship.hull);},'hull');renderPanel();return;}
    if(t.dataset.station!=null){const i=+t.dataset.station,j=+t.dataset.axis,v=+t.value/100;if(!Number.isFinite(v)||j>7)return;let switched=false;mutate('船体断面を調整',()=>{const a=ensureStations();if(j>=4)switched=deckSection(a);for(const row of a){while(row.length<Math.max(6,j+1))row.push(row.length===3?0:row.length===4?ship.hull.deckWidth??.52:row.length===5?ship.hull.keelWidth??0:row.length===6?ship.hull.belt??.13:ship.hull.chineHeight??.5);}a[i][j]=j===0?C.clamp(v,a[i-1][0]+.002,a[i+1][0]-.002):C.clamp(v,[0,.005,.005,-.5,0,0,.02,.2][j],[1,1.5,1.5,.8,.98,.98,.98,.8][j]);C.normalizeBow(ship.hull);},'hull');if(switched)toast('甲板・船底の幅を使うため、断面を「装甲楔形」に切り替えました');renderPanel();}
    if('autofit'in t.dataset){mutate('区画の自動統合',()=>editSel(p=>p.autoFit=t.checked),'parts');renderPanel();}
    if('partlabel'in t.dataset){mutate('区画名',()=>editSel(p=>p.label=t.value.slice(0,80)),'none');renderPanel();}
    if('partpaint'in t.dataset){mutate('構造物の色',()=>editSel(p=>p.paint=t.value),'parts');}
  });
  $('#panel').addEventListener('input',e=>{if(blockedHullControl(e.target))return;const t=e.target,k=t.dataset.sl;if(t.value==='')return;const v=t.min!=null&&t.max!=null?C.clamp(+t.value,+t.min,+t.max):+t.value;if(!Number.isFinite(v))return;const out=$('#out-'+k);
    const live=(fn,what='parts')=>{beginDrag('形状・区画を調整');fn();touch(what);scheduleStats(350);};
    if(k?.startsWith('newRoom'))st.roomSize[+k.at(-1)]=v;
    if(/^room[0-2]$/.test(k||''))live(()=>editSel(p=>{const a=p.room.slice();a[+k.at(-1)]=v;C.setRoomSize(p,a);}));
    if(['aftWidth','foreWidth','corner'].includes(k))live(()=>editSel(p=>p[k]=v/100));
    if(['nozzleLength','throatRatio','wallInset','ridge'].includes(k))live(()=>editSel(p=>p[k]=['nozzleLength','ridge'].includes(k)?v:v/100));
    if(k==='bodyLength'||k==='bodyRadius')live(()=>editSel(p=>p[k]=k==='bodyRadius'?v/200:v));
    if(k==='deckSlope')live(()=>editSel(p=>p.deckSlope=v));
    if(k==='cylLength')live(()=>editSel(p=>p.length=v));
    if(k==='plateT')live(()=>editSel(p=>{if(p.plate)p.plateT=C.clamp(v,C.PLATE.min,C.PLATE.max);}));
    if(k==='newPlateT'){st.structPlateT=C.clamp(v,C.PLATE.min,C.PLATE.max);updateHint();}
    if((k==='plateT'||k==='newPlateT')&&out)out.textContent=num(v,1)+' m';
    if(['deckWidth','keelWidth','belt','chineHeight','hullStart'].includes(k))live(()=>{ship.hull[k==='hullStart'?'start':k]=v/100;if(k==='deckWidth')for(const row of ship.hull.stations||[])if(row.length>4)row[4]=v/100;if(k==='keelWidth')for(const row of ship.hull.stations||[])if(row.length>5)row[5]=v/100;if(k==='belt')for(const row of ship.hull.stations||[])if(row.length>6)row[6]=v/100;if(k==='chineHeight')for(const row of ship.hull.stations||[])if(row.length>7)row[7]=v/100;},'hull');
    if(k==='yardDetail')live(()=>ship.detail=v,'parts');
    if(t.dataset.door){const h=ship.hatches.find(h=>h.id===+t.dataset.door);if(h&&C.isSlidingHatch(ship,h)&&C.openingBounds(ship,h)){live(()=>{h.open=v/100;},'hatches');if(t.nextElementSibling)t.nextElementSibling.textContent=v+'%';}}
    if(k==='deckSlope'&&out)out.textContent=deg(v);
    if(out&&(/^(newRoom|room)/.test(k||'')||['aftWidth','foreWidth','corner','bodyLength','bodyRadius','cylLength','deckWidth','keelWidth','belt','yardDetail','chineHeight','hullStart','nozzleLength','throatRatio','wallInset','ridge'].includes(k)))out.textContent=['aftWidth','foreWidth','corner','bodyRadius','deckWidth','keelWidth','belt','chineHeight','hullStart','throatRatio','wallInset'].includes(k)?v+'%':k==='yardDetail'?String(v):k==='cylLength'&&selItem()?.k==='hyper'?num(v,2)+' m':fmtM(v);
  });
}

function referenceAircraftSettingHTML(r){
 if(!ship.airWings?.length)return '';
 const a=aviationNumbers();return `<p class="note" data-aircraft-setting>現在の航空隊：<b>${num(a.wings.length)} 個飛行隊・指定 ${num(a.requestedCount)} 機</b>。使用 ${aviationSize(a.usedSize)} / 格納容量 ${aviationSize(a.capacity)} サイズ。</p>`;
}
function referencePanel(panel){
 if(C.DREADNOUGHT_EXAMPLES[ship.reference]&&['hull','systems'].includes(st.tab)){const r=C.DREADNOUGHT_EXAMPLES[ship.reference];panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>${esc(r.name)}の作例</h4><p>全長 ${fLen(r.length)} · ${esc(examplePurpose(ship.reference))}</p><p class="note"><a href="${r.source}" target="_blank" rel="noopener">参照モデル · ${esc(r.author)}</a> / CC BY 4.0</p></div>`);}

 if(st.tab==='systems')panel.insertAdjacentHTML('afterbegin',referenceStatsHTML());
 if(st.tab==='systems'&&S&&Object.hasOwn(C.HYPERDRIVE_REFERENCE,ship.reference))panel.insertAdjacentHTML('beforeend',`<div class="pgroup blueprint-card"><h4>ハイパードライブの主機クラス</h4><p>作例の基準 <b>${C.HYPERDRIVE_REFERENCE[ship.reference].class.toFixed(1)}</b> · 現在 <b>${S.hyperClass==null?'なし':S.hyperClass.toFixed(1)}</b></p><p class="note">数字が小さいほど高速です。装置の有効体積と艦の質量から計算し、装置を大きくするか艦を軽くすると小さくなります。</p></div>`);
 if(C.SEPARATIST_EXAMPLES[ship.reference]&&['hull','systems'].includes(st.tab)){const r=C.SEPARATIST_EXAMPLES[ship.reference];panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>${esc(r.name)}の作例</h4><p>全長 ${fLen(r.length)} · ${esc(examplePurpose(ship.reference, r.role))}</p><p class="note"><a href="${r.source}" target="_blank" rel="noopener">参照モデル · ${esc(r.author)}</a> / ${r.license}</p></div>`);}
 if(st.tab==='systems'&&S)panel.insertAdjacentHTML('beforeend',`<div class="pgroup blueprint-card"><h4>主砲ごとの充電装置</h4><p>${S.chargingCount} 基 · 船内占有 ${ja(S.chargingVolume)} m³</p><p class="note">砲塔の直下・内側に自動確保し、移動・拡縮に追従します。区画と干渉すると使用不能、外殻から切り取られると充電容量が減少します。兵装用電力 ${fW(S.weaponBudget)}。</p><button class="btn" data-internal>充電装置を透視する</button></div>`);
 if(st.tab==='mod'){
  const selectedSpec=activeEquipment();if(st.partTool==='place'&&selectedSpec)panel.insertAdjacentHTML('beforeend',equipmentInfo(selectedSpec));
  const p=selItem();if(p&&st.sel.list==='parts'&&C.parametricEngine(p))panel.insertAdjacentHTML('beforeend',equipmentInfo(C.equipmentSpec(p),p));
  if(p&&st.sel.list==='parts'&&p.skinAsset&&!C.parametricEngine(p))panel.insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>外形の編集</h4><p class="note">寸法と位置を編集できます。基本形状に切り替えると、外形を構造・ノズルの形状設定で作れます。</p><button class="btn sm" data-removeskin>基本形状へ変更する</button></div>`);
  if((p&&st.sel?.list==='parts'&&C.isReactor(p))||(st.partTool==='place'&&!selectedSpec&&C.isReactor({k:st.part})))panel.insertAdjacentHTML('beforeend','<div class="pgroup blueprint-card"><h4>炉の大きさと発電出力</h4><p>出力は実際に使える炉の体積に比例します。主炉と補助炉は、同じ実体積なら同じ出力です。</p><p class="note">球全体を使える配置では、直径2倍で出力8倍。大きくするか炉を追加すると出力が増えます。補助炉は船体外の部分を除いて計算します。ほかの区画との干渉で停止した炉は発電しません。</p></div>');
  if(p&&st.sel.list==='parts'&&(['hyper','shield','localShield'].includes(p.k)||p.k==='engine'&&!C.parametricEngine(p)))panel.insertAdjacentHTML('beforeend',`<div class="pgroup blueprint-card"><h4>寸法と性能</h4><p class="note">${p.k==='hyper'?'有効容量は船内で使える装置の体積です。艦全体の容量と質量から主機クラスを計算します。装置を大きくするとクラスは小さくなり、艦が重くなると大きくなります。':p.k==='engine'?'推力と消費電力は機器の種類と寸法から計算します。給電・機関の干渉・噴射口の閉塞で実効推力が変わります。':'シールドの出力と蓄積容量は、使える発生器の体積から共通の係数で計算します。実効防御には艦の表面積と給電も関係します。'}</p></div>`);
 }
 if(st.tab==='hull'&&ship.hullSkin)panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>外板の表示</h4><label class="field-label"><input type="checkbox" data-refhull ${ship.hullSkin.enabled?'checked':''}>詳細な外板形状を表示</label><p class="note">船体の断面・トレンチ・切削に追従。外板形状と内部区画は独立しています。内部容量・構造強度は設計断面による近似です。</p></div>`);
 if(st.tab==='arm'){
  panel.insertAdjacentHTML('afterbegin',weaponMountControls());
  const selected=selItem();if(selected&&st.sel.list==='fits'&&C.needsCapacitor(selected)){const q=S?.chargeInfo?.[selected.id],depth=selected.chargeDepth??(6*(selected.scale||1)+4),d=C.fitSpec(selected),c=C.weaponChargeSpec(selected),cap=C.weaponCapacitors(ship).find(p=>p.weaponId===selected.id);panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>この砲の充電装置</h4><p>${fTT(c.boltTT)} × ${c.barrels} 門 × ${c.salvos} 斉射分 = ${fTT(c.volleyTT*c.salvos)}</p><p>必要容積 ${num(c.targetVolume,1)} m³${cap?' · 基準形状 '+cap.boxSize.map(v=>num(v,1)).join(' × ')+' m':''}</p><p>${q?num(q.volume,1):'—'} m³ / 必要 ${q?num(q.required,1):'—'} m³ · ${q?fPct(q.capacityRatio):'—'}</p><div class="sliders">${slider('chargeSalvos','蓄える斉射回数',c.salvos,1,20,1,c.salvos+' 回分')}${slider('chargeDepth','装備面から内側への深さ',depth,1,180,1,fmtM(depth))}${slider('chargeScale','充電区画の容積',(selected.chargeScale??1)*100,25,400,5,Math.round((selected.chargeScale??1)*100)+'%')}</div>${cap?packingInfoHTML(cap):''}<p class="note">周辺区画との干渉は容積を保って自動統合。1門の威力と連装数に比例して容積が変わります。容量密度 0.08 TT/m³。再充電の目安 ${S?.rc?((d.cycle||1)/S.rc).toFixed(2)+' 秒':'給電なし'}。砲塔の寸法を変えると必要容積も変わります。</p></div>`);}
  // v18 Missile launchers: cells below deck (VLS) or a box on the hull.
  if(selected&&st.sel.list==='fits'&&C.FITS[selected.k]?.msl){const mm=C.missileMount(selected),q=S?.vlsInfo?.[selected.id],M=C.MISSILE_MOUNTS;panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>ミサイル発射機の搭載方式</h4>${seg('mslmount',Object.entries(M).map(([k,v])=>[k,v.name]),mm)}<p>${mm==='vls'?`船内のセル・弾庫 ${q?num(q.volume,0):'—'} / ${q?num(q.required,0):'—'} m³（${q?fPct(q.ratio):'—'}）· 搭載弾数 ${Math.round(M.vls.stock*(q?.ratio??1))} 発`:`船内容積を使いません · 搭載弾数 ${M.ext.stock} 発`}</p><p class="note">VLS は発射機の下に船内容積を確保します（その分、乗員の居住に回せる空き容積が減ります）。露出はハッチだけで被弾しにくい反面、弾庫まで撃ち抜かれると誘爆します。外置きは船内容積を使わず、搭載弾数が半分、箱型発射機がむき出しで被弾しやすくなります。</p></div>`);}
  const f=selItem();if(f&&st.sel.list==='fits'&&!C.FITS[f.k].window){const d=C.fitSpec(f);panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>選択中の兵装</h4><label>砲塔を交換<select data-refweapon>${WEAPONS.map(k=>`<option value="${k}" ${f.k===k?'selected':''}>${esc(C.FITS[k].name)}</option>`).join('')}</select></label>${C.FITS[f.k].asset?`${d.casemate?'':`<div class="sliders">${slider('gunYaw','砲塔の向き',f.assetYaw||0,-180,180,1,deg(f.assetYaw||0))}</div>`}<p class="note">兵装の大きさは規格どおりで変えられません${(f.scale||1)!==1?`（この砲塔は作例の規格 ${Math.round((f.scale||1)*100)}%）`:''}。</p>`:''}<p>${fTT(d.tt||d.ion||0)} / 一斉射 · ${fW(d.power)} / 連射時${S?.feedInfo?.[f.id]?`<br>配電路 ${ja(S.feedInfo[f.id][0])} m³（${feedSrc(S.feedInfo[f.id])} ${num(S.feedInfo[f.id][1])} m）`:''}</p></div>`);}
  panel.insertAdjacentHTML('beforeend',weaponSourcesHTML());
 }
}
function referenceStatsHTML(){
 // Current design first; an example's table values sit beside it for comparison.
 if(!S)return '<div class="pgroup blueprint-card"><h4>艦の性能</h4><p class="note">計算中…</p></div>';
 const r=C.SHIP_REFERENCE[ship.reference];
 const rows=[['出力',fW(S.power),r?fW(r.power):null],['ISD比',S.xISD.toFixed(3),r?(r.power/C.ISD_W).toFixed(3):null],['最大加速度',fG(S.accelG),r?.accelG!=null?fG(r.accelG):null],['シールド蓄積量',sci(S.shieldCapacity)+' J',r?sci(r.shieldLoad)+' J':null],['全出力のエネルギー換算',num(S.power/C.TT,1)+' TT/秒',r?num(r.sustainedTT,1)+' TT/秒':null],...(S.heavyAlpha!=null?[['重兵装一斉射（イオン含む）',(S.heavyAlpha/1000).toFixed(3)+' PT',r?.alphaPT!=null?r.alphaPT.toFixed(3)+' PT':null]]:[])];
 return `<div class="pgroup blueprint-card"><h4>艦の性能</h4><table class="station-table"><thead><tr><th>項目</th><th>この設計</th>${r?`<th>${esc(r.name)}</th>`:''}</tr></thead><tbody>${rows.map(a=>`<tr><td>${a[0]}</td><td><b>${a[1]}</b></td>${r?`<td>${a[2]??'—'}</td>`:''}</tr>`).join('')}</tbody></table>${r?referenceAircraftSettingHTML(r):''}${r?.armament?`<p class="note">兵装：${r.armament}。</p>`:''}<details class="trench-editor"><summary>数値の出典</summary><p class="note">1 ISD = ${fW(C.ISD_W)}（標準インペリアル級の主炉・予備炉・補助炉の合計）。${r?`<a href="${C.STATS_SOURCE}#range=B${r.row}:T${r.row}" target="_blank" rel="noopener">指定表 Ships 行${r.row} · ${esc(r.name)}</a>`:`<a href="${C.STATS_SOURCE}" target="_blank" rel="noopener">指定スプレッドシート</a>`}（確認日 2026-10-19）。表のシールド容量は最大出力10秒分のエネルギーです。</p></details></div>`;
}
// Fire per second by range band (best arc), as the battles use it.
function bandRatesHTML(S){
 const B=S.bandRate;if(!B)return '';const best=a=>Math.max(...a),rows=Object.entries(C.GUN_BANDS).map(([k,b])=>[k,b,best(B[k])]),max=Math.max(1e-9,...rows.map(r=>r[2]));
 return `<h4>射程別の毎秒火力（主射界）</h4><div class="sect">${rows.map(([k,b,v])=>`<div class="lim"><span>${b.name} ${b.range/1000} km</span>${bar(v/max,'b-w')}<b>${fTT(v)}/秒</b></div>`).join('')}</div><p class="note">舷側砲（ケースメイト・舷側砲列）は射程が短いが、同じ電力で長射程砲の約${(1/C.COMBAT.bandCost.close).toFixed(1)}倍の砲火を出せる。射程内でも距離が開くほど命中率は下がる。</p>`;
}
// Armour over each face: the hull's own plus any plating, area-weighted.
function skinFacesHTML(S){
 const sk=S.skin;if(!sk)return '';const n=sk.n,A=[0,0,0,0,0,0],T=[0,0,0,0,0,0];for(let i=0;i<n;i++)for(let f=0;f<6;f++){A[f]+=sk.a[i*6+f];T[f]+=sk.t[i*6+f];}
 const th=A.map((a,f)=>a>0?(S.armorHull||0)+T[f]/a:null),max=Math.max(.05,...th.filter(v=>v!=null));
 return `<h4>面ごとの装甲</h4><div class="sect">${C.COMBAT_FACE.map((nm,f)=>th[f]==null?'':`<div class="lim"><span>${nm}</span>${bar(th[f]/max,'b-s')}<b>${th[f].toFixed(2)} m</b></div>`).join('')}</div><p class="note">シールドを抜けた砲火は面と区画ごとの装甲に負荷として溜まり、厚さに応じた限界を超えると貫通して奥のモジュールに当たる。負荷は時間とともに抜ける。</p>`;
}
function weaponSourcesHTML(){return `<details class="trench-editor"><summary>武装の威力と出典</summary><p class="note">TT = テラトンTNT相当のエネルギー。1 TT = 4.184×10²¹ J。1 PT = 1000 TT。1発・1砲身、砲塔の一斉射、毎秒の出力を区別します。指定表とFractalspongeの設計上の数値を採用し、全作品共通の公式値とは扱いません。</p><table class="station-table"><thead><tr><th>砲身</th><th>1発</th><th>根拠</th></tr></thead><tbody>${['refVen','refISD','oct40','htl','refSide','triple40','quad200','stl','utl','ion','pd'].map(k=>{const d=C.FITS[k];return `<tr><td>${esc(d.short)}</td><td>${fTT(d.boltTT)}</td><td>${d.source?`<a href="${d.source}" target="_blank" rel="noopener">${esc(d.evidence)}</a>`:esc(d.evidence)}</td></tr>`;}).join('')}</tbody></table><p class="note">ISDの6連装砲は、従来の砲塔総威力350 TTを6門へ等分したゲーム用換算です。DBY-827は指定名称を採用し、従来の2門×70 TTを維持しています。</p><p class="note">175 TT、ヴェネターの舷側40 TT、アクラメイターの200 GTは指定表を参照。連射間隔（重砲1秒、中型砲0.2秒）、命中率・射程・損傷効果はゲーム用仮定です。給電が不足すると連続火力が低下します。</p><p class="note"><a href="${C.WEAPON_NOTES.design}" target="_blank" rel="noopener">設計ノート</a>：炉の体積、出力と質量、表面積と防御、兵装への給電を参照。</p></details>`;}
function bindReference(){
 $('#panel').addEventListener('input',e=>{const k=e.target.dataset.sl,v=+e.target.value;if(!['engineD','engineL'].includes(k)||e.target.value===''||!Number.isFinite(v))return;changeEngineSize(k==='engineD'?v:null,k==='engineL'?v:null);});
 $('#panel').addEventListener('change',e=>{const t=e.target;
  if(['engineD','engineL'].includes(t.dataset.sl)){if(dragSnap)endDrag();renderPanel();}
  if(['chargeDepth','chargeScale','chargeSalvos'].includes(t.dataset.sl)){if(dragSnap)endDrag();renderPanel();}

  if('refhull'in t.dataset){mutate('参照外板の表示',()=>ship.hullSkin.enabled=t.checked,'all');renderPanel();}
  if('refweapon'in t.dataset){mutate('砲塔を交換',()=>editSel(f=>{f.k=t.value;delete f.skinAsset;delete f.mountOffset;delete f.mountAxis;f.scale=1;f.assetYaw=0;}),'fits');renderPanel();}
 });
 $('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.mslmount&&C.MISSILE_MOUNTS[d.mslmount]){const v=d.mslmount;mutate('ミサイルの搭載方式',()=>editSel(f=>{if(!C.FITS[f.k]?.msl)return;if(v==='vls')delete f.mount;else f.mount=v;}),'fits');renderPanel();return;}
  if('enginebaseline'in d){const p=engineEditTarget(),spec=p?C.equipmentSpec(p):activeEquipment(),b=C.ENGINE_BASELINES[spec?.engineStyle]?.[+d.enginebaseline];if(b){changeEngineSize(b.d,b.length);if(dragSnap)endDrag();renderPanel();}return;}
  if(d.weaponmount){chooseWeaponMount(d.weaponmount);return;}
  if(d.equipment){chooseEquipment(d.equipment);return;}
  if(d.bridgemode){st.bridgeMode=d.bridgemode;st.sel=null;renderPanel();return;}
  if(d.bodyrole){mutate('艦橋の役割を変更',()=>editSel(p=>{if(C.bridgeBodyRole(p))p.commandRole=d.bodyrole;}),'parts');renderPanel();return;}
  if('custombridge'in d){st.tab='mod';st.group='shape';st.part='struct';st.equipmentId=null;st.partTool='place';st.structForm='trap';delete st.skinAsset;renderPanel();return;}
  if('removeskin'in d){mutate('基本形状へ変更',()=>editSel(p=>{delete p.equipmentId;delete p.customEquipment;delete p.skinAsset;delete p.skinSize;if(p.form==='reference')p.form='box';}),'parts');renderPanel();}
 });
 $('#panel').addEventListener('input',e=>{const k=e.target.dataset.sl,v=+e.target.value;if(!Number.isFinite(v)||k!=='gunYaw')return;beginDrag('砲塔の形状');editSel(f=>{f.assetYaw=C.clamp(v,-180,180);});touch('fits');scheduleStats(350);const out=$('#out-'+k);if(out)out.textContent=deg(v);});
 $('#panel').addEventListener('input',e=>{const k=e.target.dataset.sl,v=+e.target.value;if(!Number.isFinite(v)||!['chargeDepth','chargeScale','chargeSalvos'].includes(k))return;beginDrag('主砲充電装置を調整');editSel(f=>f[k]=k==='chargeDepth'?C.clamp(v,1,500):k==='chargeSalvos'?Math.round(C.clamp(v,1,20)):C.clamp(v/100,.25,4));touch('fits');scheduleStats(350);const o=$('#out-'+k);if(o)o.textContent=k==='chargeDepth'?fmtM(v):k==='chargeSalvos'?v+' 回分':v+'%';});
}

function packingInfoHTML(p){
 const group=p._packingGroup,a=p._packing;if(!group)return '';
 return `<div class="pgroup blueprint-card"><h4>容積を保って自動統合</h4><p>${group.ids.length} 区画 · 合計 ${num(group.volume,1)} / ${num(group.requestedVolume,1)} m³</p>${a?`<p>この区画 ${num(a.volume,1)} / ${num(a.requestedVolume,1)} m³ · ${fPct(a.retained)}</p><p>再配置範囲 ${[0,1,2].map(i=>num(a.bounds[i+3]-a.bounds[i],1)).join(' × ')} m</p>`:''}<p class="note">用途ごとの容積は別計上。炉・機関・発着口を避け、近傍の連続した空間に収めます。透視で実際の形状を確認できます。${a?.limited?'近傍の空間が不足しています。基準位置を調整するか、周囲を空けてください。':''}</p></div>`;
}

st.engineSizes={};st.equipmentId=null;st.bridgeMode='body';st.bridgeEquipment='isdBridge';
function activeEquipment(){
 const id=st.tab==='bridge'&&st.bridgeMode==='body'?st.bridgeEquipment:st.tab==='mod'?st.equipmentId:null;
 return Object.hasOwn(C.EQUIPMENT,id)?C.EQUIPMENT[id]:null;
}
function equipmentCard(id){
 const d=C.EQUIPMENT[id],on=activeEquipment()?.id===id;
 const spec=d.k==='engine'?d.engineStyle==='exposed'?'径・全長を変更 / 機関胴を外に露出':'ノズル径を変更 / タービンを船内へ':d.k==='struct'?d.s.map(v=>num(v,1)).join(' × ')+' m · 指揮所を内蔵':'センサー・通信設備';
 return `<button type="button" class="part${on?' on':''}" data-equipment="${id}" aria-pressed="${on}"><i class="sw sh-${C.PARTS[d.k].shape}" style="background:${rgb(C.PARTS[d.k].col)}"></i><span class="pn">${esc(d.name)}</span><span class="pd">${spec}</span></button>`;
}
function pendingEngine(d){const p={...C.equipmentOptions(d.id),...st.engineSizes[d.id]};C.enforceEquipment(p);return p;}
function enginePerformance(p){return `<p>推力（寸法換算） <b>${sci(C.nozzleThrust(p))} N</b><br>消費電力（寸法換算） ${fW(C.nozzleDemand(p))}<br>機関胴 ${fmtM(p.bodyLength)} · ノズル奥行き ${fmtM(p.nozzleLength)}</p>`;}
function equipmentInfo(d,p){
 if(d.k==='engine'){
  p=p||pendingEngine(d);const exposed=d.engineStyle==='exposed';
  return `<div class="pgroup blueprint-card"><h4>${esc(d.name)}</h4><div class="sliders">${slider('engineD','ノズル径',p.d,6,C.DESIGN_LIMITS.engineDiameter,.1,num(p.d,2)+' m')}${exposed?slider('engineL','全長（ノズル＋機関胴）',p.engineLength,p.nozzleLength*1.5,C.DESIGN_LIMITS.engineLength,.1,num(p.engineLength,2)+' m'):''}</div><div id="enginePerformance">${enginePerformance(p)}</div><details><summary>サイズを選ぶ</summary><div class="chips">${C.ENGINE_BASELINES[d.engineStyle].map((b,i)=>`<button class="chip" data-enginebaseline="${i}">径 ${b.d} m${exposed?' / 長さ '+num(b.length,1)+' m':''}</button>`).join('')}</div></details><p class="note">${exposed?'径と長さに応じて推力・消費電力・機関占有が変わります。':'ノズルを船外に、接続したタービンを船内に配置します。ノズル径に応じて機関の寸法・性能も変わります。'}炉までの供給区画は自動確保。給電・干渉・噴射口の閉塞で実効推力が変わります。</p></div>`;
 }
 return `<div class="pgroup blueprint-card"><h4>${esc(d.name)}</h4>${d.k==='struct'?'<p class="note">艦橋本体はそれだけで指揮所として働きます（どちらも前面の円筒ポッドから視界を測ります）。役割は選択後に変更でき、支持塔は構造パーツで組み立てます。配置後に位置・寸法・向きを調整できます。</p>':'<p class="note">通常のセンサー部品として配置します。位置・大きさは配置後にも調整できます。</p>'}</div>`;
}
function engineEditTarget(){const p=selItem();return st.partTool==='select'&&p&&C.parametricEngine(p)?p:null;}
function changeEngineSize(diam,length){
 const p=engineEditTarget(),d=p?C.equipmentSpec(p):activeEquipment();if(!d?.engineStyle)return;
 if(p){beginDrag('エンジンの寸法');editSel(q=>C.resizeEngine(q,diam??q.d,length??q.engineLength));touch('parts');scheduleStats(350);}
 else{const q=pendingEngine(d);C.resizeEngine(q,diam??q.d,length??q.engineLength);st.engineSizes[d.id]={d:q.d,engineLength:q.engineLength};}
 const q=p||pendingEngine(d),out=$('#enginePerformance');if(out)out.innerHTML=enginePerformance(q);
 for(const [k,n] of [['engineD',q.d],['engineL',q.engineLength]]){const o=$('#out-'+k);if(o)o.textContent=num(n,2)+' m';}
}
function chooseEquipment(id){
 const d=C.EQUIPMENT[id];if(!d)return;
 st.sel=null;st.partTool='place';st.template=null;
 if(d.group==='bridge'){st.tab='bridge';st.bridgeMode='body';st.bridgeEquipment=id;}
 else{st.tab='mod';st.group=d.group;st.part=d.k;st.equipmentId=id;st.placeBy[d.k]='partial';}
 renderPanel();
}
function equipmentPreview(hit,d){
 const p={id:-1,...(d.k==='engine'?pendingEngine(d):C.equipmentOptions(d.id))},normal=hit.n||[0,1,0];p.c=hit.p.slice();
 if(d.k==='engine'){p.dir=st.engineDir.slice();p.reactor=st.reactor;}
 if(d.k==='struct'){p.yaw=st.structYaw;p.pitch=st.structPitch||0;p.roll=st.structRoll||0;return C.alignStructure(p,hit,st.surfaceMode);}
 if(hit.kind!=='section'){
  const dot=d.k==='engine'?Math.abs(C.dot(normal,p.dir)):0,ext=d.k==='struct'?(Math.abs(normal[0])*p.s[0]+Math.abs(normal[1])*p.s[2]+Math.abs(normal[2])*p.s[1])/2:d.k==='sensor'?Math.hypot(...normal.map((v,i)=>v*p.skinSize[i]/2)):dot*p.nozzleLength/2+Math.sqrt(Math.max(0,1-dot*dot))*p.d/2;
  const mode=st.placeBy[d.k]||'partial',offset=d.k==='struct'?ext*.6:mode==='inside'?-(ext+1):mode==='outside'?ext*.92:-ext*.4;
  p.c=C.add(hit.p,C.mul(normal,d.engineStyle==='internal'&&C.dot(normal,p.dir)>.8?p.nozzleLength/2-2:offset));
 }
 return p;
}
function coordinateControls(){return `<details class="trench-editor"><summary>座標を指定して配置</summary><p class="note">X：艦尾から前方、Y：船底から上方、Z：中心線から左右。単位 m。</p><div class="coordinate-inputs">${['X','Y','Z'].map((a,i)=>`<label>${a}<input type="number" id="newP${a}" value="${Math.round(st.newPos?.[i]??[ship.hull.L*.5,ship.hull.H*.5,0][i])}" step="1" min="${-C.DESIGN_LIMITS.coordinate}" max="${C.DESIGN_LIMITS.coordinate}"></label>`).join('')}</div><button class="btn" id="btnAtCoordinates">この座標へ配置</button></details>`;}
const BODY_ROLES=[['bridge','航行・艦隊指揮'],['combat','戦闘指揮'],['air','航空指揮'],['hangar','格納庫管制']];
function bodyRoleHTML(p){const role=C.bridgeBodyRole(p);if(!role||st.sel?.list!=='parts')return '';const inf=S?.commandInfo?.[-300000-p.id];return `<div class="pgroup blueprint-card"><h4>艦橋本体の役割</h4>${seg('bodyrole',BODY_ROLES,role)}<label><input type="checkbox" data-bodycommand ${p.commandEnabled!==false?'checked':''}> この本体を指揮所として使う</label><p class="note">モデル由来の艦橋本体は、それ自体が${esc(C.COMMAND_ROLES[role])}の指揮所です。ポッドや窓を足す必要はありません。${inf?` 稼働 ${fPct(inf.ratio)}`:''}</p></div>`;}
function bridgePanel(){
 const body=st.bridgeMode==='body',selected=selItem(),bodies=ship.parts.filter(p=>C.equipmentSpec(p)?.group==='bridge'||C.REFERENCE_ASSETS[p.skinAsset]?.kind==='bridge');
 const head='';
 if(!body)return head+`<div class="pgroup">${seg('bridgetool',[['place','ポッドを設置'],['adjust','調整'],['remove','撤去']],st.bridgeTool)}</div>${st.bridgeTool==='adjust'?fitEditor():''}<div class="fits">${BRIDGES.map(k=>fitBtn(k,st.bridge===k,'bridge')).join('')}</div><p class="note">インペリアル級艦橋の円筒形ポッドです。構造物の側面や前後の壁に取り付けると、その役割の指揮所になります。甲板と船体には置けません。ポッドの背後には指揮区画が確保されます。インペリアル級・ヴェネター級の艦橋本体は、ポッドを足さなくても艦橋として機能します。</p><button class="btn" data-commandroom>無窓式指揮室を配置する</button>`;
 return head+`<div class="pgroup">${seg('parttool',[['place','本体を配置'],['select','選択・調整'],['multi','複数選択'],['remove','撤去']],st.partTool)}</div><div class="parts">${Object.values(C.EQUIPMENT).filter(d=>d.group==='bridge').map(d=>equipmentCard(d.id)).join('')}</div>${st.partTool==='place'?equipmentInfo(C.EQUIPMENT[st.bridgeEquipment])+coordinateControls():(bodyRoleHTML(selected)+(partEditor()||'<p class="note">艦橋本体をタップするか下の一覧から選択してください。</p>'))}<div class="pgroup"><h4>配置済みの艦橋本体</h4><div class="plist">${bodies.map(p=>`<button class="chip${selected?.id===p.id?' on':''}" data-selpart="${p.id}">${esc(C.partLabel(p))}</button>`).join('')||'<p class="note">まだ配置されていません。</p>'}</div></div><button class="btn" data-custombridge>構造パーツから艦橋を組む</button>`;
}

// Placement direction is shared by the preview and the actual mount.
st.weaponMount='auto';
// 「面に合わせる」 stands a weapon on the face's own normal, slopes included.
function weaponTiltMode(k){const d=C.FITS[k];return d?.cat==='w'&&!d.casemate&&st.weaponMount==='auto';}
function weaponPlacementNormal(k,n){return C.FITS[k]?.cat==='w'&&!['auto','trench','casemate'].includes(st.weaponMount)?(st.weaponMount==='bottom'?[0,-1,0]:[0,1,0]):n;}
function weaponMountControls(){return `<div class="pgroup"><h4>武装の取付面</h4>${seg('weaponmount',[['auto','面に合わせる'],['top','上面に配置'],['bottom','下面に配置'],['trench','トレンチ内'],['casemate','側壁ケースメイト']],st.weaponMount)}<p class="note">「面に合わせる」では斜めの面にも面の傾きに沿って傾けて据え付け、射界はその面の外向き半球になります。垂直に立てるときは「上面に配置」「下面に配置」。下面を選ぶと船底へ視点を切り替えます。船体・構造物の下面をタップして搭載。砲塔は下向き、充電装置は取付面の船内側に配置されます。射界は取付面の外向き半球です。「トレンチ内」では溝の床・内壁に局所固定し、外甲板へ移しません。「側壁ケースメイト」は砲口を壁の外向きにして、背面の船内に充電装置を確保します。</p></div>`;}
function chooseWeaponMount(face){
 if(!['auto','top','bottom','trench','casemate'].includes(face))return;
 if(face==='casemate'&&C.FITS.casemateMid)st.fit='casemateMid';
 st.weaponMount=face;st.fitTool='place';st.sel=null;
 if(['top','bottom'].includes(face)){st.view='normal';if(view){const c=CAMS[face];view.cam.ortho=true;view.cam.th=c[0];view.cam.ph=c[1];view.cam.target=[0,0,0];}syncHud();requestDraw();}
 renderPanel();
}

function aviationNumbers(){return C.aviationStatus(ship,S?.info);}
function aviationSize(v){return num(Number.isFinite(v)?v:0,2);}
function aviationCapacityHTML(a){
 const used=a.embarkedSize+(a.vehicleSize||0),unloaded=Math.max(0,a.requestedCount-a.embarkedCount),ships=Math.max(0,a.shipCount-a.shipEmbarked);
 return `<div class="aviation-budget"><span>格納容量（航空機・搭載艦・車両で共用）</span><strong>${aviationSize(a.capacity)} <small>サイズ</small></strong><p>使用 <b>${aviationSize(used)}</b> / ${aviationSize(a.capacity)}${a.vehicleSize>0?`（うち車両 ${aviationSize(a.vehicleSize)}）`:''}</p><meter min="0" max="${Math.max(1,a.capacity)}" value="${Math.min(used,Math.max(1,a.capacity))}" aria-label="格納庫の使用サイズ"></meter><p class="${unloaded||ships?'neg':'ok'}">${unloaded||ships?`未搭載 ${unloaded?num(unloaded)+' 機':''}${unloaded&&ships?'・':''}${ships?num(ships)+' 隻':''}`:`残り ${aviationSize(a.freeSize)} サイズ`}</p></div><dl class="engineering-stats aviation-counts"><div><dt>指定した機数</dt><dd>${num(a.requestedCount)} 機</dd></div><div><dt>実際に搭載</dt><dd>${num(a.embarkedCount)} 機</dd></div><div><dt>発艦できる（うち戦闘用）</dt><dd>${num(a.deployableCount)} 機（${num(a.combatDeployable??a.deployableCount)}）</dd></div>${a.shipCount?`<div><dt>搭載艦</dt><dd>${num(a.shipEmbarked)} / ${num(a.shipCount)} 隻</dd></div>`:''}${a.lift&&(a.lift.troops>0||a.lift.vehicleSize>0)?`<div><dt>1回の降下（輸送機）</dt><dd>兵員 ${num(a.lift.troops)} 名${a.lift.vehicleSize>0?` · 車両 ${aviationSize(a.lift.vehicleSize)} サイズ`:''}</dd></div>`:''}</dl>`;
}
// v20 Sizes and shapes: a craft is its type's official box; it fits a bay with STOW_GAP clear on every side.
const CRAFT_SIDE_NAMES={empire:'銀河帝国',republic:'銀河共和国',cis:'独立星系連合',rebel:'反乱同盟',neutral:'汎用'};
const CRAFT_ROLE_NAMES={fighter:'戦闘機',interceptor:'迎撃機',bomber:'爆撃機',gunship:'ガンシップ',shuttle:'シャトル',lander:'揚陸艇'};
const dimsText=d=>(d||[]).map(v=>num(Math.round(v*10)/10)).join(' × ')+' m';
const exitNeed=d=>{const s=d.slice().sort((a,b)=>a-b);return [s[1]+.5,s[0]+.5];};
function typeOptionsHTML(types,cur,extra){
 const by={};for(const [k,t] of Object.entries(types))(by[t.side]||(by[t.side]=[])).push([k,t]);
 const label=t=>t.role?`${CRAFT_ROLE_NAMES[t.role]||''}${t.carry?'・輸送':''}`:dimsText(t.dims);
 return Object.entries(CRAFT_SIDE_NAMES).filter(([s])=>by[s]).map(([s,n])=>`<optgroup label="${n}">${by[s].map(([k,t])=>`<option value="${k}" ${cur===k?'selected':''}>${esc(t.name)}（${label(t)}${t.approx?'・推定':''}）</option>`).join('')}</optgroup>`).join('')+`<optgroup label="そのほか">${extra.map(([k,n])=>`<option value="${k}" ${cur===k?'selected':''}>${n}</option>`).join('')}</optgroup>`;
}
const rawWing=w=>ship.airWings?.find(x=>x.id===w.id)||w;
const wingMode=r=>r.kind==='ship'?'ship':C.CRAFT_TYPES[r.type]?'type':r.design?.craft?'design':Array.isArray(r.dims)?'custom':'legacy';
// v21 Craft of the player's own design for an air wing: saved designs that are craft, and (with the craft
// examples open) the measured craft examples. Each is computed once when chosen; the row keeps its snapshot.
function designCraftList(){
 const out=[];for(const r of st.craftSaves||[])out.push(r);
 if(CRAFT_OPEN)for(const e of exampleList(true))out.push({ref:e.key,name:e.name||C.SHIP_EXAMPLES[e.key]?.name||e.key,example:true});
 return out;
}
async function loadCraftSaves(){
 if(st.craftSaves||st.craftLoading)return;st.craftLoading=true;const out=[];
 try{const all=await Store.list().catch(()=>[]);for(const rec of all.slice(0,60)){try{const s=C.deserialize(await unpack(rec.data));if(C.isCraft(s))out.push({ref:'save:'+rec.id,name:rec.name||s.name,saved:true});}catch(e){}}}
 finally{st.craftSaves=out;st.craftLoading=false;}
 if(fleet.mode==='design'&&st.tab==='launch')renderPanel();
}
function designCraftOptionsHTML(r){
 if(!st.craftSaves)loadCraftSaves();const list=designCraftList(),cur=r.design?.ref;
 if(!list.length&&!r.design)return '';
 const has=list.some(c=>c.ref===cur);
 return `<optgroup label="設計した機体">${r.design&&!has?`<option value="dsn:${esc(cur||'')}" selected>${esc(r.design.name)}（保存時の性能）</option>`:''}${list.map(c=>`<option value="dsn:${esc(c.ref)}" ${c.ref===cur?'selected':''}>${esc(c.name)}${c.example?'（作例）':''}</option>`).join('')}</optgroup>`;
}
// The chosen craft's design is built and measured (stats, then its figures as a complement).
async function pickDesignCraft(id,ref){
 try{let s=null;
  if(ref.startsWith('save:')){const rec=(await Store.list()).find(x=>'save:'+x.id===ref);if(rec)s=C.deserialize(await unpack(rec.data));}
  else if(C.SHIP_EXAMPLES[ref])s=C.buildDesign(ref);
  if(!s||!C.isCraft(s)){toast('機体の設計を読み込めません');return;}
  C.syncCompartments(s);const S2=C.computeStats(s),cc=C.craftCombat(s,S2);if(!cc){toast('機体の性能を計算できません');return;}
  const row=ship.airWings?.find(w=>w.id===id);if(!row)return;
  const next={...row,type:null,dims:cc.dims,design:{ref,name:cc.name,craft:cc}};delete next.size;if(!row.name||/^航空隊 \d+$/.test(row.name)||row.name===C.CRAFT_TYPES[row.type]?.name||row.name===row.design?.name)next.name=cc.name;
  mutate('航空隊の機種を変更',()=>{ship.airWings=C.normalizeAirWings(ship.airWings.map(w=>w.id===id?next:w));},'none');renderPanel();
  toast(`${esc(cc.name)}：速度 ${cc.speed} · 空戦 ${cc.aa} · 対艦 ${cc.strike} · 耐久 ${cc.armor}`);
 }catch(e){toast('機体の設計を読み込めません');}
}
function designCraftFigures(c){return c?`速度 ${num(c.speed)} m/s · 空戦 ${c.aa} · 対艦 ${num(c.strike)} · 耐久 ${c.armor}${c.crew?` · 乗員 ${c.crew} 名`:''}`:'';}
const bayName=id=>{const p=ship.parts.find(p=>p.id===id);return p?C.partLabel(p):'#'+id;};
function placedHTML(w){return w.placed?.length?`<p class="note">格納先：${w.placed.slice(0,4).map(([id,k])=>`${esc(bayName(id))} ${num(k)}`).join('・')}${w.placed.length>4?' ほか':''}</p>`:'';}
function aviationWingStatusHTML(w){
 if(!w)return '';
 if(w.kind==='ship'){let h=`<p>外形 ${dimsText(w.dims)} · サイズ ${aviationSize(w.size)} · 搭載 ${num(w.embarked)} / 指定 ${num(w.count)} 隻</p>`;if(w.count>0&&w.tooLarge)h+=`<p class="note neg">この艦が入る格納区画がありません。全長・全幅・全高とも ${C.SHIP_STOW_CLEAR} m の余裕が要ります。</p>`;else if(w.unembarked>0)h+=`<p class="note neg">格納庫の空きか配置が足りず ${num(w.unembarked)} 隻が未搭載。</p>`;if(w.undeployable>0)h+=`<p class="note neg">${num(w.undeployable)} 隻は、通れる大きさのハッチ（開口 ${dimsText(exitNeed(w.dims))} 以上）につながる区画に入らないため発進できません。</p>`;return h+placedHTML(w);}
 const t=C.CRAFT_TYPES[w.type],L=t?.carry?C.craftLift(w.type):null;
 let h=`<p>外形 ${dimsText(w.dims)}${t?.approx?'（推定）':''} · 1機 サイズ ${aviationSize(w.size)} · 搭載 ${num(w.embarked)} / ${num(w.count)} 機${w.deployable<w.embarked?` · 発艦可能 ${num(w.deployable)} 機`:''}</p>`;
 if(L)h+=`<p class="note">輸送機：1機で兵員 ${num(L.troops)} 名${L.size>0?`、車両 ${aviationSize(L.size)} サイズ（${dimsText(L.box.slice().reverse())} まで）`:''}を降ろします。</p>`;
 if(w.count>0&&w.tooLarge)h+=`<p class="note neg">この機体が入る格納区画がありません。全長・全幅・全高とも ${C.STOW_GAP} m の余裕をもって入る内寸の区画が要ります（機首はどちらの水平方向にも向けられます）。</p>`;
 else if(w.unembarked>0)h+=`<p class="note neg">格納庫の空きか配置が足りず ${num(w.unembarked)} 機が未搭載。上の航空隊から順に収容します。</p>`;
 if(w.undeployable>0)h+=`<p class="note neg">${num(w.undeployable)} 機は、${w.blocked?`通れる大きさのハッチ（開口 ${dimsText(exitNeed(w.dims))} 以上）につながる区画に入らない`:'ハッチにつながる区画の空きが足りない'}ため発艦できません。</p>`;
 return h+placedHTML(w);
}
function wingSummary(w){
 const r=rawWing(w),m=wingMode(r),n=` · ${num(w.count)} ${m==='ship'?'隻':'機'}`;
 if(m==='ship')return `艦艇 ${dimsText(w.dims)} · サイズ ${aviationSize(w.size)}${n}`;
 if(m==='type')return C.CRAFT_TYPES[r.type].name+n;
 if(m==='design')return `設計機 ${r.design.name}${n}`;
 if(m==='custom')return `寸法指定 ${dimsText(r.dims)}${n}`;
 return `サイズ ${aviationSize(w.size)}${n}`;
}
function wingButtonsHTML(id,w,i){return `<div class="chips"><button type="button" class="btn sm" data-fillairwing="${id}">空き容量まで搭載</button><button type="button" class="btn sm ghost" data-moveairwing="${id}" data-direction="-1" ${i===0?'disabled':''} aria-label="${esc(w.name)}の収容優先順を上げる">上へ</button><button type="button" class="btn sm ghost" data-moveairwing="${id}" data-direction="1" ${i>=(ship.airWings?.length||0)-1?'disabled':''} aria-label="${esc(w.name)}の収容優先順を下げる">下へ</button><button type="button" class="btn sm ghost" data-delairwing="${id}">削除</button></div>`;}
function dimsInputsHTML(attr,id,d,label){return `<div class="airwing-fields dims3">${['全長','全幅','全高'].map((n,k)=>`<label>${n}（m）<input type="number" ${attr}="${id}" ${attr==='data-airwing'?'data-wingfield':'data-groundfield'}="d${k}" value="${Math.round((d?.[k]||0)*100)/100}" min=".1" max="4000" step=".1" inputmode="decimal" aria-label="${label}の${n}"></label>`).join('')}</div>`;}
function aviationWingHTML(w,i){
 const limits=C.AIR_WING_LIMITS,id=esc(w.id),expanded=st.aviationExpanded?.has(w.id)??i===0,r=rawWing(w),m=wingMode(r);
 const head=`<details class="airwing-row${m==='ship'?' ship-row':''}" data-airwing-card="${id}" ${expanded?'open':''}><summary><b data-airwing-title="${id}">${esc(w.name)}</b><span data-airwing-summary="${id}">${esc(wingSummary(w))}</span></summary>`;
 const status=`<div data-airwing-status="${id}" class="airwing-status" aria-live="polite">${aviationWingStatusHTML(w)}</div>`;
 if(m==='ship')return `${head}<label class="field-label">表示名<input type="text" data-airwing="${id}" data-wingfield="name" value="${esc(w.name)}" maxlength="${limits.nameLength}" aria-label="搭載艦 ${i+1} の名前"></label><div class="airwing-fields"><label>1隻のサイズ<input type="number" value="${w.size}" disabled aria-label="搭載艦 ${i+1} のサイズ（外形から計算）"></label><label>搭載する隻数<input type="number" data-airwing="${id}" data-wingfield="count" value="${w.count}" min="0" max="${limits.maxCount}" step="1" inputmode="numeric" aria-label="搭載艦 ${i+1} の隻数"></label></div>${status}${wingButtonsHTML(id,w,i)}</details>`;
 return `${head}<label class="field-label">航空隊名<input type="text" data-airwing="${id}" data-wingfield="name" value="${esc(w.name)}" maxlength="${limits.nameLength}" aria-label="航空隊 ${i+1} の名前"></label>
 <label class="field-label">機種<select data-airwing="${id}" data-wingfield="type" aria-label="航空隊 ${i+1} の機種">${typeOptionsHTML(C.CRAFT_TYPES,m==='type'?r.type:m==='design'?'':m,[['custom','寸法を指定する'],['legacy','サイズで指定する（旧形式）']])}${designCraftOptionsHTML(r)}</select></label>${m==='custom'?dimsInputsHTML('data-airwing',id,r.dims,'航空隊 '+(i+1)):''}${m==='design'?`<p class="note">設計機：${esc(designCraftFigures(r.design.craft))}（${esc(r.design.craft.roleName||C.CRAFT_ROLE_RTS[r.design.craft.role]||'')}）。航行では空母からこの性能で出撃します。</p>`:''}
 <div class="airwing-fields">${m==='legacy'?`<label>1機のサイズ<input type="number" data-airwing="${id}" data-wingfield="size" value="${w.size}" min="${limits.minSize}" max="${limits.maxSize}" step=".01" inputmode="decimal" aria-label="航空隊 ${i+1} の機体サイズ"></label>`:''}<label>搭載する機数<input type="number" data-airwing="${id}" data-wingfield="count" value="${w.count}" min="0" max="${limits.maxCount}" step="1" inputmode="numeric" aria-label="航空隊 ${i+1} の機数"></label></div>${status}${wingButtonsHTML(id,w,i)}</details>`;
}
function aviationSurfacesHTML(p){
 const names={none:'ハッチ化しない',open:'開放型',ray:'シールド'},contacts=C.aviationSurfaceContacts(ship,p),kept=p._packing?.retained??p._clip?.retained??1;
 // A bay left entirely in a cut-away space has no volume to open from.
 const outside=!contacts.some(q=>q.contact)&&kept<.05?'<p class="note neg keep">この区画はほぼ全体が船体の外（切り取った空間など）にあり、使える容積がありません。区画の一部が切り取った面の奥（船体の内側）に入るよう、位置か寸法を調整してください。</p>':'';
 return `<div class="aviation-surfaces"><h4>表面に接触した面の開口</h4><p class="note">航空区画を船体・外装の表面まで広げ、接触した面の方式を選びます。切り取った凹みの天井や壁に接した面も開口できます。開口は区画の位置と大きさに追従します。</p>${outside}${contacts.map(q=>`<div class="aviation-surface ${q.contact?'':'inactive'}"><label>${esc(q.label)}<select data-aviation-surface="${q.face}" data-aviation-bay="${p.id}" ${q.contact?'':'disabled'} aria-label="${esc(C.partLabel(p))} ${esc(q.label)}の開口方式"><option value="none" ${q.kind==='none'?'selected':''}>ハッチ化しない</option><option value="open" ${q.kind==='open'?'selected':''}>開放型</option><option value="ray" ${q.kind==='ray'?'selected':''}>シールド</option></select></label>${q.contact&&q.kind!=='none'?`<label class="note"><input type="checkbox" data-aviation-door="${q.face}" data-aviation-bay="${p.id}" ${ship.hatches.some(h=>h.bay===p.id&&h.face===q.face&&C.isSlidingHatch(ship,h))?'checked':''}> 装甲スライド扉を併設</label>`:''}<p class="note">${q.contact?'接触面積 '+num(q.area,1)+' m²':q.kind!=='none'?'未接触 · '+names[q.kind]+'の設定を保持。表面に再び接触すると開口が戻ります。':'船体・外装の表面に接触していません。区画の位置・寸法を調整すると選択できます。'}</p></div>`).join('')}</div>`;
}
function aviationPartHTML(p){
 if(!p||p.k!=='hangar')return '';
 return `<div class="pgroup blueprint-card aviation-part"><h4>航空区画の用途と容量</h4><label class="field-label">用途<select data-airrole>${Object.entries(C.AVIATION_ROLES).map(([k,n])=>`<option value="${k}" ${(p.airRole||'mixed')===k?'selected':''}>${n}</option>`).join('')}</select></label><p>この区画の容量 <b data-aviation-capacity="${p.id}">${aviationSize(C.hangarCapacity(p))} サイズ</b></p><p class="note">外殻内で使える実容積から計算します。格納・兼用区画を大きくすると容量が増え、飛行・移送甲板とドッキング区画は格納容量に含みません。機体・車両が入るかは区画の内寸（全長・全幅・高さ）で、発艦できるかは出入口の開口で決まります。</p>${st.tab!=='launch'?'<button type="button" class="btn" data-editaviation>航空隊の機種・機数を編集</button>':''}${aviationSurfacesHTML(p)}</div>`;
}
function aviationDoorHTML(h){
 const p=ship.parts.find(p=>p.id===h.bay);if(!p)return '';const active=!!C.openingBounds(ship,h),face=C.aviationSurfaceContacts(ship,p).find(q=>q.face===h.face)?.label||h.face;
 return `<div class="bay-control"><b>${esc(C.partLabel(p))} · ${esc(face)}</b><label>スライド扉の開き <input type="range" data-door="${h.id}" min="0" max="100" value="${Math.round((h.open??0)*100)}" ${active?'':'disabled'} aria-label="${esc(C.partLabel(p))} ${esc(face)}の扉の開き"><output>${Math.round((h.open??0)*100)}%</output></label>${active?'':'<p class="note">表面に接触していないため、開口は無効です。</p>'}</div>`;
}
// v19 Carried ships: example ships and saved designs whose hull fits one of this ship's bays.
function carryCandidates(){
 const out=[];for(const d of Object.values(YardFleetData?.designs||{}))if(d.p?.len)out.push({ref:d.key,name:d.name,dims:[d.p.len,d.p.width||0,d.p.height||0]});
 for(const r of st.carrySaves||[])out.push(r);
 const bays=ship.parts.filter(p=>p.k==='hangar'&&!['flight','dock'].includes(p.airRole));
 return out.filter(c=>c.ref!==ship.reference).map(c=>({...c,size:C.shipStowSize(c.dims),fits:bays.some(p=>C.shipFitsBay(p,c.dims))})).sort((a,b)=>b.fits-a.fits||a.size-b.size);
}
// Saved designs need their outer dimensions once: hull and structures, from the save.
async function loadCarrySaves(){
 if(st.carrySaves||st.carryLoading)return;st.carryLoading=true;const out=[];
 try{const all=await Store.list().catch(()=>[]);
  for(const rec of all.slice(0,40)){try{const s=C.deserialize(await unpack(rec.data)),T=C.hullGeo(s).tris,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<T.length;i+=3)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],T[i+a]);hi[a]=Math.max(hi[a],T[i+a]);}
   for(const p of s.parts){const b=C.partAABB(p);for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],b[a]);hi[a]=Math.max(hi[a],b[a+3]);}}
   const dims=[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]];if(dims.every(v=>Number.isFinite(v)&&v>0))out.push({ref:'save:'+rec.id,name:rec.name||s.name,dims,saved:true});}catch(e){}}
 }finally{st.carrySaves=out;st.carryLoading=false;}
 if(fleet.mode==='design'&&st.tab==='launch')renderPanel();
}
function carryPickHTML(a){
 if(!st.carrySaves)loadCarrySaves();
 const cs=carryCandidates(),ok=cs.filter(c=>c.fits),free=Math.max(0,a.capacity-a.usedSize);
 return `<div class="pgroup carry-pick"><h4>艦艇を搭載</h4><p class="note">小型の艦も、艦載機と同じ「サイズ」に換算して格納庫に積めます（外形の全長×全幅×全高に ${C.SHIP_STOW_CLEAR} m ずつ足した容積 × ${C.SHIP_STOW_FACTOR} ÷ 艦載機1機分の格納容積）。格納・兼用区画のどれか一つに丸ごと入る艦だけを選べます。保存した設計も選べます。</p>${ok.length?`<div class="chips"><select data-shipcarry aria-label="搭載する艦">${ok.map(c=>`<option value="${esc(c.ref)}" ${c.size>free+1e-6?'disabled':''}>${esc(c.name)}${c.saved?'（保存）':''} · ${c.dims.map(v=>num(Math.round(v))).join('×')} m · サイズ ${aviationSize(c.size)}</option>`).join('')}</select><button type="button" class="btn sm" data-addshipwing>艦を搭載</button></div>`:`<p class="note">${ship.parts.some(p=>p.k==='hangar')?'格納区画に入る艦がありません。格納区画を大きくすると、小型艦を積めるようになります。':'航空区画（格納・兼用）を配置すると、小型艦を積めます。'}</p>`}${cs.length>ok.length?`<p class="note">入らない艦：${esc(cs.filter(c=>!c.fits).slice(0,6).map(c=>c.name).join('・'))}${cs.length-ok.length>6?' ほか':''}</p>`:''}</div>`;
}
function bayText(p,a){const b=a.bays.find(x=>x.id===p.id),info=S?.info?.[p.id],doors=info?.doors||[];return `${C.AVIATION_ROLES[p.airRole||'mixed']||''} · 内寸 ${dimsText(C.roomShape(p).s)} · ${b?`容量 ${aviationSize(b.capacity)}・空き ${aviationSize(Math.max(0,b.sizeLeft))} サイズ`:'格納容量なし'} · ${info?.acc?`出入口 ${doors.length?doors.map(o=>dimsText(o)).join('・'):'—'}`:'ハッチにつながっていません'}`;}
function aviationPanelHTML(){
 const a=aviationNumbers(),wings=a.wings,bays=ship.parts.filter(p=>p.k==='hangar'),selected=st.sel?.list==='parts'?selItem():null,slides=ship.hatches.filter(h=>h.bay&&C.isSlidingHatch(ship,h));
 return `<div class="pgroup blueprint-card aviation-editor"><h4>航空隊編集</h4><p class="note">航空隊ごとに機種と機数を選びます。機体は公式の寸法（全長・全幅・全高）で、格納区画の内寸に ${C.STOW_GAP} m の余裕をもって入るか、出入口のハッチを通れるかで搭載・発艦が決まります。格納容量は航空機・搭載艦・地上部隊の車両で共用です。残り <b>${aviationSize(a.freeSize)} サイズ</b>。</p><div id="aviationSummary" aria-live="polite">${aviationCapacityHTML(a)}</div></div><div class="pgroup"><h4>搭載する航空隊</h4><p class="note">上の航空隊から順に、内寸の合う小さい区画から収容します。シャトル・揚陸艇は地上部隊を降ろす輸送機です（「地上部隊」タブで降下量を確認できます）。</p><div class="aviation-wings">${wings.map(aviationWingHTML).join('')||'<p class="note">航空隊がありません。追加して機種と機数を指定してください。</p>'}</div><button type="button" class="btn primary" data-addairwing ${wings.length>=C.AIR_WING_LIMITS.rows?'disabled':''}>航空隊を追加</button></div>${carryPickHTML(a)}${selected?.k==='hangar'?`<div class="pgroup"><h4>選択中 · ${esc(C.partLabel(selected))}</h4>${aviationPartHTML(selected)}</div>`:''}<details class="trench-editor aviation-bays" open><summary>航空区画と出入口 · ${num(bays.length)} 区画</summary><p class="note">内寸は区画の外形（全長 × 全幅 × 高さ）、出入口はハッチの開口（長辺 × 短辺）です。機体は小さい方の2辺が開口を通れば発艦できます。区画を選んで、位置・寸法・用途・接触面の開口を編集できます。</p><ul class="ilist">${bays.map(p=>`<li><button type="button" class="btn sm ghost" data-layout-part="${p.id}">${esc(C.partLabel(p))}</button><span data-aviation-capacity="${p.id}">${esc(bayText(p,a))}</span></li>`).join('')||'<li><span>「区画」から航空区画を配置してください。</span></li>'}</ul></details>${slides.length?`<details class="trench-editor"><summary>スライド扉の開閉を確認</summary><p class="note">上甲板・腹部の扉は左右へ、舷側の扉は上下へ移動します。観閲式と戦闘開始時は閉じ、発艦指示で4秒かけて開き、発艦完了・中止後に閉じます。</p>${slides.map(aviationDoorHTML).join('')}</details>`:''}`;
}
// ---------- ground forces ----------
function groundNumbers(){return S?.ground||C.groundStatus(ship,S);}
const groundNum=v=>num(Math.round(v*10)/10);
function groundBudgetHTML(used,cap,label,unit){return `<div class="aviation-budget"><span>${label}</span><strong>${groundNum(cap)} <small>${unit}</small></strong><p>編成 <b>${groundNum(used)}</b> / ${groundNum(cap)} ${unit}</p><meter min="0" max="${Math.max(1,cap)}" value="${Math.min(used,Math.max(1,cap))}" aria-label="${label}の使用量"></meter><p class="${used>cap+1e-6?'neg':'ok'}">${used>cap+1e-6?'容量超過 '+groundNum(used-cap):'残り '+groundNum(Math.max(0,cap-used))} ${unit}</p></div>`;}
const groundUnit=k=>C.GROUND_KINDS[k]?.unit||'名';
const rawGround=r=>ship.groundForces?.find(x=>x.id===r.id)||r;
const groundSummary=r=>r.kind==='vehicle'?`${C.VEHICLE_TYPES[rawGround(r).type]?.name||'寸法指定 '+dimsText(r.dims||C.groundDims(r))} · ${num(r.count)} 両`:num(r.count)+' '+groundUnit(r.kind);
function groundStatusHTML(r){
 const unit=groundUnit(r.kind);
 if(r.kind!=='vehicle')return `${r.unembarked>0?`<span class="neg">容量不足で ${num(r.unembarked)} ${unit}が未搭載。</span>`:''}搭載 ${num(r.embarked)} / ${num(r.count)} ${unit}`;
 const t=C.VEHICLE_TYPES[rawGround(r).type];
 return `外形 ${dimsText(r.dims)}${t?.approx?'（推定）':''} · 1両 ${aviationSize(r.size)} サイズ · 搭載 ${num(r.embarked)} / ${num(r.count)} 両${r.embarked?`（輸送機に積載 ${num(r.loaded||0)}・格納庫 ${num(r.stowed||0)}）`:''}${t?.troops?` · 1両に兵員 ${num(t.troops)} 名`:''}${r.unembarked>0?`<br><span class="neg">${r.tooLarge?'寸法の合う格納区画も輸送機もなく':'格納庫の空きか配置が足りず'} ${num(r.unembarked)} 両が未搭載。</span>`:''}${r.embarked>0&&!r.landable?(S?.canLand?'<br>この車両は艦が着陸して降ろします。':`<br><span class="neg">この車両を積める輸送機がありません（降ろせません）。</span>`):''}`;
}
function groundRowHTML(r,i,n){
 const id=esc(r.id),L=C.GROUND_LIMITS,open=st.groundOpen?st.groundOpen.has(r.id):i<3,countLabel={troops:'人数',droids:'体数',vehicle:'両数'}[r.kind],raw=rawGround(r),typed=r.kind==='vehicle'&&!!C.VEHICLE_TYPES[raw.type];
 return `<details class="airwing-row" data-ground-card="${id}" ${open?'open':''}><summary><b>${esc(r.name)}</b><span data-ground-summary="${id}">${esc(groundSummary(r))}${r.unembarked>0?` · ${num(r.unembarked)} 未搭載`:''}</span></summary>
 <label class="field-label">部隊名<input type="text" data-ground="${id}" data-groundfield="name" value="${esc(r.name)}" maxlength="${L.nameLength}" aria-label="部隊 ${i+1} の名前"></label>
 <div class="airwing-fields"><label>種別<select data-ground="${id}" data-groundfield="kind" aria-label="部隊 ${i+1} の種別">${Object.entries(C.GROUND_KINDS).map(([k,d])=>`<option value="${k}" ${r.kind===k?'selected':''}>${d.name}</option>`).join('')}</select></label><label>${countLabel}<input type="number" data-ground="${id}" data-groundfield="count" value="${r.count}" min="0" max="${L.maxCount}" step="1" inputmode="numeric" aria-label="部隊 ${i+1} の${countLabel}"></label></div>
 ${r.kind==='vehicle'?`<label class="field-label">車種<select data-ground="${id}" data-groundfield="type" aria-label="部隊 ${i+1} の車種">${typeOptionsHTML(C.VEHICLE_TYPES,typed?raw.type:'custom',[['custom','寸法を指定する']])}</select></label>${typed?'':dimsInputsHTML('data-ground',id,r.dims||C.groundDims(raw),'部隊 '+(i+1))}`:''}
 <p class="note" data-ground-status="${id}">${groundStatusHTML(r)}</p>
 <div class="chips"><button type="button" class="btn sm" data-fillground="${id}">空きまで搭載</button><button type="button" class="btn sm ghost" data-moveground="${id}" data-direction="-1" ${i===0?'disabled':''}>上へ</button><button type="button" class="btn sm ghost" data-moveground="${id}" data-direction="1" ${i===n-1?'disabled':''}>下へ</button><button type="button" class="btn sm danger" data-delground="${id}">削除</button></div></details>`;
}
// The troop space is shared: soldiers take a person's volume, stored droids DROID_STORE_M3.
// Vehicles ride in the transports' holds first and in the hangars (shared with the aircraft) after.
function groundBudgetsHTML(g){const K=Math.max(1,g.personVolume||1),A=S?.aviation,veh=g.rows.filter(r=>r.kind==='vehicle'),used=veh.reduce((n,r)=>n+r.size*r.count,0),room=(A?.vehicleSize||0)+(A?.freeSize||0)+(g.lift?.vehicleSize||0);return groundBudgetHTML(Math.ceil(g.space.used/K-1e-9),g.troops.capacity,'兵員枠','名分')+groundBudgetHTML(used,room,'車両（輸送機の積載区画・格納庫の空き）','サイズ');}
function groundLiftHTML(g){
 const L=g.lift||{},t=L.transports||[];
 return `<div class="pgroup lift-card"><h4>降下（輸送機の1回の出撃）</h4>${t.length?`<p class="note">${t.map(x=>`${esc(x.name)} ${num(x.n)} 機`).join('・')}</p><dl class="engineering-stats"><div><dt>兵員</dt><dd>${num(L.troops)} 名${L.troopsInVehicles?`（うち車両に乗る ${num(L.troopsInVehicles)} 名）`:''}</dd></div><div><dt>車両の積載</dt><dd>${aviationSize(L.loadedSize)} / ${aviationSize(L.vehicleSize)} サイズ</dd></div>${L.boxes?.length?`<div><dt>積める車両の大きさ</dt><dd>${L.boxes.map(b=>dimsText(b.slice().reverse())).join('・')} まで</dd></div>`:''}</dl>`:(S?.canLand?'<p class="note">輸送機はありませんが、この艦は着陸して地上部隊を降ろせます。</p>':'<p class="note">輸送機（シャトル・揚陸艇・降下バージ）がありません。地上部隊は輸送機に載せて降ろします。「航空」タブで輸送機を搭載してください。</p>')}${S?.canLand?`<p class="note">この艦はリパルサーリフト（支持 ${fMass(S.repulsorSupport)}）が艦の質量（${fMass(S.mass)}）を支えるので、着陸して地上部隊と車両をそのまま降ろせます。</p>`:''}<p class="note">車両は、まず内寸の合う輸送機の積載区画に、入らない分は格納庫に載ります。格納庫の車両と、1回で降ろしきれない兵員は2回目以降の便で降ろします。</p></div>`;
}
function groundPanelHTML(){
 const g=groundNumbers(),K=Math.round(g.personVolume||0),vp=C.GROUND_PRESETS.findIndex(p=>p.kind==='vehicle');
 return `<div class="pgroup blueprint-card ground-editor"><h4>地上部隊編成</h4><p class="note">歩兵は、船内の空き容積に乗れる人数から定員（必要乗員）を除いた「兵員枠」に乗ります（1名あたり ${ja(K)} m³）。停止保管ドロイドは同じ枠を 1 体 ${C.DROID_STORE_M3} m³ で使います（兵員 1 名分に ${num(Math.floor(K/C.DROID_STORE_M3))} 体）。車両は公式の寸法で、輸送機の積載区画か格納庫（航空機と共用）に寸法で入ります。容量が足りないときは上の部隊から順に収容します。</p><div class="ground-budgets" id="groundSummary">${groundBudgetsHTML(g)}</div><p class="note">兵員枠 ${num(g.troops.capacity)} 名（停止保管ドロイドだけなら ${num(g.droids.capacity)} 体）。</p><div class="chips"><button type="button" class="btn sm" data-habitation-menu>空き容積と乗員を確認</button><button type="button" class="btn sm" data-groundroom="hangar">格納区画を配置</button></div></div>
 <div id="groundLift">${groundLiftHTML(g)}</div>
 <div class="pgroup"><h4>搭載する部隊</h4>${g.rows.map((r,i)=>groundRowHTML(r,i,g.rows.length)).join('')||'<p class="note">まだ部隊がありません。下のボタンから追加します。</p>'}<h4>部隊を追加</h4><div class="chips ground-add">${C.GROUND_PRESETS.map((p,i)=>p.kind==='vehicle'?'':`<button type="button" class="btn sm" data-addground="${i}">＋ ${esc(p.name)}</button>`).join('')}</div>${vp>=0?`<div class="airwing-fields ground-add-vehicle"><label>車種<select data-addvehicletype aria-label="追加する車両の車種">${typeOptionsHTML(C.VEHICLE_TYPES,st.addVehicleType||'atat',[])}</select></label><button type="button" class="btn sm" data-addground="${vp}">＋ 車両を追加</button></div>`:''}<p class="note">車両の寸法は公式の数値です（「推定」は資料に寸法がない車種）。「寸法を指定する」で自作の車両も載せられます。</p></div>`;
}
function updateGroundUI(){
 if(!ship||fleet.mode!=='design'||st.tab!=='ground')return;
 const g=groundNumbers(),sum=$('#groundSummary');if(sum)sum.innerHTML=groundBudgetsHTML(g);const lift=$('#groundLift');if(lift)lift.innerHTML=groundLiftHTML(g);
 for(const r of g.rows){const a=document.querySelector(`[data-ground-status="${r.id}"]`),b=document.querySelector(`[data-ground-summary="${r.id}"]`);if(a)a.innerHTML=groundStatusHTML(r);if(b)b.textContent=`${groundSummary(r)}${r.unembarked>0?` · ${num(r.unembarked)} 未搭載`:''}`;}
}
function editGroundInput(t,finish=false){
 const id=t.dataset.ground,k=t.dataset.groundfield,row=ship.groundForces?.find(r=>r.id===id);if(!row||!['name','kind','type','count','d0','d1','d2'].includes(k))return;
 let next;
 if(k==='type'){const old=C.VEHICLE_TYPES[row.type];if(t.value==='custom')next={...row,type:null,dims:C.groundDims(row)};else if(C.VEHICLE_TYPES[t.value]){next={...row,type:t.value};delete next.dims;if(!row.name||row.name===old?.name||/^車両隊 \d+$/.test(row.name))next.name=C.VEHICLE_TYPES[t.value].name;}else return;}
 else if(k[0]==='d'){const v=Number(t.value);if(t.value===''||!Number.isFinite(v)||v<=0){if(finish){if(dragSnap)endDrag();renderPanel();}return;}const d=(Array.isArray(row.dims)?row.dims:C.groundDims(row)).slice();d[+k[1]]=v;next={...row,type:null,dims:d};}
 else{const value=k==='name'||k==='kind'?t.value:Number(t.value);if(!['name','kind'].includes(k)&&(t.value===''||!Number.isFinite(value))){if(finish){if(dragSnap)endDrag();t.value=String(row[k]);}return;}next={...row,[k]:value};if(k==='kind'&&value==='vehicle'&&row.kind!=='vehicle'){next.type=st.addVehicleType||'atat';}}
 const rows=C.normalizeGroundForces(ship.groundForces.map(r=>r.id===id?next:r));
 if(JSON.stringify(rows)!==JSON.stringify(ship.groundForces)){beginDrag('地上部隊を編集');ship.groundForces=rows;touch('none');scheduleStats(180);}
 if(finish){if(dragSnap)endDrag();if(['kind','type'].includes(k)||k[0]==='d')renderPanel();}
}
// The most of one row the hangars and holds take, the rows above it loaded first.
function maxEmbark(list,id){
 const save=ship[list];if(!save?.some(r=>r.id===id))return 0;
 try{ship[list]=save.map(r=>r.id===id?{...r,count:list==='airWings'?C.AIR_WING_LIMITS.maxCount:C.GROUND_LIMITS.maxCount}:r);const a=C.aviationStatus(ship,S?.info),w=(list==='airWings'?a.wings:a.vehicles).find(r=>r.id===id);return w?w.embarked:0;}
 finally{ship[list]=save;}
}
function bindGround(){
 const panel=$('#panel');
 panel.addEventListener('toggle',e=>{const id=e.target.dataset?.groundCard;if(!id)return;st.groundOpen||=new Set((ship.groundForces||[]).slice(0,3).map(r=>r.id));if(e.target.open)st.groundOpen.add(id);else st.groundOpen.delete(id);},true);
 panel.addEventListener('input',e=>{if(e.target.dataset.ground&&e.target.tagName!=='SELECT')editGroundInput(e.target);});
 panel.addEventListener('change',e=>{if(e.target.dataset.ground)editGroundInput(e.target,true);else if('addvehicletype' in e.target.dataset)st.addVehicleType=e.target.value;});
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!ship)return;const d=b.dataset,rows=ship.groundForces||[];
  if(d.addground!=null){const p=C.GROUND_PRESETS[+d.addground];if(!p||rows.length>=C.GROUND_LIMITS.rows)return;if(dragSnap)endDrag();const ids=new Set(rows.map(r=>r.id));let n=1;while(ids.has('ground-'+n))n++;const id='ground-'+n,type=p.kind==='vehicle'?(C.VEHICLE_TYPES[$('#panel [data-addvehicletype]')?.value]?$('#panel [data-addvehicletype]').value:p.type):null;if(type)st.addVehicleType=type;mutate('地上部隊を追加',()=>ship.groundForces=C.normalizeGroundForces([...rows,type?{id,name:C.VEHICLE_TYPES[type].name,kind:'vehicle',type,count:0}:{id,name:p.name,kind:p.kind,size:p.size,count:0}]),'none');st.groundOpen||=new Set();st.groundOpen.add(id);renderPanel();return;}
  if(d.fillground){const row=rows.find(r=>r.id===d.fillground),g=groundNumbers();if(!row)return;if(dragSnap)endDrag();
   // Vehicles: as many as the holds and hangars take; soldiers and droids share the troop space in m³.
   if(row.kind==='vehicle'){const n=maxEmbark('groundForces',row.id);mutate('空きまで搭載',()=>{row.count=n;},'none');renderPanel();return;}
   const per=r=>r.kind==='droids'?C.DROID_STORE_M3:g.personVolume,cap=g.space.capacity,other=rows.reduce((n,r)=>n+(r.id!==row.id&&r.kind!=='vehicle'?per(r)*r.count:0),0);
   mutate('空きまで搭載',()=>{row.count=Math.min(C.GROUND_LIMITS.maxCount,Math.max(0,Math.floor((cap-other+1e-6)/per(row))));},'none');renderPanel();return;}
  if(d.delground){if(dragSnap)endDrag();mutate('地上部隊を削除',()=>ship.groundForces=rows.filter(r=>r.id!==d.delground),'none');renderPanel();return;}
  if(d.moveground){const i=rows.findIndex(r=>r.id===d.moveground),j=i+Number(d.direction);if(i<0||j<0||j>=rows.length)return;if(dragSnap)endDrag();mutate('地上部隊の収容優先順',()=>{const r=rows.splice(i,1)[0];rows.splice(j,0,r);ship.groundForces=rows;},'none');renderPanel();return;}
  if(d.groundroom&&C.PARTS[d.groundroom]){st.tab='mod';st.group=C.PARTS[d.groundroom].group;st.part=d.groundroom;st.partTool='place';st.equipmentId=null;st.template=null;renderPanel();return;}
 });
}
// ---------- tool rail on the 3D view ----------
// The place / select / multi / remove tools sit on the viewport so they are one
// tap away on every screen; the panel's own tool switches mirror them.
const RAIL_ICONS={place:'<path d="M12 5v14M5 12h14"/>',select:'<path d="M6 3l12 9-5.5 1.2L9.5 19z"/>',multi:'<rect x="3" y="8" width="11" height="11" rx="1.5"/><path d="M8 8V4.5h12.5V16H14"/>',remove:'<path d="M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>'};
const RAIL_LABELS={place:'配置',select:'選択',multi:'複数',remove:'撤去'};
function railContext(){
 if(!ship||fleet.mode!=='design'||trial.on)return null;
 if(st.tab==='mod'&&st.group!=='weapons')return {kind:'parts',tools:['place','select','multi','remove'],cur:st.partTool||'place'};
 if(st.tab==='mod'&&st.group==='weapons'||st.tab==='arm')return {kind:'fits',tools:['place','select','multi','remove'],cur:st.fitTool==='adjust'?'select':st.fitTool||'place'};
 if(st.tab==='bridge')return st.bridgeMode==='body'?{kind:'parts',tools:['place','select','multi','remove'],cur:st.partTool||'place'}:{kind:'pods',tools:['place','select','remove'],cur:st.bridgeTool==='adjust'?'select':st.bridgeTool||'place'};
 return null;
}
function renderRail(){
 const box=$('#railTools');if(!box)return;const c=railContext();
 const html=c?c.tools.map(t=>`<button type="button" class="tr-btn" data-rail="${t}" aria-pressed="${c.cur===t}" title="${RAIL_LABELS[t]}"><svg viewBox="0 0 24 24" aria-hidden="true">${RAIL_ICONS[t]}</svg><span>${RAIL_LABELS[t]}</span></button>`).join('')+'<i class="tr-sep" aria-hidden="true"></i>':'';
 if(box.innerHTML!==html)box.innerHTML=html;
}
function railSet(v){
 const c=railContext();if(!c||!c.tools.includes(v))return;
 if(c.kind==='parts'){if(v==='place'&&st.partTool!=='place')carryToPlace();st.partTool=v;if(v!=='select'&&st.sel?.list==='fits')st.sel=null;}
 else{const t=v==='select'?'adjust':v,key=c.kind==='fits'?'fitTool':'bridgeTool';if(t==='place'&&st[key]!=='place')carryToPlace();st[key]=t;if(t!=='adjust')st.sel=null;}
 hideInspect();clearHover();renderPanel();refreshOverlay();updateHint();
 if(st.dockCollapsed){st.dockCollapsed=false;$('#dock').classList.remove('collapsed');}
}
function bindRail(){$('#toolRail')?.addEventListener('click',e=>{const b=e.target.closest('[data-rail]');if(b)railSet(b.dataset.rail);});}

// ---------- panel layout ----------
// After a panel is built: the palette moves to the top (with search and recent
// picks), the panel's tool switches hide behind the rail, long lists fold away
// and explanatory notes shrink to two lines (tap to read the rest).
function placeMode(){const t=tool();return t==='part'||t==='fit';}
function organizePanel(){
 const panel=$('#panel');if(!panel||!ship||fleet.mode!=='design')return;
 for(const sel of ['[data-parttool]','[data-fittool]','[data-bridgetool]']){const g=panel.querySelector(sel)?.closest('.pgroup');if(g)g.classList.add('rail-dup');}
 for(const n of panel.querySelectorAll('.note'))if(!n.classList.contains('keep')&&!n.closest('.trial-card,.ground-editor .aviation-budget'))n.classList.add('clamp');
 for(const h of panel.querySelectorAll('.pgroup > h4')){const t=h.textContent.trim();const g=h.parentElement;if(g.tagName==='DETAILS')continue;
  if(/^配置済みの/.test(t)){const n=g.querySelectorAll('button').length;foldGroup(g,h,`${t}（${n}）`,false);}
  else if(/^配置位置を揃える$/.test(t)){const cur=g.querySelector('[aria-pressed="true"]')?.textContent||'';foldGroup(g,h,`${t}：${cur}`,false);}}
 const pal=placeMode()?panel.querySelector('.parts, .fits'):null;
 if(pal){const anchor=panel.querySelector('[data-group]')?.closest('.pgroup')||panel.querySelector('.command-sub')||panel.querySelector('.rail-dup');
  const tools=document.createElement('div');tools.className='pgroup pal-head';tools.innerHTML=paletteHeadHTML();
  if(anchor){anchor.after(tools);tools.after(pal);}else{panel.prepend(pal);panel.prepend(tools);}
  pal.classList.add('palette');
  if(st.palQuery)paletteSearch(st.palQuery);}
 renderRail();
}
function foldGroup(g,h,label,open){const d=document.createElement('details');d.className=g.className+' fold';d.open=!!open;const sm=document.createElement('summary');sm.textContent=label;d.append(sm);h.remove();while(g.firstChild)d.append(g.firstChild);g.replaceWith(d);}

// ---------- palette search and recent picks ----------
st.recent=(()=>{try{const r=JSON.parse(LS.get('yard.recent1')||'[]');return Array.isArray(r)?r.slice(0,8):[];}catch(e){return [];}})();
function paletteItems(){
 const out=[];
 for(const k of PART_KEYS){const d=C.PARTS[k];out.push({type:'part',key:k,name:d.name,sub:d.desc||'',col:d.col,shape:d.shape,group:C.GROUPS[d.group]||''});}
 for(const d of Object.values(C.EQUIPMENT))out.push({type:'equipment',key:d.id,name:d.name,sub:d.group==='bridge'?'艦橋本体':C.GROUPS[d.group]||'',col:C.PARTS[d.k]?.col,shape:C.PARTS[d.k]?.shape,group:d.group==='bridge'?'艦橋':C.GROUPS[d.group]||''});
 for(const k of WEAPONS)if(C.FITS[k])out.push({type:'fit',key:k,name:C.FITS[k].name,sub:C.FITS[k].short||'',col:[214,120,90],shape:'fit',group:'武装'});
 for(const k of BRIDGES)if(C.FITS[k])out.push({type:'bridge',key:k,name:C.FITS[k].name,sub:'艦橋ポッド',col:[150,200,230],shape:'pod',group:'艦橋'});
 return out;
}
const palIcon=it=>`<i class="sw sh-${it.shape||'cube'}" style="background:${rgb(it.col||[160,170,180])}"></i>`;
function paletteHeadHTML(){
 const items=paletteItems(),find=r=>items.find(i=>i.type===r.type&&i.key===r.key),rec=st.recent.map(find).filter(Boolean).slice(0,6);
 return `<label class="pal-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input type="search" data-palsearch placeholder="部品を探す（反応炉・砲塔・格納庫…）" value="${esc(st.palQuery||'')}" aria-label="部品を検索"></label>${rec.length?`<div class="pal-recent" aria-label="最近使った部品"><span>最近</span>${rec.map(it=>`<button type="button" class="chip pal-chip" data-palpick="${it.type}:${esc(it.key)}">${palIcon(it)}${esc(it.name)}</button>`).join('')}</div>`:''}<div class="pal-results" data-palresults hidden></div>`;
}
function paletteSearch(q){
 const box=document.querySelector('[data-palresults]'),pal=document.querySelector('#panel .palette');if(!box)return;q=(q||'').trim();st.palQuery=q;
 if(!q){box.hidden=true;box.innerHTML='';if(pal)pal.hidden=false;return;}
 const terms=q.toLowerCase().split(/\s+/),hits=paletteItems().filter(it=>terms.every(t=>(it.name+' '+it.sub+' '+it.group+' '+it.key).toLowerCase().includes(t))).slice(0,24);
 box.hidden=false;if(pal)pal.hidden=true;
 box.innerHTML=hits.length?hits.map(it=>`<button type="button" class="part pal-hit" data-palpick="${it.type}:${esc(it.key)}">${palIcon(it)}<span class="pn">${esc(it.name)}</span><span class="pd">${esc(it.group)}${it.sub?' · '+esc(it.sub):''}</span></button>`).join(''):'<p class="note keep">見つかりません。別の言葉で探してください。</p>';
}
function rememberPick(type,key){st.recent=[{type,key},...st.recent.filter(r=>!(r.type===type&&r.key===key))].slice(0,8);LS.set('yard.recent1',JSON.stringify(st.recent));}
// Jump to the tab and group that own the item, then press its own card so the
// usual selection code runs.
function palettePick(type,key){
 st.palQuery='';
 if(type==='part'){st.tab='mod';st.group=C.PARTS[key].group;st.partTool='place';}
 else if(type==='equipment'){const d=C.EQUIPMENT[key];if(d.group==='bridge'){st.tab='bridge';st.bridgeMode='body';}else{st.tab='mod';st.group=d.group;}st.partTool='place';}
 else if(type==='fit'){st.tab='mod';st.group='weapons';st.fitTool='place';}
 else if(type==='bridge'){st.tab='bridge';st.bridgeMode='windows';st.bridgeTool='place';}
 st.sel=null;renderPanel();
 const sel={part:`[data-part="${key}"]`,equipment:`[data-equipment="${key}"]`,fit:`[data-fit="${key}"]`,bridge:`[data-bridge="${key}"]`}[type];
 const b=document.querySelector('#panel '+sel);if(b)b.click();
 if(st.dockCollapsed){st.dockCollapsed=false;$('#dock').classList.remove('collapsed');}
}
function bindPalette(){
 const panel=$('#panel');
 panel.addEventListener('input',e=>{if(e.target.dataset.palsearch!=null)paletteSearch(e.target.value);});
 panel.addEventListener('click',e=>{
  const pk=e.target.closest('[data-palpick]');if(pk){e.stopPropagation();const i=pk.dataset.palpick.indexOf(':');palettePick(pk.dataset.palpick.slice(0,i),pk.dataset.palpick.slice(i+1));return;}
  const card=e.target.closest('[data-part],[data-equipment],[data-fit],[data-bridge]');if(card&&card.closest('.palette, .parts, .fits')){const d=card.dataset;if(d.part)rememberPick('part',d.part);else if(d.equipment)rememberPick('equipment',d.equipment);else if(d.fit)rememberPick('fit',d.fit);else if(d.bridge)rememberPick('bridge',d.bridge);}
  const note=e.target.closest('.note.clamp');if(note&&!e.target.closest('a,button,input,select'))note.classList.toggle('full');
 },true);
}
// ---------- multiple selection, copy and paste ----------
// Parts and fittings can be gathered into one selection, copied to a clipboard
// kept in this browser (so it survives opening another design) and pasted.
st.multi={parts:new Set(),fits:new Set()};st.pasteMode='same';st.multiStep=10;
const CLIP_KEY='yard.clipboard1';
function clipRead(){try{const raw=LS.get(CLIP_KEY);if(raw){const c=JSON.parse(raw);if(c&&c.v===1&&Array.isArray(c.parts)&&Array.isArray(c.fits))return c;}}catch(e){}return st.clipMem||null;}
function clipWrite(c){st.clipMem=c;if(!LS.set(CLIP_KEY,JSON.stringify(c)))toast('この端末には保存できないため、クリップボードはこの画面を閉じるまで有効です');}
const publicCopy=o=>JSON.parse(JSON.stringify(o,(k,v)=>k&&k[0]==='_'?undefined:v));
function multiItems(){return {parts:ship.parts.filter(p=>st.multi.parts.has(p.id)),fits:ship.fits.filter(f=>st.multi.fits.has(f.id))};}
// Symmetry copies come along while 左右対称 / 上下対称 are on, as when removing.
function multiLinked(list,it){const find=id=>id==null?null:ship[list].find(q=>q.id===id),out=[it];if(st.mirror&&it.tw!=null){const t=find(it.tw);if(t)out.push(t);}if(st.vmirror&&it.vt!=null){const v=find(it.vt);if(v){out.push(v);if(st.mirror&&v.tw!=null){const w=find(v.tw);if(w)out.push(w);}}}return out;}
function multiToggle(hit){
 let list=null,it=null;
 if(hit?.part?.windowId||hit?.part?.weaponId){list='fits';it=ship.fits.find(f=>f.id===(hit.part.windowId||hit.part.weaponId));}
 else if(hit?.fit){list='fits';it=hit.fit;}else if(hit?.part&&hit.part.id>0){list='parts';it=ship.parts.find(p=>p.id===hit.part.id);}
 if(!it){toast(st.view==='normal'?'部品をタップしてください（内部の区画は「透視」で選べます）':'部品が見つかりません');return;}
 const set=st.multi[list],on=!set.has(it.id);for(const q of multiLinked(list,it))on?set.add(q.id):set.delete(q.id);
 renderPanel();refreshOverlay();
}
function multiCopy(){const m=multiItems();if(!m.parts.length&&!m.fits.length){toast('選択がありません');return false;}clipWrite({v:1,from:{name:ship.name,L:ship.hull.L,W:ship.hull.W,H:ship.hull.H},parts:m.parts.map(publicCopy),fits:m.fits.map(publicCopy),at:Date.now()});return true;}
function multiDelete(label){
 const ids={parts:new Set(st.multi.parts),fits:new Set(st.multi.fits)};if(!ids.parts.size&&!ids.fits.size)return;
 mutate(label||'まとめて撤去',()=>{for(const id of ids.fits)C.removeItem(ship,'fits',id,false);for(const id of ids.parts)C.removeItem(ship,'parts',id,false);for(const f of ship.fits)if(f.host!=null&&ids.parts.has(f.host))delete f.host;},'all');
 st.multi={parts:new Set(),fits:new Set()};if(st.sel&&ids[st.sel.list]?.has(st.sel.id))st.sel=null;
}
function multiPaste(){
 const c=clipRead();if(!c||!(c.parts.length||c.fits.length)){toast('クリップボードは空です');return;}
 const k=st.pasteMode==='scale'&&c.from?.L>0?[ship.hull.L/c.from.L,ship.hull.H/(c.from.H||ship.hull.H),ship.hull.W/(c.from.W||ship.hull.W)]:[1,1,1],sc=v=>v.map((x,i)=>x*k[i]);
 const L=C.DESIGN_LIMITS;if(ship.parts.length+c.parts.length>L.parts||ship.fits.length+c.fits.length>L.fits){toast(`部品数の上限（区画 ${L.parts}・装備 ${L.fits}）を超えるため貼り付けられません`);return;}
 const map={parts:new Map(),fits:new Map()},made={parts:[],fits:[]};
 const ok=mutate(`${c.parts.length+c.fits.length} 個を貼り付け`,()=>{
  for(const l of ['parts','fits'])for(const src of c[l]){const q=JSON.parse(JSON.stringify(src));map[l].set(src.id,ship.nextId);q.id=ship.nextId++;made[l].push(q);}
  for(const l of ['parts','fits'])for(const q of made[l]){for(const r of ['tw','vt']){if(q[r]==null)continue;const n=map[l].get(q[r]);if(n!=null)q[r]=n;else delete q[r];}
   if(l==='fits'){if(q.host!=null){const n=map.parts.get(q.host);if(n!=null)q.host=n;else delete q.host;}q.p=sc(q.p);delete q.float;}else q.c=sc(q.c);
   ship[l].push(q);}
 },'all');
 if(ok===false)return;st.multi={parts:new Set(made.parts.map(q=>q.id)),fits:new Set(made.fits.map(q=>q.id))};
 toast(`貼り付けました：区画・構造物 ${made.parts.length}・装備 ${made.fits.length}`);
}
function multiMove(axis,sign){
 const m=multiItems(),step=C.clamp(+st.multiStep||0,0,C.DESIGN_LIMITS?.coordinate||1e5);if(!(m.parts.length||m.fits.length)||!step)return;
 const d=[0,0,0];d[axis]=sign*step;const moved=new Set();
 mutate('まとめて移動',()=>{
  const apply=(l,q,v)=>{if(!q||moved.has(l+q.id))return;moved.add(l+q.id);if(l==='parts')q.c=q.c.map((x,i)=>x+v[i]);else q.p=q.p.map((x,i)=>x+v[i]);};
  for(const l of ['parts','fits']){const find=id=>ship[l].find(x=>x.id===id),inSel=id=>id!=null&&st.multi[l].has(id);
   for(const q of m[l]){if(moved.has(l+q.id))continue;apply(l,q,d);
    if(st.mirror&&inSel(q.tw))apply(l,find(q.tw),[d[0],d[1],-d[2]]);
    if(st.vmirror&&inSel(q.vt)){const v=find(q.vt);apply(l,v,[d[0],-d[1],d[2]]);if(st.mirror&&v&&inSel(v.tw))apply(l,find(v.tw),[d[0],-d[1],-d[2]]);}}}
 },'all');
}
function multiPanelHTML(){
 const m=multiItems(),np=m.parts.length,nf=m.fits.length,n=np+nf,c=clipRead(),cn=c?c.parts.length+c.fits.length:0;
 const kinds=[...m.parts.map(p=>C.PARTS[p.k]?.name),...m.fits.map(f=>C.FITS[f.k]?.short)].reduce((o,k)=>(o[k]=(o[k]||0)+1,o),{});
 return `<div class="pgroup blueprint-card multi-card"><h4>複数選択</h4><p class="note">区画・構造物・装備をタップして選択に加え、もう一度タップで外します。左右・上下対称がオンなら対の部品も一緒に選びます。内部の区画は「透視」で選べます。</p>
 <div class="multi-count"><span><b>${np}</b> 区画・構造物</span><span><b>${nf}</b> 装備</span></div>${n?`<p class="note multi-kinds">${Object.entries(kinds).map(([k,v])=>esc(k||'—')+' ×'+v).join('・')}</p>`:''}
 <div class="chips"><button type="button" class="chip" data-multi="allparts">区画・構造物をすべて</button><button type="button" class="chip" data-multi="allstruct">構造物だけ</button><button type="button" class="chip" data-multi="allfits">装備をすべて</button><button type="button" class="chip" data-multi="none" ${n?'':'disabled'}>選択解除</button></div>
 <div class="multi-actions"><button type="button" class="btn primary" data-multi="copy" ${n?'':'disabled'}>コピー</button><button type="button" class="btn" data-multi="cut" ${n?'':'disabled'}>切り取り</button><button type="button" class="btn sm danger" data-multi="delete" ${n?'':'disabled'}>撤去</button></div>
 <h4>まとめて移動</h4><label class="field-label multi-step">移動量（m）<input type="number" data-multistep min="0.1" step="any" value="${st.multiStep}"></label>
 <div class="multi-move">${[[0,1,'艦首へ'],[0,-1,'艦尾へ'],[1,1,'上へ'],[1,-1,'下へ'],[2,-1,'左舷へ'],[2,1,'右舷へ']].map(([a,sg,l])=>`<button type="button" class="btn sm" data-multimove="${a}" data-sign="${sg}" ${n?'':'disabled'}>${l}</button>`).join('')}</div>
 <p class="note">対称の相手も選んでいれば鏡写しに動きます。装備は移動後に近くの面へ据え直します。</p></div>
 <div class="pgroup blueprint-card multi-card"><h4>貼り付け</h4>${c?`<p class="multi-clip"><span>区画・構造物 <b>${c.parts.length}</b>　装備 <b>${c.fits.length}</b></span><small>「${esc(c.from?.name||'不明')}」全長 ${fLen(c.from?.L||0)} から</small></p>${seg('pastemode',[['same','同じ座標'],['scale','艦の寸法に合わせる']],st.pasteMode)}<div class="multi-actions"><button type="button" class="btn primary" data-multi="paste">${cn} 個を貼り付け</button></div><p class="note">貼り付けた部品はそのまま選択されるので、続けて「まとめて移動」で位置を整えられます。別の艦へは、設計図から艦を開いてこの画面で貼り付けます。クリップボードはこの端末のブラウザに残ります。</p>`:'<p class="note">まだコピーしていません。選択して「コピー」すると、この艦や別の艦に貼り付けられます。</p>'}</div>`;
}
function bindMulti(){
 const panel=$('#panel');
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||!ship)return;const d=b.dataset;
  if(d.pastemode){st.pasteMode=d.pastemode;renderPanel();return;}
  if(d.multimove!=null){multiMove(+d.multimove,+d.sign);renderPanel();refreshOverlay();return;}
  if(!d.multi)return;const a=d.multi;
  if(a==='allparts')st.multi.parts=new Set(ship.parts.map(p=>p.id));
  else if(a==='allstruct')st.multi.parts=new Set(ship.parts.filter(p=>p.k==='struct').map(p=>p.id));
  else if(a==='allfits')st.multi.fits=new Set(ship.fits.map(f=>f.id));
  else if(a==='none')st.multi={parts:new Set(),fits:new Set()};
  else if(a==='copy'){if(multiCopy())toast('コピーしました。別の艦を開いても貼り付けられます');}
  else if(a==='cut'){if(multiCopy())multiDelete('切り取り');}
  else if(a==='delete')multiDelete();
  else if(a==='paste')multiPaste();
  renderPanel();refreshOverlay();
 });
 panel.addEventListener('change',e=>{if(e.target.dataset.multistep==null)return;const v=+e.target.value;if(Number.isFinite(v)&&v>0)st.multiStep=v;else e.target.value=st.multiStep;});
}
// Phone landscape: the right-hand editor can be hidden to give the 3D view the whole screen.
function bindDockToggle(){
 const b=$('#btnDock');if(!b)return;
 const set=on=>{$('#app').classList.toggle('dock-off',on);b.setAttribute('aria-pressed',String(on));b.title=on?'操作パネルを表示':'操作パネルを隠す';b.setAttribute('aria-label',b.title);setTimeout(()=>requestDraw(),30);};
 b.addEventListener('click',()=>set(!$('#app').classList.contains('dock-off')));set(false);
}
// ---------- screenshot mode ----------
// Hides every control so only the 3D view is left, on the drawing board and in
// flight. A small bar (pause in flight, and the way back) shows while the
// pointer moves and fades after a moment so it stays out of the picture.
const shot={on:false,timer:0};
function shotSet(on){
 on=!!on;if(shot.on===on)return;shot.on=on;document.body.classList.toggle('shot-mode',on);const bar=$('#shotBar');
 if(on){hideInspect();clearHover();if(!trial.on){st.sel=null;st.hatchA=null;refreshOverlay();}if(bar)bar.hidden=false;shotBarRender();shotWake();toast('スクリーンショット表示：画面に触れると操作ボタンが出ます（H・Esc で戻る）');}
 else{if(bar){bar.hidden=true;bar.classList.remove('idle');}clearTimeout(shot.timer);if(trial.paused)trialPause(false);if(!trial.on)renderPanel();}
 const b=$('#btnShot');if(b)b.setAttribute('aria-pressed',String(on));setTimeout(()=>requestDraw(),30);
}
function shotWake(){const bar=$('#shotBar');if(!shot.on||!bar)return;bar.classList.remove('idle');clearTimeout(shot.timer);shot.timer=setTimeout(()=>bar.classList.add('idle'),2600);}
function shotBarRender(){const bar=$('#shotBar');if(!bar)return;bar.innerHTML=`${trial.on?`<button type="button" class="shot-btn" data-shot="pause" aria-pressed="${!!trial.paused}">${trial.paused?'▶ 再開':'❚❚ 一時停止'}</button>`:''}<button type="button" class="shot-btn" data-shot="exit">表示を戻す</button>`;}
function trialPause(on){trial.paused=on==null?!trial.paused:!!on;trial.fire=trial.fireKey=false;trial.last=0;shotBarRender();if(!shot.on)toast(trial.paused?'一時停止（K で再開）':'再開');}
function bindShot(){
 $('#btnShot')?.addEventListener('click',()=>shotSet(!shot.on));
 $('#shotBar')?.addEventListener('click',e=>{const b=e.target.closest('[data-shot]');if(!b)return;e.preventDefault();if(b.dataset.shot==='pause')trialPause();else shotSet(false);shotWake();});
 for(const ev of ['pointerdown','pointermove'])window.addEventListener(ev,()=>{if(shot.on)shotWake();},{passive:true});
}
// ---------- 公試: a free flight trial in low orbit over Coruscant ----------
// WoWS-style standing orders for speed and rudder, a stick for pitch and roll,
// and turrets that follow the view. The ship stays at the render origin; its
// position is kept in double precision relative to the planet centre.

const TRIAL_TELEGRAPH=[['後進',-.25],['停止',0],['1/4',.25],['1/2',.5],['3/4',.75],['全速',1]];
const TRIAL_RUDDER=['取舵一杯','取舵','舵中央','面舵','面舵一杯'];
// The orbit centre floats above the ship and the default view is nearly level,
// so the reticle (screen centre) looks at the horizon with the ship below it.
const TRIAL_CAM_PH=1.54,TRIAL_CAM_LIFT=.2;
const TRIAL_GUN={boltSpeed:4500,range:40000,aim:20000,maxBolts:2400,hitsToKill:10,targets:4};
// How the main batteries are laid: on the reticle, held on an enemy whatever
// the view, or trained fore-and-aft at their initial bearing.
const GUN_MODES={
 free:{name:'自由照準',short:'自由',note:'照準線の先、または照準に捉えた目標を狙います'},
 enemy:{name:'敵方固定',short:'敵固定',note:'視点を動かしても、捉えた目標（なければ最寄りの敵）を追い続けます'},
 home:{name:'初期位置固定',short:'初期位置',note:'砲塔を初期位置に戻して固定します。射撃は砲身の向きへ'}};
const trial={on:false,gunMode:'free',gunTarget:null,paused:false,busy:false,asset:null,p:null,P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],tele:1,rudder:0,level:false,t:0,last:0,hud:0,vf:0,thrust:0,camMode:'horizon',camF:null,rec:null,dust:null,warn:'',designCamera:null,
 stick:{x:0,y:0},keyStick:{x:0,y:0},keys:new Set(),fire:false,fireKey:false,fireTap:0,turrets:[],launchers:[],bolts:[],missiles:[],fx:[],wrecks:[],targets:[],gun:null,rays:{busy:false,last:0},aim:null,lead:null,power:null,mslOrder:false,energy:null,powerMode:'balanced',engF:1,thrustWant:0,sysKey:'coruscant',mode:'trial',vbolts:[],jump:null,flash:0,hitFlash:0,battle:null,battlePlan:null};
const tv={dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];},add:(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k],scale:(a,k)=>[a[0]*k,a[1]*k,a[2]*k],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]};
function trialRot(v,axis,ang){const c=Math.cos(ang),s=Math.sin(ang),d=tv.dot(axis,v),x=tv.cross(axis,v);return [v[0]*c+x[0]*s+axis[0]*d*(1-c),v[1]*c+x[1]*s+axis[1]*d*(1-c),v[2]*c+x[2]*s+axis[2]*d*(1-c)];}
// Column-major frame from forward and approximate up (Gram-Schmidt).
function trialFrame(f,u){f=tv.norm(f);u=tv.norm(tv.add(u,f,-tv.dot(u,f)));const r=tv.cross(f,u);return [f[0],f[1],f[2],u[0],u[1],u[2],r[0],r[1],r[2]];}
const trialCol=(M,i)=>[M[i*3],M[i*3+1],M[i*3+2]];
const trialApply=(M,v)=>[M[0]*v[0]+M[3]*v[1]+M[6]*v[2],M[1]*v[0]+M[4]*v[1]+M[7]*v[2],M[2]*v[0]+M[5]*v[1]+M[8]*v[2]];
const trialApplyT=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
// Rotation about a unit axis, column-major.
function trialAxisMatrix(a,t,out){const c=Math.cos(t),s=Math.sin(t),k=1-c,[x,y,z]=a;out=out||new Array(9);out[0]=c+x*x*k;out[1]=y*x*k+z*s;out[2]=z*x*k-y*s;out[3]=x*y*k-z*s;out[4]=c+y*y*k;out[5]=z*y*k+x*s;out[6]=x*z*k+y*s;out[7]=y*z*k-x*s;out[8]=c+z*z*k;return out;}
const trialWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function trialProfile(){if(!ship||!S)return null;try{return C.fleetProfile(S,ship.name);}catch(e){return null;}}
function trialFigures(p){const v=p?.maxSpeed||0,ok=!!(p&&p.accel>0&&v>0&&p.turnRate>0);const rates=(ship?.fits||[]).filter(f=>{const d=C.FITS[f.k];return d.cat==='w'&&(d.tt||d.ion)&&!f.float&&!d.casemate;}).map(f=>C.turretRate(f));return {ok,v,kmh:v*3.6,accelTime:ok?v/p.accel:0,turn:ok?p.turnRate*180/Math.PI:0,circle:ok?2*v/p.turnRate:0,traverse:rates.length?[Math.min(...rates),Math.max(...rates)]:null};}
function trialCardHTML(side){
 if(!ship||!S)return '';const f=trialFigures(trialProfile()),tr=f.traverse;
 return `<div class="pgroup trial-card${side?' side':''}"><div class="trial-head"><h4>公試</h4><span>コルサント低軌道</span></div><p class="note">設計した艦を軌道上で操艦し、速力・加速・旋回と砲塔の射界を確かめます。</p>${f.ok?`<dl class="trial-kv"><dt>最大速力</dt><dd>${num(Math.round(f.v))} m/s</dd><dt>0→全速</dt><dd>${Math.round(f.accelTime)} 秒</dd><dt>全舵旋回率</dt><dd>${f.turn.toFixed(1)}°/秒</dd><dt>全速旋回径</dt><dd>${(f.circle/1000).toFixed(1)} km</dd>${tr?`<dt>砲塔旋回</dt><dd>${tr[0]===tr[1]?tr[0].toFixed(0):tr[0].toFixed(0)+'〜'+tr[1].toFixed(0)}°/秒</dd>`:''}</dl>`:`<p class="note neg">加速度が 0 G のため航行できません。推進・慣性補償・構造の上限を確認してください。</p>`}<button type="button" class="btn primary trial-go" data-trial="start" ${f.ok?'':'disabled'}>公試に出る</button></div>`;
}
// Watching a battle, the range follows the ship in view and reaches out to take in the fight.
// v21 The fixed pads (60 m, 4 km) suit ships; under 200 m they shrink with the length, so a starfighter's camera sits a few lengths away.
const trialCamPad=L=>C.clamp(L/200,.02,1);
const trialCamRange=r=>{const L=trial.spectate&&trial.camLen?trial.camLen:trial.p.len,k=trialCamPad(L);return C.clamp(r,L*.45+60*k,trial.spectate?Math.max(L*12+6000*k,60000*k):L*10+4000*k);};
function trialReset(){
 if(trial.cine)spaceCineEnd();const sy=trialSys(),R=sy.planet.radius;Object.assign(trial,{P:[0,R+sy.altitude,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],tele:1,rudder:0,level:false,t:0,last:0,vf:0,thrust:0,camF:null,warn:'',bolts:[],missiles:[],fx:[],wrecks:[],vbolts:[],fireTap:0,aim:null,lead:null,mslOrder:false,jump:null,flash:0,hitFlash:0,camSave:null,drones:[],gunTarget:null,heldLock:null});
 trial.rec={top:0,accel:null,run:null,turn:null,turnSpeed:0};trial.gun={shots:0,hits:0,kills:0,missiles:0};for(const l of trial.launchers){l.reload=0;l.queue=0;l.next=0;}
 // The charging banks start full; their size is one volley per gun (more where a gun stores extra salvos).
 const bank=trial.p.wCap||trial.turrets.reduce((n,t)=>n+t.power*t.cycle*t.charge/TT_J,0);trial.energy={E:bank,cap:bank};trial.engF=1;trial.thrustWant=0;trial.power=null;
 const L=trial.p.len;trialDust();
 for(const t of trial.turrets){t.yaw=0;t.el=0;t.reload=Math.random()*t.cycle;t.clear=false;t.clearDir=null;t.aimed=false;t.arc=true;t.dead=false;t.rot=trialAxisMatrix(t.axis,0,t.rot);}for(const l of trial.launchers)l.dead=false;
 trial.targets=[];trial.battle=null;if(trial.rts)voyPilotInit();else if(trial.mode==='battle'&&trial.battlePlan)spaceBattleInit(trial.battlePlan);else if(trial.returnTo==='title')patrolReset();else for(let i=0;i<TRIAL_GUN.targets;i++)trial.targets.push(trialSpawnTarget(i,true));
 escortsInit();
 trial.swSolo=null;trial.swfx=[];trial.swPend=[];
 if(view){const asp=(view.canvas.clientWidth||900)/(view.canvas.clientHeight||600);view.cam.th=Math.PI;view.cam.ph=TRIAL_CAM_PH;view.cam.r=trialCamRange((L*1.35+260*trialCamPad(L))*Math.max(1,.95/asp));}
}
// Target buoys sit ahead of the ship in its local horizon, 8–28 km out.
function trialSpawnTarget(i,first){
 const up=tv.norm(trial.P),f=trialCol(trial.R,0);let fh=tv.add(f,up,-tv.dot(f,up));fh=tv.len(fh)>.2?tv.norm(fh):tv.norm(tv.cross(up,[0,0,1]));const rt=tv.cross(fh,up);
 const L=trial.p.len,bearing=first?[-.6,.25,-.15,.55][i%4]:(Math.random()*2-1)*1.2,dist=first?[9000,14000,20000,27000][i%4]+L*.6:8000+L*.6+Math.random()*20000,rise=(Math.random()*2-1)*1500;
 const off=tv.add(tv.add(tv.scale(fh,Math.cos(bearing)*dist),rt,Math.sin(bearing)*dist),up,rise);
 const hd=Math.random()*Math.PI*2,sp=40+Math.random()*140;
 return {id:i,pos:tv.add(trial.P,off),vel:tv.add(tv.scale(fh,Math.cos(hd)*sp),rt,Math.sin(hd)*sp),hits:0,alive:true,respawn:0,spin:Math.random()*6.28,rot:[1,0,0,0,1,0,0,0,1]};
}
// Each gun keeps its range band: how far its bolts carry and what its fire costs in stored energy.
function trialTurretState(t){const fw=tv.norm(t.fw),axis=tv.norm(t.axis),spec=C.FITS[t.k]||{},band=C.fitBand(spec);return {...t,band,reach:C.GUN_BANDS[band]?.range||TRIAL_GUN.range,costK:spec.ion?1:C.COMBAT.bandCost[band]??1,pd:(spec.aa||0)>0&&!((spec.tt||0)>.01)&&!spec.ion,fw,axis,e2:tv.cross(axis,fw),rateRad:t.rate*Math.PI/180,yaw:0,el:0,reload:0,clear:false,clearDir:null,aimed:false,arc:true,rot:trialAxisMatrix(axis,0)};}
// opts.design flies another design than the one on the drawing board;
// opts.battle starts a space battle with that plan; opts.system picks the system.
async function trialStart(opts={}){
 if(trial.on||trial.busy||!view||fleet.mode!=='design')return;if(!opts.design&&!ship)return;
 if(!opts.design){const f=trialFigures(trialProfile());if(!f.ok){toast('加速度が 0 G のため公試を行えません');return;}}
 trial.busy=true;loadShow(opts.rts?.spectate?'3D視点の準備中…（この星系の艦の3Dモデル）':opts.battle||opts.rts?'艦隊戦の準備中…（旗艦の砲塔と射界を計算）':opts.patrol?'パトロールの準備中…（砲塔の旋回軸と射界を計算）':'公試の準備中…（砲塔の旋回軸と射界を計算）',opts.rts?.spectate?'3D視点':opts.rts?'操艦準備':opts.battle?'艦隊戦':opts.patrol?'パトロール':'公試');
 let a=null;try{const data=opts.design||C.serialize(ship),key='trial-'+fleetHash(JSON.stringify(data)),r=await YardEngineClient.request('fleet',{design:data,trial:true});a={key,design:r.design,stats:r.stats,p:r.profile,geometry:r.geometry};if(view)view.loadFleet(key,r.geometry);
  if(opts.escorts?.length){$('#lsText').textContent='随伴艦の3Dモデルを準備中…';for(const k of opts.escorts)await fleetAsset(k);}}
 catch(e){console.error(e);toast('公試を開始できません：'+esc(e.message||e));}finally{trial.busy=false;hideBusyOverlay();}
 if(!a||trial.on||fleet.mode!=='design'){loadHide();return;}
 if(!(a.p.accel>0&&a.p.maxSpeed>0)){loadHide();toast('加速度が 0 G のため公試を行えません');return;}
 trial.paused=false;trial.rts=opts.rts||null;trial.spectate=!!opts.rts?.spectate;trial.specCam='chase';trial.frameMs=0;trial.scaleAt=0;if(view)view.renderScale=1;trial.mode=opts.battle||opts.rts?'battle':'trial';trial.battlePlan=opts.battle||null;trial.returnTo=opts.returnTo||null;trial.escortKeys=!opts.battle&&!opts.rts?(opts.escorts||[]).filter(k=>fleet.assets.has(k)):[];if(opts.system&&SYSTEMS[opts.system])trial.sysKey=opts.system;trial.sysKey=trial.sysKey||'coruscant';
 if(trial.rts){SYSTEMS.rts=voySysDesc(trial.rts.w,trial.rts.sys);trial.sysKey='rts';}
 trial.asset=a;trial.p=a.p;trial.turrets=(a.geometry.turrets||[]).map(trialTurretState);for(const t of trial.turrets)t.charge=t.cap?C.clamp(a.stats.chargeInfo?.[t.id]?.ratio??0,0,1):1;trial.launchers=(a.geometry.launchers||[]).map(l=>({...l,reload:0,queue:0,next:0}));trial.designCamera={cam:JSON.parse(JSON.stringify(view.cam)),off:[...view.off]};
 closeSheet();hideInspect();clearHover();if(dragSnap)endDrag();
 view.off=[0,0,0];view.cam={...view.cam,target:[0,0,0],ortho:false};trialReset();
 trial.on=true;trial.startedAt=performance.now();trial.shotAt=0;document.body.classList.add('trial-on');const hud=$('#trialHud');hud.hidden=false;hud.classList.toggle('spectate',!!trial.spectate);if(trial.spectate){hud.innerHTML=voySpectateHudHTML();voySpectateHudUpdate(true);}else{hud.innerHTML=trialHudHTML();trialBindHud(hud);trialHudUpdate(true);}
 requestAnimationFrame(()=>{requestDraw();});loadHideSoon();
}
function trialStop(){
 if(!trial.on)return;if(shot.on)shotSet(false);trial.paused=false;trial.on=false;trial.hitcam=null;trial.fire=trial.fireKey=false;trial.keys.clear();trial.stick={x:0,y:0};trial.keyStick={x:0,y:0};
 document.body.classList.remove('trial-on');const hud=$('#trialHud');hud.hidden=true;hud.innerHTML='';hud.classList.remove('spectate');if(view)view.renderScale=1;
 if(view){if(trial.designCamera){view.cam=trial.designCamera.cam;view.off=trial.designCamera.off;}delete view.cam.frame;delete view.cam.far;}
 try{YardEngineClient.post({type:'trialEnd'});}catch(e){}
 trial.asset=null;trial.turrets=[];trial.launchers=[];trial.bolts=[];trial.missiles=[];trial.fx=[];trial.wrecks=[];trial.vbolts=[];trial.targets=[];trial.battle=null;trial.jump=null;trial.cine=null;trial.pat=null;
 const back=trial.returnTo,wasRts=!!trial.rts;trial.spectate=false;trial.returnTo=null;trial.battlePlan=null;trial.rts=null;trial.mode='trial';trial.foeCraft=[];trial.ownCraft=[];trial.foeMissiles=[];trial.cbolts=[];trial.craftGhosts=[];fleetPrune();renderPanel();renderSpecTargets();syncHud();requestDraw();if(back==='tactical')fleetSetMode('tactical');if(back==='voyage'||wasRts)voyPilotEnd();else if(back==='title')showTitle('voyage');
}
function trialAttitude(){
 // Coming out of hyperspace the ship is still far out on its line to the
 // arrival point; its attitude is read against the vertical there.
 const j=trial.jump,ref=j?.to&&(j.phase==='exit'||j.phase==='brake'||j.phase==='tunnel'&&j.arrived)?j.to:trial.P;
 const R=trial.R,f=trialCol(R,0),u=trialCol(R,1),r=trialCol(R,2),up=tv.norm(ref),north=[0,0,-1];
 let nt=tv.add(north,up,-tv.dot(north,up));nt=tv.len(nt)>1e-6?tv.norm(nt):[1,0,0];const et=tv.cross(nt,up),fh=tv.add(f,up,-tv.dot(f,up));
 const heading=((Math.atan2(tv.dot(fh,et),tv.dot(fh,nt))*180/Math.PI)%360+360)%360;
 return {f,u,r,up,pitch:Math.asin(C.clamp(tv.dot(f,up),-1,1)),bank:Math.atan2(-tv.dot(r,up),tv.dot(u,up)),heading,alt:tv.len(trial.P)-trialSys().planet.radius};
}
function trialMaxRates(){const p=trial.p,tr=p.turnRate||0,sf=.45+.55*Math.min(1,Math.abs(trial.vf)/Math.max(1,p.maxSpeed));return [tr*2.2,tr*sf,tr*.75*sf];}
// Touch stick and held keys: the larger deflection on each axis wins.
function trialStickInput(){const a=trial.stick,b=trial.keyStick,pick=(x,y)=>Math.abs(x)>=Math.abs(y)?x:y;return {x:C.clamp(pick(a.x,b.x),-1,1),y:C.clamp(pick(a.y,b.y),-1,1)};}
function trialStep(dt){
 const p=trial.p,a=trialAttitude(),max=trialMaxRates(),stick=trialStickInput();
 if(Math.abs(stick.x)>.05||Math.abs(stick.y)>.05)trial.level=false;
 const want=[stick.x*max[0],trial.rudder/2*max[1],stick.y*max[2]];
 if(trial.level){want[0]=C.clamp(-a.bank*.9,-max[0],max[0]);want[2]=C.clamp(-a.pitch*.9,-max[2]||-.01,max[2]||.01);if(Math.abs(a.bank)<.003&&Math.abs(a.pitch)<.003&&Math.abs(trial.w[0])<.003&&Math.abs(trial.w[2])<.003){trial.level=false;trial.w[0]=trial.w[2]=0;}}
 const k=1-Math.exp(-dt/C.clamp(1.3*Math.sqrt(p.len/1600),.5,5));for(let i=0;i<3;i++)trial.w[i]+=(want[i]-trial.w[i])*k;
 // roll about forward, yaw (positive = starboard) about -up, pitch about starboard
 const om=tv.add(tv.add(tv.scale(a.f,trial.w[0]),a.u,-trial.w[1]),a.r,trial.w[2]),mag=tv.len(om);
 if(mag>1e-9){const ax=tv.scale(om,1/mag),ang=mag*dt;trial.R=trialFrame(trialRot(a.f,ax,ang),trialRot(a.u,ax,ang));}
 // Engines push only as hard as the power distribution feeds them.
 const engines=trial.battle?C.fleetSystems(trial.battle.me).engine:1,f=trialCol(trial.R,0),sp=TRIAL_TELEGRAPH[trial.tele][1]*p.maxSpeed,vf=tv.dot(trial.V,f),acc=p.accel*engines*C.clamp(trial.engF??1,0,1),dv=C.clamp(sp-vf,-acc*dt,acc*dt);
 trial.thrustWant=p.accel>0&&dt>0?Math.min(1,Math.abs(sp-vf)/(p.accel*dt)):0;trial.thrust=p.accel>0&&dt>0?Math.abs(dv)/(p.accel*dt):0;
 const lat=tv.add(trial.V,f,-vf),damp=Math.exp(-dt/2.5);trial.V=tv.add(tv.scale(f,vf+dv),lat,damp);trial.vf=vf+dv;
 trial.P=tv.add(trial.P,trial.V,dt);trial.t+=dt;
 const up=tv.norm(trial.P),floor=trialSys().planet.radius+trialSys().floor;trial.warn='';
 if(tv.len(trial.P)<floor){trial.P=tv.scale(up,floor);const vr=tv.dot(trial.V,up);if(vr<0)trial.V=tv.add(trial.V,up,-vr);trial.warn='大気圏上層：これ以上は降下できません';}
 else if(tv.len(trial.P)<floor+20000)trial.warn='大気圏に接近中';
 const d=trial.dust,H=d.H,mv=tv.scale(trial.V,dt);for(let i=0;i<d.pos.length;i+=3)for(let j=0;j<3;j++){let x=d.pos[i+j]-mv[j];if(x>H)x-=2*H*Math.ceil((x-H)/(2*H));else if(x<-H)x+=2*H*Math.ceil((-H-x)/(2*H));d.pos[i+j]=x;}
 const r=trial.rec,vmax=p.maxSpeed;r.top=Math.max(r.top,trial.vf);
 if(trial.tele===5&&!r.run&&trial.vf<.02*vmax)r.run={t0:trial.t};if(r.run&&trial.tele!==5)r.run=null;if(r.run&&trial.vf>=.98*vmax){r.accel=trial.t-r.run.t0;r.run=null;}
 if(Math.abs(trial.rudder)===2&&Math.abs(trial.vf)>.05*vmax&&Math.abs(Math.abs(trial.w[1])-max[1])<.03*max[1]){r.turn=2*Math.abs(trial.vf)/Math.abs(trial.w[1]);r.turnSpeed=trial.vf;}
 trialGunnery(dt);
}
// ---- gunnery ----
const trialBarrel=(t,yaw,el)=>{const c=Math.cos(el),h=tv.add(tv.scale(t.fw,Math.cos(yaw)),t.e2,Math.sin(yaw));return tv.norm(tv.add(tv.scale(h,c),t.axis,Math.sin(el)));};
const trialLimits=t=>t.casemate?{yaw:65*Math.PI/180,lo:-20*Math.PI/180,hi:20*Math.PI/180}:{yaw:null,lo:-10*Math.PI/180,hi:85*Math.PI/180};
function trialAim(){
 if(!view)return null;const eye=view.eye(),dir=tv.norm(tv.sub(view.cam.target,eye));let dist=Math.max(TRIAL_GUN.aim,trial.p.len*1.5),lock=null,best=Infinity;
 for(const t of trial.targets){if(!t.alive||t.ally)continue;const v=tv.sub(tv.sub(t.pos,trial.P),eye),d=tv.len(v),ang=Math.acos(C.clamp(tv.dot(v,dir)/d,-1,1)),cone=Math.atan((t.radius||trial.asset.geometry.targetRadius*1.6)/d)+.006;if(ang<cone&&ang<best){best=ang;lock=t;dist=d;}}
 return {eye,dir,dist,lock,point:tv.add(eye,dir,dist)};
}
// One of our own ships across a gun's line of fire (from p along unit d, for r metres), or null.
function trialAllyOnLine(p,d,r){
 for(const t of trial.targets)if(t.ally&&t.alive&&trialBoxOnLine(t,p,d,r))return t;
 for(const e of trial.escorts||[]){const b={pos:e.pos,rot:e.R,radius:e.p.len*.5,semi:[e.p.len*.5,(e.p.height||e.p.len*.2)*.5,(e.p.width||e.p.len*.5)*.5]};if(trialBoxOnLine(b,p,d,r))return b;}
 return null;
}
// Whether a ship's box (pos, rot, semi, radius) lies across the segment from p along unit d for r metres.
function trialBoxOnLine(t,p,d,r,k=.9){
 const rel=tv.sub(t.pos,p),s=tv.dot(rel,d),Rr=t.radius*1.1;if(s<-Rr||s>r+Rr||tv.len(tv.add(rel,d,-s))>Rr)return false;
 const a=trialApplyT(t.rot,tv.sub(p,t.pos)),b=trialApplyT(t.rot,tv.sub(tv.add(p,d,r),t.pos));let t0=0,t1=1;
 for(let i=0;i<3;i++){const e=t.semi[i]*k,dd=b[i]-a[i];if(Math.abs(dd)<1e-9){if(a[i]<-e||a[i]>e)return false;continue;}let lo=(-e-a[i])/dd,hi=(e-a[i])/dd;if(lo>hi){const q=lo;lo=hi;hi=q;}t0=Math.max(t0,lo);t1=Math.min(t1,hi);if(t0>t1)return false;}
 return true;
}
// Time for a bolt leaving o at speed s (plus the ship's own velocity) to meet a
// target at p moving at u relative to the ship. Null when it cannot catch up.
function trialIntercept(d,u,s){const a=tv.dot(u,u)-s*s,b=2*tv.dot(d,u),c=tv.dot(d,d);if(Math.abs(a)<1e-6)return b<0?-c/b:null;const disc=b*b-4*a*c;if(disc<0)return null;const r=Math.sqrt(disc),t1=(-b-r)/(2*a),t2=(-b+r)/(2*a),t=Math.min(t1,t2)>0?Math.min(t1,t2):Math.max(t1,t2);return t>0?t:null;}
// The enemy a fixed battery stays on: the target under the reticle when there
// is one, else the last one held while it lives, else the nearest enemy.
function trialGunTarget(lk){
 if(lk)trial.gunTarget=lk;const g=trial.gunTarget;if(g&&g.alive&&trial.targets.includes(g))return g;
 let best=null,d=Infinity;for(const t of trial.targets){if(!t.alive||t.ally)continue;const x=tv.len(tv.sub(t.pos,trial.P));if(x<d){d=x;best=t;}}
 trial.gunTarget=best;return best;
}
// ---- point defence ----
// Point-defence batteries leave ships to the main guns: each picks the nearest
// missile or small craft inside its range and arc (missiles first) and fires on
// its own. On a trial flight, target drones make passes at the ship.
const TRIAL_PD={range:6000,drones:4,speed:260,turn:1.15,pKill:{missile:.5,craft:.3},radius:{missile:30,craft:70}};
const trialPdColor=()=>trial.asset?.geometry?.paint==='republic'||trial.asset?.geometry?.reference==='venator'?[150,200,255]:[160,255,160];
// Only threats near enough to matter: a battle can put thousands of craft in the system.
function trialThreats(all){const out=[],P=trial.P,R=TRIAL_PD.range+(trial.p?.len||0),R2=all?Infinity:R*R;for(const l of [trial.drones,trial.foeCraft,trial.foeMissiles])for(const q of l||[]){if(!q.alive)continue;const x=q.pos[0]-P[0],y=q.pos[1]-P[1],z=q.pos[2]-P[2];if(x*x+y*y+z*z<R2)out.push(q);}return out;}
function trialPdPick(t,oW,threats){
 if(!threats.length||t.dead)return null;const lim=trialLimits(t),R=trial.R,base=tv.add(trial.P,oW);
 const reach=q=>{if(!q.alive)return -1;const rel=tv.sub(q.pos,base),d=tv.len(rel);if(d>TRIAL_PD.range)return -1;const dl=trialApplyT(R,tv.scale(rel,1/Math.max(1,d))),el=Math.asin(C.clamp(tv.dot(dl,t.axis),-1,1));if(el<lim.lo-.02||el>lim.hi+.02)return -1;if(lim.yaw!=null&&Math.abs(Math.atan2(tv.dot(dl,t.e2),tv.dot(dl,t.fw)))>lim.yaw)return -1;return d;};
 if(t.pdTarget&&reach(t.pdTarget)>=0)return t.pdTarget;
 let best=null,score=Infinity;for(const q of threats){const d=reach(q);if(d<0)continue;const s=d*(q.kind==='missile'?.5:1);if(s<score){score=s;best=q;}}
 return best;
}
function trialPdBoltHit(b){
 const q=b.target;if(!q||!q.alive||b.life<=0)return;const seg=tv.sub(b.pos,b.prev),l2=tv.dot(seg,seg)||1,k=C.clamp(tv.dot(tv.sub(q.pos,b.prev),seg)/l2,0,1),p=tv.add(b.prev,seg,k);
 if(tv.len(tv.sub(p,q.pos))>(TRIAL_PD.radius[q.kind]||40))return;b.life=0;
 if(Math.random()<(TRIAL_PD.pKill[q.kind]||.2))trialThreatDown(q,p);else trial.fx.push({pos:p,vel:q.vel,life:.15,max:.15,size:12,col:[255,220,160]});
}
function trialThreatDown(q,p){
 q.alive=false;q.respawn=6;trial.gun.pdKills=(trial.gun.pdKills||0)+1;if(q.onDown)q.onDown(q);const L=q.kind==='missile'?14:30;
 trial.fx.push({pos:p,vel:q.vel,life:.4,max:.4,size:L*2.4,col:[255,240,210]});sndAt(q.kind==='missile'?'explosion_small':sndPick('explosion_fighter','explosion_small'),p,{gain:.6});
 for(let k=0;k<(q.kind==='missile'?6:14);k++)trial.fx.push({pos:p,vel:tv.add(q.vel,tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),40+Math.random()*120),life:.7,max:.7,size:L*.5,col:[255,170+(Math.random()*60|0),80]});
}
// Target drones alternate between a stand-off point 7–10 km out and a pass
// close down the ship's side; the points ride with the ship.
function trialDroneSpawn(i){
 const P=trial.P,up=tv.norm(P),f=trialCol(trial.R,0),r=tv.norm(tv.cross(f,up)),a=Math.random()*Math.PI*2,d=8000+Math.random()*3000;
 const pos=tv.add(tv.add(tv.add(P,f,Math.cos(a)*d),r,Math.sin(a)*d),up,(Math.random()-.5)*2400);
 return {id:'drone'+i,kind:'craft',pos,vel:[...trial.V],h:tv.norm(tv.sub(P,pos)),alive:true,run:false,way:null,wayT:0,respawn:0};
}
function trialDronesStep(dt){
 if(trial.mode!=='trial'||!trial.p||trial.pat){trial.drones=[];return;}const ds=trial.drones||(trial.drones=[]);
 while(ds.length<TRIAL_PD.drones)ds.push(trialDroneSpawn(ds.length));
 const P=trial.P,up=tv.norm(P),f=trialCol(trial.R,0),r=tv.norm(tv.cross(f,up)),L=trial.p.len,W=trial.p.width||L*.5,spd=Math.max(TRIAL_PD.speed,tv.len(trial.V)+220);
 for(let i=0;i<ds.length;i++){const d=ds[i];
  if(!d.alive){if((d.respawn-=dt)<=0)ds[i]=trialDroneSpawn(i);continue;}
  if(!d.way||(d.wayT-=dt)<=0||tv.len(tv.sub(tv.add(P,d.way),d.pos))<350){d.run=!d.run;
   if(d.run){const s=Math.random()<.5?-1:1;d.way=tv.add(tv.add(tv.scale(f,(Math.random()-.5)*L*1.2),r,s*(W*.5+400+Math.random()*700)),up,(Math.random()-.3)*L*.25);d.wayT=40;}
   else{const a=Math.random()*Math.PI*2,e=(Math.random()-.5)*.6;d.way=tv.add(tv.add(tv.scale(f,Math.cos(a)*8500),r,Math.sin(a)*8500),up,Math.sin(e)*4000);d.wayT=45;}}
  const want=tv.norm(tv.sub(tv.add(P,d.way),d.pos)),c=C.clamp(tv.dot(d.h,want),-1,1),ang=Math.acos(c);
  if(ang>1e-4){const ax=tv.cross(d.h,want),l=tv.len(ax);if(l>1e-9)d.h=tv.norm(trialRot(d.h,tv.scale(ax,1/l),Math.min(ang,TRIAL_PD.turn*dt)));}
  d.vel=tv.scale(d.h,spd);d.pos=tv.add(d.pos,d.vel,dt);
 }
}
// Weapons fire from stored energy (the turrets' charging banks); each volley
// draws its own charge. The reactor refills the store with whatever the power
// distribution leaves after the hotel load, shields and engines, so a ship at
// rest fires faster than one under full thrust. Weapon priority starves the
// engines instead; driving the reactor harder raises the core load.
function trialPowerStep(dt,want){
 const p=trial.p,g=p?.grid,en=trial.energy;if(!en)return;
 // A profile from before the power model keeps the old unlimited behaviour; a ship without a reactor never recharges.
 if(!g){en.E=en.cap;trial.engF=1;trial.power={load:0,engF:1,got:null,P:0};return;}if(!(g.P>0)){trial.engF=0;trial.power={load:0,engF:0,got:null,P:0};return;}
 const mode=trial.powerMode||'balanced',M=C.POWER_MODES[mode]||C.POWER_MODES.balanced;
 // In a battle the flagship's surviving reactors, generators, engines and guns set what can be fed.
 const me=trial.battle?.me,sx=me?C.fleetSystems(me):null,k=x=>sx?sx[x]:1,regen=!!me&&(me.shield<me.shieldMax*.999||me.underFire||(me.bank||0)<(me.bankMax||0)*.999),cap=en.cap*k('weapon');
 const Pr=g.P*k('reactor')*(1-C.COMBAT.ionReactor*(me?.ionK||0))*(me?C.swPower(me):trialSwPowerK()),full=Math.min(Pr*C.COMBAT.engineCap,g.De*C.COMBAT.engineDraw)*k('engine');
 const demand={engines:full*(.06+.94*(trial.thrustWant||0)),shields:g.Ds*k('shield')*(regen?M.shields:1),weapons:Math.min(g.Dw*k('weapon')*M.weapons,want+Math.max(0,cap-en.E)*TT_J/Math.max(dt,1e-3))};
 if(me?.ionDrained){en.E=Math.max(0,en.E-me.ionDrained);me.ionDrained=0;}
 const P=Pr,got=C.powerSplit(P,g.fixed,demand,mode);en.E=Math.min(cap,en.E+got.weapons*dt/TT_J);
 if(me){me.load=P>0?got.load:0;const nom=g.Ds*k('shield');me.shF=nom>0?got.shields/nom:0;me.pw={P,eng:got.engines,sh:got.shields,wpn:got.weapons,wantEng:demand.engines,wantSh:demand.shields,wantWpn:demand.weapons};}
 trial.engF=demand.engines>0?C.clamp(got.engines/demand.engines,0,1):1;trial.power={load:got.load,engF:trial.engF,got,demand,P:g.P,mode};
}
const TT_J=4.184e21;
// v20.6 How the main batteries fire: continuously (each gun as soon as it is loaded and laid) or in
// salvos. In a salvo the guns of one kind that bear on the target (a battery) wait until all of them
// are loaded and laid, then fire together; a gun is not kept waiting more than about half a cycle for
// one that cannot come on. Returns the guns to fire this frame (null: continuous fire).
function trialSalvoPlan(dt){
 if(trial.volley!=='salvo')return null;const bats=new Map(),W=trial.salvoWait||(trial.salvoWait={}),go=new Set();
 for(const t of trial.turrets){if(t.pd||t.dead||!t.firing||t.held)continue;let b=bats.get(t.k);if(!b)bats.set(t.k,b=[]);b.push(t);}
 for(const k of Object.keys(W))if(!bats.has(k))delete W[k];
 for(const [k,b] of bats){const rdy=b.filter(t=>t.laid&&t.reload<=0);if(!rdy.length){W[k]=0;continue;}W[k]=(W[k]||0)+dt;
  if(rdy.length===b.length||W[k]>Math.max(...b.map(t=>t.cycle))*.6){for(const t of rdy)go.add(t);W[k]=0;}}
 return go;
}
function trialVolley(k){const m=k||(trial.volley==='salvo'?'stream':'salvo');trial.volley=m;const me=trial.battle?.me;if(me)me.order={...me.order,volley:m};toast(m==='salvo'?'射撃：斉射 — 同じ種類の主砲がそろって撃ちます':'射撃：連続射撃 — 各砲が装填しだい撃ちます');}
function trialGunnery(dt){
 const a=trial.aim=trialAim();if(!a)return;trialDronesStep(dt);const R=trial.R,center=trial.asset.geometry.center,me=trial.battle?.me,wantFire=(trial.fire||trial.fireKey||trial.fireTap>0)&&!trial.jump&&!me?.dead&&!me?.out&&!me?.jump;trial.fireTap=Math.max(0,trial.fireTap-dt);
 const color=trial.asset.geometry.reference==='venator'||trial.asset.geometry.paint==='republic'?[120,175,255]:[95,255,120],spd=TRIAL_GUN.boltSpeed;
 // Main batteries follow the gun mode; point defence keeps to its own threats.
 const mode=trial.gunMode||'free',home=mode==='home',lock=home?null:mode==='enemy'?trialGunTarget(a.lock):a.lock;trial.heldLock=mode==='enemy'?lock:null;
 const u=lock?tv.sub(lock.vel,trial.V):null,lockRel=lock?tv.sub(lock.pos,trial.P):null;
 // Lead for the ship's centre (HUD marker); each turret solves its own below.
 trial.lead=null;if(lock){const t=trialIntercept(lockRel,u,spd);if(t)trial.lead=tv.add(lockRel,u,t);}
 let demand=0;const threats=trialThreats();
 for(const t of trial.turrets){
  const oW=trialApply(R,tv.sub(t.origin,center)),lim=trialLimits(t);let ty=0,te=0;t.arc=true;t.pdTarget=null;
  if(t.pd){const q=trialPdPick(t,oW,threats);if(q){t.pdTarget=q;const rel=tv.sub(q.pos,trial.P),uv=tv.sub(q.vel,trial.V),tt=trialIntercept(tv.sub(rel,oW),uv,spd),aimW=tt?tv.add(rel,uv,tt):rel,dl=trialApplyT(R,tv.norm(tv.sub(aimW,oW)));ty=Math.atan2(tv.dot(dl,t.e2),tv.dot(dl,t.fw));te=Math.asin(C.clamp(tv.dot(dl,t.axis),-1,1));}}
  else if(!home){let aimW=a.point;
   if(lock){const tt=trialIntercept(tv.sub(lockRel,oW),u,spd);if(tt)aimW=tv.add(lockRel,u,tt);}
   const dl=trialApplyT(R,tv.norm(tv.sub(aimW,oW)));ty=Math.atan2(tv.dot(dl,t.e2),tv.dot(dl,t.fw));te=Math.asin(C.clamp(tv.dot(dl,t.axis),-1,1));}
  if(lim.yaw!=null&&Math.abs(ty)>lim.yaw){ty=Math.sign(ty)*lim.yaw;t.arc=false;}if(te<lim.lo||te>lim.hi){te=C.clamp(te,lim.lo,lim.hi);t.arc=false;}
  if(t.pd&&!t.pdTarget)t.arc=false;
  const sy=t.rateRad*dt,dy=trialWrap(ty-t.yaw);t.yaw=trialWrap(t.yaw+C.clamp(dy,-sy,sy));const se=t.rateRad*1.5*dt;t.el+=C.clamp(te-t.el,-se,se);
  if(t.mesh)trialAxisMatrix(t.axis,t.yaw,t.rot);
  const err=Math.max(Math.abs(trialWrap(ty-t.yaw)),Math.abs(te-t.el));t.aimed=t.arc&&err<.018;t.laid=t.arc&&err<.005;
  // Point defence slews fast after small targets, so it accepts an older line-of-fire check.
  const bd=trialBarrel(t,t.yaw,t.el),ok=t.clear&&t.clearDir&&tv.dot(bd,t.clearDir)>(t.pd?.995:.9986);t.ready=(t.pd?t.arc&&Math.max(Math.abs(trialWrap(ty-t.yaw)),Math.abs(te-t.el))<.03:t.aimed)&&ok&&t.charge>0&&!t.dead;
  // Point defence fires on its own at the threat it is tracking.
  t.firing=(t.pd?!!t.pdTarget&&!trial.jump&&!me?.dead&&!me?.out&&!(trial.battle?.result):wantFire)&&t.ready;if(t.firing)demand+=t.power*t.charge*(t.costK??1);t.bd=bd;t.oW=oW;
 }
 trialPowerStep(dt,demand);const en=trial.energy;let held=0;
 for(const t of trial.turrets){
  t.reload=Math.max(0,t.reload-dt);t.starved=false;
  // A main battery holds its fire while one of our own ships is across its line.
  if(t.firing&&!t.pd&&trial.battle){t.held=!!trialAllyOnLine(tv.add(trial.P,t.oW),trialApply(R,t.bd),Math.max(t.reach||TRIAL_GUN.range,trial.p.len*2));if(t.held)held++;}else t.held=false;}
 // v20.6 Salvo fire: the guns of each battery wait for one another and fire together.
 const salvo=trialSalvoPlan(dt);
 for(const t of trial.turrets){
  if(t.held||salvo&&!t.pd&&!salvo.has(t))continue;
  if(t.firing&&(t.laid||t.pd)&&t.reload<=0){
   const shotTT=t.power*t.cycle*t.charge/TT_J,cost=shotTT*(t.costK??1);if(en.E<cost){t.starved=true;continue;}en.E-=cost;
   t.reload=t.cycle*(1+Math.random()*(salvo&&!t.pd?.01:.08));const bd=t.bd,n=Math.min(t.barrels,t.r>12?2:t.barrels>2?2:1),sc=t.pd?.009:.0012,g=()=>(Math.random()+Math.random()+Math.random()-1.5)*sc,bw=trialApply(R,tv.norm(tv.add(tv.add(bd,t.e2,g()),t.axis,g()))),side=trialApply(R,tv.norm(tv.cross(t.axis,bd))),base=tv.add(tv.add(trial.P,t.oW),bw,t.r*1.2),spread=t.r*.35;
   if(t.pd){sndAt('point_defense',base,{gain:.45});trial.gun.pd=(trial.gun.pd||0)+t.barrels;for(let i=0;i<n;i++){const off=n>1?(i/(n-1)-.5)*spread:0,pos=tv.add(base,side,off);trial.bolts.push({pos,prev:pos,vel:tv.add(tv.scale(bw,spd),trial.V),life:TRIAL_PD.range*1.15/spd,len:Math.max(40,t.r*6),size:Math.max(3,t.r*.45),col:trialPdColor(),weight:0,tt:0,pd:true,target:t.pdTarget});}continue;}
   trial.gun.shots+=t.barrels;
   sndAt(sndGun(t),base,{gain:.85,near:2500});
   for(let i=0;i<n;i++){const off=n>1?(i/(n-1)-.5)*spread:0,pos=tv.add(base,side,off);trial.bolts.push({pos,prev:pos,vel:tv.add(tv.scale(bw,spd),trial.V),life:Math.max(t.reach||TRIAL_GUN.range,trial.p.len*(t.band==='close'?1.2:3))/spd,len:Math.max(70,t.r*9),size:Math.max(5,t.r*.9),col:t.ion?[170,215,255]:color,weight:t.barrels/n,tt:shotTT/n,ion:!!t.ion});}
   trial.fx.push({pos:base,vel:trial.V,life:.12,max:.12,size:Math.max(6,t.r*1.6),col:[255,240,210]});
  }
 }
 escortsFire(dt,lock||a.lock,wantFire);
 if(trial.bolts.length>TRIAL_GUN.maxBolts)trial.bolts.splice(0,trial.bolts.length-TRIAL_GUN.maxBolts);
 trial.held=held;if(held&&!trial.warn)trial.warn=`味方艦が射線上：主砲 ${held} 基が射撃を控えています`;
 trialMissiles(dt,mode==='enemy'?lock:a.lock);
 const Rt=trial.asset.geometry.targetRadius,hitTarget=(t,q,w,esc)=>{if(esc)trial.gun.escHits=(trial.gun.escHits||0)+w;else trial.gun.hits+=w;t.hits+=w;
   for(let k=0;k<6;k++)trial.fx.push({pos:q,vel:tv.add(t.vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),40+Math.random()*120)),life:.5,max:.5,size:Rt*.18,col:[255,200,120]});
   if(t.hits>=TRIAL_GUN.hitsToKill){t.alive=false;t.respawn=4;trial.gun.kills++;sndAt('explosion_small',t.pos);for(let k=0;k<46;k++)trial.fx.push({pos:t.pos,vel:tv.add(t.vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),Rt*(.6+Math.random()*2.2))),life:1.6,max:1.6,size:Rt*(.25+Math.random()*.4),col:[255,170+Math.random()*60|0,90]});trial.fx.push({pos:t.pos,vel:t.vel,life:.5,max:.5,size:Rt*4,col:[255,245,220]});}};
 const segHit=(t,a0,a1)=>{const seg=tv.sub(a1,a0),l2=tv.dot(seg,seg)||1,k=C.clamp(tv.dot(tv.sub(t.pos,a0),seg)/l2,0,1),q=tv.add(a0,seg,k);return tv.len(tv.sub(q,t.pos))<Rt?q:null;};
 // Ships are ellipsoids of their own length, height and width.
 const segShip=(t,a0,a1)=>{const s=t.semi,la=trialApplyT(t.rot,tv.sub(a0,t.pos)),lb=trialApplyT(t.rot,tv.sub(a1,t.pos)),pa=[la[0]/s[0],la[1]/s[1],la[2]/s[2]],pb=[lb[0]/s[0],lb[1]/s[1],lb[2]/s[2]],d=tv.sub(pb,pa),l2=tv.dot(d,d)||1,k=C.clamp(-tv.dot(pa,d)/l2,0,1);return tv.len(tv.add(pa,d,k))<1?tv.add(a0,tv.sub(a1,a0),k):null;};
 const shipHit=(t,q,tt,kind,w)=>{if(t.ally){trial.gun.ff=(trial.gun.ff||0)+w;if(performance.now()-(trial.ffToast||0)>4000){trial.ffToast=performance.now();toast(`誤射：味方艦 ${esc(shipShort(t.unit.name))} に命中`);}}else{trial.gun.hits+=w;t.hits+=w;}spaceDamage(t.unit,tt,kind,q,t);spaceImpact(q,t.vel,t.unit,Math.max(8,t.radius*.05));};
 for(const b of trial.bolts){b.prev=b.pos;b.pos=tv.add(b.pos,b.vel,dt);b.life-=dt;
  if(b.pd){trialPdBoltHit(b);continue;}
  if(!b.esc&&trial.escorts?.length){let hitE=null;for(const e of trial.escorts){const sd=tv.sub(b.pos,b.prev),l=tv.len(sd);if(l>0&&trialBoxOnLine({pos:e.pos,rot:e.R,radius:e.p.len*.5,semi:[e.p.len*.5,(e.p.height||e.p.len*.2)*.5,(e.p.width||e.p.len*.5)*.5]},b.prev,tv.scale(sd,1/l),l,1)){hitE=e;break;}}if(hitE){b.life=0;spaceImpact(b.pos,hitE.V,{shield:1},10);if(performance.now()-(trial.ffToast||0)>4000){trial.ffToast=performance.now();toast(`誤射：随伴艦 ${esc(hitE.name)} に命中`);}continue;}}
  for(const t of trial.targets){if(!t.alive||b.life<=0)continue;if(t.ship){const q=segShip(t,b.prev,b.pos);if(q){b.life=0;shipHit(t,q,b.tt||0,b.ion?'ion':'bolt',b.weight);}continue;}const q=segHit(t,b.prev,b.pos);if(q){b.life=0;hitTarget(t,q,b.weight,b.esc);}}}
 for(const m of trial.missiles)for(const t of trial.targets){if(!t.alive||m.life<=0)continue;if(t.ship){const q=segShip(t,m.prev,m.pos);if(q){m.life=0;shipHit(t,q,10,'missile',m.weight);}continue;}const q=segHit(t,m.prev,m.pos);if(q){m.life=0;hitTarget(t,q,m.weight);for(let k=0;k<10;k++)trial.fx.push({pos:q,vel:tv.add(t.vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),60+Math.random()*200)),life:.8,max:.8,size:Rt*.3,col:[255,150,70]});}}
 trial.bolts=trial.bolts.filter(b=>b.life>0);trial.missiles=trial.missiles.filter(m=>{if(m.life<=0&&!m.burst){m.burst=true;}return m.life>0;});
 for(const t of trial.targets){if(t.ship)continue;if(t.alive){t.pos=tv.add(t.pos,t.vel,dt);t.spin+=dt*(t.ionT>0?0:.3);const up=tv.norm(t.pos);t.rot=trialAxisMatrix(up,t.spin,t.rot);t.rot=trialFrame(trialApply(t.rot,[1,0,0]),up);}else if((t.respawn-=dt)<=0)Object.assign(t,trialSpawnTarget(t.id,false));}
 const due=performance.now();if(!trial.rays.busy&&due-trial.rays.last>140&&trial.turrets.length)trialRays(due);
}
// Missiles leave their tubes along the mounting axis, then home on the locked
// target with a limited turn rate; without a lock they fly down the reticle.
const TRIAL_MSL={launch:220,speed:2600,accel:650,turn:40*Math.PI/180,life:30,ripple:.14};
function trialMissiles(dt,lock){
 const R=trial.R,center=trial.asset.geometry.center;
 if(trial.mslOrder){trial.mslOrder=false;let n=0;for(const l of trial.launchers)if(l.reload<=0&&!l.dead&&spaceAmmo(l)){l.queue=l.salvo;l.reload=l.cycle;n++;}if(!n&&trial.launchers.length)toast(trial.launchers.every(l=>l.dead)?'ミサイル発射管はすべて破壊されています':'ミサイルは装填中か残弾がありません');}
 for(const l of trial.launchers){l.reload=Math.max(0,l.reload-dt);if(l.queue>0&&(l.next-=dt)<=0){l.queue--;l.next=TRIAL_MSL.ripple;
  const ax=trialApply(R,l.axis),pos=tv.add(trial.P,trialApply(R,tv.sub(l.origin,center))),jit=tv.norm(tv.add(ax,tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),.12));
  trial.missiles.push({pos,prev:pos,base:[...trial.V],h:jit,s:TRIAL_MSL.launch,life:TRIAL_MSL.life,target:lock||null,dir:trial.aim?trial.aim.dir:ax,weight:1,trail:0,boost:.6});
  trial.fx.push({pos,vel:trial.V,life:.25,max:.25,size:14,col:[255,210,150]});trial.gun.missiles=(trial.gun.missiles||0)+1;sndAt('missile',pos,{gain:.8});}}
 for(const m of trial.missiles){
  m.prev=m.pos;m.boost-=dt;
  let want=m.dir;if(m.target&&m.target.alive&&m.boost<=0){const t=m.target,rel=tv.sub(t.pos,m.pos),vrel=tv.sub(t.vel,m.base),tgo=tv.len(rel)/Math.max(300,m.s);want=tv.norm(tv.add(rel,vrel,tgo));}
  if(m.boost<=0){const c=C.clamp(tv.dot(m.h,want),-1,1),ang=Math.acos(c),maxA=TRIAL_MSL.turn*dt;if(ang>1e-5){const ax=tv.cross(m.h,want),l=tv.len(ax);if(l>1e-9)m.h=tv.norm(trialRot(m.h,tv.scale(ax,1/l),Math.min(ang,maxA)));}}
  m.s=Math.min(TRIAL_MSL.speed,m.s+TRIAL_MSL.accel*dt);m.pos=tv.add(m.pos,tv.add(m.base,m.h,m.s),dt);m.life-=dt;
  if((m.trail-=dt)<=0){m.trail=.05;trial.fx.push({pos:m.pos,vel:m.base,life:.9,max:.9,size:9,col:[150,160,175]});}
 }
 trial.missiles=trial.missiles.filter(m=>m.life>0);
}
// The engine tests each barrel direction against the hull, structures and
// other fittings; firing waits for a clear answer for the current direction.
function trialRays(now){
 const ts=trial.turrets,ids=new Int32Array(ts.length),dirs=new Float32Array(ts.length*3),sent=ts.map(t=>trialBarrel(t,t.yaw,t.el));
 ts.forEach((t,i)=>{ids[i]=t.id;dirs.set(sent[i],i*3);});trial.rays.busy=true;trial.rays.last=now;const asset=trial.asset;
 YardEngineClient.request('trialRays',{ids:Array.from(ids),dirs:Array.from(dirs)}).then(r=>{if(trial.asset!==asset)return;const c=r.clear||[];ts.forEach((t,i)=>{t.clear=!!c[i];t.clearDir=sent[i];});}).catch(()=>{}).finally(()=>{trial.rays.busy=false;});
}
function trialRenderSets(){
 // (v21.2 with the small craft's guns and the point defence firing at them: trial.cbolts)
 const b=trial.vbolts?.length||trial.cbolts?.length?[...trial.bolts,...(trial.vbolts||[]).filter(x=>!(x.delay>0)),...(trial.cbolts||[])]:trial.bolts,P=trial.P,K=7,pos=new Float32Array(b.length*K*3),col=new Uint8Array(b.length*K*4),size=new Float32Array(b.length*K);
 b.forEach((q,i)=>{const d=tv.norm(q.vel);for(let k=0;k<K;k++){const j=i*K+k,s=k/(K-1),p=tv.add(tv.sub(q.pos,P),d,-q.len*s);pos.set(p,j*3);col.set([q.col[0],q.col[1],q.col[2],Math.round(235*(1-s*.7))],j*4);size[j]=q.size*(1-s*.55);}});
 view.setPoints('trialBolts',pos,col,size);
 const now=performance.now()/1000,swDt=trial.swAt?Math.min(.1,now-trial.swAt):0;trial.swAt=now;
 const fires=[...(trial.battle?spaceFires(now):[]),...swFxPoints(trial.paused?0:swDt),...trialSwArcPoints()],f=trial.fx,ms0=trial.missiles,nf=f.length+ms0.length*2+fires.length,fp=new Float32Array(nf*3),fc=new Uint8Array(nf*4),fs=new Float32Array(nf);
 fires.forEach((q,j)=>{const i=f.length+ms0.length*2+j;fp.set(q[0],i*3);fc.set(q[1],i*4);fs[i]=q[2];});
 f.forEach((e,i)=>{const k=e.life/e.max;fp.set(tv.sub(e.pos,P),i*3);fc.set([e.col[0],e.col[1],e.col[2],Math.round(255*Math.min(1,k*1.4)*(e.col[0]===150?.45:1))],i*4);fs[i]=e.size*(e.max>1?1.4-k*.6:e.col[0]===150?1.6-k*.8:1);});
 ms0.forEach((m,j)=>{const i=f.length+j*2;fp.set(tv.sub(m.pos,P),i*3);fc.set([255,235,190,255],i*4);fs[i]=7;fp.set(tv.add(tv.sub(m.pos,P),m.h,-14),i*3+3);fc.set([255,140,60,220],i*4+4);fs[i+1]=12;});
 view.setPoints('trialFx',fp,fc,fs);
 // Small craft and incoming missiles: a hull point and an engine glow behind it.
 // (v21.2 craft drawn as their 3D models have no point; craft shot down fly on until the bolt that got them arrives)
 const all=[...trialThreats(true),...(trial.ownCraft||[])],crafts=[...all.filter(q=>!q.model),...(trial.craftGhosts||[])],cp=new Float32Array(crafts.length*6),cc=new Uint8Array(crafts.length*8),cs=new Float32Array(crafts.length*2);
 sndFlyby(all,P);crafts.forEach((q,i)=>{const h=q.h||tv.norm(q.vel),m=q.kind==='missile',body=tv.sub(q.pos,P);cp.set(body,i*6);cp.set(tv.add(body,h,m?-9:-7),i*6+3);cc.set(m?[255,225,190,255]:q.team===0?[205,230,255,255]:[225,228,232,255],i*8);cc.set(m?[255,120,60,230]:q.glow||[255,110,80,230],i*8+4);cs[i*2]=m?6:q.size||10;cs[i*2+1]=m?11:(q.size||10)*.8;});
 view.setPoints('trialCraft',cp,cc,cs);
}
// The turret status runs along the bottom edge between the throttle pad and the
// fire buttons. When it is too long for that band it switches to short labels,
// then wraps onto two lines; only where no band is wide enough (a phone held
// upright) does it go above the pad, and never into the middle of the screen,
// where it would cover the reticle: then it moves under the top bar instead.
let trialGunsLaidAt=0;
function trialGunsLayout(hud,gn,force){
 const now=performance.now();if(!force&&now-trialGunsLaidAt<400)return;trialGunsLaidAt=now;
 const hr=hud.getBoundingClientRect(),box=s=>{const e=hud.querySelector(s);if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return r.width?r:null;};
 const pad=box('.th-pad'),right=[box('.th-fire'),box('.th-msl'),box('.th-sw'),box('.th-swmode')].filter(Boolean),keys=box('.th-keys'),top=box('.th-top');if(!pad||!hr.width)return;
 const lo=pad.right+10,hi=(right.length?Math.min(...right.map(r=>r.left)):hr.right)-10,gap=hi-lo;
 const fit=(compact,wrap)=>{gn.classList.toggle('compact',compact);Object.assign(gn.style,{width:wrap?Math.floor(wrap)+'px':'auto',maxWidth:'none',whiteSpace:wrap?'normal':'nowrap',flexWrap:wrap?'wrap':'nowrap'});return {w:gn.offsetWidth,h:gn.offsetHeight};};
 let m=fit(false,0),band=m.w<=gap;
 if(!band){m=fit(true,0);band=m.w<=gap;}
 if(!band&&gap>=170){m=fit(true,gap);band=m.h<=Math.max(44,pad.height*.6);}
 let x,bottom;const cy=hr.top+hr.height/2,clear=74;
 if(band){x=C.clamp(hr.left+hr.width/2,lo+m.w/2,hi-m.w/2);bottom=hr.bottom-pad.bottom+4;if(keys&&keys.left<x+m.w/2&&keys.right>x-m.w/2)bottom=hr.bottom-keys.top+6;}
 else{const wide=Math.min(hr.width-24,420);m=fit(true,wide);x=hr.left+hr.width/2;bottom=hr.bottom-pad.top+8;
  // Above the pad would reach the reticle: sit under the top bar instead.
  if(hr.bottom-bottom-m.h<cy+clear){const y=(top?top.bottom:hr.top+60)+6;bottom=hr.bottom-y-m.h;}}
 Object.assign(gn.style,{top:'auto',left:(x-hr.left).toFixed(0)+'px',bottom:bottom.toFixed(0)+'px'});
}
function trialCamera(dt){
 const a=trialAttitude();let F;
 if(trial.camMode==='ship')F=trial.R;
 else{let fh=tv.add(a.f,a.up,-tv.dot(a.f,a.up));if(tv.len(fh)<.25&&trial.camF){const old=trialCol(trial.camF,0);fh=tv.add(old,a.up,-tv.dot(old,a.up));}F=trialFrame(fh,a.up);}
 // While coasting out of the system and in the tunnel the camera keeps the frame it had.
 if(!trial.camF)trial.camF=[...F];else if(trialFast()||trial.jump?.phase==='tunnel'||(trial.spectate&&trial.specCam==='free')){}else{const k=1-Math.exp(-dt*4),x=tv.add(trialCol(trial.camF,0),tv.add(trialCol(F,0),trialCol(trial.camF,0),-1),k),y=tv.add(trialCol(trial.camF,1),tv.add(trialCol(F,1),trialCol(trial.camF,1),-1),k);trial.camF=trialFrame(x,y);}
 const c=view.cam;c.frame=trial.camF;c.ortho=false;
 // Joining a battle: the view turns once toward the nearest enemy.
 if(trial.lookAt){const t=trial.lookAt;trial.lookAt=null;const d=tv.norm(tv.sub(spaceWorld(t),trial.P)),loc=trialApplyT(trial.camF,d);c.ph=Math.acos(C.clamp(-loc[1],-1,1));c.th=Math.atan2(-loc[2],-loc[0]);}
 c.r=trialCamRange(c.r);c.ph=C.clamp(c.ph,.12,2.9);c.far=Math.max(90000,trial.p.len*30);const up=trialCol(trial.camF,1);c.target=tv.scale(up,c.r*TRIAL_CAM_LIFT);
 const k=trial.cine;if(k){const us=(trial.battle?.b.units||[]).filter(u=>k.ids.includes(u.id)&&!u.dead);if(!us.length)spaceCineEnd();else{const cw=us.reduce((a,u)=>tv.add(a,spaceWorld(u),1/us.length),[0,0,0]),loc=trialApplyT(trial.camF,k.dirW);c.target=tv.add(tv.sub(cw,trial.P),k.lead,-k.L*.6);c.r=k.r;c.ph=Math.acos(C.clamp(loc[1],-1,1));c.th=Math.atan2(loc[2],loc[0]);c.far=Math.max(c.far,k.r*14);}}
}
function trialLoop(now){
 // Paused, only the camera moves (for screenshots); the world and its clock stand still.
 const real=trial.last?Math.min(.05,(now-trial.last)/1000):0,dt=trial.paused?0:real;trial.last=now;
 if(trial.cine){trial.cine.t+=dt;if(trial.cine.t>=trial.cine.dur||trial.fire||trial.fireKey)spaceCineEnd();}
 trialCamera(real||.016);trialJumpStep(dt);
 // In hyperspace the ship holds still in the tunnel; in a flight everything
 // else waits, while a fleet battle watched in 3D runs on (the far end of the
 // tunnel is where the followed group comes out).
 const tunnel=trial.jump?.phase==='tunnel',ph=trial.jump?.phase;
 if(dt>0){escortsStep(dt);if(trial.spectate)voySpectateStep(dt);else if(!tunnel){if(trialCoasting())trialSublight(dt);else if(ph==='exit'||ph==='brake'){}else{const n=dt>.025?2:1;for(let i=0;i<n;i++)trialStep(dt/n);}if(trial.rts)voyPilotStep(dt);else if(trial.battle)spaceStep(dt);}if(!tunnel){spaceBolts(dt);trialFxStep(dt);trialWrecksStep(dt);trialSwSoloStep(dt);}}
 if(trial.battle&&!tunnel){spaceAttStep(dt);spaceDeaths();trialSwBeamCheck();}
 if(trial.pat)patrolStep(dt,tunnel);
 trial.flash=Math.max(0,(trial.flash||0)-dt*2.2);trial.hitFlash=Math.max(0,(trial.hitFlash||0)-dt*1.6);
 const d=trial.dust;view.setPoints('trialDust',d.pos,d.col,d.size);trialRenderSets();
 const me=trial.battle?.me,unit={key:trial.asset.key,pos:[0,0,0],yaw:0,rot:trial.R,glow:me?.out?0:glowOf('me',C.clamp(Math.max(.16,.8*Math.abs(TRIAL_TELEGRAPH[trial.tele][1]),trial.thrust||0),0,1)),hatchOpen:0,dead:!!me?.dead,
  turrets:trial.turrets.filter(t=>t.mesh).map(t=>({mesh:t.mesh,pivot:t.pivot,rot:t.rot})),targets:trial.targets.filter(t=>t.alive&&!t.ship).map(t=>({pos:tv.sub(t.pos,trial.P),rot:t.rot}))};
 // The stars stretch around the direction of travel; the tunnel covers them.
 const j=trial.jump,dir=j?.dir||trialCol(trial.R,0),hk=trialTunnelK(j);
 const hyper=tunnel?{dir,time:j.t,k:hk}:null,sky={dir,s:trialStreak(),k:1};
 if(view.draw({fleet:trial.spectate?spaceDrawUnits():[unit,...escortsDraw(),...spaceDrawUnits(),...patrolDraw()],mode:'trial',lod:!!trial.battle,planet:hk>=1?null:trialPlanet(),hyper,sky,noDust:trialFast()||tunnel})!==false){renderHealth.frames++;renderHealth.lastFrame=now;renderHealth.failures=0;}
 trialAdaptScale(real);if(dt>0)shotTick(now);
 const hud=$('#trialHud'),fl=hud?.querySelector('[data-th="flash"]'),hf=hud?.querySelector('[data-th="hit"]');if(fl)fl.style.opacity=trial.flash.toFixed(3);if(hf)hf.style.opacity=(trial.hitFlash*.8).toFixed(3);
 trialMarkers();if(trial.battle)hitcamStep(now);
 if(now-trial.hud>120){trial.hud=now;if(trial.spectate)voySpectateHudUpdate();else trialHudUpdate();}
 if(trial.pat&&trial.hud===now)patrolHud();
}
// A busy battle that drops frames is drawn at a lower resolution, and the
// resolution comes back once the frame rate recovers.
function trialAdaptScale(real){
 if(!view||!(real>0))return;trial.frameMs=trial.frameMs?trial.frameMs*.92+real*1000*.08:real*1000;const now=performance.now();if(now-(trial.scaleAt||0)<1200)return;
 const rs=view.renderScale||1;if(trial.frameMs>40&&rs>.5){view.renderScale=Math.max(.5,rs-.15);trial.scaleAt=now;}else if(trial.frameMs<22&&rs<1){view.renderScale=Math.min(1,rs+.1);trial.scaleAt=now+1800;}
}
// Brackets over the target buoys and, in a battle, over every other ship (with
// its shield and hull bars), as in a naval HUD; off-screen ones are hidden.
const shipShort=n=>String(n||'').split('｜')[0];
function trialMarkers(){
 const hud=$('#trialHud'),box=hud?.querySelector('.th-tmarks');if(!box||!view)return;const rect=view.canvas.getBoundingClientRect(),hr=hud.getBoundingClientRect(),eye=view.eye(),B=trial.battle,items=[],seen=new Set();
 if(trial.jump?.phase!=='tunnel'&&!trial.jump?.follow){
  for(const t of trial.targets)if(t.alive&&!t.ship)items.push({id:'d'+t.id,pos:t.pos,cls:'',t});
  if(B&&!B.left)for(const u of B.b.units){if(u.manual||u.dead||u.absent||u.hidden||B.spectate&&u.id===B.follow)continue;items.push({id:'u'+u.id,pos:spaceWorld(u),cls:u.team?'foe':'ally',u,t:trial.targets.find(x=>x.unit===u)});}}
 if(trial.pat&&trial.jump?.phase!=='tunnel')patrolMarks(items);
 // Every bracket is drawn; the names go to the nearest and the marked ones
 // first, each on the right or else the left of its bracket, and a name that
 // would lie over another is left out (its bracket stays).
 const vis=[],follow=B?.spectate?B.follow:null,small=rect.width<720||rect.height<480,fs=small?9.5:11,maxLab=small?8:16;
 for(const it of items){let el=box.querySelector(`[data-tmark="${it.id}"]`);if(!el){el=document.createElement('div');el.className='th-tmark';el.dataset.tmark=it.id;el.innerHTML='<i></i><b></b><s><em class="sh"></em><em class="hp"></em></s>';box.append(el);}
  seen.add(it.id);const rel=tv.sub(it.pos,trial.P),q=view.project(rel),on=q[2]>-1&&q[2]<1&&q[0]>rect.left&&q[0]<rect.right&&q[1]>rect.top&&q[1]<rect.bottom;el.hidden=!on;if(!on)continue;
  const x=q[0]-hr.left,y=q[1]-hr.top,d=tv.len(tv.sub(rel,eye)),u=it.u,km=d/1000,dist=km<10?km.toFixed(1):Math.round(km)+'',lock=!!(it.t&&(trial.aim?.lock===it.t||trial.heldLock===it.t));
  const lab=it.lab?it.lab(dist):u?`${u.team?'敵':'友'} ${shipTag(u.name)} · ${dist} km${u.out?' · 戦闘不能':''}`:`標的 ${dist} km${it.t.hits?' · '+Math.round(it.t.hits/TRIAL_GUN.hitsToKill*100)+'%':''}`;
  vis.push({el,it,x,y,lab,lock,pri:lock||(u&&u.id===follow)?-1:d});}
 vis.sort((a,b)=>a.pri-b.pri);const placed=[],hit=r=>placed.some(p=>r[0]<p[2]&&r[2]>p[0]&&r[1]<p[3]&&r[3]>p[1]);let nLab=0;
 for(const v of vis){const {el,it,x,y,lab,lock}=v,u=it.u;el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  let side='';if(!lock){const w=Math.max(textWidthEst(lab,fs)+4,u?(small?48:64):0),top=y-7,bot=y+(u?12:7);const R=[x+15,top,x+15+w,bot],L=[x-15-w,top,x-15,bot];if(nLab>=maxLab)side=' nl';else if(!hit(R)){placed.push(R);nLab++;}else if(x-15-w>0&&!hit(L)){placed.push(L);nLab++;side=' lf';}else side=' nl';}
  placed.push([x-13,y-13,x+13,y+13]);
  const cls='th-tmark '+it.cls+(lock?' lock':'')+(u?.out?' out':'')+side+(trial.swInArc?.has(u||it.t)?' swin':'')+(!u&&it.t?.ionT>0?' ion':'');if(el.className!==cls)el.className=cls;
  const lb=el.querySelector('b');if(lb.textContent!==lab)lb.textContent=lab;
  if(u){const sh=el.querySelector('.sh'),hp=el.querySelector('.hp');sh.style.width=(u.shieldMax>0?C.clamp(u.shield/u.shieldMax,0,1)*100:0).toFixed(0)+'%';hp.style.width=(C.clamp(u.sec?Rts.unitStruct(u):u.hp/u.p.hp,0,1)*100).toFixed(0)+'%';}}
 for(const el of box.querySelectorAll('[data-tmark]'))if(!seen.has(el.dataset.tmark))el.hidden=true;
}
// A ship's name as a bracket label: the class without its type ("ドレッドノート級 8").
const shipTag=n=>shipShort(n).replace(/級[^\s\d]+(?=\s*\d)/,'級');
// Rough width of a line of HUD text (CJK a full em, the rest a little over half).
function textWidthEst(s,fs){let w=0;for(const ch of s){const c=ch.codePointAt(0);w+=c>0x2e80?fs:c===32?fs*.3:fs*.58;}return w;}
// ---- penetration replay: an X-ray of the struck ship (War Thunder style) ----
// A record from the combat model (C.combatResolve → u.hitLog) is replayed as a
// short animation: the shot comes in on the face it struck, meets the armour
// (its thickness, and whether it held), then runs through the modules behind
// it, each marked as it is damaged or wrecked; a fire or a detonation ends it.
const HITCAM_DUR=3.6,HITCAM_COL={magazine:'#ff7a50',reactor:'#ffb347',shield:'#6fe3ff',engine:'#7fb2ff',hyper:'#c49bff',hangar:'#8fd18a',battery:'#ffd966',fuel:'#ff8c5a',quarters:'#d8c8ab',bridge:'#ffffff',fire:'#f3e38a',capacitor:'#ffcf6b',weapon:'#b8c4cc',launcher:'#ff9f7a',other:'#8a96a0'};
const hitcamMasks=new WeakMap();
// The silhouette of a profile in one view as a small canvas (lit cells), or null.
function hitcamMask(p,view){
 let m=hitcamMasks.get(p);if(!m)hitcamMasks.set(p,m={});if(view in m)return m[view];
 const o=p.outline;if(!o){m[view]=null;return null;}const w=o.nx,h=view==='top'?o.nz:o.ny,bits=C.unpackBits(view==='top'?o.top:o.side,w*h);
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d'),img=g.createImageData(w,h);
 const on=(i,j)=>i>=0&&i<w&&j>=0&&j<h&&bits[j*w+i];
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(!bits[j*w+i])continue;const row=view==='top'?j:h-1-j,k=(row*w+i)*4,edge=!on(i-1,j)||!on(i+1,j)||!on(i,j-1)||!on(i,j+1);img.data[k]=edge?170:96;img.data[k+1]=edge?220:160;img.data[k+2]=edge?255:205;img.data[k+3]=edge?235:120;}
 g.putImageData(img,0,0);m[view]={cv,w,h,bits};return m[view];
}
// The first lit cell met coming in from one side of the mask (cell units), for the entry point.
function hitcamEdge(mk,view,f,at,cross){
 const {w,h,bits}=mk,lit=(i,j)=>i>=0&&i<w&&j>=0&&j<h&&bits[j*w+i];
 if(f===0||f===1){const j=Math.round(((cross+1)/2)*(h-1));for(let s=0;s<w;s++){const i=f===0?w-1-s:s;if(lit(i,j))return [i+(f===0?1:0),j+.5];}return [f===0?w:0,j+.5];}
 const i=Math.round(at*(w-1));
 if(view==='top'){for(let s=0;s<h;s++){const j=f===2?h-1-s:s;if(lit(i,j))return [i+.5,j+(f===2?1:0)];}return [i+.5,f===2?h:0];}
 for(let s=0;s<h;s++){const j=f===4?h-1-s:s;if(lit(i,j))return [i+.5,h-(j+(f===4?1:0))];}return [i+.5,f===4?0:h];
}
const hitcamEase=x=>x<0?0:x>1?1:x*x*(3-2*x);
// Draws record rec on target profile p into a 2D context at progress k (0…1).
function hitcamDraw(g,W,H,p,rec,k,o={}){
 g.clearRect(0,0,W,H);g.fillStyle='rgba(6,11,16,.9)';g.fillRect(0,0,W,H);g.strokeStyle='rgba(120,190,230,.35)';g.lineWidth=1;g.strokeRect(.5,.5,W-1,H-1);
 const f=rec.face,view=f>=4?'side':'top',mk=hitcamMask(p,view),fz=Math.max(9,Math.min(12,W/32)),font=`600 ${fz}px `+(getComputedStyle(document.body).fontFamily||'sans-serif');
 g.font=font;g.textBaseline='top';g.fillStyle='#9fd6ff';g.fillText(o.title||'被弾リプレイ',8,6);
 if(o.sub){g.fillStyle='#c9d3da';g.textAlign='right';g.fillText(o.sub,W-8,6);g.textAlign='left';}
 const top=fz+12,bot=fz*2+16,bw=W-24,bh=H-top-bot,asp=mk?mk.w/mk.h:(view==='top'?2.4:4),box=bw/bh>asp?{w:bh*asp,h:bh}:{w:bw,h:bw/asp};box.x=(W-box.w)/2;box.y=top+(bh-box.h)/2;
 const cuts=p.sectionCuts||[.2,.4,.6,.8],si=rec.sec,a0=si>0?cuts[si-1]:0,a1=si<cuts.length?cuts[si]:1;
 // Hull silhouette, the struck section lit.
 g.save();g.imageSmoothingEnabled=true;if(mk){g.globalAlpha=.55;g.drawImage(mk.cv,box.x,box.y,box.w,box.h);g.globalAlpha=1;g.save();g.beginPath();g.rect(box.x+a0*box.w,box.y-2,(a1-a0)*box.w,box.h+4);g.clip();g.globalAlpha=.55;g.drawImage(mk.cv,box.x,box.y,box.w,box.h);g.restore();}
 else{g.fillStyle='rgba(110,176,220,.35)';g.beginPath();g.ellipse(box.x+box.w/2,box.y+box.h/2,box.w/2,box.h/2,0,0,Math.PI*2);g.fill();}g.restore();
 g.strokeStyle='rgba(150,200,230,.22)';g.setLineDash([3,4]);for(const c of cuts){const x=box.x+c*box.w;g.beginPath();g.moveTo(x,box.y-3);g.lineTo(x,box.y+box.h+3);g.stroke();}g.setLineDash([]);
 g.fillStyle='rgba(160,200,225,.6)';g.font=`600 ${fz*.85}px `+font.split('px ')[1];g.fillText('艦首 ▶',box.x+box.w-fz*3.3,box.y+box.h+3);g.font=font;
 const P=(at,y,z)=>[box.x+at*box.w,view==='top'?box.y+(z+1)/2*box.h:box.y+(1-(y+1)/2)*box.h];
 // Every module faintly; the struck section's brighter.
 const mods=p.modules||[],hitIdx=new Map(rec.path.map((s,n)=>[s.i,n]));
 for(let i=0;i<mods.length;i++){const m=mods[i];if(m.k==='hull'||hitIdx.has(i))continue;const [x,y]=P(m.at??.5,m.y??0,m.z??0),r=Math.max(1.2,Math.min(8,(m.r||.004)*box.w)),inSec=(m.at??.5)>=a0&&(m.at??.5)<=a1;g.globalAlpha=inSec?.55:.22;g.fillStyle=HITCAM_COL[m.k]||HITCAM_COL.other;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
 g.globalAlpha=1;
 // The shot: from outside onto the face, then through the modules on its path.
 const first=rec.path[0],at0=first?.at??(a0+a1)/2,cross0=f===0||f===1?(view==='top'?first?.z??0:first?.y??0):0;
 const edge=mk?hitcamEdge(mk,view,f,at0,cross0):null,E=edge?[box.x+edge[0]/mk.w*box.w,box.y+edge[1]/mk.h*box.h]:P(at0,f===4?1:f===5?-1:0,f===2?1:f===3?-1:0);
 const dir=f===0?[-1,0]:f===1?[1,0]:f===2||f===5?[0,-1]:[0,1],from=[E[0]-dir[0]*Math.max(36,box.h*.5)+(f>=2?-dir[1]*14:0),E[1]-dir[1]*Math.max(36,box.h*.5)];
 const pts=[E,...rec.path.map(s=>P(s.at,s.y,s.z))],segs=[];let tot=0;for(let n=1;n<pts.length;n++){const l=Math.hypot(pts[n][0]-pts[n-1][0],pts[n][1]-pts[n-1][1]);segs.push(l);tot+=l;}
 const kIn=hitcamEase(k/.18),kRun=hitcamEase((k-.2)/.5),kEnd=(k-.72)/.28;
 g.lineCap='round';
 // incoming tracer
 const tip=[from[0]+(E[0]-from[0])*kIn,from[1]+(E[1]-from[1])*kIn];g.strokeStyle='rgba(255,140,90,.9)';g.lineWidth=2.4;g.beginPath();g.moveTo(from[0],from[1]);g.lineTo(tip[0],tip[1]);g.stroke();
 // armour at the impact: a plate drawn across the entry point
 if(k>=.18){const pen=rec.path.length>0,n=[dir[1],-dir[0]],L=Math.max(10,box.h*.16);g.strokeStyle=pen?'#ff6a4a':'#9fd6ff';g.lineWidth=3.2;g.beginPath();g.moveTo(E[0]+n[0]*L/2,E[1]+n[1]*L/2);g.lineTo(E[0]-n[0]*L/2,E[1]-n[1]*L/2);g.stroke();
  const fl=Math.max(0,1-(k-.18)/.12);if(fl>0){g.fillStyle=`rgba(255,230,180,${fl})`;g.beginPath();g.arc(E[0],E[1],6+10*(1-fl),0,Math.PI*2);g.fill();}}
 // the penetrator inside
 if(k>.2&&tot>0){let left=kRun*tot;g.strokeStyle='rgba(255,90,60,.95)';g.lineWidth=2;g.beginPath();g.moveTo(E[0],E[1]);for(let n=1;n<pts.length&&left>0;n++){const l=segs[n-1],q=Math.min(1,left/l);g.lineTo(pts[n-1][0]+(pts[n][0]-pts[n-1][0])*q,pts[n-1][1]+(pts[n][1]-pts[n-1][1])*q);left-=l;}g.stroke();}
 // modules on the path, coloured by what happened to them once reached
 const labels=[];let acc=0;
 rec.path.forEach((s,n)=>{acc+=segs[n]||0;const reached=tot>0?kRun*tot>=acc-1e-6:k>.4,m=mods[s.i]||{},[x,y]=P(s.at,s.y,s.z),r=Math.max(3,Math.min(12,(m.r||.006)*box.w)),wrecked=s.after<=0&&s.before>0;
  g.fillStyle=HITCAM_COL[s.k]||HITCAM_COL.other;g.globalAlpha=reached?1:.7;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();g.globalAlpha=1;
  if(reached){g.strokeStyle=wrecked?'#ff3b30':'#ffb347';g.lineWidth=2;g.beginPath();g.arc(x,y,r+2.5,0,Math.PI*2);g.stroke();if(wrecked){g.beginPath();g.moveTo(x-r,y-r);g.lineTo(x+r,y+r);g.moveTo(x+r,y-r);g.lineTo(x-r,y+r);g.stroke();}
   labels.push({x,y,r,text:`${s.name} ${wrecked?'破壊':s.before<=0?'（既に破壊）':Math.round(s.before*100)+'→'+Math.round(Math.max(0,s.after)*100)+'%'}`,bad:wrecked});}});
 // fire and detonation at the end
 if(kEnd>0){const last=pts[pts.length-1];if(rec.boom){const R=10+kEnd*Math.max(30,box.h*.45);g.strokeStyle=`rgba(255,200,120,${1-kEnd})`;g.lineWidth=3;g.beginPath();g.arc(last[0],last[1],R,0,Math.PI*2);g.stroke();}
  if(rec.fire||rec.boom){const t=performance.now()/120;for(let q=0;q<3;q++){const x=last[0]+(q-1)*7,h=9+4*Math.sin(t+q*2);g.fillStyle=q===1?'#ffd25a':'#ff7a2e';g.beginPath();g.moveTo(x-4,last[1]+4);g.quadraticCurveTo(x-5,last[1]-h*.4,x,last[1]-h);g.quadraticCurveTo(x+5,last[1]-h*.4,x+4,last[1]+4);g.closePath();g.fill();}}}
 // labels beside their modules, kept apart
 g.font=`600 ${fz*.92}px `+font.split('px ')[1];const used=[];
 for(const L of labels){const w=textWidthEst(L.text,fz*.92)+6;let lx=L.x+L.r+5,ly=L.y-fz*.5;if(lx+w>W-4)lx=L.x-L.r-5-w;for(const u of used)if(lx<u[2]&&lx+w>u[0]&&ly<u[3]&&ly+fz>u[1])ly=u[3]+1;used.push([lx,ly,lx+w,ly+fz]);g.fillStyle='rgba(6,11,16,.75)';g.fillRect(lx-2,ly-1,w,fz+2);g.fillStyle=L.bad?'#ff8a7a':'#ffd7a0';g.fillText(L.text,lx+1,ly);}
 // caption
 g.font=font;g.fillStyle='#dfe7ec';const pen=rec.path.length>0,face=C.COMBAT_FACE[f]||'',secN=C.SECTION_NAMES[si]||'';
 g.fillText(`${face} ${secN}　装甲 ${(+rec.thick||0).toFixed(2)} m${k>=.18?(pen?' → 貫通':' → 非貫通'):''}`,8,H-bot+4);
 if(kEnd>0||k>.6){const lost=rec.path.filter(s=>s.after<=0&&s.before>0).map(s=>s.name),tail=[lost.length?lost.slice(0,2).join('・')+' 破壊':rec.path.length?'損傷':'',rec.boom?{reactor:'炉心誘爆',fuel:'反応物誘爆',magazine:'弾薬庫誘爆'}[rec.boom]||'誘爆':'',rec.fire?'火災発生':''].filter(Boolean).join(' · ');g.fillStyle=rec.boom||lost.length?'#ff9f8a':'#c9d3da';g.fillText(tail||'区画構造に損傷',8,H-bot+4+fz+3);}
}
// Queue of replays for the 3D view: what the piloted (or followed) ship takes
// and deals. Notable hits (a module wrecked, a fire, a detonation) go first;
// the rest only when nothing has been shown for a while.
function hitcamNotable(rec){return !!(rec.boom||rec.fire||rec.path.some(s=>s.after<=0&&s.before>0));}
function hitcamOffer(u,rec,role){
 const H=trial.hitcam||(trial.hitcam={queue:[],cur:null,at:0,last:0});const now=performance.now(),notable=hitcamNotable(rec);
 if(!notable&&now-H.last<6000&&H.cur)return;
 H.queue.push({u,p:u.p,rec,role,at:now,notable});H.queue.sort((a,b)=>(b.notable-a.notable)||(b.at-a.at));if(H.queue.length>4)H.queue.length=4;
}
function hitcamStep(now){
 const hud=$('#trialHud'),el=hud?.querySelector('[data-th="hitcam"]'),H=trial.hitcam;if(!el)return;const show=on=>{if(el.hidden===on)el.hidden=!on;hud.classList.toggle('hc-on',on);};if(!H){show(false);return;}
 if(H.cur&&now-H.at>HITCAM_DUR*1000+500)H.cur=null;
 if(!H.cur){H.queue=H.queue.filter(q=>now-q.at<5000);const q=H.queue.shift();if(q){H.cur=q;H.at=now;H.last=now;}}
 if(!H.cur){show(false);return;}
 show(true);const cv=el.querySelector('canvas'),r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),W=Math.max(1,Math.round(r.width*d)),Hh=Math.max(1,Math.round(r.height*d));if(cv.width!==W||cv.height!==Hh){cv.width=W;cv.height=Hh;}
 const g=cv.getContext('2d');g.setTransform(d,0,0,d,0,0);const q=H.cur,k=Math.min(1,(now-H.at)/(HITCAM_DUR*1000)),B=trial.battle,src=q.rec.src!=null?B?.b.units.find(x=>String(x.id)===String(q.rec.src)):null;
 const title=q.role==='taken'?`被弾 · ${shipTag(q.u.name)}`:`命中 · ${shipTag(q.u.name)}`,sub=src?`${src.team!==q.u.team&&src.team?'敵 ':''}${shipTag(src.name)} から`:'';
 hitcamDraw(g,r.width,r.height,q.p,q.rec,k,{title,sub});
}
// ---- HUD ----
function trialHudHTML(){
 return `<div class="th-top"><div class="th-card th-bar"><div class="th-id"><b>${esc(trial.p?.name||ship?.name||'設計艦')}</b><small><span data-th="where">${trialWhere()}</span> <span data-th="clock">T+0:00</span></small></div>
 <dl class="th-read"><div><dt>速力</dt><dd data-th="speed">0</dd></div><div><dt>方位</dt><dd data-th="head">090°</dd></div><div><dt>高度</dt><dd data-th="alt">160 km</dd></div><div class="th-att"><dt>仰角</dt><dd data-th="pitch">0.0°</dd></div><div class="th-att"><dt>傾斜</dt><dd data-th="bank">0.0°</dd></div></dl></div>
 <div class="th-actions">${trial.rts?'':'<button type="button" class="th-btn th-mapbtn" data-trial-cmd="map" aria-expanded="false" aria-controls="thMap" aria-label="星図とハイパードライブ">星図</button>'}<button type="button" class="th-btn th-pw" data-trial-cmd="power" data-th="pwbtn" aria-expanded="false" aria-controls="thPower" aria-label="出力配分">⚡ ${(C.POWER_MODES[trial.powerMode]||C.POWER_MODES.balanced).name}</button><button type="button" class="th-btn snd-btn" data-trial-cmd="mute" data-sound-toggle aria-pressed="false" aria-label="音を切る"><svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="snd-wave" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/><path class="snd-x" d="M16 9l5 6M21 9l-5 6"/></svg></button><button type="button" class="th-btn th-more" data-trial-cmd="menu" aria-expanded="false" aria-controls="thMenu" aria-label="その他の操作">⋯</button>
 <div class="th-card th-menu th-power" id="thPower" hidden><p class="th-power-head">出力配分 <kbd>P</kbd></p>${Object.entries(C.POWER_MODES).map(([k,m])=>`<button type="button" class="th-btn th-pmode" data-trial-cmd="pmode:${k}" aria-pressed="${(trial.powerMode||'balanced')===k}"><b>${m.name}</b><small>${esc(m.note)}</small></button>`).join('')}</div><button type="button" class="th-btn th-exit" data-trial-cmd="exit">${trial.rts?'操艦終了':trial.mode==='battle'?'戦闘終了':trial.returnTo==='title'?'帰還':'公試終了'}</button>
 <div class="th-card th-menu th-map" id="thMap" hidden></div>
 <div class="th-card th-menu" id="thMenu" hidden><button type="button" class="th-btn" data-trial-cmd="cam" data-th="cam">視点 水平</button><button type="button" class="th-btn" data-trial-cmd="gunmode" data-th="gunmenu">主砲 ${GUN_MODES[trial.gunMode||'free'].name} <kbd>G</kbd></button><button type="button" class="th-btn" data-trial-cmd="shot">スクリーンショット <kbd>H</kbd></button><button type="button" class="th-btn" data-trial-cmd="level">水平復帰 <kbd>Z</kbd></button><button type="button" class="th-btn" data-trial-cmd="center">舵中央 <kbd>X</kbd></button><button type="button" class="th-btn" data-trial-cmd="records" data-th="recbtn">記録を表示</button><button type="button" class="th-btn" data-trial-cmd="reset">再開始</button></div></div></div>
 <div class="th-flash" data-th="flash" aria-hidden="true"></div>${trial.mode==='battle'||trial.pat?'<div class="th-cine" aria-hidden="true"><i class="bar top"></i><i class="bar bot"></i><b>敵艦隊　ハイパースペースより出現</b></div>':''}<div class="th-hit" data-th="hit" aria-hidden="true"></div>
 <p class="th-records" data-th="records"></p><p class="th-warn" data-th="warn" hidden></p><p class="th-hyper" data-th="hyper" hidden aria-live="polite"></p>
 ${trial.mode==='battle'||trial.pat?'<div class="th-card th-self" data-th="self"></div><div class="th-hitcam" data-th="hitcam" hidden><canvas></canvas></div>':''}<div class="th-result" data-th="result" hidden></div>
 <div class="th-reticle" aria-hidden="true"><i class="h"></i><i class="v"></i><b data-th="range">20.0 km</b></div>
 <div class="th-guns" data-th="guns" aria-live="off"><button type="button" class="th-gmode" data-trial-cmd="gunmode" data-th="gunmode" title="主砲の照準方式（G で切替）"><em class="l">主砲 ${GUN_MODES[trial.gunMode||'free'].name}</em><em class="s">${GUN_MODES[trial.gunMode||'free'].short}</em></button><button type="button" class="th-gmode th-vol" data-trial-cmd="volley" data-th="volley" title="射撃の型（C で切替）"><em class="l">${C.VOLLEY.name[trial.volley==='salvo'?'salvo':'stream']}</em><em class="s">${trial.volley==='salvo'?'斉射':'連続'}</em></button><button type="button" class="th-gmode th-vol" data-trial-cmd="escort" data-th="escort" hidden title="随伴艦の行動（T で切替）"><em class="l">随伴艦 護衛</em><em class="s">護衛</em></button><span class="th-gstat" data-th="gunstat"></span></div><div class="th-tmarks" aria-hidden="true"></div>
 <div class="th-card th-pad"><div class="th-tele-ladder" aria-label="速力通信機">${TRIAL_TELEGRAPH.map((t,i)=>`<span data-tele="${i}">${t[0]}</span>`).reverse().join('')}</div><div class="th-tele-bar" aria-hidden="true"><i data-th="speedbar"></i></div>
  <div class="th-dpad"><button type="button" class="th-arrow up" data-trial-cmd="tele+" aria-label="増速">▲</button><button type="button" class="th-arrow left" data-trial-cmd="rudder-" aria-label="取舵">◀</button><b class="th-dmid" data-th="tele">停止</b><button type="button" class="th-arrow right" data-trial-cmd="rudder+" aria-label="面舵">▶</button><button type="button" class="th-arrow down" data-trial-cmd="tele-" aria-label="減速">▼</button></div>
  <div class="th-rudder"><div class="th-gauge" data-th-row="rudder" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><i class="ord"></i><i class="act"></i></div><b class="th-order" data-th="rudder">舵中央</b></div></div>
 <div class="th-stick" data-th-stick role="slider" aria-label="ピッチとロール" aria-valuetext="中立"><span class="lab up">上げ</span><span class="lab down">下げ</span><span class="lab left">左</span><span class="lab right">右</span><i class="knob"></i></div>
 <button type="button" class="th-btn th-level" data-trial-cmd="level">水平</button>
 <button type="button" class="th-fire" data-th-fire aria-label="射撃">射撃<small>Space</small></button>
 <button type="button" class="th-msl" data-trial-cmd="missile" data-th="msl" aria-label="ミサイル発射" ${trial.launchers.length?'':'disabled'}>ミサイル<small data-th="mslstate">${trial.launchers.length?trial.launchers.length*8+' 発':'発射管なし'}</small></button>
 ${trialSwKinds().length?`<button type="button" class="th-sw" data-trial-cmd="sw" data-th="sw" aria-label="超兵器発射">超兵器<small data-th="swstate">充電</small></button>${trialSwKinds().includes('sbeam')?`<button type="button" class="th-swmode" data-trial-cmd="swmode" data-th="swmode" aria-label="超兵器の射撃の型">ビーム</button>`:''}<p class="th-swinfo${trialSwKinds().includes('sbeam')?'':' low'}" data-th="swinfo" aria-live="off" hidden></p>`:''}
 <i class="th-lead" data-th="lead" hidden aria-hidden="true"></i>
 <p class="th-keys">W/S 速力 · A/D 舵 · R/F 上げ下げ · Q/E ロール · Space 射撃 · C 斉射/連続 · T 随伴艦 · M ミサイル${trialSwKinds().length?' · B 超兵器'+(trialSwKinds().includes('sbeam')?' · N ビーム/パルス':''):''} · G 主砲照準 · P 出力配分 · J 星図 · H スクリーンショット · Z 水平復帰 · X 舵中央 · V 視点 · ドラッグで照準 · ホイールで距離</p>`;
}
function trialBindHud(hud){
 const stick=hud.querySelector('[data-th-stick]'),knob=stick?.querySelector('.knob'),fire=hud.querySelector('[data-th-fire]');
 let sid=null;const move=e=>{const r=stick.getBoundingClientRect(),R=r.width/2,dx=(e.clientX-r.left-R)/R,dy=(e.clientY-r.top-R)/R,l=Math.hypot(dx,dy),k=l>1?1/l:1;trial.stick={x:dx*k,y:-dy*k};knob.style.transform=`translate(${(dx*k*R*.62).toFixed(1)}px,${(dy*k*R*.62).toFixed(1)}px)`;};
 const end=()=>{sid=null;trial.stick={x:0,y:0};knob.style.transform='';stick.classList.remove('on');};
 stick?.addEventListener('pointerdown',e=>{e.preventDefault();sid=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('on');move(e);});
 stick?.addEventListener('pointermove',e=>{if(e.pointerId===sid)move(e);});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick?.addEventListener(ev,e=>{if(e.pointerId===sid)end();});
 fire?.addEventListener('pointerdown',e=>{e.preventDefault();fire.setPointerCapture(e.pointerId);trial.fire=true;fire.classList.add('on');});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])fire?.addEventListener(ev,()=>{trial.fire=false;fire.classList.remove('on');});
 fire?.addEventListener('contextmenu',e=>e.preventDefault());
}
function trialHudUpdate(full){
 const hud=$('#trialHud');if(!hud||!trial.on&&!full)return;const a=trialAttitude(),q=k=>hud.querySelector(`[data-th="${k}"]`),set=(k,v)=>{const e=q(k);if(e&&e.textContent!==v)e.textContent=v;};
 const v=trial.vf,p=trial.p,max=trialMaxRates(),deg=x=>x*180/Math.PI;
 set('speed',v>=1e5?`${num(Math.round(v/1000))} km/s`:`${num(Math.round(v))} m/s`);set('head',String(Math.round(a.heading)%360).padStart(3,'0')+'°');set('alt',`${(a.alt/1000).toFixed(1)} km`);
 set('pitch',`${deg(a.pitch)>=0?'+':''}${deg(a.pitch).toFixed(1)}°`);const b=deg(a.bank);set('bank',Math.abs(b)<.05?'0.0°':`${b>0?'右':'左'} ${Math.abs(b).toFixed(1)}°`);
 set('where',trialWhere());trialSelfUpdate(hud);trialHyperUpdate(hud);
 const s=Math.floor(trial.t);set('clock',`T+${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`);set('cam',trial.camMode==='ship'?'視点 追従':'視点 水平');
 const r=trial.rec,g=trial.gun;const B=trial.battle;if(B){const foes=B.b.units.filter(u=>u.team===1),up=foes.filter(u=>!u.dead&&!u.out&&!u.absent).length,last=B.ticker[B.ticker.length-1];set('records',`戦況　敵 ${up}/${foes.length} 隻 · 撃沈 ${foes.filter(u=>u.dead).length} · 戦闘不能 ${foes.filter(u=>!u.dead&&u.out).length} · 射撃 ${num(g.shots)} 発 / 命中 ${num(Math.round(g.hits))}${last?' ｜ '+last.text:''}`);}else set('records',`公試記録　最高速力 ${num(Math.round(r.top))} m/s · 0→全速 ${r.accel==null?(r.run?'計測中…':'—'):Math.round(r.accel)+' 秒'} · 全舵旋回径 ${r.turn==null?'—':(r.turn/1000).toFixed(1)+' km'} · 射撃 ${num(g.shots)} 発${g.missiles?` · ミサイル ${num(g.missiles)} 発`:''} / 命中 ${num(Math.round(g.hits))} / 撃破 ${g.kills}${g.pdKills?` · 点防御 撃墜 ${g.pdKills}`:''}${trialSwRecord()}`);
 const rp=q('records');if(rp)rp.hidden=!trialRecordsOn();set('recbtn',trialRecordsOn()?'記録を隠す':'記録を表示');set('swarcbtn',trial.swArc===false?'超兵器の射界を表示':'超兵器の射界を隠す');
 const w=q('warn');if(w){const hint=trialArcHint(),txt=trial.warn||(trial.level?'姿勢を水平に戻しています…':'')||hint;w.hidden=!txt;if(w.textContent!==txt)w.textContent=txt;}
 const bar=q('speedbar');if(bar){const lo=-.25,frac=C.clamp((v/Math.max(1,p.maxSpeed)-lo)/(1-lo),0,1);bar.style.height=(frac*100).toFixed(1)+'%';}
 hud.querySelectorAll('[data-tele]').forEach(e=>e.classList.toggle('on',+e.dataset.tele===trial.tele));set('tele',TRIAL_TELEGRAPH[trial.tele][0]);
 const row=hud.querySelector('[data-th-row="rudder"]');if(row){row.querySelector('.ord').style.left=((trial.rudder+2)/4*100)+'%';row.querySelector('.act').style.left=(C.clamp(trial.w[1]/(max[1]||1),-1,1)*50+50).toFixed(1)+'%';}set('rudder',TRIAL_RUDDER[trial.rudder+2]);
 const aim=trial.aim,held=trial.heldLock;if(held&&held!==aim?.lock)set('range',`${GUN_MODES.enemy.name} · ${held.ship?'敵艦':'標的'} ${(tv.len(tv.sub(held.pos,trial.P))/1000).toFixed(1)} km`);else set('range',aim?(aim.lock?(aim.lock.ship?'敵艦 ':'標的 '):'')+(aim.dist/1000).toFixed(1)+' km':'—');hud.querySelector('.th-reticle')?.classList.toggle('lock',!!aim?.lock);
 const all=trial.turrets,ts=all.filter(t=>!t.pd),pdl=all.filter(t=>t.pd&&!t.dead),pdOn=pdl.filter(t=>t.pdTarget).length,pdFire=pdl.filter(t=>t.firing).length,ready=ts.filter(t=>t.ready).length,loaded=ts.filter(t=>t.ready&&t.reload<=0).length,blocked=ts.filter(t=>t.arc&&t.clearDir&&!t.clear).length,out=ts.filter(t=>!t.arc).length,turning=ts.length-ready-blocked-out;
 const pw=trial.power,en=trial.energy,ef=en&&en.cap>0?en.E/en.cap:0,load=pw?.load||0,nochg=ts.filter(t=>t.charge<=0).length,starved=ts.filter(t=>t.ready&&t.reload<=0&&en&&en.E<t.power*t.cycle*t.charge/TT_J).length,fireable=Math.max(0,loaded-starved),thrust=pw?.engF??1;
 const gn=q('guns'),gs=q('gunstat');if(gn&&gs){
  // Each figure carries a full and a short label; the layout picks which shows.
  const it=(cls,l,sh,v)=>`<span class="${cls}"><em class="l">${l}</em><em class="s">${sh}</em> ${v}</span>`,eCls=ef<.25?'ng':ef<.6?'wait':'ok',lCls=load>=1.15?'ng':load>=.95?'wait':'ok';
  const html=(ts.length?it('ok','● 射撃可','射撃可',fireable)+it('wait','● 装填・旋回','装填',Math.max(0,ready-loaded+turning-nochg))+(starved?it('wait','● 充電待ち','充電',starved):'')+it('ng','● 遮蔽・射界外','射界外',blocked+out)+(nochg?it('ng','● 充電装置なし','充電なし',nochg):''):'<span class="ng">主砲なし</span>')+(pdl.length?it(pdOn?'wait':'ok','● 点防御','点防御',pdOn?`射撃 ${pdFire}/${pdl.length}`:pdl.length):'')+it(eCls,'⚡ 兵装エネルギー','⚡',Math.round(ef*100)+'%')+it(lCls,'炉心','炉心',Math.round(load*100)+'%')+(thrust<.98?it('wait','推力','推力',Math.round(thrust*100)+'%'):'');
  const grew=gs.innerHTML.length!==html.length;if(gs.innerHTML!==html)gs.innerHTML=html;const gm=q('gunmode'),M=GUN_MODES[trial.gunMode||'free'],gl=`<em class="l">主砲 ${M.name}</em><em class="s">${M.short}</em>`;if(gm&&gm.innerHTML!==gl){gm.innerHTML=gl;}gm?.classList.toggle('on',(trial.gunMode||'free')!=='free');const vb=q('volley'),vs=trial.volley==='salvo',vl=`<em class="l">${vs?'斉射':'連続射撃'}</em><em class="s">${vs?'斉射':'連続'}</em>`;if(vb&&vb.innerHTML!==vl)vb.innerHTML=vl;vb?.classList.toggle('on',vs);
  // v21.1 Escorts' behaviour (shown in a battle with escorts of ours).
  const eb=q('escort'),B=trial.battle,hasEsc=!!(B&&!trial.rts&&B.me&&B.b.units.some(u=>!u.manual&&u.team===B.me.team&&!u.dead&&!u.absent));if(eb){if(eb.hidden===hasEsc)eb.hidden=!hasEsc;const ef=!!trial.escortFree,el=`<em class="l">随伴艦 ${ef?'自由攻撃':'護衛'}</em><em class="s">${ef?'攻撃':'護衛'}</em>`;if(eb.innerHTML!==el)eb.innerHTML=el;eb.classList.toggle('on',!ef);}
  trialGunsLayout(hud,gn,grew);}
 trialSwHud(q,set);
 const ml=q('msl');if(ml&&trial.launchers.length){const ready=trial.launchers.filter(l=>l.reload<=0).length,rl=Math.min(...trial.launchers.map(l=>l.reload)),f=1-rl/20;ml.style.setProperty('--fill',(ready?1:f).toFixed(3));set('mslstate',ready?`${ready*8} 発`:`${Math.ceil(rl)} 秒`);ml.classList.toggle('ready',ready>0);}
 const ld=q('lead');if(ld){const p=trial.lead&&view?view.project(trial.lead):null,hr=hud.getBoundingClientRect(),ok=p&&p[2]>-1&&p[2]<1;ld.hidden=!ok;if(ok)ld.style.transform=`translate(${(p[0]-hr.left).toFixed(1)}px,${(p[1]-hr.top).toFixed(1)}px) rotate(45deg)`;}
 const st=hud.querySelector('[data-th-stick]'),si=trialStickInput();if(st){const txt=Math.abs(si.x)<.05&&Math.abs(si.y)<.05?'中立':`${si.y>0?'上げ':'下げ'} ${Math.round(Math.abs(si.y)*100)}% · ${si.x>0?'右':'左'}ロール ${Math.round(Math.abs(si.x)*100)}%`;if(st.getAttribute('aria-valuetext')!==txt)st.setAttribute('aria-valuetext',txt);}
}
// In a battle, a locked enemy that most guns cannot reach gets a hint: the
// batteries bear when the target is above the deck, so pitch or roll toward it.
function trialArcHint(){const B=trial.battle,ts=trial.turrets,lk=trial.aim?.lock;if(!B||B.result||!lk?.ship||!ts.length||trial.jump)return '';const live=ts.filter(t=>!t.dead),bad=live.filter(t=>!t.arc||t.arc&&t.clearDir&&!t.clear).length;return live.length&&bad>=live.length*.7?'主砲の射界外 — 機首を下げるかロールして、甲板を敵艦に向けてください':'';}
function trialWhere(){const s=trialSys();if(trial.jump?.phase==='tunnel')return 'ハイパースペース';return (trial.mode==='battle'?'艦隊戦':trial.returnTo==='title'?'パトロール':'公試')+' · '+s.name+(s.planet.ring?'軌道 · 造船リング':trial.rts?'星系':'低軌道');}
// Flagship status in a battle: shield, hull and armour bars, crew and losses,
// and the last few lines of the battle log.
// Armour by face (bow, stern, starboard, port, dorsal, ventral): what is left
// of the plating, and the load on its most loaded zone (a full bar is about
// to break through).
function armourFaces(u){
 const N=u.sec?.length||C.HULL_SECTIONS,Z=C.combatZones(u.p,N);
 return [0,1,2,3,4,5].map(f=>{let a=0,i=0,l=0;for(let s=0;s<N;s++){const z=s*6+f,A=Z.A[z];if(!(A>0))continue;a+=A;const zi=u.zi?.[z]??1;i+=A*zi;l=Math.max(l,(u.zl?.[z]||0)/Math.max(1e-9,Z.cap[z]*zi));}return {i:a>0?i/a:1,l:C.clamp(l,0,1),a};});
}
function armourFacesHTML(u){
 const fs=armourFaces(u),names=['首','尾','右','左','上','下'];
 return `<div class="ts-row ts-arm"><span>装甲</span><span class="arm6">${fs.map((x,f)=>`<i class="${x.a>0?(x.i<.35?'bad':x.i<.75?'mid':''):'none'}" title="${C.COMBAT_FACE[f]} 残存 ${Math.round(x.i*100)}% · 負荷 ${Math.round(x.l*100)}%"><b>${names[f]}</b><em style="height:${Math.round(x.l*100)}%"></em></i>`).join('')}</span><small>${Math.round((u.armor??1)*100)}%</small></div>`;
}
// Where the reactor's output goes this moment.
function powerSplitHTML(u){
 const w=u.pw;if(!w||!(w.P>0))return '';const pc=x=>Math.round(C.clamp(x/w.P,0,1.5)*100);
 return `<div class="ts-row ts-pw"><span>出力</span><span class="pw3"><i class="e" style="width:${Math.min(100,pc(w.eng))}%" title="推進 ${pc(w.eng)}%"></i><i class="s" style="width:${Math.min(100,pc(w.sh))}%" title="シールド ${pc(w.sh)}%"></i><i class="w" style="width:${Math.min(100,pc(w.wpn))}%" title="兵装 ${pc(w.wpn)}%"></i></span><small title="推進 ${pc(w.eng)}% · シールド ${pc(w.sh)}% · 兵装 ${pc(w.wpn)}%">${pc(w.wpn)}%</small></div>`;
}
function statusFlagsHTML(u){
 if(u.dead)return '';
 const fires=(u.fire||[]).map((f,i)=>f>0?C.SECTION_NAMES[i]:null).filter(Boolean),out=[];
 if(fires.length)out.push(`<span class="fl fire">火災 ${esc(fires.join('・'))}</span>`);
 if((u.ionK||0)>.05)out.push(`<span class="fl ion">イオン障害 出力 −${Math.round(u.ionK*C.COMBAT.ionReactor*100)}%</span>`);
 if((u.shRate||0)>0&&u.shieldMax>0&&u.shield<u.shieldMax*.999){const r=u.shRate/u.shieldMax*100;out.push(`<span class="fl sh">シールド再生 +${r>=1?r.toFixed(1):r>=.1?r.toFixed(2):r.toFixed(3)}%/秒</span>`);}
 if((u.bankUse||0)>0&&u.bankMax>0)out.push(`<span class="fl bank">${u.bank>0?'パワーセルから給電':'パワーセル枯渇'}</span>`);
 return out.length?`<p class="ts-flags">${out.join('')}</p>`:'';
}
function trialSelfUpdate(hud){
 const el=hud.querySelector('[data-th="self"]'),B=trial.battle;if(!el)return;if(!B){if(el.innerHTML)el.innerHTML='';el.hidden=true;return;}el.hidden=false;
 const me=B.me,pc=x=>Math.round(C.clamp(x,0,1)*100),sh=me.shieldMax>0?me.shield/me.shieldMax:0,hp=Math.max(0,me.hp)/me.p.hp,bar=(lab,f,cls)=>`<div class="ts-row"><span>${lab}</span><i class="${cls}"><em style="width:${pc(f)}%"></em></i><small>${pc(f)}%</small></div>`;
 const lost=(me.mods||[]).map((h,i)=>h<=0?trial.p.modules?.[i]:null).filter(m=>m&&m.k!=='hull'),lostTxt=lost.length?'損傷 '+[...new Set(lost.map(m=>m.name))].slice(0,3).join('・')+(lost.length>3?` ほか`:''):'損傷なし';
 const allies=B.b.units.filter(u=>u.team===0&&!u.manual),log=B.ticker.slice(-3).reverse();
 const secs=me.sec?`<div class="ts-row"><span>船体区画</span><span class="vsec">${me.sec.map((q,i)=>{const f=C.clamp(q.s/q.max,0,1);return `<i class="${f<=0?'gone':f<.25?'bad':f<.6?'mid':''}" title="${C.SECTION_NAMES[i]} ${Math.round(f*100)}%"><em style="width:${Math.round(f*100)}%"></em></i>`;}).join('')}</span><small>${pc(Rts.unitStruct(me))}%</small></div>`:bar('船体',hp,'hp');
 const html=`<b class="ts-head">自艦${me.dead?' · 撃沈':me.out?' · 戦闘不能（'+esc(me.out)+'）':''}</b>${bar('シールド',sh,'sh')}${me.bankMax>0?bar('蓄電',me.bank/me.bankMax,'bank'):''}${secs}${armourFacesHTML(me)}${powerSplitHTML(me)}${statusFlagsHTML(me)}<p class="ts-line">乗員 ${num(Math.round(me.crew))} 名 · ${esc(lostTxt)}${allies.length?` · 僚艦 ${allies.filter(u=>!u.dead&&!u.out&&!u.hidden).length}/${allies.length}`:''}</p>${log.length?`<ul class="ts-log">${log.map(l=>`<li>${esc(l.text)}</li>`).join('')}</ul>`:''}`;
 if(el.innerHTML!==html)el.innerHTML=html;
}
// The status line of a jump, phase by phase (left: seconds to the far end of the tunnel).
function trialHyperText(j,d,left){
 const c=`光速の ${(trial.vf/LIGHT*100).toFixed(trial.vf<LIGHT*.01?2:1)}%`;
 return j.phase==='spool'?`ハイパードライブ充填中 · ${d}へ ${Math.max(0,JUMP.spool-j.t).toFixed(1)} 秒`:j.phase==='accel'?`亜光速へ加速 · ${c}`:j.phase==='enter'?`亜光速 · ${c} — ハイパースペースへ突入`:j.phase==='tunnel'?`ハイパースペース航行中${d?` · ${d}まで`:''}${Number.isFinite(left)?` ${Math.ceil(left)} 秒`:''}`:j.phase==='exit'?`リアルスペースへ復帰 · 亜光速`:j.phase==='brake'?`亜光速から減速 · ${trial.vf>=1e5?`秒速 ${num(Math.round(trial.vf/1000))} km`:`${num(Math.round(trial.vf))} m/s`}`:`${trialSys().name}に到着`;
}
function trialHyperUpdate(hud){
 const el=hud.querySelector('[data-th="hyper"]'),j=trial.jump;if(!el)return;el.hidden=!j;if(!j)return;const d=SYSTEMS[j.dest]?.name||'';
 const txt=trialHyperText(j,d,Math.max(0,trialTunnelLeft(j)));
 if(el.textContent!==txt)el.textContent=txt;el.dataset.phase=j.phase;
}
// The record line is shown by default on wide screens and folded on phones.
const trialRecordsOn=()=>trial.showRecords??(window.innerWidth>=900);
function trialCommand(cmd){
 if(!trial.on)return;if(trial.cine)spaceCineEnd();
 if(cmd==='tele+')trial.tele=Math.min(5,trial.tele+1);else if(cmd==='tele-')trial.tele=Math.max(0,trial.tele-1);
 else if(cmd==='rudder+'||cmd==='rudder-')trial.rudder=C.clamp(trial.rudder+(cmd.endsWith('+')?1:-1),-2,2);
 else if(cmd==='level')trial.level=true;
 else if(cmd==='center'){trial.rudder=0;trial.level=false;}
 else if(cmd==='cam'){trial.camMode=trial.camMode==='ship'?'horizon':'ship';if(view){view.cam.th=Math.PI;view.cam.ph=TRIAL_CAM_PH;}}
 else if(cmd==='reset'){if(trial.rts){toast('艦隊戦の途中では再開始できません');return;}trialReset();}
 else if(cmd==='fireTap')trial.fireTap=.25;
 else if(cmd==='menu'){const m=$('#thMenu'),b=document.querySelector('[data-trial-cmd="menu"]');if(m){m.hidden=!m.hidden;b?.setAttribute('aria-expanded',String(!m.hidden));}return;}
 else if(cmd==='power'){const m=$('#thPower'),b=document.querySelector('[data-trial-cmd="power"]');if(m){m.hidden=!m.hidden;b?.setAttribute('aria-expanded',String(!m.hidden));}return;}
 else if(cmd==='pnext'){const ks=Object.keys(C.POWER_MODES);trialSetPower(ks[(ks.indexOf(trial.powerMode||'balanced')+1)%ks.length]);}
 else if(cmd.startsWith('pmode:')){trialSetPower(cmd.slice(6));const m=$('#thPower');if(m)m.hidden=true;document.querySelector('[data-trial-cmd="power"]')?.setAttribute('aria-expanded','false');}
 else if(cmd==='records'){trial.showRecords=!trialRecordsOn();}
 else if(cmd==='volley'){trialVolley();}
 else if(cmd==='escort'){trialEscortMode();}
 else if(cmd==='gunmode'||cmd.startsWith('gun:')){const ks=Object.keys(GUN_MODES),k=cmd==='gunmode'?ks[(ks.indexOf(trial.gunMode||'free')+1)%ks.length]:cmd.slice(4);if(!GUN_MODES[k])return;trial.gunMode=k;trial.gunTarget=null;const M=GUN_MODES[k];toast(`主砲：${M.name} — ${M.note}`);const mb=document.querySelector('[data-th="gunmenu"]');if(mb)mb.innerHTML=`主砲 ${M.name} <kbd>G</kbd>`;}
 else if(cmd==='shot'){shotSet(!shot.on);return;}
 else if(cmd==='mute'){sndToggle();return;}
 else if(cmd==='pause'){trialPause();return;}
 else if(cmd==='missile'){if(!trial.launchers.length){toast('ミサイル発射管がありません');return;}trial.mslOrder=true;}
 else if(cmd==='sw')trialSwFire();
 else if(cmd==='swmode')trialSwMode();
 else if(cmd==='swarc'){trial.swArc=trial.swArc===false;toast(trial.swArc?'超兵器の射界（射程と射角）を表示します':'超兵器の射界を隠しました');}
 else if(cmd==='map'){if(trial.rts){toast('ジャンプは戦術図の「離脱」「増援」で命じます');return;}trialMapShow();return;}
 else if(cmd.startsWith('jump:')){trialJump(cmd.slice(5));}
 else if(cmd==='retry'){if(trial.rts)return;const r=$('#trialHud [data-th="result"]');if(r)r.hidden=true;trialReset();}
 else if(cmd==='resultClose'){const r=$('#trialHud [data-th="result"]');if(r)r.hidden=true;return;}
 else if(cmd==='exit'){trialStop();return;}
 trialHudUpdate(true);
}
// ---------- star systems ----------
// Two Core Worlds systems to fly between. Each sets its planet (drawn per pixel
// in planet radii, with Kuat's shipyard ring in its equatorial plane) and the
// orbit a ship arrives in. A ship arrives at 20° latitude heading toward the
// equator, so the ring stands as an arch across the sky ahead, 8–18° up.
const SYSTEMS={
 coruscant:{key:'coruscant',name:'コルサント',note:'銀河の首都。全球を覆う都市惑星',short:'銀河の首都',planet:{radius:6.12e6,kind:0,axis:[0,0,1],ring:null},altitude:160000,floor:40000,sun:[.787,.407,.463],map:[150,146]},
 kuat:{key:'kuat',name:'クワット',note:'クワット・ドライブ・ヤードの軌道造船リングが惑星を取り巻く造船星系',short:'KDY 造船所',planet:{radius:5.2e6,kind:1,axis:[-Math.cos(20*Math.PI/180),Math.sin(20*Math.PI/180),0],ring:[1.16,1.25]},altitude:180000,floor:60000,sun:[-.384,.5,.776],map:[262,86]},
 corellia:{key:'corellia',name:'コレリア',note:'造船と交易で栄えるコア・ワールド。コレリアン・ランの起点',short:'交易と造船',planet:{radius:6.1e6,kind:2,axis:[0,0,1],ring:null},altitude:170000,floor:50000,sun:[.561,.5,-.66],map:[312,130]},
 geonosis:{key:'geonosis',name:'ジオノーシス',note:'アウター・リムの赤い岩石惑星。荒野にドロイド工場が並ぶ',short:'岩石の惑星',planet:{radius:5.3e6,kind:5,axis:[0,0,1],ring:null},altitude:160000,floor:45000,sun:[-.279,.53,.801],map:[356,42]},
 bespin:{key:'bespin',name:'ベスピン',note:'アウター・リムのガス巨星。雲の層にタイバナガスの採掘都市が浮かぶ',short:'ガス巨星',planet:{radius:5.9e7,kind:3,axis:[.2,0,.98],ring:null},altitude:1.2e6,floor:3e5,sun:[-.648,.5,.574],map:[378,198]},
 hoth:{key:'hoth',name:'ホス',note:'アウター・リムの氷の惑星。吹雪と氷原に覆われている',short:'氷の惑星',planet:{radius:3.6e6,kind:4,axis:[0,0,1],ring:null},altitude:150000,floor:40000,sun:[.387,.438,.811],map:[340,222]}};
// The lanes drawn on the star map (any system can be jumped to directly).
const STAR_LANES=[['coruscant','kuat'],['kuat','corellia'],['coruscant','corellia'],['corellia','geonosis'],['corellia','bespin'],['bespin','hoth']];
for(const s of Object.values(SYSTEMS))if(s.planet?.axis){const l=Math.hypot(...s.planet.axis)||1;s.planet.axis=s.planet.axis.map(x=>x/l);}
for(const s of Object.values(SYSTEMS)){const l=Math.hypot(...s.sun);s.sun=s.sun.map(x=>x/l);}
const trialSys=()=>SYSTEMS[trial.sysKey]||SYSTEMS.coruscant;
const trialPlanet=()=>{const s=trialSys();return {center:tv.scale(trial.P,-1),radius:s.planet.radius,sun:s.sun,kind:s.planet.kind,axis:s.planet.axis,ring:s.planet.ring};};
function trialDust(){const L=trial.p.len,H=C.clamp(L*2,1400,30000),n=280,pos=new Float32Array(n*3);for(let i=0;i<pos.length;i++)pos[i]=(Math.random()*2-1)*H;trial.dust={H,pos,col:new Uint8Array(n*4).map((_,i)=>i%4===3?120:170+(i%4)*14),size:new Float32Array(n).fill(Math.max(2,L*.0035))};}

// ---------- hyperspace ----------
// A jump runs: spool-up at full ahead; a sublight burst that sends the planet,
// ring and dust streaming past until the ship makes a tenth of light speed;
// then, at sublight, the stars stretch radially away from the bow into
// streaks, and the ship plunges into the tunnel. Reversion runs the other way:
// out of the tunnel the ship is still at sublight among long streaks, which
// shrink back into stars; then it slows from sublight to its arrival point,
// the planet and the ships there rushing in and halting. Another ship
// dropping out is seen from outside as a long streak that snaps back to the
// ship's true length.
const JUMP={spool:1.8,accel:1.4,enter:1.25,close:.45,exit:1.1,brake:1.3,arrive:.4},SUBLIGHT=3e7,LIGHT=2.998e8,STREAK=1.9;
const jumpSeconds=(hc,from,to)=>{const a=SYSTEMS[from]?.map,b=SYSTEMS[to]?.map,d=a&&b?Math.hypot(a[0]-b[0],a[1]-b[1])/127:1;return C.clamp((3+2.2*hc)*(.6+.4*d),3.5,24);};
const trialHyperClass=()=>trial.asset?.stats?.hyperClass??null;
// A ship dropping out covers D(t)=D0·e^(−kt) in its last instants; it is drawn
// stretched by that speed, bow in place, and washed blue-white.
const WARP={D0:160,k:22,cap:36};
function warpLook(t,L){const tt=Math.max(0,t),D=WARP.D0*L*Math.exp(-WARP.k*tt),stretch=1+Math.min(WARP.cap,D/Math.max(1,L)*.9);return {D,stretch,tint:C.clamp((stretch-1)/16,0,.45)};}
// ---------- patrol escorts (v17) ----------
// Ships of the player's choosing keep station astern and abeam of the flown
// ship, ride along through hyperspace, and put their fire on the target the
// flagship is shooting at.
const ESCORT_SLOTS=[[.45,.06,1.5],[.45,-.06,-1.5],[2,.55,0],[-.4,-.1,2.7],[-.4,.1,-2.7],[3.3,0,0]];
function escortsInit(){
 trial.escorts=[];if(trial.mode!=='trial'||!trial.escortKeys?.length)return;const L=trial.p.len;
 trial.escortKeys.forEach((k,i)=>{const a=fleet.assets.get(k);if(!a?.p||i>=ESCORT_SLOTS.length)return;const s=ESCORT_SLOTS[i],sp=Math.max(L,a.p.len)*1.15+260,slot=[s[0]*sp,s[1]*sp,s[2]*sp];
  trial.escorts.push({key:k,p:a.p,name:String(a.design?.name||a.p.name||'随伴艦').split('｜')[0],slot,pos:tv.add(trial.P,trialApply(trial.R,slot)),V:[...trial.V],R:[...trial.R],f:trialCol(trial.R,0),gun:Math.random()*2});});
}
function escortsPlace(){for(const e of trial.escorts||[]){e.pos=tv.add(trial.P,trialApply(trial.R,e.slot));e.V=[...trial.V];e.R=[...trial.R];e.f=trialCol(trial.R,0);}}
function escortsStep(dt){
 const es=trial.escorts;if(!es?.length||!(dt>0))return;const j=trial.jump;
 // In a jump they keep their places exactly: the whole formation goes to lightspeed together.
 if(j&&j.phase!=='spool'){escortsPlace();return;}
 const up0=tv.norm(trial.P);
 for(const e of es){
  const want=tv.add(trial.P,trialApply(trial.R,e.slot)),err=tv.sub(want,e.pos),d=tv.len(err),vmax=Math.max(e.p.maxSpeed||200,tv.len(trial.V)*1.2+60),acc=Math.max(8,(e.p.accel||10)*2);
  let goal=tv.add(trial.V,err,Math.min(.35,1/(1+d/4000)));const gl=tv.len(goal);if(gl>vmax)goal=tv.scale(goal,vmax/gl);
  // Clear of the flagship and of each other.
  for(const o of [{pos:trial.P,L:trial.p.len},...es.filter(x=>x!==e).map(x=>({pos:x.pos,L:x.p.len}))]){const r=tv.sub(e.pos,o.pos),l=tv.len(r),min=(e.p.len+o.L)*.62;if(l<min&&l>1)goal=tv.add(goal,r,(min-l)/l*.6);}
  const dv=tv.sub(goal,e.V),n=tv.len(dv),st=Math.min(n,acc*dt);e.V=tv.add(e.V,dv,st/Math.max(1e-6,n));e.pos=tv.add(e.pos,e.V,dt);
  // The bow follows the way it moves (the flagship's heading when it is nearly still), turning at its own rate.
  const sp=tv.len(e.V);e.lvl=C.clamp(Math.max(.16+.3*Math.min(1,sp/vmax),st/Math.max(1e-6,acc*dt)),0,1);const tf=sp>25?tv.norm(e.V):trialCol(trial.R,0),k=1-Math.exp(-dt*Math.max(.25,(e.p.turnRate||.05)*6));e.f=tv.norm(tv.add(e.f,tv.sub(tf,e.f),k));
  e.R=trialFrame(e.f,tv.add(tv.scale(up0,.85),trialCol(trial.R,1),.15));
 }
}
// v21.2 In the tunnel the escorts are strung out ahead in the order they went in (the smallest first, the flagship
// last, a fraction of a second apart): at hyperspace pace that puts them far beyond sight.
function escortsDraw(){const es=trial.escorts||[],tun=trial.jump?.phase==='tunnel',dir=tun?(trial.jump.dir||trialCol(trial.R,0)):null,order=tun?es.slice().sort((a,b)=>(a.p.len||0)-(b.p.len||0)):null,gap=es.length>1?Math.min(.6,2.4/(es.length-1)):.6;
 return es.map((e,i)=>{let pos=tv.sub(e.pos,trial.P);if(tun){const k=es.length-order.indexOf(e);pos=tv.add(pos,dir,k*gap*VOY_HYPER_SEP);}return {key:e.key,pos,rot:e.R,glow:glowOf('esc'+i,e.lvl??.5),hatchOpen:0,dead:false,stretch:1,flash:0};});}
// Supporting fire: while the flagship fires at a target, each escort in range sends a burst at it.
function escortsFire(dt,lock,firing){
 const es=trial.escorts;if(!es?.length)return;
 for(const e of es){e.gun-=dt;if(!firing||!lock||!lock.alive||e.gun>0||trial.jump)continue;const rel=tv.sub(lock.pos,e.pos),d=tv.len(rel);if(d>TRIAL_GUN.range*1.2){e.gun=.5;continue;}
  const me={pos:trial.P,rot:trial.R,radius:trial.p.len*.5,semi:[trial.p.len*.5,(trial.p.height||trial.p.len*.2)*.5,(trial.p.width||trial.p.len*.5)*.5]};if(trialBoxOnLine(me,e.pos,tv.scale(rel,1/d),d)){e.gun=.4;continue;}
  e.gun=1.1+Math.random()*.9;const spd=TRIAL_GUN.boltSpeed,t=trialIntercept(rel,tv.sub(lock.vel,e.V),spd)||d/spd,aim=tv.norm(tv.add(tv.add(rel,tv.sub(lock.vel,e.V),t),[(Math.random()-.5)*d*.01,(Math.random()-.5)*d*.01,(Math.random()-.5)*d*.01]));
  sndAt('laser_light',e.pos,{gain:.55,pitch:1.15});
  for(let i=0;i<2;i++){const pos=tv.add(tv.add(e.pos,trialApply(e.R,[e.p.len*(.1-.2*i),(e.p.height||e.p.len*.2)*.3,0])),aim,e.p.len*.2);trial.bolts.push({pos,prev:pos,vel:tv.add(tv.scale(aim,spd),e.V),life:(d+e.p.len)/spd*1.15,len:Math.max(70,e.p.len*.04),size:Math.max(5,e.p.len*.006),col:[120,235,255],weight:1,tt:0,esc:true});}
  trial.fx.push({pos:e.pos,vel:e.V,life:.1,max:.1,size:Math.max(8,e.p.len*.02),col:[200,240,255]});}
}
function trialJump(dest){
 if(!trial.on||trial.jump||!SYSTEMS[dest])return;if(dest===trial.sysKey){toast('すでにこの星系にいます');return;}
 const hc=trialHyperClass();if(hc==null){toast('この艦にはハイパードライブがありません');return;}
 if(trial.battle?.me?.out||trial.battle?.me?.dead){toast('戦闘不能のためジャンプできません');return;}
 spaceCineEnd();trial.jump={phase:'spool',t:0,dest,tunnel:jumpSeconds(hc,trial.sysKey,dest),dir:trialCol(trial.R,0)};trial.tele=5;trial.fire=trial.fireKey=false;trial.fireTap=0;
 trialMapShow(false);toast(`ハイパードライブ起動 — ${SYSTEMS[dest].name}へ（超空間 ${Math.round(trial.jump.tunnel)} 秒）`);
 if(trial.battle&&!trial.battle.result)spaceDepartEscorts();
}
// Seconds left in the tunnel (known for a flight; for a ship followed in a
// fleet battle, set once its group reaches the far end).
const trialTunnelLeft=j=>j.end!=null?j.end-j.t:Infinity;
// How far the stars are stretched (the angle added at each streak's outer
// end): none on the way up to sublight, growing to STREAK by the tunnel and a
// little more as it closes over them; the same in reverse coming out.
function trialStreak(){
 const j=trial.jump;if(!j)return 0;
 if(j.phase==='enter')return STREAK*(j.t/JUMP.enter)**2.5;
 if(j.phase==='tunnel')return STREAK+2.5*Math.max(0,Math.min(j.t,trialTunnelLeft(j),.4));
 if(j.phase==='exit')return STREAK*Math.max(0,1-j.t/JUMP.exit)**2.5;
 return 0;}
// The tunnel fades in over the stretched stars and out over the new system's.
function trialTunnelK(j){return j?.phase==='tunnel'?C.clamp(Math.min(j.t/.35,trialTunnelLeft(j)/JUMP.close),0,1):0;}
// The sublight burst: speed climbs from the ship's own to a tenth of light by
// the end of the burst and holds there while the stars stretch. The ship
// flies straight on its heading, so the planet drops away behind.
const trialCoasting=()=>{const p=trial.jump?.phase;return p==='accel'||p==='enter';};
const trialFast=()=>{const p=trial.jump?.phase;return p==='accel'||p==='enter'||p==='exit'||p==='brake';};
function trialSublight(dt){
 const j=trial.jump;if(!trialCoasting())return;const v=j.phase==='accel'?Math.min(SUBLIGHT,j.v0*Math.exp(j.t*Math.log(SUBLIGHT/j.v0)/JUMP.accel)):SUBLIGHT,f=j.dir;
 trial.P=tv.add(trial.P,f,v*dt);trial.V=tv.scale(f,v);trial.vf=v;trial.w=[0,0,0];
}
// Reversion: still at sublight while the streaks shrink, then slowing as
// v1·e^(t'/τ) (t' the time left) to the arrival point; the chase camera rides along.
function trialRevTau(j){return JUMP.brake/Math.log(SUBLIGHT/Math.max(50,j.v1||0));}
function trialRevDist(j,phase=j.phase,t=j.t){
 const v1=Math.max(50,j.v1||0),tau=trialRevTau(j);
 if(phase==='tunnel'||phase==='exit')return tau*(SUBLIGHT-v1)+SUBLIGHT*Math.max(0,JUMP.exit-(phase==='exit'?t:0));
 if(phase==='brake')return v1*tau*(Math.exp(Math.max(0,JUMP.brake-t)/tau)-1);
 return 0;}
function trialReversion(){
 const j=trial.jump;if(!j?.to||!(j.phase==='exit'||j.phase==='brake'||j.phase==='tunnel'&&j.arrived))return;
 const v1=Math.max(50,j.v1||0),v=j.phase==='brake'?v1*Math.exp(Math.max(0,JUMP.brake-j.t)/trialRevTau(j)):SUBLIGHT;
 trial.P=tv.add(j.to,j.dir,-trialRevDist(j));trial.V=tv.scale(j.dir,v);trial.vf=v;trial.w=[0,0,0];
}
function trialJumpStep(dt){
 const j=trial.jump;if(!j)return;j.t+=dt;const next=p=>{j.phase=p;j.t=0;};
 if(j.phase==='spool'){j.dir=trialCol(trial.R,0);if(j.t>=JUMP.spool){j.v0=Math.max(300,trial.vf,trial.p.maxSpeed||0);next('accel');}}
 else if(j.phase==='accel'){if(j.t>=JUMP.accel)next('enter');}
 else if(j.phase==='enter'){if(j.t>=JUMP.enter){next('tunnel');shotSoon('hyper',1.1);trial.flash=Math.max(trial.flash||0,.8);trial.bolts=[];trial.missiles=[];trial.fx=[];trial.wrecks=[];trial.vbolts=[];if(j.follow)j.end=null;else{j.end=j.tunnel;if(trial.battle&&!trial.battle.result)spaceWithdraw();}}}
 else if(j.phase==='tunnel'){
  // The far end: the new system is set up while the tunnel still covers it.
  if(!j.arrived&&!j.follow&&trialTunnelLeft(j)<=JUMP.close){j.arrived=true;trialArrive(j.dest);}
  if(trialTunnelLeft(j)<=0){next('exit');trial.flash=Math.max(trial.flash||0,.7);}}
 else if(j.phase==='exit'){if(j.t>=JUMP.exit)next('brake');}
 else if(j.phase==='brake'){if(j.t>=JUMP.brake){trial.P=j.to.slice();trial.V=tv.scale(j.dir,j.v1);trial.vf=j.v1;next('arrive');}}
 else if(j.phase==='arrive'){if(j.t>=JUMP.arrive){trial.jump=null;if(trial.battle?.result&&!trial.battle.rts)spaceShowResult();}}
 trialReversion();
}
function trialArrive(dest){
 trial.sysKey=dest;const s=trialSys(),R=s.planet.radius;
 Object.assign(trial,{P:[0,R+s.altitude,0],R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],V:[trial.p.maxSpeed*.3,0,0],tele:2,rudder:0,level:false,camF:null,warn:''});trial.vf=trial.V[0];trialDust();
 if(trial.pat){trial.targets=[];patrolArrive();}else if(trial.mode==='trial'){trial.targets=[];for(let i=0;i<TRIAL_GUN.targets;i++)trial.targets.push(trialSpawnTarget(i,true));}else trial.targets=[];
 // The arrival point; reversion brings the ship in along its heading to it.
 if(trial.jump){trial.jump.dir=trialCol(trial.R,0);trial.jump.to=trial.P.slice();trial.jump.v1=trial.vf;trial.camF=trialFrame(trial.jump.dir,tv.norm(trial.P));}escortsPlace();toast(`${s.name}に到着 — ${s.note}`);
}
// Star map of the Core Worlds: the current system, the other system and the
// hyperlane between them. Jumping from a battle withdraws from it.
function trialMapHTML(){
 const cur=trialSys(),hc=trialHyperClass(),inBattle=trial.battle&&!trial.battle.result;
 const sys=Object.values(SYSTEMS).filter(s=>s.key!=='rts'),core=[64,196];
 const lanes=STAR_LANES.map(([a,b])=>{const p=SYSTEMS[a].map,q=SYSTEMS[b].map,m=[(p[0]+q[0])/2+(q[1]-p[1])*.08,(p[1]+q[1])/2-(q[0]-p[0])*.08];return `<path class="tm-lane" d="M${p.join(' ')} Q ${m.join(' ')} ${q.join(' ')}"/>`;}).join('');
 const marks=sys.map(s=>{const here=s.key===cur.key,left=s.key==='coruscant'||s.map[0]>330,tx=left?s.map[0]-14:s.map[0]+14,anc=left?'end':'start';return `<g class="tm-sys ${here?'here':''}" ${here||hc==null?'':`data-trial-cmd="jump:${s.key}"`}>${here?`<circle class="tm-ring" cx="${s.map[0]}" cy="${s.map[1]}" r="12"/>`:''}<circle cx="${s.map[0]}" cy="${s.map[1]}" r="${here?6:5}"/><text x="${tx}" y="${s.map[1]-2}" text-anchor="${anc}">${esc(s.name)}</text><text class="tm-sub" x="${tx}" y="${s.map[1]+12}" text-anchor="${anc}">${here?'現在地 · ':''}${esc(s.short)}</text></g>`;}).join('');
 const dests=sys.filter(s=>s.key!==cur.key);
 return `<div class="th-map-head"><b>星図 · コア・ワールドとアウター・リム</b><button type="button" class="th-btn" data-trial-cmd="map">閉じる</button></div>
 <svg class="tm-svg" viewBox="0 0 400 240" role="img" aria-label="星図。コア・ワールドのコルサント・クワット・コレリアと、アウター・リムのジオノーシス・ベスピン・ホスがハイパーレーンで結ばれている"><defs><radialGradient id="tmCore" cx="${core[0]/4}%" cy="${core[1]/2.4}%" r="62%"><stop offset="0" stop-color="#fff3cf" stop-opacity=".9"/><stop offset=".1" stop-color="#ffcd7d" stop-opacity=".5"/><stop offset=".34" stop-color="#5d72ad" stop-opacity=".2"/><stop offset="1" stop-color="#060a14" stop-opacity="0"/></radialGradient></defs>
 <rect width="400" height="240" fill="#060a14"/><rect width="400" height="240" fill="url(#tmCore)"/>
 ${[80,150,225,300].map(r=>`<circle class="tm-grid" cx="${core[0]}" cy="${core[1]}" r="${r}"/>`).join('')}
 <path class="tm-arm" d="M-10 64 C 90 20, 250 10, 410 60"/><path class="tm-arm" d="M120 250 C 200 200, 320 180, 410 196"/>
 <text class="tm-region" x="${core[0]-30}" y="${core[1]+26}">ディープ・コア</text><text class="tm-region" x="184" y="186">コア・ワールド</text><text class="tm-region" x="392" y="132" text-anchor="end">アウター・リム</text>
 ${lanes}${marks}</svg>
 <p class="th-map-note">${hc==null?'この艦にはハイパードライブがありません。':`ハイパードライブ クラス ${num(hc,1)} · 超空間 約 ${Math.round(jumpSeconds(hc,'coruscant','kuat'))}〜${Math.round(jumpSeconds(hc,'coruscant','hoth'))} 秒（演習時間・遠い星系ほど長い）。全速から亜光速まで加速し、星空が放射状に引き伸ばされてハイパースペースへ。ジャンプ中は射撃できません。${inBattle?'戦闘中にジャンプすると戦域から離脱し、僚艦も続きます。':''}`}</p>
 <div class="th-map-go">${dests.map(s=>`<button type="button" class="th-btn th-jumpbtn" data-trial-cmd="jump:${s.key}" ${hc==null?'disabled':''}>${inBattle?'離脱して':''}${esc(s.name)}へ${hc==null?'':`（${Math.round(jumpSeconds(hc,cur.key,s.key))} 秒）`}</button>`).join('')}</div>`;
}
function trialMapShow(on){const m=$('#thMap');if(!m)return;if(on==null)on=m.hidden;if(on)m.innerHTML=trialMapHTML();m.hidden=!on;document.querySelector('[data-trial-cmd="map"].th-mapbtn')?.setAttribute('aria-expanded',String(on));}

// ---------- space battle ----------
// The flagship is flown with the trial controls; escorts and the enemy fight on
// the fleet model in a frame anchored where the battle began (x ahead, y up).
// Enemy ships drop out of hyperspace a few seconds in. The player's bolts and
// missiles land as damage on the model; enemy fire lands on the flagship's
// shields, armour and modules, which switch off its turrets, power and engines.
// The fleet model's damage and shield recharge are both scaled down, which
// slows the whole exchange about 2.5× without changing who wins: a flagship
// under the guns of two ships lasts a couple of minutes rather than forty seconds.
const SPACE_RULES={range:TRIAL_GUN.range,engagementDistance:12000,step:.25,damage:.7};
function spaceBattleInit(plan){
 const O=[...trial.P],E=trialFrame(trialCol(trial.R,0),tv.norm(trial.P)),me=C.fleetUnit('me',trial.asset.key,trial.p,0);
 me.manual=true;me.name=trial.p.name;me.order={...me.order,power:trial.powerMode,volley:trial.volley==='salvo'?'salvo':'stream'};const units=[me],L0=trial.p.len,W0=trial.p.width||L0*.5,H0=trial.p.height||L0*.25;
 // (v20.6 escorts also stand above and below the flagship's plane by turns, clear of one another)
 plan.escorts.forEach((x,i)=>{const u=C.fleetUnit('a'+i,x.key,x.p,0),row=Math.floor(i/2)+1,side=i%2?1:-1,gy=Math.max(x.p.height||x.p.len*.25,H0)*1.3+120;u.name=x.name;u.order={...u.order,power:x.order?.power||'auto',aim:x.order?.aim||'auto',volley:x.order?.volley==='salvo'?'salvo':'stream'};u.pos=[-row*Math.max(x.p.len,L0)*1.4,(row%2?1:-1)*gy*.5,side*(Math.max(x.p.width||x.p.len*.5,W0)*1.3+row*600)];units.push(u);});
 // The enemy drops out ahead and to starboard on a slant toward the flagship, so
 // the streaks are seen side-on, in an echelon one ship after another. They
 // arrive a little above the flagship's plane, where dorsal batteries bear.
 const n=plan.foes.length;plan.foes.forEach((x,i)=>{const u=C.fleetUnit('e'+i,x.key,x.p,1),gap=Math.max(2600,x.p.len*2.2);u.name=x.name;u.pos=[17000+i*gap*.55,500+(i%3)*450,5000+i*gap*.8];u.yaw=-Math.PI*.8;u.absent=true;u.warp={at:3+i*.6,t:0};units.push(u);});
 const b=C.fleetBattle(units,true);b.seed=(Math.random()*2**31)|0;
 trial.battle={b,O,E,acc:0,extra:new Map(),seen:0,result:null,orderT:0,me,plan,ticker:[],modIndex:new Map((trial.p.modules||[]).map((m,i)=>[m.fit,i]).filter(([f])=>f!=null)),kills:0,disabled:0};
 trial.targets=[];trial.vbolts=[];spaceRefresh(0);
}
const spaceRot=(E,yaw)=>{const c=Math.cos(yaw),s=Math.sin(yaw),a=trialApply(E,[c,0,s]),b=trialApply(E,[0,1,0]),d=trialApply(E,[-s,0,c]);return [...a,...b,...d];};
// World position of a unit, carried forward by its velocity between model steps.
function spaceWorld(u,lead=0){const B=trial.battle;if(u.manual)return trial.P;return tv.add(B.O,trialApply(B.E,tv.add(u.pos,u.velocity||[0,0,0],B.acc+lead)));}
function spaceVel(u){return u.manual?trial.V:trialApply(trial.battle.E,u.velocity||[0,0,0]);}
function spaceHullPoint(u,k){const L=u.p.len,W=u.p.width||L*.5,H=u.p.height||L*.2,R=u.manual?trial.R:spaceRotU(trial.battle.E,u),c=u.manual?tv.sub(trial.P,[0,0,0]):spaceWorld(u);return tv.add(c,trialApply(R,[(Math.random()-.5)*L*k*2,(Math.random()-.3)*H*.5,(Math.random()-.5)*W*.6]));}
// Enemy ships become gunnery targets: an ellipsoid of the ship's own size.
// Our own ships are targets too, though never picked or locked: a bolt that
// strikes one damages it (friendly fire).
function spaceRefresh(){
 const B=trial.battle;if(!B)return;const live=new Map(trial.targets.map(t=>[t.id,t]));trial.targets=[];const mine=B.me?.team??0;
 for(const u of B.b.units){if(u.manual||u.dead||u.absent||(u.team!==1&&!B.me)||B.rts&&u.warp&&u.warp.t<0)continue;const t=live.get(u.id)||{id:u.id,ship:true,unit:u,hits:0};
  Object.assign(t,{alive:true,ally:u.team===mine,pos:spaceWorld(u),vel:spaceVel(u),rot:spaceRotU(B.E,u),radius:u.p.len*.5,semi:[u.p.len*.5,(u.p.height||u.p.len*.2)*.5,(u.p.width||u.p.len*.5)*.5]});trial.targets.push(t);}
}
function spaceSync(){const B=trial.battle,me=B.me,loc=w=>trialApplyT(B.E,w);me.pos=loc(tv.sub(trial.P,B.O));me.velocity=loc(trial.V);const f=loc(trialCol(trial.R,0));me.yaw=Math.atan2(f[2],f[0]);me.order={...me.order,power:trial.powerMode};}
// v21.1 The flagship's escorts guard it (order 'escort': between it and the threat, firing first on whoever fires
// on it, screening its bridge) unless the player frees them to attack (T / 随伴艦 button: trial.escortFree).
function trialEscortMode(free){trial.escortFree=free==null?!trial.escortFree:!!free;const B=trial.battle;if(B)spaceOrders(B.b);toast(trial.escortFree?'随伴艦：自由攻撃 — 近い敵から攻撃します':'随伴艦：護衛 — 旗艦と敵のあいだに入り、旗艦を狙う敵を優先して撃ちます');}
function spaceOrders(b){const me=trial.battle?.me;for(const u of b.units){if(u.manual||u.dead||u.out||u.absent)continue;if(me&&!me.dead&&u.team===me.team&&!trial.escortFree&&!trial.rts){u.order={...u.order,type:'escort',target:me.id,fire:true,launch:true};continue;}const foes=b.units.filter(t=>t.team!==u.team&&!t.dead&&!t.absent).sort((a,z)=>(!!a.out-!!z.out)||C.len(C.sub(a.pos,u.pos))-C.len(C.sub(z.pos,u.pos)));u.order={...u.order,type:foes.length?'attack':'hold',target:foes[0]?.id,fire:true,launch:true};}}
// A bolt of the piloted ship lands on the zone (section and face) it struck.
function spaceDamage(u,tt,kind,q,t){const B=trial.battle;if(!B||B.result)return;tt*=SPACE_RULES.damage;const x=B.extra.get(u.id)||{sf:0,hull:0,direct:0,ion:0,aim:{},from:null,src:B.me?.id};
 // h: what this hit brings to the armour (hull share plus the part that bypasses shields).
 let h;if(kind==='ion'){x.sf+=C.COMBAT.ionShield*tt;x.hull+=C.COMBAT.ionHull*tt;x.ion+=tt;h=C.COMBAT.ionHull*tt;}else if(kind==='missile'){x.sf+=.5*tt;x.hull+=.5*tt;x.direct+=.5*tt;h=tt;}else{x.sf+=tt;x.hull+=tt;h=tt;}
 x.aim.auto=(x.aim.auto||0)+h+.1*tt;if(B.me)x.from=[...B.me.pos];
 if(q&&t?.rot&&t.semi){const z=C.combatZoneAt(u.p,trialApplyT(t.rot,tv.sub(q,t.pos)),t.semi);x.zw=x.zw||new Array(30).fill(0);x.zw[z]+=h;}
 B.extra.set(u.id,x);}
function spaceImpact(pos,vel,u,size){const sh=u&&u.shield>0;sndAt(sh?'hit_shield':'hit_hull',pos,{gain:.7});for(let k=0;k<(sh?5:7);k++)trial.fx.push({pos,vel:tv.add(vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),30+Math.random()*90)),life:sh?.35:.6,max:sh?.35:.6,size:size*(sh?1.3:.9),col:sh?[120,190,255]:[255,170+(Math.random()*50|0),90]});}
function trialExplosion(pos,vel,L,big){
 sndAt(big?'ship_destroyed':'explosion_large',pos,{near:Math.max(1500,L*2),far:Math.max(60000,L*40),gain:1});
 trial.fx.push({pos,vel,life:big?1.1:.7,max:big?1.1:.7,size:L*(big?3.2:1.6),col:[255,250,235]});
 for(let k=0;k<(big?160:90);k++){const d=tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),sp=L*(.3+Math.random()*(big?2.6:1.4));trial.fx.push({pos,vel:tv.add(vel,d,sp),life:1.4+Math.random()*1.4,max:2.8,size:L*(.06+Math.random()*.14),col:k%5===0?[150,155,165]:[255,150+(Math.random()*90|0),70]});}
 if(big)for(let k=0;k<72;k++){const a=k/72*Math.PI*2,d=[Math.cos(a),(Math.random()-.5)*.08,Math.sin(a)];trial.fx.push({pos,vel:tv.add(vel,d,L*3.5),life:1.2,max:1.2,size:L*.12,col:[190,220,255]});}
}
// ---------- attitude, fires and wrecks (v17) ----------
// A ship's attitude in a battle: its heading, the bow raised or lowered with
// its climb, a little bank in a turn and — disabled — the bow dropping as it
// falls. Smoothed per ship, since the battle model moves in quarter seconds;
// the last velocity seen alive is kept for its wreck.
const spaceAtt=new WeakMap(),m3Mul=(A,B)=>{const o=new Array(9);for(let c=0;c<3;c++)for(let r=0;r<3;r++)o[c*3+r]=A[r]*B[c*3]+A[3+r]*B[c*3+1]+A[6+r]*B[c*3+2];return o;};
function spaceAttStep(dt){
 const B=trial.battle;if(!B)return;const k=1-Math.exp(-Math.max(0,dt)*1.6);
 for(const u of B.b.units){if(u.manual||u.dead)continue;let a=spaceAtt.get(u);if(!a){a={p:0,r:0,v:[0,0,0]};spaceAtt.set(u,a);}
  const v=u.velocity||[0,0,0],h=Math.hypot(v[0],v[2]);let p=0,r=0;
  if(u.fall){p=-u.fall.pitch;r=u.fall.roll*Math.min(1,u.fall.t/25);}
  else if(!u.out&&!u.towedBy){p=C.clamp(Math.atan2(v[1],Math.max(80,h))*.7,-.32,.32);r=C.clamp(-(u.turnK||0)*.1,-.12,.12);}
  a.p+=(p-a.p)*k;a.r+=(r-a.r)*k;a.v=[...v];}
}
function spaceRotU(E,u){
 const R=spaceRot(E,u.yaw),a=spaceAtt.get(u);if(!a||Math.abs(a.p)+Math.abs(a.r)<1e-4)return R;
 const f=trialCol(R,0),up=trialCol(R,1),sd=trialCol(R,2),cp=Math.cos(a.p),sp=Math.sin(a.p),f1=tv.add(tv.scale(f,cp),up,sp),u1=tv.add(tv.scale(up,cp),f,-sp),cr=Math.cos(a.r),sr=Math.sin(a.r);
 return [...f1,...tv.add(tv.scale(u1,cr),sd,sr),...tv.add(tv.scale(sd,cr),u1,-sr)];
}
// Points on a design's skin where fires show, by hull section (stern to bow),
// sampled once from its geometry (relative to the model's centre).
const fireAnchorCache=new Map();
function fireAnchors(key,p){
 const hit=fireAnchorCache.get(key);if(hit)return hit;
 const asset=key===trial.asset?.key?trial.asset:fleet.assets.get(key),g=asset?.geometry,a=view?.fleetCache?.get(key);if(!g?.meshes||!a?.bounds)return null;
 const b=a.bounds,c=a.center,L=Math.max(1,b[3]-b[0]),cuts=p?.sectionCuts||[.2,.4,.6,.8],N=cuts.length+1,out=Array.from({length:N},()=>[]);
 for(const name of ['hull','refHull','struct','plate','refStruct']){const geo=g.meshes[name]?.geo;if(!geo?.pos||!geo.nor)continue;const n=geo.pos.length/3,step=Math.max(1,Math.floor(n/500));
  for(let i=0;i<n;i+=step){const ny=geo.nor[i*3+1]/127;if(ny<-.35)continue;const x=geo.pos[i*3],y=geo.pos[i*3+1],z=geo.pos[i*3+2],nx=geo.nor[i*3]/127,nz=geo.nor[i*3+2]/127,at=(x-b[0])/L;let si=0;while(si<cuts.length&&at>=cuts[si])si++;
   out[si].push([x-c[0]+nx*3,y-c[1]+ny*3,z-c[2]+nz*3]);}}
 for(let si=0;si<N;si++){const l=out[si];if(l.length>28){const k=l.length/28;out[si]=Array.from({length:28},(_,j)=>l[Math.floor(j*k+((j*7)%3)*k/3)]);}}
 fireAnchorCache.set(key,out);return out;
}
const fireHash=(a,b)=>{let h=(a*374761393+b*668265263)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0)/4294967296;};
// Flames on the hull of a burning ship, held to the plating where the fire is
// (no trail): a white-yellow core and an orange glow, flickering, shifting
// from one spot to the next every few seconds within the burning section.
function fireEmit(out,key,p,pos,R,fire,L,seed,now){
 const A=fireAnchors(key,p);if(!A)return;
 for(let si=0;si<fire.length;si++){const f=fire[si];if(!(f>0))continue;const list=A[si]||[];if(!list.length)continue;const n=Math.min(list.length,2+Math.round(f*6));
  for(let j=0;j<n;j++){const ep=Math.floor(now/3.2+j*.37+seed*.01),q=list[Math.floor(fireHash(seed*31+si,j*977+ep)*list.length)],w=tv.add(pos,trialApply(R,q)),fl=.72+.18*Math.sin(now*13.1+j*1.7+seed)+.1*Math.sin(now*29.3+j*3.1),s=C.clamp(L*.042,10,150)*(.55+f*.9)*fl;
   out.push([w,[255,226,150,235],s*.5],[w,[255,104,34,150],s*1.7]);}}
}
// Re-entry: a disabled ship deep in its fall glows along its underside.
function fireReentry(out,key,p,pos,R,depth,L,now){
 const k=C.clamp((depth-22000)/35000,0,1);if(!(k>0))return;const A=fireAnchors(key,p);if(!A)return;const all=A.flat();if(!all.length)return;
 const low=all.slice().sort((a,b)=>a[1]-b[1]).slice(0,Math.max(4,Math.floor(all.length*.2)));
 for(let j=0;j<Math.min(10,low.length);j++){const q=low[Math.floor(j*low.length/10)],w=tv.add(pos,trialApply(R,q)),s=C.clamp(L*.05,12,160)*(.5+k)*(.85+.15*Math.sin(now*17+j));out.push([w,[255,170+Math.round(60*k),110,200],s],[w,[255,90,30,140],s*2.2]);}
}
// ---- wrecks ----
// How a ship dies decides what is left of it: a broken hull (船体破断) parts at
// its failed sections and the pieces tumble down toward the planet, glowing
// where they tore; a detonation — reactor, reactant, magazine or scuttling
// charges — throws it apart in burning chunks; a ship lost in its fall flares
// and is gone. Wrecks are only seen: the battle model is done with them.
const WRECK={breakG:3,chunkG:1.2,life:95,chunkLife:40,seamT:24};
function spaceWreck(u){
 const B=trial.battle;if(!B||!view)return;const key=u.manual?trial.asset?.key:u.key,a=view.fleetCache?.get(key);
 const pos=u.manual?[...trial.P]:spaceWorld(u),att=spaceAtt.get(u),vel=u.manual?[...trial.V]:trialApply(B.E,att?.v||u.velocity||[0,0,0]),R=u.manual?[...trial.R]:spaceRotU(B.E,u),L=u.p.len;
 const fate=u.fate||'hull',boom=['reactor','fuel','magazine','scuttle'].includes(fate);
 if(fate==='fall'){trialExplosion(pos,vel,L*.6,false);trial.flash=Math.max(trial.flash||0,.15);return;}
 trialExplosion(pos,vel,L,boom&&fate!=='scuttle');if(!a?.bounds)return;
 const b=a.bounds,c=a.center,X0=b[0],X1=b[3],span=Math.max(1,X1-X0),cuts=(u.p.sectionCuts||[.2,.4,.6,.8]).map(k=>X0+k*span),N=cuts.length+1,secX=i=>[i?cuts[i-1]:X0-1,i<cuts.length?cuts[i]:X1+1],lost=new Set(u.secLost||[]);
 const down=tv.norm(tv.scale(pos,-1)),fwd=trialCol(R,0),side=trialCol(R,2),up=trialCol(R,1),seed=Math.random()*1000,pieces=[];
 const piece=(lo,hi,o)=>{const cm=[(Math.max(lo[0],X0)+Math.min(hi[0],X1))/2,(Math.max(lo[1],b[1])+Math.min(hi[1],b[4]))/2,(Math.max(lo[2],b[2])+Math.min(hi[2],b[5]))/2],w=tv.add(pos,trialApply(R,tv.sub(cm,c)));
  pieces.push({key,c:cm,lo,hi,pos:w,vel:tv.add(vel,o.v||[0,0,0]),rot:[...R],axis:tv.norm(o.axis||[0,1,0]),rate:o.rate||0,t:0,life:o.life,g:o.g,seam:[lo[0]>X0?lo[0]:-1e9,hi[0]<X1?hi[0]:1e9,Math.max(4,span*.018),1],seamT:o.seamT||WRECK.seamT,char:o.char??.55,L:Math.max(40,Math.min(hi[0],X1)-Math.max(lo[0],X0)),p:u.p,secs:o.secs||[],fire:o.fire??1,seed:seed+pieces.length*17,boomT:o.boomT??(2+Math.random()*4)});};
 const B9=1e9;
 if(!boom){
  // The hull parts at its failed sections: each run of standing sections is a piece; what was lost goes as two smaller halves.
  const runs=[];let cur=null;for(let i=0;i<N;i++){if(lost.has(i)){cur=null;continue;}if(!cur){cur=[i,i];runs.push(cur);}else cur[1]=i;}
  if(!runs.length||(runs.length===1&&lost.size===0)){const mid=Math.floor(N/2);runs.length=0;runs.push([0,mid-1],[mid+1,N-1]);lost.add(mid);}
  const breakX=[...lost].map(i=>(secX(i)[0]+secX(i)[1])/2),bx=breakX.length?breakX.reduce((s,x)=>s+x,0)/breakX.length:(X0+X1)/2;
  for(const [i0,i1] of runs){const lo=[secX(i0)[0],-B9,-B9],hi=[secX(i1)[1],B9,B9],cx=(Math.max(lo[0],X0)+Math.min(hi[0],X1))/2,dir=Math.sign(cx-bx)||1,sp=C.clamp(L*.012,4,30);
   // The halves move apart along the old keel and pitch down at the break, like a ship broken in two.
   piece(lo,hi,{v:tv.add(tv.scale(fwd,dir*sp),down,sp*.3),axis:tv.add(tv.scale(side,-dir),fwd,(Math.random()-.5)*.3),rate:.012+Math.random()*.02,life:WRECK.life,g:WRECK.breakG,secs:Array.from({length:i1-i0+1},(_,k)=>i0+k)});}
  for(const i of lost){const [x0,x1]=secX(i),zs=(b[2]+b[5])/2;for(const s of [-1,1]){piece([x0,-B9,s<0?-B9:zs],[x1,B9,s<0?zs:B9],{v:tv.add(tv.add(tv.scale(side,s*C.clamp(L*.02,6,50)),up,(Math.random()-.3)*L*.01),down,L*.004),axis:[Math.random()-.5,Math.random()-.5,Math.random()-.5],rate:.05+Math.random()*.08,life:WRECK.life*.8,g:WRECK.breakG,secs:[i],char:.75});}}
 }else{
  // Detonation: every section flies apart, the broad ones in halves, outward from the blast.
  const sp0=fate==='scuttle'?.03:.07,zs=(b[2]+b[5])/2,ys=(b[1]+b[4])/2;
  for(let i=0;i<N;i++){const [x0,x1]=secX(i),halves=(x1-x0)>span*.12&&(b[5]-b[2])>span*.18;
   for(const s of halves?[-1,1]:[0]){const lo=[x0,-B9,s>0?zs:-B9],hi=[x1,s<0&&halves?B9:B9,s<0&&halves?zs:B9],cm=[(Math.max(x0,X0)+Math.min(x1,X1))/2,ys,s?zs+s*(b[5]-b[2])*.25:zs],out=tv.norm(tv.add(trialApply(R,tv.sub(cm,c)),[(Math.random()-.5)*L*.2,(Math.random()-.5)*L*.2,(Math.random()-.5)*L*.2])),sp=L*sp0*(.6+Math.random()*.9);
    piece(lo,hi,{v:tv.scale(out,sp),axis:[Math.random()-.5,Math.random()-.5,Math.random()-.5],rate:.08+Math.random()*.35,life:WRECK.chunkLife+Math.random()*15,g:WRECK.chunkG,seamT:10,char:.8,secs:[i],boomT:1+Math.random()*3});}}
 }
 // Each piece keeps the flames near its torn edges.
 for(const q of pieces){const A=fireAnchors(key,u.p);q.fl=[];if(A)for(const si of q.secs)for(const an of A[si]||[]){const x=an[0]+c[0];if(Math.abs(x-q.seam[0])<span*.08||Math.abs(x-q.seam[1])<span*.08)q.fl.push(an);}if(!q.fl.length&&A)for(const si of q.secs)q.fl.push(...(A[si]||[]).slice(0,6));}
 (trial.wrecks=trial.wrecks||[]).push(...pieces);if(trial.wrecks.length>90)trial.wrecks.splice(0,trial.wrecks.length-90);
 shotSoon('wreck',.5);
}
function trialWrecksStep(dt){
 const ws=trial.wrecks;if(!ws?.length)return;
 for(const q of ws){q.t+=dt;q.pos=tv.add(q.pos,q.vel,dt);q.vel=tv.add(q.vel,tv.norm(tv.scale(q.pos,-1)),q.g*dt);if(q.rate){const R=trialAxisMatrix(q.axis,q.rate*dt);q.rot=m3Mul(R,q.rot);}
  q.seam[3]=Math.max(0,1-q.t/q.seamT);
  // Secondary explosions while the fires still reach something.
  if(q.t<20&&(q.boomT-=dt)<=0){q.boomT=1.5+Math.random()*5;const an=q.fl?.length?q.fl[Math.floor(Math.random()*q.fl.length)]:null,a=view?.fleetCache?.get(q.key);if(an&&a){const w=tv.add(q.pos,trialApply(q.rot,tv.sub(tv.add(an,a.center),q.c))),L=Math.max(30,q.L*.15);trial.fx.push({pos:w,vel:q.vel,life:.5,max:.5,size:L*1.4,col:[255,236,200]});for(let k=0;k<14;k++)trial.fx.push({pos:w,vel:tv.add(q.vel,tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),L*(.4+Math.random()*1.2)),life:.8+Math.random()*.8,max:1.6,size:L*(.08+Math.random()*.1),col:[255,150+(Math.random()*80|0),60]});}}}
 trial.wrecks=ws.filter(q=>q.t<q.life&&tv.len(tv.sub(q.pos,trial.P))<4e5);
}
// Wreck pieces as the renderer draws them (relative to the camera's ship).
function spaceWreckDraw(){return (trial.wrecks||[]).map(q=>({key:q.key,pos:tv.sub(q.pos,trial.P),rot:q.rot,center:q.c,clip:{lo:q.lo,hi:q.hi},seam:q.seam,char:q.char,wreck:true,glow:0,hatchOpen:0,dead:false,stretch:1,flash:0}));}
// Fires of wreck pieces: along the torn edges, dying down.
function wreckFireEmit(out,now){
 for(const q of trial.wrecks||[]){if(!q.fl?.length)continue;const a=view?.fleetCache?.get(q.key);if(!a)continue;const k=Math.max(0,1-q.t/(q.life*.8));if(!(k>0))continue;const n=Math.min(q.fl.length,2+Math.round(5*k));
  for(let j=0;j<n;j++){const an=q.fl[Math.floor(fireHash(q.seed,j*131+Math.floor(now/2.6+j*.41))*q.fl.length)],w=tv.add(q.pos,trialApply(q.rot,tv.sub(tv.add(an,a.center),q.c))),fl=.7+.2*Math.sin(now*12.7+j*2.3+q.seed)+.1*Math.sin(now*31+j),s=C.clamp(q.p.len*.04,10,140)*(.5+k)*fl;
   out.push([tv.sub(w,trial.P),[255,220,140,230],s*.5],[tv.sub(w,trial.P),[255,96,30,150],s*1.6]);}}
}
// Every flame in view this frame: burning ships, the flown ship, falling
// ships glowing with re-entry, and the wrecks (positions relative to trial.P).
function spaceFires(now){
 const out=[],B=trial.battle;if(!B||!view)return out;
 for(const u of B.b.units){if(u.dead||u.absent||u.hidden)continue;let pos,R,key;
  if(u.manual){pos=[0,0,0];R=trial.R;key=trial.asset?.key;}else{pos=tv.sub(spaceWorld(u),trial.P);if(tv.len(pos)>3e5)continue;R=spaceRotU(B.E,u);key=u.key;}
  if(u.fire?.some(f=>f>0))fireEmit(out,key,u.p,pos,R,u.fire,u.p.len,fireHash(String(u.id).length*977+String(u.id).charCodeAt(String(u.id).length-1),3)*997,now);
  if(u.fall&&!u.manual)fireReentry(out,key,u.p,pos,R,-u.pos[1],u.p.len,now);}
 wreckFireEmit(out,now);
 return out;
}
// Sparks where two hulls met.
const bumpSeen=new WeakSet();
function spaceBumps(list){
 const B=trial.battle;if(!B)return;for(const x of list||[]){if(!x||bumpSeen.has(x))continue;bumpSeen.add(x);const w=tv.add(B.O,trialApply(B.E,x.point)),n=C.clamp(Math.round(x.vn/4),4,40);sndAt('hit_hull',w,{gain:Math.min(1,.3+x.vn/30)});
  for(let k=0;k<n;k++)trial.fx.push({pos:w,vel:tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),40+Math.random()*(60+x.vn*2)),life:.5+Math.random()*.6,max:1.1,size:10+x.vn*.25,col:[255,190+(Math.random()*50|0),120]});
  if(x.vn>15)trial.fx.push({pos:w,vel:[0,0,0],life:.4,max:.4,size:60+x.vn*1.5,col:[255,235,200]});}
}
// A collision of the flown ship: the model's share of the separation and of the
// impulse moves the flight model, with a jolt on the screen.
function spaceBump(me){
 const B=trial.battle,b=me?.bump;if(!b||!B)return;me.bump=null;
 trial.P=tv.add(trial.P,trialApply(B.E,b.dp));trial.V=tv.add(trial.V,trialApply(B.E,b.dv));trial.vf=tv.dot(trial.V,trialCol(trial.R,0));
 if(b.vn>C.HULL_HIT.min){trial.hitFlash=Math.min(1,(trial.hitFlash||0)+C.clamp(b.vn/60,.15,.8));if(performance.now()-(trial.bumpToast||0)>2500){trial.bumpToast=performance.now();toast(`衝突（相対速度 ${Math.round(b.vn)} m/s）`);}}
}
// A ship killed since the last frame (also ones scuttled from the maps) leaves its wreck.
function spaceDeaths(){
 const B=trial.battle;if(!B)return;const seen=B.deadSeen||(B.deadSeen=new Set());const list=B.rts?[...voy.w.units.values()].filter(u=>u.sys===trial.rts.sys||u.manual):B.b.units;
 for(const u of list){if(!u.dead||seen.has(u.id))continue;seen.add(u.id);if(B.started)spaceWreck(u);}
 B.started=true;
}
// Fire and debris age in every mode (flight, battle or a fleet battle watched in 3D).
function trialFxStep(dt){for(const e of trial.fx){e.pos=tv.add(e.pos,e.vel,dt);e.life-=dt;}trial.fx=trial.fx.filter(e=>e.life>0);if(trial.fx.length>3000)trial.fx.splice(0,trial.fx.length-3000);}
// ---------- v21 superweapons in the 3D battle ----------
// The flown ship's superweapons fire on command (the B key or the 超兵器 button): the composite beam at the enemy
// nearest the bow line inside its cone, the hyper-ion cannons at everything in their side's cone. The model's
// superweaponStep does the rest (charging, overload, damage) for every ship; this draws what it fires: the beam
// as a held line of light from the muzzle, the pulse as one bright streak with a flash, the ion ring as a
// widening violet ring travelling out from the emitter.
const trialSwKinds=()=>[...new Set(((trial.battle?.me||trial).p?.sw||[]).map(w=>w.k))];
const SW_STATE={charge:'充電',ready:'発射可',beam:'照射中',cool:'冷却',down:'損傷'};
function trialSwHud(q,set){
 const el=q('sw');if(!el)return;const me=trial.battle?trial.battle.me:trialSwSolo(),sw=me?.p?.sw||[],st=me?.sw||[];trialSwInfo(q,me);trialSwMenu();
 if(!me||!sw.length){el.disabled=true;set('swstate','—');return;}el.disabled=!!me.out;
 const ready=st.filter(x=>x.st==='ready').length,beam=st.some(x=>x.st==='beam'),cool=st.filter(x=>x.st==='cool'),chg=st.filter(x=>x.st==='charge');
 const f=ready||beam?1:chg.length?Math.max(...chg.map(x=>x.c)):cool.length?1-Math.min(...cool.map(x=>x.t))/C.SW_COMBAT[sw[0].k].over.T:0;
 el.style.setProperty('--fill',C.clamp(f,0,1).toFixed(3));el.classList.toggle('ready',ready>0);el.classList.toggle('firing',beam);
 const early=chg.some(x=>{const i=st.indexOf(x);return sw[i]?.k==='hion'&&x.c>=C.ION_BOLT.fireMin;});el.classList.toggle('ready',ready>0||early);
 set('swstate',beam?'照射中':ready?`発射可 ${ready}`:chg.length?`充電 ${Math.round(f*100)}%${early?'・発射可':''}`:cool.length?`冷却 ${Math.ceil(Math.min(...cool.map(x=>x.t)))} 秒`:st.some(x=>x.st==='down')?'損傷':'—');
 const m=q('swmode');if(m){const k=st.find((x,i)=>sw[i].k==='sbeam')?.mode||'beam',t=k==='pulse'?'パルス':'ビーム';if(m.textContent!==t)m.textContent=t;}
}
function trialSwMode(){const me=trial.battle?trial.battle.me:trialSwSolo();if(!me?.sw)return;const sw=me.p.sw,cur=me.sw.find((x,i)=>sw[i].k==='sbeam');if(!cur){toast('切り替えられる超兵器がありません');return;}const next=cur.mode==='pulse'?'beam':'pulse';me.sw.forEach((x,i)=>{if(sw[i].k==='sbeam')x.mode=next;});sndUI('ui_toggle',.5);toast(`超重合成ビーム：${next==='pulse'?'パルス一撃':'ビーム照射'}`);}
// In the flown ship's frame: the bearing of a ship from the muzzle, against the weapon's axis.
function trialSwTargets(w){
 const B=trial.battle,me=B.me,C0=C.SW_COMBAT[w.k],m=tv.add(trial.P,trialApply(trial.R,w.mz||[0,0,0])),ax=trialApply(trial.R,w.aim==='bow'?[1,0,0]:[0,0,w.aim==='port'?-1:1]),out=[];
 for(const u of B.b.units){if(u.team===me.team||u.dead||u.absent||u.warp)continue;const d=tv.sub(spaceWorld(u),m),r=tv.len(d);if(!(r>0)||r>C0.range+(u.p.len||0)*.5)continue;const c=tv.dot(d,ax)/r;if(c<=0)continue;const off=Math.acos(C.clamp(c,-1,1)),miss=r*Math.sin(off);
  if(off<=C0.cone||(w.aim==='bow'&&miss<=Math.max(u.p.width||u.p.len*.3,u.p.height||0)*.5))out.push({u,r,off});}
 return out.sort((a,b)=>a.off-b.off||a.r-b.r);
}
function trialSwFire(){
 const B=trial.battle,me=B?.me;if(!B){const u=trialSwSolo();if(u)trialSwSoloFire(u);else toast('超兵器がありません');return;}if(!me){toast('超兵器を使えません');return;}if(me.out){toast('自艦は戦闘不能です');return;}
 const sw=me.p.sw||[];let fired=0,waiting=0,none=0;
 sw.forEach((w,i)=>{const x=me.sw[i];if(!x||!(x.st==='ready'||w.k==='hion'&&x.st==='charge'&&x.c>=C.ION_BOLT.fireMin)){if(x&&x.st!=='down')waiting++;return;}const tg=trialSwTargets(w);if(!tg.length){none++;return;}x.fireNow={to:w.k==='hion'?tg.map(t=>t.u.id):[tg[0].u.id]};fired++;});
 if(fired){sndUI('ui_click',.4);return;}toast(none?'射線・射界に敵艦がいません':waiting?'充電中です':'超兵器を使えません');
}
// While the flown ship holds a beam, it stays on target only while the target stays in the cone.
function trialSwBeamCheck(){const me=trial.battle?.me;if(!me?.sw||!me.p?.sw)return;me.p.sw.forEach((w,i)=>{const x=me.sw[i];if(x?.st!=='beam')return;x.beamOk=trialSwTargets(w).some(t=>t.u.id===x.tgt);});}
// The views' record of superweapon shots: a beam is renewed each step it holds; the others fade on their own.
function swShotFx(s,byId){
 const a=byId.get(s.from),w=a?.p?.sw?.[s.i];if(!a||!w)return;trial.swfx=trial.swfx||[];
 if(s.mode==='beam'){const e=trial.swfx.find(e=>e.from===a.id&&e.i===s.i&&e.mode==='beam');if(e){e.life=SPACE_RULES.step*1.6;e.to=s.to[0];return;}}
 const life=s.mode==='bolt'?(s.dur||20):s.mode==='beam'?SPACE_RULES.step*1.6:s.mode==='pulse'?.7:2.2;trial.swfx.push({from:a.id,i:s.i,k:s.k,mode:s.mode,bolt:s.bolt,to:s.mode==='ring'?s.to:s.to[0],life,max:life,age:0});
 const at=a.manual?trial.P:spaceWorld(a);sndAt(s.k==='hion'?sndPick('ion_heavy','ion'):sndPick('turbolaser_heavy','turbolaser'),at,{gain:1.3,pitch:s.k==='hion'?.55:s.mode==='pulse'?.6:.75,near:Math.max(3000,a.p.len*2),far:90000});
 if(a.manual)trial.flash=Math.min(1,(trial.flash||0)+.5);
}
// v21.2 A point of the battle frame in the trial's world, and the sprites of an ion bolt's disc (relative to P).
function spaceWorldPos(p){const B=trial.battle;return tv.add(B.O,trialApply(B.E,p));}
// Drawn facing the camera (it reads as the glowing ball of the films from any side; the hits use the disc).
function ionBoltPoints(o,dir,x,D,k,age){const out=[],P=trial.P,c=tv.add(o,dir,x),eye=view?.eye?view.eye():[0,0,0],cr=tv.sub(c,P),vd=tv.norm(tv.sub(cr,eye)),v=tv.norm(Math.abs(vd[1])<.9?tv.cross(vd,[0,1,0]):tv.cross(vd,[1,0,0])),v2=tv.cross(vd,v),R=D/2,a=Math.round(240*clamp01(.4+.6*k)),fl=.85+.15*Math.sin(age*37);
 const at=(an,r)=>tv.add(cr,tv.add(tv.scale(v,Math.cos(an)*r),tv.scale(v2,Math.sin(an)*r))),seed=j=>{const q=Math.sin(j*12.9898+Math.floor(age*12)*78.233)*43758.5453;return q-Math.floor(q);};
 // the rim: a dense crackling ring, two layers
 const n=Math.min(260,Math.max(80,Math.round(D/12)));for(let j=0;j<n;j++){const an=j/n*Math.PI*2+age*.6,rr=R*(.94+.06*seed(j));out.push([at(an,rr),[200,160,255,a],Math.max(36,D*.05)*fl]);if(j%3===0)out.push([at(an+.01,rr*.9),[150,110,255,Math.round(a*.6)],Math.max(60,D*.09)]);}
 // lightning: jagged strands from the core out to the rim, re-struck a dozen times a second
 for(let s2=0;s2<16;s2++){let an=s2/16*Math.PI*2+seed(s2+100)*.5,r=0;for(let j=0;j<10;j++){r+=R/10;an+=(seed(s2*17+j)-.5)*.6;out.push([at(an,r),[240,228,255,Math.round(a*(.95-j*.04))],Math.max(22,D*.028)*fl]);}}
 // sparks inside, the white core and the violet haze
 for(let j=0;j<60;j++)out.push([at(seed(j+300)*Math.PI*2,R*Math.sqrt(seed(j+600))),[225,205,255,Math.round(a*.7)],Math.max(16,D*.02)]);
 out.push([cr,[255,252,255,a],Math.max(160,D*.45)*fl]);out.push([cr,[200,150,255,Math.round(a*.55)],Math.max(260,D*.8)]);out.push([cr,[140,90,255,Math.round(a*.3)],Math.max(400,D*1.25)]);
 return out;}
const clamp01=v=>v<0?0:v>1?1:v;
function swMuzzleWorld(u,w){const R=u.manual?trial.R:spaceRotU(trial.battle.E,u),c=u.manual?trial.P:spaceWorld(u);return tv.add(c,trialApply(R,w.mz||[0,0,0]));}
function swAxisWorld(u,w){const R=u.manual?trial.R:spaceRotU(trial.battle.E,u);return trialApply(R,w.aim==='bow'?[1,0,0]:[0,0,w.aim==='port'?-1:1]);}
// ---------- v21.2 superweapons on a trial flight (no battle) ----------
// Without a battle the flown ship has no fleet unit, so it keeps one of its own (trial.swSolo) with the charge
// states the battle model keeps: a weapon charges from the reactor it is wired to (and that share of the reactor's
// output is gone from the flight's power while it does: trialPowerStep asks C.swPower), holds a shot ready, fires
// on B or the button, cools, and leaves its reactor overloaded for over.T seconds, recovering. The ship leaves on
// its trial charged (topped up in the yard). What it strikes are the target buoys and the drones: the beam burns
// its target through and ends (as it ends when its target goes in a battle), the pulse destroys it at once, and the
// ion ring stops the buoys it sweeps for `down` seconds and knocks the drones out (they come back later).
const TRIAL_SW={start:1,burn:.45,ring:16000,droneDown:10};let trialSoloBoltSeq=0;
function trialSwSolo(){
 const sw=trial.p?.sw;if(trial.battle||!sw?.length)return null;let u=trial.swSolo;
 if(!u||u.p!==trial.p)u=trial.swSolo={id:'me',manual:true,name:trial.p.name,p:trial.p,sw:sw.map(w=>({c:TRIAL_SW.start,st:TRIAL_SW.start>=1?'ready':'charge',t:0,mode:w.mode||'beam',tgt:null})),over:[],down:null};
 return u;
}
// Share of the reactor's output the flight keeps (charging and overload take the rest).
const trialSwPowerK=()=>!trial.battle&&trial.swSolo?C.swPower(trial.swSolo):1;
// Whatever the flown ship's superweapons could strike: the enemy's ships in a battle, else the buoys and drones.
// reach: added to the range (half the target's size); line: how far from the beam's line it may still be struck.
function trialSwObjects(){
 const B=trial.battle;
 if(B){const me=B.me;if(!me)return [];return B.b.units.filter(u=>u.team!==me.team&&!u.dead&&!u.absent&&!u.warp).map(u=>({ref:u,pos:spaceWorld(u),reach:(u.p.len||0)*.5,line:Math.max(u.p.width||u.p.len*.3,u.p.height||0)*.5,name:shipTag(u.name),kind:'ship'}));}
 const Rt=trial.asset?.geometry?.targetRadius||60,out=[];
 for(const t of trial.targets)if(t.alive&&!t.ship&&!t.ally)out.push({ref:t,pos:t.pos,reach:Rt,line:Rt,name:'標的',kind:'buoy'});
 for(const d of trial.drones||[])if(d.alive)out.push({ref:d,pos:d.pos,reach:TRIAL_PD.radius.craft,line:TRIAL_PD.radius.craft,name:'標的機',kind:'drone'});
 return out;
}
// Each object as weapon w sees it from its muzzle: range r, angle off its axis, in range (rng), in its cone or
// across the beam's line (arc); ok = both (the battle's own test, trialSwTargets, asks the same).
function trialSwScan(w,objs=trialSwObjects()){
 const K=C.SW_COMBAT[w.k],m=tv.add(trial.P,trialApply(trial.R,w.mz||[0,0,0])),ax=trialApply(trial.R,w.aim==='bow'?[1,0,0]:[0,0,w.aim==='port'?-1:1]);
 return objs.map(o=>{const d=tv.sub(o.pos,m),r=tv.len(d)||1e-6,c=tv.dot(d,ax)/r,off=Math.acos(C.clamp(c,-1,1)),rng=r<=K.range+o.reach,arc=c>0&&(off<=K.cone||w.aim==='bow'&&r*Math.sin(off)<=o.line);return {o,w,r,off,rng,arc,ok:rng&&arc,d};});
}
function trialSwSoloFire(u){
 if(trial.jump){toast('ハイパードライブ中は超兵器を撃てません');return;}if(trial.paused){toast('一時停止中です（K で再開）');return;}
 const sw=u.p.sw,objs=trialSwObjects(),lk=trial.heldLock||trial.aim?.lock;let fired=0,waiting=0,none=0;
 sw.forEach((w,i)=>{const x=u.sw[i],K=C.SW_COMBAT[w.k];if(!(x.st==='ready'||w.k==='hion'&&x.st==='charge'&&x.c>=C.ION_BOLT.fireMin)){waiting++;return;}
  const tg=trialSwScan(w,objs).filter(s=>s.ok).sort((a,b)=>a.off-b.off||a.r-b.r);if(!tg.length){none++;return;}
  x.c=0;fired++;trial.gun.sw=(trial.gun.sw||0)+1;
  // v21.2 The hyper-ion cannon fires what it holds as a widening bolt toward the target nearest its axis.
  if(w.k==='hion'){const E=(w.Emax||K.E)*C.clamp(x.c,0,1),m=tv.add(trial.P,trialApply(trial.R,w.mz||[0,0,0])),dir=tv.norm(tv.sub(tg[0].o.ref.pos,m)),b={id:'sb'+(++trialSoloBoltSeq),o:m,dir,x:0,E,E0:E,d:w.d||310.8,hit:new Set()};
   x.st='cool';x.t=K.over.T;x.c=0;C.swOverload(u,w);(trial.soloBolts||(trial.soloBolts=[])).push(b);trial.swfx=trial.swfx||[];trial.swfx.push({solo:true,i,k:w.k,mode:'bolt',bolt:b.id,life:C.ION_BOLT.maxRange/C.ION_BOLT.v,max:C.ION_BOLT.maxRange/C.ION_BOLT.v,age:0});
   sndAt(sndPick('ion_heavy','ion'),trial.P,{gain:1.3,pitch:.55,near:Math.max(3000,trial.p.len*2),far:90000});trial.flash=Math.min(1,(trial.flash||0)+.5);return;}
  // The locked target when it is in the line of fire, else the one nearest the axis.
  const s=tg.find(s=>s.o.ref===lk)||tg[0];
  if(x.mode==='pulse'){x.st='cool';x.t=K.over.T;C.swOverload(u,w);trialSwSoloFx(i,w,'pulse',s.o.ref);trialSwStrike(s.o,'pulse');}
  else{x.st='beam';x.t=K.beamT;x.tgt=s.o.ref;x.burn=0;trialSwSoloFx(i,w,'beam',s.o.ref);}
 });
 if(fired){sndUI('ui_click',.4);return;}toast(none?'射界・射程内に目標がありません':waiting?'充電中です':'超兵器を使えません');
}
// The shot drawn (as swShotFx draws a battle's): a held beam is renewed while it lasts.
function trialSwSoloFx(i,w,mode,to){
 trial.swfx=trial.swfx||[];
 if(mode==='beam'){const e=trial.swfx.find(e=>e.solo&&e.i===i&&e.mode==='beam');if(e){e.life=.3;e.to=to;return;}}
 const life=mode==='beam'?.3:mode==='pulse'?.7:2.2;trial.swfx.push({solo:true,i,k:w.k,mode,to,at:mode==='pulse'&&to?.pos?[...to.pos]:null,life,max:life,age:0});
 sndAt(w.k==='hion'?sndPick('ion_heavy','ion'):sndPick('turbolaser_heavy','turbolaser'),trial.P,{gain:1.3,pitch:w.k==='hion'?.55:mode==='pulse'?.6:.75,near:Math.max(3000,trial.p.len*2),far:90000});
 trial.flash=Math.min(1,(trial.flash||0)+.5);
}
// What a shot does to a buoy or a drone.
function trialSwStrike(o,kind){
 const t=o.ref,g=trial.gun;if(!t||t.alive===false)return;const rnd=()=>tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),vel=t.vel||[0,0,0];
 if(kind==='ion'){
  if(o.kind==='drone'){t.alive=false;t.respawn=TRIAL_SW.droneDown;}else t.ionT=C.SW_COMBAT.hion.down;g.swDown=(g.swDown||0)+1;
  for(let k=0;k<16;k++)trial.fx.push({pos:tv.add(t.pos,rnd(),o.reach*Math.random()),vel:tv.add(vel,rnd(),20+Math.random()*60),life:1,max:1,size:Math.max(14,o.reach*.3),col:[185,160,255]});
  sndAt('hit_shield',t.pos,{gain:.6});return;}
 t.alive=false;t.ionT=0;g.swKills=(g.swKills||0)+1;if(o.kind==='drone')t.respawn=6;else{t.respawn=4;g.kills++;}
 trialExplosion(t.pos,vel,o.kind==='drone'?60:Math.max(80,o.reach*2.2),false);
}
function trialSwSoloStep(dt){
 const u=trialSwSolo();if(!u||!(dt>0))return;C.swDecay(u,dt);const sw=u.p.sw;let objs=null;
 for(let i=0;i<sw.length;i++){const w=sw[i],x=u.sw[i],K=C.SW_COMBAT[w.k];
  if(x.st==='cool'){x.t-=dt;if(x.t<=0){x.st='charge';x.c=0;}continue;}
  if(x.st==='beam'){const ref=x.tgt,s=ref&&ref.alive!==false&&!trial.jump&&x.t>0?trialSwScan(w,objs||(objs=trialSwObjects())).find(s=>s.o.ref===ref):null;
   if(!s?.ok){x.st='cool';x.t=K.over.T;x.tgt=null;C.swOverload(u,w);continue;}
   x.t-=dt;x.burn+=dt;trialSwSoloFx(i,w,'beam',ref);if(x.burn>=TRIAL_SW.burn)trialSwStrike(s.o,'beam');continue;}
  if(x.st==='charge'){x.c=Math.min(1,x.c+dt/Math.max(1,w.chargeT)*C.swChargeRate(u,i));if(x.c>=1){x.st='ready';if(!u.sw.some((y,j)=>j!==i&&y.st==='ready'))toast(`${K.name}：充電完了 — B（超兵器ボタン）で発射`);}}
 }
 if(trial.swPend?.length){for(const p of trial.swPend){p.t-=dt;if(p.t<=0)trialSwStrike(p.o,p.k);}trial.swPend=trial.swPend.filter(p=>p.t>0);}
 // v21.2 Solo ion bolts fly on, striking every buoy and drone the widening disc passes.
 if(trial.soloBolts?.length){const os=objs||trialSwObjects();for(const b of trial.soloBolts){const x0=b.x;b.x+=C.ION_BOLT.v*dt;for(const o of os){const t=o.ref;if(!t?.pos||t.alive===false||b.hit.has(t))continue;const v=tv.sub(t.pos,b.o),sa=tv.dot(v,b.dir);if(sa<=x0||sa>b.x)continue;const r=tv.len(tv.sub(v,tv.scale(b.dir,sa)));if(r>C.ionDiam(b.d,sa)/2+(o.reach||60))continue;b.hit.add(t);trialSwStrike(o,'ion');}if(b.x>C.ION_BOLT.maxRange)b.done=true;}trial.soloBolts=trial.soloBolts.filter(b=>!b.done);}
 // A buoy the ion wave has stopped sparks now and then until it comes back.
 for(const t of trial.targets)if(t.ionT>0){t.ionT=Math.max(0,t.ionT-dt);if(t.alive&&Math.random()<dt*2.5){const Rt=trial.asset?.geometry?.targetRadius||60;trial.fx.push({pos:tv.add(t.pos,tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),Rt*.8),vel:t.vel,life:.5,max:.5,size:Rt*.35,col:[185,160,255]});}}
}
// ---------- v21.2 the superweapons' envelope: in the 3D view and on the HUD ----------
// To scale: the cone's four edges from the muzzle out to the weapon's range and the ring where it ends, with marks
// every 10 km (rings round the beam's narrow cone, arcs across the ion cannon's fan in the ship's plane), dotted at
// an even spacing on screen. Bright while a shot is ready or the beam holds, faint while it charges, fainter while it
// cools. Weapons of one kind facing one way (the Onager's twin barrels) share one envelope.
function trialSwArcPoints(){
 const out=[],u=trial.battle?trial.battle.me:trial.swSolo,sw=u?.p?.sw;
 if(!sw?.length||!u.sw||trial.swArc===false||trial.spectate||trial.cine||u.dead||u.out||trial.jump||!view)return out;
 const eye=view.eye(),R=trial.R,up=trialCol(R,1),groups=new Map(),now=performance.now()/1000;
 sw.forEach((w,i)=>{const key=w.k+w.aim;let g=groups.get(key);if(!g)groups.set(key,g={w,mz:[0,0,0],n:0,xs:[]});g.mz=tv.add(g.mz,w.mz||[0,0,0]);g.n++;g.xs.push(u.sw[i]);});
 for(const g of groups.values()){
  const w=g.w,K=C.SW_COMBAT[w.k],m=trialApply(R,tv.scale(g.mz,1/g.n)),ax=trialApply(R,w.aim==='bow'?[1,0,0]:[0,0,w.aim==='port'?-1:1]),across=w.aim==='bow'?trialCol(R,2):trialCol(R,0);
  const hot=g.xs.some(x=>x&&(x.st==='ready'||x.st==='beam')),cold=g.xs.every(x=>!x||x.st==='cool'||x.st==='down'),A=hot?.8+.2*Math.sin(now*3):cold?.22:.45,col=w.k==='hion'?[165,140,255]:[255,125,80];
  const dot=(p,a)=>{out.push([p,[col[0],col[1],col[2],Math.round(C.clamp(a*A,0,1)*255)],Math.max(6,tv.len(tv.sub(p,eye))*.0042)]);};
  const line=(p0,p1,a)=>{const d=tv.sub(p1,p0),L=tv.len(d);if(!(L>1))return;const v=tv.scale(d,1/L);for(let s=0;s<=L;){const p=tv.add(p0,v,s);dot(p,a);s+=Math.max(12,tv.len(tv.sub(p,eye))*.013);}};
  const arc=(c,r,b1,b2,a0,a1,a)=>{const n=C.clamp(Math.ceil(r*(a1-a0)/Math.max(12,tv.len(tv.sub(c,eye))*.013)),6,160);for(let j=0;j<=n;j++){const t=a0+(a1-a0)*j/n;dot(tv.add(c,tv.add(tv.scale(b1,Math.cos(t)*r),b2,Math.sin(t)*r)),a);}};
  const cs=Math.cos(K.cone),sn=Math.sin(K.cone);
  for(const v of [up,across])for(const sg of [1,-1])line(m,tv.add(m,tv.add(tv.scale(ax,cs),v,sg*sn),K.range),.6);
  line(m,tv.add(m,ax,K.range),.28);
  arc(tv.add(m,ax,K.range*cs),K.range*sn,up,across,0,Math.PI*2,.6);
  if(w.k==='hion')for(let d=10000;d<=K.range;d+=10000)arc(m,d,ax,across,-K.cone,K.cone,d>=K.range?.6:.35);
  else for(let d=10000;d<K.range;d+=10000)arc(tv.add(m,ax,d*cs),d*sn,up,across,0,Math.PI*2,.3);
 }
 return out;
}
// The superweapon line over its button: whether the target in question is in the arc and the range (the locked
// target, else the one nearest a weapon's axis within reach, else the nearest; for the ion cannon how many are
// inside), how far off the axis it lies, and what the charge or the overload takes from the reactor. The targets
// inside an arc are kept (trial.swInArc) for their brackets.
const SW_SHORT={sbeam:'合成ビーム',hion:'イオン砲'};
const trialSwKm=r=>`${(r/1000).toFixed(r<10000?1:0)} km`,trialSwDeg=a=>`${(Math.abs(a)*180/Math.PI).toFixed(Math.abs(a)<.1745?1:0)}°`,trialSwTime=t=>{const s=Math.ceil(t);return s>=60?`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`:`${s} 秒`;};
function trialSwOffText(x){
 const l=trialApplyT(trial.R,x.d),w=x.w,K=C.SW_COMBAT[w.k],D=trialSwDeg;
 if(w.aim==='bow'){const h=Math.atan2(l[2],l[0]),v=Math.atan2(l[1],Math.hypot(l[0],l[2]));if(l[0]<=0)return '艦尾側';return [Math.abs(h)>=.0017?`${h>0?'右':'左'} ${D(h)}`:'',Math.abs(v)>=.0017?`${v>0?'上':'下'} ${D(v)}`:''].filter(Boolean).join(' ')+`（射界 ±${D(K.cone)}）`;}
 const s=w.aim==='port'?-l[2]:l[2];if(s<=0)return '反対舷';const a=Math.atan2(l[0],s),v=Math.atan2(l[1],Math.hypot(l[0],s));
 return `${w.aim==='port'?'左舷':'右舷'}から${a>0?'艦首':'艦尾'}寄り ${D(a)}`+(Math.abs(v)>.035?` ${v>0?'上':'下'} ${D(v)}`:'')+`（±${D(K.cone)}）`;
}
function trialSwInfo(q,me){
 const el=q('swinfo');if(!el)return;const sw=me?.p?.sw;trial.swInArc=null;
 if(!sw?.length||me.dead||me.out||trial.jump){if(!el.hidden)el.hidden=true;return;}
 const objs=trialSwObjects(),lk=trial.heldLock||trial.aim?.lock,lref=lk?(lk.unit||lk):null,inArc=new Set(),lines=[];
 for(const k of ['sbeam','hion']){const ws=sw.filter(w=>w.k===k);if(!ws.length)continue;const K=C.SW_COMBAT[k],scans=ws.map(w=>trialSwScan(w,objs)),lab=`<em>${SW_SHORT[k]}</em>`;
  for(const s of scans)for(const x of s)if(x.ok)inArc.add(x.o.ref);
  // Each object with the weapon of this kind that has it best (in reach first, then nearest its axis); the drones,
  // darting about, are named only when nothing steadier is there.
  const best=objs.map((o,j)=>{let b=null;for(const s of scans){const x=s[j];if(!b||x.ok&&!b.ok||x.ok===b.ok&&x.off<b.off)b=x;}return b;});
  if(k==='hion'){const hit=best.filter(x=>x.ok);if(hit.length){const sides=new Set(ws.map(w=>w.aim)).size>1?`（右舷 ${hit.filter(x=>x.w.aim==='stbd').length} · 左舷 ${hit.filter(x=>x.w.aim==='port').length}）`:'';lines.push(`${lab}<b class="ok">射界内 ${hit.length}</b>${sides} · 最寄り ${trialSwKm(Math.min(...hit.map(x=>x.r)))}`);continue;}}
  const dr=x=>x.o.kind==='drone'?1:0,ref=(lref&&best.find(x=>x.o.ref===lref))||best.filter(x=>x.r<=K.range*1.6).sort((a,b)=>b.ok-a.ok||dr(a)-dr(b)||a.off-b.off)[0]||best.slice().sort((a,b)=>dr(a)-dr(b)||a.r-b.r)[0];
  if(!ref){lines.push(`${lab}<b class="ng">目標なし</b>`);continue;}const what=`${esc(ref.o.name)} ${trialSwKm(ref.r)}`;
  lines.push(ref.ok?`${lab}<b class="ok">射界内</b> ${what}`:!ref.rng?`${lab}<b class="ng">射程外</b> ${what}（射程 ${K.range/1000} km）`:`${lab}<b class="wait">射界外</b> ${what} · ${trialSwOffText(ref)}`);
 }
 trial.swInArc=inArc;
 // What the weapons take from the reactor now: the overload's shortfall, or the share drawn to charge.
 const k0=C.swPower(me,false,false),k1=C.swPower(me,false,true),chg=sw.map((w,i)=>({w,i,x:me.sw?.[i]})).filter(z=>z.x?.st==='charge');let pw='';
 if(k0<.995)pw=`過負荷 · 炉出力 −${Math.round((1-k0)*100)}% · 回復まで ${trialSwTime(Math.max(0,...(me.over||[]).map(o=>o.t)))}`;
 else if(chg.length){const left=Math.max(...chg.map(z=>(1-z.x.c)*Math.max(1,z.w.chargeT)/Math.max(.05,C.swChargeRate(me,z.i))));pw=`充電中 · 炉出力の ${Math.round((k0-k1)*100)}% を使用 · 残り ${trialSwTime(left)}`;}
 const html=lines.join('<br>')+(pw?`<small>${pw}</small>`:'');if(el.innerHTML!==html)el.innerHTML=html;if(el.hidden)el.hidden=false;
}
// The overflow menu gets the envelope switch when the ship carries a superweapon.
function trialSwMenu(){const m=document.getElementById('thMenu');if(!m||m.querySelector('[data-th="swarcbtn"]'))return;const b=document.createElement('button');b.type='button';b.className='th-btn';b.dataset.trialCmd='swarc';b.dataset.th='swarcbtn';b.textContent=trial.swArc===false?'超兵器の射界を表示':'超兵器の射界を隠す';const r=m.querySelector('[data-trial-cmd="reset"]');if(r)m.insertBefore(b,r);else m.append(b);}
// The line on the trial record.
function trialSwRecord(){const g=trial.gun;return g?.sw?` · 超兵器 ${g.sw} 射${g.swKills?` / 撃破 ${g.swKills}`:''}${g.swDown?` / 無力化 ${g.swDown}`:''}`:'';}
window.__trialSw={step:dt=>trialSwSoloStep(dt),solo:()=>trialSwSolo(),scan:w=>trialSwScan(w),arc:()=>trialSwArcPoints().length};   // (for tests)
// Point sprites for the superweapon shots, relative to P (appended to the trial's effects set).
function swFxPoints(dt){
 const B=trial.battle,out=[];if(!trial.swfx?.length)return out;const byId=B?new Map(B.b.units.map(u=>[u.id,u])):null,P=trial.P;
 // v21.2 A trial flight's shots (e.solo) leave the flown ship and strike buoys and drones, held by reference.
 const rnd=()=>tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]);
 const tgt=(e,id)=>{if(e.solo)return id?.pos?{w:id.pos,L:id.kind==='craft'?40:(trial.asset?.geometry?.targetRadius||60)*2,pt:k=>tv.add(id.pos,rnd(),(trial.asset?.geometry?.targetRadius||60)*k*2*Math.random())}:null;const t=byId?.get(id);return t?{w:t.manual?trial.P:spaceWorld(t),L:t.p.len||300,pt:k=>spaceHullPoint(t,k)}:null;};
 for(const e of trial.swfx){e.age+=dt;e.life-=dt;let w,m,ax;
  if(e.solo){w=trial.p?.sw?.[e.i];if(!w)continue;m=tv.add(trial.P,trialApply(trial.R,w.mz||[0,0,0]));ax=trialApply(trial.R,w.aim==='bow'?[1,0,0]:[0,0,w.aim==='port'?-1:1]);}
  else{const a=byId?.get(e.from);w=a?.p?.sw?.[e.i];if(!a||!w)continue;m=swMuzzleWorld(a,w);ax=swAxisWorld(a,w);}
  // v21.2 A hyper-ion bolt: a crackling violet disc across its flight, as wide as it has spread, a white core.
  if(e.mode==='bolt'){const b=e.solo?trial.soloBolts?.find(q=>q.id===e.bolt):B?.b.ionBolts?.find(q=>q.id===e.bolt);if(!b){e.life=0;continue;}
   const o=e.solo?b.o:spaceWorldPos(b.o),dir=e.solo?b.dir:trialApply(B.E,b.dir);out.push(...ionBoltPoints(o,dir,b.x,C.ionDiam(b.d,b.x),b.E/b.E0,e.age));continue;}
  if(e.mode==='beam'||e.mode==='pulse'){const t=tgt(e,e.to);if(!t)continue;const to=e.at||t.w,d=tv.sub(to,m),L=tv.len(d);if(!(L>1))continue;const u=tv.scale(d,1/L),n=Math.min(420,Math.max(40,Math.round(L/45))),k=e.mode==='pulse'?Math.max(0,e.life/e.max):1,fl=.8+.2*Math.sin(e.age*40);
   for(let j=0;j<=n;j++){const q=tv.sub(tv.add(m,u,L*j/n),P);out.push([q,[255,226,205,Math.round(255*k)],32*fl*(e.mode==='pulse'?1.6:1)]);if(j%2===0)out.push([q,[255,70,40,Math.round(150*k)],110*fl*(e.mode==='pulse'?1.5:1)]);}
   out.push([tv.sub(to,P),[255,240,220,Math.round(255*k)],Math.max(300,t.L*.25)*(e.mode==='pulse'?1.6:1)*fl]);out.push([tv.sub(m,P),[255,200,170,230],140]);}
  else{const v=tv.norm(Math.abs(ax[1])<.9?tv.cross(ax,[0,1,0]):tv.cross(ax,[1,0,0])),v2=tv.cross(ax,v),k=Math.max(0,e.life/e.max),dist=e.age*16000,rad=Math.max(w.d||150,dist*Math.tan(C.SW_COMBAT.hion.cone)),c=tv.add(m,ax,dist),n=72;
   for(let j=0;j<n;j++){const an=j/n*Math.PI*2,q=tv.add(c,tv.add(tv.scale(v,Math.cos(an)*rad),tv.scale(v2,Math.sin(an)*rad)));out.push([tv.sub(q,P),[175,145,255,Math.round(230*k)],Math.max(60,rad*.06)]);}
   out.push([tv.sub(m,P),[200,180,255,Math.round(240*k)],220]);
   for(const id of e.to||[]){const t=tgt(e,id);if(!t||dist<tv.len(tv.sub(t.w,m)))continue;for(let j=0;j<6;j++)out.push([tv.sub(t.pt(.45),P),[185,160,255,Math.round(220*k)],Math.max(40,t.L*.04)]);}}
 }
 trial.swfx=trial.swfx.filter(e=>e.life>0);return out;
}
function spaceShots(shots){
 const B=trial.battle,byId=new Map(B.b.units.map(u=>[u.id,u]));
 for(const s of shots)if(s.sw)swShotFx(s,byId);
 for(const s of shots){if(s.sw)continue;const a=byId.get(s.from),t=byId.get(s.to);if(!a||!t||a.manual)continue;
  // v20.6 A salvo: the whole broadside leaves the ship at once (many bolts within a moment, and a heavier report).
  const sv=!!s.salvo&&!s.ff,n=sv?C.clamp(Math.round((s.gun||0)/30),6,48):C.clamp(Math.round((s.gun||0)/30),s.gun>0?1:0,6);if(n){const at=spaceWorld(a),o={gain:sv?.95:.7,near:Math.max(2000,a.p.len*1.5),far:Math.max(40000,a.p.len*25)};sndAt(sndSalvo(s,a.p.len),at,o);if(sv&&a.p.len>250)sndAt(sndPick('turbolaser_heavy','turbolaser'),at,{...o,pitch:.85});}
  for(let i=0;i<n;i++){const from=spaceHullPoint(a,.4),tw=spaceWorld(t),tof=C.len(C.sub(tw,from))/TRIAL_GUN.boltSpeed,to=tv.add(spaceHullPoint(t,.3),spaceVel(t),tof),d=tv.sub(to,from),dist=tv.len(d);if(dist<1)continue;
   trial.vbolts.push({pos:from,vel:tv.scale(d,TRIAL_GUN.boltSpeed/dist),life:dist/TRIAL_GUN.boltSpeed,delay:sv?Math.random()*.12:Math.random()*SPACE_RULES.step,len:Math.max(80,a.p.len*.06),size:Math.max(6,a.p.len*.007),col:s.ion?[170,215,255]:a.team?[255,95,70]:[110,255,140],target:t});}
  if(s.msl>0&&Math.random()<.5&&(sndAt('missile',spaceWorld(a),{gain:.6}),true))for(let k=0;k<2;k++){const from=spaceHullPoint(a,.3);trial.fx.push({pos:from,vel:tv.add(spaceVel(a),tv.norm(tv.sub(spaceWorld(t),from)),2600),life:2.5,max:2.5,size:9,col:[255,210,150]});}}
 if(trial.vbolts.length>1600)trial.vbolts.splice(0,trial.vbolts.length-1600);
}
function spaceBolts(dt){
 trial.vbolts=trial.vbolts.filter(b=>{if(b.delay>0){b.delay-=dt;return true;}b.pos=tv.add(b.pos,b.vel,dt);b.life-=dt;if(b.life<=0){const t=b.target;spaceImpact(b.pos,t?spaceVel(t):[0,0,0],t,Math.max(8,(t?.p.len||300)*.02));if(t?.manual){trial.hitFlash=Math.min(1,(trial.hitFlash||0)+(t.shield>0?.12:.35));}return false;}return true;});
}
// ---------- v21.2 small craft in the battle ----------
// The fleet model keeps a carrier's craft as a number in the air (u.air: launched from its hangars, worn down by
// its target's point defence and the enemy's craft). Here they fly as the carrier's squadron, in formation
// (Rts.craftFormation), in the type its air wing carries most of: out to the ship it attacks, strafing it on
// passes, fighting the enemy's craft they meet, and losing craft one at a time as the number falls — each shot down
// by a bolt from the ship's point defence or an enemy craft. The flown ship's point defence can shoot them down too.
const spaceAirTypes=new Map();
function spaceAirType(u){
 if(spaceAirTypes.has(u.key))return spaceAirTypes.get(u.key);const d=fleet.assets.get(u.key)?.design||(u.manual?trial.asset?.design:null);let best=null,n=-1;
 for(const r of d?.airWings||[]){const c=Rts.CRAFT[r.type];if(!c||c.role==='transport'||c.stay)continue;const k=(r.count||0)*(c.role==='bomber'?.8:1);if(k>n){n=k;best=r.type;}}
 const t=best||'tie_ln';spaceAirTypes.set(u.key,t);return t;
}
function spaceAirStep(dt){
 const B=trial.battle;if(!B||B.rts||!B.b)return;const b=B.b,A=B.air||(B.air=new Map()),me=B.me,cf=B.cf||(B.cf={sq:new Map(),done:new Set(),ghosts:[],runs:[],runT:0,t:performance.now(),f:0,snd:0});
 const F0=++cf.f,fdt=Math.max(0,Math.min(.1,dt)),up=[0,1,0],P=trial.P,eye=view?tv.add(P,view.eye()):P,focal=(view?.canvas?.height||800)/(2*Math.tan((view?.cam?.fov||.72)/2)),cand=[],own=[],foe=[],tt=performance.now()/1000,k1=1-Math.exp(-fdt*1.1),jobs={df:[],runs:[],pd:[]};
 const byId=new Map(b.units.map(u=>[u.id,u])),live=u=>u&&!u.dead&&!u.absent&&!u.warp,groups=[];
 for(const u of b.units){
  // Whole craft, counted from the model's running totals: each one that reaches the air joins the formation
  // (up to 36 shown; the rest wait behind and fill the places of those lost), each one lost leaves it.
  let g=A.get(u.id);const arr=Math.floor((u.air||0)+(u.lost||0)+1e-6),lost=Math.floor((u.lost||0)+1e-6);if(!g&&arr<=lost)continue;
  if(!g){const type=spaceAirType(u),c=Rts.CRAFT[type],f=[Math.cos(u.yaw),0,Math.sin(u.yaw)];A.set(u.id,g={id:'air-'+u.id,u,type,c,pos:tv.add(u.pos,[0,-(u.p.height||u.p.len*.2)*.6,0]),h:f,vel:[0,0,0],slots:[],next:0,arr:0,dead:lost,extra:0,qs:new Map(),list:[],ph:Math.random()*6.28});g.arr=g.dead;}
  while(g.arr<arr){g.arr++;if(g.slots.length<36)g.slots.push(g.next++);else g.extra++;}
  while(g.dead<lost){g.dead++;if(!g.slots.length){g.extra=Math.max(0,g.extra-1);continue;}const i=Math.floor(Math.random()*g.slots.length),id=g.slots.splice(i,1)[0],q=g.qs.get(id);g.qs.delete(id);if(q)(g.lost||(g.lost=[])).push(q);if(g.extra>0){g.extra--;g.slots.push(g.next++);}}
  if(!g.slots.length&&!g.lost?.length){if(u.dead||arr<=lost)A.delete(u.id);continue;}
  // where the squadron goes: round its carrier's target (or over its carrier), at the craft's own speed
  const t=byId.get(u.order?.target),tgt=live(t)&&t.team!==u.team?t:null,home=live(u)?u:null,R0=tgt?1400+tgt.p.len*.6:1200+u.p.len*.5,a=tt*.22+g.ph,ctr=(tgt||home||g).pos;
  const goal=tv.add(ctr,[Math.cos(a)*R0,(tgt?260:700)+Math.sin(a*.7)*200,Math.sin(a)*R0]),d=tv.sub(goal,g.pos),l=tv.len(d);
  if(l>1){const want=tv.scale(d,1/l),c=C.clamp(tv.dot(g.h,want),-1,1),ang=Math.acos(c),k=Math.min(1,1.2*fdt/Math.max(1e-4,ang));g.h=tv.norm(tv.add(tv.scale(g.h,1-k),want,k));const sp=Math.min(g.c.speed*.5,Math.max(250,l*.8));g.vel=tv.scale(g.h,sp);g.pos=tv.add(g.pos,g.vel,fdt);}
  g.tgt=tgt;groups.push(g);
 }
 for(const g of groups){
  const u=g.u,c=g.c,team=me&&u.team!==me.team?1:0,glow=team?[255,110,80,230]:[120,200,255,230],h=trialApply(B.E,g.h),v=trialApply(B.E,g.vel),c0=tv.add(B.O,trialApply(B.E,g.pos)),Fm=trialFrame(h,Math.abs(tv.dot(h,trialApply(B.E,up)))>.97?trialApply(B.E,[1,0,0]):trialApply(B.E,up)),fw=trialCol(Fm,0),uv=trialCol(Fm,1),rt=trialCol(Fm,2),list=[];
  const L=c.dims?.[0]||10,mk=voyCraftModel(g.type),dS=tv.len(tv.sub(c0,eye)),models=mk&&dS<L*focal/5+600,enemy=groups.find(x=>x.u.team!==u.team&&x.list.length&&tv.len(tv.sub(x.pos,g.pos))<3000),fight=!!enemy,A2=Math.max(30,(c.dims?.[1]||10)*5);
  g.slots.forEach((id,i)=>{let q=g.qs.get(id);const key=g.id+':'+id;
   if(!q)g.qs.set(id,q={id:key,kind:'craft',craft:g.type,cid:id,k:-1,off:null,pos:[0,0,0],size:c.role==='bomber'?12:10,onDown:()=>{cf.done.add(key);const j=g.slots.indexOf(id);if(j>=0&&(u.air||0)>=1){g.slots.splice(j,1);g.qs.delete(id);u.air-=1;u.lost=(u.lost||0)+1;g.dead=Math.floor(u.lost+1e-6);}}});
   if(q.k!==i){q.k=i;q.want=Rts.craftFormation(i,c.role,c.dims);q.set=false;if(!q.off){q.off=q.want.slice();q.set=true;}}
   const o=q.off,wt=q.want;if(!q.set){let dd=0;for(let j=0;j<3;j++){o[j]+=(wt[j]-o[j])*k1;dd+=Math.abs(wt[j]-o[j]);}if(dd<.3){o[0]=wt[0];o[1]=wt[1];o[2]=wt[2];q.set=true;}}
   let ox=o[0],oy=o[1],oz=o[2];if(fight){const ph=id*2.399+(i&1)*.3;ox+=Math.sin(tt*.9+ph)*A2;oy+=Math.sin(tt*1.3+ph*2)*A2*.7;oz+=Math.cos(tt*.7+ph)*A2*1.2;}
   const p=q.pos;p[0]=c0[0]+fw[0]*ox+uv[0]*oy+rt[0]*oz;p[1]=c0[1]+fw[1]*ox+uv[1]*oy+rt[1]*oz;p[2]=c0[2]+fw[2]*ox+uv[2]*oy+rt[2]*oz;
   Object.assign(q,{vel:v,h:fw,up:uv,alive:true,team,glow,model:null});(team?foe:own).push(q);list.push(q);
   if(models){const dq=tv.len(tv.sub(p,eye));if(L*focal/Math.max(1,dq)>=5)cand.push({q,mk,d:dq});}});
  g.list=list;g.col=VOY_BOLT[c.side]||VOY_BOLT[u.team?'cis':'republic']||VOY_BOLT.neutral;
  // craft lost this step: hit by the target's point defence when over it, else by the enemy's craft
  for(const q of g.lost||[]){q.alive=false;if(cf.done.delete(q.id))continue;const pdShip=g.tgt&&tv.len(tv.sub(g.pos,g.tgt.pos))<6000+g.tgt.p.len?g.tgt:null,e=!pdShip&&enemy?.list.length?enemy.list[Math.floor(Math.random()*enemy.list.length)]:null;craftKill(cf,q,pdShip?spaceHullPoint(pdShip,.35):e?tv.add(e.pos,e.h,6):null,pdShip?[255,200,140]:e?enemy.col:[255,200,140],!!pdShip);}
  g.lost=null;
 }
 for(const g of groups){if(!g.list.length)continue;const enemy=groups.find(x=>x.u.team!==g.u.team&&x.list.length&&tv.len(tv.sub(x.pos,g.pos))<3000);if(enemy)jobs.df.push({m:g.list,fm:enemy.list,c:g.c,col:g.col});
  const t=g.tgt;if(t&&tv.len(tv.sub(g.pos,t.pos))<2600+t.p.len*.6){g.run=g.run||{first:true,left:1e9};jobs.runs.push({r:g.run,m:g.list,u:t,c:g.c,col:g.col});if(!t.manual)jobs.pd.push({u:t,m:g.list,col:t.team?[255,120,90]:[130,255,150]});}else g.run=null;}
 trial.foeCraft=foe;trial.ownCraft=own;
 voyCraftDraw(B,cand);craftFx(B,cf,fdt,eye,jobs);
}
// In a battle each tube draws its salvo from its own magazine.
function spaceAmmo(l){const B=trial.battle;if(!B)return true;const i=B.modIndex.get(l.id);if(i==null)return true;if((B.me.ammo[i]||0)<l.salvo)return false;B.me.ammo[i]-=l.salvo;return true;}
// The enemy's arrival is shown as a short cut-away: the camera stands off the
// bow quarter of the arriving formation, so the ships come out of hyperspace
// toward it one after another, stretched, then snap to their true length.
function spaceCineStart(){
 const B=trial.battle;if(!B||trial.cine||trial.jump||!view)return;const foes=B.b.units.filter(u=>u.team===1&&u.warp);if(!foes.length)return;
 const f=trialCol(spaceRot(B.E,foes[0].yaw),0),up=tv.norm(trial.P),s0=tv.norm(tv.cross(up,f)),side=tv.dot(s0,tv.sub(trial.P,spaceWorld(foes[0])))>0?s0:tv.scale(s0,-1);
 const pts=foes.map(u=>spaceWorld(u)),c=pts.reduce((a,p)=>tv.add(a,p,1/pts.length),[0,0,0]),span=Math.max(0,...pts.map(p=>tv.len(tv.sub(p,c)))),L=Math.max(...foes.map(u=>u.p.len));
 const asp=(view.canvas.clientWidth||16)/(view.canvas.clientHeight||9);
 trial.cine={t:0,dur:Math.max(...foes.map(u=>u.warp.at-u.warp.t))+1.9,dirW:tv.norm(tv.add(tv.add(tv.scale(f,.8),side,.52),up,.2)),r:(span*1.4+L*4.2)*C.clamp(1.2/asp,1,2.2),lead:f,L,ids:foes.map(u=>u.id),save:{th:view.cam.th,ph:view.cam.ph,r:view.cam.r}};
 $('#trialHud')?.classList.add('cine');
}
function spaceCineEnd(){const k=trial.cine;if(!k)return;trial.cine=null;if(view)Object.assign(view.cam,k.save);$('#trialHud')?.classList.remove('cine');}
// v20.6 The escorts jump one after another (the smallest first), not all at once: each waits its turn (depart.t below 0).
function spaceDepartEscorts(){const B=trial.battle,us=B.b.units.filter(u=>u.team===0&&!u.manual&&!u.dead&&!u.absent).sort((a,b)=>(a.p.len||0)-(b.p.len||0)),gap=us.length>1?Math.min(.6,2.4/(us.length-1)):0;us.forEach((u,i)=>{u.depart={t:-i*gap};});}
function spaceWithdraw(){const B=trial.battle;B.result={kind:'withdrew',dest:trial.jump?.dest};B.left=true;trial.targets=[];}
function spaceEnd(kind){const B=trial.battle;if(B.result)return;if(B.patrol&&patrolBattleEnd(kind))return;B.result={kind,fate:B.me.fate,why:B.me.out};trial.fire=trial.fireKey=false;if(!trial.jump)setTimeout(spaceShowResult,kind==='win'?1500:2600);}
function spaceLog(text,u){const B=trial.battle;if(!B)return;const who=!u?'':u.manual?'自艦：':(u.team?'敵 ':'友 ')+shipShort(u.name)+'：';B.ticker.push({t:B.b.time,text:who+text});if(B.ticker.length>40)B.ticker.shift();}
function spaceStep(dt){
 const B=trial.battle;if(!B||B.left)return;const b=B.b;
 spaceAirStep(dt);
 if(!B.cined&&b.units.some(u=>u.warp&&u.warp.t+dt>=u.warp.at-.5)){B.cined=true;spaceCineStart();}
 for(const u of b.units){if(u.warp){const t0=u.warp.t-u.warp.at;u.warp.t+=dt;const tt=u.warp.t-u.warp.at;if(t0<0&&tt>=0)sndAt('hyperspace_in',spaceWorld(u),{gain:.5,far:90000});if(tt>=.9){u.absent=false;delete u.warp;spaceLog('ハイパースペースから出現',u);if(b.units.filter(x=>x.team===1).every(x=>!x.warp))toast('敵艦隊がハイパースペースから出現');}}
  if(u.depart){const t0=u.depart.t;u.depart.t+=dt;if(t0<=0&&u.depart.t>0)sndAt('hyperspace_out',spaceWorld(u),{gain:.45,far:90000});if(u.depart.t>=.8){u.absent=true;u.hidden=true;delete u.depart;}}}
 if(B.result){for(const u of b.units)if(!u.manual&&!u.dead)u.pos=tv.add(u.pos,u.velocity||[0,0,0],dt);spaceRefresh();return;}
 B.acc+=dt;B.orderT-=dt;
 while(B.acc>=SPACE_RULES.step){B.acc-=SPACE_RULES.step;if(B.orderT<=0){spaceOrders(b);B.orderT=2;}spaceSync();
  const before=new Map(b.units.map(u=>[u.id,{dead:u.dead,out:u.out}]));
  const shots=C.fleetTick(b,SPACE_RULES.step,{rules:SPACE_RULES,extra:B.extra,gravity:true,onHit:(u,rec)=>{if(u.manual)hitcamOffer(u,rec,'taken');else if(B.me&&String(rec.src)===String(B.me.id))hitcamOffer(u,rec,'dealt');}});B.extra=new Map();spaceShots(shots);
  spaceBumps(b.bumps);spaceBump(B.me);
  for(const u of b.units){const was=before.get(u.id);if(u.dead&&!was.dead){if(u.team===1)B.kills++;}else if(u.out&&!was.out&&u.team===1)B.disabled++;}
  for(const t of trial.turrets){const i=B.modIndex.get(t.id);t.dead=i!=null&&B.me.mods[i]<=0;}
  for(const l of trial.launchers){const i=B.modIndex.get(l.id);l.dead=i!=null&&B.me.mods[i]<=0;}
  for(;B.seen<b.events.length;B.seen++){const e=b.events[B.seen],u=b.units.find(x=>x.id===e.id),text=e.text.replace(/^[^：]*：/,'');spaceLog(text,u);if(u?.manual&&/破壊|停止|誘爆|消失|喪失|戦闘不能|撃沈/.test(text))toast('自艦：'+text);}
  if(B.me.dead||B.me.out){spaceEnd(B.me.dead?'sunk':'out');break;}
  if(b.units.filter(u=>u.team===1).every(u=>u.dead||u.out)&&!b.units.some(u=>u.team===1&&u.warp)){spaceEnd('win');break;}}
 spaceRefresh();
}
// v18 Drive glow levels (0–1) eased over about half a second per ship, so the
// plume swells and dies away instead of flickering with each step's thrust.
const glowEase=new Map();
function glowOf(id,lvl){const now=performance.now(),g=glowEase.get(id);if(!g){if(glowEase.size>4000)glowEase.clear();glowEase.set(id,{v:lvl,t:now});return lvl;}g.v+=(lvl-g.v)*(1-Math.exp(-Math.max(0,now-g.t)/450));g.t=now;return g.v;}
// Units other than the flagship, as the renderer wants them (relative to the flagship).
function spaceDrawUnits(){
 const B=trial.battle;if(!B||B.left)return [];const j=trial.jump?.follow?trial.jump:null,out=j?voyFollowDraw(j):[];
 // In the tunnel only the followed group is there; coming out, it is drawn by the ride.
 if(j&&!j.arrived)return out;const skip=j?j.with:null;
 for(const u of B.b.units){if(u.manual||u.dead||u.hidden||skip?.has(u.id))continue;
  // (in a fleet battle, a ship whose turn to come out of hyperspace has not yet come is not there)
  if(B.rts&&u.warp&&u.warp.t<0)continue;
  let w=spaceWorld(u),stretch=1,flash=0;const R=spaceRotU(B.E,u),f=trialCol(R,0);
  // A ship dropping out of hyperspace, timed on the battle's clock (or, watching a fleet battle, the screen's).
  const aw=B.rts?B.arrive?.get(u.id):null,tt=B.rts?(aw?aw.t:null):u.warp?(u.warp.at!=null?u.warp.t-u.warp.at:u.warp.t):null;
  if(tt!=null&&tt<.9){if(tt<0)continue;const k=warpLook(tt,u.p.len);w=tv.add(w,f,-k.D);stretch=k.stretch;flash=k.tint;}
  else if(u.absent&&!u.depart)continue;
  if(u.depart&&u.depart.t>0){const t=u.depart.t;w=tv.add(w,f,u.p.len*40*(t/.8)**3);stretch=1+25*t*t;flash=C.clamp((stretch-1)/16,0,.45);}
  out.push({key:u.key,pos:tv.sub(w,trial.P),rot:R,glow:u.depart?1:glowOf(u.id,C.engineLevel(u)),hatchOpen:0,dead:false,stretch,flash});}
 // Ships that jumped out, seen from outside: stretched along their heading and gone.
 for(const g of B.ghosts||[]){const t=g.t,stretch=1+25*t*t;out.push({key:g.key,pos:tv.sub(tv.add(g.w,g.f,g.L*40*(t/.8)**3),trial.P),rot:g.rot,glow:.55,hatchOpen:0,dead:false,stretch,flash:C.clamp((stretch-1)/16,0,.45)});}
 out.push(...spaceWreckDraw());
 // v21.2 Small craft near the camera, with their 3D models (voyCraftDraw).
 if(B.cfDraw?.length)out.push(...B.cfDraw);
 return out;
}
function spaceShowResult(){
 const B=trial.battle,el=$('#trialHud')?.querySelector('[data-th="result"]');if(!B||!el||!B.result)return;const r=B.result,me=B.me,fate={reactor:'炉心誘爆',fuel:'反応物誘爆',magazine:'弾薬庫誘爆',hull:'船体破断'};
 const title=r.kind==='win'?'勝利':r.kind==='withdrew'?'離脱':'敗北',sub=r.kind==='win'?'敵艦隊を無力化しました':r.kind==='withdrew'?`${SYSTEMS[r.dest]?.name||''}へ戦域を離脱しました`:r.kind==='sunk'?`旗艦撃沈（${fate[r.fate]||'船体破断'}）`:`旗艦戦闘不能（${r.why||''}）`;
 const foes=B.b.units.filter(u=>u.team===1),allies=B.b.units.filter(u=>u.team===0&&!u.manual);
 const rts=!!B.rts,hull=rts?Math.round(Rts.unitStruct(me)*100):Math.round(Math.max(0,me.hp)/me.p.hp*100),sub2=rts&&r.kind==='win'?'この星系の戦闘は終わりました':rts&&r.kind==='withdrew'?'敵はこの星系から退きました':sub;
 el.innerHTML=`<div class="th-card th-result-card"><b class="${r.kind==='win'?'win':r.kind==='withdrew'?'':'lose'}">${rts&&r.kind==='withdrew'?'敵が撤退':title}</b><p>${esc(sub2)}</p><dl><dt>敵艦</dt><dd>撃沈 ${foes.filter(u=>u.dead).length} · 戦闘不能 ${foes.filter(u=>!u.dead&&u.out).length} / ${foes.length} 隻</dd><dt>僚艦</dt><dd>${allies.length?`健在 ${allies.filter(u=>!u.dead&&!u.out).length} / ${allies.length} 隻`:'なし'}</dd><dt>${rts?'自艦':'旗艦'}</dt><dd>${rts?'船体区画':'船体'} ${hull}% · 装甲 ${Math.round(me.armor*100)}% · 乗員 ${num(Math.round(me.crew))} 名</dd><dt>射撃</dt><dd>${num(trial.gun.shots)} 発 · 命中 ${num(Math.round(trial.gun.hits))}${trial.gun.pdKills?` · 点防御 撃墜 ${trial.gun.pdKills}`:''}</dd></dl><div class="th-result-go"><button type="button" class="th-btn" data-trial-cmd="exit">${rts?'操艦終了':trial.pat?'帰還':'艦隊画面へ戻る'}</button>${rts?'':'<button type="button" class="th-btn" data-trial-cmd="retry">もう一度</button>'}<button type="button" class="th-btn" data-trial-cmd="resultClose">このまま航行</button></div></div>`;el.hidden=false;
}
// Fleet screen → space: the chosen flagship is flown, the rest of the fleet
// and the enemy fight on the model.
async function spaceBattleLaunch(){
 const b=fleet.battle;if(!b||fleet.busy)return;const friends=b.units.filter(u=>u.team===0),foes=b.units.filter(u=>u.team===1);
 if(!friends.length||!foes.length){toast(!friends.length?'友軍の艦を追加してください':'敵艦を追加してください');return;}
 const flag=fleetFlag()||friends[0],asset=fleet.assets.get(flag.key);if(!asset?.design){toast('旗艦の設計を準備できません');return;}
 const plan={flag:{key:flag.key,name:flag.name},escorts:friends.filter(u=>u!==flag).map(u=>({key:u.key,p:u.p,name:u.name,order:u.order})),foes:foes.map(u=>({key:u.key,p:u.p,name:u.name}))};
 await fleetSetMode('design');await trialStart({design:asset.design,battle:plan,system:fleet.system||'coruscant',returnTo:'tactical'});
}
function trialSetPower(k){if(!Object.hasOwn(C.POWER_MODES,k))return;trial.powerMode=k;const b=document.querySelector('[data-th="pwbtn"]');if(b)b.textContent='⚡ '+C.POWER_MODES[k].name;document.querySelectorAll('#thPower [data-trial-cmd^="pmode:"]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.trialCmd==='pmode:'+k)));toast('出力配分：'+C.POWER_MODES[k].name+' — '+C.POWER_MODES[k].note);}
const TRIAL_KEYS={KeyT:'escort',KeyB:'sw',KeyN:'swmode',KeyC:'volley',KeyG:'gunmode',KeyH:'shot',KeyK:'pause',KeyP:'pnext',KeyM:'missile',KeyW:'tele+',ArrowUp:'tele+',KeyS:'tele-',ArrowDown:'tele-',KeyA:'rudder-',ArrowLeft:'rudder-',KeyD:'rudder+',ArrowRight:'rudder+',KeyZ:'level',KeyX:'center',KeyV:'cam',KeyJ:'map',Escape:'exit'};
const TRIAL_HOLD={KeyR:['y',1],KeyF:['y',-1],KeyQ:['x',-1],KeyE:['x',1]};
function trialKeyStick(){const s={x:0,y:0};for(const k of trial.keys){const h=TRIAL_HOLD[k];if(h)s[h[0]]+=h[1];}trial.keyStick={x:C.clamp(s.x,-1,1),y:C.clamp(s.y,-1,1)};}
function bindTrial(){
 document.addEventListener('click',e=>{const b=e.target.closest('[data-trial],[data-trial-cmd]');const m=$('#thMenu');if(m&&!m.hidden&&!e.target.closest('#thMenu,[data-trial-cmd="menu"]')){m.hidden=true;document.querySelector('[data-trial-cmd="menu"]')?.setAttribute('aria-expanded','false');}const pm=$('#thPower');if(pm&&!pm.hidden&&!e.target.closest('#thPower,[data-trial-cmd="power"]')){pm.hidden=true;document.querySelector('[data-trial-cmd="power"]')?.setAttribute('aria-expanded','false');}const mp=$('#thMap');if(mp&&!mp.hidden&&!e.target.closest('#thMap,[data-trial-cmd="map"]'))trialMapShow(false);if(!b||b.disabled)return;if(b.dataset.trial==='start'){e.preventDefault();trialStart();return;}if(b.dataset.trialCmd){e.preventDefault();const inMenu=!!b.closest('#thMenu');trialCommand(b.dataset.trialCmd);if(inMenu&&m){m.hidden=true;document.querySelector('[data-trial-cmd="menu"]')?.setAttribute('aria-expanded','false');}}});
 window.addEventListener('keydown',e=>{if(!trial.on||e.ctrlKey||e.metaKey||e.altKey)return;
  // The maps over a fleet battle's 3D view take the keys.
  if(trial.spectate&&voy.orders)return;
  if(shot.on&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();shotSet(false);return;}
  if(trial.spectate){if(!e.target.matches?.('input,textarea,select')&&voySpectateKey(e)){e.preventDefault();e.stopImmediatePropagation();}return;}
  if(TRIAL_HOLD[e.code]){e.preventDefault();e.stopImmediatePropagation();trial.keys.add(e.code);trialKeyStick();return;}
  if(e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();trial.fireKey=true;return;}
  const cmd=TRIAL_KEYS[e.code];if(!cmd)return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)trialCommand(cmd);},true);
 window.addEventListener('keyup',e=>{if(!trial.on)return;if(TRIAL_HOLD[e.code]){trial.keys.delete(e.code);trialKeyStick();}if(e.code==='Space')trial.fireKey=false;},true);
 window.addEventListener('blur',()=>{trial.keys.clear();trialKeyStick();trial.fire=trial.fireKey=false;});
 document.addEventListener('visibilitychange',()=>{trial.last=0;});
}
function updateAviationUI(){
 if(!ship||fleet.mode!=='design'||!['launch','mod'].includes(st.tab))return;
 const a=aviationNumbers(),summary=$('#aviationSummary');if(summary)summary.innerHTML=aviationCapacityHTML(a);
 const byId=new Map(a.wings.map(w=>[w.id,w]));
 for(const node of document.querySelectorAll('[data-airwing-status]')){const w=byId.get(node.dataset.airwingStatus);if(w)node.innerHTML=aviationWingStatusHTML(w);}
 for(const node of document.querySelectorAll('[data-airwing-title]')){const w=byId.get(node.dataset.airwingTitle);if(w)node.textContent=w.name;}
 for(const node of document.querySelectorAll('[data-airwing-summary]')){const w=byId.get(node.dataset.airwingSummary);if(w)node.textContent=wingSummary(w);}
 for(const node of document.querySelectorAll('[data-aviation-capacity]')){const p=ship.parts.find(p=>p.id===+node.dataset.aviationCapacity);if(p)node.textContent=node.closest('.aviation-bays')?bayText(p,a):aviationSize(C.hangarCapacity(p))+' サイズ';}
}
function editAirWingInput(t,finish=false){
 const id=t.dataset.airwing,k=t.dataset.wingfield,row=ship.airWings?.find(w=>w.id===id);if(!row||!['name','size','count','type','d0','d1','d2'].includes(k))return;
 let next;
 if(k==='type'){const old=C.CRAFT_TYPES[row.type],cur=C.aviationStatus(ship,S?.info).wings.find(w=>w.id===id);
  if(t.value==='custom'){next={...row,type:null,dims:(cur?.dims||C.airWingDims(row)).map(v=>Math.round(v*100)/100)};delete next.design;}
  else if(t.value==='legacy'){next={...row,type:null,size:Math.max(C.AIR_WING_LIMITS.minSize,Math.round((cur?.size||row.size||1)*100)/100)};delete next.dims;delete next.design;}
  else if(C.CRAFT_TYPES[t.value]){next={...row,type:t.value};delete next.dims;delete next.design;if(!row.name||row.name===old?.name||row.name===row.design?.name||/^航空隊 \d+$/.test(row.name))next.name=C.CRAFT_TYPES[t.value].name;}
  else if(t.value.startsWith('dsn:')){if(finish)pickDesignCraft(id,t.value.slice(4));return;}else return;}
 else if(k[0]==='d'){const v=Number(t.value);if(t.value===''||!Number.isFinite(v)||v<=0){if(finish){if(dragSnap)endDrag();renderPanel();}return;}const d=(Array.isArray(row.dims)?row.dims:C.airWingDims(row)).slice();d[+k[1]]=v;next={...row,type:null,dims:d};}
 else{const value=k==='name'?t.value:Number(t.value);if(k!=='name'&&(t.value===''||!Number.isFinite(value))){if(finish){if(dragSnap)endDrag();t.value=String(row[k]);updateAviationUI();}return;}next={...row,[k]:value};}
 const rows=C.normalizeAirWings(ship.airWings.map(w=>w.id===id?next:w));
 if(JSON.stringify(rows)!==JSON.stringify(ship.airWings)){beginDrag('航空隊を編集');ship.airWings=rows;touch('none');scheduleStats(180);}
 if(finish){if(dragSnap)endDrag();if(k==='type'||k[0]==='d'){renderPanel();return;}t.value=String(ship.airWings.find(w=>w.id===id)?.[k]??'');}
 updateAviationUI();
}
// A new wing takes the craft of the ship's livery: TIEs for the Empire's dark grey, V-wings for the Republic, droid fighters for the Separatists.
const defaultCraftType=()=>({dark:'tie_ln',republic:'vwing',cis:'vulture'})[ship?.paint]||'xwing';
function bindAviation(){
 const panel=$('#panel');
 panel.addEventListener('toggle',e=>{const id=e.target.dataset?.airwingCard;if(!id)return;st.aviationExpanded||=new Set();if(e.target.open)st.aviationExpanded.add(id);else st.aviationExpanded.delete(id);},true);
 panel.addEventListener('input',e=>{if(e.target.dataset.airwing)editAirWingInput(e.target);});
 panel.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.airwing){editAirWingInput(t,true);return;}
  if('airrole'in t.dataset&&Object.hasOwn(C.AVIATION_ROLES,t.value)){mutate('航空区画の用途',()=>editSel(p=>{if(p.k==='hangar')p.airRole=t.value;}),'parts');renderPanel();return;}
  if(t.dataset.aviationDoor){const p=ship.parts.find(p=>p.id===+t.dataset.aviationBay);if(!p)return;const face=t.dataset.aviationDoor;mutate('スライド扉の有無',()=>{const targets=[{p,face}];const twin=st.mirror&&p.tw?ship.parts.find(q=>q.id===p.tw):null;if(twin)targets.push({p:twin,face:face==='port'?'stbd':face==='stbd'?'port':face});for(const q of targets){const h=ship.hatches.find(h=>h.bay===q.p.id&&h.face===q.face);if(h){h.motion=t.checked?'slide':'fixed';h.open=t.checked?0:1;}}},'all');renderPanel();return;}
  if(t.dataset.aviationSurface){const p=ship.parts.find(p=>p.id===+t.dataset.aviationBay),face=t.dataset.aviationSurface,mode=t.value;if(!p||!['none','open','ray'].includes(mode))return;const contact=C.aviationSurfaceContacts(ship,p).find(q=>q.face===face);if(!contact?.contact){toast('この面は船体・外装の表面に接触していません');return;}mutate('航空区画の開口方式',()=>{C.setAviationSurfaceMode(ship,p,face,mode);const twin=st.mirror&&p.tw?ship.parts.find(q=>q.id===p.tw):null;if(twin)C.setAviationSurfaceMode(ship,twin,face==='port'?'stbd':face==='stbd'?'port':face,mode);},'all');renderPanel();}
 });
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if('addairwing'in d){if((ship.airWings?.length||0)>=C.AIR_WING_LIMITS.rows)return;if(dragSnap)endDrag();const ids=new Set((ship.airWings||[]).map(w=>w.id));let n=1;while(ids.has('wing-'+n))n++;const id='wing-'+n;const type=defaultCraftType();mutate('航空隊を追加',()=>ship.airWings=C.normalizeAirWings([...(ship.airWings||[]),{id,name:C.CRAFT_TYPES[type].name,type,count:0}]),'none');st.aviationExpanded||=new Set();st.aviationExpanded.add(id);renderPanel();return;}
  if('addshipwing'in d){const ref=$('#panel [data-shipcarry]')?.value,c=carryCandidates().find(x=>x.ref===ref);if(!c||!c.fits){toast('格納区画に入りません');return;}if((ship.airWings?.length||0)>=C.AIR_WING_LIMITS.rows)return;if(dragSnap)endDrag();const ids=new Set((ship.airWings||[]).map(w=>w.id));let n=1;while(ids.has('ship-'+n))n++;const id='ship-'+n;mutate('艦艇を搭載',()=>ship.airWings=C.normalizeAirWings([...(ship.airWings||[]),{id,name:c.name,kind:'ship',ref:c.ref,dims:c.dims,count:1}]),'none');st.aviationExpanded||=new Set();st.aviationExpanded.add(id);renderPanel();return;}
  if(d.fillairwing){const row=ship.airWings?.find(w=>w.id===d.fillairwing);if(!row)return;if(dragSnap)endDrag();const n=maxEmbark('airWings',row.id);mutate('空き容量まで搭載',()=>{row.count=n;},'none');renderPanel();return;}
  if(d.delairwing){if(dragSnap)endDrag();mutate('航空隊を削除',()=>ship.airWings=(ship.airWings||[]).filter(w=>w.id!==d.delairwing),'none');st.aviationExpanded?.delete(d.delairwing);renderPanel();return;}
  if(d.moveairwing){const i=ship.airWings?.findIndex(w=>w.id===d.moveairwing),direction=Number(d.direction),j=i+direction;if(i<0||![1,-1].includes(direction)||j<0||j>=ship.airWings.length)return;if(dragSnap)endDrag();mutate('航空隊の収容優先順',()=>{const row=ship.airWings.splice(i,1)[0];ship.airWings.splice(j,0,row);},'none');renderPanel();return;}
  if('editaviation'in d){st.tab='launch';hideInspect();renderPanel();}
 });
}

// Tactical positions stay in metres. Icons, labels and touch targets stay in
// screen pixels, so even a 19 km ship remains selectable at fleet distances.
const fleetMap={center:[0,0],metresPerPixel:500,width:900,height:600,cursor:null,pointers:new Map(),drag:null,pinch:null,canvas:null,context:null};
function fleetMapSize(){const canvas=$('#fleetMap'),r=canvas?.getBoundingClientRect?.();fleetMap.width=Math.max(1,r?.width||canvas?.clientWidth||900);fleetMap.height=Math.max(1,r?.height||canvas?.clientHeight||600);return {width:fleetMap.width,height:fleetMap.height,left:r?.left||0,top:r?.top||0};}
function fleetMapProject(p){return [fleetMap.width/2+(p[0]-fleetMap.center[0])/fleetMap.metresPerPixel,fleetMap.height/2-(p[2]-fleetMap.center[1])/fleetMap.metresPerPixel];}
function fleetMapWorld(x,y,altitude=fleet.altitude){return [fleetMap.center[0]+(x-fleetMap.width/2)*fleetMap.metresPerPixel,altitude,fleetMap.center[1]-(y-fleetMap.height/2)*fleetMap.metresPerPixel];}
function fleetMapClamp(){const limit=C.FLEET_RULES.maxCoordinate;fleetMap.center=fleetMap.center.map(n=>C.clamp(n,-limit,limit));fleetMap.metresPerPixel=C.clamp(fleetMap.metresPerPixel,10,10000);}
function fleetMapZoom(factor,x=fleetMap.width/2,y=fleetMap.height/2){if(!Number.isFinite(factor)||factor<=0)return;const before=fleetMapWorld(x,y,0);fleetMap.metresPerPixel=C.clamp(fleetMap.metresPerPixel*factor,10,10000);const after=fleetMapWorld(x,y,0);fleetMap.center[0]+=before[0]-after[0];fleetMap.center[1]+=before[2]-after[2];fleetMapClamp();requestDraw();}
function fleetMapFit(){const us=fleetDisplay().filter(u=>!u.dead);fleetMapSize();if(!us.length){fleetMap.center=[0,0];fleetMap.metresPerPixel=500;requestDraw();return;}const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];for(const u of us){const r=Math.max(4000,u.p.len/2);for(const [j,k] of [[0,0],[1,2]]){lo[j]=Math.min(lo[j],u.pos[k]-r);hi[j]=Math.max(hi[j],u.pos[k]+r);}}fleetMap.center=lo.map((v,i)=>(v+hi[i])/2);fleetMap.metresPerPixel=Math.max(60,(hi[0]-lo[0]+30000)/Math.max(120,fleetMap.width-120),(hi[1]-lo[1]+25000)/Math.max(100,fleetMap.height-210));fleetMapClamp();requestDraw();}
function fleetMapFocus(){const u=fleetSelected();if(!u)return;fleetMap.center=[u.pos[0],u.pos[2]];fleetMap.metresPerPixel=Math.max(100,C.FLEET_RULES.range*1.2/Math.max(240,Math.min(fleetMap.width,fleetMap.height)));fleetMapClamp();requestDraw();}
function fleetMapPick(x,y){let best=null,distance=27;for(const u of fleetDisplay().filter(u=>!u.dead)){const p=fleetMapProject(u.pos),d=Math.hypot(x-p[0],y-p[1]);if(d<distance){best=u;distance=d;}}return best;}
function fleetMapTap(x,y){const hit=fleetMapPick(x,y),u=fleetSelected();if(hit){if(hit.team===1&&u?.team===0&&!u.dead&&fleetEditable()&&fleet.battle.combat&&fleet.command==='attack'){fleetSetOrder({type:'attack',target:hit.id,fire:true});return;}fleet.selected=hit.id;fleet.command='select';fleetRender();return;}if(!u||u.dead||u.team!==0||!fleetEditable())return;if(fleet.command==='attack'){toast('攻撃する敵艦の記号を選んでください');return;}fleetSetOrder({type:'move',point:fleetMapWorld(x,y)});}
function fleetMapTarget(u,us=fleetDisplay()){if(!u)return null;return us.find(t=>t.id===u.order.target&&!t.dead)||us.filter(t=>t.team!==u.team&&!t.dead).sort((a,b)=>C.len(C.sub(a.pos,u.pos))-C.len(C.sub(b.pos,u.pos)))[0]||null;}
function fleetHatchText(u){if(!(u?.p.slidingHatches>0))return '';const open=u.hatchOpen||0;if(open<=.001)return 'ハッチ閉鎖';if(open>=.999)return u.hatchTarget?'ハッチ全開・発艦中':'ハッチ全開・発艦完了';return `ハッチ${u.hatchTarget?'開放':'閉鎖'}中 ${Math.round(open*100)}%`;}
function fleetMapToolsHTML(){const u=fleetSelected(),editable=!!(u&&!u.dead&&u.team===0&&fleetEditable()),b=fleet.battle,t=fleetMapTarget(u),d=t?C.len(C.sub(t.pos,u.pos)):null;return `<div class="fleet-map-readout"><span class="fleet-map-key"><i></i>友軍 <i class="enemy"></i>敵軍</span><b>${u?esc(u.name):'艦の記号を選択'}</b><small>${u?(u.dead?'撃沈':`${u.team?'敵艦':'友軍'} · 構造 ${fPct(u.hp/u.p.hp)}${t?' · '+(u.order.target===t.id?'目標':'最寄敵')+' '+(d/1000).toFixed(1)+' km':''}${u.p.slidingHatches?' · '+fleetHatchText(u):''}`):'艦の記号を選択して旗艦・僚艦を確認'}</small></div><div class="fleet-map-toolbar"><div class="fleet-map-commands">${u&&u.team===0&&!u.dead&&u!==fleetFlag()?'<button class="chip" data-fleet-action="flagship">旗艦にする</button>':''}<button class="chip primary" data-fleet-action="space" ${fleetFlag()&&fleetUnits().some(x=>x.team===1)&&!fleet.busy?'':'disabled'}>旗艦で出撃</button></div><div class="fleet-map-zoom"><button class="chip" data-fleet-action="zoomOut" aria-label="状況図を縮小">−</button><button class="chip" data-fleet-action="zoomIn" aria-label="状況図を拡大">＋</button></div></div>`;}
function fleetMapRefreshTools(){const el=$('#fleetMapTools');if(el&&fleet.mode==='tactical')el.innerHTML=fleetMapToolsHTML();}
function fleetMapNiceStep(raw){const power=10**Math.floor(Math.log10(Math.max(.001,raw))),v=raw/power;return (v<=1?1:v<=2?2:v<=5?5:10)*power;}
function fleetMapDraw(us){
 const canvas=$('#fleetMap');if(!canvas)return;const fallback=$('#fleetMapFallback');fleetMapSize();let ctx=fleetMap.context;
 if(canvas!==fleetMap.canvas){fleetMap.canvas=canvas;try{ctx=canvas.getContext?.('2d')||null;}catch(e){ctx=null;}fleetMap.context=ctx;}
 if(!ctx){if(fallback)fallback.hidden=false;return;}if(fallback)fallback.hidden=true;
 const W=fleetMap.width,H=fleetMap.height,dpr=Math.min(2,window.devicePixelRatio||1),scale=fleetMap.metresPerPixel;
 if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#08141e';ctx.fillRect(0,0,W,H);ctx.lineWidth=1;ctx.font='10px system-ui,sans-serif';ctx.textBaseline='middle';
 const grid=fleetMapNiceStep(scale*80),left=fleetMapWorld(0,H,0),right=fleetMapWorld(W,0,0);ctx.strokeStyle='#203b4b';ctx.fillStyle='#608092';
 for(let x=Math.ceil(left[0]/grid)*grid;x<=right[0]+grid*.001;x+=grid){const px=fleetMapProject([x,0,0])[0];ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,H);ctx.stroke();if(px>25&&px<W-45)ctx.fillText((x/1000).toFixed(grid<1000?1:0),px+4,Math.min(H-153,104));}
 for(let z=Math.ceil(left[2]/grid)*grid;z<=right[2]+grid*.001;z+=grid){const py=fleetMapProject([0,0,z])[1];ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(W,py);ctx.stroke();if(py>122&&py<H-145)ctx.fillText((z/1000).toFixed(grid<1000?1:0),7,py-7);}
 const selected=us.find(u=>u.id===fleet.selected),target=fleetMapTarget(selected,us);
 const line=(a,b,color,dash=[],width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;};
 const marker=(p,color)=>{ctx.strokeStyle=color;ctx.beginPath();ctx.arc(p[0],p[1],6,0,Math.PI*2);ctx.moveTo(p[0]-10,p[1]);ctx.lineTo(p[0]+10,p[1]);ctx.moveTo(p[0],p[1]-10);ctx.lineTo(p[0],p[1]+10);ctx.stroke();};
 if(selected&&!selected.dead&&fleet.ranges!==false){const p=fleetMapProject(selected.pos),r=C.FLEET_RULES.range/scale;ctx.strokeStyle='#63cde766';ctx.fillStyle='#54c2df07';ctx.setLineDash([5,7]);ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#88d8e5';ctx.fillText('射程 '+C.FLEET_RULES.range/1000+' km',C.clamp(p[0]+r-100,12,W-112),C.clamp(p[1]-10,125,H-155));}
 for(const u of us.filter(u=>!u.dead&&u.team===0)){const p=fleetMapProject(u.pos),o=u.order,dest=o.type==='move'?o.point:o.type==='attack'?us.find(t=>t.id===o.target&&!t.dead)?.pos:null;if(!dest)continue;const q=fleetMapProject(dest),color=o.type==='attack'?'#ffb784':'#63d6ed';line(p,q,color,[7,6],u.id===fleet.selected?1.6:1);if(o.type==='move')marker(q,color);}
 if(selected&&!selected.dead&&target&&!target.dead){const a=fleetMapProject(selected.pos),b=fleetMapProject(target.pos);line(a,b,'#9dafbd70',[2,5]);const p=[(a[0]+b[0])/2,(a[1]+b[1])/2],distance=C.len(C.sub(selected.pos,target.pos)),text=(distance/1000).toFixed(1)+' km'+(distance>C.FLEET_RULES.range?' · 射程外':'');ctx.font='11px system-ui,sans-serif';const width=ctx.measureText(text).width+14;ctx.fillStyle='#102432ee';ctx.fillRect(p[0]-width/2,p[1]-13,width,22);ctx.fillStyle=distance>C.FLEET_RULES.range?'#dfb77b':'#d4e4ee';ctx.textAlign='center';ctx.fillText(text,p[0],p[1]-2);ctx.textAlign='left';}
 if(fleet.command==='move'&&selected&&!selected.dead&&fleetMap.cursor){const a=fleetMapProject(selected.pos),p=fleetMap.cursor;line(a,p,'#8ee5efaa',[3,5]);marker(p,'#8ee5ef');}
 for(const shot of fleet.frame?.shots||[]){const a=us.find(u=>u.id===shot.from),b=us.find(u=>u.id===shot.to);if(!a||!b||a.dead)continue;line(fleetMapProject(a.pos),fleetMapProject(b.pos),shot.ion?'#86bff87d':shot.team?'#ff806757':'#7be6ad70',[],1.5);}
 const labelBoxes=[],shortName=(name,max)=>name.length>max?name.slice(0,max-1)+'…':name;
 for(const u of [...us].sort((a,b)=>(b.id===fleet.selected)-(a.id===fleet.selected))){const p=fleetMapProject(u.pos),chosen=u.id===fleet.selected;if(p[0]<-30||p[0]>W+30||p[1]<-30||p[1]>H+30)continue;const color=u.dead?'#6b747e':u.out?'#c9b07c':u.team?'#ff9c8e':'#77dced';ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(-u.yaw);ctx.fillStyle=u.dead?'#202a33':u.out?'#3a3324':u.team?'#5a302e':'#173f51';ctx.strokeStyle=color;ctx.lineWidth=chosen?2:1.4;ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-10,-10);ctx.lineTo(-5,0);ctx.lineTo(-10,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  if(u.dead){line([p[0]-10,p[1]-10],[p[0]+10,p[1]+10],color);line([p[0]-10,p[1]+10],[p[0]+10,p[1]-10],color);}else{ctx.strokeStyle=chosen?'#e9faff':color+'77';ctx.setLineDash(u.team?[3,3]:[]);ctx.beginPath();if(u.team){ctx.moveTo(p[0],p[1]-22);ctx.lineTo(p[0]+22,p[1]);ctx.lineTo(p[0],p[1]+22);ctx.lineTo(p[0]-22,p[1]);ctx.closePath();}else ctx.arc(p[0],p[1],chosen?23:19,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);const velocity=u.velocity||[0,0,0],v=fleetMapProject(C.add(u.pos,C.mul(velocity,20)));if(Math.hypot(v[0]-p[0],v[1]-p[1])>12)line(p,v,color+'77',[3,4]);}
  if(!fleet.labels&&!chosen)continue;ctx.font='11px system-ui,sans-serif';const label=shortName(u.name,W<480?12:20),heading=((90-u.yaw*180/Math.PI)%360+360)%360,info=u.dead?fleetStatusText(u):u.out?`${u.team?'敵':'友'} · ${fleetStatusText(u)}`:`${u.team?'敵':u===fleetFlag()?'旗艦':'友'} · ${Math.round(heading)}° · ${Math.round(u.hp/u.p.hp*100)}%`,maxWidth=Math.min(W-24,Math.max(102,ctx.measureText(label).width+16)),candidates=[[p[0]+28,p[1]-22],[p[0]-maxWidth-28,p[1]-22],[p[0]-maxWidth/2,p[1]+27],[p[0]-maxWidth/2,p[1]-69]];
  const fits=(r)=>r[0]>=7&&r[0]+maxWidth<W-7&&r[1]>=110&&r[1]+45<H-139&&!labelBoxes.some(b=>r[0]<b[0]+b[2]+5&&r[0]+maxWidth+5>b[0]&&r[1]<b[1]+b[3]+5&&r[1]+45+5>b[1]);let pos=candidates.find(fits);if(!pos){if(!chosen&&us.length>4)continue;pos=[C.clamp(p[0]-maxWidth/2,7,Math.max(7,W-maxWidth-7)),C.clamp(p[1]+28,108,Math.max(108,H-185))];}labelBoxes.push([...pos,maxWidth,45]);ctx.fillStyle=chosen?'#193442f2':'#0c202ced';ctx.fillRect(pos[0],pos[1],maxWidth,45);ctx.fillStyle=color;ctx.font='11px system-ui,sans-serif';ctx.fillText(label,pos[0]+7,pos[1]+11);ctx.font='10px system-ui,sans-serif';ctx.fillStyle='#a1bac9';ctx.fillText(info,pos[0]+7,pos[1]+26);ctx.fillStyle='#344858';ctx.fillRect(pos[0]+7,pos[1]+37,maxWidth-14,2);ctx.fillStyle=color;ctx.fillRect(pos[0]+7,pos[1]+37,(maxWidth-14)*C.clamp(u.hp/u.p.hp,0,1),2);ctx.fillStyle='#8c9bf1';ctx.fillRect(pos[0]+7,pos[1]+41,(maxWidth-14)*(u.shieldMax?C.clamp(u.shield/u.shieldMax,0,1):0),2);
 }
 const bar=fleetMapNiceStep(scale*Math.min(110,W*.27)),pixels=bar/scale,bottom=Math.max(135,H-146);line([18,bottom],[18+pixels,bottom],'#a3c2d3',[],2);line([18,bottom-4],[18,bottom+4],'#a3c2d3');line([18+pixels,bottom-4],[18+pixels,bottom+4],'#a3c2d3');ctx.font='10px system-ui,sans-serif';ctx.fillStyle='#93b5c8';ctx.fillText((bar/1000).toFixed(bar<1000?1:0)+' km',18,bottom-11);ctx.textAlign='right';ctx.fillText('格子 '+(grid/1000).toFixed(grid<1000?1:0)+' km · Z↑ X→',W-14,bottom-11);ctx.textAlign='left';
}
function bindFleetMap(){const canvas=$('#fleetMap');if(!canvas?.addEventListener)return;const point=e=>{const r=fleetMapSize();return [e.clientX-r.left,e.clientY-r.top];};
 canvas.addEventListener('wheel',e=>{if(fleet.mode!=='tactical')return;e.preventDefault();const p=point(e);fleetMapZoom(Math.exp(C.clamp(e.deltaY,-250,250)*.0016),...p);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(fleet.mode!=='tactical'||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();canvas.setPointerCapture?.(e.pointerId);canvas.focus?.({preventScroll:true});const p=point(e);fleetMap.pointers.set(e.pointerId,p);if(fleetMap.pointers.size===1)fleetMap.drag={id:e.pointerId,start:p,last:p,moved:false};else{fleetMap.drag.moved=true;const a=[...fleetMap.pointers.values()];fleetMap.pinch={mid:[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],distance:Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])};}});
 canvas.addEventListener('pointermove',e=>{if(fleet.mode!=='tactical')return;const p=point(e);fleetMap.cursor=p;if(!fleetMap.pointers.has(e.pointerId)){if(fleet.command==='move')requestDraw();return;}e.preventDefault();fleetMap.pointers.set(e.pointerId,p);if(fleetMap.pointers.size>1){const a=[...fleetMap.pointers.values()],mid=[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],distance=Math.max(1,Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])),old=fleetMap.pinch;if(old){fleetMapZoom(Math.max(1,old.distance)/distance,...old.mid);fleetMap.center[0]-=(mid[0]-old.mid[0])*fleetMap.metresPerPixel;fleetMap.center[1]+=(mid[1]-old.mid[1])*fleetMap.metresPerPixel;}fleetMap.pinch={mid,distance};fleetMapClamp();requestDraw();return;}const drag=fleetMap.drag;if(!drag)return;if(Math.hypot(p[0]-drag.start[0],p[1]-drag.start[1])>6)drag.moved=true;if(drag.moved){fleetMap.center[0]-=(p[0]-drag.last[0])*fleetMap.metresPerPixel;fleetMap.center[1]+=(p[1]-drag.last[1])*fleetMap.metresPerPixel;fleetMapClamp();requestDraw();}drag.last=p;});
 const end=(e,cancel=false)=>{if(!fleetMap.pointers.has(e.pointerId))return;const p=point(e),drag=fleetMap.drag,tap=!cancel&&fleetMap.pointers.size===1&&drag&&!drag.moved&&drag.id===e.pointerId;fleetMap.pointers.delete(e.pointerId);if(!fleetMap.pointers.size){fleetMap.drag=null;fleetMap.pinch=null;}else{const [id,last]=[...fleetMap.pointers.entries()][0];fleetMap.drag={id,start:last,last,moved:true};fleetMap.pinch=null;}if(tap&&fleet.mode==='tactical')fleetMapTap(...p);};
 canvas.addEventListener('pointerup',e=>end(e));canvas.addEventListener('pointercancel',e=>end(e,true));canvas.addEventListener('lostpointercapture',e=>end(e,true));canvas.addEventListener('pointerleave',()=>{if(!fleetMap.pointers.size){fleetMap.cursor=null;requestDraw();}});
 canvas.addEventListener('keydown',e=>{if(fleet.mode!=='tactical')return;const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(moves[e.key]){e.preventDefault();fleetMap.center=fleetMap.center.map((n,i)=>n+moves[e.key][i]*fleetMap.metresPerPixel*60);fleetMapClamp();requestDraw();}else if(e.key==='+'||e.key==='='){e.preventDefault();fleetMapZoom(.75);}else if(e.key==='-'){e.preventDefault();fleetMapZoom(1/.75);}else if(e.key==='0'){e.preventDefault();fleetMapFit();}});
}

const fleet={mode:'design',review:[],battle:null,assets:new Map(),saves:[],selected:null,next:1,busy:false,form:'line',gap:800,command:'select',altitude:0,moveX:0,moveZ:0,speed:2,elapsed:0,playing:false,replay:false,frame:null,lastClock:0,labels:true,ranges:true,orbit:false,clean:false,designCamera:null,sceneCamera:{},source:'current',team:0,flagship:null,system:'coruscant'};
// The friendly ship the player flies in a space battle (the first one unless chosen).
function fleetFlag(){const fr=(fleet.battle?.units||[]).filter(u=>u.team===0);return fr.find(u=>u.id===fleet.flagship)||fr[0]||null;}
const fleetUnits=()=>fleet.mode==='review'?fleet.review:fleet.battle?.units||[];
const fleetDisplay=()=>{const us=fleetUnits();return fleet.frame?us.map(u=>({...u,...fleet.frame.units.find(f=>f.id===u.id)})):us;};
const fleetSelected=()=>fleetDisplay().find(u=>u.id===fleet.selected);
const fleetEditable=()=>fleet.mode==='review'||fleet.battle?.phase==='plan'&&!fleet.replay;
const fleetCanRefit=()=>fleet.mode==='review'||fleet.battle?.phase==='plan'&&fleet.battle.time===0;
function fleetHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
// A source is 'current', 'save:<id>' or an example key; a prepared design is also
// asked for again by its asset key ('save:<id>-<savedAt>', 'draft-<hash>'), as the
// voyage does for its 3D view. Saved designs are found in the fleet's or the
// voyage's list of saves, or read from the store; a design saved again since it
// was prepared is served from its latest save under the old key as well.
function findSave(list,source){const id=source.slice(5),a=list||[];return a.find(r=>r.id===id)||a.find(r=>source==='save:'+r.id+'-'+r.savedAt)||a.find(r=>source.startsWith('save:'+r.id+'-')&&/^\d+$/.test(source.slice(6+r.id.length)))||null;}
async function fleetAsset(source){
 if(fleet.assets.has(source))return fleet.assets.get(source);
 let payload=null,key=source,alias=null;
 if(source==='current'){const data=C.serialize(ship);key='draft-'+fleetHash(JSON.stringify(data));payload={design:data};}
 else if(source.startsWith('save:')){
  let vs=null;try{vs=voy.saves;}catch(e){}
  let rec=findSave(fleet.saves,source)||findSave(vs,source);
  if(!rec){try{const all=await Store.list();fleet.saves=all;rec=findSave(all,source);}catch(e){}}
  if(!rec)throw new Error('保存艦が見つかりません');
  key='save:'+rec.id+'-'+rec.savedAt;if(source!==key&&source!=='save:'+rec.id)alias=source;
  if(!fleet.assets.has(key))payload={design:await unpack(rec.data)};
 }
 else if(source.startsWith('draft-')){const data=C.serialize(ship);if('draft-'+fleetHash(JSON.stringify(data))!==source)throw new Error('作業中の設計が変わったため、この艦の3Dモデルを準備できません');payload={design:data};}
 else if(!fleet.assets.has(key))payload={key:source};
 let asset=fleet.assets.get(key);
 if(!asset){
  // Stats and meshes for fleet ships are prepared by the engine in the background.
  const r=await YardEngineClient.request('fleet',payload);asset={key,design:r.design,stats:r.stats,p:r.profile,geometry:r.geometry};if(view)view.loadFleet(key,r.geometry);fleet.assets.set(key,asset);
 }
 if(alias){fleet.assets.set(alias,asset);if(view)view.loadFleet(alias,asset.geometry);}
 return asset;
}
async function fleetAdd(source=fleet.source,team=fleet.team){
 if(fleet.busy||!fleetCanRefit())return;if(fleetUnits().length>=C.FLEET_RULES.maxShips){toast('一度に並べられるのは12隻までです');return;}
 fleet.busy=true;fleetRender();await new Promise(r=>setTimeout(r,25));
 try{const a=await fleetAsset(source),u=C.fleetUnit('fleet-'+fleet.next++,a.key,a.p,fleet.mode==='review'?0:team);fleetUnits().push(u);fleet.selected=u.id;fleetArrange();fleetFit();}catch(e){console.error(e);toast('艦を追加できません：'+esc(e.message));}finally{fleet.busy=false;fleetRender();requestDraw();}
}
async function fleetSetMode(mode){
 if(!['design','tactical','review'].includes(mode)||fleet.busy)return;const prior=fleet.mode;if(prior===mode)return;const token=fleet.modeToken=(fleet.modeToken||0)+1;
 fleet.playing=false;fleet.lastClock=0;fleet.orbit=false;fleet.command='select';fleetMap.pointers.clear();fleetMap.drag=null;fleetMap.pinch=null;fleetMap.cursor=null;hideInspect();clearHover();
 if(view){if(prior==='design')fleet.designCamera={cam:JSON.parse(JSON.stringify(view.cam)),off:[...view.off]};else fleet.sceneCamera[prior]=JSON.parse(JSON.stringify(view.cam));}
 fleet.mode=mode;fleet.frame=null;fleet.replay=false;$('#app').classList.toggle('fleet-active',mode!=='design');$('#app').classList.toggle('review-active',mode==='review');$('#app').classList.toggle('tactical-active',mode==='tactical');$('#app').classList.remove('fleet-clean');fleet.clean=false;$('#fleetHud').hidden=mode==='design';$('#fleetLabels').hidden=mode!=='review';$('#fleetMap').hidden=mode!=='tactical';$('#fleetMapTools').hidden=mode!=='tactical';$('#fleetMapFallback').hidden=true;
 $$('#modeSwitch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 if(mode==='design'){if(view&&fleet.designCamera){view.cam=fleet.designCamera.cam;view.off=fleet.designCamera.off;}$('#fleetLabels').innerHTML='';renderPanel();renderSpecTargets();syncHud();updateUndo();requestDraw();return;}
 $('#dock').classList.remove('collapsed');$('#btnUndo').disabled=$('#btnRedo').disabled=true;
 if(!fleet.battle)fleet.battle=C.fleetBattle([]);fleet.selected=fleetUnits()[0]?.id||null;
 if(view){view.off=[0,0,0];if(fleet.sceneCamera[mode])view.cam=fleet.sceneCamera[mode];else{view.cam.target=[0,0,0];view.cam.th=.85;view.cam.ph=mode==='tactical'?.0006:1.04;view.cam.ortho=mode==='tactical';}}
 fleetRender();try{fleet.saves=await Store.list();}catch(e){fleet.saves=[];}if(token!==fleet.modeToken)return;
 if(!fleetUnits().length){await fleetAdd('current',0);if(fleetUnits().length){await fleetAdd(mode==='review'?'imperial':'current',mode==='review'?0:1);}fleet.selected=fleetUnits().find(u=>u.team===0)?.id||fleetUnits()[0]?.id||null;}if(mode==='tactical'&&fleet.battle.phase==='execute')fleet.frame=C.fleetSample(fleet.battle.last,fleet.elapsed);fleetRender();fleetFit();
}
function fleetArrange(){
 const units=fleetUnits();if(fleet.mode==='review'){C.fleetFormation(units,fleet.form,fleet.gap,false);return;}
 const fronts=[0,1].map(team=>Math.max(0,...units.filter(u=>u.team===team).map(u=>u.p.len/2))),distance=Math.max(C.FLEET_RULES.initialDistance,fronts[0]+fronts[1]+90000);
 for(const team of [0,1]){const us=units.filter(u=>u.team===team);C.fleetFormation(us,'line',C.FLEET_RULES.formationGap);for(const u of us){u.pos[0]+=team?distance/2:-distance/2;u.yaw=team?Math.PI:0;}}
}
function fleetFit(){if(fleet.mode==='tactical'){fleetMapFit();return;}if(!view)return;const us=fleetDisplay().filter(u=>!u.dead);if(!us.length)return;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const u of us){const a=fleet.assets.get(u.key),d=a?.stats.dims||[u.p.len,u.p.width||u.p.len*.5,u.p.height||100],r=Math.hypot(d[0],d[1])/2;for(let k=0;k<3;k++){const rr=k===1?d[2]/2:r;lo[k]=Math.min(lo[k],u.pos[k]-rr);hi[k]=Math.max(hi[k],u.pos[k]+rr);}}view.off=[0,0,0];view.cam.target=lo.map((x,i)=>(x+hi[i])/2);const aspect=(view.canvas.clientWidth||900)/(view.canvas.clientHeight||600),size=Math.max(hi[0]-lo[0],hi[2]-lo[2],(hi[1]-lo[1])*2);view.cam.r=Math.max(900,size*.7/Math.tan(view.cam.fov/2)*Math.max(1,1/aspect));requestDraw();}
function fleetFocus(){if(fleet.mode==='tactical'){fleetMapFocus();return;}const u=fleetSelected();if(u&&view){view.cam.target=[...u.pos];view.cam.r=Math.max(700,u.p.len*2.4);requestDraw();}}
function fleetPowerName(u){const o=u.order||{},now=C.POWER_MODES[u.mode]?.name;return o.power&&o.power!=='auto'&&C.POWER_MODES[o.power]?C.POWER_MODES[o.power].name:'自動'+(now?`（${now}）`:'');}
function fleetOrderText(u){const o=u.order,pw=' · 出力 '+fleetPowerName(u);if(o.type==='move')return `移動 → ${(o.point[0]/1000).toFixed(1)}, ${(o.point[2]/1000).toFixed(1)} km / 高度 ${(o.point[1]/1000).toFixed(1)} km`+pw;if(o.type==='attack')return '攻撃 → '+(fleetUnits().find(t=>t.id===o.target)?.name||'目標消失')+(o.aim&&o.aim!=='auto'?`（${C.AIM_KINDS[o.aim]}を照準）`:'')+pw;return '停止・位置保持'+pw;}
// Combat state for the readouts: sunk, out of the fight, or fighting, and why.
const FLEET_FATE={reactor:'炉心誘爆',fuel:'反応物誘爆',magazine:'弾薬庫誘爆',hull:'船体破断'};
function fleetStatusText(u){return u.dead?`撃沈（${FLEET_FATE[u.fate]||'船体破断'}）`:u.out?`戦闘不能（${u.out}）`:'戦闘可能';}
function fleetDamageList(u){const mods=u.p.modules||[];if(!mods.length||!u.mods)return '';const g={};mods.forEach((m,i)=>{if(m.k==='hull')return;const x=g[m.k]||(g[m.k]={n:0,lost:0,hit:0});x.n++;const v=u.mods[i]??1;if(v<=0)x.lost++;else if(v<1)x.hit++;});
 return Object.entries(g).filter(([,x])=>x.lost||x.hit).map(([k,x])=>`${C.MODULE_LABEL[k]} ${[x.lost?`${x.lost}/${x.n} 破壊`:'',x.hit?`${x.hit} 損傷`:''].filter(Boolean).join('・')}`).join('、');}
function fleetPowerHTML(u,editable){const o=u.order,cur=o.power||'auto',m=C.POWER_MODES[cur],combat=fleet.battle.combat;
 return `<div class="fleet-power"><h5>出力配分</h5><div class="chips">${[['auto','自動'],...Object.entries(C.POWER_MODES).map(([k,x])=>[k,x.name])].map(([k,n])=>`<button type="button" class="chip" data-fleet-power="${k}" aria-pressed="${cur===k}" ${editable?'':'disabled'}>${n}</button>`).join('')}</div><p class="note keep">${m?`${esc(m.note)}炉の上限 ${Math.round(m.max*100)}%、その負荷で炉に被弾したときの誘爆率 ${fPct(C.coreDetonation(m.max))}（1発あたり）。`:esc(C.POWER_AUTO_NOTE)}</p>
 <label class="fleet-aim">照準<select data-fleet-aim ${editable&&combat?'':'disabled'} aria-label="攻撃で狙う部位">${Object.entries(C.AIM_KINDS).map(([k,n])=>`<option value="${k}" ${(o.aim||'auto')===k?'selected':''}>${n}</option>`).join('')}</select></label><p class="note">部位を狙うと命中率が2割落ち、シールドを抜いた弾がその部位に当たりやすくなります。炉の誘爆は相手の炉心負荷しだいです。</p>
 <h5>射撃</h5><div class="chips">${Object.entries(C.VOLLEY.name).map(([k,n])=>`<button type="button" class="chip" data-fleet-volley="${k}" aria-pressed="${C.volleyMode(u)===k}" ${editable&&combat?'':'disabled'}>${n}</button>`).join('')}</div><p class="note">${C.volleyMode(u)==='salvo'?'斉射：同じ種類の砲がそろって撃ちます。一度に当たるので装甲を破りやすく（大口径の砲ほど効きます）、待つぶん発射数はわずかに減り、合間は敵が射撃を受けません。':'連続射撃：各砲が装填しだい撃ち続けます。発射数がいちばん多く、敵を絶えず射撃下に置きます（ハイパードライブの充填を止めます）。'}</p></div>`;}
function fleetOptions(){return `<option value="current">現在の設計</option><optgroup label="作例">${Object.entries(C.DESIGNS).map(([k,d])=>`<option value="${k}" ${fleet.source===k?'selected':''}>${esc(d.name)}</option>`).join('')}</optgroup>${fleet.saves.length?`<optgroup label="保存艦">${fleet.saves.map(r=>`<option value="save:${esc(r.id)}" ${fleet.source==='save:'+r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</optgroup>`:''}`;}
function fleetRoster(){return `<div class="fleet-roster">${fleetDisplay().map(u=>`<button type="button" data-fleet-select="${u.id}" class="fleet-unit ${u.team?'enemy':''} ${fleet.selected===u.id?'selected':''} ${u.dead?'destroyed':''} ${u.out?'disabled':''}" aria-pressed="${u.id===fleet.selected}"><span class="fleet-side">${fleet.mode==='review'?'◆':u.team?'敵':u===fleetFlag()?'旗':'友'}</span><span><b>${esc(u.name)}</b><small>${fleet.mode==='review'?fLen(u.p.len)+' / '+u.p.power.toFixed(3)+' ISD':u.dead||u.out?fleetStatusText(u):u.team?'敵艦 · AI指揮':u===fleetFlag()?'旗艦 · 自ら操艦':'僚艦 · 出力 '+fleetPowerName(u)}</small><span class="fleet-bars"><i style="width:${Math.max(0,u.hp/u.p.hp*100)}%"></i></span></span>${fleet.mode!=='review'?`<em>${Math.round(u.hp/u.p.hp*100)}%</em>`:''}</button>`).join('')||'<p class="note">艦を追加してください。</p>'}</div>`;}
function fleetControlsHTML(){
 const review=fleet.mode==='review',b=fleet.battle,u=fleetSelected(),editable=fleetEditable()&&u&&!u.dead&&!u.out&&(review||u.team===0),lock=!fleetCanRefit(),busy=fleet.busy;
 let h=`<div class="fleet-heading"><span>${review?'FLEET REVIEW':'FLEET ACTION'}</span><h2>${review?'観閲式':'艦隊戦'}</h2><p>${review?'設計した艦を、同じ縮尺の宇宙に。':'旗艦を自ら操艦し、僚艦と敵艦隊は実空間で戦う。'}</p></div>`;
 if(!review){const flag=fleetFlag(),foes=fleetUnits().filter(x=>x.team===1).length,ready=!!flag&&foes>0&&!busy;h+=`<div class="fleet-space"><label>戦場<select data-fleet-setting="system">${Object.values(SYSTEMS).filter(x=>x.key!=='rts').map(x=>`<option value="${x.key}" ${fleet.system===x.key?'selected':''}>${esc(x.name)}${x.planet.ring?' · 造船リング':' · '+esc(x.short)}</option>`).join('')}</select></label><p class="fleet-flag"><span>旗艦</span><b>${flag?esc(flag.name):'友軍の艦を追加してください'}</b></p><button class="btn primary" data-fleet-action="space" ${ready?'':'disabled'}>旗艦で出撃</button><p class="note keep">${!flag?'友軍の艦を追加すると出撃できます。':!foes?'敵艦を1隻以上追加してください。':`旗艦を公試と同じ操作で操艦します。僚艦 ${fleetUnits().filter(x=>x.team===0).length-1} 隻と敵 ${foes} 隻はAIが戦い、敵は数秒後にハイパースペースから出現します。`}</p></div>`;}
 h+=`<details class="fleet-add" ${lock?'':'open'}><summary>艦隊編成 · ${fleetUnits().length} / 12 隻</summary><label>追加する設計<select id="fleetSource" ${lock||busy?'disabled':''}>${fleetOptions()}</select></label>${!review?`<div class="seg"><button type="button" data-fleet-team="0" aria-pressed="${fleet.team===0}">友軍</button><button type="button" data-fleet-team="1" aria-pressed="${fleet.team===1}">敵軍（AI）</button></div>`:''}<button class="btn" data-fleet-action="add" ${lock||busy?'disabled':''}>${busy?'艦を準備中…':'艦を追加'}</button>${lock?'<p class="note">編成を変えるときは「開始位置に戻す」を押してください。</p>':''}</details>`;
 h+=fleetRoster();
 if(review)h+=`<div class="pgroup"><h4>隊列</h4><div class="chips">${[['line','横列'],['column','縦列'],['wedge','楔形'],['grid','整列']].map(([k,l])=>`<button class="chip" data-fleet-form="${k}" aria-pressed="${fleet.form===k}">${l}</button>`).join('')}</div><label class="fleet-range">艦間隔 <b>${fLen(fleet.gap)}</b><input aria-label="隊列の艦間隔" type="range" min="0" max="5000" step="100" value="${fleet.gap}" data-fleet-setting="gap"></label><p class="note">間隔は最大艦の長さ・幅に加算します。隊列を選び直すと個別配置を整列します。</p></div>`;
 if(!review)h+=`<p class="note fleet-rules">敵艦隊は約22 km前方に出現します。砲の射程は長射程 40 km・中射程 22 km・舷側砲 9 km。シールドは炉からの給電で再生し、パワーセルの蓄電が不足分を肩代わりします。シールドを抜けた砲火は装甲に負荷として溜まり、耐えきれなくなると貫通してモジュールを壊し、火災や誘爆を起こします。全力で機動すると推進が炉の出力を奪い、ほとんど撃てません。戦闘中にハイパードライブで別の星系へ離脱できます。</p>`;
 if(u)h+=`<div class="pgroup fleet-orders"><h4>${esc(u.name)}</h4>${review?`<div class="fleet-coords">${[['0','前後 X',u.pos[0]],['1','上下 Y',u.pos[1]],['2','左右 Z',u.pos[2]],['yaw','方位 °',u.yaw*180/Math.PI]].map(([k,l,v])=>`<label>${l}<input type="number" data-fleet-pos="${k}" value="${Math.round(v)}" step="${k==='yaw'?5:100}" aria-label="${l}"></label>`).join('')}</div><button class="btn sm" data-fleet-action="position">画面上で配置する</button>`:`<p class="note">${u.team?'敵艦はAIが指揮します。戦闘開始の数秒後にハイパースペースから出現します。':u===fleetFlag()?'旗艦 — 出撃するとこの艦を操艦します。出力配分は戦闘中に ⚡ ボタンまたは P キーで切り替えます。':'僚艦 — 出撃後は旗艦を護衛します（旗艦の艦橋と敵のあいだに入り、旗艦を狙う敵を優先して撃ち、射線をふさぎます）。戦闘中に T キーまたは「随伴艦」ボタンで自由攻撃に切り替えられます。出力配分と照準をここで指定できます。'}</p>${u.team===0&&u!==fleetFlag()?`<div class="chips"><button class="chip" data-fleet-action="flagship">旗艦にする</button></div>${fleetPowerHTML(u,editable)}`:''}`}<div class="chips"><button class="chip" data-fleet-action="focus">この艦を見る</button><button class="chip" data-fleet-action="remove" ${lock||busy?'disabled':''}>編成から外す</button></div></div>`;
 h+=`<div class="pgroup"><h4>表示</h4><div class="chips"><button class="chip" data-fleet-action="fit">艦隊全体</button>${review?'<button class="chip" data-fleet-action="top">真上</button><button class="chip" data-fleet-action="iso">斜め</button>':`<button class="chip" data-fleet-action="ranges" aria-pressed="${fleet.ranges}">射程円</button>`}<button class="chip" data-fleet-action="labels" aria-pressed="${fleet.labels}">艦名表示</button>${review?`<button class="chip" data-fleet-action="orbit" aria-pressed="${fleet.orbit}">自動周回</button><button class="chip" data-fleet-action="clean">鑑賞表示</button><button class="chip" data-fleet-action="saveReview">配置を保存</button><button class="chip" data-fleet-action="loadReview">保存配置を開く</button>`:''}</div></div><p class="note">${review?'ドラッグで回転、ホイール・2本指で拡大縮小。Shift＋ドラッグで平行移動。':'友軍と敵の艦を追加し、旗艦を選んで「旗艦で出撃」。図は編成の確認用で、1本指で移動、2本指・ホイール・＋/−で拡大縮小。戦闘は出撃後の実空間で行います。'}</p>`;return h;
}
function fleetDetailsHTML(){const u=fleetSelected(),s=u&&fleet.assets.get(u.key)?.stats;return `<div class="spec-title"><h3>${fleet.mode==='review'?'観閲艦の諸元':'戦術情報'}</h3></div>${u&&s?`<div class="fleet-readout"><h3>${esc(u.name)}</h3><dl><dt>全長</dt><dd>${fLen(u.p.len)}</dd><dt>主出力</dt><dd>${s.xISD.toFixed(3)} ISD</dd><dt>最大加速度（設計）</dt><dd>${fG(s.accelG)}</dd><dt>航空容量</dt><dd>${(s.aviation?.capacity||0).toFixed(2)} サイズ</dd><dt>搭載</dt><dd>${s.slots} 機</dd><dt>発艦可能</dt><dd>${s.deployableSlots??s.slots} 機</dd><dt>ハイパードライブ</dt><dd>${s.hyperClass==null?'なし':'クラス '+num(s.hyperClass,2)}</dd>${fleet.mode==='tactical'?`<dt>構造</dt><dd>${fPct(u.hp/u.p.hp)}</dd><dt>シールド</dt><dd>${u.shieldMax?fPct(u.shield/u.shieldMax):'なし'}</dd><dt>パワーセル蓄電</dt><dd>${u.bankMax?fPct((u.bank??0)/u.bankMax):'なし'}</dd><dt>状態</dt><dd class="${u.dead||u.out?'fleet-bad':''}">${fleetStatusText(u)}</dd><dt>装甲</dt><dd>${fPct(u.armor??1)}</dd><dt>兵装エネルギー</dt><dd>${u.p.wCap?fPct((u.energy??0)/u.p.wCap):'—'}</dd><dt>炉心負荷</dt><dd>${fPct(u.load||0)}（誘爆 ${fPct(C.coreDetonation(u.load||0))}）</dd><dt>出力配分</dt><dd>${fleetPowerName(u)}</dd><dt>乗員</dt><dd>${num(Math.round(u.crew??0))} / ${num(u.p.crewNeed||0)} 名</dd>${u.ammo?.some(n=>n>0)||(u.p.modules||[]).some(m=>m.k==='launcher')?`<dt>ミサイル残弾</dt><dd>${num(Math.round((u.ammo||[]).reduce((n,x)=>n+x,0)))} 発</dd>`:''}<dt>出撃中</dt><dd>${Math.floor(u.air)} 機</dd><dt>戦術速度</dt><dd>${(C.len(u.velocity||[0,0,0])/1000).toFixed(2)} km/s</dd><dt>方位</dt><dd>${Math.round(((90-u.yaw*180/Math.PI)%360+360)%360)}°</dd><dt>高度</dt><dd>${(u.pos[1]/1000).toFixed(1)} km</dd>${fleetMapTarget(u)?`<dt>最寄り／指定目標距離</dt><dd>${(C.len(C.sub(fleetMapTarget(u).pos,u.pos))/1000).toFixed(1)} km</dd>`:''}${u.p.slidingHatches?`<dt>発艦ハッチ</dt><dd>${fleetHatchText(u)}</dd>`:''}`:''}</dl>${fleet.mode==='tactical'&&u.p.modules?`<p class="note keep fleet-damage"><b>損傷</b> ${esc(fleetDamageList(u)||'なし')}</p>`:''}</div>`:'<p class="note">艦を選択してください。</p>'}${fleet.mode==='tactical'?`<h4>経過記録</h4><ol class="fleet-log">${fleetLogEvents().slice(-12).map(e=>`<li class="${/撃沈|戦闘不能|誘爆/.test(e.text)?'bad':''}"><time>${fTime(e.time)}</time>${fleetLogSide(e)}${esc(e.text)}</li>`).join('')||'<li>各艦に命令を設定できます。</li>'}</ol><p class="note">青は友軍、赤は敵軍。射撃と損害は同じ時刻の状態から集計します。実行中の命令変更はできません。次のターンで変更できます。</p>`:'<p class="note">艦体・艦橋・兵装は設計画面と共通の部品構成です。艦ごとの拡大率は変えず、実寸比で表示しています。</p>'}`;}
// The log shows finished turns plus the current turn up to the frame on screen.
function fleetLogEvents(){const b=fleet.battle;if(!b)return [];const now=fleet.frame?.time;return [...b.events,...(b.phase==='execute'&&b.last&&now!=null?b.last.events.filter(e=>e.time<=now):[])];}
function fleetLogSide(e){const u=fleetUnits().find(x=>x.id===e.id);return u?`<span class="fleet-log-side ${u.team?'enemy':''}">${u.team?'敵':'友'}</span>`:'';}
function fleetRender(){if(fleet.mode==='design')return;$('#panel').innerHTML=fleetControlsHTML();$('#specSide').innerHTML=fleetDetailsHTML();fleetHud();fleetMapRefreshTools();requestDraw();}
function fleetHud(){if(fleet.mode==='design')return;const b=fleet.battle,review=fleet.mode==='review';$('#fleetHud').innerHTML=`<div class="fleet-hud-title"><span>${review?'観閲式 / 実寸比':'艦隊編成 / 旗艦を選んで出撃'}</span><b>${review?fleetUnits().length+' 隻':`友 ${fleetUnits().filter(u=>u.team===0).length} · 敵 ${fleetUnits().filter(u=>u.team===1).length} 隻`}</b></div><div class="fleet-hud-actions">${review?`<button class="chip" data-fleet-action="clean">${fleet.clean?'操作を表示':'鑑賞表示'}</button>`:`<button class="chip primary" data-fleet-action="space" ${fleetFlag()&&fleetUnits().some(u=>u.team===1)&&!fleet.busy?'':'disabled'}>旗艦で出撃</button>`}<button class="chip" data-fleet-action="fit">全体</button><button class="chip" data-mode="design">設計へ戻る</button></div><p>${fleet.command==='move'?'空白をタップして移動 / 高度 '+fleet.altitude+' m':fleet.command==='attack'?'攻撃する敵艦の記号をタップ':fleet.command==='position'?'配置先をクリック':review?'ドラッグで回転 · ホイールでズーム':'記号を選択 · 友軍の艦を「旗艦にする」で操艦する艦を指定'}</p>`;}
function fleetSetOrder(o){if(C.fleetOrder(fleet.battle,fleet.selected,o)){fleet.command='select';fleetRender();}}
function fleetReset(){const b=fleet.battle;fleet.playing=false;fleet.replay=false;fleet.frame=null;fleet.elapsed=0;fleet.battle=C.fleetBattle(b.units.filter(u=>b.combat||u.team===0).map(u=>C.fleetUnit(u.id,u.key,u.p,u.team)),b.combat);fleet.battle.seconds=b.seconds;fleet.selected=fleet.battle.units.find(u=>u.team===0)?.id||null;fleetArrange();fleetFit();fleetRender();}
function fleetExecute(){const b=fleet.battle;if(fleet.busy||fleet.replay||b.phase!=='plan')return;if(b.combat&&!b.units.some(u=>u.team===1&&!u.dead)){toast('敵艦を追加してください');return;}if(!C.fleetCommit(b))return;fleet.elapsed=0;fleet.frame=C.fleetSample(b.last,0);fleet.playing=true;fleet.lastClock=0;fleet.command='select';fleetRender();}
function fleetPick(px,py){if(!view)return null;let best=null,score=Infinity;for(const u of fleetDisplay().filter(u=>!u.dead)){const p=view.project(u.pos),q=view.project(C.add(u.pos,[u.p.len*.5,0,0])),r=Math.max(22,Math.min(90,Math.hypot(q[0]-p[0],q[1]-p[1]))),d=Math.hypot(px-p[0],py-p[1]);if(p[2]>=-1&&p[2]<=1&&d<r&&d<score){best=u;score=d;}}return best;}
function fleetTap(px,py){
 if(fleet.mode==='tactical'){const rect=fleetMapSize();fleetMapTap(px-rect.left,py-rect.top);return;}
 const u=fleetPick(px,py),selected=fleetSelected();if(fleet.mode==='tactical'&&u?.team===1&&selected?.team===0&&fleetEditable()){fleetSetOrder({type:'attack',target:u.id,fire:true});return;}
 if(fleet.command==='move'||fleet.command==='position'){if(!fleetEditable()||!selected)return;const r=view?.ray(px,py);if(!r||Math.abs(r.d[1])<.03){toast('真上か斜めの視点で指定してください');return;}const y=fleet.mode==='review'?selected.pos[1]:fleet.altitude,t=(y-r.o[1])/r.d[1];if(t<=0)return;const p=C.add(r.o,C.mul(r.d,t));if(fleet.mode==='review'){selected.pos=p;const real=fleet.review.find(x=>x.id===selected.id);real.pos=p;fleet.command='select';fleetRender();}else fleetSetOrder({type:'move',point:p});return;}
 if(u){fleet.selected=u.id;fleetRender();}
}
function fleetDrawLines(us){if(!view)return;const grid=Gfx.lineSet(),orders=Gfx.lineSet(),shots=Gfx.lineSet(),review=fleet.mode==='review';if(!review){const c=view.cam.target,R=Math.max(10000,view.cam.r),step=R>60000?10000:R>25000?5000:1000,cx=Math.round(c[0]/step)*step,cz=Math.round(c[2]/step)*step;for(let k=-12;k<=12;k++){grid.seg([cx+k*step,0,cz-12*step],[cx+k*step,0,cz+12*step],[65,108,135,65]);grid.seg([cx-12*step,0,cz+k*step],[cx+12*step,0,cz+k*step],[65,108,135,65]);}}
 for(const u of us){if(u.dead)continue;const col=u.team?[255,111,97,210]:[92,205,238,220];if(!fleet.clean&&(u.id===fleet.selected||!review)){orders.circle(u.pos,[1,0,0],[0,0,1],u.p.len*.57,[...col.slice(0,3),u.id===fleet.selected?230:80]);}if(!review&&u.team===0&&fleet.battle.phase==='plan'){const o=u.order,p=o.type==='move'?o.point:o.type==='attack'?us.find(t=>t.id===o.target)?.pos:null;if(p){orders.seg(u.pos,p,col);orders.cross(p,180,col);}}}
 if(!review&&fleet.frame?.shots&&Math.floor(fleet.elapsed*6)%3!==2){for(const s of fleet.frame.shots){const a=us.find(u=>u.id===s.from),b=us.find(u=>u.id===s.to);if(!a||!b||a.dead)continue;const d=C.sub(b.pos,a.pos),q=(fleet.elapsed*3)%1,head=C.add(a.pos,C.mul(d,q)),tail=C.add(a.pos,C.mul(d,Math.max(0,q-.18)));shots.seg(tail,head,s.ion?[100,180,255,255]:s.team?[255,80,65,255]:[103,255,155,255]);}}
 view.setLines('fleetGrid',grid.out());view.setLines('fleetOrders',orders.out());view.setLines('fleetShots',shots.out());
}
function fleetRenderLabels(us){const el=$('#fleetLabels');if(!view||!fleet.labels||fleet.clean){el.innerHTML='';return;}const rect=view.canvas.getBoundingClientRect();el.innerHTML=us.filter(u=>!u.dead).map(u=>{const p=view.project(C.add(u.pos,[0,-u.p.height*.5,0]));if(p[2]<-1||p[2]>1||p[0]<rect.left||p[0]>rect.right||p[1]<rect.top||p[1]>rect.bottom)return '';return `<span class="fleet-label ${u.team?'enemy':''}" style="left:${p[0]-rect.left}px;top:${p[1]-rect.top+15}px"><b>${esc(u.name)}</b>${fleet.mode==='review'?`<small>${fLen(u.p.len)}</small>`:`<small>構造 ${fPct(u.hp/u.p.hp)} · SH ${u.shieldMax?fPct(u.shield/u.shieldMax):'—'}</small>`}</span>`;}).join('');}
function fleetLoop(now){
 const dt=fleet.lastClock?Math.min(.1,(now-fleet.lastClock)/1000):0;fleet.lastClock=now;
 if(fleet.mode==='tactical'&&fleet.playing&&fleet.battle.last){fleet.elapsed=Math.min(fleet.battle.last.duration,fleet.elapsed+dt*fleet.speed);fleet.frame=C.fleetSample(fleet.battle.last,fleet.elapsed);dirty.draw=true;if(fleet.elapsed>=fleet.battle.last.duration){fleet.playing=false;if(!fleet.replay)C.fleetFinish(fleet.battle);fleet.replay=false;fleet.frame=null;fleetRender();}else if(Math.floor(now/250)!==fleet.lastHud){fleet.lastHud=Math.floor(now/250);const clock=$('#fleetHud .fleet-hud-title b');if(clock)clock.textContent='TURN '+fleet.battle.turn+' · T+'+Math.floor(fleet.frame.time)+'s';const p=$('#fleetProgress');if(p)p.value=fleet.elapsed/fleet.battle.last.duration;$('#specSide').innerHTML=fleetDetailsHTML();fleetMapRefreshTools();}}
 if(fleet.mode==='review'&&fleet.orbit&&view){view.cam.th+=dt*.10;dirty.draw=true;}
 if(dirty.draw||(fleet.mode==='review'&&renderHealth.mode==='webgl'&&now-renderHealth.lastFrame>1500)){const us=fleetDisplay();if(fleet.mode==='tactical'){fleetMapDraw(us);dirty.draw=false;}else{fleetDrawLines(us);if(view&&view.draw({fleet:us,mode:'review'})!==false){dirty.draw=false;renderHealth.frames++;renderHealth.lastFrame=now;renderHealth.failures=0;}fleetRenderLabels(us);}}
}
async function fleetSaveReview(){const data={version:1,form:fleet.form,gap:fleet.gap,assets:Object.fromEntries([...new Set(fleet.review.map(u=>u.key))].map(k=>[k,fleet.assets.get(k).design])),ships:fleet.review.map(u=>({key:u.key,name:u.name,pos:u.pos,yaw:u.yaw})),camera:view?.cam};if(LS.set('yard.review1',JSON.stringify(data)))toast('観閲式の配置を保存しました');else toast('配置を保存できませんでした。端末の空き容量を確認してください。');}
async function fleetLoadReview(){if(fleet.busy)return;const raw=LS.get('yard.review1');if(!raw){toast('保存した観閲式はまだありません');return;}fleet.busy=true;fleetRender();await new Promise(r=>setTimeout(r,25));try{const d=JSON.parse(raw);if(d.version!==1||!Array.isArray(d.ships)||d.ships.length>12)throw new Error('形式が違います');const next=[];for(const u of d.ships){if(!u.pos?.every(Number.isFinite)||u.pos.length!==3||!Number.isFinite(u.yaw))throw new Error('配置が不正です');const data=d.assets[u.key],key='review-'+fleetHash(JSON.stringify(data));let a=fleet.assets.get(key);if(!a){const r=await YardEngineClient.request('fleet',{design:data});a={key,design:r.design,stats:r.stats,p:r.profile,geometry:r.geometry};view?.loadFleet(key,r.geometry);fleet.assets.set(key,a);}next.push({...C.fleetUnit('fleet-'+fleet.next++,key,a.p),pos:[...u.pos],yaw:u.yaw});}fleet.review=next;fleet.form=d.form||'line';fleet.gap=C.clamp(Number(d.gap)||0,0,5000);fleet.selected=next[0]?.id||null;fleetPrune();fleetFit();toast('観閲式の配置を開きました');}catch(e){toast('配置を開けません：'+esc(e.message));}finally{fleet.busy=false;fleetRender();}}
function bindFleet(){
 bindFleetMap();
 const click=e=>{const t=e.target.closest('button');if(!t||t.disabled)return;const d=t.dataset;if(d.mode){fleetSetMode(d.mode);return;}if(fleet.mode==='design')return;
 if(d.fleetSelect){fleet.selected=d.fleetSelect;fleetRender();return;}if(d.fleetPower){const u=fleetSelected();if(u&&fleetEditable())fleetSetOrder({type:u.order.type,power:d.fleetPower});return;}if(d.fleetVolley){const u=fleetSelected();if(u&&fleetEditable())fleetSetOrder({type:u.order.type,volley:d.fleetVolley});return;}if(d.fleetTeam!=null){if(fleetCanRefit()){fleet.team=+d.fleetTeam;fleetRender();}return;}if(d.fleetForm){fleet.form=d.fleetForm;fleetArrange();fleetFit();fleetRender();return;}
 const a=d.fleetAction,u=fleetSelected();if(!a)return;
 if(a==='add')return fleetAdd();if(a==='space')return spaceBattleLaunch();if(a==='flagship'){if(u&&u.team===0){fleet.flagship=u.id;toast(u.name+'を旗艦に指定しました');}fleetRender();return;}if(a==='execute')return fleetExecute();if(a==='pause'){if(fleet.battle.phase==='execute'||fleet.replay){fleet.playing=!fleet.playing;fleet.lastClock=0;fleetRender();}return;}
 if(a==='replay'){if(fleet.battle.last&&fleet.battle.phase!=='execute'){fleet.replay=true;fleet.elapsed=0;fleet.frame=C.fleetSample(fleet.battle.last,0);fleet.playing=true;fleet.lastClock=0;fleetRender();}return;}
 if(a==='reset'){fleetReset();return;}if(a==='move'||a==='attack'||a==='position'){if(fleetEditable()){fleet.command=a;fleetRender();}return;}if(a==='hold'){fleetSetOrder({type:'hold',target:null});return;}
 if(a==='launch'&&u&&fleetEditable()&&!u.dead&&u.team===0){fleetSetOrder({type:u.order.type,launch:u.order.launch!==true});return;}
 if(a==='moveCoords'&&u&&fleetEditable()){fleetSetOrder({type:'move',point:[fleet.moveX*1000,fleet.altitude,fleet.moveZ*1000]});return;}
 if(a==='zoomIn')fleetMapZoom(.75);if(a==='zoomOut')fleetMapZoom(1/.75);if(a==='ranges')fleet.ranges=!fleet.ranges;
 if(a==='focus')fleetFocus();if(a==='fit')fleetFit();if(a==='top'&&view){view.cam.th=Math.PI/2;view.cam.ph=.0006;view.cam.ortho=true;}if(a==='iso'&&view){view.cam.th=.85;view.cam.ph=1.02;view.cam.ortho=false;}if(a==='labels')fleet.labels=!fleet.labels;if(a==='orbit')fleet.orbit=!fleet.orbit;if(a==='clean'){fleet.clean=!fleet.clean;$('#app').classList.toggle('fleet-clean',fleet.clean);setTimeout(()=>{requestDraw();},60);}
 if(a==='remove'&&u&&fleetCanRefit()){const us=fleetUnits(),i=us.findIndex(v=>v.id===u.id);us.splice(i,1);fleet.selected=us[0]?.id||null;fleetPrune();}
 if(a==='saveReview')return fleetSaveReview();if(a==='loadReview')return fleetLoadReview();fleetRender();
 };
 $('#modeSwitch').addEventListener('click',click);$('#panel').addEventListener('click',click);$('#fleetHud').addEventListener('click',click);$('#fleetMapTools').addEventListener('click',click);
 const change=e=>{const d=e.target.dataset,v=e.target.value,u=fleetSelected();if(e.target.id==='fleetSource'){fleet.source=v;return;}if(d.fleetSetting){const k=d.fleetSetting;if(k==='speed')fleet.speed=+v;if(k==='system'&&SYSTEMS[v])fleet.system=v;if(k==='moveX'||k==='moveZ'){fleet[k]=C.clamp(+v||0,-C.FLEET_RULES.maxCoordinate/1000,C.FLEET_RULES.maxCoordinate/1000);return;}if(k==='seconds'&&fleet.battle.phase==='plan')fleet.battle.seconds=C.clamp(+v,5,30);if(k==='altitude')fleet.altitude=C.clamp(+v||0,-15000,15000);if(k==='combat'&&fleetCanRefit()){fleet.battle.combat=v==='1';fleet.team=0;fleetReset();}if(k==='gap'&&fleet.mode==='review'){fleet.gap=+v;fleetArrange();fleetFit();}fleetRender();}if(d.fleetPos!=null&&u&&fleet.mode==='review'&&v!==''&&Number.isFinite(+v)){const r=fleet.review.find(x=>x.id===u.id);if(d.fleetPos==='yaw')r.yaw=+v*Math.PI/180;else r.pos[+d.fleetPos]=C.clamp(+v,-150000,150000);requestDraw();}if(d.fleetOrder&&u&&fleetEditable())fleetSetOrder({type:u.order.type,[d.fleetOrder]:e.target.checked});if(d.fleetAim!=null&&u&&fleetEditable())fleetSetOrder({type:u.order.type,aim:v});};
 $('#panel').addEventListener('change',change);
 window.addEventListener('keydown',e=>{if(fleet.mode==='design'||e.target.matches('input,textarea,select'))return;if(e.code==='Space'){e.preventDefault();if(fleet.battle?.phase==='execute'||fleet.replay){fleet.playing=!fleet.playing;fleet.lastClock=0;fleetRender();}}if(e.key==='Escape'){fleet.command='select';fleet.clean=false;$('#app').classList.remove('fleet-clean');fleetRender();}});
}
function fleetPrune(){if(typeof voy!=='undefined'&&voy.w)return;const keys=new Set([...fleet.review,...(fleet.battle?.units||[])].map(u=>u.key));for(const k of fleet.assets.keys())if(!keys.has(k))fleet.assets.delete(k);view?.pruneFleet(keys);}

st.surfaceMode='horizontal';st.structPitch=0;st.structRoll=0;
function surfaceControls(p,selected){const pitch=selected?p.pitch||0:st.structPitch,roll=selected?p.roll||0:st.structRoll;return `<div class="surface-controls"><h4>配置の向き</h4>${selected?`<p class="note">${p.surfaceNormal?'接触面に沿った座標系':'船体の水平座標系'}で回転します。</p><button class="chip" data-surface-reset>水平へ戻す</button>`:seg('surfacemode',[['horizontal','水平を保つ'],['surface','接触面に沿う']],st.surfaceMode)}<div class="sliders">${slider(selected?'surfacePitch':'newSurfacePitch','前後の傾き',pitch,-180,180,1,deg(pitch))}${slider(selected?'surfaceRoll':'newSurfaceRoll','左右の傾き',roll,-180,180,1,deg(roll))}</div>${!selected?'<p class="note">接触面の法線に構造物の上方向を揃え、底面を接地させます。斜面・舷側・下面に対応。回転は接触面上の方位、傾きはその面に対する追加角度です。</p>':''}</div>`;}
function bindSurface(){
 $('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.surfacemode){st.surfaceMode=b.dataset.surfacemode;renderPanel();}if('surfaceReset'in b.dataset){const p=selItem();if(p?.k==='struct'){mutate('構造物を水平へ戻す',()=>editSel(q=>{delete q.surfaceNormal;q.pitch=0;q.roll=0;}),'parts');renderPanel();}}});
 $('#panel').addEventListener('input',e=>{const k=e.target.dataset.sl;if(!['surfacePitch','surfaceRoll','newSurfacePitch','newSurfaceRoll'].includes(k)||e.target.value===''||!Number.isFinite(+e.target.value))return;const v=C.clamp(+e.target.value,-180,180),pitch=k.endsWith('Pitch');if(k.startsWith('new')){st[pitch?'structPitch':'structRoll']=v;}else{const p=selItem();if(p?.k!=='struct')return;beginDrag('構造物の傾き');editSel(q=>q[pitch?'pitch':'roll']=v);touch('parts');scheduleStats(150);}const o=$('#out-'+k);if(o)o.textContent=deg(v);});
 $('#panel').addEventListener('change',e=>{if(['surfacePitch','surfaceRoll'].includes(e.target.dataset.sl)){endDrag();renderPanel();}});
}

st.planCut={from:.25,to:.52,innerFrom:.38,innerTo:.44,remainingWidth:.5,side:'both'};
function planCutControls(){const input=(c,id)=>`<div class="fleet-coords">${[['from','開始位置 %'],['innerFrom','奥辺の後端 %'],['innerTo','奥辺の前端 %'],['to','終了位置 %'],['remainingWidth','中央に残す幅 %']].map(([k,l])=>`<label>${l}<input type="number" data-plancut="${id}" data-cutprop="${k}" value="${Math.round(c[k]*1000)/10}" min="0" max="100" step=".1"></label>`).join('')}</div>`;return `<details class="trench-editor" open><summary>平面の台形切削</summary><p class="note">楔形の左右を台形に削ります。元の甲板と船底の傾斜を保ち、切り口に垂直の舷側壁を作ります。幅を絞る船体断面とは別の加工です。</p>${seg('plancutside',[['both','両舷'],['port','左舷'],['stbd','右舷']],st.planCut.side)}${input(st.planCut,'new')}<button class="btn primary" data-plan-add>台形に切り取る</button>${ship.cuts.filter(c=>c.type==='planTrapezoid').map(c=>`<details><summary>加工 #${c.id} · ${c.side==='both'?'両舷':c.side==='port'?'左舷':'右舷'}</summary>${input(c,c.id)}<button class="btn sm" data-delcut="${c.id}">切削を取り消す</button></details>`).join('')}</details>`;}
function bindPlanCuts(){
 $('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.plancutside){st.planCut.side=b.dataset.plancutside;renderPanel();}if('planAdd'in b.dataset){mutate('船体左右を台形に切削',()=>ship.cuts.push(C.normalizePlanCut({id:ship.nextId++,...st.planCut})),'hull');renderPanel();}});
 $('#panel').addEventListener('change',e=>{const t=e.target,id=t.dataset.plancut,k=t.dataset.cutprop;if(!id||!['from','to','innerFrom','innerTo','remainingWidth'].includes(k)||t.value===''||!Number.isFinite(+t.value))return;const v=+t.value/100;if(id==='new'){st.planCut[k]=v;C.normalizePlanCut(st.planCut);}else{const c=ship.cuts.find(c=>c.id===+id&&c.type==='planTrapezoid');if(c)mutate('台形切削の形を変更',()=>{c[k]=v;C.normalizePlanCut(c);},'hull');}renderPanel();});
}

st.alignment='none';st.showHabitation=false;
function alignmentControls(selected=false){return `<div class="pgroup"><h4>${selected?'中心線・中心面へ整列':'配置位置を揃える'}</h4>${seg(selected?'alignselected':'placementalign',Object.entries(C.ALIGNMENTS).filter(([k])=>!selected||k!=='none'),selected?'':st.alignment)}<p class="note">基準は基本船体の寸法。中心線は上下中心面と左右中心面の交線です。${selected?'左右対を中心線へ移すと1個にまとめます。':'選択した座標だけ固定し、残りはタップした位置に合わせます。'}</p></div>`;}
function replacementControls(p){const keys=C.replacementOptions(p);return keys.length?`<div class="pgroup"><h4>同じ形状の設備へ交換</h4><label>交換先<select data-replacement>${keys.map(k=>`<option value="${k}" ${k===p.k?'selected':''}>${esc(C.PARTS[k].name)}</option>`).join('')}</select></label><p class="note">位置・寸法・輪郭を維持して用途を交換します。${C.isReactor(p)?'主炉と補助炉は、同じ実体積なら同じ発電出力です。補助炉は船体外の部分を除いて計算します。':'性能は交換先の設備と寸法に従います。'}航空区画を別用途にすると、付随する開口も撤去します。元に戻す操作に対応。</p></div>`:'';}
function commandControls(f){const p=C.commandCompartments(ship).find(p=>p.windowId===f.id),inf=S?.commandInfo?.[f.id];return `<div class="pgroup blueprint-card" id="command-editor"><h4>${esc(C.COMMAND_ROLES[C.FITS[f.k].role])}区画</h4><label><input type="checkbox" data-command-enabled ${f.commandEnabled!==false?'checked':''}> ポッドの背後に指揮区画を確保</label><div class="sliders">${slider('commandDepth','壁から船内への奥行き',f.commandDepth??12,2,200,1,fmtM(f.commandDepth??12))}${slider('commandHeight','指揮室の高さ',f.commandHeight??Math.max(8,(f.height||4)+3),2,80,1,fmtM(f.commandHeight??Math.max(8,(f.height||4)+3)))}</div><p>占有 ${ja(p?C.partVolume(p):0)} m³ · 稼働 ${fPct(inf?.ratio||0)}</p><p class="note">幅はポッドの直径に連動。外殻内に切取り、機関・主砲充電装置との干渉も点検します。指揮能力はこの区画の有効容積に応じます。</p><button class="btn" data-command-view="${f.id}">指揮区画を透視</button>${f.host?`<button class="btn" data-layout-part="${f.host}">艦橋の構造を編集</button>`:''}</div>`;}
function derivedRoomsHTML(host){const commands=C.commandCompartments(ship).filter(p=>host==null||p.host===host);return `<div class="pgroup"><h4>艦橋に付随する指揮区画</h4>${commands.map(p=>`<button class="engine-row" data-command-view="${p.windowId}"><span>${esc(p.label)} #${p.windowId}</span><b>${ja(C.partVolume(p))} m³</b></button>`).join('')||'<p class="note">艦橋ポッド・航空指揮所窓を構造の壁面に配置すると、背後に指揮区画を確保します。無窓式指揮室は区画メニューから配置できます。</p>'}</div>`;}
function feedSrc(fd,short=false){const c=fd?.[2]||0;return c>.999?(short?'セル':'パワーセルから'):c<.001?(short?'炉':'炉から'):(short?'セル+炉':`セル ${Math.round(c*100)}%・炉 ${Math.round((1-c)*100)}% · 平均`);}
function feedTop(n=5){const info=S?.feedInfo||{};return Object.entries(info).map(([id,fd])=>({f:ship.fits.find(f=>f.id===+id),fd,v:fd[0],l:fd[1]})).filter(r=>r.f&&r.v>0).sort((a,b)=>b.v-a.v).slice(0,n);}
function habitationHTML(){const K=S?.personVolume||0,F=S?.autoHabitationVolume||0,V=S?.feedVolume||0,H=S?.habitableVolume??F,top=feedTop(5),short=(S?.habit??1)<1,cells=S?.feedCellCount||0;
 const rows=[['空き容積',ja(F)+' m³'],['− 武装の配電路',`${ja(V)} m³（${fPct(S?.feedShare||0)}）`],...(cells?[['　うち砲への配電路',ja(S?.feedBranchVolume||0)+' m³'],['　うちパワーセルの充電線',ja(S?.feedChargeVolume||0)+' m³']]:[]),['＝ 居住に使える容積',ja(H)+' m³'],['÷ 1名あたり',`${ja(K)} m³（居住 ${num(C.CREW_LIVING_M3)}＋共用部 ${ja(Math.max(0,K-C.CREW_LIVING_M3))}）`],['＝ 乗艦可能',num(S?.personCapacity||0)+' 名']];
 const src=cells?`パワーセル ${num(cells)} 基（出せる電力 ${fW(S?.feedCellCap||0)}）から ${fPct(S?.feedCellShare||0)} · 炉から直接 ${fPct(1-(S?.feedCellShare||0))}`:'パワーセルなし（全量を炉から直接）';
 return `<div class="pgroup blueprint-card" id="habitation-editor"><h4>空き容積と乗員</h4><dl class="engineering-stats">${rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl><p>定員（必要乗員）${num(S?.crew||0)} 名（うち武装 ${num(S?.weaponCrew||0)} 名）${(S?.autoCrew||0)>0?`· 全持ち場 ${num(S.crewBase)} 名のうち自動化装置が ${num(S.autoCrew)} 名分を受け持つ`:''} · 乗艦 ${num(S?.crewAboard??S?.crew??0)} 名${short?` <span class="neg">（${num((S?.crew||0)-(S?.crewAboard||0))} 名不足）</span>`:''} · 兵員枠 ${num(S?.troopCapacity||0)} 名</p><h4>武装の配電路</h4><p class="note">武装 1 基ごとに配電路が通り、その分だけ空き容積が減ります。配電路の太さは武装の消費電力に比例し（1 m² あたり ${fW(S?.feedFlux||C.FEED_FLUX)}）、砲塔を大きくすると 3 乗で太くなります。武装はいちばん近いパワーセルから給電されます（1 基のセルが出せる電力は蓄電量を ${C.CELL_DISCHARGE_S} 秒で出し切る分まで）。セルで足りない分は反応炉から直接引き、各炉が出力の割合で分担して近い武装から給電します。パワーセルは炉から充電線で充電されます。充電線に流れるのは炉が平均して賄える分（炉の出力 ÷ 武装の消費電力、最大 100%）だけなので、砲への配電路より細く済みます。砲の近くにパワーセルを置くと太い配電路が短くなりますが、セル自体も空き容積を使います。武装を増やす・大きくする・給電元から離すほど、乗れる人数が減ります。</p><p>武装 ${num(S?.feedCount||0)} 基 · 消費電力 ${fW(S?.feedDemand||0)} · 平均の長さ ${num(S?.feedLength||0)} m<br>${src}</p>${top.length?`<div class="feed-top">${top.map(r=>`<button class="engine-row" data-layout-fit="${r.f.id}"><span>${esc(C.FITS[r.f.k].name)} #${r.f.id}</span><b>${ja(r.v)} m³ · ${feedSrc(r.fd,true)} ${num(r.l)} m</b></button>`).join('')}</div><p class="note">配電路が大きい武装の上位 ${top.length} 基（体積 · 給電元と距離）。押すとその武装を選びます。</p>`:''}<p class="note">居住区・兵員室はありません。乗員も兵員も、船体・構造の内側から機関、格納庫、指揮室、充電装置、VLS 弾庫、竜骨、開口などの区画と配電路を除いた容積で暮らします（通路・倉庫・生活設備込み）。1名あたりの容積は、居住 ${num(C.CREW_LIVING_M3)} m³ に交通路線・通路などの共用部を足したものです。共用部は大きな艦ほど累進して増えます（ドレッドノート級 601 m で 1名 ${ja(C.personVolume(601))} m³、インペリアル級 1,600 m で ${ja(C.personVolume(1600))} m³、エグゼクター級 19 km で ${ja(C.personVolume(19000))} m³。公式の乗員・兵員 約2万・4万・32万人に合わせた値）。乗れる人数から定員を引いた残りが兵員枠で、地上部隊の歩兵はここに乗ります。停止保管ドロイドは 1 体 ${C.DROID_STORE_M3} m³ で同じ枠を使います。武装は 1 基ごとに砲員と同数の給電・整備要員も要ります。必要乗員は、指揮区画の自動化装置（20 m³ で 1 名分）に受け持たせて減らせます。ただし装置は電力を常に使い、戦闘で止まると操艦不能になる危険があります。</p><button class="btn" data-habitation-view>${st.showHabitation?'空き容積と配電路の表示を隠す':'空き容積と配電路を透視'}</button><p class="note">透視の緑の点は空き容積の近似範囲、橙色の管は砲への配電路、黄色の管はパワーセルの充電線です（配電路は艦内の空き容積を通る経路で表示）。</p></div>`;}
function compartmentWeaponsPanel(){
 const tab=st.tab;st.tab='arm';baseRenderPanel();referencePanel($('#panel'));st.tab=tab;
 $('#panel').insertAdjacentHTML('afterbegin',`<div class="pgroup">${seg('group',layoutGroups(),st.group)}</div>`);
 {const panel=$('#panel'),it=selItem();if(st.fitTool==='place'){const anchor=panel.querySelector('[data-group]')?.closest('.pgroup');if(anchor)anchor.insertAdjacentHTML('afterend',alignmentControls());}else if(it&&st.sel?.list==='fits')panel.insertAdjacentHTML('beforeend',alignmentControls(true));}
 $('#panel').insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>配置済みの武装</h4>${ship.fits.filter(f=>C.FITS[f.k].cat==='w').map(f=>`<button class="engine-row" data-layout-fit="${f.id}">${esc(C.FITS[f.k].name)} #${f.id}</button>`).join('')}</div>`);
 markTabs();updateHint();refreshOverlay();
}
function layoutPanel(panel){
 const p=selItem();
 if(((st.tab==='mod'&&st.group!=='weapons'||st.tab==='bridge'&&st.bridgeMode==='body')&&st.partTool==='place')||(st.tab==='bridge'&&st.bridgeMode==='windows'&&st.bridgeTool==='place')){const anchor=panel.querySelector('.command-sub')||panel.querySelector('[data-group]')?.closest('.pgroup');if(anchor)anchor.insertAdjacentHTML('afterend',alignmentControls());else panel.insertAdjacentHTML('afterbegin',alignmentControls());}
 if(p&&st.sel.list==='parts'&&['mod','bridge'].includes(st.tab))panel.insertAdjacentHTML('beforeend',alignmentControls(true)+replacementControls(p)+(p.k==='struct'?derivedRoomsHTML(p.id):''));
 if(p&&st.sel.list==='fits'&&C.FITS[p.k].window&&st.tab==='bridge')panel.insertAdjacentHTML('beforeend',alignmentControls(true)+commandControls(p));
 if(st.tab==='systems')panel.insertAdjacentHTML('afterbegin',habitationHTML()+derivedRoomsHTML());
 if(st.tab==='mod'&&st.group==='command')panel.insertAdjacentHTML('beforeend',derivedRoomsHTML()+`<button class="btn" data-habitation-menu>空き容積と乗員</button>`);
}
function inspectionHTML(w){const links=w.targets?.length?w.targets:[{tab:'systems'}],button=t=>{const obj=t.list&&ship[t.list]?.find(p=>p.id===t.id),name=obj?t.list==='parts'?C.partLabel(obj):t.list==='fits'?C.FITS[obj.k].name:'ハッチ':t.part?C.PARTS[t.part].name:(t.tab==='arm'?'武装':TAB_NAMES[t.tab])||'編集';return `<button class="btn sm ghost" data-inspect-target="${esc(JSON.stringify(t))}">${esc(name)}${obj?' #'+obj.id:''}を編集 →</button>`;};return `<li class="w-${w.lv}"><span>${esc(w.text)}</span><div class="inspection-links">${links.slice(0,3).map(button).join('')}</div>${links.length>3?`<details><summary>ほか ${links.length-3} 件の対象</summary><div class="inspection-links">${links.slice(3).map(button).join('')}</div></details>`:''}</li>`;}

function openLayoutTarget(t){
 if(fleet.mode!=='design')fleetSetMode('design');
 st.dockCollapsed=false;$('#dock').classList.remove('collapsed');st.sel=null;st.equipmentId=null;st.hatchA=null;
 const p=t.list&&ship[t.list]?.find(p=>p.id===t.id);
 if(p&&t.list==='parts'){st.tab='mod';st.group=C.PARTS[p.k].group;st.partTool='select';st.sel={list:'parts',id:p.id};st.view='xray';}
 else if(p&&t.list==='fits'){
  st.sel={list:'fits',id:p.id};if(C.FITS[p.k].window){st.tab='bridge';st.bridgeMode='windows';st.bridgeTool='adjust';st.bridge=p.k;st.view='xray';}
  else{st.tab='mod';st.group='weapons';st.fitTool='adjust';st.fit=p.k;st.view='normal';}
 }else if(p&&t.list==='hatches'){st.tab='launch';st.view='normal';}
 else if(t.part){st.tab='mod';st.group=C.PARTS[t.part].group;st.part=t.part;st.partTool='place';}
 else{st.tab=t.tab||'systems';if(st.tab==='bridge'){st.bridgeMode='windows';st.bridgeTool='place';st.bridge=t.window||'podBridge';}if(st.tab==='arm'){st.tab='mod';st.group='weapons';st.fitTool='adjust';}}
 syncHud();renderPanel();
 if(p&&view){const c=p.c||p.p||C.mul(C.add(p.a,p.b),.5);view.cam.target=C.add(c,view.off);view.cam.r=Math.max(180,p.c?C.partDims(p).r*6:250);}
 if(t.list==='hatches'&&p){const el=$(`#panel [data-door="${p.id}"]`);el?.closest('.bay-control')?.scrollIntoView?.({block:'center'});el?.focus?.();}
 else if(t.section)$('#'+t.section+'-editor')?.scrollIntoView?.({block:'start'});
 refreshOverlay();requestDraw();
}
// Deck and bottom widths are part of the armoured-wedge section. Other polygon
// sections switch to it with widths that keep their present outline.
function deckSection(rows){
  const hp=ship.hull;if(hp.sec==='warship'||hp.sec==='ellipse')return false;
  const [deck,keel,chine,belt]={rect:[.98,.98,.5,.13],trap:[.6,.98,.5,.02],roof:[.02,.98,.55,.02],diamond:[.02,.02,.5,.02]}[hp.sec]||[.98,.98,.5,.13];
  hp.sec='warship';hp.deckWidth=deck;hp.keelWidth=keel;hp.chineHeight=chine;hp.belt=belt;
  for(const row of rows){while(row.length<4)row.push(0);row[4]=deck;row[5]=keel;if(row.length>6)row[6]=belt;if(row.length>7)row[7]=chine;}
  return true;
}
function blockedHullControl(t){return false;const d=t.dataset||{},sl=d.sl;return ['hull','sec','assembly','station','loftHull','addstation','dropstation'].some(k=>k in d)||['L','W','H','bowW','bowH','stern','deckWidth','keelWidth','belt','chineHeight','hullStart'].includes(sl);}
function bindLayout(){
 const click=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.inspectTarget){try{openLayoutTarget(JSON.parse(d.inspectTarget));}catch(err){toast('編集対象が見つかりません');}return;}
  if(d.layoutPart){openLayoutTarget({list:'parts',id:+d.layoutPart});return;}
  if(d.layoutFit||d.commandView){openLayoutTarget({list:'fits',id:+(d.layoutFit||d.commandView)});return;}
  if(d.layoutTab){openLayoutTarget({tab:d.layoutTab});return;}
  if('layoutShape'in d){openLayoutTarget({part:'struct'});return;}
  if('habitationMenu'in d){openLayoutTarget({tab:'systems',section:'habitation'});return;}
  if('lockHull'in d){mutate('基本船体を確定',()=>ship.hullLocked=true,'none');renderPanel();return;}
  if(d.placementalign){st.alignment=d.placementalign;renderPanel();return;}
  if(d.alignselected&&st.sel?.list==='fits'){const f=selItem();if(f){mutate('中心線・中心面へ整列',()=>{const q=C.alignedPosition(ship,f.p,d.alignselected),n=f.n||C.AXES[f.a];for(let a=0;a<3;a++)if(Math.abs(n[a])>.7)q[a]=f.p[a];moveFitTo(f,q,n);const tw=f.tw!=null?ship.fits.find(g=>g.id===f.tw):null;if(tw&&Math.abs(f.p[2])<=C.FITS[f.k].r){C.removeItem(ship,'fits',tw.id,false);delete f.tw;}},'fits');}renderPanel();return;}
  if(d.alignselected){const p=selItem();if(p&&st.sel.list==='parts')mutate('中心線・中心面へ整列',()=>C.alignPart(ship,p,d.alignselected,st.mirror),'all');renderPanel();return;}
  if('habitationView'in d){st.showHabitation=!st.showHabitation;st.view='xray';touch('view');syncHud();renderPanel();requestDraw();}
 };
 $('#panel').addEventListener('click',click);$('#specSide').addEventListener('click',click);
 $('#panel').addEventListener('change',e=>{const t=e.target;
  if('replacement'in t.dataset){const p=selItem();if(p&&st.sel.list==='parts'){mutate('同形状の区画に交換',()=>C.replacePart(ship,p,t.value,st.mirror),'all');st.group=C.PARTS[p.k].group;}renderPanel();}
  if('commandEnabled'in t.dataset){mutate('指揮システムを切り替え',()=>editSel(f=>f.commandEnabled=t.checked),'fits');renderPanel();}
  if('bodycommand'in t.dataset){mutate('艦橋本体の指揮所を切り替え',()=>editSel(p=>{if(C.bridgeBodyRole(p)){if(t.checked)delete p.commandEnabled;else p.commandEnabled=false;}}),'parts');renderPanel();}
  if(['commandDepth','commandHeight'].includes(t.dataset.sl)){endDrag();renderPanel();}
  if(['fitX','fitZ','fitY','fitAlong'].includes(t.dataset.sl)){endDrag();const f=selItem();if(f?.float)toast(C.FITS[f.k].window?'艦橋ポッドが壁から外れています。位置を戻してください':'この位置には据え付けられません');renderPanel();}
 });
 $('#panel').addEventListener('input',e=>{const t=e.target;if(t.value===''||!Number.isFinite(+t.value))return;const k=t.dataset.sl;
  if(['commandDepth','commandHeight'].includes(k)){beginDrag('指揮区画の寸法');editSel(f=>f[k]=C.clamp(+t.value,2,k==='commandDepth'?200:80));touch('fits');scheduleStats(150);const out=$('#out-'+k);if(out)out.textContent=fmtM(+t.value);}
 });
}

// A cutter is a draft until Apply. Moving it never damages the current design.
st.solidCutter=null;st.solidCutEdit=null;st.cutterVisible=true;st.cutterAction='place';st.cutterPlane='screen';st.cutterStep=5;
let cutterOwner=null,cutterOverlayKey='',cutterDrag=null;
const CUTTER_NAMES={box:'直方体',wedge:'楔形',cylinder:'円柱',ellipsoid:'球・楕円体'};

function resetSolidCutter(){
  cutterOwner=ship;st.solidCutter=null;st.solidCutEdit=null;st.cutterVisible=true;st.cutterAction='place';cutterDrag=null;cutterOverlayKey='';
}
function ensureSolidCutter(){
  if(cutterOwner!==ship)resetSolidCutter();
  if(!st.solidCutter&&ship){
    const h=ship.hull,x=h.L*.55,b=C.sectionBase(h,x),z=b.hw*.65;
    const y=C.originalSurface(ship,x,1,z,1)??b.ytop;
    st.solidCutter=C.normalizeSolidCut({id:-1,shape:'box',c:[x,y,z],s:[Math.max(12,h.L*.12),Math.max(8,h.W*.15),Math.max(8,h.H*.45)],rotation:[0,0,0],mirror:st.mirror,structures:!!h.assembly});
  }
  return st.solidCutter;
}
function reconcileSolidCutter(){
  cutterOwner=ship;cutterDrag=null;cutterOverlayKey='';
  const q=ship.solidCuts?.find(q=>q.id===st.solidCutEdit);
  if(q)st.solidCutter=C.normalizeSolidCut(q);
  else{st.solidCutEdit=null;if(st.solidCutter)st.solidCutter=C.normalizeSolidCut({...st.solidCutter,id:-1});}
}
function cutterActive(){return !!ship&&st.tab==='carve'&&st.carveTool==='solid'&&fleet.mode==='design';}
function cutterNumber(v){return Math.round(v*100)/100;}
function cutterInputs(field,labels,unit){
  const q=ensureSolidCutter(),max=field==='s'?C.DESIGN_LIMITS.partSize:field==='rotation'?180:C.DESIGN_LIMITS.coordinate;
  const min=field==='s'?2:-max;
  return `<div class="cutter-coords">${labels.map((label,i)=>`<label>${label}<span><input type="number" inputmode="decimal" data-cutter-field="${field}" data-axis="${i}" min="${min}" max="${max}" step="${field==='rotation'?1:.1}" value="${cutterNumber(q[field][i])}" aria-label="カッターの${label}"><i>${unit}</i></span></label>`).join('')}</div>`;
}
function solidCutPanelHTML(){
  const q=ensureSolidCutter(),editing=st.solidCutEdit!=null;
  return `<div class="pgroup cutter-editor">
    <div class="cutter-heading"><h3>${editing?'切削 #'+st.solidCutEdit+' を調整':'立体を重ねて切り取る'}</h3>${editing?'<button class="btn sm ghost" data-cutter-new>新規</button>':''}</div>
    <p class="note">半透明の立体を船体に重ね、重なった部分を切り取ります。位置と大きさを決めてから実行できます。</p>
    <div class="cutter-shapes">${Object.entries(CUTTER_NAMES).map(([k,name])=>`<button type="button" class="btn" data-cutter-shape="${k}" aria-pressed="${q.shape===k}">${name}</button>`).join('')}</div>
    <h4>1 · 大きさを決める</h4>
    ${cutterInputs('s',['長さ','幅','高さ'],'m')}
    <div class="cutter-scale"><button class="btn sm" data-cutter-scale="0.8">ひと回り小さく</button><button class="btn sm" data-cutter-scale="1.25">ひと回り大きく</button></div>
    <h4>2 · 船体に重ねる</h4>
    <div class="seg cutter-actions">${[['place','面をタップ'],['move','ドラッグ移動'],['camera','視点を回す']].map(([k,l])=>`<button type="button" data-cutter-action="${k}" aria-pressed="${st.cutterAction===k}">${l}</button>`).join('')}</div>
    <p class="note" id="cutter-action-help">${st.cutterAction==='move'?'ドラッグでカッターを移動します。2本指で拡大・縮小できます。':st.cutterAction==='camera'?'ドラッグで視点を回して、船底側や側面の重なりも確認できます。':'船体・構造物をタップすると、その位置にカッターの中心を置きます。'}</p>
    ${cutterInputs('c',['前後 X','上下 Y','左右 Z'],'m')}
    <details class="cutter-fine"><summary>移動方向・細かな調整</summary>
      <label class="field-label">ドラッグする面<select data-cutter-plane><option value="screen" ${st.cutterPlane==='screen'?'selected':''}>画面に平行</option><option value="xz" ${st.cutterPlane==='xz'?'selected':''}>前後・左右（XZ）</option><option value="xy" ${st.cutterPlane==='xy'?'selected':''}>前後・上下（XY）</option><option value="yz" ${st.cutterPlane==='yz'?'selected':''}>上下・左右（YZ）</option></select></label>
      <label class="field-label">ボタンで動かす距離（m）<input type="number" inputmode="decimal" data-cutter-step min=".1" max="1000" step=".1" value="${st.cutterStep}"></label>
      <div class="cutter-nudge">${[['艦尾へ',0,-1],['艦首へ',0,1],['下へ',1,-1],['上へ',1,1],['左舷へ',2,-1],['右舷へ',2,1]].map(([l,a,v])=>`<button class="btn sm" data-cutter-nudge="${a}" data-direction="${v}">${l}</button>`).join('')}</div>
      <div class="row2"><button class="btn sm" data-cutter-center>左右中央へ</button><button class="btn sm" data-cutter-through>上下に貫通</button></div>
    </details>
    <details class="cutter-rotation"><summary>角度を変える</summary>${cutterInputs('rotation',['X軸回転','Y軸回転','Z軸回転'],'°')}<div class="cutter-nudge">${[0,1,2].map(a=>`<button class="btn sm" data-cutter-turn="${a}">${['X','Y','Z'][a]} +90°</button>`).join('')}</div><button class="btn sm ghost" data-cutter-zero>回転を戻す</button></details>
    <div class="cutter-options"><label class="check"><input type="checkbox" data-cutter-visible ${st.cutterVisible!==false?'checked':''}> カッターを表示</label><label class="check"><input type="checkbox" data-cutter-mirror ${q.mirror?'checked':''}> 左右対称に切る</label><label class="check"><input type="checkbox" data-cutter-structures ${q.structures?'checked':''}> 上部構造・船殻パーツも切る</label></div>
    <p class="note">${editing?'変更は実行するまで確定しません。':q.shape==='cylinder'?'円柱の軸は初期状態で上下方向です。':q.shape==='ellipsoid'?'長さ・幅・高さを同じ値にすると球になります。':'表示中の立体の内側が切り取られる範囲です。'}</p>
    <div class="cutter-apply"><button type="button" class="btn primary" data-cutter-apply>${editing?'この形で切削を更新':'重なりを切り取る'}</button>${editing?'<button class="btn ghost" data-cutter-cancel>調整をやめる</button>':''}</div>
  </div><div class="pgroup"><div class="cutter-heading"><h4>立体で切った箇所</h4><button class="btn sm ghost" data-cutter-new>新しいカッター</button></div>
  <ul class="ilist cutter-history">${(ship.solidCuts||[]).map(c=>`<li class="${st.solidCutEdit===c.id?'selected':''}"><span><b>${esc(CUTTER_NAMES[c.shape]||'立体')} #${c.id}${c.mirror?' · 左右対称':''}</b>${c.s.map(cutterNumber).join(' × ')} m</span><div class="cutter-list-actions"><button class="btn sm" data-cutter-select="${c.id}">選んで調整</button><button class="btn sm ghost" data-cutter-delete="${c.id}">取り消す</button></div></li>`).join('')||'<li><span>切り取った箇所をここから調整・取り消しできます。</span></li>'}</ul>
  <p class="note">元に戻す・やり直す操作にも対応します。</p></div>`;
}
function syncCutterFields(){
  const q=ensureSolidCutter();if(!q)return;
  for(const input of $$('#panel [data-cutter-field]')){const f=input.dataset.cutterField,a=+input.dataset.axis;if(q[f])input.value=cutterNumber(q[f][a]);}
}
function refreshSolidCutterOverlay(){
  if(!view)return;
  const q=cutterActive()&&st.cutterVisible!==false?ensureSolidCutter():null,key=q?JSON.stringify(q):'off';
  if(key===cutterOverlayKey)return;
  cutterOverlayKey=key;
  const g=Gfx.meshSolidCutter(q);
  view.upload('cutter',g.mesh);view.setLines('cutter',g.lines);requestDraw();
}
function updateCutterDraft(rerender=false){
  st.cutterVisible=true;st.solidCutter=C.normalizeSolidCut(st.solidCutter);cutterOverlayKey='';
  if(rerender)renderPanel();else{syncCutterFields();refreshSolidCutterOverlay();updateHint();requestDraw();}
}
function placeSolidCutter(hit){
  if(!hit?.p)return;const q=ensureSolidCutter();q.c=hit.p.slice();
  if(hit.part?.k==='struct')q.structures=true;
  updateCutterDraft(true);
}
function selectSolidCut(id){
  const q=ship.solidCuts?.find(q=>q.id===id);if(!q)return;
  cutterOwner=ship;st.cutterVisible=true;st.solidCutEdit=q.id;st.solidCutter=C.normalizeSolidCut(q);st.cutterAction='move';st.carveTool='solid';st.tab='carve';cutterOverlayKey='';renderPanel();
}
function applySolidCutter(){
  const draft=ensureSolidCutter(),editing=st.solidCutEdit!=null;
  if(!draft)return false;
  if(!editing&&(ship.solidCuts?.length||0)>=32){toast('立体切削は32箇所までです。一覧から既存の切削を調整してください');return false;}
  if(!editing&&C.solidCutIntersectsShip&&!C.solidCutIntersectsShip(ship,draft)){toast('船体との重なりがありません。位置や大きさを調整してください');return false;}
  let applied;
  const changed=mutate(editing?'立体切削を調整':'立体の重なりを切削',()=>{
    ship.solidCuts||=[];
    const i=editing?ship.solidCuts.findIndex(q=>q.id===st.solidCutEdit):-1;
    if(editing&&i<0)return '調整する切削が見つかりません';
    applied=C.normalizeSolidCut({...draft,id:editing?st.solidCutEdit:ship.nextId++});
    if(i>=0)ship.solidCuts[i]=applied;else ship.solidCuts.push(applied);
    if(ship.hullSkin?.enabled)ship.hullSkin.enabled=false;
  },'hull');
  if(changed&&applied){st.solidCutEdit=applied.id;st.solidCutter=C.normalizeSolidCut(applied);st.cutterAction='camera';st.cutterVisible=false;cutterOverlayKey='';}
  renderPanel();return !!changed;
}
function cutterPlanePoint(px,py,point,normal){
  const r=view?.ray(px,py);if(!r)return null;const den=C.dot(r.d,normal);if(Math.abs(den)<1e-6)return null;
  const t=C.dot(C.sub(point,r.o),normal)/den;if(!Number.isFinite(t)||t<0)return null;return C.add(r.o,C.mul(r.d,t));
}
function cutterDragStart(px,py){
  if(!cutterActive()||st.cutterAction!=='move'||!view)return false;
  const q=ensureSolidCutter(),m=view.matrices();
  const normal=st.cutterPlane==='xz'?[0,1,0]:st.cutterPlane==='xy'?[0,0,1]:st.cutterPlane==='yz'?[1,0,0]:C.norm([m.V[2],m.V[6],m.V[10]]);
  const anchor=cutterPlanePoint(px,py,q.c,normal);
  if(!anchor){toast('移動面を正面から見られる視点に変えてください');return false;}
  st.cutterVisible=true;cutterOverlayKey='';cutterDrag={c:q.c.slice(),normal,anchor};refreshSolidCutterOverlay();return true;
}
function cutterDragMove(px,py){
  if(!cutterDrag)return;
  const p=cutterPlanePoint(px,py,cutterDrag.c,cutterDrag.normal);if(!p)return;
  st.solidCutter.c=C.add(cutterDrag.c,C.sub(p,cutterDrag.anchor)).map(v=>C.clamp(v,-C.DESIGN_LIMITS.coordinate,C.DESIGN_LIMITS.coordinate));
  syncCutterFields();refreshSolidCutterOverlay();requestDraw();
}
function cutterDragEnd(cancel=false){
  if(!cutterDrag)return;if(cancel)st.solidCutter.c=cutterDrag.c.slice();cutterDrag=null;updateCutterDraft(false);
}
function bindSolidCuts(){
  $('#panel').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.cutterShape){ensureSolidCutter().shape=d.cutterShape;updateCutterDraft(true);}
    if(d.cutterAction){st.cutterAction=d.cutterAction;renderPanel();}
    if('cutterNew'in d){resetSolidCutter();st.carveTool='solid';renderPanel();}
    if('cutterCancel'in d){const c=ship.solidCuts?.find(c=>c.id===st.solidCutEdit);if(c)st.solidCutter=C.normalizeSolidCut(c);st.solidCutEdit=null;st.cutterAction='camera';updateCutterDraft(true);}
    if('cutterApply'in d)applySolidCutter();
    if(d.cutterSelect)selectSolidCut(+d.cutterSelect);
    if(d.cutterDelete){const id=+d.cutterDelete;mutate('立体切削を取り消す',()=>ship.solidCuts=(ship.solidCuts||[]).filter(c=>c.id!==id),'hull');if(st.solidCutEdit===id){st.solidCutEdit=null;st.cutterAction='place';}cutterOverlayKey='';renderPanel();}
    if(d.cutterScale){const q=ensureSolidCutter();q.s=q.s.map(v=>v*Number(d.cutterScale));updateCutterDraft(false);}
    if('cutterNudge'in d){const q=ensureSolidCutter(),a=+d.cutterNudge;q.c[a]+=st.cutterStep*(+d.direction);updateCutterDraft(false);}
    if('cutterTurn'in d){const q=ensureSolidCutter(),a=+d.cutterTurn;q.rotation[a]=((q.rotation[a]+270)%360)-180;updateCutterDraft(false);}
    if('cutterZero'in d){ensureSolidCutter().rotation=[0,0,0];updateCutterDraft(false);}
    if('cutterCenter'in d){ensureSolidCutter().c[2]=0;updateCutterDraft(false);}
    if('cutterThrough'in d){const q=ensureSolidCutter(),b=Gfx.shipBounds(ship);q.rotation=[0,0,0];q.c[1]=(b[1]+b[4])/2;q.s[2]=Math.max(2,b[4]-b[1]+Math.max(4,ship.hull.H*.1));updateCutterDraft(false);}
  });
  const onField=e=>{
    const t=e.target,f=t.dataset.cutterField,a=+t.dataset.axis;
    if(!['c','s','rotation'].includes(f)||![0,1,2].includes(a)||t.value===''||!Number.isFinite(+t.value))return;
    ensureSolidCutter()[f][a]=+t.value;updateCutterDraft(false);
  };
  $('#panel').addEventListener('input',onField);
  $('#panel').addEventListener('change',e=>{
    const t=e.target,d=t.dataset;onField(e);
    if('cutterVisible'in d){st.cutterVisible=t.checked;cutterOverlayKey='';refreshSolidCutterOverlay();}
    if('cutterMirror'in d){ensureSolidCutter().mirror=t.checked;updateCutterDraft(true);}
    if('cutterStructures'in d){ensureSolidCutter().structures=t.checked;updateCutterDraft(true);}
    if('cutterPlane'in d&&['screen','xz','xy','yz'].includes(t.value))st.cutterPlane=t.value;
    if('cutterStep'in d&&t.value!==''&&Number.isFinite(+t.value))st.cutterStep=C.clamp(+t.value,.1,1000);
  });
}

// Rendering owns no design data. Rebuilding GPU resources must never reset,
// resave, or replace a ship; selection, camera, undo history and drafts survive.
const renderHealth={mode:'starting',lost:false,error:null,frames:0,lastFrame:0,failures:0,recoveries:0,automaticRetries:0};
let renderRetryTimer=0;
function renderingMessage(message,error=false){
 const el=$('#renderStatus');if(el){el.textContent=message;el.hidden=!message;el.classList.toggle('render-error',error);}
 document.body.classList.toggle('render-trouble',!!message||renderHealth.mode==='compat');
}
function invalidateRendering(){
 uploadStored();dirty.draw=true;
}
function bindCanvasRendering(canvas){
 canvas.addEventListener?.('webglcontextlost',e=>{if(canvas!==$('#cv'))return;e.preventDefault();renderHealth.lost=true;renderingMessage('3D表示が中断しました。設計は保持されています。復旧待ち…',true);requestDraw();clearTimeout(renderRetryTimer);renderRetryTimer=setTimeout(()=>{renderRetryTimer=0;if(renderHealth.lost)restoreRenderer(true,false);},1000);});
 canvas.addEventListener?.('webglcontextrestored',()=>{if(canvas!==$('#cv'))return;restoreRenderer(false,false);});
}
function restoreRenderer(useCompat=false,fit=false){
 clearTimeout(renderRetryTimer);renderRetryTimer=0;
 const old=view,cam=old?.cam?JSON.parse(JSON.stringify(old.cam)):null,off=old?.off?.slice();
 let canvas=$('#cv');
 try{
  old?.dispose?.();
  // A canvas cannot switch between WebGL and 2D after a context is allocated.
  // Use a fresh element rather than retaining stale GPU buffers or controls.
  if(old||canvas.dataset?.contextAttempted){const next=canvas.cloneNode(false);next.width=300;next.height=150;canvas.replaceWith(next);canvas=next;}
  if(canvas.dataset)canvas.dataset.contextAttempted='1';
  try{view=useCompat?new Gfx.CompatRenderer(canvas):new Gfx.Renderer(canvas);}
  catch(e){
   if(useCompat)throw e;
   const next=canvas.cloneNode(false);next.width=300;next.height=150;canvas.replaceWith(next);canvas=next;
   view=new Gfx.CompatRenderer(canvas);renderHealth.error=String(e.message||e);
  }
  renderHealth.mode=view.kind==='compat'?'compat':'webgl';renderHealth.lost=false;renderHealth.failures=0;
  if(cam)view.cam=cam;if(off)view.off=off;
  bindCanvasRendering(canvas);attachControls(canvas);view.onTextureReady=requestDraw;
  if(fleet?.assets)for(const [key,a] of fleet.assets)if((fleet.mode==='review'||trial.battle)&&a.geometry)view.loadFleet(key,a.geometry);
  if(trial.on&&trial.asset?.geometry)view.loadFleet(trial.asset.key,trial.asset.geometry);
  if(ship){invalidateRendering();refreshOverlay();if(fit||!cam)fitCamera();}
  const fail=$('#glfail');if(fail)fail.hidden=true;
  renderingMessage(renderHealth.mode==='compat'?'互換3D表示 · テクスチャ省略／形状と選択は同じ':'');
  renderHealth.recoveries++;return true;
 }catch(e){
  view=null;renderHealth.mode='failed';renderHealth.error=String(e.message||e);renderingMessage('表示を復旧できませんでした。「表示を復旧」を押してください。設計は保持しています。',true);
  console.error(e);return false;
 }
}
function renderingFailed(e){
 renderHealth.error=String(e?.message||e);renderHealth.failures++;dirty.draw=true;
 if(renderHealth.failures===1)console.error(e);
 renderingMessage('描画エラー：'+renderHealth.error+'（設計データは保持）',true);
 if(renderHealth.automaticRetries<2&&!renderRetryTimer){renderHealth.automaticRetries++;renderRetryTimer=setTimeout(()=>{renderRetryTimer=0;restoreRenderer(true,false);},400);}else if(renderHealth.automaticRetries>=2){renderHealth.lost=true;renderingMessage('描画を停止しました：'+renderHealth.error+'。設計は保持されています。「表示を復旧」で再試行できます。',true);}
}
function bindRendering(){
 $('#btnRestoreView')?.addEventListener('click',()=>{renderHealth.automaticRetries=0;restoreRenderer(false,true);});
 $('#sheet')?.addEventListener('click',e=>{const b=e.target.closest('[data-viewfix]');if(!b)return;closeSheet();renderHealth.automaticRetries=0;if(b.dataset.viewfix==='compat')restoreRenderer(true,false);else restoreRenderer(false,true);});
 $('#btnCompatView')?.addEventListener('click',()=>{renderHealth.automaticRetries=0;restoreRenderer(true,false);});
 const wake=()=>{if(document.hidden)return;requestDraw();};
 document.addEventListener?.('visibilitychange',wake);window.addEventListener?.('pageshow',wake);window.addEventListener?.('focus',wake);
 window.addEventListener?.('resize',wake);window.visualViewport?.addEventListener('resize',wake);
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(wake);observer.observe($('#viewport'));}
}

// ---------- tutorial: a very simple Imperial-class star destroyer ----------
// Each step opens the right menu and waits for the player's own tap; 「おまかせ」
// taps along a world ray through the very same placement code.
const tut={on:false,i:0,min:false,timer:0};
const TUT_HULL={L:1600,W:1000,H:230};
const tutDeck=(x,z)=>[[x,6000,z],[0,-1,0]],tutStern=(y,z)=>[[-6000,y,z],[1,0,0]],tutBelly=(x,z)=>[[x,-6000,z],[0,1,0]];
const tutCount=f=>ship?ship.parts.filter(f).length:0;
const tutBridge=()=>ship?.parts.find(p=>p.skinAsset==='isd_bridge');
function tutCam(name){
 if(!view||!ship?._geoProxy)return;fitCamera(true);const c=CAMS[name];view.cam.ortho=name!=='iso';view.cam.th=c[0];view.cam.ph=c[1];view.cam.target=[0,0,0];
 // Keep the ship clear of the tutorial card on wide screens.
 const vp=$('#viewport'),w=vp?.clientWidth||0,h=vp?.clientHeight||1;
 if(w>700&&!tut.min){view.cam.r*=1.12;const V=view.matrices().V,k=view.cam.r*Math.tan(view.cam.fov/2)*(w/h)*.3;view.cam.target=[0,1,2].map(a=>-V[a*4]*k);}
 requestDraw();
}
const tutClosedHangar=()=>ship?.parts.find(p=>p.k==='hangar'&&!ship.hatches.some(h=>h.bay===p.id));
function tutOpenHangar(){
 const p=tutClosedHangar();if(!p)return false;let ok=false;
 mutate('格納庫の発着口を開ける',()=>{const b=C.sectionBase(ship.hull,C.clamp(p.c[0],0,ship.hull.L)),h=p.room?.[2]||40;if(p.c[1]-h/2-b.ybot<8)p.c[1]=b.ybot+h/2;if(C.aviationSurfaceContacts(ship,p).find(c=>c.face==='bottom')?.contact){C.setAviationSurfaceMode(ship,p,'bottom','ray');ok=true;}},'all');
 if(!ok)toast('格納庫が船底に接していません。「航空隊」タブで発着口の面を選べます');renderPanel();return ok;
}
function tutTap(o,d){const t=tool(),hit=pickRay(o,d,tapWant(t));if(!hit){toast('置く面が見つかりませんでした');return false;}tapHit(t,hit);return true;}
// One step can ask for several compartments; it selects the first one still missing.
function tutPartStep(o){
 const has=it=>tutCount(p=>p.k===it.k)>=(it.n||1),next=()=>o.items.find(it=>!has(it))||o.items[o.items.length-1];
 const pick=it=>{st.tab='mod';st.group=o.group;st.part=it.k;st.equipmentId=null;st.partTool='place';st.sel=null;st.placeBy[it.k]=it.placeBy||'inside';if(it.size)st.size[it.k]=it.size;if(it.room)st.roomSize=it.room.slice();st.mirror=it.mirror!==false;st.vmirror=false;};
 return {title:o.title,text:o.text,extra:o.extra,focus:[`[data-group="${o.group}"]`,()=>`[data-part="${next().k}"]`],phase:()=>next().k,
  select(){pick(next());syncHud();},setup(){pick(next());st.view=o.view||'xray';syncHud();tutCam(o.cam||'iso');},
  done:()=>o.items.every(has),
  auto(){for(const it of o.items)if(!has(it)){pick(it);tutTap(...it.at());}pick(next());syncHud();o.after?.();}};
}
const TUT_STEPS=[
 {title:'船体を用意する',text:'全長 1,600 m・全幅 1,000 m のくさび形船体（艦種：デストロイヤー）を用意しました。インペリアル級の要点は<b>平たい三角形の船体</b>・<b>艦尾寄りの艦橋</b>・<b>艦尾の大型エンジン</b>の3つです。寸法は「船体」タブでいつでも変えられます。',
  focus:['#tabs [data-tab="hull"]'],setup(){st.tab='hull';st.view='normal';tutCam('iso');},done:()=>true},
 {title:'艦橋本体を置く',text:'「区画および艤装 → 艦橋 → 艦橋本体」で<b>インペリアル級 艦橋本体</b>を選んであります。甲板の<b>艦尾寄り（後ろから約1/5）の中心線</b>をタップしてください。前面の円筒ポッドが指揮所なので、置くだけで艦橋として働きます。',
  focus:['#tabs [data-tab="mod"]','[data-group="bridge"]','[data-equipment="isdBridge"]'],
  setup(){st.tab='bridge';st.bridgeMode='body';st.bridgeEquipment='isdBridge';st.equipmentId=null;st.partTool='place';st.sel=null;st.view='normal';tutCam('iso');},
  done:()=>!!tutBridge(),auto:()=>tutTap(...tutDeck(TUT_HULL.L*.2,0))},
 tutPartStep({title:'主反応炉を積む',group:'power',text:'<b>主反応炉</b>（球）が艦のすべての電力をまかないます。艦橋の少し前、<b>甲板の中心線</b>をタップすると、面の内側に収まるよう置かれます。透視表示で船内が見えます。',
  items:[{k:'gen',size:130,mirror:false,at:()=>tutDeck(TUT_HULL.L*.3,0)}]}),
 tutPartStep({title:'反応物の貯蔵と供給',group:'power',text:'炉を動かし続けるには<b>反応物サイロ</b>（燃料）と<b>反応物供給設備</b>が要ります。炉の前の<b>甲板の中心線</b>にサイロ、炉の<b>横</b>に供給設備を順にタップしてください。1つ置くと次の区画に切り替わります。',
  items:[{k:'fuel',size:60,mirror:false,at:()=>tutDeck(TUT_HULL.L*.39,0)},{k:'pump',room:[60,40,24],mirror:false,at:()=>tutDeck(TUT_HULL.L*.3,110)}]}),
 {title:'艦尾にエンジンを付ける',text:'<b>タービン内蔵型エンジン</b>を選び、艦尾から見る視点にしました。<b>艦尾の面</b>をタップします。「左右対称」がオンなので、中心から離れた所をタップすると左右一対になります。中央にもう1基置けばインペリアル級らしい3基です。炉とノズルの間の機関は自動でつながります。',
  focus:['[data-equipment="internalTurbine"]','#chipMirror'],
  setup(){chooseEquipment('internalTurbine');st.mirror=true;st.vmirror=false;st.engineDir=[-1,0,0];st.view='normal';syncHud();tutCam('back');},
  done:()=>tutCount(p=>p.k==='engine')>=2,auto:()=>{tutTap(...tutStern(TUT_HULL.H*.5,150));tutTap(...tutStern(TUT_HULL.H*.5,0));}},
 tutPartStep({title:'ハイパードライブを積む',group:'power',text:'<b>ハイパードライブ</b>がないと超空間へ跳べません。反応物サイロより前の<b>甲板の中心線</b>をタップして船内に収めます。',
  items:[{k:'hyper',size:60,mirror:false,at:()=>tutDeck(TUT_HULL.L*.48,0)}]}),
 tutPartStep({title:'慣性制御と構造維持',group:'support',text:'<b>慣性制御装置</b>がないと乗員が加速に耐えられず、艦は動けません。<b>構造維持装置</b>は推力に船体が耐えられるよう補強します。<b>甲板の中心から少し外</b>を順にタップすると左右一対で置かれます。',
  items:[{k:'inertial',size:60,at:()=>tutDeck(TUT_HULL.L*.56,90)},{k:'integrity',room:[110,50,30],at:()=>tutDeck(TUT_HULL.L*.33,150)}]}),
 tutPartStep({title:'シールド発生器を据える',group:'support',view:'normal',text:'<b>広域シールド発生器</b>を「一部露出」で選んであります。<b>艦橋本体の上</b>を中心から少しずらしてタップすると、左右一対の球形ドームが据わります。インペリアル級の艦橋の上にある、あの2つの球です。',
  items:[{k:'shield',size:34,placeBy:'partial',at:()=>{const b=tutBridge();return tutDeck(b?b.c[0]-b.s[0]*.25:TUT_HULL.L*.2,b?b.s[1]*.28:80);}}]}),
 {title:'主砲を並べる',text:'「区画および艤装 → 武装」で<b>6連装重ターボレーザー</b>を選んであります。<b>甲板の左右の縁</b>を艦尾から艦首へ2〜3か所タップしてください。左右対称なので1回で両舷に付きます。',
  focus:['[data-group="weapons"]','[data-fit="refISD"]'],
  setup(){st.tab='mod';st.group='weapons';st.fit='refISD';st.fitTool='place';st.weaponMount='auto';st.mirror=true;st.sel=null;st.view='normal';syncHud();tutCam('iso');},
  done:()=>ship&&ship.fits.filter(f=>C.FITS[f.k].cat==='w').length>=4,auto:()=>{for(const [x,z] of [[.22,300],[.36,230],[.5,160]])tutTap(...tutDeck(TUT_HULL.L*x,z));}},
 tutPartStep({title:'格納庫を設ける',group:'air',cam:'bottom',text:'<b>航空区画</b>（格納庫）を選び、下から見る視点にしました。<b>船底の中央</b>をタップすると船内に収まります。続けて「腹面に発着口を開ける」を押すと、格納庫を船底まで下げてシールド式の発着口を開けます。航空隊の編成は「航空隊」タブで決めます。',
  items:[{k:'hangar',room:[240,120,40],mirror:false,at:()=>tutBelly(TUT_HULL.L*.42,0)}],extra:{label:'腹面に発着口を開ける',show:()=>!!tutClosedHangar(),run:()=>tutOpenHangar()},after:()=>tutOpenHangar()}),
 {title:'性能を確かめて完成',text:'ごく簡素なインペリアル級の完成です。「性能」タブと右の性能諸元で出力・加速・火力を確かめ、注意点は「系統」タブで点検します。「公試に出る」でコルサント上空を操艦し、標的ブイへの射撃で砲塔の射界も確かめられます。艦名を付けて「設計図」から保存しましょう。次は装甲・トレンチ・航空隊や地上部隊の編成に挑戦できます。',
  focus:['#tabs [data-tab="spec"]','#btnMenu'],setup(){st.tab='spec';st.view='normal';st.sel=null;tutCam('iso');},done:()=>true,summary:true}
];
function tutStart(){
 const s=C.newShip(Object.assign({},C.HULLS.wedge,TUT_HULL),'練習用インペリアル級');s.hullLocked=false;s.shipClass='destroyer';
 const had=!!ship;st.mirror=true;st.vmirror=false;st.sel=null;st.tab='hull';
 closeSheet();setShip(s);hideTitle();tut.on=true;tut.i=0;tut.min=false;document.body.classList.add('tut-on');
 if(had)toast('前の設計は「元に戻す」で戻せます');
 tutGo(0,true);
}
function tutStop(){tut.on=false;clearInterval(tut.timer);tut.timer=0;document.body.classList.remove('tut-on');$$('.tut-focus').forEach(e=>e.classList.remove('tut-focus'));const box=$('#tut');if(box)box.hidden=true;}
function tutGo(i,first){
 tut.i=C.clamp(i,0,TUT_STEPS.length-1);const s=TUT_STEPS[tut.i];tut.phase=s.phase?.()??null;tut.full=false;
 const run=()=>{try{s.setup?.();}catch(e){console.error(e);}syncHud();renderPanel();requestDraw();tutRender();};
 if(first&&!ship?._geoProxy){tutRender();const wait=setInterval(()=>{if(!tut.on){clearInterval(wait);return;}if(ship?._geoProxy){clearInterval(wait);run();}},300);}else run();
 clearInterval(tut.timer);tut.timer=setInterval(tutTick,600);
}
function tutSummary(){
 if(!S)return '<p class="tut-wait">性能を計算中…</p>';
 const warn=(S.warnings||[]).filter(w=>w.lv!=='info').length;
 return `<dl class="tut-sum"><div><dt>艦橋</dt><dd>${S.bridges} 基</dd></div><div><dt>最大加速</dt><dd>${fG(S.accelG)}</dd></div><div><dt>一斉射</dt><dd>${fTT(S.alphaTot)}</dd></div><div><dt>超空間</dt><dd>${S.hyperClass?'クラス '+S.hyperClass.toFixed(1):'なし'}</dd></div></dl><p class="tut-note">${warn?`注意点が ${warn} 件あります。「系統」タブで確認できます。`:'大きな問題はありません。'}</p>`;
}
function tutRender(){
 let box=$('#tut');
 if(!box){box=document.createElement('section');box.id='tut';box.className='tut';box.setAttribute('aria-label','チュートリアル');$('#viewport').appendChild(box);}
 if(!tut.on){box.hidden=true;return;}
 const s=TUT_STEPS[tut.i],done=!!s.done(),ready=!!ship?._geoProxy,last=tut.i===TUT_STEPS.length-1;
 box.hidden=false;box.classList.toggle('min',tut.min);box.classList.toggle('done',done&&!!s.auto);
 if(tut.min){box.innerHTML=`<button type="button" class="tut-pill" data-tut="max">チュートリアル ${tut.i+1}/${TUT_STEPS.length}・${esc(s.title)}${done&&s.auto?' ✓':''}</button>`;return;}
 box.innerHTML=`<div class="tut-head"><span class="tut-kicker">チュートリアル · 簡素なISDを作る</span><span class="tut-no">${tut.i+1}/${TUT_STEPS.length}</span><button type="button" class="tut-ic" data-tut="min" aria-label="小さくする">－</button><button type="button" class="tut-ic" data-tut="close" aria-label="チュートリアルを終える">×</button></div>
 <ol class="tut-dots" aria-hidden="true">${TUT_STEPS.map((q,j)=>`<li class="${j<tut.i?'past':j===tut.i?'now':''}"></li>`).join('')}</ol>
 <h3>${esc(s.title)}</h3><p class="tut-text${tut.full?' full':''}" data-tut="text" title="タップで全文を表示">${s.text}</p>${s.summary?tutSummary():''}
 ${s.auto?`<p class="tut-state ${done?'ok':''}">${done?'✓ できました。「次へ」で進みます。':ready?'画面をタップして置いてください。':'船体を準備中…'}</p>`:''}
 <div class="tut-actions"><button type="button" class="btn sm ghost" data-tut="prev" ${tut.i===0?'disabled':''}>戻る</button>${s.extra&&s.extra.show()?`<button type="button" class="btn sm" data-tut="extra">${esc(s.extra.label)}</button>`:''}${s.auto?`<button type="button" class="btn sm" data-tut="auto" ${ready?'':'disabled'}>おまかせで実行</button>`:''}<button type="button" class="btn sm primary" data-tut="${last?'close':'next'}">${last?'チュートリアルを終える':'次へ'}</button></div>`;
 tutDecorate();
}
function tutDecorate(){
 $$('.tut-focus').forEach(e=>e.classList.remove('tut-focus'));if(!tut.on||tut.min)return;
 for(const f of TUT_STEPS[tut.i].focus||[]){const sel=typeof f==='function'?f():f;for(const e of $$(sel))e.classList.add('tut-focus');}
}
let tutLast='';
function tutTick(){
 if(!tut.on){clearInterval(tut.timer);tut.timer=0;return;}
 const s=TUT_STEPS[tut.i];if(s.phase){const ph=s.phase();if(tut.phase!==ph){const was=tut.phase;tut.phase=ph;if(was!=null&&!s.done()){s.select();renderPanel();requestDraw();}}}
 const key=[tut.i,!!s.done(),!!ship?._geoProxy,tut.min,!!s.extra?.show(),s.summary?JSON.stringify([S?.bridges,S?.accelG,S?.alphaTot,S?.hyperClass,S?.warnings?.length]):''].join('|');
 if(key!==tutLast){tutLast=key;tutRender();}else tutDecorate();
}
function bindTutorial(){
 document.addEventListener('click',e=>{const b=e.target.closest('[data-tut]');if(!b)return;const a=b.dataset.tut;
  if(a==='start'){tutStart();return;}
  if(!tut.on)return;
  if(a==='next')tutGo(tut.i+1);else if(a==='prev')tutGo(tut.i-1);else if(a==='close')tutStop();
  else if(a==='extra'){try{TUT_STEPS[tut.i].extra?.run();}catch(err){console.error(err);toast(String(err.message||err));}tutRender();}
  else if(a==='text'){tut.full=!tut.full;b.classList.toggle('full',tut.full);}
  else if(a==='min'){tut.min=true;tutRender();}else if(a==='max'){tut.min=false;tutRender();}
  else if(a==='auto'){const s=TUT_STEPS[tut.i];if(!ship?._geoProxy){toast('船体の準備中です');return;}try{s.setup?.();renderPanel();s.auto?.();}catch(err){console.error(err);toast('おまかせ配置に失敗しました：'+(err.message||err));}tutRender();}
 });
}

// ---------- v20.1 sound ----------
// KSAudio (src/45_audio.js) synthesizes everything live: original music in the space-opera
// manner and generic effects, no samples. The music follows the screen — the title (and the
// fleet review), the yard (designing), the fleet's organisation, maps and patrols (voyage),
// and battle (a fight in the 3D view or on the tactical map), which grows as more guns fire.
// Stingers mark contact, victory and defeat; effects follow the guns, hits and explosions near
// the camera, the parts placed and removed, and the buttons.
const SND = {scene: '', fac: '', fire: 0, t: 0, alerts: new Set(), result: null, evN: 0};
const snd = () => window.KSAudio || null;
// v20.5 The last result screen plays the result music (a recorded track when the classical BGM is on):
// the fleet battle's result sheet, or the result card of a battle fought on its own in the 3D view
// (a battle that is one system of a fleet battle has its card, but the fleet battle goes on).
function sndResult() {
 if (voy.open && voy.result && !voy.resultDismissed && $('#voySheet') && !$('#voySheet').hidden) return voy.result.winner === 0 ? 'victory' : 'defeat';
 const B = trial.on ? trial.battle : null, el = B && B.result && !B.rts ? $('#trialHud [data-th="result"]') : null;
 if (el && !el.hidden && B.result.kind !== 'withdrew') return B.result.kind === 'win' ? 'victory' : 'defeat';
 return null;
}
function sndScene() {
 const res = sndResult(); if (res) return [res];
 if (titleVisible()) return ['title'];
 if (trial.on) {
  if (trial.rts && voy.w) return voy.w.battles.has(trial.rts.sys) ? ['battle', voy.setup?.own] : ['voyage', voy.setup?.own];
  return trial.mode === 'battle' || trial.battle?.patrol && !trial.battle.result ? ['battle'] : ['voyage'];
 }
 if (voy.open) { const w = voy.w, sys = voy.screen === 'tac' ? voy.tac.sys : null; return w && sys != null && w.battles.has(sys) ? ['battle', voy.setup?.own] : ['voyage', voy.setup?.own]; }
 if (fleet.mode === 'review') return ['title'];
 if (fleet.mode !== 'design') return ['battle'];
 return ['yard'];
}
// Distance to the listener: the piloted ship in the 3D view, else the camera's target.
function sndListener() { if (trial.on) return trial.P; const c = view?.cam; return c?.target || [0, 0, 0]; }
function sndAt(name, pos, o = {}) {
 const A = snd();if (!A || !pos) return false;const L = sndListener(), d = Math.hypot(pos[0] - L[0], pos[1] - L[1], pos[2] - L[2]), near = o.near || 1500, far = o.far || 40000;
 const g = (A.atten ? A.atten(d, near, far) : Math.max(0, 1 - d / far)) * (o.gain ?? 1);if (g < .02) return false;
 if (/laser|turbolaser|ion|point_defense|missile|torpedo/.test(name)) SND.fire += 1;
 return A.sfx(name, {gain: g, pitch: o.pitch});
}
function sndUI(name, gain = .5) { const A = snd();if (A) A.sfx(name, {gain}); }
// v20.4 Names the sound module has (newer modules add classes of guns, blasts, engines and passes).
const sndHas = n => { const A = snd(); return !!A && (A.names?.sfx || []).includes(n); };
const sndPick = (...ns) => ns.find(sndHas) || ns[ns.length - 1];
// A turret's voice: point defence, ion or heavy ion, light, medium or heavy turbolaser (by bolt energy, else by size).
function sndGun(t) {
 if (t.pd) return 'point_defense';
 const e = t.tt || 0, big = e >= 10 || (!e && t.r > 14), small = e ? e < .1 : t.r <= 5;
 if (t.ion) return big || t.k === 'ionL' ? sndPick('ion_heavy', 'ion') : 'ion';
 return big ? sndPick('turbolaser_heavy', 'turbolaser') : small ? sndPick('turbolaser_light', 'laser_light') : 'turbolaser';
}
// Another ship's salvo: big ships fire the heavy guns, small ones the light (s.gun: the salvo in TT).
function sndSalvo(s, len) {
 if (s.ion) return len > 900 || s.gun > 600 ? sndPick('ion_heavy', 'ion') : 'ion';
 return len > 900 || s.gun > 600 ? sndPick('turbolaser_heavy', 'turbolaser') : len < 250 && s.gun < 30 ? sndPick('turbolaser_light', 'laser_light') : 'turbolaser';
}
// Craft passing close by the camera: one pass each (fighters, light or heavy shuttles), a few a second at most.
const SND_PASS = new Map();
function sndFlyby(list, P) {
 const A = snd(); if (!A || !view || trial.paused) return; const now = performance.now(); if (now - (SND.pass || 0) < 350) return;
 const e = view.eye(), E = [e[0] + P[0], e[1] + P[1], e[2] + P[2]];
 for (const q of list) { if (!q.alive || q.far || q.kind === 'missile') continue; const d = Math.hypot(q.pos[0] - E[0], q.pos[1] - E[1], q.pos[2] - E[2]); if (d > 520) continue;
  const k = q.id ?? q, last = SND_PASS.get(k) || 0; if (now - last < 6000) continue; SND_PASS.set(k, now); if (SND_PASS.size > 600) SND_PASS.clear();
  const role = q.craft ? R.CRAFT[q.craft]?.role : null, heavy = q.craft && /sentinel|barge|c9979|laatc/.test(q.craft), name = role === 'shuttle' || role === 'lander' || role === 'gunship' ? sndPick(heavy ? 'shuttle_heavy' : 'shuttle_light', 'flyby') : sndPick('flyby_fighter', 'flyby');
  const v = view.cam, rx = Math.cos(v.th + Math.PI / 2), rz = Math.sin(v.th + Math.PI / 2), pan = C.clamp(((q.pos[0] - E[0]) * rx + (q.pos[2] - E[2]) * rz) / 300, -1, 1) * .7;
  A.sfx(name, {gain: C.clamp(1.15 - d / 520, .2, .9), pan}); SND.pass = now; break; }
}
// The engines of the piloted (or watched) ship: a steady hum whose loudness and pitch follow the thrust.
function sndEngine() {
 const A = snd(); if (!A?.loop) return; let want = null;
 if (trial.on && !trial.paused && trial.jump?.phase !== 'tunnel') {
  const B = trial.battle; let len = 0, lvl = 0;
  if (trial.spectate && B) { const u = B.b.units.find(x => x.id === B.follow); if (u && !u.dead) { len = u.p.len; lvl = C.clamp(C.engineLevel(u), 0, 1); } }
  else if (trial.p && !B?.me?.dead) { len = trial.p.len; lvl = C.clamp(Math.max(trial.thrust || 0, Math.abs(TRIAL_TELEGRAPH[trial.tele]?.[1] || 0) * .8), 0, 1); }
  if (len > 0) { const name = len < 300 ? 'engine_small' : len < 1200 ? 'engine_medium' : 'engine_large'; if ((A.names?.loops || []).includes(name)) want = {name, gain: .18 + .42 * lvl, pitch: .92 + .2 * lvl}; }
 }
 if (want) { if (SND.eng?.name !== want.name) { SND.eng?.h?.stop(1.2); SND.eng = {name: want.name, h: A.loop(want.name, {gain: 0, pitch: want.pitch})}; } SND.eng.h?.set({gain: want.gain, pitch: want.pitch}); }
 else if (SND.eng) { SND.eng.h?.stop(1); SND.eng = null; }
}
// Designing: placing and removing parts, from the label of the change.
function sndEdit(label) { const l = String(label || ''); sndUI(/配置|取り付け|追加|貼り付け|複製|搭載/.test(l) ? 'place' : /削除|撤去|外す|降ろす/.test(l) ? 'remove' : 'snap', .45); }
// Battle events from the voyage: contact sounds the alarm. v20.6 No music marks the start or the end of a
// fight (the user's call): the music just changes to the battle score and back; only the final result plays
// its own music.
function sndVoyEvent(e) {
 const A = snd();if (!A || !voy.w) return;
 if (e.battle && !e.end && R.systemUnits(voy.w, e.sys).some(u => u.side === 0)) { SND.alerts.add(e.sys); A.sfx('alarm', {gain: .45}); }
 else if (e.battle && e.end) SND.alerts.delete(e.sys);
}
function sndTick() {
 const A = snd();if (!A) return;
 const [scene, fac] = sndScene(), key = scene + '|' + (fac || '');
 if (key !== SND.scene) { SND.scene = key; A.setMusic(scene, fac ? {faction: fac} : undefined); }
 // Battle intensity: guns heard in the last seconds (decaying), on a floor so a battle never sounds idle.
 SND.fire *= .7;if (scene === 'battle') A.setIntensity(Math.min(1, .25 + SND.fire / 10));
 const w = voy.w;if (w?.result && SND.result !== w.result) { SND.result = w.result; if (!sndClassic()) A.stinger(w.result.winner === 0 ? 'victory' : 'defeat', {faction: voy.setup?.own}); }
}
// Mute from the top bar or the 3D view; the buttons show the state (pressed = sound off).
function sndToggle() { const A = snd();if (!A) { toast('この端末では音を鳴らせません'); return; } A.settings.set({muted: !A.settings.get().muted}); sndButtons(); }
function sndButtons() { const A = snd(), m = !A || !!A.settings.get().muted; for (const b of document.querySelectorAll('[data-sound-toggle]')) { b.setAttribute('aria-pressed', String(m)); b.setAttribute('aria-label', m ? '音を出す' : '音を切る'); } document.documentElement.classList.toggle('ks-muted', m); }
function soundSettingsHTML() { return `<div class="tpanel-head"><h2>音の設定</h2><button type="button" class="btn ghost sm" data-title-back>戻る</button></div><div id="soundSettings"></div><p class="note">${window.KS_FILES ? 'BGM は「クラシック」でクラシック名曲サウンドライブラリーの録音（ワーグナー、ホルスト、ムソルグスキー、チャイコフスキー）を、「合成」でこの場で合成する音楽を流します。効果音はすべて合成です。' : '音楽と効果音はすべてこの場で合成しています（この単一ファイル版にはクラシックの録音は入っていません）。'}最初に画面に触れたときに鳴り始めます。</p>`; }
// v20.5 Classical recordings (Classical Music Sound Library; tools/mkbgm.py packs them as data/bgm_<id>.js, published
// next to the page, never in the single-file build, which keeps the synthesized score): Meistersinger and Jupiter for
// the title, Lohengrin while designing, Jupiter on the voyage maps, Mars, Night on Bald Mountain and the 1812 in battle,
// the Great Gate of Kiev on a victory's result screen and the Scene from Swan Lake on a defeat's.
const SND_TRACKS = {title: ['meister', 'jupiter'], yard: ['lohengrin'], voyage: ['jupiter'], battle: ['mars', 'bald', 'o1812'], victory: ['kiev'], defeat: ['swan']};
const sndClassic = () => { const st = snd()?.state?.(); return !!st && st.musicSource !== 'synth' && !!st.tracksAvailable; };
function bindSound() {
 const A = snd();if (!A) return;
 if (window.KS_FILES && A.configure) { A.configure({tracks: SND_TRACKS, trackBase: 'data/'}); A.preload?.(SND_TRACKS.title[0]); }
 setInterval(() => { try { sndTick(); } catch (e) { console.warn('sound', e); } }, 500);
 // The jump: the roar going in and the burst coming out (watched each frame, the phases are short).
 const frame = () => { try { if (!(SND.ef = (SND.ef || 0) + 1) || SND.ef % 6 === 0) sndEngine(); } catch (e) {} const ph = trial.on ? trial.jump?.phase || null : null; if (ph !== SND.jph) { if (ph === 'enter' || ph === 'tunnel' && SND.jph !== 'enter') sndUI('hyperspace_out', .9); else if (ph === 'exit') sndUI('hyperspace_in', .9); SND.jph = ph; } requestAnimationFrame(frame); };
 requestAnimationFrame(frame);
 // Buttons click, tabs and toggles tick (quietly; repeated taps are thinned by the module).
 document.addEventListener('click', e => { const t = e.target.closest?.('[data-sound-toggle]'); if (t && !t.dataset.trialCmd) { sndToggle(); } }, false);
 setInterval(sndButtons, 1500);sndButtons();
 document.addEventListener('click', e => { const b = e.target.closest?.('button,[role=tab],summary');if (!b || b.disabled) return; sndUI(b.matches('[role=tab],.seg button,summary,[aria-pressed]') ? 'ui_toggle' : 'ui_click', .35); }, true);
}

// ---- src/55_voyage.js ----
// ============================================================
// 航行 (voyage): patrol, fleet battle and — in a later version —
// missions. Fleet setup with the order of battle, the operational
// map of the sector, the tactical map of each battle, and the way
// into flying any ship of a battle in 3D. The rules live in Rts.
// ============================================================
const R = Rts;
const VOY_SPEEDS = [0, 1, 4, 16, 64];
const voy = {open: false, screen: null, setup: null, w: null, speed: 1, last: 0, designs: new Map(), pending: new Map(), sel: {group: null, ctg: null, sys: null, dest: null, units: [], wing: null, foe: null}, cmd: null, tab: 'ships', side: true,
 ops: {c: [2500, 2500], k: 0, fitted: false}, tac: {sys: null, c: [0, 0], mpp: 300, fitted: false}, flash: [], seenEv: 0, notes: [], pilot: null, log: []};

// ---------- designs ----------
// Examples come with precomputed profiles; saved and current designs are
// prepared by the engine (the same request also builds their 3D models).
function voyExampleDesigns() {
 const out = [];
 for (const d of Object.values(YardFleetData?.designs || {})) out.push({key: d.key, name: d.name, faction: d.faction || R.SIDE_OF[d.side] || 'empire', side: d.side, cls: d.cls, p: d.p, info: d.info, air: d.air, ground: d.ground, src: 'example'});
 return out.sort((a, b) => (a.faction > b.faction) - (a.faction < b.faction) || b.info.len - a.info.len);
}
function voyDesign(key) { return voy.designs.get(key) || null; }
function voyRegister(d) { voy.designs.set(d.key, d); return d; }
async function voyPrepare(source) {
 // source: 'current' | 'save:<id>' | example key
 if (voy.designs.has(source)) return voy.designs.get(source);
 if (voy.pending.has(source)) return voy.pending.get(source);
 const job = (async () => {
  const a = await fleetAsset(source), S = a.stats, p = a.p;
  const d = {key: a.key, name: p.name || S.name || '設計艦', faction: voy.setup?.own || 'empire', side: '自作艦', cls: S.cls?.name || '', p, info: R.designInfo(S, p), air: a.design?.airWings || [], ground: a.design?.groundForces || [], src: source.startsWith('save:') ? 'save' : source === 'current' ? 'current' : 'example'};
  voy.designs.set(source, d);voy.designs.set(a.key, d);return d;
 })();
 voy.pending.set(source, job);try { return await job; } finally { voy.pending.delete(source); }
}
const voyShort = n => String(n || '').split('｜')[0];

// ---------- ship names ----------
// Imperial and Republic ships take Royal Navy-style names or Roman ones (the
// epithets of the legions); the Empire adds the names of its own destroyers;
// the Alliance names ships for its cause; Separatist ships carry the jargon of
// the corporations that built them (English words in katakana). Names are drawn
// at random and can be edited.
// Separatist names given in Japanese before v15.1, and the English jargon in katakana that replaces each.
const VOY_CIS_RENAME = {'敵対的買収': 'ホスタイル・テイクオーバー', '友好的買収': 'フレンドリー・テイクオーバー', '強制執行': 'エンフォースメント', '強制清算': 'フォースト・リクイデーション', '自主清算': 'ボランタリー・リクイデーション', '臨時配当': 'スペシャル・ディビデンド', '特別配当': 'エクストラ・ディビデンド', '優先配当': 'プリファード・ディビデンド', '中間配当': 'インテリム・ディビデンド', '最終決算': 'ファイナル・アカウンツ', '連結決算': 'コンソリデーション', '四半期決算': 'クォータリー・アーニングス', '特別監査': 'スペシャル・オーディット', '外部監査': 'エクスターナル・オーディット', '緊急融資': 'ブリッジ・ローン', '協調融資': 'シンジケート・ローン', '第三者割当増資': 'プライベート・プレースメント', '株式公開買付': 'テンダー・オファー', '優先償還': 'プライオリティ・リデンプション', '繰上償還': 'アーリー・リデンプション', '債権回収': 'デット・コレクション', '資産凍結': 'アセット・フリーズ', '資産差押': 'ガーニッシュメント', '担保権実行': 'フォークロージャー', '経営統合': 'マージャー', '事業分割': 'スピンオフ', '垂直統合': 'バーティカル・インテグレーション', '水平統合': 'ホリゾンタル・インテグレーション', '戦略的提携': 'ストラテジック・アライアンス', '包括的提携': 'グローバル・パートナーシップ', '損益分岐': 'ブレイクイーブン', '費用対効果': 'コスト・エフィシェンシー', '規模の経済': 'エコノミー・オブ・スケール', '市場占有': 'マーケット・シェア', '独占契約': 'エクスクルーシブ・コントラクト', '違約条項': 'ペナルティ・クローズ', '優先交渉権': 'ファースト・リフューザル', '利益相反': 'コンフリクト・オブ・インタレスト', '株主還元': 'シェアホルダー・リターン', '原価低減': 'コスト・リダクション', '不採算整理': 'リストラクチャリング', '経営合理化': 'ラショナリゼーション', '減価償却': 'デプリシエーション', '一括償却': 'ライトオフ', '信用取引': 'マージン・トレーディング', '手形決済': 'セトルメント', '与信審査': 'デュー・ディリジェンス', '競争入札': 'コンペティティブ・ビッド', '指名入札': 'セレクティブ・テンダー', '価格改定': 'プライス・リビジョン', '納期厳守': 'オンタイム・デリバリー', '契約更新': 'コントラクト・リニューアル', '保険引受': 'アンダーライティング', '債務保証': 'デット・ギャランティー', '連帯保証': 'ジョイント・ギャランティー', '増収増益': 'トップライン・グロース', '過去最高益': 'レコード・プロフィット', '配当性向': 'ペイアウト・レシオ', '自己株式取得': 'シェア・バイバック', '損害賠償請求': 'リティゲーション'};
const VOY_SHIPNAMES = {
 rn: ['ドーントレス', 'ヴァリアント', 'レゾリュート', 'インドミタブル', 'インプラカブル', 'フォーミダブル', 'イラストリアス', 'インヴィンシブル', 'インディファティガブル', 'インフレキシブル', 'ヴァンガード', 'ヴィクトリアス', 'ヴェネラブル', 'ヴィジラント', 'ウォースパイト', 'リパルス', 'リナウン', 'リヴェンジ', 'レゾリューション', 'ソヴリン', 'スパーブ', 'スウィフトシュア', 'テメレーア', 'サンダラー', 'トライアンフ', 'コンカラー', 'カレイジャス', 'グロリアス', 'フューリアス', 'アーデント', 'オーデイシャス', 'コロッサス', 'イントレピッド', 'マジェスティック', 'マグニフィセント', 'モナーク', 'エンデュランス', 'ディファイアンス', 'アキリーズ', 'エイジャックス', 'オライオン', 'ベレロフォン', 'ハーキュリーズ', 'セントー', 'ブルワーク', 'アルビオン', 'ステッドファスト', 'アンフレンチング', 'インペタス', 'ネメシス'],
 imperial: ['デヴァステイター', 'アヴェンジャー', 'アキューザー', 'ジュディケイター', 'タイラント', 'ストーカー', 'インティミデイター', 'コンクエスト', 'インフリクター', 'アナイアレイター', 'ハービンジャー', 'アドモニター', 'クルセイダー', 'ドミネーター', 'レレントレス', 'ヴェンジェンス', 'インクイジター', 'パニッシャー', 'リトリビューション', 'サブジュゲイター', 'オーバーシーア', 'ウォーデン', 'センチネル', 'エンフォーサー'],
 roman: ['インペラトル', 'センチュリオン', 'プラエトル', 'レガトゥス', 'トリブヌス', 'コンスル', 'ウィクトリクス', 'フォルティス', 'アウグスタ', 'アクィラ', 'グラディウス', 'ピルム', 'インヴィクタ', 'フルミナタ', 'フェッラタ', 'プリミゲニア', 'ゲミナ', 'アポリナリス', 'フレテンシス', 'クラウディア', 'ミネルウィア', 'イタリカ', 'パルティカ', 'スキュティカ', 'ウルピア', 'フラウィア', 'マケドニカ', 'ラパクス', 'フェロクス', 'フィデリス', 'コンコルディア', 'ウァレリア'],
 rebel: ['リバティ', 'インディペンデンス', 'フリーダム', 'ディファイアンス', 'レゾルヴ', 'ホープ', 'コンコード', 'ヴィンディケーション', 'リデンプション', 'ドーン', 'ソリダリティ', 'フォーティチュード', 'パーシヴィアランス', 'ブレイヴリー', 'ヘリテージ', 'ユニティ', 'オナー', 'ヴァラー', 'ルミナリー', 'ニュー・ホープ', 'エマンシペーター', 'リベレーター', 'サンクチュアリ', 'プロミス'],
 // Separatist ships carry the jargon of the corporations that built them, as the English words in katakana.
 cis: [...Object.values(VOY_CIS_RENAME), 'シナジー', 'レバレッジ', 'アービトラージ', 'ポートフォリオ', 'ベンチマーク', 'コンプライアンス', 'ガバナンス', 'ソリューション', 'イノベーション', 'スケーラビリティ', 'ディスラプション', 'パラダイム・シフト', 'コア・コンピタンス', 'バリュー・チェーン', 'サプライ・チェーン', 'アウトソーシング', 'ダウンサイジング', 'ライトサイジング', 'ゴールデン・パラシュート', 'ポイズン・ピル', 'ホワイト・ナイト', 'クラウン・ジュエル', 'ベア・ハグ', 'グリーンメール', 'ジャンク・ボンド', 'デリバティブ', 'ショート・セリング', 'マージン・コール', 'キャピタル・ゲイン', 'キャッシュ・フロー', 'ボトムライン', 'ステークホルダー', 'アセット・ストリッピング', 'フォース・マジュール', 'レバレッジド・バイアウト', 'ハイ・イールド', 'タックス・ヘイブン', 'ベイルアウト', 'モノポリー', 'カルテル', 'コングロマリット', 'ゴーイング・コンサーン', 'プライス・ウォー', 'スクイーズアウト', 'ゴールデン・シェア', 'リバース・マージャー', 'プロフィット・センター', 'マーケット・メイカー', 'ディープ・ディスカウント', 'テイク・プライベート']
};
function voyNamePool(f) { return f === 'empire' ? [...VOY_SHIPNAMES.imperial, ...VOY_SHIPNAMES.rn, ...VOY_SHIPNAMES.roman] : f === 'republic' ? [...VOY_SHIPNAMES.rn, ...VOY_SHIPNAMES.roman] : f === 'cis' ? VOY_SHIPNAMES.cis : VOY_SHIPNAMES.rebel; }
function voyNextName(f, used, rand = Math.random) {
 const pool = voyNamePool(f), free = pool.filter(n => !used.has(n));if (free.length) return free[Math.floor(rand() * free.length)];
 for (const suf of ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']) { const left = pool.map(n => `${n} ${suf}`).filter(n => !used.has(n)); if (left.length) return left[Math.floor(rand() * left.length)]; }
 return `無名艦 ${used.size + 1}`;
}

// ---------- the order of battle (艦隊編成) ----------
// Each navy's fleet is organised in combined task groups (合同任務群) of task
// groups (任務群) of four to eight ships; every ship has a name. The orders of
// battle are kept in this browser, one per navy, and the fleet battle sends out
// the task groups chosen from it.
const ORBAT_KEY = 'yard.orbat.v1', TG_MIN = 4, TG_MAX = 8;
function voyOrbatLoad() {
 try { const d = JSON.parse(LS.get(ORBAT_KEY) || 'null'); if (d && d.version === 1 && d.factions) { if (voyRenameCis(d)) LS.set(ORBAT_KEY, JSON.stringify(d)); return d; } } catch (e) { /* a broken store starts afresh */ }
 return {version: 1, factions: {}};
}
// Ships named from the old Japanese list take the English name that replaces it (keeping II, III…); names the player chose stay.
function voyRenameCis(d) {
 let n = 0;
 for (const ob of Object.values(d.factions || {})) for (const c of ob.ctgs || []) for (const t of c.tgs || []) for (const sh of t.ships || []) {
  const m = /^(.*?)( (?:II|III|IV|V|VI|VII|VIII|IX|X))?$/.exec(String(sh.name || '')), to = m && Object.hasOwn(VOY_CIS_RENAME, m[1]) ? VOY_CIS_RENAME[m[1]] : null;
  if (to) { sh.name = to + (m[2] || ''); n++; }
 }
 return n > 0;
}
function voyOrbatSave() { if (voy.orbat) LS.set(ORBAT_KEY, JSON.stringify(voy.orbat)); }
function voyOb(f) {
 voy.orbat = voy.orbat || voyOrbatLoad();let ob = voy.orbat.factions[f];
 if (!ob) { ob = voy.orbat.factions[f] = voyAutoOrbat(f, 'standard', Math.random, {cap: 48}); voyOrbatSave(); }
 return ob;
}
const voyObShips = ob => ob.ctgs.flatMap(c => c.tgs.flatMap(t => t.ships));
const voyObTgs = ob => ob.ctgs.flatMap(c => c.tgs);
const voyUid = ob => (ob.next = (ob.next || 1) + 1, 'o' + ob.next);
// Designs can be example classes, saved designs ('save:…') or the one on the drawing board ('current').
function voyShipDesign(sh) { return voyDesign(sh.key) || voyDesign(sh.src) || null; }
// ---- carried ships (v19): small ships in a carrier's hangar ----
const voyDims = d => [d.p?.len || d.info?.len || 0, d.p?.width || 0, d.p?.height || 0];
// v20 A ship's hangar load in the order of battle — squadrons, carried ships, the vehicles of its
// regiments — by size and shape against its bays and hatches (R.shipStow), as in the designer.
const voyHasStow = d => !!d?.info?.stow;
function voyCarryFit(carrier, d2) {
 const dims = voyDims(d2), size = C.shipStowSize(dims);if (!d2 || d2.key === carrier.key) return {ok: false, size, dims};
 if (!voyHasStow(carrier)) { const need = dims.map(v => v + C.SHIP_STOW_CLEAR), perms = [[0, 1, 2], [1, 0, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0], [2, 1, 0]]; return {ok: (carrier.info?.bays || []).some(b => perms.some(o => need[o[0]] <= b[0] && need[o[1]] <= b[1] && need[o[2]] <= b[2])), exit: true, size, dims}; }
 const r = R.shipStow(carrier.info, [], [{dims}]).carried[0];return {ok: !!r && !r.tooLarge, exit: !!r?.deployable, size, dims};
}
const voyCarriedDims = sh => (sh.carried || []).map(c => { const d2 = voyShipDesign(c); return d2 ? {dims: voyDims(d2)} : null; });
function voyStowShort(sh, d) { const st = voyStow(sh, d);return {short: st.wings.reduce((n, r) => n + r.unembarked, 0) + st.carried.reduce((n, r) => n + r.unembarked, 0)}; }
function voyStow(sh, d) { return R.shipStow(d.info, sh.air || [], voyCarriedDims(sh).map(x => x || {dims: null}), sh.ground || []); }
function voyCarriedSize(sh) { return (sh.carried || []).reduce((n, c) => { const d2 = voyShipDesign(c); return n + (d2 ? C.shipStowSize(voyDims(d2)) : 0); }, 0); }
function voyCarryRoom(sh, d) { if (!voyHasStow(d)) return Math.max(0, (d.info?.hangarCap || d.info?.slotCap || 0) - R.airTotals(sh.air).size); const st = voyStow({...sh, carried: []}, d);return st.free; }
// A design's own carried-ship rows (kind 'ship') become its default complement.
function voyDefaultCarried(d) { const out = []; for (const r of d.air || []) { if (r.kind !== 'ship') continue; const d2 = voyDesign(r.ref); if (!d2 || !voyCarryFit(d, d2).ok) continue; for (let i = 0; i < Math.min(12, r.count || 0); i++) out.push({src: d2.key, key: d2.key, name: `${voyShort(d2.name)} ${out.length + 1}`}); } return out; }
async function voyEnsureDesigns(ob) {
 const miss = voyObShips(ob).filter(sh => !voyShipDesign(sh));if (!miss.length) return;
 for (const src of [...new Set(miss.map(sh => sh.src))]) { try { const d = await voyPrepare(src); for (const sh of miss) if (sh.src === src) sh.key = d.key; } catch (e) { console.warn('design not ready', src, e.message); } }
 if (voy.screen === 'setup') voyRenderSetup();
}
// People and materials a ship draws: crew, pilots and embarked troops; provisions
// for them, stores by tonnage and a fixed allowance per hull.
function voyShipDemand(sh, faction) {
 const d = voyShipDesign(sh);if (!d) return {people: 0, supply: 0};
 const air = R.airTotals(sh.air), troops = (sh.ground || []).reduce((n, r) => n + R.regimentTotals(r).troops, 0), one = R.unitDemand(d.info, air.crew, troops);
 let people = one.people, supply = one.supply + 200;
 for (const c of sh.carried || []) { const d2 = voyShipDesign(c); if (!d2) continue; const x = R.unitDemand(d2.info); people += x.people; supply += x.supply + 50; }
 return {people, supply};
}
function voyShipsTotals(ships) { const t = {people: 0, supply: 0, ships: 0}; for (const sh of ships) { const x = voyShipDemand(sh); t.people += x.people; t.supply += x.supply; t.ships++; } return t; }
function voyShipsStrength(ships) { let n = 0; for (const sh of ships) { const d = voyShipDesign(sh); if (!d) continue; const u = C.fleetUnit('x', d.key, d.p, 0); n += R.unitStrength(u) + R.airTotals(sh.air).fight * 4; for (const c of sh.carried || []) { const d2 = voyShipDesign(c); if (d2) n += R.unitStrength(C.fleetUnit('x', d2.key, d2.p, 0)); } } return n; }
// Fleet allowances: total crew (with pilots and troops) and materials. No limit on the number of ships.
const VOY_SCALES = {
 small: {name: '小規模', people: 110000, supply: 140000},
 standard: {name: '標準', people: 260000, supply: 330000},
 large: {name: '大規模', people: 560000, supply: 700000},
 // A fleet built round a super star destroyer: the Executor's own crew is in the millions.
 decisive: {name: '決戦（超大型艦を含む）', people: 9000000, supply: 9000000, dread: true}
};
const VOY_SHIP_CAP = 120;   // ships a side the battle model can carry (a limit of the computer, not a rule)
const VOY_SHARED = {dreadnaught: ['empire', 'rebel', 'republic']};
const voyServes = (d, faction) => d.faction === faction || !!VOY_SHARED[d.key]?.includes(faction);
// The usual opponents: the Empire and the Alliance, the Republic and the Separatists.
const VOY_RIVAL = {empire: 'rebel', rebel: 'empire', republic: 'cis', cis: 'republic'};
// A fleet of task groups: each two capital ships (classes in turn) with four escorts,
// the heaviest ship leading; a navy without capital ships sails groups of six escorts.
// Task groups are added while the allowance (crew and materials) lasts — or, with a
// target, until the fleet's estimated strength reaches it — three to a combined task
// group. Super-heavy ships sail only in the decisive allowance, at the head of the first group.
function voyAutoOrbat(faction, scale, rand = Math.random, opt = {}) {
 const cap = VOY_SCALES[scale] || VOY_SCALES.standard, pool = voyExampleDesigns(), mine = pool.filter(d => voyServes(d, faction)), use = mine.length ? mine : pool;
 const memo = new Map(), str = d => { if (!memo.has(d.key)) memo.set(d.key, R.unitStrength(C.fleetUnit('x', d.key, d.p, 0))); return memo.get(d.key); };
 const air = d => R.defaultAir(d.info, faction, d.air), people = d => voyShipDemand({key: d.key, air: air(d), ground: []}).people;
 const normal = use.filter(d => d.info.len < 5000), best = Math.max(0, ...normal.map(str)), supers = cap.dread ? use.filter(d => d.info.len >= 5000).sort((a, b) => b.info.len - a.info.len) : [];
 // Capital ships whose crew would take more than three tenths of the allowance stay home.
 const caps = normal.filter(d => d.info.capital && people(d) <= cap.people * .3).sort((a, b) => b.info.len - a.info.len);
 const esc0 = normal.filter(d => !d.info.capital).sort((a, b) => b.info.len - a.info.len), escs = esc0.filter(d => str(d) >= best * .01).length ? esc0.filter(d => str(d) >= best * .01) : esc0;
 const limit = opt.target ? VOY_SHIP_CAP : Math.min(VOY_SHIP_CAP, opt.cap || 72);
 const ships = [], tgs = [], used = new Set(), tot = {people: 0, supply: 0, str: 0};let ci = 0, ei = 0, done = false;
 const take = d => { const sh = {id: '', src: d.key, key: d.key, name: '', air: air(d), ground: []}, x = voyShipDemand(sh);
  if (ships.length >= limit) return null;
  if (!opt.target && (tot.people + x.people > cap.people || tot.supply + x.supply > cap.supply)) return null;
  sh.name = voyNextName(faction, used, rand);used.add(sh.name);ships.push(sh);tot.people += x.people;tot.supply += x.supply;tot.str += str(d) + R.airTotals(sh.air).fight * 4;return sh; };
 for (let k = 0; k < 60 && !done; k++) {
  const plan = k === 0 ? supers.slice() : [];
  for (let i = 0; i < (caps.length ? 2 : 0); i++) plan.push(caps[ci++ % caps.length]);
  while (plan.length < 6 && (escs.length || caps.length)) plan.push(escs.length ? escs[ei++ % escs.length] : caps[ci++ % caps.length]);
  const tg = [];for (const d of plan) { if (opt.target && tot.str >= opt.target) { done = true; break; } const sh = take(d); if (sh) tg.push(sh); }
  if (!tg.length) break;tgs.push(tg);if (opt.target && tot.str >= opt.target) done = true;
 }
 if (!ships.length && use.length) { const d = use.slice().sort((a, b) => people(a) - people(b))[0], sh = {id: '', src: d.key, key: d.key, name: voyNextName(faction, used, rand), air: air(d), ground: []}; ships.push(sh); tgs.push([sh]); }
 // A last group of fewer than four ships joins the one before it where there is room.
 if (tgs.length > 1 && tgs[tgs.length - 1].length < TG_MIN) { const last = tgs[tgs.length - 1], prev = tgs[tgs.length - 2]; if (prev.length + last.length <= TG_MAX) prev.push(...tgs.pop()); else while (last.length < TG_MIN && prev.length > TG_MIN) last.unshift(prev.pop()); }
 const ob = {ctgs: [], next: 1};
 tgs.forEach((t, i) => { const c0 = Math.floor(i / 3); if (!ob.ctgs[c0]) ob.ctgs[c0] = {id: voyUid(ob), name: `第${c0 + 1}合同任務群`, tgs: []}; const c = ob.ctgs[c0];
  t.sort((a, b) => voyDesign(b.key).info.len - voyDesign(a.key).info.len);
  c.tgs.push({id: voyUid(ob), name: `第${c0 + 1}${c.tgs.length + 1}任務群`, formation: ['abreast', 'wedge', 'column'][c.tgs.length % 3], ships: t.map(sh => ({...sh, id: voyUid(ob)}))}); });
 return ob;
}
// The opponent first offered: the usual rival, unless its whole navy (as many ships as
// the battle can carry) still falls well short of our fleet; then the next that can match it.
function voyDefaultFoe(s) {
 const a = voyShipsStrength(voySortieShips(s)), order = [VOY_RIVAL[s.own], ...Object.keys(R.FACTIONS)].filter((f, i, l) => f && f !== s.own && l.indexOf(f) === i && voyExampleDesigns().some(d => voyServes(d, f)));
 if (!(a > 0)) return order[0] || 'rebel';
 for (const f of order) { const b = voyShipsStrength(voyObShips(voyAutoOrbat(f, s.scale, R.rng(7), {target: a}))); if (b >= a * .85) return f; }
 return order[0];
}
// The enemy's order of battle for the chosen navy, allowance and seed (kept while they stay the same).
function voyFoeOrbat(s) {
 const target = s.foeMode === 'same' ? 0 : Math.round(voyShipsStrength(voySortieShips(s))), k = `${s.foe}|${s.scale}|${s.seed}|${s.foeMode}|${target}`;
 if (voy.foeOb?.k !== k) voy.foeOb = {k, ob: voyAutoOrbat(s.foe, s.scale, R.rng(s.seed), target > 0 ? {target} : {})};
 return voy.foeOb.ob;
}
function voyNewSetup() { return {own: 'empire', foe: 'rebel', foeMode: 'match', scale: 'standard', region: 'kuat', tab: 'orbat', sel: {}, editing: null, sheetTab: 'air', seed: (Math.random() * 1e6) | 0}; }
// The task groups chosen to sail: all of them, unless the player unticked some.
function voySortieTgs(s) { const ob = voyOb(s.own); return voyObTgs(ob).filter(t => s.sel[t.id] !== false && t.ships.length); }
function voySortieShips(s) { return voySortieTgs(s).flatMap(t => t.ships); }
// The toast lives with whichever layer is showing.
function voyToast(on) { const t = $('#toast'), hb = $('.hudbottom'); if (!t) return; if (on) $('#voyage').appendChild(t); else if (hb) hb.insertBefore(t, hb.firstChild); }
function voyOpen(screen = 'setup', tab) {
 voy.open = true;$('#voyage').hidden = false;document.body.classList.add('voy-on');voyToast(true);
 if (voy.saves && !(fleet.saves || []).length) fleet.saves = voy.saves;
 if (!voy.designs.size) for (const d of voyExampleDesigns()) voyRegister(d);
 if (!voy.setup) { voy.setup = voyNewSetup(); voy.setup.foe = voyDefaultFoe(voy.setup); }
 if (tab) voy.setup.tab = tab;
 voyShow(screen);voyEnsureDesigns(voyOb(voy.setup.own));
}
function voyClose() {
 vtutStop();voy.open = false;voy.screen = null;$('#voyage').hidden = true;document.body.classList.remove('voy-on');voyToast(false);requestDraw();
}
function voyShow(screen) {
 voy.screen = screen;for (const id of ['voySetup', 'voyMapScreen']) $('#' + id).hidden = true;$('#voySheet').hidden = true;
 if (screen === 'setup') { $('#voySetup').hidden = false; voyRenderSetup(); }
 else { $('#voyMapScreen').hidden = false; $('#voyMapScreen').dataset.mode = screen; voyMapResize(); voyRenderSide(); voyRenderHud(); }
}
const pct = (a, b) => b > 0 ? Math.min(999, Math.round(a / b * 100)) : 0;
function voyBar(label, v, max, fmt = x => num(Math.round(x))) {
 const over = v > max, f = max > 0 ? Math.min(1, v / max) : 0;
 return `<div class="vbar${over ? ' over' : ''}"><span>${label}</span><i><em style="width:${(f * 100).toFixed(1)}%"></em></i><b>${fmt(v)} / ${fmt(max)}</b></div>`;
}
function voyFactionOptions(cur) { return Object.entries(R.FACTIONS).map(([k, f]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(f.name)}</option>`).join(''); }
function voyDesignOptions(faction) {
 // Super-heavy ships last, so the list opens on an ordinary class.
 const ex = voyExampleDesigns().sort((a, b) => (a.info.len >= 5000) - (b.info.len >= 5000) || b.info.len - a.info.len), by = {};for (const d of ex) (by[d.faction] || (by[d.faction] = [])).push(d);
 const order = Object.keys(by).sort((a, b) => (b === faction) - (a === faction));
 const groups = order.map(f => `<optgroup label="${esc(R.FACTIONS[f]?.name || f)}">${by[f].map(d => `<option value="${esc(d.key)}">${esc(voyShort(d.name))}（${fLen(d.info.len)}・${esc(examplePurpose(d.key, d.cls || ''))}）</option>`).join('')}</optgroup>`).join('');
 const saves = (voy.saves || []).map(r => `<option value="save:${esc(r.id)}">${esc(r.name)}（${fLen(r.len || 0)}）</option>`).join('');
 return `${groups}${saves ? `<optgroup label="保存した設計">${saves}</optgroup>` : ''}${ship ? `<optgroup label="設計中の艦"><option value="current">${esc(ship.name)}（${fLen(ship.hull.L)}）</option></optgroup>` : ''}`;
}
function voyRenderSetup() {
 const s = voy.setup, ob = voyOb(s.own), tab = s.tab === 'sortie' ? 'sortie' : 'orbat', sortie = voySortieShips(s), cap = VOY_SCALES[s.scale], t = voyShipsTotals(sortie);
 // Ships whose design cannot be prepared (a saved design since deleted, say) stay behind.
 const ready = sortie.some(voyShipDesign) && !voy.pending.size, ok = ready && t.people <= cap.people && t.supply <= cap.supply && sortie.length <= VOY_SHIP_CAP;
 $('#voySetup').innerHTML = `<header class="voy-head"><div><span class="eyebrow">航行 · 艦隊戦</span><h2>${tab === 'orbat' ? '艦隊編成' : '出撃準備'}</h2></div>
 <div class="seg voy-tabs" role="tablist"><button type="button" role="tab" data-voy="tab:orbat" aria-pressed="${tab === 'orbat'}">艦隊編成</button><button type="button" role="tab" data-voy="tab:sortie" aria-pressed="${tab === 'sortie'}">出撃準備</button></div>
 <div class="voy-head-go"><button type="button" class="btn ghost" data-voy="back">タイトルへ</button><button type="button" class="btn primary" data-voy="start" ${ok ? '' : 'disabled'}>出撃</button></div></header>
 <div class="voy-setup ${tab}">${tab === 'orbat' ? voyOrbatHTML(s, ob) : voySortieHTML(s, ob)}</div>`;
}
function voyOrbatHTML(s, ob) {
 const all = voyObShips(ob), t = voyShipsTotals(all);
 return `<section class="voy-card voy-wide"><div class="voy-card-head"><h3>${esc(R.FACTIONS[s.own].name)}の艦隊</h3><div class="voy-row"><label>陣営<select data-voyset="own">${voyFactionOptions(s.own)}</select></label><button type="button" class="btn sm ghost" data-voy="auto">標準編成で作り直す</button><button type="button" class="btn sm" data-voy="ctgadd">合同任務群を追加</button></div></div>
  <p class="note">合同任務群は任務群の集まり、任務群は${TG_MIN}〜${TG_MAX}隻（最大${TG_MAX}隻）。作戦図では任務群か合同任務群ごとにジャンプし、戦術図では任務群ごとに陣形と目標を指示します。艦名は自由に変えられます。編成はこの端末に陣営ごとに保存されます。</p>
  <p class="vs-sub">${all.length} 隻 · 乗員 ${num(t.people)} 名 · 資材 ${num(Math.round(t.supply))} t</p></section>
  ${ob.ctgs.map(c => voyCtgHTML(s, ob, c)).join('') || '<p class="muted">合同任務群がありません。</p>'}`;
}
function voyCtgHTML(s, ob, c) {
 const ships = c.tgs.flatMap(t => t.ships), t = voyShipsTotals(ships);
 return `<section class="voy-card voy-wide ob-ctg" data-ctg="${c.id}"><div class="voy-card-head"><input class="ob-name ob-ctgname" data-obname="ctg" value="${esc(c.name)}" aria-label="合同任務群の名前" maxlength="24"><span class="vs-sub">${c.tgs.length} 個任務群 · ${ships.length} 隻 · 乗員 ${num(t.people)} 名</span><div class="vs-acts"><button type="button" class="btn sm" data-ob="tgadd">任務群を追加</button><button type="button" class="btn sm ghost" data-ob="ctgdel" aria-label="この合同任務群を解散">×</button></div></div>
  <div class="ob-tgs">${c.tgs.map(tg => voyTgHTML(s, ob, tg)).join('') || '<p class="muted">任務群がありません。</p>'}</div></section>`;
}
function voyTgHTML(s, ob, tg) {
 const n = tg.ships.length, warn = n && n < TG_MIN ? `（${TG_MIN}隻未満）` : '', full = n >= TG_MAX, tgs = voyObTgs(ob);
 return `<div class="ob-tg" data-tg="${tg.id}"><div class="ob-tg-head"><input class="ob-name" data-obname="tg" value="${esc(tg.name)}" aria-label="任務群の名前" maxlength="24"><label class="ob-form">陣形<select data-obform>${Object.entries(R.FORMATIONS).map(([k, v]) => `<option value="${k}" ${tg.formation === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><b class="ob-count${warn ? ' warn' : ''}">${n} / ${TG_MAX} 隻${warn}</b><button type="button" class="btn sm ghost" data-ob="tgdel" aria-label="この任務群を解散">×</button></div>
  <ul class="ob-ships">${tg.ships.map((sh, i) => { const d = voyShipDesign(sh), air = R.airTotals(sh.air), troops = (sh.ground || []).reduce((k, r) => k + R.regimentTotals(r).troops, 0), dem = voyShipDemand(sh), st = d && voyHasStow(d) && (sh.air?.length || sh.carried?.length) ? voyStowShort(sh, d) : null;
   return `<li class="ob-ship" data-ship="${sh.id}"><span class="ob-flag" title="${i ? '' : '旗艦（任務群の先頭）'}">${i ? '' : '旗'}</span><input class="ob-name" data-obname="ship" value="${esc(sh.name)}" aria-label="艦名" maxlength="28"><small class="ob-cls">${d ? `${esc(voyShort(d.name))} · ${fLen(d.info.len)} · 乗員 ${num(dem.people)}` : '準備中…'}</small>
    <button type="button" class="ve-orbat${st && st.short ? ' warn' : ''}" data-ob="air"><span>航空</span><b>${air.n ? `${num(air.n)} 機` : d?.info.slotCap || d?.info.hangarCap ? '未搭載' : '—'}${sh.carried?.length ? ` ＋艦 ${sh.carried.length}` : ''}${st && st.short ? ` · ${num(st.short)} 入らず` : ''}</b></button><button type="button" class="ve-orbat" data-ob="ground"><span>陸戦</span><b>${troops ? `${num(troops)} ${voy.setup.own === 'cis' ? '体' : '名'}` : R.troopRoom(d?.info || {}, voy.setup.own) ? '未乗艦' : '—'}</b></button>
    <label class="ob-move">所属<select data-obmove>${tgs.map(x => `<option value="${x.id}" ${x.id === tg.id ? 'selected' : ''} ${x.id !== tg.id && x.ships.length >= TG_MAX ? 'disabled' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <span class="ob-ord">${i ? `<button type="button" class="btn sm ghost" data-ob="lead" title="任務群の先頭（旗艦）にする">旗艦に</button>` : ''}<button type="button" class="btn sm ghost" data-ob="shipdel" aria-label="艦を外す">×</button></span></li>`; }).join('') || '<li class="muted">艦がありません</li>'}</ul>
  <div class="voy-add"><select data-obadd aria-label="追加する艦">${voyDesignOptions(s.own)}</select><button type="button" class="btn sm" data-ob="shipadd" ${full ? 'disabled' : ''}>${full ? `${TG_MAX}隻まで` : '艦を追加'}</button></div></div>`;
}
function voySortieHTML(s, ob) {
 const cap = VOY_SCALES[s.scale], ships = voySortieShips(s), t = voyShipsTotals(ships), foe = voyObShips(voyFoeOrbat(s)), a = voyShipsStrength(ships), b = voyShipsStrength(foe), r = a > 0 ? b / a : 0;
 const word = !a ? '' : r > 1.4 ? '敵が優勢' : r > 1.15 ? '敵がやや優勢' : r < .7 ? '自軍が優勢' : r < .87 ? '自軍がやや優勢' : 'ほぼ互角', reg = R.REGIONS[s.region] || R.REGIONS.kuat;
 return `<section class="voy-card"><h3>陣営と戦域</h3>
   <div class="voy-row"><label>自軍<select data-voyset="own">${voyFactionOptions(s.own)}</select></label><label>敵軍<select data-voyset="foe">${voyFactionOptions(s.foe)}</select></label><label>戦域<select data-voyset="region">${Object.entries(R.REGIONS).map(([k, v]) => `<option value="${k}" ${k === s.region ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label><label>編成枠<select data-voyset="scale">${Object.entries(VOY_SCALES).map(([k, v]) => `<option value="${k}" ${k === s.scale ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label><label>敵の戦力<select data-voyset="foeMode"><option value="match" ${s.foeMode !== 'same' ? 'selected' : ''}>自軍と同等</option><option value="same" ${s.foeMode === 'same' ? 'selected' : ''}>同じ編成枠</option></select></label></div>
   <p class="note">${esc(reg.note)}（${esc(reg.routes.map(x => x.name).join('・'))}）。航路は主要幹線と、そこから分かれる支線だけ。艦隊は航路に沿ってジャンプし、幹線は速く、支線は遅く進みます。敵（AI）は${s.foeMode === 'same' ? '同じ編成枠（乗員数・資材）で' : '自軍とほぼ同じ推定戦力になるよう'}編成されます。</p>${[...new Set([s.own, s.foe])].map(f => R.DOCTRINE[f] ? `<p class="note"><b>${esc(R.FACTIONS[f].name)}のドクトリン：${esc(R.DOCTRINE[f].name)}</b>。自動交戦の艦はシールドの残る敵にイオン砲を集中し、爆撃機の飛行隊はシールドが落ちた艦だけを攻撃します。</p>` : '').join('')}</section>
  <section class="voy-card"><h3>編成枠</h3>
   <div class="vbal"><span>推定戦力比</span><b>自軍 1 : 敵 ${a ? (r > 0 && r < .01 ? '0.01未満' : r.toFixed(2)) : '—'}</b><small>${esc(word)}（敵は${esc(R.FACTIONS[s.foe].name)}の艦 ${foe.length} 隻）${s.foeMode !== 'same' && a && r < .85 ? `。${esc(R.FACTIONS[s.foe].name)}は出せる限りの艦（片軍 ${VOY_SHIP_CAP} 隻まで）でも自軍に届きません` : ''}</small></div>
   ${voyBar('総乗員数（乗組員・操縦士・陸戦隊）', t.people, cap.people)}${voyBar('資材（補給品・予備品）', t.supply, cap.supply, x => num(Math.round(x)) + ' t')}
   <p class="note">艦数の上限はありません。枠は乗員数と資材だけです（計算の都合で一度に出せるのは片軍 ${VOY_SHIP_CAP} 隻まで）。出撃させる任務群を下で選びます。</p>${ships.some(sh => !voyShipDesign(sh)) ? `<p class="note bad">設計を準備できない艦 ${ships.filter(sh => !voyShipDesign(sh)).length} 隻は出撃しません${voy.pending.size ? '（準備中）' : ''}。</p>` : ''}${ships.length > VOY_SHIP_CAP ? `<p class="note bad">${ships.length} 隻は多すぎます。任務群を減らしてください。</p>` : ''}</section>
  <section class="voy-card voy-wide"><div class="voy-card-head"><h3>出撃させる任務群</h3><div class="vs-acts"><button type="button" class="btn sm ghost" data-voy="selall">すべて選ぶ</button><button type="button" class="btn sm ghost" data-voy="tab:orbat">編成を変える</button></div></div>
   ${ob.ctgs.map(c => `<div class="ob-pick"><label class="ob-pick-ctg"><input type="checkbox" data-pickctg="${c.id}" ${c.tgs.every(x => s.sel[x.id] !== false) ? 'checked' : ''}><b>${esc(c.name)}</b></label><div class="ob-pick-tgs">${c.tgs.map(x => { const tt = voyShipsTotals(x.ships); return `<label class="ob-pick-tg"><input type="checkbox" data-picktg="${x.id}" ${s.sel[x.id] !== false ? 'checked' : ''}><span><b>${esc(x.name)}</b><small>${x.ships.length} 隻 · ${esc(R.FORMATIONS[x.formation] || '')} · 乗員 ${num(tt.people)} · ${esc(x.ships.map(sh => sh.name).slice(0, 4).join('・'))}${x.ships.length > 4 ? ' ほか' : ''}</small></span></label>`; }).join('')}</div></div>`).join('') || '<p class="muted">編成がありません。「艦隊編成」で作ってください。</p>'}</section>`;
}
// ---- the order of battle of one ship (air wing and embarked troops) ----
function voyFindShip(id) { const ob = voyOb(voy.setup.own); for (const c of ob.ctgs) for (const t of c.tgs) for (const sh of t.ships) if (sh.id === id) return {ob, c, t, sh}; return null; }
function voyOrbatSheet() {
 const s = voy.setup, f = s.editing && voyFindShip(s.editing);if (!f) { $('#voySheet').hidden = true; return; }
 const e = f.sh, d = voyShipDesign(e), tab = s.sheetTab, el = $('#voySheet');if (!d) { el.hidden = true; return; }el.hidden = false;
 let body = '';
 const stow = voyHasStow(d) ? voyStow(e, d) : null;
 if (tab === 'air') {
  const air = R.airTotals(e.air), cap = d.info.slotCap || 0, wings = [...new Set(e.air.map(q => q.wingNo || 1))].sort((a, b) => a - b);
  const sqStatus = i => { const r = stow?.wings[i];if (!r) return '';const c = R.CRAFT[e.air[i].craft];return `<small class="vo-fit${r.unembarked || r.undeployable ? ' bad' : ''}">${r.tooLarge ? '入る格納区画なし' : r.unembarked ? `${num(r.embarked)} 機だけ搭載（${num(r.unembarked)} 機入らず）` : r.undeployable ? `${num(r.undeployable)} 機はハッチを通れず発艦不可` : c?.stay ? '輸送機（艦隊戦では艦内に待機）' : '搭載・発艦可'}</small>`; };
  body = `${stow ? voyBar('格納庫（機体・搭載艦・車両で共用）', stow.used, stow.capacity, x => num(x, 1)) : voyBar('格納庫（機体の大きさの合計）', air.size, Math.max(0, (d.info.hangarCap || cap) - voyCarriedSize(e)), x => num(x, 1))}
  ${wings.map(wn => `<div class="vo-wing"><h4>第${wn}飛行隊</h4>${e.air.map((q, i) => (q.wingNo || 1) !== wn ? '' : `<div class="vo-sq"><select data-sq="${i}" data-sqk="craft">${Object.entries(R.CRAFT).map(([k, c]) => `<option value="${k}" ${k === q.craft ? 'selected' : ''}>${esc(c.name)}（${R.ROLE_NAME[c.role]}）</option>`).join('')}</select><label>機数<input type="number" data-sq="${i}" data-sqk="n" value="${q.n}" min="1" max="${R.RULES.maxSquadSize}"></label><label>飛行隊<input type="number" data-sq="${i}" data-sqk="wingNo" value="${q.wingNo || 1}" min="1" max="99"></label><button type="button" class="btn sm ghost" data-sqdel="${i}" aria-label="中隊を外す">×</button>${sqStatus(i)}</div>`).join('')}</div>`).join('') || '<p class="muted">中隊がありません。</p>'}
  <div class="voy-row"><button type="button" class="btn sm" data-vo="sqadd">中隊を追加</button><button type="button" class="btn sm ghost" data-vo="airdefault">標準の搭載に戻す</button><button type="button" class="btn sm ghost" data-vo="airclear">すべて降ろす</button></div>
  <p class="note">中隊は同じ機種12機が基本（大型キャリアは最大${R.RULES.maxSquadSize}機）。飛行隊の番号で中隊をまとめ、戦闘では飛行隊ごとに発艦・移動・攻撃・帰還します。機体は公式の寸法で、格納区画の内寸に入るか、ハッチを通れるかで搭載・発艦が決まります（設計画面と同じ判定）。シャトル・揚陸艇は地上部隊を降ろす輸送機で、艦隊戦では艦内に待機します。</p>${voyCarriedEditHTML(e, d)}`;
 } else {
  const gs = (e.ground || []).map(r => R.regimentTotals(r)), troops = gs.reduce((n, x) => n + x.troops, 0), veh = gs.reduce((n, x) => n + x.size, 0), L = stow?.lift;
  const vehRows = stow ? stow.vehicles.map(v => `<li class="${v.unembarked || !v.landable ? 'bad' : ''}"><b>${esc(v.name)}</b> ${num(v.embarked)} / ${num(v.count)} 両${v.loaded ? `（輸送機に ${num(v.loaded)}）` : ''}${v.unembarked ? ` · ${num(v.unembarked)} 両入らず` : ''}${v.embarked && !v.landable ? ' · 積める輸送機なし' : ''}</li>`).join('') : '';
  body = `${voy.setup.own === 'cis' ? voyBar('ドロイド格納（空き容積）', troops, R.troopRoom(d.info, 'cis'), x => num(Math.round(x)) + ' 体') : voyBar('兵員枠（空き容積から定員を除く）', troops, R.troopRoom(d.info, voy.setup.own), x => num(Math.round(x)) + ' 名')}${stow ? `<div class="vo-wing"><h4>車両と降下</h4>${vehRows ? `<ul class="vo-veh-fit">${vehRows}</ul>` : '<p class="muted">車両はありません。</p>'}<p class="note">${L && L.transports.length ? `1回の降下：兵員 ${num(L.troops)} 名${L.vehicleSize > 0 ? `・車両 ${num(L.vehicleSize, 1)} サイズ` : ''}（${Object.entries(L.transports.reduce((m, x) => { const k = R.CRAFT[x.type]?.name || x.name || x.type; m[k] = (m[k] || 0) + x.n; return m; }, {})).map(([k, n]) => `${esc(k)} ${num(n)} 機`).join('・')}）` : '輸送機（シャトル・揚陸艇）が搭載されていません。地上部隊は輸送機で降ろします（「航空隊」で輸送機の中隊を加えてください）。'}</p></div>` : voyBar('車両（車両区画・貨物区画）', veh, d.info.vehicleCap || 0, x => num(x, 1))}
  ${(e.ground || []).map((r, ri) => { const t = R.regimentTotals(r); return `<details class="vo-reg"><summary><b>${esc(r.name)}</b><span>${num(t.troops)} 名${Object.keys(t.vehicles).length ? ' · ' + Object.entries(t.vehicles).map(([k, n]) => `${R.VEHICLES[k]?.name || k} ${n}`).join('・') : ''}</span><button type="button" class="btn sm ghost" data-regdel="${ri}" aria-label="連隊を外す">×</button></summary>
   ${r.battalions.map((b, bi) => `<div class="vo-bat"><h5>${esc(b.name)}</h5>${b.companies.map((c, ci) => `<div class="vo-co"><span>${esc(c.name)}</span><label>兵員<input type="number" data-co="${ri}.${bi}.${ci}" data-cok="troops" value="${c.troops}" min="0" max="600"></label>${voyVehicleSelect(ri, bi, ci, c, voy.setup.own)}</div>`).join('')}</div>`).join('')}</details>`; }).join('') || '<p class="muted">連隊がありません。</p>'}
  <div class="voy-row"><button type="button" class="btn sm" data-vo="regadd">連隊を追加（${esc(R.REGIMENT_TEMPLATES[voy.setup.own]?.name || '連隊')}）</button><button type="button" class="btn sm ghost" data-vo="grclear">すべて降ろす</button></div>
  <p class="note">連隊は4個大隊、大隊は4個中隊（144名）。乗艦した陸戦隊は拿捕のときに移乗攻撃の兵力になります。車両は輸送機の積載区画か格納庫（航空機と共用）に寸法で入ります。</p>`;
 }
 el.innerHTML = `<div class="voy-sheet-card" role="dialog" aria-label="編成の詳細"><div class="voy-sheet-head"><div><span class="eyebrow">${esc(e.name)} · ${esc(voyShort(d.name))}</span><h3>${tab === 'air' ? '航空隊・搭載艦' : '陸戦隊'}の編成</h3></div><div class="seg" role="group"><button type="button" data-vo="tab:air" aria-pressed="${tab === 'air'}">航空隊</button><button type="button" data-vo="tab:ground" aria-pressed="${tab === 'ground'}">陸戦隊</button></div><button type="button" class="btn sm" data-vo="close">閉じる</button></div><div class="voy-sheet-body">${body}</div></div>`;
}
// The small ships this carrier takes into battle: any design whose hull fits one of its bays.
function voyCarriedEditHTML(e, d) {
 const room = voyCarryRoom(e, d), used = voyCarriedSize(e), cand = voyExampleDesigns().filter(x => voyServes(x, voy.setup.own)).map(x => ({x, fit: voyCarryFit(d, x)})).filter(o => o.fit.ok).sort((a, b) => a.fit.size - b.fit.size);
 const rows = (e.carried || []).map((c, i) => { const d2 = voyShipDesign(c), f = d2 ? voyCarryFit(d, d2) : null; return `<div class="vo-sq"><span><b>${esc(c.name)}</b> <small>${d2 ? `${num(Math.round(f.dims[0]))} × ${num(Math.round(f.dims[1]))} × ${num(Math.round(f.dims[2]))} m · サイズ ${num(f.size, 1)}` : '設計なし'}</small></span><button type="button" class="btn sm ghost" data-cardel="${i}" aria-label="搭載艦を降ろす">×</button></div>`; }).join('');
 return `<div class="vo-wing vo-carried"><h4>搭載艦艇</h4>${voyBar('搭載艦の格納（艦の大きさの合計）', used, room, x => num(x, 1))}${rows || '<p class="muted">搭載艦はありません。</p>'}
  ${cand.length ? `<div class="voy-row"><select id="voyCarrySel" aria-label="搭載する艦">${cand.map(o => `<option value="${esc(o.x.key)}" ${used + o.fit.size > room + 1e-6 ? 'disabled' : ''}>${esc(voyShort(o.x.name))}（サイズ ${num(o.fit.size, 1)}）</option>`).join('')}</select><button type="button" class="btn sm" data-vo="caradd">艦を搭載</button></div>` : `<p class="note">${(d.info?.bays || []).length ? 'この艦の格納区画に入る艦がありません。' : 'この艦には格納区画がありません。'}</p>`}
  <p class="note">格納区画に全長・全幅・全高とも ${C.SHIP_STOW_CLEAR} m の余裕をもって入る艦を、艦載機と同じ「サイズ」で積めます（艦の外形の容積 × ${C.SHIP_STOW_FACTOR} ÷ 艦載機1機分の格納容積）。戦闘が始まると発進して任務群に加わり、ジャンプの前に近くにいれば収容されます。</p></div>`;
}
function voyVehicleSelect(ri, bi, ci, c, faction) {
 const ks = Object.entries(R.VEHICLES).filter(([, v]) => v.side === 'any' || v.side === faction || faction === 'empire' && v.side === 'empire').map(([k]) => k);
 return `<span class="vo-veh">${ks.map(k => `<label title="${esc(R.VEHICLES[k].note)}">${esc(R.VEHICLES[k].name)}<input type="number" data-co="${ri}.${bi}.${ci}" data-cov="${k}" value="${c.vehicles?.[k] || 0}" min="0" max="40"></label>`).join('')}</span>`;
}
function voyObChanged(render = true) { voyOrbatSave(); if (render) voyRenderSetup(); }
async function voyObAddShip(t, src) {
 const s = voy.setup, ob = voyOb(s.own);if (t.ships.length >= TG_MAX) { toast(`任務群は${TG_MAX}隻までです`); return; }
 const d = await voyPrepare(src), used = new Set(voyObShips(ob).map(x => x.name));
 t.ships.push({id: voyUid(ob), src, key: d.key, name: voyNextName(s.own, used), air: R.defaultAir(d.info, s.own, d.air), ground: [], carried: voyDefaultCarried(d)});voyObChanged();
}
function voyBindSetup() {
 const root = $('#voyage');
 root.addEventListener('change', e => {
  const t = e.target, s = voy.setup;if (!s || voy.screen !== 'setup' && !t.closest('#voySheet')) return;const ob = voyOb(s.own);
  if (t.dataset.voyset) { const k = t.dataset.voyset; s[k] = t.value; if (k === 'own') { s.sel = {}; voyEnsureDesigns(voyOb(s.own)); s.foe = voyDefaultFoe(s); } voyRenderSetup(); return; }
  if (t.dataset.obname != null) { const v = t.value.trim().slice(0, 28); if (!v) { voyRenderSetup(); return; } const kind = t.dataset.obname, el = t.closest(kind === 'ctg' ? '[data-ctg]' : kind === 'tg' ? '[data-tg]' : '[data-ship]'); if (kind === 'ctg') { const c = ob.ctgs.find(x => x.id === el.dataset.ctg); if (c) c.name = v; } else if (kind === 'tg') { const x = voyObTgs(ob).find(q => q.id === el.dataset.tg); if (x) x.name = v; } else { const f = voyFindShip(el.dataset.ship); if (f) f.sh.name = v; } voyObChanged(false); return; }
  if ('obform' in t.dataset) { const x = voyObTgs(ob).find(q => q.id === t.closest('[data-tg]').dataset.tg); if (x && R.FORMATIONS[t.value]) x.formation = t.value; voyObChanged(false); return; }
  if ('obmove' in t.dataset) { const f = voyFindShip(t.closest('[data-ship]').dataset.ship), to = voyObTgs(ob).find(q => q.id === t.value); if (f && to && to !== f.t && to.ships.length < TG_MAX) { f.t.ships.splice(f.t.ships.indexOf(f.sh), 1); to.ships.push(f.sh); } voyObChanged(); return; }
  if (t.dataset.pickctg) { const c = ob.ctgs.find(x => x.id === t.dataset.pickctg); if (c) for (const x of c.tgs) s.sel[x.id] = t.checked; voyRenderSetup(); return; }
  if (t.dataset.picktg) { s.sel[t.dataset.picktg] = t.checked; voyRenderSetup(); return; }
  if (t.dataset.sq != null) { const f = voyFindShip(s.editing), q = f?.sh.air[+t.dataset.sq]; if (!q) return; const k = t.dataset.sqk; if (k === 'craft') q.craft = t.value; else q[k] = C.clamp(Math.round(+t.value || 1), 1, k === 'n' ? R.RULES.maxSquadSize : 99); if (k === 'craft') { const c = R.CRAFT[q.craft]; q.name = `${R.ROLE_NAME[c.role]}中隊`; } voyOrbatSheet(); voyObChanged(); return; }
  if (t.dataset.co) { const f = voyFindShip(s.editing), [ri, bi, ci] = t.dataset.co.split('.').map(Number), c = f?.sh.ground?.[ri]?.battalions?.[bi]?.companies?.[ci]; if (!c) return; if (t.dataset.cok) c.troops = C.clamp(Math.round(+t.value || 0), 0, 600); else { c.vehicles = c.vehicles || {}; c.vehicles[t.dataset.cov] = C.clamp(Math.round(+t.value || 0), 0, 40); } voyOrbatSheet(); voyObChanged(); return; }
 });
 root.addEventListener('click', async e => {
  const b = e.target.closest('button');if (!b || b.disabled) return;const s = voy.setup, d = b.dataset;if (!s) return;
  if (d.voy === 'back') { voyClose(); showTitle('voyage'); return; }
  if (d.voy?.startsWith('tab:')) { s.tab = d.voy.slice(4); voyRenderSetup(); return; }
  if (d.voy === 'auto') { voy.orbat.factions[s.own] = voyAutoOrbat(s.own, s.scale, Math.random, {cap: 48}); s.sel = {}; voyObChanged(); return; }
  if (d.voy === 'ctgadd') { const ob = voyOb(s.own), n = ob.ctgs.length + 1; ob.ctgs.push({id: voyUid(ob), name: `第${n}合同任務群`, tgs: [{id: voyUid(ob), name: `第${n}1任務群`, formation: 'abreast', ships: []}]}); voyObChanged(); return; }
  if (d.voy === 'selall') { s.sel = {}; voyRenderSetup(); return; }
  if (d.voy === 'start') { voyStartBattle(); return; }
  if (d.ob) {
   const ob = voyOb(s.own), ce = b.closest('[data-ctg]'), te = b.closest('[data-tg]'), se = b.closest('[data-ship]'), c = ce && ob.ctgs.find(x => x.id === ce.dataset.ctg), t = te && voyObTgs(ob).find(x => x.id === te.dataset.tg), f = se && voyFindShip(se.dataset.ship);
   if (d.ob === 'tgadd' && c) { const n = ob.ctgs.indexOf(c) + 1; c.tgs.push({id: voyUid(ob), name: `第${n}${c.tgs.length + 1}任務群`, formation: 'abreast', ships: []}); }
   else if (d.ob === 'ctgdel' && c) { if (c.tgs.some(x => x.ships.length) && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '解散する'; return; } ob.ctgs.splice(ob.ctgs.indexOf(c), 1); }
   else if (d.ob === 'tgdel' && t && c) { if (t.ships.length && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '解散する'; return; } c.tgs.splice(c.tgs.indexOf(t), 1); }
   else if (d.ob === 'shipadd' && t) { const src = te.querySelector('[data-obadd]').value; if (!src) return; b.disabled = true; b.textContent = '準備中…'; try { await voyObAddShip(t, src); } catch (err) { console.error(err); toast('艦を準備できません：' + esc(err.message || err)); voyRenderSetup(); } return; }
   else if (d.ob === 'shipdel' && f) f.t.ships.splice(f.t.ships.indexOf(f.sh), 1);
   else if (d.ob === 'lead' && f) { f.t.ships.splice(f.t.ships.indexOf(f.sh), 1); f.t.ships.unshift(f.sh); }
   else if ((d.ob === 'air' || d.ob === 'ground') && f) { s.editing = f.sh.id; s.sheetTab = d.ob; voyOrbatSheet(); return; }
   voyObChanged();return;
  }
  if (d.vo) { const f = s.editing && voyFindShip(s.editing), x = f?.sh, des = x && voyShipDesign(x);
   if (d.vo === 'close') { s.editing = null; $('#voySheet').hidden = true; voyRenderSetup(); return; }
   if (d.vo.startsWith('tab:')) { s.sheetTab = d.vo.slice(4); voyOrbatSheet(); return; }
   if (!x || !des) return;
   if (d.vo === 'sqadd') { const mix = R.CRAFT_MIX[s.own] || R.CRAFT_MIX.empire, last = x.air[x.air.length - 1], wn = last ? (x.air.filter(q => (q.wingNo || 1) === (last.wingNo || 1)).length >= 6 ? (last.wingNo || 1) + 1 : last.wingNo || 1) : 1, craft = mix[x.air.length % mix.length]; x.air.push({craft, n: 12, name: `${R.ROLE_NAME[R.CRAFT[craft].role]}中隊`, wingNo: wn}); }
   if (d.vo === 'airdefault') x.air = R.defaultAir(des.info, s.own, des.air);
   if (d.vo === 'airclear') x.air = [];
   if (d.vo === 'regadd') { const tpl = R.REGIMENT_TEMPLATES[s.own] || R.REGIMENT_TEMPLATES.empire; x.ground = x.ground || []; x.ground.push(R.makeRegiment(s.own, `第${x.ground.length + 1}${tpl.name}`)); }
   if (d.vo === 'grclear') x.ground = [];
   if (d.vo === 'caradd') { const d2 = voyDesign($('#voyCarrySel')?.value); if (!d2) return; const f = voyCarryFit(des, d2); if (!f.ok) { toast('格納区画に入りません'); return; } if (voyCarriedSize(x) + f.size > voyCarryRoom(x, des) + 1e-6) { toast('格納庫の空きが足りません'); return; } x.carried = x.carried || []; x.carried.push({src: d2.key, key: d2.key, name: `${voyShort(d2.name)} ${x.carried.length + 1}`}); }
   voyOrbatSheet(); voyObChanged(); return; }
  if (d.sqdel != null) { const f = voyFindShip(s.editing); if (f) f.sh.air.splice(+d.sqdel, 1); voyOrbatSheet(); voyObChanged(); return; }
  if (d.cardel != null) { const f = voyFindShip(s.editing); if (f?.sh.carried) f.sh.carried.splice(+d.cardel, 1); voyOrbatSheet(); voyObChanged(); return; }
  if (d.regdel != null) { e.preventDefault(); const f = voyFindShip(s.editing); if (f) f.sh.ground.splice(+d.regdel, 1); voyOrbatSheet(); voyObChanged(); return; }
 });
}

// ---------- starting a battle ----------
// The order of battle as the battle model takes it: combined task groups of task groups of ships.
function voyBattleOrbat(ob, tgs, faction) {
 const pick = new Set(tgs.map(t => t.id));
 return {ctgs: ob.ctgs.map(c => ({name: c.name, tgs: c.tgs.filter(t => pick.has(t.id) && t.ships.length).map(t => ({name: t.name, formation: t.formation, ships: t.ships.map(sh => { const d = voyShipDesign(sh);if (!d) return null;const st = voyHasStow(d) ? voyStow(sh, d) : null; return {design: d.key, name: sh.name, air: (sh.air || []).map((q, i) => ({...q, n: st ? Math.min(q.n, st.wings[i]?.deployable ?? q.n) : q.n, groupName: `${c.name}飛行団`})).filter(q => q.n > 0 && !R.CRAFT[q.craft]?.stay), ground: sh.ground || null, troops: (sh.ground || []).reduce((n, r) => n + R.regimentTotals(r).troops, 0), carried: (sh.carried || []).map((x, i) => { const d2 = voyShipDesign(x); return d2 && (!st || st.carried[i]?.embarked) ? {design: d2.key, name: `${sh.name}搭載艦 ${x.name}`} : null; }).filter(Boolean)}; }).filter(Boolean)}))})).filter(c => c.tgs.length)};
}
function voyStartBattle() {
 const s = voy.setup, ob = voyOb(s.own), mine = voySortieTgs(s), foeOb = voyFoeOrbat(s);
 const own = voyBattleOrbat(ob, mine, s.own), foe = voyBattleOrbat(foeOb, voyObTgs(foeOb), s.foe);
 const keys = [...new Set([own, foe].flatMap(o => o.ctgs.flatMap(c => c.tgs.flatMap(t => t.ships.flatMap(x => [x.design, ...(x.carried || []).map(y => y.design)])))))], designs = keys.map(voyDesign).filter(Boolean).map(d => ({key: d.key, name: d.name, p: d.p, info: d.info}));
 voy.w = R.createWorld({seed: s.seed, region: s.region, designs, sides: [{faction: s.own, ai: false}, {faction: s.foe, ai: true}], fleets: [own, foe]});voy.w.onHit = voyOnHit;
 voy.speed = 4;voy.seenEv = 0;voy.notes = [];voy.sel = {group: null, ctg: null, sys: null, dest: null, units: [], wing: null, foe: null};voy.cmd = null;voy.ops.fitted = false;voy.tac = {sys: null, c: [0, 0], mpp: 300, fitted: false};voy.result = null;voy.resultDismissed = false;
 const first = [...voy.w.ctgs.values()].find(c => c.side === 0);if (first) voy.sel.ctg = first.id;
 voyShow('ops');voyNote(`作戦開始：${voy.w.sector.name}。敵艦隊（${R.FACTIONS[s.foe].name}）の位置は不明です。任務群を航路に沿ってジャンプさせて探してください。`);
 s.seed = (Math.random() * 1e6) | 0;
 // The battle opens in 3D on our lead task group; the maps are under 「命令」.
 if (voyCan3D()) voyEnter3D().then(ok => { if (ok) toast('「命令」で作戦図・戦術図を開いて命令します'); voyWarm(keys); });else voyWarm(keys);
}
// The 3D models of every design in the battle are built in the background, so
// that flying a ship later does not wait for them.
async function voyWarm(keys) { for (const k of keys) { if (!voy.w) return; try { await fleetAsset(k); } catch (e) { console.warn('model not ready', k, e.message); } } }
function voyNote(text, sys) { const t = voy.w?.time || 0; if (voy.notes.some(n => n.text === text && t - n.t < 30)) return; voy.notes.unshift({t, text, sys}); voy.notes = voy.notes.slice(0, 6); voyRenderLog(); }

// ---------- the clock and the main loop ----------
function voyLoop(now) {
 const w = voy.w;if (!w || !voy.open || voy.screen === 'setup') { voy.last = now; return; }
 const real = voy.last ? Math.min(.1, (now - voy.last) / 1000) : 0;voy.last = now;
 if (!voy.loading) voyTick(real);
 voyDraw();
 if (now - (voy.hudAt || 0) > 250) { voy.hudAt = now; voyRenderHud(); voyRenderSide(true); }
}
// One step of the world on the shared clock, from the maps or from the 3D
// view: a battle of ours holds the clock at 16× or less.
function voyTick(real) {
 const w = voy.w;if (!w) return;
 const ours = [...w.battles.keys()].some(sys => R.systemUnits(w, sys).some(u => u.side === 0));if (ours && voy.speed > 16) { voy.speed = 16; voyRenderHud(); }
 voySim(w, real, voy.speed);
 voyEvents();
 if (w.result && !voy.result) voyShowResult();
}
// The world advances by as many ticks as fit in the frame's budget; when a big
// battle makes ticks dear, the clock runs slower than asked (shown in the HUD).
const VOY_SIM_MS = 14;
function voySim(w, real, speed) {
 if (!(speed > 0) || w.result || !(real > 0)) { voy.eff = speed; return; }
 const t0 = performance.now(), g0 = w.time, n = R.step(w, real * speed, voy.tickCap || 8), ms = performance.now() - t0;
 if (n > 0) voy.tickMs = voy.tickMs ? voy.tickMs * .9 + ms / n * .1 : ms / n;
 voy.tickCap = C.clamp(Math.floor(VOY_SIM_MS / Math.max(.02, voy.tickMs || 1)), 1, 600);
 voy.eff = (voy.eff ?? speed) * .96 + (w.time - g0) / real * .04;
}
// Events the player should hear about: contacts, battles, losses. A battle
// involving our ships slows the clock to real time.
function voyEvents() {
 const w = voy.w, ev = w.events;let i = ev.length;while (i > 0 && ev[i - 1].n > voy.seenEv) i--;
 for (; i < ev.length; i++) {
  // The battle's own blow-by-blow stays on the tactical map; losses come as world events.
  const e = ev[i];voy.seenEv = e.n;if (e.battle) sndVoyEvent(e);if (e.combat) continue;if (e.side != null && e.side !== 0 && !e.battle && !e.result && !e.sunk && !e.captured) continue;
  if (e.battle && !e.end && R.systemUnits(w, e.sys).some(u => u.side === 0)) { if (voy.speed > 1) voy.speed = 1; toast(`${esc(e.text)} — ${voy3D() && !voy.orders ? '「命令」の戦術図で' : '戦術図で'}指揮できます`); voy.battleAlert = e.sys; }
  voyNote((e.sunk && e.side != null && e.side !== 0 ? '敵 ' : '') + e.text, e.sys);
 }
}

// ---------- maps ----------
function voyMapResize() { const c = $('#voyMap'); if (!c) return; const r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); c.width = Math.max(1, Math.round(r.width * d)); c.height = Math.max(1, Math.round(r.height * d)); c._d = d; }
function voyDraw() {
 const c = $('#voyMap');if (!c || !voy.w) return;const r = c.getBoundingClientRect();if (Math.abs(r.width * (c._d || 1) - c.width) > 2 || Math.abs(r.height * (c._d || 1) - c.height) > 2) voyMapResize();
 const ctx = c.getContext('2d'), d = c._d || 1, W = c.width / d, H = c.height / d;ctx.setTransform(d, 0, 0, d, 0, 0);
 // Map lettering shrinks on short screens (phones held sideways).
 voy.fz = C.clamp(Math.min(H / 640, W / 900), .7, 1);
 if (voy.screen === 'tac') voyDrawTac(ctx, W, H); else voyDrawOps(ctx, W, H);
}
const VC = {own: '#7fd3ff', ownDim: '#4d8fae', foe: '#ff8a70', foeDim: '#a85a4a', sys: '#9aa8b4', major: '#e9eef2', grid: 'rgba(120,170,200,.10)', grid2: 'rgba(120,170,200,.22)', bg: '#05080c', battle: '#ffb85a', ink: '#dbe5e8', dim: '#7d8b95'};
const KIND_COLOR = {capital: '#ffe3a8', shipyard: '#bfe3ff', habitable: '#a6e3b0', industrial: '#d9c79b', outpost: '#c3c9cf', mining: '#c9b8a3', barren: '#6f7a83', gas: '#d8a978', ice: '#a9d3e8', nebula: '#b69bd6'};
// The part of the canvas not covered by the top bar and the side panel.
function voyFree(W, H) { const side = $('#voySide'), hud = $('#voyHud'), c = $('#voyMap').getBoundingClientRect(); let r = W, b = H, t = 0; if (side && !side.hidden) { const q = side.getBoundingClientRect(); if (q.width && q.height) { if (q.height > H * .6) r = Math.min(r, q.left - c.left - 8); else b = Math.min(b, q.top - c.top - 8 - 56); } } if (hud) t = hud.getBoundingClientRect().bottom - c.top; if (H < 500 && r < W) b = Math.min(b, H - 30); return {x0: 0, x1: Math.max(W * .35, r), y0: Math.max(0, t), y1: Math.max(H * .35, b)}; }
function voyOpsFit(W, H) { const o = voy.ops, S = voy.w.sector, f = voyFree(W, H), fw = f.x1 - f.x0, fh = f.y1 - f.y0;o.auto = true;o.y0 = f.y0;o.y1 = f.y1; o.k = Math.min(fw, fh) * .9 / S.size; o.c = [S.size / 2 - ((f.x0 + f.x1) / 2 - W / 2) / o.k, S.size / 2 - ((f.y0 + f.y1) / 2 - H / 2) / o.k]; o.fitted = true; }
// A map the player has not moved is fitted again when the bars around it change size
// (the top bar gains a row when a battle starts, the side panel grows or shrinks).
function voyFitStale(m, W, H) { if (!m.auto) return false; const f = voyFree(W, H); return Math.abs(f.y0 - m.y0) > 6 || Math.abs(f.y1 - m.y1) > 6; }
const opsP = (p, W, H) => { const o = voy.ops; return [W / 2 + (p[0] - o.c[0]) * o.k, H / 2 + (p[1] - o.c[1]) * o.k]; };
// ---- what is selected: a task group (任務群), a combined task group (合同任務群), or ships ----
const voyLive = g => !!g && g.units.some(id => R.alive(voy.w.units.get(id)));
const voyGroupIn = (g, sys) => g.units.some(id => { const u = voy.w.units.get(id); return R.alive(u) && u.sys === sys; });
function voyCtgGroups(c) { return c ? c.tgs.map(id => voy.w.groups.get(id)).filter(g => g && voyLive(g)) : []; }
function voySelGroup() { const g = voy.sel.group && voy.w?.groups.get(voy.sel.group); return g && g.side === 0 && voyLive(g) ? g : null; }
function voySelCtg() { const c = voy.sel.ctg && voy.w?.ctgs.get(voy.sel.ctg); return c && c.side === 0 && voyCtgGroups(c).length ? c : null; }
function voySelect(o) {
 const w = voy.w;voy.sel.units = [];voy.sel.dest = null;voy.sel.sys = null;voy.split = false;voy.cmd = null;
 if (o.group) { const g = w.groups.get(o.group); voy.sel.group = o.group; voy.sel.ctg = g ? R.ctgOf(w, g)?.id || null : null; }
 else { voy.sel.group = null; voy.sel.ctg = o.ctg || null; }
}
// On the tactical map: ships when ships are picked, else the task group, else the combined task group (those of it in the system).
function voyTacSel() {
 const w = voy.w, sys = voy.tac.sys, units = voy.sel.units.map(id => w.units.get(id)).filter(u => u && R.alive(u) && u.side === 0 && u.sys === sys);
 if (units.length) return {kind: 'ship', units};
 const g = voySelGroup();if (g && voyGroupIn(g, sys)) return {kind: 'tg', g};
 const c = voySelCtg();if (c && voyCtgGroups(c).some(x => voyGroupIn(x, sys))) return {kind: 'ctg', c};
 return {kind: null};
}
function voySelUnits(s) {
 const w = voy.w, sys = voy.tac.sys, of = g => g.units.map(id => w.units.get(id)).filter(u => R.alive(u) && u.sys === sys);
 return s.kind === 'ship' ? s.units : s.kind === 'tg' ? of(s.g) : s.kind === 'ctg' ? voyCtgGroups(s.c).flatMap(of) : [];
}
const voyTgShort = n => String(n || '').replace(/合同任務群$/, 'CTG').replace(/任務群$/, 'TG').replace(/^第/, '');
function voyGroupPos(g) { return R.groupMapPos(voy.w, g); }
// Where a lane from p (inside the square) toward q leaves the square.
function voyEdgeHit(S, p, q) { let t = 1; for (const i of [0, 1]) { const d = q[i] - p[i]; if (!d) continue; if (q[i] > S.size) t = Math.min(t, (S.size - p[i]) / d); if (q[i] < 0) t = Math.min(t, -p[i] / d); } return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
const voyPoly = (ctx, P, pts) => { ctx.beginPath(); pts.forEach((p, i) => { const q = P(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); };
function voyDrawOps(ctx, W, H) {
 const w = voy.w, S = w.sector, me = w.sides[0];if (!voy.ops.fitted || voyFitStale(voy.ops, W, H)) voyOpsFit(W, H);
 const P = p => opsP(p, W, H), k = voy.ops.k, now = performance.now() / 1000, font = getComputedStyle(document.body).fontFamily, label = voyLabeler(ctx, W), names = [], fz = voy.fz, fr = voyFree(W, H);
 ctx.fillStyle = VC.bg;ctx.fillRect(0, 0, W, H);
 // Grid: the square of the galaxy map (500 light years a side) with 50-ly lines.
 const a = P([0, 0]), b = P([S.size, S.size]);ctx.lineWidth = 1;
 for (let i = 0; i <= 10; i++) { const x = a[0] + (b[0] - a[0]) * i / 10, y = a[1] + (b[1] - a[1]) * i / 10; ctx.strokeStyle = i % 10 ? VC.grid : VC.grid2; ctx.beginPath(); ctx.moveTo(x, a[1]); ctx.lineTo(x, b[1]); ctx.moveTo(a[0], y); ctx.lineTo(b[0], y); ctx.stroke(); }
 ctx.fillStyle = 'rgba(160,200,220,.45)';ctx.font = `600 ${(11 * fz).toFixed(1)}px ${font}`;if (a[1] - 6 > fr.y0 + 10) ctx.fillText(`グリッド ${S.grid} · ${S.name}　一辺 ${S.size} 光年 · 1目盛 ${S.size / 10} 光年`, a[0] + 6, a[1] - 6);
 // Neighbouring squares, named as on the galaxy map.
 ctx.fillStyle = 'rgba(160,200,220,.22)';for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const col = R.GRID_COLS[S.col + dx], row = S.row + dy; if (!col || row < 1) continue; const q = P([S.size * (.5 + dx * .62), S.size * (.5 + dy * .62)]); ctx.fillText(`${col}-${row}`, C.clamp(q[0] - 14, 4, W - 40), C.clamp(q[1], 14, H - 4)); }
 // Lanes: the branch lines, then the main trunk (the white line of the galaxy map), which runs
 // on past the square toward the regions it leads to.
 ctx.lineCap = 'round';ctx.lineJoin = 'round';ctx.strokeStyle = 'rgba(140,175,195,.34)';ctx.lineWidth = 1.2;ctx.beginPath();
 for (const e of S.edges) if (e.kind === 'branch') { const p = P(S.systems[e.a].pos), q = P(S.systems[e.b].pos); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
 ctx.stroke();
 const exits = [];
 for (const r of S.routes) {
  const pts = r.nodes.map(id => S.systems[id].pos);if (!pts.length) continue;
  ctx.strokeStyle = 'rgba(236,244,248,.8)';ctx.lineWidth = 2.6;voyPoly(ctx, P, pts);
  ctx.setLineDash([5, 6]);ctx.lineWidth = 2;ctx.strokeStyle = 'rgba(236,244,248,.42)';
  for (const [o, n, name] of [[r.pts[0], pts[0], r.ends[0]], [r.pts[r.pts.length - 1], pts[pts.length - 1], r.ends[1]]]) { if (Math.hypot(o[0] - n[0], o[1] - n[1]) < 1) continue; voyPoly(ctx, P, [n, o]); if (name) exits.push({name, at: P(voyEdgeHit(S, n, o))}); }
  ctx.setLineDash([]);
 }
 // Each route's name along its longest stretch on screen.
 ctx.font = `600 ${(10.5 * fz).toFixed(1)}px ${font}`;
 for (const r of S.routes) {
  let best = null, bl = 0;for (let i = 1; i < r.nodes.length; i++) { const p = P(S.systems[r.nodes[i - 1]].pos), q = P(S.systems[r.nodes[i]].pos), l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; best = [p, q]; } }
  const text = `${r.name}（主要幹線）`, wd = ctx.measureText(text).width;if (!best || bl < wd * .8) continue;
  const [p, q] = best, mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;let ang = Math.atan2(q[1] - p[1], q[0] - p[0]);if (ang > Math.PI / 2) ang -= Math.PI;if (ang < -Math.PI / 2) ang += Math.PI;
  ctx.save();ctx.translate(mx, my);ctx.rotate(ang);ctx.fillStyle = 'rgba(236,244,248,.62)';ctx.fillText(text, -wd / 2, -7);ctx.restore();
  const cs = Math.abs(Math.cos(ang)), sn = Math.abs(Math.sin(ang)), hw = (wd * cs + 16 * sn) / 2, hh = (wd * sn + 16 * cs) / 2;label.block(mx - hw, my - hh, mx + hw, my + hh);
 }
 // Supply lines: from home along the lanes to each system where our ships are; cut ones crossed out.
 const sup = me.supply;
 if (sup) {
  ctx.lineWidth = 3.2;const drawn = new Set();
  for (const h of w.groups.values()) { if (h.side !== 0 || h.sys == null || !voyLive(h)) continue; let x = h.sys; while (x != null && x >= 0) { const ln = sup.lines.get(x); if (!ln || ln.prev < 0) break; const key = x * 4096 + ln.prev; if (!drawn.has(key)) { drawn.add(key); const p = P(S.systems[x].pos), q = P(S.systems[ln.prev].pos); ctx.strokeStyle = `rgba(110,225,150,${(.18 + .3 * ln.eff).toFixed(2)})`; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); } x = ln.prev; } }
  ctx.lineWidth = 1.2;for (const hm of me.home) { const [x, y] = P(S.systems[hm].pos), ok = sup.lines.has(hm); ctx.strokeStyle = ok ? 'rgba(110,225,150,.75)' : 'rgba(255,120,100,.75)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  ctx.lineWidth = 1;
 }
 // The way the selected task group (or each group of the combined task group) would go.
 const g = voySelGroup(), c = g ? null : voySelCtg(), dest = voy.sel.dest;
 const prev = dest == null ? [] : (g ? [g] : voyCtgGroups(c)).filter(h => h.sys != null && h.sys !== dest && !h.transit);
 for (const h of prev) { const r = R.routePath(S, h.sys, dest); if (!r) continue; ctx.strokeStyle = 'rgba(127,211,255,.88)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); voyPoly(ctx, P, r.path.map(id => S.systems[id].pos)); ctx.setLineDash([]); }
 ctx.lineWidth = 1;
 // Our groups' courses: in hyperspace, spooling, or waiting to leave with their combined task group.
 for (const h of w.groups.values()) {
  if (h.side !== 0 || !voyLive(h)) continue;let pts = null;
  if (h.transit) pts = [R.groupMapPos(w, h), ...h.transit.legs.filter(l => w.time < l.t1).map(l => S.systems[l.b].pos)];
  else if (h.spool) pts = h.spool.route.path.map(id => S.systems[id].pos);
  else if (h.waitJump && h.sys != null) { const r = R.routePath(S, h.sys, h.waitJump.dest); if (r) pts = r.path.map(id => S.systems[id].pos); }
  if (!pts) continue;ctx.setLineDash([4, 4]);ctx.strokeStyle = h.spool?.blocked ? 'rgba(255,150,120,.65)' : 'rgba(127,211,255,.5)';ctx.lineWidth = 1.6;voyPoly(ctx, P, pts);ctx.setLineDash([]);ctx.lineWidth = 1;
 }
 // Systems.
 for (const s of S.systems) {
  const [x, y] = P(s.pos), r = s.major ? 6 : s.inhabited ? 4.2 : 2.6, seen = me.seen.has(s.id);
  ctx.globalAlpha = seen || s.inhabited ? 1 : .7;ctx.fillStyle = KIND_COLOR[s.kind] || VC.sys;ctx.beginPath();ctx.arc(x, y, r, 0, Math.PI * 2);ctx.fill();
  if (s.major) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke(); }
  if (voy.sel.sys === s.id || voy.sel.dest === s.id) { ctx.strokeStyle = VC.own; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
  if (s.major || s.inhabited || k > .9 || w.battles.has(s.id) || [...w.groups.values()].some(h => h.side === 0 && h.sys === s.id)) names.push({s, x, y, r});
  { const rr = voy.sel.sys === s.id || voy.sel.dest === s.id ? r + 9 : s.major ? r + 4 : r + 1; label.block(x - rr, y - rr, x + rr, y + rr); }
  ctx.globalAlpha = 1;
  if (w.battles.has(s.id)) { const pr = r + 9 + 4 * Math.sin(now * 5); ctx.strokeStyle = VC.battle; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
 }
 // Enemy contacts: a diamond where last seen, faded with age (the contacts at one system
 // shown together, as fresh as the latest); a dashed ring where a departure was heading.
 const bySys = new Map();
 for (const c2 of me.contacts.values()) {
  if (c2.transit) { const p = P(S.systems[c2.sys].pos); ctx.globalAlpha = C.clamp(1 - (w.time - c2.time) / R.RULES.contactTTL, .25, 1); ctx.strokeStyle = VC.foe; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(p[0], p[1], 12, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; continue; }
  const m = bySys.get(c2.sys);if (!m) bySys.set(c2.sys, {ships: c2.ships, exact: !!c2.exact, time: c2.time});else { m.ships += c2.ships; m.exact = m.exact && !!c2.exact; m.time = Math.max(m.time, c2.time); }
 }
 for (const [sys, c2] of bySys) {
  const age = w.time - c2.time, p = P(S.systems[sys].pos), q = [p[0] + 4, p[1] + 17 * fz];ctx.globalAlpha = C.clamp(1 - age / R.RULES.contactTTL, .25, 1);ctx.fillStyle = VC.foe;
  ctx.beginPath();ctx.moveTo(q[0], q[1] - 6);ctx.lineTo(q[0] + 6, q[1]);ctx.lineTo(q[0], q[1] + 6);ctx.lineTo(q[0] - 6, q[1]);ctx.closePath();ctx.fill();label.block(q[0] - 6, q[1] - 6, q[0] + 6, q[1] + 6);
  const n = c2.exact ? c2.ships : '約' + c2.ships, ago = age > 120 ? ` · ${Math.round(age / 60)}分前` : '';
  label([`敵 ${n} 隻${ago}`, `敵 ${n}${ago}`, `敵 ${n}`], wd => [[q[0] + 9, q[1] + 4], [q[0] - 9 - wd, q[1] + 4], [q[0] - wd / 2, q[1] + 18], [q[0] + 9, q[1] + 16], [q[0] - 9 - wd, q[1] + 16], [q[0] - wd / 2, q[1] - 9]], VC.foe, '700 10.5px ' + font, true);
  ctx.globalAlpha = 1;
 }
 // Our task groups: chevrons stacked above their system, or on their lane in hyperspace.
 const stack = new Map(), hot = h => voy.sel.group ? voy.sel.group === h.id : !!c && h.ctg === c.id;voy.opsMarks = [];
 for (const h of w.groups.values()) {
  if (h.side !== 0 || !voyLive(h)) continue;let [x, y] = P(R.groupMapPos(w, h));
  if (h.sys != null) { const n = stack.get(h.sys) || 0; stack.set(h.sys, n + 1); y -= (14 + n * 15) * fz; x -= 2; }
  const on = hot(h);ctx.fillStyle = on ? '#ffffff' : VC.own;ctx.strokeStyle = '#06222e';ctx.beginPath();ctx.moveTo(x - 7, y + 5);ctx.lineTo(x, y - 6);ctx.lineTo(x + 7, y + 5);ctx.lineTo(x, y + 1);ctx.closePath();ctx.fill();ctx.stroke();label.block(x - 7, y - 6, x + 7, y + 5);
  voy.opsMarks.push({g: h.id, x, y});
  if (h.sys != null && sup && !sup.lines.has(h.sys)) { ctx.strokeStyle = '#ff7b62'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y - 12); ctx.lineTo(x + 12, y - 6); ctx.moveTo(x + 12, y - 12); ctx.lineTo(x + 6, y - 6); ctx.stroke(); ctx.lineWidth = 1; }
  const ships = h.units.filter(id => R.alive(w.units.get(id))).length, tg = voyTgShort(h.name), tail = h.transit ? ` · ${voyClock(h.transit.t1 - w.time)}` : h.spool ? (h.spool.blocked ? ' · 発進停止' : ' · 発進準備') : h.waitJump ? ' · 出発待ち' : '';
  label([`${h.name} ${ships}隻${tail}`, `${tg} ${ships}隻${tail}`, `${tg} ${ships}`, tg], wd => [[x + 10, y + 4], [x - 10 - wd, y + 4], [x + 10, y - 9], [x - wd / 2, y - 11], [x - 10 - wd, y - 9], [x + 10, y + 16], [x - 10 - wd, y + 16]], on ? '#ffffff' : '#bfe9ff', '700 10.5px ' + font, true);
 }
 // System names where they fit: those with a battle, our forces or a selection first, then the major ones.
 const ours = new Set([...w.groups.values()].filter(h => h.side === 0 && h.sys != null).map(h => h.sys)), must = s => w.battles.has(s.id) || ours.has(s.id) || voy.sel.sys === s.id || voy.sel.dest === s.id;
 names.sort((p, q) => (must(q.s) - must(p.s)) || (q.s.major - p.s.major) || (q.s.inhabited - p.s.inhabited));
 for (const {s, x, y, r: r0} of names) { const r = voy.sel.sys === s.id || voy.sel.dest === s.id ? r0 + 8 : s.major ? r0 + 3 : r0; ctx.globalAlpha = me.seen.has(s.id) || s.inhabited ? 1 : .7; label(s.name, wd => [[x + r + 4, y + 4], [x - r - 4 - wd, y + 4], [x - wd / 2, y + r + 14], [x - wd / 2, y - r - 5], [x + r + 2, y + r + 12], [x - r - 2 - wd, y + r + 12], [x + r + 2, y - r - 3], [x - r - 2 - wd, y - r - 3]], s.major ? VC.major : s.inhabited ? '#c9d6dc' : '#7d8b95', (s.major || must(s) ? '700 12px ' : '500 10.5px ') + font, s.major || must(s)); ctx.globalAlpha = 1; }
 // Where the routes lead beyond the square.
 for (const e of exits) { const [x, y] = e.at; label([`${e.name} ▸`, e.name], wd => [[x + 6, y - 6], [x - wd - 6, y - 6], [x + 6, y + 14], [x - wd - 6, y + 14], [x - wd / 2, y - 8], [x - wd / 2, y + 16]], 'rgba(236,244,248,.72)', '600 11px ' + font, true); }
}
function voyClock(s) { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; }
// ---- tactical map: one system's battle, seen from above in kilometres ----
function voyTacFit(W, H) {
 const us = R.systemUnits(voy.w, voy.tac.sys);if (!us.length) { voy.tac.c = [0, 0]; voy.tac.mpp = 300; return; }
 let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];for (const u of us) { lo = [Math.min(lo[0], u.pos[0]), Math.min(lo[1], u.pos[2])]; hi = [Math.max(hi[0], u.pos[0]), Math.max(hi[1], u.pos[2])]; }
 const f = voyFree(W, H), fw = f.x1 - f.x0, fh = f.y1 - f.y0;voy.tac.auto = true;voy.tac.y0 = f.y0;voy.tac.y1 = f.y1;voy.tac.mpp = Math.max(40, Math.max((hi[0] - lo[0] + 30000) / fw, (hi[1] - lo[1] + 30000) / fh) * 1.05);
 voy.tac.c = [(lo[0] + hi[0]) / 2 - ((f.x0 + f.x1) / 2 - W / 2) * voy.tac.mpp, (lo[1] + hi[1]) / 2 - ((f.y0 + f.y1) / 2 - H / 2) * voy.tac.mpp];voy.tac.fitted = true;
}
const tacP = (p, W, H) => { const t = voy.tac; return [W / 2 + (p[0] - t.c[0]) / t.mpp, H / 2 + (p[2] - t.c[1]) / t.mpp]; };
// Labels that keep off each other: each tries its places in turn (a point,
// a list of points, or a function of the text width giving the list) and is
// left out where all are taken, unless forced. Marks can be blocked out too.
function voyLabeler(ctx, W = Infinity) {
 const boxes = [], overlap = b => { let a = 0; for (const q of boxes) { const dx = Math.min(b[2], q[2]) - Math.max(b[0], q[0]), dy = Math.min(b[3], q[3]) - Math.max(b[1], q[1]); if (dx > 0 && dy > 0) a += dx * dy; } return a; };
 // label(text, x, y, color, font, force) or label(text, places, color, font, force).
 // text may be a list of ever shorter forms: the first form that fits clear of
 // the other labels and markers at any of its places is drawn. When none fits,
 // a forced label uses its shortest form where it overlaps least.
 const label = (text, x, y, color, font, force) => {
  if (typeof x === 'function' || Array.isArray(x)) { force = font; font = color; color = y; }
  const fz = voy.fz || 1, forms = Array.isArray(text) ? text : [text];ctx.font = fz < 1 ? font.replace(/([\d.]+)px/, (m, n) => (n * fz).toFixed(1) + 'px') : font;
  const places = t => { const wdt = ctx.measureText(t).width, list = typeof x === 'function' ? x(wdt) : Array.isArray(x) ? x : [[x, y]]; return list.map(q => ({t, q, b: [q[0] - 1, q[1] - 11 * fz, q[0] + wdt + 1, q[1] + 3 * fz], ok: q[0] >= 2 && q[0] + wdt <= W - 2})); };
  let at = null;
  for (const t of forms) { at = places(t).find(c => c.ok && overlap(c.b) === 0); if (at) break; }
  if (!at) { if (!force) return false; const last = places(forms[forms.length - 1]), inside = last.filter(c => c.ok); at = inside.length ? inside.reduce((m, c) => overlap(c.b) < overlap(m.b) ? c : m) : last[0]; if (!at.ok) { const wdt = at.b[2] - at.b[0] - 2, q = [C.clamp(at.q[0], 2, Math.max(2, W - 2 - wdt)), at.q[1]]; at = {t: at.t, q, b: [q[0] - 1, at.b[1], q[0] + wdt + 1, at.b[3]]}; } }
  boxes.push(at.b);ctx.fillStyle = color;ctx.fillText(at.t, at.q[0], at.q[1]);return true;
 };
 label.block = (x0, y0, x1, y1) => boxes.push([x0, y0, x1, y1]);
 return label;
}
// The order of a ship or a task group's guide, drawn from it: a dashed line to the
// point it moves to, or to the ship it attacks (fainter when chosen by itself).
function voyOrderLine(ctx, P, from, o, byId, faint) {
 const a = P(from);
 if (o.type === 'move' && o.point) { const q = P(o.point); ctx.strokeStyle = 'rgba(127,211,255,.8)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, Math.PI * 2); ctx.stroke(); }
 else if (o.type === 'attack' && byId.get(o.target)) { const q = P(byId.get(o.target).pos); ctx.strokeStyle = faint ? 'rgba(255,190,110,.4)' : 'rgba(255,190,110,.85)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]); }
}
const voyTagSuffix = u => u.out ? (u.towedBy ? '（戦闘不能・被牽引）' : '（戦闘不能）') : u.jump ? (u.jump.blocked ? '（離脱準備・停止）' : '（離脱準備）') : u.tractor?.lock ? (u.tractor.mode === 'capture' ? `（拿捕 ${Math.round((u.tractor.progress || 0) * 100)}%）` : '（牽引中）') : u.manual ? '（操艦中）' : '';
// v21.2 Superweapon envelopes to scale, from the muzzle: the composite beam's narrow cone dead ahead, the hyper-ion
// cannon's fan square to its side, out to the weapon's range (weapons of one kind facing one way drawn once), ours
// and the enemy's (theirs fainter, in red, unless selected); brightest while a shot is ready or the beam holds,
// fainter while it charges, dashed while it cools. A ship picked on its own (or a selected enemy) has the weapon and
// its range named at the far edge, once per kind (returned, to be labelled after the ships' names).
function voyTacSwArcs(ctx, P, us, sel, shipSel, label, font) {
 const t = voy.tac, labs = [], named = new Set();
 for (const u of us) {
  if (!u.p.sw?.length || !u.sw?.length || u.dead || u.out) continue;const on = sel.has(u.id) || voy.sel.foe === u.id;
  const c = Math.cos(u.yaw), s = Math.sin(u.yaw), seen = new Set();
  u.p.sw.forEach(w => {
   const key = w.k + w.aim;if (seen.has(key)) return;seen.add(key);
   const K = C.SW_COMBAT[w.k], xs = u.p.sw.map((v, j) => v.k + v.aim === key ? u.sw[j] : null).filter(Boolean), hot = xs.some(x => x.st === 'ready' || x.st === 'beam'), cold = xs.every(x => x.st === 'cool' || x.st === 'down');
   const mz = w.mz || [0, 0, 0], a = P([u.pos[0] + c * mz[0] - s * mz[2], 0, u.pos[2] + s * mz[0] + c * mz[2]]), ang = u.yaw + (w.aim === 'bow' ? 0 : w.aim === 'port' ? -Math.PI / 2 : Math.PI / 2), r = K.range / t.mpp;
   const rgb = u.side !== 0 ? '255,92,80' : w.k === 'hion' ? '175,150,255' : '255,184,84', al = (hot ? .85 : cold ? .35 : .55) * (on ? 1 : u.side === 0 ? .75 : .55);
   ctx.beginPath();ctx.moveTo(a[0], a[1]);ctx.arc(a[0], a[1], r, ang - K.cone, ang + K.cone);ctx.closePath();
   ctx.fillStyle = `rgba(${rgb},${((hot ? .1 : .05) * (on ? 1.6 : 1)).toFixed(3)})`;ctx.fill();
   ctx.strokeStyle = `rgba(${rgb},${al.toFixed(2)})`;ctx.lineWidth = on ? 1.5 : 1;if (cold) ctx.setLineDash([4, 4]);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth = 1;
   const tag = u.side + w.k;if (on && (shipSel || u.side !== 0) && !named.has(tag)) { named.add(tag); const e = [a[0] + Math.cos(ang) * r, a[1] + Math.sin(ang) * r]; labs.push(() => label([`${K.name} · 射程 ${K.range / 1000} km`, `射程 ${K.range / 1000} km`], wd => [[e[0] + 6, e[1] + 4], [e[0] - wd - 6, e[1] + 4], [e[0] - wd / 2, e[1] - 8], [e[0] - wd / 2, e[1] + 16]], `rgba(${rgb},.95)`, '600 10.5px ' + font)); }
  });
 }
 return labs;
}
function voyDrawTac(ctx, W, H) {
 const w = voy.w, sys = voy.tac.sys, t = voy.tac;if (sys == null) return;if (!t.fitted || voyFitStale(t, W, H)) voyTacFit(W, H);const label = voyLabeler(ctx, W);
 const P = p => tacP(p, W, H), font = getComputedStyle(document.body).fontFamily, ts = voyTacSel(), sel = new Set(voySelUnits(ts).map(u => u.id)), shipSel = ts.kind === 'ship';
 ctx.fillStyle = VC.bg;ctx.fillRect(0, 0, W, H);
 // 10 km grid with a scale bar.
 const step = t.mpp * 90 > 20000 ? 50000 : t.mpp * 90 > 8000 ? 10000 : 5000, x0 = Math.floor((t.c[0] - W / 2 * t.mpp) / step) * step, z0 = Math.floor((t.c[1] - H / 2 * t.mpp) / step) * step;
 ctx.strokeStyle = VC.grid;ctx.lineWidth = 1;ctx.beginPath();for (let x = x0; x < t.c[0] + W / 2 * t.mpp; x += step) { const p = P([x, 0, 0]); ctx.moveTo(p[0], 0); ctx.lineTo(p[0], H); } for (let z = z0; z < t.c[1] + H / 2 * t.mpp; z += step) { const p = P([0, 0, z]); ctx.moveTo(0, p[1]); ctx.lineTo(W, p[1]); } ctx.stroke();
 // The scale sits at the top of the free area, clear of the log at the bottom.
 const fr = voyFree(W, H), sc = `1目盛 ${step / 1000} km`;ctx.fillStyle = 'rgba(160,200,220,.55)';ctx.font = `600 ${(11 * voy.fz).toFixed(1)}px ` + font;ctx.fillText(sc, 10, fr.y0 + 16 * voy.fz);label.block(8, fr.y0 + 2, 14 + ctx.measureText(sc).width, fr.y0 + 20 * voy.fz);
 // (ships whose turn to come out of hyperspace has not yet come are not there to see)
 const us = R.systemUnits(w, sys).filter(u => !R.pendingWarp(u)), byId = new Map(us.map(u => [u.id, u]));
 // Task groups: a faint line from each ship to its group's guide.
 const tgs = new Map();for (const u of us) { const g = w.groups.get(u.group); if (!g) continue; let a = tgs.get(g.id); if (!a) tgs.set(g.id, a = {g, m: []}); a.m.push(u); }
 for (const {g, m} of tgs.values()) { const guide = m.find(u => u.id === g.flag) || m[0], gp = P(guide.pos), own = g.side === 0, hot = own && m.some(u => sel.has(u.id)); ctx.strokeStyle = own ? (hot ? 'rgba(200,240,255,.42)' : 'rgba(127,211,255,.15)') : 'rgba(255,138,112,.13)'; ctx.lineWidth = 1; ctx.beginPath(); for (const u of m) { if (u === guide || u.towedBy) continue; const p = P(u.pos); ctx.moveTo(gp[0], gp[1]); ctx.lineTo(p[0], p[1]); } ctx.stroke(); }
 // Fire: thin lines from each ship to the one it is engaging.
 ctx.lineWidth = 1;for (const u of us) { const f = byId.get(u.firingAt); if (!f || u.out) continue; const a = P(u.pos), b = P(f.pos); ctx.strokeStyle = u.side === 0 ? 'rgba(127,255,170,.28)' : 'rgba(255,120,100,.3)'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
 // Tractor beams: a broad band from the projector to its charge, dashed while closing in.
 for (const u of us) { const tr = u.tractor, x = tr && byId.get(tr.target); if (!x) continue; const a = P(u.pos), b = P(x.pos); ctx.strokeStyle = tr.mode === 'capture' ? 'rgba(195,168,255,.8)' : 'rgba(150,255,200,.75)'; ctx.lineWidth = tr.lock ? 3.5 : 1.5; if (!tr.lock) ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }
 const swLabs = voyTacSwArcs(ctx, P, us, sel, shipSel, label, font);
 // The selection's orders: ships' own orders with their gun and point-defence reach, or each task group's from its guide.
 if (shipSel) for (const u of ts.units) { const a = P(u.pos); ctx.strokeStyle = 'rgba(127,211,255,.35)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(a[0], a[1], C.fleetReach(u.p) / t.mpp, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = 'rgba(160,255,160,.28)'; ctx.beginPath(); ctx.arc(a[0], a[1], R.RULES.pdRange / t.mpp, 0, Math.PI * 2); ctx.stroke(); voyOrderLine(ctx, P, u.pos, R.effectiveOrder(u, w), byId, u.order.type !== 'attack' && u.order.type !== 'move'); }
 else if (ts.kind) for (const g of ts.kind === 'tg' ? [ts.g] : voyCtgGroups(ts.c)) { const guide = byId.get(g.flag) || g.units.map(id => byId.get(id)).find(Boolean); if (guide) voyOrderLine(ctx, P, guide.pos, R.groupOrder(w, g), byId, g.order.type === 'auto'); }
 // v21 Superweapon shots: the composite beam (held, or one pulse) as a broad line to its target, the
 // hyper-ion wave as a ring spreading from the ship's side.
 // v21.2 Hyper-ion bolts in flight: the disc seen edge-on (its width to scale) with its path behind it.
 for (const b of w.ionBolts || []) { if (b.sys !== sys) continue; const c = [b.o[0] + b.dir[0] * b.x, b.o[1] + b.dir[1] * b.x, b.o[2] + b.dir[2] * b.x], pc = P(c), po = P(b.o), D = C.ionDiam(b.d, b.x) / t.mpp, h = Math.hypot(b.dir[0], b.dir[2]) || 1, nx = -b.dir[2] / h, nz = b.dir[0] / h, k = Math.max(.25, b.E / b.E0);
  ctx.strokeStyle = `rgba(170,150,255,${(.25 * k).toFixed(2)})`; ctx.lineWidth = Math.max(1, D * .3); ctx.beginPath(); ctx.moveTo(po[0], po[1]); ctx.lineTo(pc[0], pc[1]); ctx.stroke();
  ctx.strokeStyle = `rgba(205,185,255,${(.95 * k).toFixed(2)})`; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(pc[0] - nx * D / 2, pc[1] - nz * D / 2); ctx.lineTo(pc[0] + nx * D / 2, pc[1] + nz * D / 2); ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = `rgba(235,225,255,${(.9 * k).toFixed(2)})`; ctx.beginPath(); ctx.arc(pc[0], pc[1], Math.max(3, Math.min(10, D * .06)), 0, Math.PI * 2); ctx.fill(); }
 for (const x of w.swShots || []) {
  if (x.sys !== sys) continue;const a = byId.get(x.from), age = w.time - x.t;if (!a) continue;const pa = P(a.pos), ion = x.k === 'hion';
  if (x.mode === 'ring') { if (age > 2.2) continue; const r = Math.max(4, age * 16000 / t.mpp), al = 1 - age / 2.2; ctx.strokeStyle = `rgba(170,150,255,${(.85 * al).toFixed(2)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pa[0], pa[1], r, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; continue; }
  const life = x.mode === 'pulse' ? 1.2 : .5;if (age > life) continue;const al = 1 - age / life;
  for (const id of x.to || []) { const b = byId.get(id); if (!b) continue; const pb = P(b.pos); ctx.strokeStyle = ion ? `rgba(170,150,255,${al.toFixed(2)})` : `rgba(255,${x.mode === 'pulse' ? 230 : 120},90,${al.toFixed(2)})`; ctx.lineWidth = x.mode === 'pulse' ? 6 : 4; ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke(); ctx.lineWidth = 1; }
 }
 // Missiles.
 for (const m of w.missiles) { if (m.sys !== sys || m.n <= 0) continue; const p = P(m.pos); ctx.fillStyle = m.side === 0 ? '#bdf3ff' : '#ffd2a8'; ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 + Math.min(2, m.n / 6), 0, Math.PI * 2); ctx.fill(); }
 // Ships: a wedge along the heading, sized by length (never smaller than a mark).
 for (const u of us) {
  const [x, y] = P(u.pos), L = Math.max(9, u.p.len / t.mpp), Wd = Math.max(5, (u.p.width || u.p.len * .5) / t.mpp * .9), c = Math.cos(u.yaw), s = Math.sin(u.yaw), own = u.side === 0, col = u.out ? '#8d969c' : own ? VC.own : VC.foe;
  const pt = (f, r) => [x + c * f - s * r, y + s * f + c * r];
  ctx.fillStyle = col;ctx.globalAlpha = u.warp ? .5 : 1;ctx.beginPath();ctx.moveTo(...pt(L * .55, 0));ctx.lineTo(...pt(-L * .45, Wd * .5));ctx.lineTo(...pt(-L * .3, 0));ctx.lineTo(...pt(-L * .45, -Wd * .5));ctx.closePath();ctx.fill();ctx.globalAlpha = 1;
  if (u.shieldMax > 0 && u.shield > 0) { ctx.strokeStyle = `rgba(120,190,255,${(.15 + .55 * u.shield / u.shieldMax).toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, L * .62 + 3, 0, Math.PI * 2); ctx.stroke(); }
  if (sel.has(u.id) || voy.sel.foe === u.id) { ctx.strokeStyle = voy.sel.foe === u.id ? '#ffd0c4' : '#ffffff'; ctx.lineWidth = shipSel || voy.sel.foe === u.id ? 1.6 : 1; ctx.beginPath(); ctx.arc(x, y, L * .62 + 7, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
  // A ship on fire flickers orange.
  // A disabled ship falling: a down arrow and how far below the battle it has sunk.
  if (u.fall && !u.dead) { ctx.strokeStyle = '#ffb27a'; ctx.fillStyle = '#ffb27a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - L * .55 - 6, y - 6); ctx.lineTo(x - L * .55 - 6, y + 5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - L * .55 - 10, y + 2); ctx.lineTo(x - L * .55 - 6, y + 8); ctx.lineTo(x - L * .55 - 2, y + 2); ctx.fill(); ctx.lineWidth = 1; const dz = Math.max(0, -u.pos[1]) / 1000; if (dz > .5) { ctx.font = '600 10px ' + getComputedStyle(document.body).fontFamily; ctx.fillText(`−${dz.toFixed(1)}km`, x - L * .55 - 14 - ctx.measureText(`−${dz.toFixed(1)}km`).width, y + 4); } }
  const burn = (u.fire || []).reduce((a, b) => a + b, 0);if (burn > 0 && !u.dead) { const fl = .6 + .4 * Math.sin(performance.now() / 90 + x); ctx.fillStyle = `rgba(255,${120 + (fl * 80 | 0)},40,${(.5 + .5 * Math.min(1, burn)) * fl})`; ctx.beginPath(); ctx.arc(x + L * .25, y - L * .25, 2.5 + 2 * Math.min(1, burn), 0, Math.PI * 2); ctx.fill(); }
  // Hull sections under the mark, stern to bow.
  const bw = Math.max(22, L * .9), sx = x - bw / 2, sy = y + L * .62 + 6;u.sec.forEach((q, i) => { const f = C.clamp(q.s / q.max, 0, 1); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(sx + i * bw / u.sec.length, sy, bw / u.sec.length - 1, 3); ctx.fillStyle = f > .5 ? '#9be7a6' : f > .2 ? '#ffd27a' : f > 0 ? '#ff8a70' : '#5a2a24'; ctx.fillRect(sx + i * bw / u.sec.length, sy, (bw / u.sec.length - 1) * (f > 0 ? Math.max(.15, f) : 1), 3); });
  u._lab = [x + L * .62 + 6, y - 4, x - L * .62 - 6];
 }
 // Aircraft: one marker per wing (飛行隊) at the centre of its craft, the unit that takes
 // orders; each squadron a dot when zoomed in.
 const wings = new Map(), arrow = (x, y, hx, hz, z, col, al) => { const ang = Math.atan2(hz, hx), c = Math.cos(ang), sn = Math.sin(ang); ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + c * z, y + sn * z); ctx.lineTo(x - c * z * .7 - sn * z * .7, y - sn * z * .7 + c * z * .7); ctx.lineTo(x - c * z * .7 + sn * z * .7, y - sn * z * .7 - c * z * .7); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; };
 for (const s of w.squads.values()) {
  if (s.sys !== sys || (s.state !== 'out' && s.state !== 'return') || s.n <= 0) continue;const [x, y] = P(s.pos), own = s.side === 0;
  if (t.mpp < 25) { ctx.globalAlpha = .55; ctx.fillStyle = own ? '#a8f0ff' : '#ffc29a'; ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  let g = wings.get(s.wing);if (!g) wings.set(s.wing, g = {x: 0, y: 0, n: 0, hx: 0, hz: 0, own, hot: voy.sel.wing === s.wing});g.x += x * s.n;g.y += y * s.n;g.n += s.n;g.hx += s.h[0];g.hz += s.h[2];
 }
 voy.tacWings = [];
 for (const [id, g] of wings) { g.cx = g.x / g.n; g.cy = g.y / g.n; arrow(g.cx, g.cy, g.hx || 1, g.hz, C.clamp(3 + Math.sqrt(g.n) * .5, 6, 12), g.hot ? '#ffffff' : g.own ? '#a8f0ff' : '#ffc29a', .95); if (g.hot) { ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(g.cx, g.cy, 14, 0, Math.PI * 2); ctx.stroke(); } if (g.own) voy.tacWings.push({id, x: g.cx, y: g.cy}); label.block(g.cx - 7, g.cy - 7, g.cx + 7, g.cy + 7); }
 // Names keep off the ship marks (theirs and their neighbours').
 for (const u of us) { const [x, y] = P(u.pos), r = Math.max(9, u.p.len / t.mpp) * .62 + 3; label.block(x - r, y - r, x + r, y + r + 7); }
 // Labels: the selected ships, then our task groups (at their guides), then the other ships, then the wings.
 const order = us.slice().sort((a, b) => (sel.has(b.id) && shipSel) - (sel.has(a.id) && shipSel) || ((a.side === 0) ? -1 : 1) - ((b.side === 0) ? -1 : 1) || b.p.len - a.p.len), lab = u => u._lab && label(shipTag(u.name) + voyTagSuffix(u), wd => [u._lab, [u._lab[2] - wd, u._lab[1]]], u.side === 0 ? '#cfefff' : '#ffd0c4', '600 10.5px ' + font, shipSel && sel.has(u.id));
 if (shipSel) for (const u of order) if (sel.has(u.id)) lab(u);
 for (const {g, m} of tgs.values()) {
  if (g.side !== 0) continue;const guide = m.find(u => u.id === g.flag) || m[0], [x, y] = P(guide.pos), r = Math.max(9, guide.p.len / t.mpp) * .62 + 12, on = !shipSel && m.some(u => sel.has(u.id)), name = voyTgShort(g.name), o = g.spool ? (g.spool.blocked ? '離脱停止' : '離脱準備') : {auto: '自動', hold: '待機', move: '移動', attack: '攻撃'}[g.order.type] || '';
  label([`${name} · ${R.FORMATIONS[g.formation] || ''} · ${o}`, `${name} ${o}`, name], wd => [[x - wd / 2, y - r], [x - wd / 2, y + r + 16], [x + r + 4, y - r + 4], [x - r - 4 - wd, y - r + 4]], on ? '#ffffff' : '#8fdcff', '700 10.5px ' + font, true);
 }
 for (const u of order) if (!(shipSel && sel.has(u.id))) lab(u);
 for (const [id, g] of wings) { const wing = w.wings.get(id); if (!wing) continue; label([`${g.own ? '' : '敵 '}${wing.name} ${Math.round(g.n)}機 · ${R.WING_PHASE[wing.phase] || ''}`, `${g.own ? '' : '敵 '}${wing.name.replace(/^.*?\s(第\d+飛行隊)$/, '$1')} ${Math.round(g.n)}機 · ${R.WING_PHASE[wing.phase] || ''}`, `${g.own ? '' : '敵 '}${Math.round(g.n)}機 · ${R.WING_PHASE[wing.phase] || ''}`], wd => [[g.cx + 10, g.cy - 6], [g.cx - 10 - wd, g.cy - 6], [g.cx - wd / 2, g.cy - 14], [g.cx - wd / 2, g.cy + 20]], g.hot ? '#ffffff' : g.own ? '#a8f0ff' : '#ffc29a', '600 9.5px ' + font, g.hot); }
 for (const f of swLabs) f();
}

// ---------- the top bar ----------
function voyRenderHud() {
 const w = voy.w, el = $('#voyHud');if (!el || !w) return;const tac = voy.screen === 'tac', S = w.sector;
 const own = w.sides[0], ownNow = own.now ?? own.initial, foeKnown = [...own.contacts.values()].reduce((n, c) => n + c.strength, 0);
 const battle = tac ? w.battles.get(voy.tac.sys) : null, alert = voy.battleAlert != null && w.battles.has(voy.battleAlert) && !tac, v3 = voy3D(), tsys = voyTacTarget();
 const html = `<div class="vh-l"><b>${tac ? esc(S.systems[voy.tac.sys]?.name || '') + ' 戦術図' : '作戦図'}</b><span>${tac ? (battle ? '交戦 ' + voyClock(w.time - battle.t0) : '交戦なし') : esc(S.name) + ' · ' + S.grid}</span></div>
 <div class="vh-clock"><span>経過</span><b>${voyClock(w.time)}</b>${voy.speed > 1 && voy.eff < voy.speed * .75 ? `<small class="vh-lag" title="艦載機や艦が多く計算が追いつかないため、時間の進みを抑えています">実効 ${voy.eff < 10 ? voy.eff.toFixed(1) : Math.round(voy.eff)}×</small>` : ''}</div>
 <div class="vh-speed seg" role="group" aria-label="時間の速さ">${VOY_SPEEDS.map(v => `<button type="button" data-vspeed="${v}" aria-pressed="${voy.speed === v}">${v ? v + '×' : '❚❚'}</button>`).join('')}</div>
 <div class="vh-str"><span>戦力</span><i><em style="width:${pct(ownNow, own.initial)}%"></em></i><small>自軍 ${pct(ownNow, own.initial)}%</small><small class="foe">敵（推定） ${foeKnown ? Math.round(foeKnown) : '不明'}</small></div>
 ${voySupplyHud(own)}
 <div class="vh-r">${alert ? `<button type="button" class="btn sm warn" data-vgo="tac:${voy.battleAlert}">交戦中：${esc(S.systems[voy.battleAlert].name)}</button>` : ''}<div class="seg vh-maps" role="group" aria-label="地図"><button type="button" data-vgo="ops" aria-pressed="${!tac}">作戦図</button><button type="button" ${tsys != null ? `data-vgo="tac:${tsys}"` : 'disabled'} aria-pressed="${tac}">戦術図</button></div>${v3 ? '<button type="button" class="btn sm primary vh-3d" data-vgo="3d" title="地図を閉じて3D視点に戻る（M）">3D視点</button>' : ''}<button type="button" class="btn sm ghost" data-vgo="side" aria-pressed="${voy.side}">一覧</button><button type="button" class="btn sm ghost" data-vgo="quit">終了</button></div>`;
 // Morphed in place, so a button stays the same node while the clock ticks and a tap on it lands.
 if (el.dataset.html !== html) { const t = document.createElement('div'); t.innerHTML = html; voyMorph(el, t); el.dataset.html = html; }
}
// The fleet's supply: what the train can hand out per minute (回復力) against
// what the ships want, and how many of our groups are cut off from home.
function voySupplyHud(own) {
 const sp = own.supply;if (!sp) return '';const w = voy.w, want = sp.want * 60, rate = sp.rate * 60, ratio = want > rate * .02 ? Math.min(1, sp.ratio) : 1;
 const cut = [...w.groups.values()].filter(g => g.side === 0 && g.sys != null && voyLive(g) && !sp.lines.has(g.sys)).length, rear = [...w.units.values()].filter(u => u.side === 0 && u.status === 'rear' && !u.dead).length;
 return `<div class="vh-sup${ratio < .5 ? ' bad' : ratio < .95 ? ' warn' : ''}" title="補給の回復力（艦隊全体で毎分配れる資材）と、修理・補充を待つ艦の需要。補給線が切れた星系の艦は補給を受けられません。"><span>補給</span><b>${want > rate * .02 ? Math.round(ratio * 100) + '%' : '充足'}</b><small>回復力 ${num(Math.round(rate))} t/分${want > rate * .02 ? ` · 需要 ${num(Math.round(want))}` : ''}${cut ? ` · 遮断 ${cut}` : ''}${rear ? ` · 後方修理 ${rear} 隻` : ''}</small></div>`;
}
function voyRenderLog() { const el = $('#voyLog'); if (!el) return; const html = voy.notes.slice(0, 4).map(n => `<p><span>${voyClock(n.t)}</span>${esc(n.text)}</p>`).join(''); if (el.innerHTML !== html) el.innerHTML = html; }

// ---------- side panels ----------
const VOY_POWER = [['auto', '自動'], ['cruise', '巡航'], ['balanced', '均衡'], ['weapons', '兵装'], ['shields', '防御'], ['overload', '全力']];
const VOY_AIM = [['auto', '自動'], ['reactor', '反応炉'], ['bridge', '艦橋'], ['weapon', '砲塔'], ['engine', '推進'], ['shield', 'シールド']];
// v20.6 How the guns fire: continuously (each gun as it is ready) or in salvos (all together).
const VOY_VOLLEY = [['stream', '連続射撃'], ['salvo', '斉射']];
const VOY_ORDER = {group: '任務群に従う', auto: '自動交戦', hold: '待機', move: '移動', attack: '攻撃', escort: '護衛'};
const VOY_CMD_HINT = {move: '移動先を地図でタップ', attack: '攻撃する敵艦をタップ', strike: '攻撃する敵艦をタップ', cap: '制空する地点をタップ', escort: '直掩する味方艦をタップ', guard: '護衛する味方艦をタップ（その艦と脅威のあいだに位置取り、狙ってくる敵を優先して撃ち、射線をふさぎます）', tow: '牽引する戦闘不能の味方艦をタップ', capture: '拿捕する戦闘不能の敵艦をタップ', jump: 'ジャンプ先の星系を地図でタップ'};
const voyCommon = (list, f) => { if (!list.length) return null; const v = f(list[0]); return list.every(x => f(x) === v) ? v : null; };
function voySecHTML(u) { return `<span class="vsec" aria-label="船体区画">${u.sec.map((q, i) => { const f = C.clamp(q.s / q.max, 0, 1); return `<i class="${f <= 0 ? 'gone' : f < .25 ? 'bad' : f < .6 ? 'mid' : ''}" title="${C.SECTION_NAMES[i]} ${Math.round(f * 100)}%"><em style="width:${Math.round(f * 100)}%"></em></i>`; }).join('')}</span>`; }
function voyOrderText(o) { return o.type === 'attack' ? `攻撃：${voy.w.units.get(o.target)?.name || '—'}` : o.type === 'escort' ? `護衛：${voy.w.units.get(o.target)?.name || '—'}` : VOY_ORDER[o.type] || ''; }
function voyGroupOrderText(g) { const w = voy.w, o = g.order; if (o.type === 'auto') { const t = g.auto?.target && w.units.get(g.auto.target); return '自動交戦' + (t ? '：' + t.name : ''); } return voyOrderText(o); }
function voyUnitState(u) {
 const w = voy.w, cap = u.captured ? '拿捕艦 · ' : '';
 if (u.dead) return '撃沈';
 if (u.out) return cap + '戦闘不能（' + u.out + '）' + (u.towedBy ? ' · 被牽引' : '');
 if (u.jump) return cap + (u.jump.blocked ? '離脱準備（被弾中で停止）' : '離脱準備');
 if (u.warp) return 'ハイパースペースから出現';
 if (u.sys == null) return 'ハイパースペース';
 const tr = u.tractor ? (u.tractor.mode === 'capture' ? (u.tractor.lock ? ` · 拿捕中 ${Math.round((u.tractor.progress || 0) * 100)}%` : ' · 拿捕へ接近') : u.tractor.lock ? ' · 牽引中' : ' · 牽引へ接近') : '';
 const g = w.groups.get(u.group);return cap + (u.order.type === 'group' ? (g ? voyGroupOrderText(g) : '待機') : '個別：' + voyOrderText(u.order)) + tr;
}
function voyRenderSide(tick) {
 const el = $('#voySide'), w = voy.w;if (!el || !w) return;el.hidden = !voy.side;if (!voy.side) return;
 if (tick && voy.sidePause) return;
 const html = voy.screen === 'tac' ? voyTacSide() : voyOpsSide();
 if (el.dataset.html !== html) { const t = document.createElement('div'); t.innerHTML = html; voyMorph(el, t); el.dataset.html = html; }
}
// Brings a's children in line with b's, keeping every node that is still the
// same kind of thing: a button whose label or figures changed stays the same
// button, so a tap on it lands even while the battle updates the panel.
function voyMorph(a, b) {
 const an = a.childNodes, bn = [...b.childNodes];
 for (let i = 0; i < bn.length; i++) {
  const x = an[i], y = bn[i];
  if (!x) { a.appendChild(y); continue; }
  if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { a.replaceChild(y, x); continue; }
  if (x.nodeType !== 1) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
  for (const at of [...x.attributes]) if (!y.hasAttribute(at.name) && !(at.name === 'open' && x.nodeName === 'DETAILS')) x.removeAttribute(at.name);
  for (const at of y.attributes) if (x.getAttribute(at.name) !== at.value) { x.setAttribute(at.name, at.value); if (at.name === 'value' && 'value' in x && x !== document.activeElement) x.value = at.value; }
  if (x === document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(x.nodeName)) continue;
  voyMorph(x, y);
 }
 while (an.length > bn.length) a.removeChild(a.lastChild);
}
// ---- the forces as a tree: combined task groups, their task groups ----
function voyTgStatus(g) {
 const w = voy.w, S = w.sector;
 if (g.transit) return `ハイパースペース → ${S.systems[g.transit.to].name}（${voyClock(g.transit.t1 - w.time)}）`;
 if (g.spool) return g.spool.blocked ? `発進準備（被弾中で停止）→ ${S.systems[g.spool.dest].name}` : `発進準備 あと ${Math.ceil(g.spool.need - g.spool.t)} 秒 → ${S.systems[g.spool.dest].name}`;
 if (g.waitJump) return `出発待ち ${voyClock(g.waitJump.at - w.time)} → ${S.systems[g.waitJump.dest].name}`;
 const at = S.systems[g.sys]?.name || '', held = R.groupDisabled(w, g).length;return w.battles.has(g.sys) ? `${at} · 交戦中 · ${voyGroupOrderText(g)}${held ? ` · 航行不能 ${held}` : ''}` : held ? `${at} · 航行不能艦あり（回収か自沈を）` : `${at} · 待機中`;
}
function voyTgRow(g, sys) {
 const w = voy.w, us = g.units.map(id => w.units.get(id)).filter(u => R.alive(u) && (sys == null || u.sys === sys)), str = us.reduce((n, u) => n + R.unitStruct(u), 0) / Math.max(1, us.length), out = us.filter(u => u.out).length;
 return `<li class="${voy.sel.group === g.id && !voy.sel.units.length ? 'on' : ''}"><button type="button" class="vs-tgrow${g.spool?.blocked ? ' bad' : ''}" data-vgroup="${g.id}"><b>${esc(g.name)}</b><small>${us.length} 隻${out ? `（戦闘不能 ${out}）` : ''} · 構造 ${Math.round(str * 100)}%</small><span>${esc(voyTgStatus(g))}</span></button></li>`;
}
function voyForceTree(sys) {
 const w = voy.w, seen = new Set(), out = [];
 for (const c of w.ctgs.values()) {
  if (c.side !== 0) continue;const gs = voyCtgGroups(c).filter(g => sys == null || voyGroupIn(g, sys));gs.forEach(g => seen.add(g.id));if (!gs.length) continue;
  out.push(`<li class="${voy.sel.ctg === c.id && !voy.sel.group ? 'on' : ''}"><button type="button" class="vs-ctg" data-vctg="${c.id}">${esc(c.name)}<small>${gs.length} 個任務群 · ${gs.reduce((n, g) => n + g.units.filter(id => R.alive(w.units.get(id))).length, 0)} 隻</small></button><ul>${gs.map(g => voyTgRow(g, sys)).join('')}</ul></li>`);
 }
 const rest = [...w.groups.values()].filter(g => g.side === 0 && !seen.has(g.id) && voyLive(g) && (sys == null || voyGroupIn(g, sys)));
 if (rest.length) out.push(`<li><span class="vs-ctg">分遣隊・残置部隊</span><ul>${rest.map(g => voyTgRow(g, sys)).join('')}</ul></li>`);
 return `<ul class="vs-tree">${out.join('') || '<li class="muted">部隊がありません</li>'}</ul>`;
}
// Disabled ships holding a group: recovered — sent back to the yards by the
// fleet train, or taken in tow — or scuttled (a second tap confirms).
function voyDisabledHTML(list, head) {
 const w = voy.w;if (!list.length) return '';const armed = id => voy.scuttleArm === id && performance.now() < (voy.scuttleAt || 0);
 return `<div class="vs-dis">${head !== false ? `<p class="vs-sub bad">航行不能艦 ${list.length} 隻：回収か自沈をするまで、この任務群はジャンプできません</p>` : ''}${list.map(u => { const why = R.recoverCheck(w, u), tw = u.towedBy ? [] : voyTowers(u).filter(x => !x.tractor?.lock); return `<div class="vs-disrow"><p><b>${esc(u.name)}</b><small>${esc(u.out || '')}${u.fall ? ` · 落下中（−${(Math.max(0, -u.pos[1]) / 1000).toFixed(1)} km）` : ''}${u.towedBy ? ' · 牽引中' : ''}</small></p><div class="vs-acts"><button type="button" class="btn sm" data-vrec="${u.id}" ${why ? 'disabled' : ''}>後方へ回収</button>${tw.length ? `<button type="button" class="btn sm" data-vtrq="tow:${u.id}">牽引で回収（${esc(tw[0].name)}）</button>` : ''}<button type="button" class="btn sm ${armed(u.id) ? 'warn' : 'ghost'}" data-vscuttle="${u.id}">${armed(u.id) ? '自沈を確定' : '自沈'}</button></div><p class="note">${why ? esc(why) : `後方へ回収すると約 ${Math.round(R.rearSeconds(u) / 60)} 分で修理を終え、母港で戦列に復帰します。`}${u.fall && !u.towedBy ? ' 放置すると大気圏に落下して失われます。' : ''}</p></div>`; }).join('')}</div>`;
}
// The supply line to a system as a short phrase, and what a ship still lacks.
function voySupplyLine(sys) { const ln = voy.w.sides[0].supply?.lines.get(sys); return !ln ? '遮断' : ln.home ? '母港（工廠あり）' : `効率 ${Math.round(ln.eff * 100)}%`; }
function voyNeedText(u) {
 const nd = u.supplyNeed;if (!nd?.total) return '補給・修理は不要';const parts = [];
 if (nd.hull + nd.mods + nd.plate > .5) parts.push(`修理 ${num(Math.round(nd.hull + nd.mods + nd.plate))} t`);if (nd.parts > .5) parts.push(`機器交換 ${num(Math.round(nd.parts))} t`);
 if (nd.ammo > .5) parts.push(`ミサイル ${num(Math.round(nd.ammo / R.SUPPLY.missile))} 発`);if (nd.craft > .5) parts.push(`艦載機の補充`);if (nd.crew > .5) parts.push(`乗員 ${num(Math.round(nd.crew / R.SUPPLY.crew))} 名`);
 return '補給待ち：' + parts.join('・');
}
function voyCrumbs(c, g) { return `<div class="vs-crumbs">${c ? `<button type="button" data-vctg="${c.id}">${esc(c.name)}</button>` : '<span>分遣隊</span>'}${g ? ` › <button type="button" data-vgroup="${g.id}">${esc(g.name)}</button>` : ''}</div>`; }
// A route along the lanes: its length on the trunk and on branch lines, and the systems passed.
function voyRouteHTML(from, dest) {
 const S = voy.w.sector, r = R.routePath(S, from, dest);if (!r) return '航路がありません';
 const trunk = r.legs.filter(e => e.kind === 'trunk').reduce((n, e) => n + e.len, 0), via = r.path.slice(1, -1).map(id => S.systems[id].name);
 return `<b>${Math.round(r.ly)}</b> 光年（主要幹線 ${Math.round(trunk)} · 支線 ${Math.round(r.ly - trunk)}）${via.length ? `<br>経由：${esc(via.slice(0, 5).join(' › '))}${via.length > 5 ? ` ほか ${via.length - 5}` : ''}` : ' · 直行'}`;
}
// ---- operational map ----
function voyOpsSide() {
 const w = voy.w, S = w.sector, g = voySelGroup(), c = g ? null : voySelCtg(), parts = [];
 if (voy.cmd?.type === 'jump' && (g || c)) parts.push(`<p class="vs-hint">ジャンプ先の星系を地図でタップしてください<button type="button" class="btn sm ghost" data-vact="nocmd">取消</button></p>`);
 if (g) parts.push(voyTgOpsCard(g));
 else if (c) parts.push(voyCtgOpsCard(c));
 else if (voy.sel.sys != null) parts.push(voySysCard(S.systems[voy.sel.sys]));
 parts.push(`<div class="vs-card vs-list"><h3>部隊一覧</h3>${voyForceTree(null)}<p class="note">合同任務群を選ぶと、配下の任務群をそろえてジャンプさせられます。艦隊は航路（主要幹線・支線）に沿ってだけ移動します。</p></div>`);
 const rear = [...w.units.values()].filter(u => u.side === 0 && u.status === 'rear' && !u.dead);
 if (rear.length) parts.push(`<div class="vs-card vs-list"><h3>後方で修理中</h3><ul>${rear.map(u => `<li class="muted"><b>${esc(u.name)}</b><small>母港で復帰まで ${voyClock(u.rear.back - w.time)}</small></li>`).join('')}</ul></div>`);
 return parts.join('');
}
function voyTgOpsCard(g) {
 const w = voy.w, S = w.sector, us = g.units.map(id => w.units.get(id)).filter(R.alive), hc = R.groupHyper(w, g), c = R.ctgOf(w, g), tow = us.filter(u => u.tractor?.lock && u.tractor.mode === 'tow').length, held = R.groupDisabled(w, g), stay = R.groupStay(w, g);
 const dest = voy.sel.dest != null && voy.sel.dest !== g.sys ? voy.sel.dest : null, from = g.sys ?? g.transit?.to, eta = dest != null ? R.etaTo(w, g.id, dest) : null, free = !g.transit && !g.spool && !g.waitJump;
 return `<div class="vs-card">${voyCrumbs(c, null)}<div class="vs-head"><h3>${esc(g.name)}</h3><span>${us.length} 隻 · ${esc(R.FORMATIONS[g.formation] || '')}</span></div>
  <p class="vs-state${g.spool?.blocked ? ' bad' : g.spool || g.waitJump ? ' warn' : ''}">${esc(voyTgStatus(g))}</p>
  <p class="vs-sub">ハイパードライブ ${hc == null ? (held.length ? 'ジャンプ不能（航行不能艦あり）' : 'ジャンプできる艦がありません') : 'クラス ' + hc.toFixed(1) + '（任務群で最も遅い艦）'}${tow ? ` · 牽引中 ${tow} 隻（同行）` : ''}${stay.length ? ` · ハイパードライブを失った ${stay.length} 隻は残置` : ''}</p>
  ${g.sys != null ? `<p class="vs-sub">補給線 ${voySupplyLine(g.sys)}${us.some(u => u.supplyNeed?.total) ? ` · 補給待ち ${us.filter(u => u.supplyNeed?.total).length} 隻` : ''}</p>` : ''}
  ${voyDisabledHTML(held)}
  <ul class="vs-ships">${us.map(u => `<li><label>${voy.split ? `<input type="checkbox" data-vsplit="${u.id}" ${voy.splitSel?.has(u.id) ? 'checked' : ''}>` : ''}<b>${u.id === g.flag ? '旗 ' : ''}${esc(u.name)}</b></label>${voySecHTML(u)}<small>${esc(voyUnitState(u))}</small></li>`).join('')}</ul>
  ${dest != null ? `<div class="vs-jump"><p>→ <b>${esc(S.systems[dest].name)}</b>　到着まで <b>${eta == null ? '—' : voyClock(eta)}</b></p><p class="vs-route">${voyRouteHTML(from, dest)}</p><div class="vs-acts"><button type="button" class="btn sm primary" data-vact="jump" ${eta == null || !free ? 'disabled' : ''}>ジャンプ</button><button type="button" class="btn sm ghost" data-vact="nodest">取消</button></div></div>` : ''}
  <div class="vs-acts">${free ? `<button type="button" class="btn sm" data-vact="pickdest" aria-pressed="${voy.cmd?.type === 'jump'}">ジャンプ先を選ぶ</button>` : ''}${g.spool || g.waitJump ? '<button type="button" class="btn sm ghost" data-vact="cancel">発進を取り消す</button>' : ''}${free && us.length > 1 ? `<button type="button" class="btn sm ghost" data-vact="split" aria-pressed="${!!voy.split}">${voy.split ? '分割を確定' : '任務群を分割'}</button>` : ''}${voyMergeButtons(g)}${g.sys != null && w.battles.has(g.sys) ? `<button type="button" class="btn sm warn" data-vgo="tac:${g.sys}">戦術図</button>` : ''}</div>
  ${g.spool ? '<p class="note">ジャンプにはリアクターの全出力が要ります。発進準備中は砲撃できず、被弾している間は準備が止まります。</p>' : ''}</div>`;
}
function voyCtgOpsCard(c) {
 const w = voy.w, S = w.sector, gs = voyCtgGroups(c), ships = gs.reduce((n, g) => n + g.units.filter(id => R.alive(w.units.get(id))).length, 0), dest = voy.sel.dest;
 const go = dest == null ? [] : gs.filter(g => !g.transit && g.sys != null && g.sys !== dest), etas = go.map(g => R.etaTo(w, g.id, dest)).filter(x => x != null), eta = etas.length ? Math.max(...etas) : null, busy = gs.some(g => g.spool || g.waitJump), battle = gs.find(g => g.sys != null && w.battles.has(g.sys));
 const heldC = gs.flatMap(g => R.groupDisabled(w, g));
 return `<div class="vs-card"><div class="vs-head"><h3>${esc(c.name)}</h3><span>${gs.length} 個任務群 · ${ships} 隻</span></div>
  <ul class="vs-tree">${gs.map(g => voyTgRow(g)).join('')}</ul>${heldC.length ? `<p class="vs-sub bad">航行不能艦のある任務群はジャンプできません（回収か自沈を）</p>${voyDisabledHTML(heldC, false)}` : ''}
  ${dest != null ? `<div class="vs-jump"><p>→ <b>${esc(S.systems[dest].name)}</b>　全任務群の到着まで <b>${eta == null ? '—' : voyClock(eta)}</b></p>${go[0] ? `<p class="vs-route">${voyRouteHTML(go[0].sys, dest)}</p>` : ''}<div class="vs-acts"><button type="button" class="btn sm primary" data-vact="ctgjump" ${eta == null ? 'disabled' : ''}>合同でジャンプ</button><button type="button" class="btn sm" data-vact="ctgjump1" ${eta == null ? 'disabled' : ''}>各個にジャンプ</button><button type="button" class="btn sm ghost" data-vact="nodest">取消</button></div><p class="note">合同でジャンプすると、早く着く任務群は出発を遅らせて全任務群が同時に到着します。</p></div>` : ''}
  <div class="vs-acts"><button type="button" class="btn sm" data-vact="pickdest" aria-pressed="${voy.cmd?.type === 'jump'}">ジャンプ先を選ぶ</button>${busy ? '<button type="button" class="btn sm ghost" data-vact="cancel">発進を取り消す</button>' : ''}${battle ? `<button type="button" class="btn sm warn" data-vgo="tac:${battle.sys}">戦術図</button>` : ''}</div></div>`;
}
function voySysCard(s) {
 const w = voy.w, mine = [...w.groups.values()].filter(h => h.side === 0 && h.sys === s.id && voyLive(h)), c = [...w.sides[0].contacts.values()].filter(x => x.sys === s.id && !x.transit), seen = w.sides[0].seen.get(s.id), lanes = s.links.map(i => w.sector.edges[i]);
 const send = [...w.groups.values()].filter(h => h.side === 0 && h.sys !== s.id && voyLive(h)), ctgs = [...w.ctgs.values()].filter(x => x.side === 0 && voyCtgGroups(x).some(h => h.sys !== s.id));
 const ctgEta = x => { const e = voyCtgGroups(x).filter(h => !h.transit && h.sys != null && h.sys !== s.id).map(h => R.etaTo(w, h.id, s.id)).filter(v => v != null); return e.length ? Math.max(...e) : null; };
 return `<div class="vs-card"><div class="vs-head"><h3>${esc(s.name)}</h3><span>${esc(R.KIND_NAME[s.kind] || '')}</span></div>${s.note ? `<p class="vs-sub">${esc(s.note)}</p>` : ''}<p class="vs-sub">補給線 ${voySupplyLine(s.id)}</p><p class="vs-sub">${esc(s.star)}${s.pop ? ' · 人口規模 ' + '●'.repeat(s.pop) : ' · 無人'}${seen != null ? ' · 最終確認 ' + voyClock(w.time - seen) + ' 前' : ' · 未確認'}</p>
  <p class="vs-sub">${s.trunk ? '主要幹線上の星系' : '支線の星系'} · 航路 ${lanes.length} 本${lanes.some(e => e.kind === 'trunk') ? `（幹線 ${lanes.filter(e => e.kind === 'trunk').length}）` : ''}</p>
  ${mine.length ? `<p>自軍：${mine.map(h => esc(h.name)).join('・')}</p>` : ''}${c.length ? `<p class="foe">敵：${c.map(x => `${x.exact ? x.ships : '約' + x.ships} 隻（${voyClock(w.time - x.time)} 前）`).join('・')}</p>` : ''}
  <p class="vs-sub">ここへ送る部隊</p><ul class="vs-send">${ctgs.map(x => { const eta = ctgEta(x); return `<li><div><b>${esc(x.name)}</b><small>${eta == null ? 'ジャンプ不能' : '全任務群の到着まで ' + voyClock(eta)}</small></div><button type="button" class="btn sm" data-vsendc="${x.id}" ${eta == null ? 'disabled' : ''}>合同で送る</button></li>`; }).join('')}${send.map(h => { const eta = R.etaTo(w, h.id, s.id); return `<li><div><b>${esc(h.name)}</b><small>${eta == null ? 'ジャンプ不能' : '到着まで ' + voyClock(eta)}</small></div><button type="button" class="btn sm" data-vsend="${h.id}" ${eta == null || h.transit || h.spool ? 'disabled' : ''}>送る</button></li>`; }).join('') || '<li class="muted">送れる部隊がありません</li>'}</ul>
  ${w.battles.has(s.id) ? `<button type="button" class="btn sm warn" data-vgo="tac:${s.id}">戦術図</button>` : mine.length ? `<button type="button" class="btn sm" data-vgo="tac:${s.id}">戦術図（艦隊を動かす）</button>` : ''}</div>`;
}
function voyMergeButtons(g) { if (g.sys == null || g.transit || g.spool) return ''; const w = voy.w; return [...w.groups.values()].filter(h => h !== g && h.side === 0 && h.sys === g.sys && !h.transit && !h.spool && voyLive(h)).map(h => `<button type="button" class="btn sm ghost" data-vmerge="${h.id}">${esc(h.name)}と合流</button>`).join(''); }
// ---- tactical map ----
function voyOrderButtons(kind, cur) {
 const b = (k, n) => `<button type="button" class="btn sm${cur === k && !voy.cmd ? ' on' : ''}" data-vord="${k}">${n}</button>`, c = (k, n) => `<button type="button" class="btn sm${voy.cmd?.type === k || cur === k && !voy.cmd ? ' on' : ''}" data-vact="cmd:${k}">${n}</button>`;
 return `<div class="vs-acts">${kind === 'ship' ? b('group', '任務群に従う') : ''}${b('auto', '自動交戦')}${b('hold', '待機')}${c('move', '移動')}${c('attack', '攻撃')}${c('guard', '護衛')}<button type="button" class="btn sm ghost" data-vact="withdraw">離脱</button></div>`;
}
function voyFormHTML(cur) { return `<p class="vs-sub">陣形</p><div class="vs-acts">${Object.entries(R.FORMATIONS).map(([k, n]) => `<button type="button" class="btn sm${cur === k ? ' on' : ''}" data-vform="${k}">${n}</button>`).join('')}</div>`; }
function voyPowerAimHTML(list) { const pw = voyCommon(list, u => u.order.power || 'auto'), aim = voyCommon(list, u => u.order.aim || 'auto'), vol = voyCommon(list, u => C.volleyMode(u)); return `<p class="vs-sub">射撃</p><div class="vs-acts">${VOY_VOLLEY.map(([k, n]) => `<button type="button" class="btn sm${vol === k ? ' on' : ''}" data-vvol="${k}">${n}</button>`).join('')}</div><p class="note">${vol === 'salvo' ? '斉射：同じ種類の砲がそろって撃ちます。一度に当たるので装甲を破りやすく（大口径の砲ほど効きます）、最初の斉射は目標が射程に入った瞬間に撃てます。待つぶん発射数はわずかに減り、斉射の合間は敵が射撃を受けません（敵のハイパードライブ充填が進みます）。' : vol === 'stream' ? '連続射撃：各砲が装填しだい撃ち続けます。発射数がいちばん多く、敵を絶えず射撃下に置いてハイパードライブの充填を止めます。' : '艦によって射撃の型が違います。'}</p><p class="vs-sub">出力配分</p><div class="vs-acts">${VOY_POWER.map(([k, n]) => `<button type="button" class="btn sm${pw === k ? ' on' : ''}" data-vpow="${k}">${n}</button>`).join('')}</div><p class="vs-sub">照準部位</p><div class="vs-acts">${VOY_AIM.map(([k, n]) => `<button type="button" class="btn sm${aim === k ? ' on' : ''}" data-vaim="${k}">${n}</button>`).join('')}</div><p class="note">${aim === 'auto' ? '自動：ふだんは艦全体を撃ちます。自艦の2.5倍以上の大きさの艦はシールドが弱まると艦橋を狙います。' : aim === 'bridge' || aim === 'weapon' ? '艦橋・砲塔は装甲の外にあります。シールドが弱まると、狙いを保てた分（近いほど・的が大きいほど多い）が装甲を通さず直撃します。' : '狙った部位のある区画に被弾が集まります。'}</p>`; }
// v21 Superweapons of the ships chosen: each one's state, whether they may fire on their own, and for the
// composite beam a held beam or one pulse.
const VOY_SW_STATE = {charge: '充電中', ready: '発射可', beam: '照射中', cool: '過負荷・冷却中', down: '使用不能'};
// One line on a followed ship's superweapons (the readiest of them).
function voySwBrief(u) {
 if (!u?.p?.sw?.length || !u.sw?.length) return '';const xs = u.sw;
 if (xs.some(x => x.st === 'beam')) return ' · 超兵器 照射中';if (xs.some(x => x.st === 'ready')) return ' · 超兵器 発射可';
 const c = Math.max(...xs.map(x => x.st === 'charge' ? x.c || 0 : 0));if (xs.some(x => x.st === 'charge')) return ` · 超兵器 充電 ${Math.round(c * 100)}%`;
 return xs.some(x => x.st === 'cool') ? ' · 超兵器 過負荷' : '';
}
function voySwShips(list) { return list.filter(u => u.p.sw?.length && u.sw?.length && !u.dead); }
function voySwHTML(list) {
 const ships = voySwShips(list);if (!ships.length) return '';
 const rows = ships.flatMap(u => u.p.sw.map((w, i) => { const x = u.sw[i] || {}, K = C.SW_COMBAT[w.k], st = x.st === 'charge' ? `充電 ${Math.round((x.c || 0) * 100)}%` : x.st === 'cool' ? `過負荷・冷却 ${Math.ceil(Math.max(0, x.t || 0))} 秒` : VOY_SW_STATE[x.st] || ''; return `<p>${ships.length > 1 ? esc(u.name) + '：' : ''}${esc(K?.name || w.k)}（${w.aim === 'bow' ? '艦首' : w.aim === 'port' ? '左舷' : '右舷'}）· ${st}${w.k === 'sbeam' ? ' · ' + (x.mode === 'pulse' ? 'パルス' : 'ビーム') : ''}</p>`; })).join('');
 const hold = voyCommon(ships, u => u.order.sw === false), beam = ships.some(u => u.p.sw.some(w => w.k === 'sbeam')), md = voyCommon(ships.filter(u => u.p.sw.some(w => w.k === 'sbeam')), u => u.sw[u.p.sw.findIndex(w => w.k === 'sbeam')]?.mode === 'pulse' ? 'pulse' : 'beam');
 return `<div class="vs-tr"><p class="vs-sub">超兵器</p>${rows}<div class="vs-acts"><button type="button" class="btn sm${hold === false ? ' on' : ''}" data-vsw="free">自由発射</button><button type="button" class="btn sm${hold === true ? ' on' : ''}" data-vsw="hold">発射待機</button>${beam ? `<button type="button" class="btn sm${md === 'beam' ? ' on' : ''}" data-vsw="mode:beam">ビーム</button><button type="button" class="btn sm${md === 'pulse' ? ' on' : ''}" data-vsw="mode:pulse">パルス</button>` : ''}</div><p class="note">自由発射：充電が済んで射界に敵が入ると自動で撃ちます（超重合成ビームは艦首、ハイパーイオン砲は舷側の固定射界）。撃つと給電している炉が過負荷になり、しばらく出力が落ちます。発射待機：充電したまま撃たずに待ちます。</p></div>`;
}
function voyShipRow(u) { const g = voy.w.groups.get(u.group); return `<li class="${voy.sel.units.includes(u.id) ? 'on' : ''}"><button type="button" data-vunit="${u.id}"><b>${g?.flag === u.id ? '旗 ' : ''}${esc(u.name)}</b>${voySecHTML(u)}<small>${esc(voyUnitState(u))}</small></button></li>`; }
// Tractor beams of the ships in a selection: what each holds, and the orders.
function voyTractorHTML(list) {
 const w = voy.w, busy = list.filter(u => u.tractor);
 const rows = busy.map(u => { const t = w.units.get(u.tractor.target), tr = u.tractor, p = Math.round((tr.progress || 0) * 100); return `<p>${esc(u.name)} → ${t ? esc(t.name) : '—'}：${tr.mode === 'capture' ? (tr.lock ? `拿捕中（移乗 ${p}%）` : '拿捕のため接近中') : tr.lock ? '牽引中' : '牽引のため接近中'}</p>${tr.mode === 'capture' && tr.lock ? `<i><em style="width:${p}%"></em></i>` : ''}`; }).join('');
 return `<div class="vs-tr"><p class="vs-sub">トラクター・ビーム（${list.length} 隻が装備）</p>${rows}<div class="vs-acts"><button type="button" class="btn sm${voy.cmd?.type === 'tow' ? ' on' : ''}" data-vact="cmd:tow">牽引</button><button type="button" class="btn sm${voy.cmd?.type === 'capture' ? ' on' : ''}" data-vact="cmd:capture">拿捕</button>${busy.length ? '<button type="button" class="btn sm ghost" data-vact="trrelease">解除</button>' : ''}</div><p class="note">牽引：戦闘不能の味方艦を捕まえて連れて行きます（ジャンプにも同行）。拿捕：シールドを失った戦闘不能の敵艦を捕まえ、陸戦隊が移乗して奪います。</p></div>`;
}
function voyTgTacCard(g) {
 const w = voy.w, sys = voy.tac.sys, c = R.ctgOf(w, g), ms = g.units.map(id => w.units.get(id)).filter(u => R.alive(u) && u.sys === sys), indiv = ms.filter(u => u.order.type !== 'group' && !u.out), trac = ms.filter(u => u.p.trac > 0 && !u.out);
 return `<div class="vs-card">${voyCrumbs(c, null)}<div class="vs-head"><h3>${esc(g.name)}</h3><span>${ms.length} 隻 · ${esc(R.FORMATIONS[g.formation] || '')}</span></div>
  <p class="vs-state${g.spool?.blocked ? ' bad' : g.spool ? ' warn' : ''}">${esc(g.spool ? voyTgStatus(g) : voyGroupOrderText(g))}</p>
  <div class="vs-list"><ul>${ms.map(voyShipRow).join('')}</ul></div>${voyDisabledHTML(R.groupDisabled(w, g).filter(u => u.sys === sys))}
  <p class="vs-sub">任務群への命令</p>${voyOrderButtons('tg', g.order.type)}${voyFormHTML(g.formation)}${voyPowerAimHTML(ms)}${voySwHTML(ms)}
  ${trac.length ? voyTractorHTML(trac) : ''}
  ${indiv.length ? `<div class="vs-acts"><p class="vs-sub">${indiv.length} 隻が個別の命令で行動中</p><button type="button" class="btn sm ghost" data-vact="rejoin">任務群に戻す</button></div>` : ''}
  ${g.spool ? '<p class="note">離脱にはリアクターの全出力が要ります。準備中は砲撃できず、被弾している間は準備が止まります（距離を取りながら準備します）。</p>' : ''}</div>`;
}
function voyCtgTacCard(c) {
 const w = voy.w, sys = voy.tac.sys, gs = voyCtgGroups(c).filter(g => voyGroupIn(g, sys)), ms = gs.flatMap(g => g.units.map(id => w.units.get(id)).filter(u => R.alive(u) && u.sys === sys)), trac = ms.filter(u => u.p.trac > 0 && !u.out);
 const heldC = gs.flatMap(g => R.groupDisabled(w, g));
 return `<div class="vs-card"><div class="vs-head"><h3>${esc(c.name)}</h3><span>${gs.length} 個任務群 · ${ms.length} 隻</span></div>
  <ul class="vs-tree">${gs.map(g => voyTgRow(g, sys)).join('')}</ul>${heldC.length ? voyDisabledHTML(heldC) : ''}
  <p class="vs-sub">合同任務群への命令（全任務群）</p>${voyOrderButtons('ctg', voyCommon(gs, g => g.order.type))}${voyFormHTML(voyCommon(gs, g => g.formation))}${voyPowerAimHTML(ms)}
  ${trac.length ? voyTractorHTML(trac) : ''}
  <p class="note">移動を命じると、任務群は進路を横切る線上に並んで進みます。</p></div>`;
}
function voyShipCard(sel) {
 const w = voy.w, u = sel[0], one = sel.length === 1, g = w.groups.get(u.group), c = g && R.ctgOf(w, g), sx = C.fleetSystems(u), lost = (u.p.modules || []).map((m, i) => u.mods[i] <= 0 && m.k !== 'hull' ? m.name : null).filter(Boolean), trac = sel.filter(x => x.p.trac > 0 && !x.out);
 return `<div class="vs-card">${voyCrumbs(c, g)}<div class="vs-head"><h3>${one ? esc(u.name) : `${sel.length} 隻を選択`}</h3><span>${esc(voyUnitState(u))}</span></div>
  ${one ? `${voySecHTML(u)}<p class="vs-sub">シールド ${Math.round(u.shield / Math.max(1, u.shieldMax) * 100)}%${u.bankMax > 0 ? ` · 蓄電 ${Math.round(u.bank / u.bankMax * 100)}%` : ''} · 装甲 ${Math.round(u.armor * 100)}% · 乗員 ${num(Math.round(u.crew))} 名 · 炉 ${Math.round(sx.reactor * 100)}% · 推進 ${Math.round(sx.engine * 100)}% · 兵装 ${Math.round(sx.weapon * 100)}%</p><div class="vs-status">${armourFacesHTML(u)}${powerSplitHTML(u)}${statusFlagsHTML(u)}</div>${lost.length ? `<p class="vs-sub bad">損傷：${esc([...new Set(lost)].slice(0, 6).join('・'))}${lost.length > 6 ? ' ほか' : ''}</p>` : ''}<p class="vs-sub">${esc(voyNeedText(u))} · 補給線 ${voySupplyLine(u.sys)}${w.battles.has(u.sys) && u.supplyNeed?.total ? '（戦闘中は補給できません）' : ''}</p>${voyHitLogHTML(u)}` : ''}
  <p class="vs-sub">${one ? 'この艦' : '選んだ艦'}への命令</p>${voyOrderButtons('ship', voyCommon(sel, x => x.order.type))}${voyPowerAimHTML(sel)}${voySwHTML(sel)}
  ${trac.length ? voyTractorHTML(trac) : ''}${one && u.out ? voyDisabledHTML([u], false) : ''}${one ? voyCarriedTacHTML(u) : ''}
  ${one && !u.out ? `<button type="button" class="btn primary vs-pilot" data-vpilot="${u.id}">この艦を3Dで操艦</button>` : ''}${one ? `<button type="button" class="btn sm ghost vs-pilot" data-vspectate="${voy.tac.sys}" data-vfollow="${u.id}">${voy3D() ? '3D視点でこの艦を追う' : 'この艦を追って観戦'}</button>` : ''}</div>`;
}
// A carrier's small ships: aboard or out with the task group.
function voyCarriedTacHTML(u) {
 const w = voy.w, aboard = R.carriedOf(w, u), out = R.carriedOf(w, u, false).filter(x => R.alive(x));if (!aboard.length && !out.length) return '';
 return `<p class="vs-sub">搭載艦：艦内 ${aboard.length} 隻 · 発進中 ${out.length} 隻${u.holdCarried ? '（戦闘でも艦内に待機）' : ''}</p><div class="vs-acts">${aboard.length ? `<button type="button" class="btn sm" data-vcarry="launch:${u.id}">搭載艦を発進</button>` : ''}${out.length ? `<button type="button" class="btn sm" data-vcarry="recover:${u.id}">搭載艦を収容（${Math.round(R.RULES.carryRange / 1000)} km 以内）</button>` : ''}</div>`;
}
function voyFoeCard(fs) {
 const s = voyTacSel(), towers = fs.out && !(fs.shield > 1) ? voyTowers(fs) : [];
 return `<div class="vs-card foe"><div class="vs-head"><h3>敵 ${esc(fs.name)}</h3><span>${esc(voyUnitState(fs))}</span></div>${voySecHTML(fs)}<p class="vs-sub">シールド ${Math.round(fs.shield / Math.max(1, fs.shieldMax) * 100)}%${fs.bankMax > 0 ? ` · 蓄電 ${Math.round(fs.bank / fs.bankMax * 100)}%` : ''} · 装甲 ${Math.round(fs.armor * 100)}%</p><div class="vs-status">${armourFacesHTML(fs)}${statusFlagsHTML(fs)}</div>${voyHitLogHTML(fs)}
  <div class="vs-acts">${s.kind && !fs.out ? `<button type="button" class="btn sm" data-vact="attackfoe">${s.kind === 'ship' ? '選んだ艦で攻撃' : s.kind === 'tg' ? '任務群で攻撃' : '合同任務群で攻撃'}</button>` : ''}${towers.length ? `<button type="button" class="btn sm" data-vtrq="capture:${fs.id}">拿捕する（${esc(towers[0].name)}）</button>` : ''}<button type="button" class="btn sm ghost" data-vspectate="${voy.tac.sys}" data-vfollow="${fs.id}">${voy3D() ? '3D視点で追う' : '追って観戦'}</button><button type="button" class="btn sm ghost" data-vact="nofoe">閉じる</button></div></div>`;
}
function voyTacSide() {
 const w = voy.w, sys = voy.tac.sys, us = R.systemUnits(w, sys), foes = us.filter(u => u.side !== 0), tab = voy.tab;
 const tabs = `<div class="seg vs-tabs" role="tablist">${[['ships', '部隊'], ['wings', '飛行隊'], ['help', '増援'], ['log', '記録']].map(([k, n]) => `<button type="button" role="tab" data-vtab="${k}" aria-pressed="${tab === k}">${n}</button>`).join('')}</div>`;
 let body = '';
 if (voy.cmd) body += `<p class="vs-hint">${esc(VOY_CMD_HINT[voy.cmd.type] || '')}<button type="button" class="btn sm ghost" data-vact="nocmd">取消</button></p>`;
 if (tab === 'ships') {
  body += `<div class="vs-acts vs-watch"><button type="button" class="btn sm" data-vspectate="${sys}">${voy3D() ? '3D視点でこの星系を見る' : 'この戦闘を3Dで観戦'}</button></div>`;
  const fs = voy.sel.foe && w.units.get(voy.sel.foe);if (fs && R.alive(fs) && fs.sys === sys && fs.side !== 0) body += voyFoeCard(fs);
  const s = voyTacSel();
  if (s.kind === 'ship') body += voyShipCard(s.units);else if (s.kind === 'tg') body += voyTgTacCard(s.g);else if (s.kind === 'ctg') body += voyCtgTacCard(s.c);
  else body += '<p class="vs-sub">命令する部隊を選んでください。地図の艦をタップすると、1回目でその任務群、2回目でその艦を選びます。</p>';
  body += `<div class="vs-card vs-list"><h3>自軍</h3>${voyForceTree(sys)}</div>
  <div class="vs-card vs-list"><h3>敵艦</h3><ul>${foes.map(u => `<li class="foe${voy.sel.foe === u.id ? ' on' : ''}"><button type="button" data-vfoe="${u.id}"><b>${esc(u.name)}</b>${voySecHTML(u)}<small>${esc(voyUnitState(u))}</small></button></li>`).join('') || '<li class="muted">敵艦はいません</li>'}</ul></div>`;
 } else if (tab === 'wings') {
  const wings = [...w.wings.values()].filter(x => x.side === 0 && w.units.get(x.home)?.sys === sys && R.alive(w.units.get(x.home)));
  const wsel = voy.sel.wing && w.wings.get(voy.sel.wing);
  if (wsel) { const o = wsel.order, t = o.target && w.units.get(o.target);
   body += `<div class="vs-card"><div class="vs-head"><h3>${esc(wsel.name)}</h3><span>${esc(R.WING_PHASE[wsel.phase] || '')}</span></div><p class="vs-state">${esc(voyWingOrderText(wsel))}</p><div class="vs-acts">${[['auto', '自動'], ['standby', '待機・帰還']].map(([k, n]) => `<button type="button" class="btn sm${o.type === k ? ' on' : ''}" data-vwing="${k}">${n}</button>`).join('')}<button type="button" class="btn sm${voy.cmd?.type === 'strike' ? ' on' : ''}" data-vact="cmd:strike">攻撃</button><button type="button" class="btn sm${voy.cmd?.type === 'cap' ? ' on' : ''}" data-vact="cmd:cap">制空</button><button type="button" class="btn sm${voy.cmd?.type === 'escort' ? ' on' : ''}" data-vact="cmd:escort">直掩</button></div>
   ${o.type === 'strike' && t ? `<p class="vs-sub">進入方向（${esc(t.name)} から見て）</p><div class="vs-acts">${Object.entries(R.APPROACH_NAME).map(([k, n]) => `<button type="button" class="btn sm${o.approach === k ? ' on' : ''}" data-vappr="${k}">${n}</button>`).join('')}</div><p class="note">対空火力が最も弱いのは「${esc(R.APPROACH_NAME[voyWeakArc(t)])}」方向です。</p>` : ''}<p class="note">艦載機はすべて飛行隊単位で発艦・集合・進撃・攻撃・帰還します。地図の飛行隊の印をタップしても選べます。</p></div>`; }
  body += `<div class="vs-card vs-list"><h3>飛行隊</h3><ul>${wings.map(x => { const sq = x.squads.map(id => w.squads.get(id)).filter(Boolean), n = sq.reduce((a, s) => a + s.n, 0), n0 = sq.reduce((a, s) => a + s.n0, 0), out = sq.filter(s => s.state === 'out').length; return `<li class="${voy.sel.wing === x.id ? 'on' : ''}"><button type="button" data-vwsel="${x.id}"><b>${esc(x.name)}</b><small>${esc(R.WING_PHASE[x.phase] || '')}</small><span>${esc(voyWingOrderText(x))} · ${Math.round(n)} / ${n0} 機 · 発艦 ${out}/${sq.length} 中隊</span></button></li>`; }).join('') || '<li class="muted">この星系に飛行隊はいません</li>'}</ul></div>`;
 } else if (tab === 'help') {
  const ctgs = [...w.ctgs.values()].filter(c => c.side === 0 && voyCtgGroups(c).some(g => !voyGroupIn(g, sys))), gs = [...w.groups.values()].filter(h => h.side === 0 && voyLive(h) && !voyGroupIn(h, sys));
  const ctgEta = c => { const e = voyCtgGroups(c).filter(h => !h.transit && h.sys != null && h.sys !== sys).map(h => R.etaTo(w, h.id, sys)).filter(v => v != null); return e.length ? Math.max(...e) : null; };
  body += `<div class="vs-card vs-list"><h3>増援を呼ぶ</h3><ul class="vs-send">${ctgs.map(c => { const eta = ctgEta(c); return `<li><div><b>${esc(c.name)}</b><small>全任務群の到着まで ${eta == null ? '—' : voyClock(eta)}</small></div><button type="button" class="btn sm" data-vsendc="${c.id}" ${eta == null ? 'disabled' : ''}>合同で呼ぶ</button></li>`; }).join('')}${gs.map(h => { const eta = R.etaTo(w, h.id, sys); return `<li><div><b>${esc(h.name)}</b><small>${h.transit ? '航行中' : esc(w.sector.systems[h.sys]?.name || '')} · ${h.units.filter(id => R.alive(w.units.get(id))).length} 隻 · ${eta == null ? 'ジャンプ不能' : '到着まで ' + voyClock(eta)}</small></div><button type="button" class="btn sm" data-vsend="${h.id}" ${eta == null || h.transit || h.spool ? 'disabled' : ''}>呼び寄せる</button></li>`; }).join('') || '<li class="muted">ほかの部隊はありません</li>'}</ul><p class="note">到着時間は任務群で最も遅いハイパードライブで決まります。交戦中の任務群は離脱の準備に ${R.RULES.withdrawSpool} 秒かかり、被弾している間は準備が止まります。</p></div>`;
 } else {
  const b = w.battles.get(sys);body += `<div class="vs-card vs-list vs-log"><h3>戦闘記録</h3><ul>${(b?.log || []).slice(-40).reverse().map(e => `<li class="${e.side === 0 ? 'own' : e.side === 1 ? 'foe' : ''}"><span>${voyClock(e.t - (b?.t0 || 0))}</span>${esc(e.text)}</li>`).join('') || '<li class="muted">記録はまだありません</li>'}</ul></div>`;
 }
 return tabs + body;
}
function voyWeakArc(t) { return Object.keys(R.APPROACH).sort((a, b) => R.pdToward(t, C.add(t.pos, voyShipVec(t, R.APPROACH[a]))) - R.pdToward(t, C.add(t.pos, voyShipVec(t, R.APPROACH[b]))))[0]; }
const voyShipVec = (u, v) => { const c = Math.cos(u.yaw), s = Math.sin(u.yaw); return [(v[0] * c - v[2] * s) * 9000, v[1] * 9000, (v[0] * s + v[2] * c) * 9000]; };
function voyWingOrderText(x) { const w = voy.w, o = x.order; if (o.type === 'auto') { const a = x.auto, D = R.doctrineOf(w, x.side); if (!D) return '自動（母艦を直掩）'; return a?.type === 'strike' ? `自動（ドクトリン）：シールドの落ちた${w.units.get(a.target)?.name || '敵艦'}を攻撃` : '自動（ドクトリン）：敵のシールドが落ちるまで母艦を直掩'; } if (o.type === 'standby') return '待機・帰還'; if (o.type === 'strike') return `攻撃：${w.units.get(o.target)?.name || '—'}（${R.APPROACH_NAME[o.approach] || '艦首'}方向から）`; if (o.type === 'cap') return '制空'; if (o.type === 'escort') return `直掩：${w.units.get(o.target)?.name || '—'}`; return ''; }

// ---------- input ----------
function voyGo(where) {
 const w = voy.w;
 if (where === '3d') { voyOrdersClose(); return; }
 if (where === 'ops') { voy.cmd = null; voyShow('ops'); return; }
 if (where === 'side') { voy.side = !voy.side; voyRenderSide(); voyRenderHud(); setTimeout(voyMapResize, 30); return; }
 if (where === 'quit') { voyConfirmQuit(); return; }
 if (where.startsWith('tac:')) {
  const sys = +where.slice(4);if (voy.screen === 'tac' && voy.tac.sys === sys) return;voy.tac = {sys, c: [0, 0], mpp: 300, fitted: false};voy.cmd = null;voy.tab = 'ships';voy.sel.units = [];voy.sel.foe = null;voy.sel.dest = null;voy.split = false;
  // The selected task group stays selected if it is in the battle; else the first of ours there.
  const g = voySelGroup(), c = voySelCtg();if (!(g && voyGroupIn(g, sys)) && !(!g && c && voyCtgGroups(c).some(x => voyGroupIn(x, sys)))) { const h = [...w.groups.values()].find(x => x.side === 0 && voyGroupIn(x, sys)); voy.sel.group = h?.id || null; voy.sel.ctg = h ? R.ctgOf(w, h)?.id || null : null; }
  voy.battleAlert = null;voyShow('tac');
 }
}
function voyConfirmQuit() {
 const el = $('#voySheet');el.hidden = false;
 el.innerHTML = `<div class="voy-sheet-card small" role="dialog" aria-label="艦隊戦を終える"><h3>艦隊戦を終えますか？</h3><p class="note">戦況は保存されません。</p><div class="vs-acts"><button type="button" class="btn" data-vq="setup">編成画面へ</button><button type="button" class="btn" data-vq="title">タイトルへ</button><button type="button" class="btn ghost" data-vq="no">続ける</button></div></div>`;
}
// Orders to whatever is selected on the tactical map: ships, a task group or a combined task group.
function voyApply(o) {
 const w = voy.w, s = voyTacSel();
 if (s.kind === 'ship') for (const u of s.units) R.orderUnit(w, u.id, o);
 else if (o.type === 'group') return;
 else if (s.kind === 'tg') R.orderGroup(w, s.g.id, o);
 else if (s.kind === 'ctg') R.orderCtg(w, s.c.id, o);
}
function voyApplyMove(pt) {
 const w = voy.w, s = voyTacSel();
 if (s.kind === 'ship') { const gz = R.formationGaps(s.units).gz; s.units.forEach((u, i) => { const off = (i - (s.units.length - 1) / 2) * gz; R.orderUnit(w, u.id, {type: 'move', point: [pt[0], u.pos[1], pt[2] + off]}); }); }
 else if (s.kind === 'tg') { const gd = w.units.get(s.g.flag); R.orderGroup(w, s.g.id, {type: 'move', point: [pt[0], gd?.pos[1] || 0, pt[2]]}); }
 else if (s.kind === 'ctg') R.orderCtg(w, s.c.id, {type: 'move', point: pt});
}
function voyApplyAttack(t) {
 const s = voyTacSel();if (!s.kind || !t || t.side === 0) return false;voyApply({type: 'attack', target: t.id});
 toast(`${esc(t.name)}を攻撃（${s.kind === 'ship' ? (s.units.length > 1 ? s.units.length + ' 隻' : esc(s.units[0].name)) : esc((s.g || s.c).name)}）`);return true;
}
// Own ships in t's system that can hold it in a tractor beam, nearest (and idle) first.
function voyTowers(t, from) { const w = voy.w; return (from && from.length ? from : R.systemUnits(w, t.sys).filter(x => x.side === 0)).filter(x => x !== t && x.side === 0 && x.p.trac > 0 && !x.out && R.alive(x) && x.sys === t.sys).sort((a, b) => (!!a.tractor - !!b.tractor) || C.len(C.sub(a.pos, t.pos)) - C.len(C.sub(b.pos, t.pos))); }
function voyTractorOrder(mode, t, from) {
 const w = voy.w, list = voyTowers(t, from);if (!list.length) { toast('トラクター・ビームを持つ艦がいません'); return false; }
 const u = list.find(x => R.tractorOk(x, t, mode)) || list[0], r = R.orderTractor(w, u.id, mode, t.id);
 toast(r.ok ? `${esc(u.name)}：${esc(t.name)}を${mode === 'capture' ? '拿捕' : '牽引'}します` : esc(r.why));return r.ok;
}
// The nearest system by lane with no known enemy and no battle (home systems first among equals).
function voySafe(from) {
 const w = voy.w, S = w.sector, sd = w.sides[0], danger = new Set([...sd.contacts.values()].map(c => c.sys));
 const c = S.systems.filter(s => s.id !== from && !danger.has(s.id) && !w.battles.has(s.id)).map(s => ({s, d: R.routeCost(S, from, s.id) - (sd.home.includes(s.id) ? 30 : 0)})).filter(x => x.d < Infinity).sort((a, b) => a.d - b.d);
 return c[0]?.s.id ?? null;
}
// Withdrawal: the selected ships (as a group of their own), the task group or each task group
// of the combined task group spool their hyperdrives and leave for the nearest safe system.
function voyWithdraw() {
 const w = voy.w, s = voyTacSel();if (!s.kind) return;let gs = [];
 if (s.kind === 'ship') { const g = w.groups.get(s.units[0].group); if (!g) return; const mine = s.units.filter(u => u.group === g.id), all = mine.length === g.units.filter(id => R.alive(w.units.get(id))).length, h = all ? g : R.splitGroup(w, g.id, mine.map(u => u.id), g.name + '離脱隊'); if (!h) { toast('離脱できません（発進準備中か航行中）'); return; } gs = [h]; voySelect({group: h.id}); }
 else if (s.kind === 'tg') gs = [s.g];
 else gs = voyCtgGroups(s.c).filter(g => voyGroupIn(g, voy.tac.sys));
 const msg = [];
 for (const g of gs) { if (g.spool) continue; const dest = voySafe(g.sys); if (dest == null) { msg.push(`${g.name}：安全な星系がありません`); continue; } const r = R.orderJump(w, g.id, dest); msg.push(r.ok ? `${g.name}：${w.sector.systems[dest].name}へ離脱（準備 ${Math.round(g.spool?.need || 0)} 秒）` : `${g.name}：${r.why}`); }
 if (msg.length) toast(esc(msg.slice(0, 2).join(' / ')) + (msg.length > 2 ? ` ほか ${msg.length - 2}` : ''));voyRenderSide();
}
function voySidebarClick(e) {
 const b = e.target.closest('button,input[type=checkbox]');if (!b) return;const d = b.dataset, w = voy.w;if (!w) return;
 if (d.vspeed != null) { voy.speed = +d.vspeed; if (voy.speed) voy.lastSpeed = voy.speed; voyRenderHud(); return; }
 if (d.vgo) { voyGo(d.vgo); return; }
 if (d.vq) { $('#voySheet').hidden = true; if (d.vq === 'setup' || d.vq === 'title') { voyStop3D(); voy.orders = false; voy.w = null; } if (d.vq === 'setup') voyShow('setup'); else if (d.vq === 'title') { voyClose(); showTitle('voyage'); } return; }
 if (d.vresult) { $('#voySheet').hidden = true; if (d.vresult === 'setup' || d.vresult === 'title') { voyStop3D(); voy.orders = false; voy.w = null; voy.result = null; } if (d.vresult === 'setup') voyShow('setup'); else if (d.vresult === 'title') { voyClose(); showTitle('voyage'); } else { voy.resultDismissed = true; if (voy3D()) voyOrdersClose(); } return; }
 if (d.vctg) { voySelect({ctg: d.vctg}); const g = voyCtgGroups(w.ctgs.get(d.vctg))[0]; if (g && voy.screen === 'ops') voyCenterOps(R.groupMapPos(w, g)); voyRenderSide(); return; }
 if (d.vgroup) { voySelect({group: d.vgroup}); const g = w.groups.get(d.vgroup); if (g && voy.screen === 'ops') voyCenterOps(R.groupMapPos(w, g)); else if (g) { const gd = w.units.get(g.flag); if (gd && gd.sys === voy.tac.sys) voyCenterTac(gd.pos, false); } voyRenderSide(); return; }
 if (d.vsplit) { voy.splitSel = voy.splitSel || new Set(); if (b.checked) voy.splitSel.add(d.vsplit); else voy.splitSel.delete(d.vsplit); return; }
 if (d.vmerge) { if (R.mergeGroups(w, voy.sel.group, d.vmerge)) toast('任務群を合流しました'); voyRenderSide(); return; }
 if (d.vsend) { const sys = voy.screen === 'tac' ? voy.tac.sys : voy.sel.sys, r = R.orderJump(w, d.vsend, sys); toast(r.ok ? `${esc(w.groups.get(d.vsend)?.name || '')} を ${esc(w.sector.systems[sys].name)} へ（到着まで ${voyClock(r.eta)}）` : esc(r.why)); voyRenderSide(); return; }
 if (d.vsendc) { const sys = voy.screen === 'tac' ? voy.tac.sys : voy.sel.sys, c = w.ctgs.get(d.vsendc), r = R.orderCtgJump(w, d.vsendc, sys, true); toast(r.ok ? `${esc(c?.name || '')} を ${esc(w.sector.systems[sys].name)} へ（全任務群の到着まで ${voyClock(r.eta)}）` : esc(r.why)); voyRenderSide(); return; }
 if (d.vtrq) { const [mode, id] = d.vtrq.split(':'), t = w.units.get(id); if (t) voyTractorOrder(mode, t); voyRenderSide(); return; }
 if (d.vcarry) { const [what, id] = d.vcarry.split(':'), u = w.units.get(id), r = R.orderCarried(w, id, what); toast(r.ok ? (what === 'launch' ? `${esc(u?.name || '')}から搭載艦 ${r.n} 隻が発進` : `搭載艦 ${r.n} 隻を収容${r.left ? `（あと ${r.left} 隻は遠くにいます）` : ''}`) : esc(r.why)); voyRenderSide(); return; }
 if (d.vrec) { const u = w.units.get(d.vrec), r = R.orderRecover(w, d.vrec); toast(r.ok ? `${esc(u?.name || '')}を後方へ回収（約 ${Math.round(r.eta / 60)} 分で修理を終えて母港に復帰）` : esc(r.why)); if (r.ok) voy.sel.units = voy.sel.units.filter(x => x !== d.vrec); voyRenderSide(); return; }
 if (d.vscuttle) { const id = d.vscuttle, u = w.units.get(id); if (voy.scuttleArm === id && performance.now() < (voy.scuttleAt || 0)) { voy.scuttleArm = null; const r = R.orderScuttle(w, id); toast(r.ok ? `${esc(u?.name || '')}：乗員を退艦させて自沈させました` : esc(r.why)); if (r.ok) voy.sel.units = voy.sel.units.filter(x => x !== id); } else { voy.scuttleArm = id; voy.scuttleAt = performance.now() + 4000; toast('もう一度押すと自沈させます'); } voyRenderSide(); return; }
 if (d.vact) {
  const g = voySelGroup(), c = g ? null : voySelCtg();
  if (d.vact === 'pickdest') { voy.cmd = voy.cmd?.type === 'jump' ? null : {type: 'jump'}; voyRenderSide(); return; }
  if (d.vact === 'nodest') { voy.sel.dest = null; voy.cmd = null; voyRenderSide(); return; }
  if (d.vact === 'jump' && g) { const dest = voy.sel.dest, r = R.orderJump(w, g.id, dest); toast(r.ok ? `${esc(g.name)}：${esc(w.sector.systems[dest].name)}へジャンプ（到着まで ${voyClock(r.eta)}）` : esc(r.why)); voy.sel.dest = null; voy.cmd = null; voyRenderSide(); return; }
  if ((d.vact === 'ctgjump' || d.vact === 'ctgjump1') && c) { const dest = voy.sel.dest, r = R.orderCtgJump(w, c.id, dest, d.vact === 'ctgjump'); toast(r.ok ? `${esc(c.name)}：${esc(w.sector.systems[dest].name)}へ（全任務群の到着まで ${voyClock(r.eta)}）` : esc(r.why)); voy.sel.dest = null; voy.cmd = null; voyRenderSide(); return; }
  if (d.vact === 'cancel') { let late = false; for (const h of g ? [g] : voyCtgGroups(c)) { if (R.cancelJump(w, h.id) === false) late = true; else h.waitJump = null; } if (late) toast('艦が順にジャンプしている最中のため中止できません'); voyRenderSide(); return; }
  if (d.vact === 'split' && g) { if (!voy.split) { voy.split = true; voy.splitSel = new Set(); } else { const h = R.splitGroup(w, g.id, [...voy.splitSel], g.name + '分遣隊'); voy.split = false; if (h) { voySelect({group: h.id}); toast(`${esc(h.name)}を編成しました`); } else toast('分ける艦を選んでください（全艦は選べません）'); } voyRenderSide(); return; }
  if (d.vact === 'nocmd') { voy.cmd = null; voyRenderSide(); return; }
  if (d.vact === 'nofoe') { voy.sel.foe = null; voyRenderSide(); return; }
  if (d.vact.startsWith('cmd:')) { const t = d.vact.slice(4); voy.cmd = voy.cmd?.type === t ? null : {type: t}; voyRenderSide(); return; }
  if (d.vact === 'withdraw') { voyWithdraw(); return; }
  if (d.vact === 'rejoin') { const s = voyTacSel(); if (s.kind === 'tg') for (const id of s.g.units) R.orderUnit(w, id, {type: 'group'}); voyRenderSide(); return; }
  if (d.vact === 'trrelease') { for (const u of voySelUnits(voyTacSel())) if (u.tractor) R.orderTractor(w, u.id, 'release'); voyRenderSide(); return; }
  if (d.vact === 'attackfoe') { voyApplyAttack(w.units.get(voy.sel.foe)); voyRenderSide(); return; }
 }
 if (d.vtab) { voy.tab = d.vtab; voy.cmd = null; voyRenderSide(); return; }
 if (d.vunit && ['guard', 'escort', 'tow'].includes(voy.cmd?.type) && voyTapUnit(w.units.get(d.vunit))) return;
 if (d.vunit) { const id = d.vunit, u = w.units.get(id);voy.sel.foe = null; if (e.shiftKey || voy.multi) { const i = voy.sel.units.indexOf(id); if (i >= 0) voy.sel.units.splice(i, 1); else voy.sel.units.push(id); } else { voySelect({group: u?.group}); voy.sel.units = [id]; } if (u) voyCenterTac(u.pos, false); voyRenderSide(); return; }
 if (d.vfoe) { const u = w.units.get(d.vfoe); if (u) voyCenterTac(u.pos, false); if (['attack', 'strike', 'capture'].includes(voy.cmd?.type)) voyTapUnit(u); else { voy.sel.foe = d.vfoe; voyRenderSide(); } return; }
 if (d.vord) { voyApply({type: d.vord}); voy.cmd = null; voyRenderSide(); return; }
 if (d.vform) { voyApply({formation: d.vform}); voyRenderSide(); return; }
 if (d.vpow) { voyApply({power: d.vpow}); voyRenderSide(); return; }
 if (d.vvol) { voyApply({volley: d.vvol}); voyRenderSide(); return; }
 if (d.vsw) { const s = voyTacSel(), sys = voy.tac.sys, list = voySwShips(s.kind === 'ship' ? s.units : (s.kind === 'tg' ? [s.g] : s.kind === 'ctg' ? voyCtgGroups(s.c) : []).flatMap(g => g.units.map(id => w.units.get(id))).filter(u => u && R.alive(u) && u.sys === sys));
  if (d.vsw === 'free' || d.vsw === 'hold') { for (const u of list) R.orderUnit(w, u.id, {sw: d.vsw === 'free'}); toast(d.vsw === 'free' ? '超兵器：自由発射' : '超兵器：発射待機'); }
  else if (d.vsw.startsWith('mode:')) { const m = d.vsw.slice(5); for (const u of list) u.sw.forEach((x, i) => { if (u.p.sw[i]?.k === 'sbeam' && x.st !== 'beam') x.mode = m; }); toast(m === 'pulse' ? '超重合成ビーム：パルス（一撃）' : '超重合成ビーム：ビーム（照射）'); }
  voyRenderSide(); return; }
 if (d.vaim) { voyApply({aim: d.vaim}); voyRenderSide(); return; }
 if (d.vpilot) { voyPilot(d.vpilot); return; }
 if (d.vspectate != null) { voySpectate(+d.vspectate, d.vfollow || null); return; }
 if (d.vwsel) { voy.sel.wing = voy.sel.wing === d.vwsel ? null : d.vwsel; voy.cmd = null; voyRenderSide(); return; }
 if (d.vwing) { R.orderWing(w, voy.sel.wing, {type: d.vwing}); voy.cmd = null; voyRenderSide(); return; }
 if (d.vappr) { const wing = w.wings.get(voy.sel.wing); if (wing?.order.type === 'strike') R.orderWing(w, wing.id, {...wing.order, approach: d.vappr}); voyRenderSide(); return; }
}
function voyCenterOps(p) { voy.ops.c = [p[0], p[1]]; voy.ops.auto = false; }
function voyCenterTac(p, force) { const c = $('#voyMap'), r = c.getBoundingClientRect(), q = tacP(p, r.width, r.height); if (force || q[0] < 40 || q[1] < 40 || q[0] > r.width - 40 || q[1] > r.height - 40) { voy.tac.c = [p[0], p[2]]; voy.tac.auto = false; } }
// A tap on a ship of the tactical map: the target of a pending order, or a selection —
// the first tap on one of ours picks its task group, the next that ship.
function voyTapUnit(u) {
 const w = voy.w, cmd = voy.cmd;if (!u) return false;
 if (cmd?.type === 'attack' && u.side !== 0) { voyApplyAttack(u); voy.cmd = null; voyRenderSide(); return true; }
 if (cmd?.type === 'strike' && u.side !== 0 && voy.sel.wing) { R.orderWing(w, voy.sel.wing, {type: 'strike', target: u.id, approach: voyWeakArc(u)}); voy.cmd = null; voy.tab = 'wings'; toast(`${esc(w.wings.get(voy.sel.wing).name)}：${esc(u.name)}を攻撃（進入方向は飛行隊の一覧で変えられます）`); voyRenderSide(); return true; }
 if (cmd?.type === 'guard' && u.side === 0) { const s = voyTacSel(), own = s.kind === 'ship' ? s.units.map(x => x.id) : s.g ? s.g.units : []; if (s.kind === 'ship' && own.length === 1 && own[0] === u.id) { toast('護衛する相手には別の艦を選んでください'); return true; } if (s.kind === 'ship') for (const id of own) if (id !== u.id) R.orderUnit(w, id, {type: 'escort', target: u.id}); if (s.kind === 'tg' && !R.orderGroup(w, s.g.id, {type: 'escort', target: u.id})) { toast('自分の任務群の艦は護衛の相手にできません（艦ごとに命令してください）'); return true; } if (s.kind === 'ctg') R.orderCtg(w, s.c.id, {type: 'escort', target: u.id}); toast(`${esc(u.name)}を護衛`); voy.cmd = null; voyRenderSide(); return true; }
 if (cmd?.type === 'escort' && u.side === 0 && voy.sel.wing) { R.orderWing(w, voy.sel.wing, {type: 'escort', target: u.id}); voy.cmd = null; voyRenderSide(); return true; }
 if (cmd?.type === 'tow' && u.side === 0 || cmd?.type === 'capture' && u.side !== 0) { voyTractorOrder(cmd.type, u, voySelUnits(voyTacSel()).filter(x => x.p.trac > 0)); voy.cmd = null; voyRenderSide(); return true; }
 if (cmd) return false;
 if (u.side === 0) {
  voy.sel.foe = null;
  if (voy.multi) { const i = voy.sel.units.indexOf(u.id); if (i >= 0) voy.sel.units.splice(i, 1); else voy.sel.units.push(u.id); }
  else if (voy.sel.units.length === 1 && voy.sel.units[0] === u.id) voy.sel.units = [];
  else if (voy.sel.group === u.group && !voy.sel.units.length) voy.sel.units = [u.id];
  else voySelect({group: u.group});
  voy.tab = 'ships';voyRenderSide();return true;
 }
 voy.sel.foe = u.id;voy.tab = 'ships';voyRenderSide();return true;
}
function voyMapTap(x, y) {
 const w = voy.w, c = $('#voyMap'), r = c.getBoundingClientRect(), W = r.width, H = r.height;
 if (voy.screen === 'ops') {
  const S = w.sector;let best = null, bd = 16;
  if (voy.cmd?.type !== 'jump') for (const m of voy.opsMarks || []) { const dd = Math.hypot(m.x - x, m.y - y); if (dd < bd) { bd = dd; best = m.g; } }
  let sb = null, sd = 18;for (const s of S.systems) { const p = opsP(s.pos, W, H), dd = Math.hypot(p[0] - x, p[1] - y); if (dd < sd) { sd = dd; sb = s; } }
  if (best && (!sb || bd < sd)) { voySelect({group: best}); voyRenderSide(); return; }
  if (sb) {
   const g = voySelGroup(), cg = g ? null : voySelCtg(), away = g ? !g.transit && g.sys !== sb.id : !!cg && voyCtgGroups(cg).some(h => h.sys !== sb.id);
   if ((g || cg) && (voy.cmd?.type === 'jump' || away)) { voy.sel.dest = away ? sb.id : null; voy.cmd = null; }
   else { voy.sel.sys = sb.id; voy.sel.group = null; voy.sel.ctg = null; voy.sel.dest = null; }
   voyRenderSide();return;
  }
  voy.sel.group = null;voy.sel.ctg = null;voy.sel.sys = null;voy.sel.dest = null;voy.cmd = null;voyRenderSide();return;
 }
 // tactical
 const us = R.systemUnits(w, voy.tac.sys).filter(u => !R.pendingWarp(u));let hit = null, hd = 22;
 for (const u of us) { const p = tacP(u.pos, W, H), L = Math.max(9, u.p.len / voy.tac.mpp), dd = Math.hypot(p[0] - x, p[1] - y) - L * .5; if (dd < hd) { hd = dd; hit = u; } }
 let wing = null, wd = 16;if (!voy.cmd || voy.cmd.type === 'strike' || voy.cmd.type === 'cap' || voy.cmd.type === 'escort') for (const m of voy.tacWings || []) { const dd = Math.hypot(m.x - x, m.y - y); if (dd < wd) { wd = dd; wing = m.id; } }
 if (wing && !voy.cmd && (!hit || wd < 7 || wd < hd)) { voy.sel.wing = wing; voy.tab = 'wings'; voyRenderSide(); return; }
 if (hit && voyTapUnit(hit)) return;
 const pt = [voy.tac.c[0] + (x - W / 2) * voy.tac.mpp, 0, voy.tac.c[1] + (y - H / 2) * voy.tac.mpp];
 if (voy.cmd?.type === 'move') { voyApplyMove(pt); voy.cmd = null; voyRenderSide(); return; }
 if (voy.cmd?.type === 'cap' && voy.sel.wing) { R.orderWing(w, voy.sel.wing, {type: 'cap', point: pt, radius: 15000}); voy.cmd = null; voyRenderSide(); return; }
 if (hit || voy.cmd) return;
 // An empty spot: from ships back to their task group, then nothing.
 if (voy.sel.units.length) voy.sel.units = [];else { voy.sel.group = null; voy.sel.ctg = null; }voy.sel.foe = null;voyRenderSide();
}
function voyBindMap() {
 const c = $('#voyMap');if (!c) return;const ptrs = new Map();let start = null, moved = false, pinch = null;
 const pan = (dx, dy) => { (voy.screen === 'tac' ? voy.tac : voy.ops).auto = false; if (voy.screen === 'tac') { voy.tac.c = [voy.tac.c[0] - dx * voy.tac.mpp, voy.tac.c[1] - dy * voy.tac.mpp]; } else { voy.ops.c = [voy.ops.c[0] - dx / voy.ops.k, voy.ops.c[1] - dy / voy.ops.k]; } };
 const zoom = (f, x, y) => { const r = c.getBoundingClientRect(), W = r.width, H = r.height; (voy.screen === 'tac' ? voy.tac : voy.ops).auto = false; if (voy.screen === 'tac') { const t = voy.tac, wx = t.c[0] + (x - W / 2) * t.mpp, wz = t.c[1] + (y - H / 2) * t.mpp; t.mpp = C.clamp(t.mpp / f, 15, 3000); t.c = [wx - (x - W / 2) * t.mpp, wz - (y - H / 2) * t.mpp]; } else { const o = voy.ops, wx = o.c[0] + (x - W / 2) / o.k, wy = o.c[1] + (y - H / 2) / o.k; o.k = C.clamp(o.k * f, .25, 12); o.c = [wx - (x - W / 2) / o.k, wy - (y - H / 2) / o.k]; } };
 c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (ptrs.size === 1) { start = {x: e.clientX, y: e.clientY, t: performance.now()}; moved = false; } else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y)}; moved = true; } });
 c.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = c.getBoundingClientRect(); zoom(d / Math.max(1, pinch.d), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinch.d = d; return; } if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) moved = true; if (moved) pan(dx, dy); });
 const end = e => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size && !moved && start && performance.now() - start.t < 700) { const r = c.getBoundingClientRect(); voyMapTap(e.clientX - r.left, e.clientY - r.top); } };
 c.addEventListener('pointerup', end);c.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch = null; });
 c.addEventListener('wheel', e => { e.preventDefault(); const r = c.getBoundingClientRect(); zoom(Math.exp(-Math.sign(e.deltaY) * Math.min(.3, Math.abs(e.deltaY) * .002)), e.clientX - r.left, e.clientY - r.top); }, {passive: false});
 window.addEventListener('resize', () => { if (voy.open) voyMapResize(); });
 const side = $('#voySide');side.addEventListener('click', voySidebarClick);side.addEventListener('pointerenter', () => { voy.sidePause = true; });side.addEventListener('pointerleave', () => { voy.sidePause = false; });
 $('#voyHud').addEventListener('click', voySidebarClick);$('#voySheet').addEventListener('click', e => { if (voy.screen !== 'setup') voySidebarClick(e); });
 window.addEventListener('keydown', e => { if (!voy.open || voy.screen === 'setup' || trial.on && !voy.orders || e.target.matches('input,textarea,select')) return; if (e.code === 'Space') { e.preventDefault(); voy.speed = voy.speed ? 0 : voy.lastSpeed || 1; if (voy.speed) voy.lastSpeed = voy.speed; voyRenderHud(); } else if (e.key === 'Escape') { if (!$('#voySheet').hidden && voy.result) return; if (voy.cmd) { voy.cmd = null; voyRenderSide(); } else if (voy.screen === 'tac') voyGo('ops'); else if (voy3D()) voyOrdersClose(); } else if (e.code === 'KeyM' && voy3D()) voyOrdersClose(); else if (/^Digit[1-5]$/.test(e.code)) { voy.speed = VOY_SPEEDS[+e.code.slice(5) - 1]; if (voy.speed) voy.lastSpeed = voy.speed; voyRenderHud(); } else if (e.key === 'Shift') voy.multi = true; });
 window.addEventListener('keyup', e => { if (e.key === 'Shift') voy.multi = false; });
}

// ---------- result ----------
function voyShowResult() {
 const w = voy.w, r = w.result;voy.result = r;if (voy.resultDismissed) return;const win = r.winner === 0, el = $('#voySheet');
 // Over the 3D view the result comes with the maps.
 if (voy3D() && !voy.orders) voyOrdersOpen('ops');el.hidden = false;
 const side = i => { const us = [...w.units.values()].filter(u => (u.origSide ?? u.side) === i), sq = [...w.squads.values()].filter(s => s.side === i), taken = us.filter(u => u.captured).length; return `<dt>${esc(w.sides[i].name)}</dt><dd>${us.length} 隻中 撃沈 ${us.filter(u => u.dead).length} · 戦闘不能 ${us.filter(u => !u.dead && u.out && !u.captured).length}${taken ? ` · 拿捕された ${taken}` : ''}${w.sides[i].captured ? ` · 敵艦を拿捕 ${w.sides[i].captured}` : ''} · 艦載機 ${Math.round(sq.reduce((n, s) => n + s.n, 0))} / ${sq.reduce((n, s) => n + s.n0, 0)} 機${voyCraftTally(w, i, us, sq)}</dd>`; };
 el.innerHTML = `<div class="voy-sheet-card small" role="dialog" aria-label="艦隊戦の結果"><b class="vr-big ${win ? 'win' : 'lose'}">${r.winner < 0 ? '痛み分け' : win ? '勝利' : '敗北'}</b><p class="note">${win ? '敵艦隊の戦闘力の4分の3以上を失わせました。' : r.winner < 0 ? '両軍とも戦闘力を失いました。' : '自軍が戦闘力の4分の3以上を失いました。'} 経過 ${voyClock(r.time)}</p><dl class="vr-dl">${side(0)}${side(1)}</dl><div class="vs-acts"><button type="button" class="btn primary" data-vresult="setup">編成画面へ</button><button type="button" class="btn" data-vresult="title">タイトルへ</button><button type="button" class="btn ghost" data-vresult="stay">${voy3D() ? '3D視点で戦場を見る' : '戦場を見る'}</button></div></div>`;
}

// v21.2 Craft shot down by the side (its squadrons in dogfights, its ships' point defence) and lost by it.
function voyCraftTally(w, i, us, sq) { const down = sq.reduce((n, s) => n + (s.kills || 0), 0) + us.reduce((n, u) => n + (u.craftKills || 0), 0), lost = Math.round(sq.reduce((n, s) => n + (s.lostN || 0), 0)); return down || lost ? `（撃墜 ${down} · 喪失 ${lost}）` : ''; }
// ---------- the 3D view: the base of a fleet battle ----------
// A battle is watched in 3D, following a ship of ours (or any ship in the
// system). The 命令 button lays the operational and tactical maps over the
// view to give orders, and 3D視点 lifts them off again; the world runs on one
// clock whichever is showing. A followed ship of ours that jumps takes the
// camera with it: up to sublight with its task group, through the stretching
// stars into the tunnel, and out at the far end, where the scene is rebuilt
// around the system it comes out in.
const voy3D = () => !!(trial.on && trial.rts?.spectate);
const voyCan3D = () => !!view && !renderHealth.lost && !renderRetryTimer && fleet.mode === 'design';
// The ship watched at the start: the flagship of our first combined task group.
function voyLeadShip() {
 const w = voy.w;
 for (const c of w.ctgs.values()) { if (c.side !== 0) continue; for (const g of voyCtgGroups(c)) { const u = [w.units.get(g.flag), ...g.units.map(id => w.units.get(id))].find(x => R.alive(x) && x.sys != null); if (u) return u; } }
 return [...w.units.values()].find(u => u.side === 0 && R.alive(u) && u.sys != null) || null;
}
async function voyEnter3D(sys, uid) {
 const w = voy.w;if (!w || !voyCan3D()) return false;
 if (sys == null || uid == null) { const u = voyLeadShip(); if (!u) return false; sys = u.sys; uid = u.id; }
 return voySpectate(sys, uid);
}
// Stops the 3D view without going back to the maps (to fly a ship, or to leave the battle).
function voyStop3D() { if (!trial.on) return; voy.quiet = true; try { trialStop(); } finally { voy.quiet = false; } }
// The system the 戦術図 tab opens: the one on show, the one the 3D view
// follows, a battle of ours, or the selected task group's.
function voyTacTarget() {
 const w = voy.w;if (!w) return null;if (voy.screen === 'tac' && voy.tac.sys != null) return voy.tac.sys;
 const f = voy3D() && trial.battle && w.units.get(trial.battle.follow);if (f && f.side === 0 && f.sys != null) return f.sys;
 if (voy.tac.sys != null && R.systemUnits(w, voy.tac.sys).some(u => u.side === 0)) return voy.tac.sys;
 const b = [...w.battles.keys()].find(s => R.systemUnits(w, s).some(u => u.side === 0));if (b != null) return b;
 const g = voySelGroup();return g?.sys ?? null;
}
// 命令: the maps over the 3D view (the tactical map of the followed ship's system when it has one).
function voyOrdersOpen(where) {
 if (!voy3D() || !voy.w) return;voy.orders = true;voy.last = 0;$('#voyage').hidden = false;voyToast(true);
 const f = trial.battle && voy.w.units.get(trial.battle.follow);
 // A battle where the view is goes straight to its tactical map; otherwise the operational map.
 if (!where) where = f && f.side === 0 && f.sys != null && !trial.jump?.follow && voy.w.battles.has(f.sys) ? 'tac:' + f.sys : 'ops';
 if (where === 'tac:' + voy.tac.sys && voy.tac.sys != null) voyShow('tac');else voyGo(where);
}
// 3D視点: back to the view.
function voyOrdersClose() {
 if (!voy.orders) return;voy.orders = false;voy.cmd = null;$('#voyage').hidden = true;$('#voySheet').hidden = true;voyToast(false);trial.last = 0;
 if (voy3D()) voySpectateHudUpdate(true);
}

// ---------- flying a ship of a battle ----------
// The piloted ship becomes a manual unit of the battle: the flight model moves
// it, its bolts land as damage on the battle's units, and the battle's fire,
// missiles and squadrons come back at it. The rest of the world keeps running
// on the same clock, at real speed while flying.
async function voyPilot(id) {
 const w = voy.w, u = w.units.get(id);if (!u || !R.alive(u) || u.out || u.sys == null) { toast('この艦は操艦できません'); return; }
 voyStop3D();voy.orders = false;$('#voyage').hidden = false;voyToast(true);
 // The clock waits while the ship's model and guns are made ready.
 loadShow(`${u.name}の3Dモデルと砲塔を準備中…`, '操艦準備');voy.loading = true;
 try {
  const keys = [...new Set([...R.systemUnits(w, u.sys), ...[...w.units.values()].filter(x => x.status === 'carried' && x.sys === u.sys)].map(x => x.design))];
  for (const k of keys) await fleetAsset(k);
  const a = await fleetAsset(u.design);if (!a?.design) throw new Error('設計を準備できません');
  voy.pilot = {uid: id, sys: u.sys};$('#voyage').hidden = true;voyToast(false);
  await trialStart({design: a.design, rts: {w, sys: u.sys, uid: id}, returnTo: 'voyage'});
  voy.loading = false;
  if (!trial.on) throw new Error('操艦を開始できませんでした');
 } catch (e) { console.error(e); voy.loading = false; loadHide(); $('#voyage').hidden = false; voyToast(true); voy.pilot = null; toast('操艦を開始できません：' + esc(e.message || e)); }
}
function voyPilotBusy(on, text) { const el = $('#voyBusy'); if (!el) return; el.hidden = !on; if (on) el.querySelector('span').innerHTML = text || '準備中…'; }
function voyPilotInit() {
 if (trial.rts?.spectate) { voySpectateInit(); return; }
 const {w, sys, uid} = trial.rts, me = w.units.get(uid);me.manual = true;me.order = {...me.order, power: trial.powerMode};trial.volley = C.volleyMode(me);
 // The battle's frame (x east, y up, z south) is laid into the flight's world so
 // the ship keeps its position and heading: forward = its bearing in the battle.
 const up = tv.norm(trial.P), f0 = trialCol(trial.R, 0), E = trialFrame(f0, up), fw = trialApply(E, [Math.cos(me.yaw), 0, Math.sin(me.yaw)]);
 trial.R = trialFrame(fw, up);const O = tv.sub(trial.P, trialApply(E, me.pos));
 trial.V = trialApply(E, me.velocity || [0, 0, 0]);trial.vf = tv.dot(trial.V, fw);
 const B = {rts: true, O, E, acc: 0, extra: new Map(), seen: w.battles.get(sys)?.log.at(-1)?.n || 0, result: null, orderT: 0, me, plan: null, ticker: [], kills: 0, disabled: 0, cined: true, hadBattle: w.battles.has(sys), arrive: new Map(), ghosts: [],
  modIndex: new Map((me.p.modules || []).map((m, i) => [m.fit, i]).filter(([f]) => f != null)), b: {get units() { return R.systemUnits(w, sys); }, get time() { return w.time; }}};
 trial.battle = B;trial.targets = [];trial.vbolts = [];trial.foeCraft = [];trial.foeMissiles = [];trial.ownCraft = [];spaceRefresh();
 let near = null, nd = Infinity;for (const u of R.systemUnits(w, sys)) { if (u.side === me.side || !R.fighting(u)) continue; const d = Math.hypot(u.pos[0] - me.pos[0], u.pos[1] - me.pos[1], u.pos[2] - me.pos[2]); if (d < nd) { nd = d; near = u; } }
 trial.lookAt = near;
}
// Craft and missiles in 3D. v21.2 Near the camera each squadron flies in its formation (R.craftFormation, along
// its heading), one point per craft still flying — the nearest drawn with their 3D models — and fights as the
// battle says: its guns fire at the squadron it is dogfighting, it strafes or bombs the ship of its attack run,
// and point defence fires back. A craft the battle loses is hit by the bolt that got it and blows up where it
// flew, and the rest close up into their new places; point defence shooting one down takes that craft off the
// battle. Far, a squadron or a salvo is one larger point (a battle may carry thousands of craft).
const VOY_NEAR = 26000;
const VOY_CRAFT_MODEL = {tie_ln: 'craft_tie_ln', tie_in: 'craft_tie_in', tie_sa: 'craft_tie_sa', xwing: 'craft_xwing', awing: 'craft_awing', ywing: 'craft_btlb', btlb: 'craft_btlb', z95: 'craft_z95', vulture: 'craft_vulture', hyena: 'craft_hyena', vwing: 'craft_vwing', arc170: 'craft_arc170', v19: 'craft_v19'};
// Bolt colours by faction: the Empire's green (its costlier blaster gas), the Rebellion's red, the clone-era
// Republic's blue and the Separatists' red-orange, as on screen.
const VOY_BOLT = {empire: [120, 255, 130], rebel: [255, 85, 65], republic: [120, 175, 255], cis: [255, 125, 70], neutral: [255, 200, 120]};
const voyBoltCol = (w, side) => VOY_BOLT[w.sides[side]?.faction] || VOY_BOLT.neutral;
const voyCraftModel = c => c ? VOY_CRAFT_MODEL[c] || (R.CRAFT[c]?.ref ? R.CRAFT[c].ref : null) : null;
// How many craft get their 3D model (the nearest ones, a few pixels or more on screen).
const voyCraftModels = () => document.body.classList.contains('touch') || Math.min(innerWidth, innerHeight) < 600 ? 8 : 24;
function voyPilotThreats() {
 const B = trial.battle, {w, sys} = trial.rts, me = B.me || w.units.get(B.follow), world = p => tv.add(B.O, trialApply(B.E, p)), foe = [], own = [], mis = [], P = trial.P;if (!me) return;
 // Watching, the colours are the sides' own (ours blue); flying, they are the pilot's.
 const mine = B.spectate ? 0 : me.side, cf = voyCf(B, w), now = performance.now(), fdt = Math.min(.1, Math.max(0, (now - cf.t) / 1000)), up = trialApply(B.E, [0, 1, 0]), F0 = ++cf.f, tt = now / 1000, k1 = 1 - Math.exp(-fdt * 1.1);cf.t = now;
 // the 3D models: the nearest craft a few pixels or more across on screen
 const eye = view ? tv.add(P, view.eye()) : P, focal = (view?.canvas?.height || 800) / (2 * Math.tan((view?.cam?.fov || .72) / 2)), cand = [];
 for (const s of w.squads.values()) {
  if (s.sys !== sys || (s.state !== 'out' && s.state !== 'return') || s.n <= 0) continue;const n = s.n, c = R.CRAFT[s.craft], h = trialApply(B.E, s.h), v = trialApply(B.E, s.vel), c0 = world(s.pos), team = s.side === mine ? 0 : 1, glow = team ? [255, 110, 80, 230] : [120, 200, 255, 230];
  if (tv.len(tv.sub(c0, P)) > VOY_NEAR) { (team ? foe : own).push({id: s.id, kind: 'craft', pos: c0, vel: v, h, alive: true, team, size: Math.min(46, 12 + Math.sqrt(n) * 3.2), glow, far: true}); continue; }
  let st = cf.sq.get(s.id);if (!st) cf.sq.set(s.id, st = {qs: new Map(), list: [], f: 0});
  const F = trialFrame(h, Math.abs(tv.dot(h, up)) > .97 ? trialApply(B.E, [1, 0, 0]) : up), fw = trialCol(F, 0), uv = trialCol(F, 1), rt = trialCol(F, 2), sl = R.squadSlots(s), fight = w.time - (s.dogfight ?? -99) < 2, A = Math.max(30, (c.dims?.[1] || 10) * 5), list = [], out = team ? foe : own;
  const L = c.dims?.[0] || 10, mk = voyCraftModel(s.craft), dS = Math.hypot(c0[0] - eye[0], c0[1] - eye[1], c0[2] - eye[2]), models = mk && dS < L * focal / 5 + 600;
  for (let i = 0; i < sl.length; i++) {
   const id = sl[i];let q = st.qs.get(id);
   if (!q) { const key = s.id + ':' + id; st.qs.set(id, q = {id: key, kind: 'craft', craft: s.craft, sq: s.id, cid: id, k: -1, off: null, pos: [0, 0, 0], size: c.role === 'bomber' ? 12 : 10, onDown: () => { cf.done.add(key); R.craftDown(w, sys, s, id, 'pd', me.id); }}); }
   // Each craft eases into its place, so the formation closes up when one is lost.
   if (q.k !== i) { q.k = i; q.want = R.craftFormation(i, c.role, c.dims); q.set = false; if (!q.off) { q.off = q.want.slice(); q.set = true; } }
   const o = q.off, wt = q.want;if (!q.set) { let dd = 0; for (let j = 0; j < 3; j++) { o[j] += (wt[j] - o[j]) * k1; dd += Math.abs(wt[j] - o[j]); } if (dd < .3) { o[0] = wt[0]; o[1] = wt[1]; o[2] = wt[2]; q.set = true; } }
   // In a dogfight the formation loosens into weaving pairs.
   let ox = o[0], oy = o[1], oz = o[2];if (fight) { const ph = id * 2.399 + (i & 1) * .3; ox += Math.sin(tt * .9 + ph) * A; oy += Math.sin(tt * 1.3 + ph * 2) * A * .7; oz += Math.cos(tt * .7 + ph) * A * 1.2; }
   const p = q.pos;p[0] = c0[0] + fw[0] * ox + uv[0] * oy + rt[0] * oz;p[1] = c0[1] + fw[1] * ox + uv[1] * oy + rt[1] * oz;p[2] = c0[2] + fw[2] * ox + uv[2] * oy + rt[2] * oz;
   q.vel = v;q.h = fw;q.up = uv;q.alive = true;q.team = team;q.glow = glow;q.model = null;q.f = F0;out.push(q);list.push(q);
   if (models) { const d = Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]); if (L * focal / Math.max(1, d) >= 5) cand.push({q, mk, d}); }
  }
  // Craft gone since the last frame: shot down where they flew (or landed, or out of sight).
  if (st.f === F0 - 1) for (const q of st.list) if (q.f !== F0) voyCraftLost(B, w, s, q.cid, q);
  st.list = list;st.f = F0;
 }
 // Squadrons not drawn this frame: wiped out (their last craft shot down), landed or out of sight.
 for (const [sid, st] of cf.sq) if (st.f !== F0) { const s = w.squads.get(sid); if (st.f === F0 - 1 && s?.state === 'lost') for (const q of st.list) voyCraftLost(B, w, s, q.cid, q); else for (const q of st.list) q.alive = false; st.list = []; if (!s || s.state === 'lost' || F0 - st.f > 600) cf.sq.delete(sid); }
 for (const m of w.missiles) {
  if (m.sys !== sys || m.n <= 0 || (!B.spectate && m.side === me.side)) continue;const n = Math.ceil(m.n), v = trialApply(B.E, m.vel), h = tv.norm(v), c0 = world(m.pos);
  if (tv.len(tv.sub(c0, P)) > VOY_NEAR) { mis.push({id: m.id, kind: 'missile', pos: c0, vel: v, h, alive: true, far: true}); continue; }
  for (let i = 0; i < n; i++) mis.push({id: m.id + ':' + i, kind: 'missile', pos: world(tv.add(m.pos, [((i * 7) % 5 - 2) * 14, ((i * 3) % 4 - 1.5) * 12, ((i * 11) % 5 - 2) * 14])), vel: v, h, alive: true, onDown: () => { m.n = Math.max(0, m.n - 1); m.downed = (m.downed || 0) + 1; }});
 }
 trial.foeCraft = foe;trial.ownCraft = own;trial.foeMissiles = mis;
 voyCraftDraw(B, cand);
 voyCraftFire(B, w, sys, cf, fdt, eye);
}
// The craft view's state for this battle view: each squadron's craft (formation place, position) and those drawn
// last frame, kills already drawn (the gunnery's own), attack runs being flown, the craft still falling.
function voyCf(B, w) {
 if (!B.cf) B.cf = {sq: new Map(), done: new Set(), ghosts: [], runs: [], runT: w.time, t: performance.now(), f: 0, snd: 0};
 trial.cbolts = trial.cbolts || [];return B.cf;
}
// A craft that dropped out of its squadron: if the battle shot it down, the bolt that got it comes in from the
// squadron or ship that did, and it blows up when the bolt arrives; one landed or flown out of sight just goes.
function voyCraftLost(B, w, s, id, q) {
 const cf = B.cf;q.alive = false;if (cf.done.delete(q.id)) return;const d = (s.downs || []).find(x => x.id === id && w.time - x.t < 8);if (!d) return;
 const by = d.why === 'pd' ? w.units.get(d.by) : w.squads.get(d.by);let from = null;
 if (d.why === 'pd') { if (by && R.alive(by) && by.sys === s.sys) from = spaceHullPoint(by, .35); }
 else { const a = d.by != null && cf.sq.get(d.by)?.list; if (a?.length) { const x = a[Math.floor(Math.random() * a.length)]; from = tv.add(x.pos, x.h, 6); } }
 craftKill(cf, q, from, voyBoltCol(w, by ? by.side : 1 - s.side), d.why === 'pd');
}
// The craft keeps flying until the bolt from `from` (none: at once) reaches it, then blows up.
function craftKill(cf, q, from, col, pd) {
 const eye = view ? tv.add(trial.P, view.eye()) : trial.P;if (tv.len(tv.sub(q.pos, eye)) > 15000) return;
 const g = {pos: [...q.pos], vel: q.vel, h: q.h, t: 0, team: q.team, glow: q.glow, size: q.size, kind: 'craft', alive: true, far: false, ghost: true}, sp = pd ? 3400 : 5400;
 if (from) { const dd = tv.sub(g.pos, from), L = tv.len(dd), tof = Math.min(1.2, L / sp); if (L > 1) { g.t = tof; (trial.cbolts || (trial.cbolts = [])).push({pos: from, vel: tv.add(g.vel, tv.scale(dd, 1 / Math.max(.05, tof))), life: tof, len: pd ? 26 : 14, size: pd ? 2.8 : 2, col}); } }
 cf.ghosts.push(g);
}
function voyCraftBoom(p, vel, L) {
 trial.fx.push({pos: p, vel, life: .45, max: .45, size: L * 2.6, col: [255, 240, 210]});
 for (let k = 0; k < 12; k++) trial.fx.push({pos: p, vel: tv.add(vel, tv.norm([Math.random() - .5, Math.random() - .5, Math.random() - .5]), 40 + Math.random() * 120), life: .8, max: .8, size: L * .5, col: [255, 170 + (Math.random() * 60 | 0), 80]});
 sndAt(sndPick('explosion_fighter', 'explosion_small'), p, {gain: .55, near: 400, far: 9000});
}
// The nearest craft are drawn as their 3D models (each type loaded in the background the first time it comes
// near); the rest stay points. The models go into the battle's ship list (spaceDrawUnits).
function voyCraftDraw(B, cand) {
 B.cfDraw = [];if (!view || !cand.length) return;const P = trial.P;voy.cfLoad = voy.cfLoad || new Set();
 cand.sort((a, b) => a.d - b.d);let n = voyCraftModels();
 for (const {q, mk, d} of cand) { if (n <= 0) break; if (!fleet.assets.has(mk)) { if (!voy.cfLoad.has(mk) && d < 8000) { voy.cfLoad.add(mk); fleetAsset(mk).catch(e => console.warn('craft model', mk, e)); } continue; }
  n--;q.model = mk;B.cfDraw.push({key: mk, pos: tv.sub(q.pos, P), rot: trialFrame(q.h, q.up), glow: .85, hatchOpen: 0, dead: false}); }
}
// Fire as the battle has it: squadrons in a dogfight shoot at the squadron they fight, squadrons on an attack run
// strafe (and bombers drop their torpedoes and bombs on) the ship they attack as the battle lands it, and ships
// whose point defence is on craft fire at them.
function voyCraftFire(B, w, sys, cf, fdt, eye) {
 const jobs = {df: [], runs: [], pd: []};
 for (const [sid, st] of cf.sq) { const m = st.list;if (!m.length || st.f !== cf.f) continue;const s = w.squads.get(sid);if (!s || s.state !== 'out' || w.time - (s.dogfight ?? -99) > 1.5 || !s.dfFoe) continue;const fm = cf.sq.get(s.dfFoe)?.list;if (fm?.length) jobs.df.push({m, fm, c: R.CRAFT[s.craft], col: voyBoltCol(w, s.side)}); }
 // attack runs, as the battle records them (w.craftRuns): a burst of a second and a half from every craft
 for (const x of w.craftRuns || []) if (x.sys === sys && x.t > cf.runT) { cf.runs.push({sq: x.sq, to: x.to, left: 1.6, first: true}); cf.runT = Math.max(cf.runT, x.t); }
 for (const r of cf.runs) { r.left -= fdt;const s = w.squads.get(r.sq), u = w.units.get(r.to), m = cf.sq.get(r.sq)?.list;if (!s || !u || !m?.length || r.left <= 0) { r.left = 0; continue; } jobs.runs.push({r, m, u, c: R.CRAFT[s.craft], col: voyBoltCol(w, s.side)}); }
 cf.runs = cf.runs.filter(r => r.left > 0);
 // point defence at craft from every ship firing it (the flown ship's own batteries are its turrets)
 for (const u of R.systemUnits(w, sys)) { if (u.manual || !R.alive(u) || u.out || w.time - (u.pdAt ?? -99) > 1 || !u.pdOn) continue; const m = cf.sq.get(u.pdOn)?.list;if (m?.length) jobs.pd.push({u, m, col: voyBoltCol(w, u.side)}); }
 craftFx(B, cf, fdt, eye, jobs);
}
// The craft's guns and the point defence firing at them, for the 3D view: only near the camera, and only so many
// bolts a frame. jobs.df: a squadron's craft (m) shooting at another's (fm); jobs.runs: craft strafing (bombers:
// torpedoes and bombs first) ship u; jobs.pd: ship u firing at craft m. Then the bolts fly and the craft hit blow up.
function craftFx(B, cf, fdt, eye, jobs) {
 const NEAR2 = 9000 * 9000, near = p => (p[0] - eye[0]) ** 2 + (p[1] - eye[1]) ** 2 + (p[2] - eye[2]) ** 2 < NEAR2, bolts = trial.cbolts || (trial.cbolts = []);let budget = 70;
 const shoot = (from, to, tvel, col, o) => { if (budget <= 0 || bolts.length > 1100) return; budget--; const sp = o.sp || 3400, d0 = tv.sub(to, from), tof = Math.min(2, tv.len(d0) / sp), m = o.miss, aim = tv.add(tv.add(to, tvel || [0, 0, 0], tof), [(Math.random() - .5) * m, (Math.random() - .5) * m, (Math.random() - .5) * m]), d = tv.sub(aim, from), L = tv.len(d); if (L < 1) return; bolts.push({pos: from, vel: tv.add(o.base || [0, 0, 0], tv.scale(d, sp / L)), life: Math.min(2.2, L / sp + (o.over || 0)), len: o.len || 14, size: o.size || 2, col, hit: o.hit || null, torp: o.torp || false}); };
 const pick = a => a?.length ? a[Math.floor(Math.random() * a.length)] : null;
 const noise = (n, k) => { if (!(fdt > 0) || B.result) return 0; const e = n * k * fdt; return Math.floor(e) + (Math.random() < e % 1 ? 1 : 0); };
 let sndN = 0;const pew = (p, name, g) => { if (sndN++ > 1 || performance.now() - cf.snd < 90) return; cf.snd = performance.now(); sndAt(name, p, {gain: g ?? .45, near: 300, far: 6000}); };
 for (const {m, fm, c, col} of jobs.df) { if (!near(m[0].pos)) continue; const heavy = (c.strike || 0) > 150, k = noise(m.length, .9 * Math.min(1.6, c.aa || .5)), o = {sp: 5200, miss: 60, len: heavy ? 18 : 14, size: heavy ? 2.4 : 1.9};
  for (let i = 0; i < k; i++) { const a = pick(m), t = pick(fm); o.base = a.vel; const from = tv.add(a.pos, tv.norm(tv.sub(t.pos, a.pos)), 8); shoot(from, t.pos, t.vel, col, o); if (Math.random() < .5) shoot(tv.add(from, a.up || [0, 1, 0], 3), t.pos, t.vel, col, o); pew(a.pos, 'laser_light'); } }
 for (const {r, m, u, c, col} of jobs.runs) { if (!near(m[0].pos)) continue; const bomber = c.role === 'bomber', uv = spaceVel(u);
  if (r.first) { r.first = false; if (bomber || (c.strike || 0) > 60) for (const a of m) shoot(a.pos, spaceHullPoint(u, .3), uv, [255, 190, 130], {sp: bomber ? 900 : 1400, miss: 4, len: 10, size: 4.2, base: a.vel, hit: u, torp: true}); pew(m[0].pos, bomber ? 'torpedo' : 'laser_light', .6); }
  const k = noise(m.length, bomber ? 2.5 : 6);for (let i = 0; i < k; i++) { const a = pick(m); shoot(tv.add(a.pos, a.h, 6), spaceHullPoint(u, .35), uv, col, {sp: 4800, miss: 6, len: 14, size: 2, base: a.vel, hit: u}); pew(a.pos, 'laser_light'); } }
 for (const {u, m, col} of jobs.pd) { const at = spaceWorld(u);if (!near(at)) continue; const k = noise(1, Math.min(14, 1 + Math.sqrt(Math.max(0, u.p.aa || 0)) * .9)), o = {sp: 3600, miss: 90, len: 34, size: 3, base: spaceVel(u), over: .25};
  for (let i = 0; i < k; i++) { const t = pick(m); shoot(spaceHullPoint(u, .4), t.pos, t.vel, col, o); pew(t.pos, 'point_defense', .35); } }
 // the bolts: lasers flash where they strike a ship; torpedoes and bombs burst on it
 for (const b of bolts) { b.pos = tv.add(b.pos, b.vel, fdt); b.life -= fdt; if (b.torp && Math.random() < .5) trial.fx.push({pos: b.pos, vel: [0, 0, 0], life: .5, max: .5, size: 5, col: [150, 160, 175]});
  if (b.life <= 0 && b.hit) { const sh = b.hit.shield > 0, L = b.torp ? 26 : 7, hv = spaceVel(b.hit); trial.fx.push({pos: b.pos, vel: hv, life: b.torp ? .7 : .25, max: b.torp ? .7 : .25, size: L * (b.torp ? 2 : 1.4), col: sh ? [130, 195, 255] : [255, 190, 110]}); if (b.torp) for (let j = 0; j < 6; j++) trial.fx.push({pos: b.pos, vel: tv.add(hv, tv.norm([Math.random() - .5, Math.random() - .5, Math.random() - .5]), 30 + Math.random() * 80), life: .6, max: .6, size: 8, col: [255, 160 + (Math.random() * 70 | 0), 80]}); } }
 trial.cbolts = bolts.filter(b => b.life > 0);
 // craft hit by the bolt that got them: they blow up as it arrives
 for (const g of cf.ghosts) { g.t -= fdt; g.pos = tv.add(g.pos, g.vel, fdt); if (g.t <= 0) { g.alive = false; voyCraftBoom(g.pos, g.vel, 14); } }
 cf.ghosts = cf.ghosts.filter(g => g.alive);trial.craftGhosts = cf.ghosts;
}
function voyPilotStep(dt) {
 const B = trial.battle;if (!B?.rts || B.left) return;const {w, sys} = trial.rts, me = B.me;
 if (B.result) { R.step(w, dt); B.acc = w.acc; spaceRefresh(); voyPilotThreats(); return; }
 spaceSync();
 for (const [id, x] of B.extra) { const u = w.units.get(id); if (!u) continue; C.combatMerge(u.extra || (u.extra = C.combatIncoming()), u, x); }
 B.extra = new Map();
 const here = R.systemUnits(w, sys), before = new Map(here.map(u => [u.id, {dead: u.dead, out: u.out}])), t0 = w.time;
 R.step(w, dt);B.acc = w.acc;
 // Ships that jumped out streak away; ships coming out of hyperspace stream in, each in its turn.
 for (const u of here) if (u !== me && R.alive(u) && u.sys !== sys) voyGhost(u);
 voyWarpFx(B, w, sys, dt);
 // Bolts from the other ships, one burst per battle step in which they fired.
 if (w.time > t0) { const shots = []; for (const u of R.systemUnits(w, sys)) if (!u.manual) { const x = voyShotOf(u, t0); if (x) shots.push(x); } for (const x of w.swShots || []) if (x.sys === sys && x.t > t0) shots.push({...x, sw: true}); spaceShots(shots); }
 for (const [id, was] of before) { const u = w.units.get(id); if (!u) continue; if (u.dead && !was.dead) { if (u.side !== me.side) B.kills++; } else if (u.out && !was.out && u.side !== me.side) B.disabled++; }
 spaceBumps(R.systemUnits(w, sys).map(u => u.lastBump));spaceBump(me);
 for (const t of trial.turrets) { const i = B.modIndex.get(t.id); t.dead = i != null && me.mods[i] <= 0; }
 for (const l of trial.launchers) { const i = B.modIndex.get(l.id); l.dead = i != null && me.mods[i] <= 0; }
 const log = w.battles.get(sys)?.log || [];let li = log.length;while (li > 0 && log[li - 1].n > B.seen) li--;for (; li < log.length; li++) { const e = log[li];B.seen = e.n;const u = w.units.get(e.id), text = e.text.replace(/^[^：]*：/, ''); spaceLog(text, u ? {...u, team: u.side === me.side ? 0 : 1, manual: u === me} : null); if (u === me && /破壊|停止|誘爆|消失|喪失|戦闘不能|撃沈|崩壊/.test(text)) toast('自艦：' + esc(text)); }
 voyPilotThreats();
 if (me.dead || me.out) { spaceEnd(me.dead ? 'sunk' : 'out'); return; }
 // Flying in a quiet system is just flying; a battle that began (or was on) and is over ends the sortie.
 if (w.battles.has(sys)) B.hadBattle = true;
 else if (B.hadBattle) { const foes = R.systemUnits(w, sys).filter(u => u.side !== me.side); spaceEnd(foes.some(R.fighting) ? 'withdrew' : 'win'); }
 spaceRefresh();
}
// The 3D view has ended (flying a ship, or the view itself). Flying ends back
// in the 3D view, following the ship that was flown; the maps are shown when
// there is no 3D view to go back to.
function voyPilotEnd() {
 const p = voy.pilot;voy.pilot = null;if (voy.w && p && p.uid != null) { const u = voy.w.units.get(p.uid); if (u) { u.manual = false; u.extra = null; } }
 trial.foeCraft = [];trial.ownCraft = [];trial.foeMissiles = [];trial.cbolts = [];trial.craftGhosts = [];voy.orders = false;
 if (!voy.w || voy.quiet) return;
 if (p && !p.spectate && voyCan3D()) { const u = voy.w.units.get(p.uid), ok = u && R.alive(u) && u.sys != null; voyEnter3D(ok ? u.sys : null, ok ? u.id : null).then(r => { if (!r && !trial.on) voyShowMaps(p); }); return; }
 voyShowMaps(p);
}
function voyShowMaps(p) { if (!voy.w) return; voy.orders = false; $('#voyage').hidden = false; voyToast(true); voyGo(p && p.sys != null && (voy.w.battles.has(p.sys) || R.systemUnits(voy.w, p.sys).length) ? 'tac:' + p.sys : 'ops'); }

// ---------- watching in 3D ----------
// Every ship fights under its commander's orders; the camera follows any ship
// of either side (tap a bracket, or step through them), or stays free.
async function voySpectate(sys, followId) {
 const w = voy.w;if (!w || sys == null) return false;
 // Already in 3D: close the maps and follow the ship (in whatever system it is).
 if (voy3D()) { voyOrdersClose(); const u = (followId != null && w.units.get(followId)) || R.systemUnits(w, sys).find(x => x.side === 0 && !x.out) || R.systemUnits(w, sys)[0]; if (u) voySpectateSwitch(u); return true; }
 voyStop3D();
 const us = R.systemUnits(w, sys).filter(u => R.alive(u));
 if (!us.length) { toast('この星系に艦がいません'); return false; }
 const first = (followId != null && us.find(u => u.id === followId)) || us.find(u => u.side === 0 && !u.out) || us[0];
 $('#voyage').hidden = false;voyToast(true);voy.orders = false;voy.loading = true;
 loadShow('3D視点の準備中…（この星系の艦の3Dモデル）', `${w.sector.systems[sys]?.name || ''}星系`);
 try {
  for (const k of [...new Set([...R.systemUnits(w, sys), ...[...w.units.values()].filter(x => x.status === 'carried' && x.sys === sys)].map(x => x.design))]) await fleetAsset(k);
  const a = await fleetAsset(first.design);if (!a?.design) throw new Error('設計を準備できません');
  voy.pilot = {uid: null, sys, spectate: true};$('#voyage').hidden = true;voyToast(false);
  await trialStart({design: a.design, rts: {w, sys, uid: first.id, spectate: true}, returnTo: 'voyage'});
  voy.loading = false;
  if (!trial.on) throw new Error('3D視点を開始できませんでした');
  return true;
 } catch (e) { console.error(e); voy.loading = false; loadHide(); $('#voyage').hidden = false; voyToast(true); voy.pilot = null; toast('3D視点を開始できません：' + esc(e.message || e)); return false; }
}
// The planet and sun of a system of the sector, as the 3D views draw them.
// Ships hold above the haze of the planet's limb: higher over a gas giant, so
// that its glow does not wash over the sky.
function voySysDesc(w, id) {
 const sy = w.sector.systems[id], radius = sy.planet?.radius || 6e6;
 return {key: 'rts', name: sy.name, note: sy.note || '', short: sy.name, planet: {radius, kind: sy.planet?.kind ?? 1, axis: sy.planet?.ring ? [-Math.cos(20 * Math.PI / 180), Math.sin(20 * Math.PI / 180), 0] : [0, 0, 1], ring: sy.planet?.ring || null}, altitude: Math.max(200000, radius * .04), floor: 60000, sun: [-0.384, 0.5, 0.776], map: [0, 0]};
}
function voySpectateInit(snap = true) {
 const {w, sys, uid} = trial.rts, f = w.units.get(uid) && w.units.get(uid).sys === sys ? w.units.get(uid) : R.systemUnits(w, sys).find(R.alive);
 const up = tv.norm(trial.P), E = trialFrame(trialCol(trial.R, 0), up), O = tv.sub(trial.P, trialApply(E, f.pos));
 const B = {rts: true, spectate: true, hadBattle: w.battles.has(sys), O, E, acc: 0, extra: new Map(), seen: w.battles.get(sys)?.log.at(-1)?.n || 0, result: null, me: null, follow: f.id, ticker: [], kills: 0, disabled: 0, cined: true, modIndex: new Map(), arrive: new Map(), ghosts: [], b: {get units() { return R.systemUnits(w, sys); }, get time() { return w.time; }}};
 // Ships still coming out of hyperspace as the view opens arrive as seen from outside.
 for (const u of R.systemUnits(w, sys)) if (u.warp && u.warp.t >= 0) B.arrive.set(u.id, {t: Math.min(.9, u.warp.t)});
 trial.battle = B;trial.targets = [];trial.vbolts = [];trial.foeCraft = [];trial.ownCraft = [];trial.foeMissiles = [];
 voySpectateFollow(f, snap);spaceRefresh();
}
// The camera sits on the followed ship: its position, motion and heading.
function voySpectateFollow(u, snap) {
 const B = trial.battle;B.follow = u.id;trial.camLen = u.p.len;
 const P = spaceWorld(u), up = tv.norm(P), fw = trialApply(B.E, [Math.cos(u.yaw), 0, Math.sin(u.yaw)]);
 trial.P = P;trial.V = spaceVel(u);trial.vf = tv.len(trial.V);trial.R = trialFrame(fw, up);
 if (snap && view) { view.cam.r = trialCamRange(u.p.len * 1.7 + 320); view.cam.ph = TRIAL_CAM_PH; trial.camF = null; }
}
// The scene moves to the system u is in: its planet, and a frame anchored on u.
function voySpectateRebase(u) {
 const w = voy.w;trial.rts.sys = u.sys;trial.rts.uid = u.id;SYSTEMS.rts = voySysDesc(w, u.sys);trial.sysKey = 'rts';
 const s = trialSys();trial.P = [0, s.planet.radius + s.altitude, 0];trial.R = [1, 0, 0, 0, 1, 0, 0, 0, 1];trial.V = [0, 0, 0];trial.w = [0, 0, 0];
 trial.bolts = [];trial.vbolts = [];trial.fx = [];trial.wrecks = [];trial.missiles = [];trial.hitcam = null;trialDust();spaceCineEnd();
 voySpectateInit(false);
}
// Follow u wherever it is: in this system, another one, or in hyperspace.
function voySpectateSwitch(u) {
 const B = trial.battle;if (!B?.spectate || !u || !R.alive(u)) return;
 if (trial.jump?.follow) trial.jump = null;
 if (u.sys == null) { if (u.side === 0) voyFollowTransit(u); return; }
 if (u.sys !== trial.rts.sys) voySpectateRebase(u);
 voySpectateFollow(u, true);voySpectateHudUpdate(true);
}
function voySpectateNext(dir) {
 const {w, sys} = trial.rts, B = trial.battle, side = voy.specSide || 'all';
 const us = R.systemUnits(w, sys).filter(u => R.alive(u) && !u.warp && (side === 'all' || (side === 'own') === (u.side === 0))).sort((a, b) => a.side - b.side || b.p.len - a.p.len || (a.id > b.id ? 1 : -1));
 if (!us.length) return null;const i = us.findIndex(u => u.id === B.follow);return us[(((i < 0 ? 0 : i + dir) % us.length) + us.length) % us.length];
}
// ---------- through hyperspace with the followed group ----------
// The group has just left: the camera rides with the ship up to sublight and
// into the tunnel, its group mates keeping station around it.
// v20.6 The group jumps one ship after another: mates that went ahead (or go after) are met again
// in the tunnel, at their places around the ship.
function voyFollowDepart(f, mates, ahead = []) {
 const B = trial.battle, P = spaceWorld(f), fw = trialApply(B.E, [Math.cos(f.yaw), 0, Math.sin(f.yaw)]), g = voy.w.groups.get(f.group);
 trial.P = P;trial.R = trialFrame(fw, tv.norm(P));trial.V = [0, 0, 0];spaceCineEnd();
 trial.jump = {phase: 'accel', t: 0, follow: true, uid: f.id, gid: f.group, dest: g?.transit?.to ?? g?.spool?.dest ?? null, dir: fw, v0: Math.max(300, f.p.maxSpeed || 0), rot: spaceRot(B.E, f.yaw), P0: P, mates: [...mates.map(u => ({u, off: tv.sub(spaceWorld(u), P), rot: spaceRot(B.E, u.yaw)})), ...ahead.map(u => ({u, off: tv.sub(spaceWorld(u), P), rot: spaceRot(B.E, u.yaw), tunnel: true}))]};
}
// Picked up while already in hyperspace: straight into the tunnel.
function voyFollowTransit(u) {
 const w = voy.w, B = trial.battle, g = w.groups.get(u.group), P0 = trialApply(B.E, u.pos);
 B.follow = u.id;trial.camLen = u.p.len;trial.camF = null;
 if (view) { view.cam.r = trialCamRange(u.p.len * 1.7 + 320); view.cam.ph = TRIAL_CAM_PH; }
 const mates = (g?.units || []).map(id => w.units.get(id)).filter(x => x && x !== u && R.alive(x) && x.sys == null);
 trial.jump = {phase: 'tunnel', t: .4, end: null, follow: true, uid: u.id, gid: u.group, dest: g?.transit?.to ?? null, dir: trialCol(trial.R, 0), rot: trial.R.slice(), mates: mates.map(x => ({u: x, off: tv.sub(trialApply(B.E, x.pos), P0), rot: trial.R.slice()}))};
}
// Each frame of the ride. Coming out, the scene is rebuilt around the
// destination while the tunnel still covers it, and the camera comes in from
// sublight to the ship's place among its group.
function voyFollowStep(j, dt) {
 const w = voy.w, f = w.units.get(j.uid);
 if (!f || !R.alive(f)) { trial.jump = null; return; }
 if (j.phase === 'accel' || j.phase === 'enter') trialSublight(dt);
 else if (j.phase === 'tunnel' && !j.arrived && f.sys != null && !R.pendingWarp(f)) {
  // Out with it come only the ships of its turn; the rest of the group stream in after, seen from outside.
  const t0 = f.warp?.t ?? 1;j.with = new Set(R.systemUnits(w, f.sys).filter(u => u === f || u.group === j.gid && u.warp && Math.abs(u.warp.t - t0) < 1e-3).map(u => u.id));
  j.arrived = true;voySpectateRebase(f);const B = trial.battle;
  j.dir = trialApply(B.E, [Math.cos(f.yaw), 0, Math.sin(f.yaw)]);j.v1 = Math.max(150, (f.p.maxSpeed || 0) * .3);j.end = Math.max(j.t, 1.2) + JUMP.close;j.mates = [];
  trial.R = trialFrame(j.dir, tv.norm(spaceWorld(f)));trial.camF = trialFrame(j.dir, tv.norm(spaceWorld(f)));
 }
 if (j.arrived) { j.to = spaceWorld(f); if (j.phase === 'arrive') { trial.P = j.to; trial.V = spaceVel(f); } else trialReversion(); }
}
// The followed group as drawn during the ride: around the camera on the way
// out and in the tunnel; at its true places, set back along the line of
// approach, on the way in.
const VOY_HYPER_SEP = 60000;   // m of tunnel per second between two ships' entries (v21.2)
function voyFollowDraw(j) {
 const w = voy.w, f = w.units.get(j.uid);if (!f) return [];
 const row = (u, pos, rot) => ({key: u.key, pos, rot, glow: .9, hatchOpen: 0, dead: false, stretch: 1, flash: 0});
 // v21.2 In the tunnel the group is strung out in the order it went in: each mate ahead (or behind) by the time
 // between its entry and ours, at hyperspace pace — so far that the others are hardly to be seen.
 const tf = f.hyperT, hs = (m, off) => { if (j.phase !== 'tunnel' || tf == null || m.u.hyperT == null || !j.dir) return off; const al = tv.dot(off, j.dir); return tv.add(tv.add(off, j.dir, -al), j.dir, (tf - m.u.hyperT) * VOY_HYPER_SEP); };
 if (!j.arrived) return [row(f, [0, 0, 0], j.rot), ...j.mates.filter(m => R.alive(m.u) && (!m.tunnel || j.phase === 'tunnel')).map(m => row(m.u, hs(m, m.off), m.rot))];
 const B = trial.battle, back = tv.scale(j.dir, -trialRevDist(j));
 return R.systemUnits(w, trial.rts.sys).filter(u => j.with?.has(u.id)).map(u => row(u, tv.sub(tv.add(spaceWorld(u), back), trial.P), spaceRot(B.E, u.yaw)));
}
// A ship leaving a system that the camera does not follow: seen from outside,
// it stretches and is gone.
// What a ship fired in the step just run: its last tick's fire, or a salvo it fired earlier in the step
// (several ticks run in one frame when time is sped up, and a salvo lands on one of them only).
function voyShotOf(u, t0) {
 const v = u.lastSalvo;if (v && v.t > t0) return {from: u.id, to: v.to, gun: v.gun, ion: v.ion, salvo: true};
 const s = u.lastShot;return s && !s.salvo ? {from: u.id, to: s.to, gun: s.gun, ion: s.ion} : null;
}
function voyGhost(u) { const B = trial.battle, p = spaceWorld(u); B.ghosts.push({key: u.key, w: p, rot: spaceRot(B.E, u.yaw), f: trialApply(B.E, [Math.cos(u.yaw), 0, Math.sin(u.yaw)]), L: u.p.len, t: 0}); sndAt('hyperspace_out', p, {gain: .45, far: 90000}); }
// Ships coming out of hyperspace, each when its turn comes (warp.t from 0), timed on the screen's clock;
// and the streaks of ships that jumped out, fading.
function voyWarpFx(B, w, sys, dt, skip) {
 for (const u of R.systemUnits(w, sys)) if (u.warp && u.warp.t >= 0 && !B.arrive.has(u.id) && !skip?.(u)) { B.arrive.set(u.id, {t: 0}); sndAt('hyperspace_in', spaceWorld(u), {gain: .5, far: 90000}); }
 for (const [id, a] of B.arrive) { a.t += dt; if (a.t > 1.2 && !w.units.get(id)?.warp) B.arrive.delete(id); }
 for (const g of B.ghosts) g.t += dt;B.ghosts = B.ghosts.filter(g => g.t < .8);
}
function voySpectateStep(dt) {
 const B = trial.battle;if (!B?.spectate) return;const w = trial.rts.w, sys = trial.rts.sys, here = R.systemUnits(w, sys), before = new Map(here.map(u => [u.id, {dead: u.dead}])), t0 = w.time;
 voyTick(dt);if (!trial.on || trial.battle !== B) return;B.acc = w.acc;
 const j0 = trial.jump?.follow ? trial.jump : null, away = j0 && !j0.arrived;
 // Ships that left: a followed ship of ours takes the camera with its task group; the rest streak away.
 const gone = here.filter(u => R.alive(u) && u.sys !== sys);
 if (gone.length) {
  const f = w.units.get(B.follow), fly = !j0 && f && f.side === 0 && f.sys == null && gone.includes(f) ? gone.filter(u => u.group === f.group) : [];
  if (fly.length) { const ahead = (w.groups.get(f.group)?.units || []).map(id => w.units.get(id)).filter(x => x && R.alive(x) && x.sys == null && !fly.includes(x)); voyFollowDepart(f, fly.filter(u => u !== f), ahead); }
  for (const u of gone) if (!fly.includes(u)) { voyGhost(u); if (away && u.group === j0.gid && j0.P0) j0.mates.push({u, off: tv.sub(spaceWorld(u), j0.P0), rot: spaceRot(B.E, u.yaw), tunnel: true}); }
 }
 if (!away) {
  if (w.time > t0) { const shots = []; for (const u of R.systemUnits(w, sys)) { const x = voyShotOf(u, t0); if (x) shots.push(x); } for (const x of w.swShots || []) if (x.sys === sys && x.t > t0) shots.push({...x, sw: true}); spaceShots(shots); }
  spaceBumps(R.systemUnits(w, sys).map(u => u.lastBump));
  const log = w.battles.get(sys)?.log || [];let li = log.length;while (li > 0 && log[li - 1].n > B.seen) li--;
  for (; li < log.length; li++) { const e = log[li], u = w.units.get(e.id);B.seen = e.n;spaceLog(e.text.replace(/^[^：]*：/, ''), u ? {...u, manual: false} : null); }
 }
 // Ships coming out of hyperspace, timed on the screen's clock.
 // (while the camera rides with a group through hyperspace, its group's arrivals wait for the ride to come out)
 const jr = trial.jump?.follow ? trial.jump : null;
 voyWarpFx(B, w, sys, dt, u => jr && (jr.arrived ? jr.with?.has(u.id) : u.group === jr.gid));
 const j = trial.jump;
 if (j?.follow) voyFollowStep(j, dt);
 else {
  let f = w.units.get(B.follow);
  // Ours elsewhere (gone while the maps were up): follow it there; anyone else is let go.
  if (f && R.alive(f) && f.side === 0 && f.sys !== sys) { voySpectateSwitch(f); f = null; }
  else if (!f || f.dead || f.sys !== sys) {
   // A followed ship that is lost: the camera stays with its wreck a few seconds before moving on.
   if (f?.dead && f.sys === sys && (!B.hold || B.hold.id !== f.id)) { B.hold = {id: f.id, t: 0}; toast(`${esc(f.name)}は${f.fate === 'scuttle' ? '自沈しました' : f.fate === 'fall' ? '大気圏に落下しました' : '撃沈されました'}`); }
   if (B.hold && f && B.hold.id === f.id && (B.hold.t += dt) < 6) { trial.P = tv.add(trial.P, trial.V, dt); f = null; }
   else { B.hold = null; const next = voySpectateNext(1); if (next && next !== f) { if (f && !f.dead) toast(`${esc(f.name)}は星系を離れました — ${esc(next.name)}を追います`); f = next; voySpectateFollow(f, true); } } }
  if (f && !f.dead && f.sys === trial.rts.sys && !trial.jump) voySpectateFollow(f, false);
 }
 if (trial.jump?.follow && !trial.jump.arrived) { trial.foeCraft = []; trial.ownCraft = []; trial.foeMissiles = []; } else voyPilotThreats();
 spaceRefresh();
 const B2 = trial.battle, s2 = trial.rts.sys;
 if (w.battles.has(s2)) B2.hadBattle = true;
 else if (B2.hadBattle && !B2.over) { B2.over = true; toast('この星系の戦闘は終わりました'); }
}
function voySpectateCmd(c) {
 const B = trial.battle;if (!B?.spectate) return;const {w} = trial.rts;
 if (c === 'orders') { voyOrdersOpen(); return; }
 if (c === 'alert') { const s = voy.battleAlert, u = s != null && R.systemUnits(w, s).find(x => x.side === 0 && !x.out); if (u) voySpectateSwitch(u); voy.battleAlert = null; voySpectateHudUpdate(true); return; }
 if (c === 'next' || c === 'prev') { if (trial.jump?.follow) return; const u = voySpectateNext(c === 'next' ? 1 : -1); if (u) voySpectateFollow(u, true); }
 else if (c === 'side') { if (trial.jump?.follow) return; voy.specSide = {all: 'own', own: 'foe', foe: 'all'}[voy.specSide || 'all']; const u = voySpectateNext(0); if (u && (voy.specSide === 'all' || (voy.specSide === 'own') === (u.side === 0))) voySpectateFollow(u, true); }
 else if (c === 'cam') { trial.specCam = trial.specCam === 'free' ? 'chase' : 'free'; }
 else if (c.startsWith('speed:')) { voy.speed = +c.slice(6) || 0; if (voy.speed) voy.lastSpeed = voy.speed; }
 else if (c.startsWith('follow:')) { if (trial.jump?.follow) return; const u = w.units.get(c.slice(7)); if (u && R.alive(u)) voySpectateFollow(u, true); }
 voySpectateHudUpdate(true);
}
// Keys in the 3D view: Space pauses, 1–5 set the clock, M (or Esc) opens the
// maps, ←/→ step through the ships, V switches the camera, H takes a picture.
function voySpectateKey(e) {
 const k = e.code;
 if (k === 'Space') { voySpectateCmd('speed:' + (voy.speed ? 0 : voy.lastSpeed || 1)); return true; }
 if (/^Digit[1-5]$/.test(k)) { voySpectateCmd('speed:' + VOY_SPEEDS[+k.slice(5) - 1]); return true; }
 if (k === 'KeyM' || k === 'Escape' || k === 'KeyJ') { if (!e.repeat) voyOrdersOpen(); return true; }
 if (k === 'ArrowLeft' || k === 'ArrowRight') { voySpectateCmd(k === 'ArrowLeft' ? 'prev' : 'next'); return true; }
 if (k === 'KeyV') { voySpectateCmd('cam'); return true; }
 if (k === 'KeyH' && !e.repeat) { trialCommand('shot'); return true; }
 return false;
}
function voySpectateHudHTML() {
 return `<div class="th-top"><div class="th-card th-bar spec-bar"><div class="th-id"><span>3D視点</span><b data-sp="name">—</b><small data-sp="where"></small></div>
  <div class="spec-follow" role="group" aria-label="追尾する艦" title="追尾する艦（← → キー）"><button type="button" class="th-btn" data-spec="prev" aria-label="前の艦">◀</button><button type="button" class="th-btn" data-spec="side" data-sp="side">全艦</button><button type="button" class="th-btn" data-spec="next" aria-label="次の艦">▶</button></div></div>
  <div class="th-actions"><div class="spec-speed" role="group" aria-label="時間の速さ" title="時間の速さ（1〜5 キー、Space で一時停止）">${VOY_SPEEDS.map(k => `<button type="button" class="th-btn" data-spec="speed:${k}" aria-pressed="false" aria-label="${k ? '時間 ' + k + ' 倍' : '一時停止'}">${k ? k + '×' : '❚❚'}</button>`).join('')}</div><button type="button" class="th-btn" data-spec="cam" data-sp="cam">視点 追尾</button><button type="button" class="th-btn" data-trial-cmd="shot">撮影</button><button type="button" class="th-btn snd-btn" data-trial-cmd="mute" data-sound-toggle aria-pressed="false" aria-label="音を切る"><svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="snd-wave" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/><path class="snd-x" d="M16 9l5 6M21 9l-5 6"/></svg></button></div></div>
 <p class="th-records" data-sp="records"></p><button type="button" class="th-btn spec-alert" data-spec="alert" data-sp="alert" hidden></button>
 <div class="th-flash" data-th="flash" aria-hidden="true"></div><p class="th-hyper" data-sp="hyper" hidden aria-live="polite"></p>
 <div class="th-tmarks" aria-hidden="true"></div><div class="th-hitcam" data-th="hitcam" hidden><canvas></canvas></div>
 <ol class="spec-log" data-sp="log"></ol>
 <button type="button" class="spec-orders" data-spec="orders" aria-label="命令 — 作戦図と戦術図を開く（M）"><b>命令</b><small>作戦図・戦術図<kbd>M</kbd></small></button>`;
}
// The status line of the followed ship's jump: its spool, then the ride.
function voySpectateHyperText(f) {
 const w = voy.w, j = trial.jump, g = f && w.groups.get(f.group), S = w.sector.systems;
 if (j?.follow) {
  const d = j.dest != null ? S[j.dest]?.name || '' : '';
  if (j.phase === 'tunnel' && !j.arrived) { const tr = g?.transit; return {phase: 'tunnel', text: `ハイパースペース航行中${d ? ' · ' + d + 'まで' : ''}${tr ? ' ' + voyClock(Math.max(0, tr.t1 - w.time)) : ''}`}; }
  return {phase: j.phase, text: trialHyperText(j, d, Infinity)};
 }
 if (f && f.side === 0 && f.jump && g?.spool) { const sp = g.spool; return {phase: 'spool', text: `ハイパードライブ充填中 · ${S[sp.dest]?.name || ''}へ あと ${Math.ceil(Math.max(0, sp.need - sp.t))} 秒${sp.blocked ? '（被弾中で停止）' : ''}`}; }
 return null;
}
function voySpectateHudUpdate(full) {
 const hud = $('#trialHud'), B = trial.battle;if (!hud || !B?.spectate) return;const {w, sys} = trial.rts, q = k => hud.querySelector(`[data-sp="${k}"]`), set = (k, v) => { const e = q(k); if (e && e.textContent !== v) e.textContent = v; };
 const f = w.units.get(B.follow), us = R.systemUnits(w, sys), own = us.filter(u => u.side === 0), foe = us.filter(u => u.side !== 0), up = l => l.filter(R.fighting).length, bt = w.battles.get(sys), ride = trial.jump?.follow && !trial.jump.arrived;
 if (f) { set('name', `${f.side === 0 ? '' : '敵 '}${f.name}`); set('where', `${R.FACTIONS[w.sides[f.side].faction]?.short || ''} · ${voyUnitState(f)} · シールド ${Math.round(f.shield / Math.max(1, f.shieldMax) * 100)}% · 構造 ${Math.round(R.unitStruct(f) * 100)}%${voySwBrief(f)}`); }
 set('records', ride ? `${w.groups.get(f?.group)?.name || ''} · ハイパースペース · 経過 ${voyClock(w.time)}` : `${w.sector.systems[sys].name}　自軍 ${up(own)}/${own.length} 隻 · 敵 ${up(foe)}/${foe.length} 隻${bt ? ` · 交戦 ${voyClock(w.time - bt.t0)}` : B.hadBattle ? ' · 戦闘終了' : ' · 交戦なし'} · 経過 ${voyClock(w.time)}`);
 set('side', {all: '全艦', own: '自軍', foe: '敵艦'}[voy.specSide || 'all']);set('cam', trial.specCam === 'free' ? '視点 自由' : '視点 追尾');
 for (const b of hud.querySelectorAll('[data-spec^="speed:"]')) b.setAttribute('aria-pressed', String(+b.dataset.spec.slice(6) === voy.speed));
 for (const b of hud.querySelectorAll('[data-spec="prev"],[data-spec="next"],[data-spec="side"]')) b.disabled = !!trial.jump?.follow;
 const hy = q('hyper'), ht = voySpectateHyperText(f);if (hy) { hy.hidden = !ht; if (ht) { if (hy.textContent !== ht.text) hy.textContent = ht.text; hy.dataset.phase = ht.phase; } }
 const al = q('alert'), as = voy.battleAlert, show = as != null && w.battles.has(as) && as !== sys && !ride;if (al) { al.hidden = !show; if (show) { const t = `交戦中：${w.sector.systems[as].name} ▸`; if (al.textContent !== t) al.textContent = t; } }
 const lg = q('log');if (lg) { const html = B.ticker.slice(-4).reverse().map(t => `<li><span>${voyClock(t.t)}</span>${esc(t.text)}</li>`).join(''); if (full || lg.innerHTML !== html) lg.innerHTML = html; }
}

// ---------- penetration records and their replay ----------
// The 3D view replays what the piloted or followed ship takes and deals; the
// tactical map lists each ship's last penetrations, any of which plays in a sheet.
function voyOnHit(u, rec, sys) {
 if (!trial.on || !trial.rts || trial.rts.sys !== sys) return;const B = trial.battle;if (!B) return;
 const id = B.me ? B.me.id : B.follow;if (id == null) return;
 if (u.id === id) hitcamOffer(u, rec, 'taken'); else if (String(rec.src) === String(id)) hitcamOffer(u, rec, 'dealt');
}
function voyHitText(rec) { const lost = rec.path.filter(s => s.after <= 0 && s.before > 0).map(s => s.name); return `${C.COMBAT_FACE[rec.face] || ''} ${C.SECTION_NAMES[rec.sec] || ''} · ${rec.path.length ? '貫通' : '非貫通'}${lost.length ? ' → ' + lost.slice(0, 2).join('・') + ' 破壊' : rec.path.length ? ' → ' + rec.path[0].name : ''}${rec.boom ? ' · 誘爆' : ''}${rec.fire ? ' · 火災' : ''}`; }
function voyHitLogHTML(u) {
 const L = u.hitLog || [];if (!L.length) return '';const n = L.length;
 return `<p class="vs-sub">被弾記録（貫通）</p><ul class="vs-hits">${L.slice(-6).reverse().map((r, i) => `<li><button type="button" data-vhit="${u.id}:${n - 1 - i}"><span>${voyClock(r.t)}</span>${esc(voyHitText(r))}<b aria-hidden="true">▶</b></button></li>`).join('')}</ul>`;
}
function voyHitReplay(uid, idx) {
 const w = voy.w, u = w?.units.get(uid), rec = u?.hitLog?.[idx];if (!rec) return;const el = $('#voySheet'), src = rec.src != null ? w.units.get(String(rec.src)) : null;
 el.hidden = false;el.innerHTML = `<div class="voy-sheet-card hitcam-card" role="dialog" aria-label="被弾リプレイ"><canvas class="hitcam-cv"></canvas><div class="vs-acts"><button type="button" class="btn sm" data-vhitplay>もう一度</button><button type="button" class="btn sm ghost" data-vhitclose>閉じる</button></div></div>`;
 voy.replay = {cv: el.querySelector('canvas'), u, rec, t0: performance.now(), title: `${u.side === 0 ? '' : '敵 '}${shipTag(u.name)} · 被弾 ${voyClock(rec.t)}`, sub: src ? `${src.side !== 0 ? '敵 ' : ''}${shipTag(src.name)} から` : ''};
 const loop = now => { const q = voy.replay; if (!q || el.hidden || !q.cv.isConnected) { voy.replay = null; return; } const r = q.cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), W = Math.max(1, Math.round(r.width * d)), H = Math.max(1, Math.round(r.height * d)); if (q.cv.width !== W || q.cv.height !== H) { q.cv.width = W; q.cv.height = H; } const g = q.cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); hitcamDraw(g, r.width, r.height, q.u.p, q.rec, Math.min(1, (now - q.t0) / (HITCAM_DUR * 1000)), {title: q.title, sub: q.sub}); requestAnimationFrame(loop); };
 requestAnimationFrame(loop);
}

// ---------- voyage tutorial (v17) ----------
// A small battle one jump from home: our combined task group (a Venator with
// its squadrons and two Dreadnaughts, in two task groups) against a pair of
// Separatist frigates in the next system. Each step says what to do and
// checks that it is done; 「おまかせ」 does it for the player.
const vtut = {on: false, i: 0, min: false, timer: 0, last: '', foeSys: null, armed: false};
const vtutW = () => voy.w;
function vtutOwnCtg() { const w = vtutW(); return w ? [...w.ctgs.values()].find(c => c.side === 0) : null; }
function vtutOwnGroups() { const w = vtutW(); return w ? [...w.groups.values()].filter(g => g.side === 0 && voyLive(g)) : []; }
function vtutFoes() { const w = vtutW(); return w ? [...w.units.values()].filter(u => u.side === 1 && R.alive(u)) : []; }
const VTUT_STEPS = [
 {title: '3D視点', text: '艦隊戦は<b>3D視点</b>で始まります。ドラッグで視点を回し、ピンチ（ホイール）で寄ったり離れたりできます。画面の艦をタップするとその艦を追い、上の<b>◀ ▶</b>で追う艦を替えられます。', done: () => true},
 {title: '命令を開く', text: '<b>「命令」</b>を押すと、宙域全体の<b>作戦図</b>と、星系の中の戦闘を指揮する<b>戦術図</b>が3D視点の上に開きます。地図を閉じて3D視点に戻るには<b>「3D視点」</b>を押します。', done: () => voy.orders || !voy3D(), auto: () => voyOrdersOpen('ops')},
 {title: '合同任務群を選ぶ', text: '作戦図の一覧で<b>「第1合同任務群」</b>を選びます。地図の自軍の印（青い山形）をタップしても選べます。合同任務群に命じると、配下の任務群がそろって動きます。', done: () => !!(voy.sel.ctg || voy.sel.group), auto: () => { if (!voy.orders && voy3D()) voyOrdersOpen('ops'); voyGo('ops'); const c = vtutOwnCtg(); if (c) voySelect({ctg: c.id}); voyRenderSide(); }},
 {title: '敵の星系へジャンプ', text: '<b>「ジャンプ先を選ぶ」</b>を押し、敵（<b>赤い◆</b>）のいる星系をタップして<b>「合同でジャンプ」</b>。艦隊は航路に沿ってだけ移動し、早く着く任務群は出発を遅らせて全任務群が同時に到着します。', done: () => vtutOwnGroups().some(g => g.spool || g.transit || g.waitJump || g.sys === vtut.foeSys), auto: () => { const c = vtutOwnCtg(); if (c && vtut.foeSys != null) { const r = R.orderCtgJump(vtutW(), c.id, vtut.foeSys, true); toast(r.ok ? '第1合同任務群：敵の星系へジャンプ' : esc(r.why)); } }},
 {title: '時間を速める', text: '上の<b>「16×」</b>で時間を速めます（自軍が交戦すると16×までに抑えられます）。ハイパースペースを抜けると<b>交戦</b>が始まり、3D視点では艦が次々にハイパースペースから現れます。', done: () => { const w = vtutW(); return !!w && [...w.battles.keys()].some(s => R.systemUnits(w, s).some(u => u.side === 0)); }, auto: () => { voy.speed = 16; voyRenderHud(); }},
 {title: '戦術図で指揮する', text: '交戦中の星系は<b>戦術図</b>で指揮します。艦をタップすると1回目でその<b>任務群</b>、2回目でその<b>艦</b>を選びます。<b>「攻撃」</b>を押して敵艦をタップすると、その艦を狙います。陣形・出力配分・照準部位も選べます。味方艦が射線上にいると主砲は撃てず、艦どうしがぶつかると損傷します。', done: () => { const w = vtutW(); return vtutOwnGroups().some(g => g.order.type === 'attack') || (!!w && !vtutFoes().some(u => R.fighting(u))); }, auto: () => { const w = vtutW(), foes = vtutFoes().filter(u => R.fighting(u)); for (const g of vtutOwnGroups()) { const f = w.units.get(g.flag) || w.units.get(g.units[0]); const t = foes.slice().sort((a, b) => C.len(C.sub(a.pos, f.pos)) - C.len(C.sub(b.pos, f.pos)))[0]; if (t) R.orderGroup(w, g.id, {type: 'attack', target: t.id}); } const b = [...w.battles.keys()].find(s => R.systemUnits(w, s).some(u => u.side === 0)); if (b != null) { if (!voy.orders && voy3D()) voyOrdersOpen('tac:' + b); else voyGo('tac:' + b); } voyRenderSide(); }},
 {title: '飛行隊', text: '戦術図の<b>「飛行隊」</b>タブで艦載機に命令します。<b>攻撃</b>（目標と進入方向）・<b>制空</b>・<b>直掩</b>を選べます。母艦がハイパースペースに入るまでに戻れなかった機は失われるので、離脱の前に呼び戻しましょう。', done: () => true, auto: () => { voy.tab = 'wings'; voyRenderSide(); }},
 {title: '航行不能艦の処置', text: '航行不能になった艦がいると、その<b>任務群はジャンプできません</b>。艦を選んで<b>「後方へ回収」</b>（戦闘のない星系で補給線が届くとき。修理を終えると母港で復帰）・<b>「牽引で回収」</b>（トラクター・ビームを持つ艦で連れて行く）・<b>「自沈」</b>から選びます。放置すると惑星の重力に引かれて落ちていきます。いま「フォルティス」を航行不能にしました。', enter: () => vtutDisable(), done: () => !vtutOwnGroups().some(g => R.groupDisabled(vtutW(), g).length), auto: () => { const w = vtutW(); for (const g of vtutOwnGroups()) for (const u of R.groupDisabled(w, g)) { if (!R.recoverCheck(w, u)) R.orderRecover(w, u.id); else { const tw = voyTowers(u); if (tw.length) voyTractorOrder('tow', u, tw); else R.orderScuttle(w, u.id); } } voyRenderSide(); }},
 {title: '補給線と回復力', text: '作戦図の<b>緑の線</b>が補給線です。母港（緑の点線の円）から航路沿いに延び、<b>敵艦のいる星系は越えられません</b>。上の<b>「補給」</b>は艦隊全体の回復力（毎分配れる資材）と、修理・補充を待つ艦の需要です。戦闘のない星系で修理・ミサイル・艦載機・乗員が補われます。あちこちで同時に戦うと回復が追いつきません。', done: () => true, auto: () => { if (!voy.orders && voy3D()) voyOrdersOpen('ops'); voyGo('ops'); }},
 {title: '自分で操艦する', text: '艦を選んで<b>「この艦を3Dで操艦」</b>を押すと、その艦を自分で動かして撃てます（W/S：速力、A/D：転舵、Space：射撃）。ほかの艦は命令どおりに戦い続けます。', done: () => true},
 {title: '完了', text: '敵艦隊の戦力を<b>4分の1以下</b>に減らせば勝利です。これでチュートリアルは終わりです。上の<b>「終了」</b>から作戦を終えられます。', done: () => true, last: true}
];
// For the step on disabled ships: one Dreadnaught loses its reactors.
function vtutDisable() {
 const w = vtutW();if (!w || vtut.armed) return;vtut.armed = true;
 const u = [...w.units.values()].find(x => x.side === 0 && R.alive(x) && x.name === 'フォルティス') || [...w.units.values()].find(x => x.side === 0 && R.alive(x) && x.design === 'dreadnaught' && !x.out);if (!u || u.out) return;
 (u.p.modules || []).forEach((m, i) => { if (m.k === 'reactor') u.mods[i] = 0; });u.out = '電源喪失';u.order = {...u.order, type: 'hold'};voyNote(`${u.name}：電源喪失で航行不能（チュートリアル）`);
}
async function voyTutStart() {
 hideTitle();if (!voy.designs.size) for (const d of voyExampleDesigns()) voyRegister(d);
 voy.setup = voy.setup || voyNewSetup();
 const need = ['venator', 'dreadnaught', 'munificent'];if (need.some(k => !voyDesign(k))) { toast('作例の艦を準備できません'); showTitle('voyage'); return; }
 const air = R.defaultAir(voyDesign('venator').info, 'republic').slice(0, 4).map(q => ({...q, groupName: '第1合同任務群飛行団'}));
 const own = {ctgs: [{name: '第1合同任務群', tgs: [{name: '第11任務群', formation: 'abreast', ships: [{design: 'venator', name: 'アクィラ', air, troops: 0}, {design: 'dreadnaught', name: 'インヴィクタ', air: [], troops: 0}]}, {name: '第12任務群', formation: 'abreast', ships: [{design: 'dreadnaught', name: 'フォルティス', air: [], troops: 0}]}]}]};
 const foe = {ctgs: [{name: '分離主義艦隊', tgs: [{name: '第1小艦隊', formation: 'abreast', ships: [{design: 'munificent', name: 'シナジー', air: [], troops: 0}, {design: 'munificent', name: 'レバレッジ', air: [], troops: 0}]}]}]};
 const designs = need.map(voyDesign).map(d => ({key: d.key, name: d.name, p: d.p, info: d.info}));
 const w = R.createWorld({seed: 4242, region: 'corellia', designs, sides: [{faction: 'republic', ai: false}, {faction: 'cis', ai: true}], fleets: [own, foe]});w.onHit = voyOnHit;
 // The enemy waits one jump from our starting system, already reported.
 const sd = w.sides[0], start = sd.start, S = w.sector, nb = S.systems[start].links.map(i => S.edges[i]).map(e => e.a === start ? e.b : e.a).sort((a, b) => (sd.home.includes(a) - sd.home.includes(b)) || R.routeCost(S, start, a) - R.routeCost(S, start, b))[0];
 const fg = [...w.groups.values()].find(g => g.side === 1);
 if (fg && nb != null) { fg.sys = nb; const a = S.systems[start].pos, b = S.systems[nb].pos, d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, dx = (a[0] - b[0]) / d, dz = (a[1] - b[1]) / d; fg.units.forEach((id, i) => { const u = w.units.get(id); u.sys = nb; u.pos = [dx * 30000 - dz * (i - .5) * 4500, i % 2 ? 400 : -400, dz * 30000 + dx * (i - .5) * 4500]; u.yaw = Math.atan2(dz, dx); u.velocity = [0, 0, 0]; }); }
 w.sides[1].brain = {main: [], det: [], scouts: [], plan: null};vtut.foeSys = nb;
 if (fg) sd.contacts.set(fg.id, {gid: fg.id, sys: nb, time: 0, ships: fg.units.length, capital: 0, strength: fg.units.reduce((n, id) => n + R.unitStrength(w.units.get(id)), 0), exact: true, transit: false, eta: null, names: fg.units.map(id => w.units.get(id).name)});
 R.supplyLines(w);
 voy.w = w;voy.speed = 4;voy.seenEv = 0;voy.notes = [];voy.sel = {group: null, ctg: null, sys: null, dest: null, units: [], wing: null, foe: null};voy.cmd = null;voy.ops.fitted = false;voy.tac = {sys: null, c: [0, 0], mpp: 300, fitted: false};voy.result = null;voy.resultDismissed = false;
 voyOpen('ops');voyShow('ops');voyNote(`チュートリアル：${S.systems[nb]?.name || ''}に敵の小艦隊がいます。合同任務群でジャンプして撃破しましょう。`);
 vtut.on = true;vtut.i = 0;vtut.min = false;vtut.armed = false;vtutRender();clearInterval(vtut.timer);vtut.timer = setInterval(vtutTick, 600);
 if (voyCan3D()) voyEnter3D().then(() => { voyWarm(need); vtutRender(); });else voyWarm(need);
}
function vtutStop() { vtut.on = false;clearInterval(vtut.timer);vtut.timer = 0;const box = $('#vtut');if (box) box.hidden = true; }
function vtutGo(i) { vtut.full = false;vtut.i = C.clamp(i, 0, VTUT_STEPS.length - 1);const s = VTUT_STEPS[vtut.i];try { s.enter?.(); } catch (e) { console.error(e); }vtut.last = '';vtutRender(); }
function vtutRender() {
 let box = $('#vtut');if (!box) { box = document.createElement('section'); box.id = 'vtut'; box.className = 'tut vtut'; box.setAttribute('aria-label', '航行のチュートリアル'); document.body.appendChild(box); }
 if (!vtut.on || !voy.w) { box.hidden = true; return; }
 const s = VTUT_STEPS[vtut.i], done = !!s.done(), N = VTUT_STEPS.length;box.hidden = false;box.classList.toggle('min', vtut.min);
 if (vtut.min) { box.innerHTML = `<button type="button" class="tut-pill" data-vtut="max">チュートリアル ${vtut.i + 1}/${N}・${esc(s.title)}${done && s.auto ? ' ✓' : ''}</button>`; return; }
 box.innerHTML = `<div class="tut-head"><span class="tut-kicker">チュートリアル · 艦隊戦</span><span class="tut-no">${vtut.i + 1}/${N}</span><button type="button" class="tut-ic" data-vtut="min" aria-label="小さくする">－</button><button type="button" class="tut-ic" data-vtut="close" aria-label="チュートリアルを終える">×</button></div>
 <ol class="tut-dots" aria-hidden="true">${VTUT_STEPS.map((q, j) => `<li class="${j < vtut.i ? 'past' : j === vtut.i ? 'now' : ''}"></li>`).join('')}</ol>
 <h3>${esc(s.title)}</h3><p class="tut-text${vtut.full ? ' full' : ''}" data-vtut="text" title="タップで全文を表示">${s.text}</p>
 ${s.auto ? `<p class="tut-state ${done ? 'ok' : ''}">${done ? '✓ できました。「次へ」で進みます。' : '画面で操作してください。'}</p>` : ''}
 <div class="tut-actions"><button type="button" class="btn sm ghost" data-vtut="prev" ${vtut.i === 0 ? 'disabled' : ''}>戻る</button>${s.auto ? '<button type="button" class="btn sm" data-vtut="auto">おまかせで実行</button>' : ''}<button type="button" class="btn sm primary" data-vtut="${s.last ? 'close' : 'next'}">${s.last ? 'チュートリアルを終える' : '次へ'}</button></div>`;
}
function vtutTick() { if (!vtut.on) { clearInterval(vtut.timer); return; } if (!voy.w) { vtutStop(); return; } const s = VTUT_STEPS[vtut.i], key = [vtut.i, !!s.done(), vtut.min].join('|'); if (key !== vtut.last) { vtut.last = key; vtutRender(); } }
document.addEventListener('click', e => {
 const b = e.target.closest('[data-vtut]');if (!b) return;const a = b.dataset.vtut;
 if (a === 'start') { voyTutStart(); return; }
 if (!vtut.on) return;
 if (a === 'next') vtutGo(vtut.i + 1);else if (a === 'prev') vtutGo(vtut.i - 1);else if (a === 'close') vtutStop();
 else if (a === 'min') { vtut.min = true; vtutRender(); } else if (a === 'max') { vtut.min = false; vtutRender(); }
 else if (a === 'text') { vtut.full = !vtut.full; b.classList.toggle('full', vtut.full); }
 else if (a === 'auto') { try { VTUT_STEPS[vtut.i].auto?.(); } catch (err) { console.error(err); toast(String(err.message || err)); } vtut.last = ''; vtutRender(); }
});

// ---------- patrol (one ship, the trial flight) ----------
async function voyPatrol(source) {
 const opt = {returnTo: 'title', system: SYSTEMS[patrolOpt.sys] ? patrolOpt.sys : 'kuat', escorts: patrolOpt.escorts.slice(0, PATROL_ESCORTS), patrol: true};
 loadShow('艦を準備中…（大型艦は時間がかかります）', 'パトロール');hideTitle();
 try {
  if (source === 'current') { if (!ship) throw new Error('設計中の艦がありません'); await waitStats(); await trialStart(opt); }
  else if (source.startsWith('save:')) { await loadSaved(source.slice(5)); if (!ship) throw new Error('保存した設計を開けません'); await waitStats(); await trialStart(opt); }
  else { const a = await fleetAsset(source); await trialStart({...opt, design: a.design}); }
  if (!trial.on) throw new Error('パトロールを開始できませんでした');
 } catch (e) { console.error(e); loadHide(); toast('艦を準備できません：' + esc(e.message || e)); showTitle('voyage'); }
}
function waitStats() { return new Promise(res => { const t0 = performance.now(), f = () => { if (ship?._geoProxy && S || performance.now() - t0 > 120000) res(); else setTimeout(f, 200); }; f(); }); }

// ---------- v21.2 patrol traffic ----------
// A patrol meets the system's own traffic instead of target buoys: transports
// and freighters drop out of hyperspace and run down toward the planet, climb
// out from it and jump away, or cross the system along its lanes, a few at a
// time. They are neutral: marked 民間 with their name and range, never locked
// or laid on by the guns, and the escorts leave them alone. A bolt that strikes
// one still lands: a warning, the ship turns away and jumps out, and one hit
// often enough is lost. Now and then warships of the other side jump in. The
// flight then becomes a battle on the space-battle model (the escorts join it
// as fleet units; the traffic is no part of it and scatters); once the enemy is
// beaten or has withdrawn, the escorts take station again and the patrol goes
// on, the flagship and escorts keeping their damage for the next fight.
const PATROL_CIV = {gr75: {tag: 'GR-75', role: '中型輸送船'}, heraklon: {tag: 'ヘラクロン級', role: '貨客船'}, gozanti: {tag: 'ゴザンティ級', role: '貨物船'}, reptransport: {tag: '輸送船', role: '輸送船'}, cr90: {tag: 'CR90', role: '外交船'}};
// The traffic of each era (the Clone Wars or the Empire), the models quickest to prepare first.
const PATROL_TRAFFIC = {old: ['reptransport', 'gozanti', 'cr90', 'heraklon'], new: ['gozanti', 'cr90', 'gr75', 'heraklon']};
// Who comes out of hyperspace against each side, and with what.
const PATROL_ENEMY = {republic: 'cis', cis: 'republic', empire: 'rebel', rebel: 'empire'};
const PATROL_FOES = {cis: ['munificent', 'recusant', 'providence'], republic: ['hammerhead', 'dreadnaught', 'acclamator', 'venator'], rebel: ['cr90', 'nebulonb', 'mc30c', 'mc75', 'mc80liberty'], empire: ['arquitens', 'dreadnaught', 'imperial']};
const PATROL_NAMES = ['ブライト・ホープ', 'ケッセル・スター', 'コレリアン・ドリーム', 'スターダスト', 'ホワイト・ウィング', 'リバティ・トレーダー', 'メリディアン', 'ゴールデン・スター', 'エバーグリーン', 'フォーチュナ', 'ノーザン・ライト', 'シルバー・アロー', 'カーゴ・クイーン', 'ラッキー・スター', 'プログレス', 'セレニティ', 'ペイシェンス', 'ハーモニー', 'トレードウィンド', 'サザン・クロス', 'オーロラ', 'ペリディア', 'ドーントレス・トレーダー', 'ミッドリム・エクスプレス', 'アウターリム・パイオニア', 'ブルー・ハーバー'];
// want: civilians about at once; first/again/mean: the enemy comes no sooner than first seconds into the
// patrol (again after a fight), then any moment (memoryless, mean seconds on top); range: what is kept about the ship.
const PATROL = {want: 4, first: 150, again: 120, mean: 150, range: 9e4, keep: 600};
const patrolExp = mean => -Math.log(1 - Math.random()) * mean;
// The flagship's side: an example's own, else the paint (a design of one's own is the Empire's).
function patrolFaction() { const d = trial.asset?.design || {}, ref = YardFleetData?.designs?.[d.reference]; return ref?.faction || (d.paint === 'republic' ? 'republic' : d.paint === 'cis' ? 'cis' : 'empire'); }
function patrolReset() {
 const fac = patrolFaction(), civ = PATROL_TRAFFIC[fac === 'republic' || fac === 'cis' ? 'old' : 'new'];
 trial.pat = {fac, foe: PATROL_ENEMY[fac] || 'rebel', civKeys: civ, queue: civ.filter(k => !fleet.assets.has(k)), loading: null, civ: [], uid: 1, names: new Set(), civNames: new Set(), failed: new Set(), seeded: false, nextCiv: 0, seen: 0, enc: 0, won: 0, sunk: 0, civHits: 0, civLost: 0, me: null, group: null, encAt: trial.t + PATROL.first + patrolExp(PATROL.mean), alert: 0, alertText: ''};
}
// The ships' 3D models are prepared one at a time in the background (never while the guns are firing or
// in a fight, when the engine is wanted for the line-of-fire checks).
const patrolLoads = new Map();
function patrolLoad(k) { if (fleet.assets.has(k)) return Promise.resolve(fleet.assets.get(k)); let q = patrolLoads.get(k); if (!q) { q = fleetAsset(k).catch(e => { console.warn('patrol: cannot prepare', k, e); return null; }).finally(() => patrolLoads.delete(k)); patrolLoads.set(k, q); } return q; }
function patrolLoadPump(P) { if (P.loading || !P.queue.length || trial.fire || trial.fireKey || trial.battle && !trial.battle.result) return; const k = P.queue.shift(); if (fleet.assets.has(k)) return; P.loading = k; patrolLoad(k).then(a => { if (!a) P.failed.add(k); if (P.loading === k) P.loading = null; }); }
function patrolStep(dt, tunnel) {
 const P = trial.pat;if (!P || !trial.asset) return;
 patrolLoadPump(P);
 if (tunnel) { if (P.civ.length) P.civ = []; return; }
 if (!(dt > 0)) return;
 const B = trial.battle;if (B?.patrol) patrolBattleWatch(B, dt);
 patrolTraffic(dt);patrolShots(dt);patrolClock();
 if (P.alert > 0) { P.alert -= dt; if (!trial.warn) trial.warn = P.alertText; }
}
// ---- traffic ----
// The lanes of a system: two fixed bearings in the local horizon (from its name), each run both ways.
function patrolLane(up) {
 const h = [...String(trial.sysKey || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7), b = (h % 360) * Math.PI / 180 + (Math.random() < .5 ? 0 : 1.15);
 let nt = tv.add([0, 0, -1], up, -tv.dot([0, 0, -1], up));nt = tv.len(nt) > 1e-6 ? tv.norm(nt) : [1, 0, 0];const et = tv.cross(nt, up);
 return tv.norm(tv.add(tv.scale(nt, Math.cos(b)), et, Math.sin(b)));
}
// The way the view looks, in the local horizon (new traffic shows up where it is seen).
function patrolLook(up) { const a = trial.aim?.dir || trialCol(trial.R, 0);let f = tv.add(a, up, -tv.dot(a, up));if (tv.len(f) < .1) { const g = trialCol(trial.R, 0);f = tv.add(g, up, -tv.dot(g, up)); } return tv.len(f) > 1e-6 ? tv.norm(f) : [1, 0, 0]; }
function patrolCivName(P) { const free = PATROL_NAMES.filter(n => !P.civNames.has(n)), n = free.length ? free[Math.floor(Math.random() * free.length)] : PATROL_NAMES[Math.floor(Math.random() * PATROL_NAMES.length)] + ' ' + (P.civNames.size + 1); P.civNames.add(n); return n; }
// route: 'lane' crosses the system and jumps out, 'in' drops out of hyperspace and runs down toward the
// planet, 'out' climbs from below and jumps away; present: already under way (no arrival).
function patrolCivSpawn(keys, route, present) {
 const P = trial.pat, have = new Set(P.civ.map(c => c.key)), fresh = keys.filter(k => !have.has(k)), pool = fresh.length ? fresh : keys, key = pool[Math.floor(Math.random() * pool.length)];
 const a = fleet.assets.get(key);if (!a?.p) return null;const p = a.p, L = p.len, info = PATROL_CIV[key] || {tag: shipShort(p.name), role: '民間船'};
 route = route || (Math.random() < .45 ? 'lane' : Math.random() < .55 ? 'in' : 'out');
 const up = tv.norm(trial.P), look = patrolLook(up), side = tv.norm(tv.cross(look, up));
 // Where it will be seen: ahead of the view, 6–18 km out, to one side or the other, not far above or below.
 const brg = (Math.random() * 2 - 1) * .75, dist = 6000 + Math.random() * 12000 + L * 8, X = tv.add(tv.add(trial.P, look, Math.cos(brg) * dist), side, Math.sin(brg) * dist);
 const lane = patrolLane(up), d = Math.random() < .5 ? lane : tv.scale(lane, -1);
 let pos, h, life = Infinity;
 if (route === 'lane') { pos = tv.add(tv.add(X, d, -(present ? Math.random() * 4000 : 3000 + Math.random() * 6000)), up, (Math.random() - .5) * 3000);h = d;life = 70 + Math.random() * 70; }
 else if (route === 'in') { const th = (18 + Math.random() * 14) * Math.PI / 180;pos = tv.add(X, up, 1500 + Math.random() * 3000);h = tv.norm(tv.add(tv.scale(d, Math.cos(th)), up, -Math.sin(th))); }
 else { const th = (20 + Math.random() * 15) * Math.PI / 180;pos = tv.add(X, up, -(3000 + Math.random() * 3000));h = tv.norm(tv.add(tv.scale(d, Math.cos(th)), up, Math.sin(th)));life = 45 + Math.random() * 50; }
 const warp = present || route === 'out' ? null : {t: 0, at: .3 + Math.random() * .8}, cruise = p.maxSpeed * (.45 + Math.random() * .3);
 const c = {id: P.uid++, kind: 'civ', key, p, name: patrolCivName(P), tag: info.tag, role: info.role, route, pos, h, dir: h, spd: cruise, cruise, vel: tv.scale(h, cruise), R: trialFrame(h, tv.norm(pos)), warp, life, t: 0, hits: 0, kill: Math.round(C.clamp(L / 15, 4, 20)), glow: .5, vis: !warp};
 if (c.vis) P.seen++;
 P.civ.push(c);return c;
}
function patrolFlee(c, from, t) { if (c.kind !== 'civ' || c.jumpT != null || c.spool != null) return; c.flee = {from: [...from], t: t ?? 2 + Math.random() * 4}; }
function patrolCivStep(c, dt) {
 const rel = tv.sub(c.pos, trial.P), d = tv.len(rel);
 if (c.kind === 'hulk') { c.t += dt;c.pos = tv.add(c.pos, c.vel, dt);c.vel = tv.scale(c.vel, Math.exp(-dt * .02));c.R = m3Mul(trialAxisMatrix(c.axis, c.rate * dt), c.R);if (d > PATROL.range || c.t > 420) c.gone = true;return; }
 if (c.warp) { c.warp.t += dt;const tt = c.warp.t - c.warp.at;if (tt < 0) return;if (!c.vis) { c.vis = true;trial.pat.seen++;sndAt('hyperspace_in', c.pos, {gain: .4, far: 60000}); } if (tt >= .9) c.warp = null; }
 if (c.jumpT != null) { c.jumpT += dt;c.pos = tv.add(c.pos, c.h, c.spd * dt);if (c.jumpT >= .8) c.gone = true;return; }
 c.t += dt;const p = c.p, up = tv.norm(c.pos);let want = c.dir, top = c.cruise;
 if (c.flee) { c.flee.t -= dt;let away = tv.sub(c.pos, c.flee.from);away = tv.add(away, up, -tv.dot(away, up));want = tv.norm(tv.add(tv.len(away) > 1 ? tv.norm(away) : c.h, up, .25));top = p.maxSpeed; }
 // Clear of the flagship (its escorts keep station about it).
 const keep = (trial.p.len + p.len) * .8 + PATROL.keep;if (d < keep * 2.5 && d > 1) want = tv.norm(tv.add(want, tv.scale(rel, 1 / d), C.clamp((keep * 2.5 - d) / keep, 0, 3)));
 const cs = C.clamp(tv.dot(c.h, want), -1, 1), ang = Math.acos(cs);if (ang > 1e-4) { const ax = tv.cross(c.h, want), l = tv.len(ax);c.h = l > 1e-9 ? tv.norm(trialRot(c.h, tv.scale(ax, 1 / l), Math.min(ang, Math.max(.05, p.turnRate || .1) * dt))) : want; }
 if (c.spool != null) top = p.maxSpeed;
 const acc = Math.max(5, p.accel || 10);c.spd += C.clamp(top - c.spd, -acc * dt, acc * dt);c.vel = tv.scale(c.h, c.spd);c.pos = tv.add(c.pos, c.vel, dt);
 c.R = trialFrame(c.h, up);c.glow = c.spool != null ? 1 : C.clamp(.35 + .6 * c.spd / Math.max(1, p.maxSpeed), 0, 1);
 // Leaving: the drive spools up at full speed, then the ship is gone in a streak.
 if (c.spool != null) { if ((c.spool -= dt) <= 0) { c.jumpT = 0;c.vis = false;sndAt('hyperspace_out', c.pos, {gain: .4, far: 60000}); } }
 else if (c.flee && c.flee.t <= 0 || c.t >= c.life) c.spool = 1.6 + Math.random();
 const sy = trialSys();if (d > PATROL.range || tv.len(c.pos) - sy.planet.radius < sy.floor + 8000) c.gone = true;
}
function patrolTraffic(dt) {
 const P = trial.pat;for (const c of P.civ) patrolCivStep(c, dt);P.civ = P.civ.filter(c => !c.gone);
 if (trial.battle || trial.jump) return;
 const keys = P.civKeys.filter(k => fleet.assets.has(k));if (!keys.length) return;
 const n = P.civ.filter(c => c.kind === 'civ').length;
 if (!P.seeded) { P.seeded = true;patrolCivSpawn(keys, 'lane', true);P.nextCiv = trial.t + 4 + Math.random() * 5;return; }
 if (n < PATROL.want && trial.t >= P.nextCiv) { patrolCivSpawn(keys);P.nextCiv = trial.t + (n < 2 ? 5 : 14) + Math.random() * (n < 2 ? 8 : 20); }
}
// A bolt or missile of ours that strikes a civilian (it is an ellipsoid of its own size).
function patrolSegHit(c, a0, a1) {
 const p = c.p, s = [p.len * .5, (p.height || p.len * .2) * .5, (p.width || p.len * .5) * .5], seg = tv.sub(a1, a0), l2 = tv.dot(seg, seg) || 1, k0 = C.clamp(tv.dot(tv.sub(c.pos, a0), seg) / l2, 0, 1);
 if (tv.len(tv.sub(tv.add(a0, seg, k0), c.pos)) > s[0] * 1.1) return null;
 const la = trialApplyT(c.R, tv.sub(a0, c.pos)), lb = trialApplyT(c.R, tv.sub(a1, c.pos)), pa = [la[0] / s[0], la[1] / s[1], la[2] / s[2]], dd = tv.sub([lb[0] / s[0], lb[1] / s[1], lb[2] / s[2]], pa), m2 = tv.dot(dd, dd) || 1, k = C.clamp(-tv.dot(pa, dd) / m2, 0, 1);
 return tv.len(tv.add(pa, dd, k)) < 1 ? tv.add(a0, seg, k) : null;
}
function patrolShots(dt) {
 const P = trial.pat, cs = P.civ.filter(c => c.kind === 'civ' && c.vis && c.jumpT == null);if (!cs.length) return;let hit = false;
 const test = (a0, a1, w, esc) => { for (const c of cs) { if (c.gone) continue; const q = patrolSegHit(c, a0, a1);if (q) { patrolCivHit(c, q, w, esc);return true; } } return false; };
 for (const b of trial.bolts) { if (b.pd || b.life <= 0) continue; if (test(tv.add(b.pos, b.vel, -dt), b.pos, b.weight || 1, b.esc)) { b.life = 0;hit = true; } }
 for (const m of trial.missiles) { if (m.life <= 0) continue; if (test(m.prev || m.pos, m.pos, 3 * (m.weight || 1), false)) { m.life = 0;hit = true; } }
 if (hit) { trial.bolts = trial.bolts.filter(b => b.life > 0);trial.missiles = trial.missiles.filter(m => m.life > 0); }
}
function patrolCivHit(c, q, w, esc) {
 const P = trial.pat;c.hits += w;P.civHits += w;spaceImpact(q, c.vel, null, Math.max(6, c.p.len * .06));
 if (c.hits >= c.kill) { c.gone = true;P.civLost++;trialExplosion(c.pos, c.vel, c.p.len, false);P.alert = 6;P.alertText = `民間船 ${c.tag}「${c.name}」を撃沈 — 重大な交戦規定違反です`;toast(P.alertText);return; }
 if (!c.warned) { c.warned = true;P.alert = 5;P.alertText = `警告：民間船 ${c.tag}「${c.name}」に${esc ? '随伴艦の' : ''}射撃が命中 — 民間船は攻撃対象ではありません`;toast(P.alertText); }
 patrolFlee(c, trial.P, 3 + Math.random() * 3);
}
// For the renderer (relative to the flown ship): arriving ships stretched out of hyperspace, leaving ones into it.
function patrolDraw() {
 const P = trial.pat;if (!P || !P.civ.length || trial.jump?.phase === 'tunnel') return [];const out = [];
 for (const c of P.civ) {
  if (c.gone || !fleet.assets.has(c.key)) continue;let w = c.pos, stretch = 1, flash = 0;
  if (c.warp) { const tt = c.warp.t - c.warp.at;if (tt < 0) continue;if (tt < .9) { const k = warpLook(tt, c.p.len);w = tv.add(w, c.h, -k.D);stretch = k.stretch;flash = k.tint; } }
  if (c.jumpT != null) { const t = c.jumpT;w = tv.add(w, c.h, c.p.len * 40 * (t / .8) ** 3);stretch = 1 + 25 * t * t;flash = C.clamp((stretch - 1) / 16, 0, .45); }
  const rel = tv.sub(w, trial.P);if (tv.len(rel) > 2.5e5) continue;
  out.push({key: c.key, pos: rel, rot: c.R, glow: c.kind === 'hulk' ? 0 : glowOf('pc' + c.id, c.glow), hatchOpen: 0, dead: false, stretch, flash});
 }
 return out;
}
// HUD brackets: 民間 with the class, name and range; hulks left by a fight in grey.
function patrolMarks(items) {
 for (const c of trial.pat.civ) {
  if (c.gone || !c.vis) continue;
  if (c.kind === 'civ') items.push({id: 'p' + c.id, pos: c.pos, cls: 'civ' + (c.hits ? ' hit' : ''), lab: d => `民間 ${c.tag}「${c.name}」 · ${d} km${c.hits ? ' · 被弾' : ''}`});
  else items.push({id: 'p' + c.id, pos: c.pos, cls: 'hulk', lab: d => `${c.ally ? '友' : '敵'} ${c.name} · ${d} km · 戦闘不能`});
 }
}
function patrolHud() {
 const P = trial.pat, el = $('#trialHud [data-th="records"]');if (!P || !el || trial.battle) return;const g = trial.gun, n = P.civ.filter(c => c.kind === 'civ' && c.vis).length;
 const txt = `パトロール記録　民間船 ${P.seen} 隻（現在 ${n} 隻） · 交戦 ${P.enc} 回 · 撃退 ${P.won} · 敵艦撃沈 ${P.sunk} · 射撃 ${num(g.shots)} 発 / 命中 ${num(Math.round(g.hits))}${P.civHits ? ` · 民間船への命中 ${num(Math.round(P.civHits))}${P.civLost ? ` · 民間船喪失 ${P.civLost}` : ''}` : ''}`;
 if (el.textContent !== txt) el.textContent = txt;
}
// ---- the enemy ----
function patrolUnitStr(u) { try { return R.unitStrength(u); } catch (e) { return 1; } }
// A group of one to three warships of the other side, together somewhat weaker than the flagship and its
// escorts (or, when even the smallest is stronger, the smallest alone), each with a name.
function patrolPickGroup() {
 const P = trial.pat, pool = (PATROL_FOES[P.foe] || []).map(k => ({key: k, d: YardFleetData?.designs?.[k]})).filter(x => x.d);if (!pool.length) return [];
 const memo = new Map(), str = x => { if (!memo.has(x.key)) memo.set(x.key, patrolUnitStr(C.fleetUnit('x', x.key, x.d.p, 0))); return memo.get(x.key); };
 const own = patrolUnitStr(P.me || C.fleetUnit('me', trial.asset.key, trial.p, 0)) + (trial.escorts || []).reduce((n, e) => n + patrolUnitStr(e.unit || C.fleetUnit('x', e.key, e.p, 0)), 0);
 let best = null;
 for (let i = 0; i < 80 && !best; i++) { const n = Math.random() < .55 ? 1 : Math.random() < .7 ? 2 : 3, g = Array.from({length: n}, () => pool[Math.floor(Math.random() * pool.length)]), s = g.reduce((a, x) => a + str(x), 0); if (s >= own * .25 && s <= own * .9) best = g; }
 if (!best) best = [pool.slice().sort((a, b) => str(a) - str(b))[0]];
 const cls = d => String(d.name).split('｜')[0].replace(/級.*/, '級');
 return best.map(x => { const name = voyNextName(P.foe, P.names);P.names.add(name);return {key: x.key, name: `${cls(x.d)}「${name}」`}; });
}
// The group is chosen early so its models are ready when the time comes.
function patrolClock() {
 const P = trial.pat;if (trial.battle || trial.jump || P.encAt == null || P.me?.dead || P.me?.out) return;
 if (!P.group) { P.group = patrolPickGroup();for (const g of P.group) if (!fleet.assets.has(g.key) && !P.queue.includes(g.key)) P.queue.push(g.key); }
 // (a ship whose model cannot be prepared stays away; with none left, no one comes)
 if (P.group.some(g => P.failed.has(g.key))) { P.group = P.group.filter(g => !P.failed.has(g.key)); if (!P.group.length) { P.encAt = null; return; } }
 if (trial.t < P.encAt || !P.group.length || !P.group.every(g => fleet.assets.has(g.key))) return;
 patrolEncounter();
}
function patrolEncounter() {
 const P = trial.pat, g = P.group.map(x => ({...x, p: fleet.assets.get(x.key).p})), fac = R.FACTIONS[P.foe]?.name || '敵対勢力', n = g.length;P.group = null;P.enc++;P.encAt = null;
 const txt = `警報：${fac}の艦艇${n > 1 ? ` ${n} 隻` : ''}がハイパースペースから出現します`;
 P.alert = 7;P.alertText = txt + ' — 総員戦闘配置';sndUI('alarm', .6);toast(txt);
 const at = patrolBattleStart(g);
 // The traffic scatters and jumps away.
 for (const c of P.civ) if (c.kind === 'civ') patrolFlee(c, at, 1.5 + Math.random() * 5);
}
// The flight becomes a battle where it is: the flagship (with the damage it already has), the escorts as
// fleet units from where they fly, and the enemy dropping out of hyperspace 15–20 km off on some bearing.
// Returns the arrival point.
function patrolBattleStart(group) {
 const P = trial.pat, O = [...trial.P], E = trialFrame(trialCol(trial.R, 0), tv.norm(trial.P)), me = P.me || C.fleetUnit('me', trial.asset.key, trial.p, 0);
 me.manual = true;me.name = trial.p.name;me.order = {...me.order, power: trial.powerMode, volley: trial.volley === 'salvo' ? 'salvo' : 'stream'};const units = [me];
 for (const e of trial.escorts || []) {
  const u = e.unit || C.fleetUnit('a' + (P.uid++), e.key, e.p, 0), f = trialApplyT(E, e.f);u.name = e.name;u.esc = e;u.pos = trialApplyT(E, tv.sub(e.pos, O));u.velocity = trialApplyT(E, e.V);u.yaw = Math.atan2(f[2], f[0]);
  u.absent = false;u.hidden = false;delete u.depart;delete u.warp;u.order = {...u.order, type: 'hold', fire: true, power: u.order?.power || 'auto', aim: 'auto'};units.push(u);
 }
 const a0 = (Math.random() * 2 - 1) * 1.9, cd = [Math.cos(a0), Math.sin(a0)], sd = [-cd[1], cd[0]], R0 = 15000 + Math.random() * 5000 + Math.max(...group.map(x => x.p.len)) * 2;
 group.forEach((x, i) => {
  const u = C.fleetUnit('e' + (P.uid++), x.key, x.p, 1), gap = Math.max(2600, x.p.len * 2.2), back = i * gap * .4, off = i * gap * .8 * (i % 2 ? -1 : 1);
  u.name = x.name;u.pos = [cd[0] * (R0 + back) + sd[0] * off, 400 + (i % 3) * 450, cd[1] * (R0 + back) + sd[1] * off];u.yaw = Math.atan2(-u.pos[2], -u.pos[0]) + (Math.random() - .5) * .3;u.absent = true;u.warp = {at: 4 + i * .6, t: 0};units.push(u);
 });
 const b = C.fleetBattle(units, true);b.seed = (Math.random() * 2 ** 31) | 0;
 trial.escorts = [];
 trial.battle = {b, O, E, acc: 0, extra: new Map(), seen: 0, result: null, orderT: 0, me, plan: {patrol: true}, ticker: [], modIndex: new Map((trial.p.modules || []).map((m, i) => [m.fit, i]).filter(([f]) => f != null)), kills: 0, disabled: 0, patrol: true};
 trial.targets = [];trial.vbolts = [];spaceRefresh();
 return tv.add(O, trialApply(E, [cd[0] * R0, 400, cd[1] * R0]));
}
// A beaten enemy withdraws: once every ship it still has fighting is badly hurt (or, with none lost, all but
// wrecked), they jump out together. Gone, sunk or disabled, the fight is won.
function patrolBattleWatch(B, dt) {
 const foes = B.b.units.filter(u => u.team === 1);
 if (!B.result) {
  const up = foes.filter(u => !u.dead && !u.out && !u.absent && !u.depart);
  if (!B.leaving && up.length && !foes.some(u => u.warp) && up.every(u => C.fleetIntegrity(u) < (foes.some(u => u.dead || u.out) ? .45 : .22))) {
   B.leaving = true;up.forEach((u, i) => { u.depart = {t: -1.5 - i * .5}; });spaceLog('敵艦が撤退を開始');toast('敵艦が撤退を開始 — ハイパースペースへ離脱していきます');
  }
  if (B.leaving && foes.every(u => u.dead || u.out || u.absent)) spaceEnd('win');
  return;
 }
 if (B.patrolEnd != null && (B.patrolEnd -= dt) <= 0) patrolBattleDissolve();
}
// spaceEnd for a patrol's fight: a win is not a result card; the fight winds down for a few seconds (the
// last wrecks break up) and the patrol goes on. A loss is the battle's own result card.
function patrolBattleEnd(kind) {
 if (kind !== 'win') return false;
 const B = trial.battle, P = trial.pat, fled = B.b.units.some(u => u.team === 1 && u.absent && !u.dead);
 B.result = {kind: 'win', fled, fate: B.me.fate, why: B.me.out};B.patrolEnd = 3.5;P.won++;
 P.alert = 6;P.alertText = fled ? '敵艦は撤退 — パトロールを続行します' : '敵艦を撃退 — パトロールを続行します';toast(P.alertText);
 return true;
}
function patrolHulk(u, ally) { const B = trial.battle, R0 = spaceRotU(B.E, u); return {id: trial.pat.uid++, kind: 'hulk', ally, key: u.key, p: u.p, name: shipTag(u.name), pos: spaceWorld(u), vel: spaceVel(u), R: R0, h: trialCol(R0, 0), axis: tv.norm([Math.random() - .5, Math.random() - .5, Math.random() - .5]), rate: .004 + Math.random() * .01, t: 0, vis: true}; }
// Back to the patrol: the escorts take station again (keeping their damage); disabled ships are left adrift.
function patrolBattleDissolve() {
 const B = trial.battle, P = trial.pat;if (!B?.patrol) return;spaceCineEnd();
 const es = [], left = [];
 for (const u of B.b.units) {
  if (u.manual || u.dead) continue;
  if (u.team === 0) { const e = u.esc;if (!e || u.out || u.absent) { if (!u.absent) P.civ.push(patrolHulk(u, true)); left.push(shipShort(u.name)); continue; } e.pos = spaceWorld(u);e.V = spaceVel(u);e.R = spaceRotU(B.E, u);e.f = trialCol(e.R, 0);e.unit = u;es.push(e); }
  else if (u.out && !u.absent) P.civ.push(patrolHulk(u, false));
 }
 trial.escorts = es;P.sunk += B.b.units.filter(u => u.team === 1 && u.dead).length;patrolBattleClose(B);
 if (left.length) toast(`随伴艦 ${left.join('・')} は戦闘不能のため隊列を離れました`);
}
function patrolBattleClose(B) {
 const P = trial.pat;P.me = B.me;trial.battle = null;trial.targets = [];trial.vbolts = [];trial.swfx = [];trial.gunTarget = null;trial.heldLock = null;trial.hitcam = null;
 const hud = $('#trialHud'), hc = hud?.querySelector('[data-th="hitcam"]');if (hc) hc.hidden = true;hud?.classList.remove('hc-on', 'cine');
 P.encAt = trial.t + PATROL.again + patrolExp(PATROL.mean);P.nextCiv = trial.t + 6 + Math.random() * 6;
}
// In a new system: fresh traffic; out of a fight by hyperspace, the escorts that jumped with the flagship rejoin.
function patrolArrive() {
 const P = trial.pat, B = trial.battle;P.civ = [];P.seeded = false;P.nextCiv = trial.t + 2;
 if (B?.patrol) {
  const es = [], left = [];
  for (const u of B.b.units) { if (u.manual || u.team !== 0 || u.dead) continue; if (u.out || !u.esc) { left.push(shipShort(u.name)); continue; } u.esc.unit = u;es.push(u.esc); }
  trial.escorts = es;P.sunk += B.b.units.filter(u => u.team === 1 && u.dead).length;patrolBattleClose(B);
  if (left.length) toast(`随伴艦 ${left.join('・')} は戦闘不能のため取り残されました`);
 }
}
window.__patrol = {get pat() { return trial.pat; }, force(sec = 0) { const P = trial.pat;if (P) P.encAt = trial.t + sec; return !!P; }, spawn: (route, present) => { const P = trial.pat, keys = P?.civKeys.filter(k => fleet.assets.has(k)) || []; return keys.length ? patrolCivSpawn(keys, route, present)?.name : null; }, dissolve: () => patrolBattleDissolve(),
 // (tests) the flight's clock run on without drawing, as trialLoop would, in steps of dt
 run(sec, dt = .05) { for (let t = 0; t < sec && trial.on; t += dt) { if (trial.cine) { trial.cine.t += dt; if (trial.cine.t >= trial.cine.dur) spaceCineEnd(); } trialJumpStep(dt); const ph = trial.jump?.phase, tunnel = ph === 'tunnel'; escortsStep(dt); if (!tunnel) { if (trialCoasting()) trialSublight(dt); else if (ph !== 'exit' && ph !== 'brake') trialStep(dt); if (trial.battle) spaceStep(dt); spaceBolts(dt); trialFxStep(dt); trialWrecksStep(dt); } if (trial.battle && !tunnel) { spaceAttStep(dt); spaceDeaths(); } patrolStep(dt, tunnel); } return +trial.t.toFixed(1); }};

// From the drawing board: the order of battle, with the design on the board added to a task group.
async function voyOpenWithCurrent() {
 voy.saves = await Store.list().catch(() => []);voyOpen('setup', 'orbat');if (!ship) return;
 try {
  const d = await voyPrepare('current'), s = voy.setup, ob = voyOb(s.own);
  if (voyObShips(ob).some(sh => sh.key === d.key)) return;
  let t = voyObTgs(ob).find(x => x.ships.length < TG_MAX);
  if (!t) { if (!ob.ctgs.length) ob.ctgs.push({id: voyUid(ob), name: '第1合同任務群', tgs: []}); const c = ob.ctgs[ob.ctgs.length - 1], n = ob.ctgs.indexOf(c) + 1; t = {id: voyUid(ob), name: `第${n}${c.tgs.length + 1}任務群`, formation: 'abreast', ships: []}; c.tgs.push(t); }
  t.ships.push({id: voyUid(ob), src: 'current', key: d.key, name: voyNextName(s.own, new Set(voyObShips(ob).map(x => x.name))), air: R.defaultAir(d.info, s.own, d.air), ground: [], carried: voyDefaultCarried(d)});
  voyObChanged();toast(`設計中の艦を${esc(t.name)}に加えました`);
 } catch (e) { console.error(e); toast('設計中の艦を準備できません：' + esc(e.message || e)); }
}
function bindVoyage() { voyBindSetup(); voyBindMap(); document.addEventListener('click', e => { const hb = e.target.closest('[data-vhit],[data-vhitplay],[data-vhitclose]'); if (hb) { if (hb.dataset.vhit) { const [id, i] = hb.dataset.vhit.split(':'); voyHitReplay(id, +i); } else if ('vhitplay' in hb.dataset && voy.replay) voy.replay.t0 = performance.now(); else { $('#voySheet').hidden = true; voy.replay = null; } return; } if (trial.spectate) { const sb = e.target.closest('[data-spec]'); if (sb) { voySpectateCmd(sb.dataset.spec); return; } const mk = e.target.closest('.th-tmark'); if (mk?.dataset.tmark?.startsWith('u')) { voySpectateCmd('follow:' + mk.dataset.tmark.slice(1)); return; } } const b = e.target.closest('[data-voyopen]'); if (b) { e.preventDefault(); voyOpenWithCurrent(); } }); window.__voy = {voy, R, open: voyOpen, pilot: voyPilot, go: voyGo, spectate: voySpectate, step: voySpectateStep, pilotStep: voyPilotStep, tap: voyMapTap, follow: voySpectateSwitch, tut: voyTutStart, vtut, vtutGo, load: {show: loadShow, hide: loadHide, shots}, fxStep: (dt, n = 1) => { for (let i = 0; i < n; i++) { trialWrecksStep(dt); trialFxStep(dt); } }}; }

window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
