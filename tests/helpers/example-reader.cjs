// Globals for a vm context that runs js/engine.js in Node and opens examples: the engine reads an
// example's saved design (data/examples/<key>/design.json.gz) through KS_READ_ASSET where the browser
// would use its verified asset cache, then checks and decompresses it with the web APIs below.
// reads (optional) collects the URLs read, for tests that assert which files were opened.
const fs=require('node:fs'),path=require('node:path');
module.exports=(root,{reads=null,read=null}={})=>({
 Blob,Response,DecompressionStream,TextDecoder,TextEncoder,crypto:globalThis.crypto,URL,
 KS_READ_ASSET:async url=>{reads?.push(url);return new Blob([read?read(url):fs.readFileSync(path.join(root,url))]);},
});
