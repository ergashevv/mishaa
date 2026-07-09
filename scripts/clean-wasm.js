const fs = require('fs');
const path = require('path');

const targets = [
  '.open-next/server-functions/default/node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm',
  '.open-next/server-functions/default/node_modules/@prisma/client/runtime/query_engine_bg.sqlite.wasm',
  '.open-next/server-functions/default/node_modules/@prisma/client/runtime/query_engine_bg.mysql.js',
  '.open-next/server-functions/default/node_modules/@prisma/client/runtime/query_engine_bg.sqlite.js',
  // Deduped postgresql query engine: this is a BYTE-IDENTICAL copy of
  // @prisma/client/runtime/query_engine_bg.postgresql.wasm (~2.1 MiB). patch-opennext.js redirects the
  // handler's import() of this path to the runtime copy, so this file is unreferenced and its removal
  // keeps the Worker under Cloudflare's free-plan 3 MiB limit. (Keep the runtime postgresql.wasm — it is
  // the engine Prisma actually loads on workerd.)
  '.open-next/server-functions/default/node_modules/.prisma/client/query_engine_bg.wasm',
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
