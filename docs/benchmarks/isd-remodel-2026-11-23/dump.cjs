const path=require('path'),fs=require('fs');const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const s=C.buildDesign(process.argv[2]);fs.writeFileSync(process.argv[3],JSON.stringify(C.serialize(s)));console.log('written');
