const fs = require('fs');
const meta = JSON.parse(fs.readFileSync('.open-next/server-functions/default/handler.mjs.meta.json', 'utf8'));
const inputs = Object.entries(meta.inputs).map(([k, v]) => ({ file: k, size: v.bytesInOutput })).sort((a,b) => b.size - a.size);
inputs.slice(0, 30).forEach(x => console.log(`${(x.size / 1024).toFixed(2)} KB - ${x.file}`));
