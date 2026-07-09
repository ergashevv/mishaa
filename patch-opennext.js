const fs = require('fs');
const path = require('path');

// Runs AFTER `opennextjs-cloudflare build` (see the "cf:build" npm script). It fixes two codegen bugs
// in the generated Cloudflare Worker handler that otherwise 500 every request in production.
//
// IMPORTANT: this must NOT live inside the `build` script. `opennextjs-cloudflare build` invokes
// `npm run build` itself and only generates handler.mjs afterwards, so patching there runs too early
// (the file doesn't exist yet) and silently skips — which is exactly how the unpatched 500 shipped.

const handlerPath = path.join(process.cwd(), '.open-next', 'server-functions', 'default', 'handler.mjs');

function fail(msg) {
  console.error('[patch-opennext] ERROR: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(handlerPath)) {
  fail(`handler.mjs not found at ${handlerPath}. Run only after \`opennextjs-cloudflare build\` (use the "cf:build" script).`);
}

let code = fs.readFileSync(handlerPath, 'utf8');
const applied = [];

// ---------------------------------------------------------------------------
// Fix 1 — `ReferenceError: t is not defined` in loadCustomCacheHandlers().
// OpenNext's AST patcher strips `const { cacheHandlers: t } = this.nextConfig;` (plus a sibling `e`)
// but leaves `t`/`e` referenced in the function body, so the Worker throws on the cache-handler init
// that runs for EVERY request → OpenNext's catch-all returns `{"message":"Server failed to respond."}`.
// Re-declaring them as undefined locals makes the `t && ...` guard short-circuit safely (this app
// registers no custom cache handlers).
{
  const unpatched = 'async loadCustomCacheHandlers(){let handlersSymbol';
  const patched = 'async loadCustomCacheHandlers(){let t,e;let handlersSymbol';
  const n = code.split(unpatched).length - 1; // patch EVERY copy, not just the first
  if (n > 0) {
    code = code.split(unpatched).join(patched);
    applied.push(`cache-handlers (${n})`);
  } else if (code.includes(patched)) {
    applied.push('cache-handlers (already patched)');
  } else {
    fail('could not locate loadCustomCacheHandlers() — OpenNext output changed; re-verify the "t is not defined" fix.');
  }
}

// ---------------------------------------------------------------------------
// Fix 2 — `Dynamic require of ".next/server/instrumentation.js" is not supported`.
// OpenNext ships a patch that neutralizes the instrumentation hook, but it targets only ONE of the
// two minified loadInstrumentationModule() copies and non-deterministically misses the active one
// (this is what shipped the 500 even on a clean build). Instead we neutralize the single shared
// getInstrumentationModule() that every copy calls — forcing it to return null so the unsupported
// dynamic require never runs. This app's src/instrumentation.ts is a no-op (`export function
// register(){}`), so disabling the hook is behaviourally equivalent.
{
  const anchor = 'function getInstrumentationModule(';
  const marker = 'return null;/*opennext-no-instrumentation*/';
  const dynamicHookPresent = /loadInstrumentationModule\(\)\{if\(!this\.serverOptions\.dev\)/.test(code);
  if (code.includes(marker)) {
    applied.push('instrumentation (already patched)');
  } else {
    const idx = code.indexOf(anchor);
    if (idx >= 0) {
      const braceIdx = code.indexOf('{', idx + anchor.length);
      if (braceIdx < 0) fail('malformed getInstrumentationModule() — no function body found.');
      code = code.slice(0, braceIdx + 1) + marker + code.slice(braceIdx + 1);
      applied.push('instrumentation');
    } else if (dynamicHookPresent) {
      fail('instrumentation hook present but getInstrumentationModule() not found — cannot neutralize the dynamic require.');
    } else {
      applied.push('instrumentation (not needed)');
    }
  }
}

// ---------------------------------------------------------------------------
// Fix 3 — dedup Prisma's query-engine wasm to fit the Cloudflare free-plan 3 MiB Worker limit.
// @prisma/client ships the SAME postgresql query engine at two paths, and the handler import()s both,
// so esbuild bundles ~2.1 MiB (~0.84 MiB gzip) of BYTE-IDENTICAL wasm twice. Point the `.prisma/client`
// copy's import() at the `@prisma/client/runtime` copy so esbuild bundles the engine once; clean-wasm.js
// then deletes the now-unreferenced `.prisma/client` file. The `case` labels are left untouched, so
// whichever path Prisma requests at runtime still resolves to the (identical) kept engine.
{
  const dupImport = /import\("([^"]*)\/\.prisma\/client\/query_engine_bg\.wasm"\)/g;
  const n = (code.match(dupImport) || []).length;
  if (n > 0) {
    code = code.replace(dupImport, 'import("$1/@prisma/client/runtime/query_engine_bg.postgresql.wasm")');
    applied.push(`wasm-dedup (${n})`);
  } else {
    applied.push('wasm-dedup (not needed)');
  }
}

fs.writeFileSync(handlerPath, code);

// Verify the writes stuck.
const out = fs.readFileSync(handlerPath, 'utf8');
if (!out.includes('async loadCustomCacheHandlers(){let t,e;let handlersSymbol')) {
  fail('cache-handlers patch verification failed after write.');
}
if (out.includes('async loadCustomCacheHandlers(){let handlersSymbol')) {
  fail('a residual unpatched loadCustomCacheHandlers() copy remains after patching.');
}
if (/loadInstrumentationModule\(\)\{if\(!this\.serverOptions\.dev\)/.test(out) &&
    !out.includes('return null;/*opennext-no-instrumentation*/')) {
  fail('instrumentation patch verification failed after write (dynamic require still reachable).');
}

console.log('[patch-opennext] Applied: ' + applied.join(', ') + '.');
