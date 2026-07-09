const fs = require('fs');
const file = '.open-next/server-functions/default/handler.mjs';
let code = fs.readFileSync(file, 'utf8');

const regex = /await require\(_nodepath\.default\.join\([^)]+INSTRUMENTATION_HOOK_FILENAME[^)]+\)\)/;
const match = code.match(regex);
if(match) { 
    code = code.replace(match[0], '{}'); 
    fs.writeFileSync(file, code); 
    console.log('Patched correctly: ' + match[0]); 
} else { 
    console.log('Not found!'); 
}
