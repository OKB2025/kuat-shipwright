// Recorded BGM (the player's Gemini tracks): every scene's track exists, carries loop points inside the file with the
// run-on past the loop end that the seam splice needs, and the player reads them (docs/audio.md).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), {test} = require('node:test');
const root = path.join(__dirname, '..'), app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const meta = id => { const f = path.join(root, 'data', 'bgm_' + id + '.js'); assert.ok(fs.existsSync(f), 'missing ' + f); const u = fs.readFileSync(f, 'utf8'), a = u.indexOf('Object.assign('), m = u.indexOf(',{b64:"'); return JSON.parse(u.slice(a + 14, m)); };
const tracks = JSON.parse(app.match(/const SND_TRACKS = (\{[^\n]*\});/)[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
const ids = [...new Set(Object.values(tracks).flat())];
test('every scene has recorded tracks and every data file is used', () => {
  for (const sc of ['title', 'yard', 'voyage', 'battle', 'victory', 'defeat']) assert.ok(tracks[sc] && tracks[sc].length, sc);
  const files = fs.readdirSync(path.join(root, 'data')).filter(f => /^bgm_.*\.js$/.test(f)).map(f => f.slice(4, -3));
  assert.deepEqual(files.sort(), ids.slice().sort());
});
test('loop points lie inside each file and leave the 1.5 s run-on for the splice', () => {
  for (const id of ids) {
    const m = meta(id), [s, e] = m.loop;
    assert.equal(m.id, id); assert.equal(m.mime, 'audio/mp4'); assert.ok(m.credit && m.title);
    assert.ok(s > 5 && e - s > 45, id + ' loop too short'); assert.ok(m.dur >= e + 1.4 && m.dur < e + 1.7, id + ' run-on ' + (m.dur - e));
  }
});
test('the player keeps the loop meta and splices at the loop end', () => {
  assert.equal((app.match(/loop: K\.loop/g) || []).length, 2, 'both decode paths copy loop');
  assert.match(app, /async function seam\(my\)/); assert.match(app, /else if \(!last && left < 3 && !cur\.seam\) seam\(cur\)/);
  assert.match(app, /el\.currentTime -= L\[1\] - L\[0\]/, 'fallback jump when no splice happened');
});
