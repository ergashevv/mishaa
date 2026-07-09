const fs = require('fs');
const path = require('path');

const targets = [
  '.open-next/server-functions/default/node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm',
  '.open-next/server-functions/default/node_modules/@prisma/client/runtime/query_engine_bg.sqlite.wasm',
  '.open-next/server-functions/default/node_modules/@prisma/client/runtime/query_engine_bg.mysql.js',
  '.open-next/server-functions/default/node_modules/@prisma/client/runtime/query_engine_bg.sqlite.js',
];

targets.forEach((target) => {
  const absolutePath = path.resolve(process.cwd(), target);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
    console.log(`Deleted: ${target}`);
  } else {
    console.log(`Not found (skipped): ${target}`);
  }
});
