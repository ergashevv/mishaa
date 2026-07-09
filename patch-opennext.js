const fs = require('fs');
const path = require('path');

const handlerPath = path.join(process.cwd(), '.open-next', 'server-functions', 'default', 'handler.mjs');

if (!fs.existsSync(handlerPath)) {
  console.log('[patch-opennext] handler.mjs not found. Skipping.');
  process.exit(0);
}

let code = fs.readFileSync(handlerPath, 'utf8');

// Patch 1: Fix `ReferenceError: t is not defined` in loadCustomCacheHandlers
// OpenNext's AST patcher removes `const { cacheHandlers: t } = this.nextConfig;` but leaves `t` in the function body
const targetCacheStr = 'async loadCustomCacheHandlers(){let handlersSymbol';
if (code.includes(targetCacheStr) && !code.includes('async loadCustomCacheHandlers(){let t,e;let handlersSymbol')) {
  code = code.replace(targetCacheStr, 'async loadCustomCacheHandlers(){let t,e;let handlersSymbol');
  console.log('[patch-opennext] Successfully patched loadCustomCacheHandlers()');
}

fs.writeFileSync(handlerPath, code);
console.log('[patch-opennext] Patch complete!');
