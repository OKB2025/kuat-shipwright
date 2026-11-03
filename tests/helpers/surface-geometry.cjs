// Separate declared, intentionally projecting scenery from the recessed skin.
// Production owner ranges remain disjoint and are checked by projection tests.
function projectionSpans(ranges, name) {
  const out=[];
  for(const [owner,spans] of Object.entries(ranges||{}))for(const [mesh,start,count,meta] of spans)
    if(mesh===name&&meta?.projection)out.push({owner:Number.isFinite(+owner)?+owner:owner,start,count,meta});
  return out;
}
function primaryGeometry(geo, ranges, name) {
  const spans=projectionSpans(ranges,name);if(!spans.length)return geo;
  const skip=new Uint8Array(geo.ni);for(const {start,count} of spans)skip.fill(1,start,start+count);
  const attrs={pos:[],nor:[],uv:[],col:[]},width={pos:3,nor:3,uv:2,col:4};
  for(let i=0;i<geo.ni;i++)if(!skip[i])for(const k of Object.keys(attrs))if(geo[k]){
    const start=geo.idx[i]*width[k];attrs[k].push(...geo[k].slice(start,start+width[k]));
  }
  const n=attrs.pos.length/3,out={...geo,n,ni:n,idx:Uint32Array.from({length:n},(_,i)=>i)};
  for(const k of Object.keys(attrs))if(geo[k])out[k]=geo[k].constructor.from(attrs[k]);
  return out;
}
function primarySurfaceLayers(G, ship, opt={}) {
  const ranges={},meshes=G.meshSurfaceLayers(ship,ranges,opt),out={};
  for(const [name,g] of Object.entries(meshes))out[name]=primaryGeometry(g,ranges,name);
  return out;
}
module.exports={projectionSpans,primaryGeometry,primarySurfaceLayers};
