// Optional actual GPU regression. Serve-free usage:
// KS_WEBGL=1 KS_PLAYWRIGHT_MODULE=playwright KS_CHROMIUM_PATH=/path/to/chromium node --test tests/armor-skin-webgl.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));

test('actual WebGL armor stays gray, irregular, paint preserving and independent of triangulation, subdivision and fleet pose', {skip: !process.env.KS_WEBGL}, async t => {
  const {chromium} = require(process.env.KS_PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.KS_CHROMIUM_PATH ? {executablePath: process.env.KS_CHROMIUM_PATH} : {}),
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const derivatives of [true, false]) await t.test(derivatives ? 'derivatives' : 'derivatives-free fallback', async () => {
      const page = await browser.newPage({viewport: {width: 640, height: 480}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.setContent('<canvas style="display:block;width:640px;height:480px"></canvas>');
        if (!derivatives) await page.evaluate(() => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(...args) {
            const gl = original.apply(this, args);
            if (args[0] === 'webgl' || args[0] === 'experimental-webgl') {
              const extension = gl.getExtension.bind(gl);
              gl.getExtension = name => name === 'OES_standard_derivatives' ? null : extension(name);
            }
            return gl;
          };
        });
        for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js']) {
          await page.addScriptTag({content: fs.readFileSync(path.join(root, file), 'utf8')});
        }
        const result = await page.evaluate(() => {
          const renderer = new Gfx.Renderer(document.querySelector('canvas')), gl = renderer.gl;
          renderer.off = [0, 0, 0];
          renderer.cam = {th: -.30, ph: .35, r: 330, target: [0, 0, 0], fov: .72};
          renderer.pickLook = () => ({L1: [0, 1, 0], L2: [0, -1, 0], C1: [0, 0, 0], C2: [0, 0, 0], sky: [1, 1, 1], gnd: [1, 1, 1], tone: 0, exp: 1, shadow: false});
          const read = () => {
            const pixels = new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
            gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return pixels;
          };
          const make = form => {
            const geo = new Gfx.Geo(12);
            const quad = (x0, x1) => {
              const points = [[x0, 0, -80], [x0, 0, 80], [x1, 0, 80], [x1, 0, -80]], base = geo.n;
              for (const [i, p] of points.entries()) geo.v(...p, 0, 1, 0, form === 'alternate' ? i*.31 : p[0]/48, form === 'alternate' ? i*.73 : p[2]/48, [180, 75, 54], 251);
              if (form === 'alternate') {geo.tri(base, base+1, base+3); geo.tri(base+1, base+2, base+3);}
              else {geo.tri(base, base+1, base+2); geo.tri(base, base+2, base+3);}
            };
            if (form === 'split') {quad(-120, 0); quad(0, 120);} else quad(-120, 120);
            return geo;
          };
          const diff = (a, b) => {
            const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
            let interior = 0, max = 0, sum = 0;
            for (let y = 3; y < H-3; y++) for (let x = 3; x < W-3; x++) {
              // Ignore only silhouette coverage, where diagonal changes can
              // move a subpixel edge. Keep the semantic split line inside.
              let inside = true;
              for (const dy of [-2, 0, 2]) for (const dx of [-2, 0, 2]) {
                const k = ((y+dy)*W+x+dx)*4;
                if (a[k] <= 55 || b[k] <= 55) inside = false;
              }
              if (!inside) continue;
              interior++;
              for (let j = 0; j < 3; j++) {const d = Math.abs(a[(y*W+x)*4+j]-b[(y*W+x)*4+j]); max = Math.max(max, d); sum += d;}
            }
            return {interior, max, mean: sum/(interior*3)};
          };
          const snapshots = {};
          for (const form of ['original', 'alternate', 'split']) {
            renderer.upload('struct', make(form));
            renderer.draw({mode: 'normal', lights: 'off', noStars: true});
            snapshots[form] = read();
          }
          let paintedPixels = 0, maxHueError = 0;
          for (let i = 0; i < snapshots.original.length; i += 4) if (snapshots.original[i] > 80) {
            const [r, g, b] = snapshots.original.subarray(i, i+3);
            paintedPixels++;
            maxHueError = Math.max(maxHueError, Math.abs(r/180-g/75), Math.abs(r/180-b/54));
          }
          renderer.loadFleet('probe', {meshes: {struct: {geo: make('original')}}, center: [0, 0, 0], bounds: [-120, 0, -80, 120, 0, 80], length: 240, paint: 'neutral', lights: 'off'});
          renderer.draw({mode: 'review', noStars: true, fleet: [{key: 'probe', pos: [0, 0, 0], yaw: 0}]});
          const fleet = read();
          renderer.cam.th += Math.PI/3;
          renderer.draw({mode: 'review', noStars: true, fleet: [{key: 'probe', pos: [0, 0, 0], yaw: Math.PI/3}]});
          const rotated = read();

          // Read the real uploaded material, not a transcription of its
          // generation algorithm. Flat-color connected regions reveal actual
          // stepped outlines, aspect ratios and the mix of plate scales.
          const S = 1024, framebuffer = gl.createFramebuffer(), atlas = new Uint8Array(S*S*4);
          gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, renderer.tex.armor.a, 0);
          const framebufferComplete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
          gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(framebuffer);
          let darkest = 255, chroma = 0;
          for (let i = 0; i < atlas.length; i += 4) {darkest = Math.min(darkest, atlas[i]); chroma = Math.max(chroma, Math.abs(atlas[i]-atlas[i+1]), Math.abs(atlas[i]-atlas[i+2]));}
          const seen = new Uint8Array(S*S), regions = [], stack = [];
          for (let i = 0; i < S*S; i++) {
            const tone = atlas[i*4];
            if (seen[i] || tone < 199 || tone > 217) continue;
            seen[i] = 1; stack.push(i);
            let size = 0, x0 = S, x1 = 0, y0 = S, y1 = 0;
            while (stack.length) {
              const k = stack.pop(), x = k%S, y = Math.floor(k/S);
              size++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
              for (const n of [x > 0 ? k-1 : -1, x < S-1 ? k+1 : -1, y > 0 ? k-S : -1, y < S-1 ? k+S : -1]) {
                if (n < 0 || seen[n] || atlas[n*4] !== tone) continue;
                seen[n] = 1; stack.push(n);
              }
            }
            if (size > 100) regions.push({size, occupancy: size/((x1-x0+1)*(y1-y0+1)), aspect: Math.max((x1-x0+1)/(y1-y0+1), (y1-y0+1)/(x1-x0+1))});
          }
          const output = {
            derivatives: renderer.armorDerivatives,
            alternate: diff(snapshots.original, snapshots.alternate), split: diff(snapshots.original, snapshots.split),
            fleet: diff(snapshots.original, fleet), rotated: diff(fleet, rotated), paintedPixels, maxHueError,
            atlas: {framebufferComplete, darkest, chroma, regions: regions.length, stepped: regions.filter(r => r.occupancy > .45 && r.occupancy < .9).length, elongated: regions.filter(r => r.aspect > 3).length, scaleRatio: Math.max(...regions.map(r => r.size))/Math.min(...regions.map(r => r.size))},
            glError: gl.getError(),
          };
          renderer.dispose();
          return output;
        });
        assert.equal(result.derivatives, derivatives);
        assert.deepEqual(errors, []);
        assert.equal(result.glError, 0);
        for (const name of ['alternate', 'split', 'fleet', 'rotated']) {
          assert.ok(result[name].interior > 50000, name+' needs a visible rendered face');
          assert.ok(result[name].max <= 2 && result[name].mean < .05, name+' must preserve the actual armor image');
        }
        assert.ok(result.paintedPixels > 50000 && result.maxHueError < .025, 'neutral plating must retain authored paint hue');
        assert.equal(result.atlas.framebufferComplete, true);
        assert.ok(result.atlas.darkest >= 140 && result.atlas.chroma <= 1, 'seams remain subtle gray instead of black or colored');
        assert.ok(result.atlas.regions > 20 && result.atlas.stepped >= 5 && result.atlas.elongated >= 5 && result.atlas.scaleRatio > 8, 'the actual material needs interlocking silhouettes and multiple plate scales');
      } finally {await page.close();}
    });
  } finally {await browser.close();}
});
