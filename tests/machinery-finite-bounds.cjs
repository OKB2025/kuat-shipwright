const assert=require('node:assert/strict'),{test}=require('node:test'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(require('node:path').resolve(__dirname,'..')),near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9,`${a} != ${b}`);
function body(a,b,r0,r1){const delta=C.sub(b,a),length=C.len(delta),fr=C.frameAxis(delta);return {k:'machinery',seg:{a,b,r0,r1,l:length,...fr}};}
test('finite engine cylinders have end caps without an extra axial radius',()=>{
 for(const axis of [0,1,2]){const a=[10,20,30],b=a.slice();b[axis]+=100;const p=body(a,b,12,5),B=C.partAABB(p);near(B[axis],a[axis]);near(B[axis+3],b[axis]);for(const j of [0,1,2].filter(i=>i!==axis)){near(B[j],a[j]-12);near(B[j+3],a[j]+12);}}
});
test('tilted tapered machinery bounds contain every finite surface ring and attain all six extrema',()=>{
 const p=body([7,-4,9],[23,31,-8],12,5),s=p.seg,B=C.partAABB(p),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<=16;i++)for(let j=0;j<2048;j++){const t=i/16,r=s.r0+(s.r1-s.r0)*t,a=j*Math.PI/1024,q=C.add(C.add(s.a,C.mul(s.u,s.l*t)),C.add(C.mul(s.v,r*Math.cos(a)),C.mul(s.w,r*Math.sin(a))));for(let k=0;k<3;k++){assert.ok(q[k]>=B[k]-1e-9&&q[k]<=B[k+3]+1e-9);lo[k]=Math.min(lo[k],q[k]);hi[k]=Math.max(hi[k],q[k]);}}
 for(let k=0;k<3;k++){assert.ok(Math.abs(lo[k]-B[k])<2e-5);assert.ok(Math.abs(hi[k]-B[k+3])<2e-5);}
});
