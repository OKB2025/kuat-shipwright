// Takes the user's aircraft refit (KUAT_18_Aircraft_Refit.zip, 2026-11-27) in as the craft examples' sources, as the earlier refits were
// taken in (commits 98114896, eb15b066): each design file goes to docs/handoff-2026-11-20/refs/ under a dated name, and data/imperial2.js's
// CRAFT_REMODEL holds the same design. js/core.js's CRAFT_REMODEL_SOURCE names the files (edited by hand). The designs are not changed.
// usage: node import.cjs <unzipped folder>
const fs=require('fs'),path=require('path');const src=path.resolve(process.argv[2]),root=path.resolve(__dirname,'../../..');
const MAP={'ARC_170.json':'arc170','A_SF_01_B_Wing.json':'bwing','A_Wing_Remodel.json':'awing','BTL_A4.json':'ywing','BTL_B.json':'btlb','Clone_Z_95_Remodel.json':'z95','Droid_Tri_Fighter.json':'tri','Hyena_Bomber_Remodel.json':'hyena','TIE_Avenger_Prototype.json':'tie_avenger','TIE_D.json':'tie_d','TIE_IN_Remodel.json':'tie_in','TIE_LN_Remodel.json':'tie_ln','TIE_SA.json':'tie_sa','U_Wing.json':'uwing','V_19_Torrent_Remodel.json':'v19','V_Wing_Remodel.json':'vwing','Vulture_Droid_Remodel.json':'vulture','X_Wing_Remodel.json':'xwing'};
const file='data/imperial2.js',text=fs.readFileSync(path.join(root,file),'utf8'),lines=text.split('\n'),i=lines.findIndex(l=>l.startsWith('const CRAFT_REMODEL='));if(i<0)throw new Error('CRAFT_REMODEL not found');
const craft=JSON.parse(lines[i].slice('const CRAFT_REMODEL='.length).replace(/;\s*$/,''));const out={};
for(const [f,key] of Object.entries(MAP)){const raw=fs.readFileSync(path.join(src,f),'utf8'),design=JSON.parse(raw),name=key+'-refit-2026-11-27.json';fs.writeFileSync(path.join(root,'docs/handoff-2026-11-20/refs',name),raw);craft[key]=design.design||design;out[key]=name;}
lines[i]='const CRAFT_REMODEL='+JSON.stringify(craft)+';';fs.writeFileSync(path.join(root,file),lines.join('\n'));
console.log(JSON.stringify(out));
