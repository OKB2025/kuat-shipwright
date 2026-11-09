// v24 The STL-measured CIS solids render with the hull's plating, without per-plate structure detail.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),gfx=fs.readFileSync(path.join(root,'js/gfx.js'),'utf8'),core=fs.readFileSync(path.join(root,'js/core.js'),'utf8');
test('measured hull solids use the hull plating and skip structure detail',()=>{
 assert.match(core,/const MEASURED_SOLID_ID=100000;/,'the renderer mirrors the measured-solid id range');
 const fn=gfx.match(/function measuredHullSolid\(ship,p\)\{[^\n]*\}/)?.[0];assert.ok(fn);
 for(const key of ['recusant','recusantDn','munificent','providence','providenceDn','lucrehulk','lh3210'])assert.match(gfx,new RegExp(`'${key}'`));
 assert.match(gfx,/measuredHullSolid\(ship,p\)\)\{const T=equipmentSkinTriangles\(ship,'p'\+p\.id,C\.structTriangles\(p\)\);hullTriangleMesh\(out\.struct,T,/);
 assert.match(gfx,/if\(p\.form==='reference'\|\|p\.plate\|\|measuredHullSolid\(ship,p\)\)return;/);
});
test('armour plates are drawn plain, without a plate pattern',()=>{
 assert.match(gfx,/plate: 'plain'/);assert.match(gfx,/T\.plain = \{a, e\}/);assert.match(gfx,/source==='plate'\?0:0\);/);
});
