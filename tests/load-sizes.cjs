const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
// The title screen's loading bar weighs each file by KS_FILES.sizes; keep it equal to the files actually shipped.
test('the loading bar sizes match the shipped files',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),m=html.match(/"sizes":\{([^}]*)\}/);assert.ok(m,'KS_FILES.sizes is present');
 for(const [,file,size] of m[1].matchAll(/"([^"]+)":(\d+)/g))assert.equal(+size,fs.statSync(path.join(root,file)).size,`${file}: update KS_FILES.sizes in index.html`);
});
