const {chromium}=require('playwright'),fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({deviceScaleFactor:1});for(const f of process.argv.slice(2)){await p.setContent(`<body style="margin:0">${fs.readFileSync(f,'utf8')}</body>`);const el=await p.$('svg');await el.screenshot({path:f.replace(/\.svg$/,'.png')});}await b.close();})();
