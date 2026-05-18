#!/usr/bin/env node
/**
 * @file scripts/patch-prisma-wasm-loader.mjs
 *
 * Prisma 6 client が Cloudflare Workers で動かない問題への対策パッチ。
 *
 * ## 背景
 *
 * `.prisma/client/wasm.js` の `config.compilerWasm.getQueryCompilerWasmModule()` が
 *     const loader = (await import('#wasm-compiler-loader')).default
 *     const compiler = (await loader).default
 * という流れで subpath import `#wasm-compiler-loader` を経由し、最終的に
 * `wasm-worker-loader.mjs` の `export default import('./query_compiler_bg.wasm')`
 * を呼ぶ。OpenNext の esbuild が `.wasm` 動的 import を `external` でマークするが、
 * Workers ランタイムには filesystem が無く、unenv の `fs.readFileSync` stub が
 * 呼ばれて以下で起動失敗:
 *     [unenv] fs.readFileSync is not implemented yet!
 *
 * ## 対処
 *
 * `prisma generate` 後に以下を行う:
 *   1. `query_compiler_bg.wasm` を Base64 化した sibling JS module を生成
 *   2. **`wasm.js` の `getQueryCompilerWasmModule` 本体を直接書換え**、
 *      subpath import を経由せず WebAssembly.compile(Uint8Array) で生成する
 *   3. 念のため `wasm-worker-loader.mjs` も同様にパッチ (subpath 経由 fallback も塞ぐ)
 *
 * これで `.wasm` 動的 import を一切経由せず、bundle 内の通常 JS 文字列として
 * embed され、Workers で安全に `WebAssembly.Module` を生成できる。
 *
 * ## 副作用
 *
 * Worker bundle が WASM サイズ (約 2 MB) 分大きくなる。
 *
 * Phase 5 で `provider = "prisma-client"` (Prisma 6.7+ TS-first 生成、WASM 不要)
 * への移行を検討する。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const PATCH_MARKER = '// AUTO-PATCHED-BY: scripts/patch-prisma-wasm-loader.mjs'

// patch 対象は複数箇所:
//   - node_modules/.prisma/client/        ← prisma generate 直後
//   - .next/standalone/node_modules/.prisma/client/  ← next build 後、OpenNext が bundle する場所
// 第 1 引数で .prisma/client へのパスを指定可能 (省略時は node_modules 直下)。
const PRISMA_CLIENT_DIR = process.argv[2] ?? path.join('node_modules', '.prisma', 'client')
const WASM_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_bg.wasm')
// CJS module (require できる形式) で base64 を持たせる。
// esbuild は require() を静的解析でインライン化できるが、await import() は
// dynamic require / fs.readFileSync に倒れることがあるため CJS にする。
const BASE64_CJS_MODULE_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_bg.wasm.base64.js')
const BASE64_ESM_MODULE_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_bg.wasm.base64.mjs')
const WORKER_LOADER_PATH = path.join(PRISMA_CLIENT_DIR, 'wasm-worker-loader.mjs')
const EDGE_LOADER_PATH = path.join(PRISMA_CLIENT_DIR, 'wasm-edge-light-loader.mjs')
const WASM_JS_PATH = path.join(PRISMA_CLIENT_DIR, 'wasm.js')
const INDEX_JS_PATH = path.join(PRISMA_CLIENT_DIR, 'index.js')

function log(msg) {
  console.log(`[patch-prisma-wasm] ${msg}`)
}

if (!existsSync(WASM_PATH)) {
  log(`WASM file not found at ${WASM_PATH} - skipping`)
  process.exit(0)
}

// ====== 1. Base64 module (CJS + ESM の両方) ======
const wasmBytes = readFileSync(WASM_PATH)
const base64 = wasmBytes.toString('base64')
log(`WASM size: ${wasmBytes.byteLength} bytes, ${base64.length} base64 chars`)

// CJS 版 (require で静的バンドル可能)
const base64CjsContent = `${PATCH_MARKER}
// Generated from query_compiler_bg.wasm. Do not edit directly.
module.exports = ${JSON.stringify(base64)}
`
writeFileSync(BASE64_CJS_MODULE_PATH, base64CjsContent)
log(`wrote base64 CJS module: ${BASE64_CJS_MODULE_PATH}`)

// ESM 版 (sibling loader mjs から import される)
const base64EsmContent = `${PATCH_MARKER}
// Generated from query_compiler_bg.wasm. Do not edit directly.
export default ${JSON.stringify(base64)}
`
writeFileSync(BASE64_ESM_MODULE_PATH, base64EsmContent)
log(`wrote base64 ESM module: ${BASE64_ESM_MODULE_PATH}`)

// ====== 2. wasm-worker-loader.mjs / wasm-edge-light-loader.mjs ======
const loaderContent = `${PATCH_MARKER}
import base64 from './query_compiler_bg.wasm.base64.mjs'

function _base64ToBytes(b64) {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const _compiled = WebAssembly.compile(_base64ToBytes(base64)).then((mod) => ({ default: mod }))
export default _compiled
`
writeFileSync(WORKER_LOADER_PATH, loaderContent)
log(`patched: ${WORKER_LOADER_PATH}`)

if (existsSync(EDGE_LOADER_PATH)) {
  writeFileSync(EDGE_LOADER_PATH, loaderContent)
  log(`patched: ${EDGE_LOADER_PATH}`)
}

// ====== 3. wasm.js の getQueryCompilerWasmModule 本体を直接書換え ======
if (!existsSync(WASM_JS_PATH)) {
  log(`wasm.js not found at ${WASM_JS_PATH} - skipping wasm.js patch`)
  process.exit(0)
}

let wasmJs = readFileSync(WASM_JS_PATH, 'utf-8')
let wasmJsAlreadyPatched = false

if (wasmJs.includes(PATCH_MARKER)) {
  log('wasm.js already patched, skipping wasm.js rewrite (sentinel will still be written)')
  wasmJsAlreadyPatched = true
}

// Prisma が生成する getQueryCompilerWasmModule の典型形:
//   getQueryCompilerWasmModule: async () => {
//     const loader = (await import('#wasm-compiler-loader')).default
//     const compiler = (await loader).default
//     return compiler
//   }
//
// 静的 require() を使う理由: esbuild は require() を build 時に解決して
// インライン化するが、`await import(...)` は dynamic require / fs.readFileSync
// に倒れて Workers で `[unenv] fs.readFileSync is not implemented yet!` を
// 引き起こす。CJS の require で静的バンドルを保証する。
const subpathImportRegex = /getQueryCompilerWasmModule:\s*async\s*\(\s*\)\s*=>\s*\{[^}]*?import\(\s*['"`]#wasm-compiler-loader['"`]\s*\)[^}]*?\}/m
// Workers では top-level の binding を返し、それ以外 (Node.js / 他 edge ランタイム) では
// 元の subpath import 経由 (wasm-worker-loader.mjs) に fallback する。
const replacement = `getQueryCompilerWasmModule: async () => {
    ${PATCH_MARKER}
    if (__PRISMA_WASM_MODULE) {
      return __PRISMA_WASM_MODULE
    }
    const loader = (await import('#wasm-compiler-loader')).default
    const compiler = (await loader).default
    return compiler
  }`

if (!wasmJsAlreadyPatched) {
  if (!subpathImportRegex.test(wasmJs)) {
    log('WARNING: getQueryCompilerWasmModule pattern not found in wasm.js')
    log('Prisma generator output may have changed. Inspect the file to update the patch.')
    process.exit(1)
  }

  // top-level に WASM module の require を挿入。`config.compilerWasm = {` の直前で
  // 必ず初期化済になる位置にする。
  const wasmJsTopLevelRequire = `\n${PATCH_MARKER}\n// Top-level guarded require: Workers では esbuild が wrangler binding に静的解決する。\n// Node.js (next build の Collecting page data 等) では navigator が undefined なので\n// require は実行されず、Node.js が .wasm を JS として parse して落ちる事故を防ぐ。\nlet __PRISMA_WASM_MODULE\nif (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') {\n  __PRISMA_WASM_MODULE = require('./query_compiler_bg.wasm')\n}\n\n`
  wasmJs = wasmJs.replace(/(config\.compilerWasm\s*=\s*\{)/, `${wasmJsTopLevelRequire}$1`)
  wasmJs = wasmJs.replace(subpathImportRegex, replacement)
  writeFileSync(WASM_JS_PATH, wasmJs)
  log(`patched: ${WASM_JS_PATH}`)
}

// ====== 3.5. index.js の getQueryCompilerWasmModule (fs.readFileSync 直接呼出) を patch ======
//
// .prisma/client/index.js は Node.js 用の entry point で、本来は Prisma の Library
// engine 用 (Rust binary 経由) のはず。だが engineType="client" でも getQueryCompilerWasmModule
// が定義されており、これは:
//     const filePath = require('path').join(config.dirname, 'query_compiler_bg.wasm')
//     const bytes = require('fs').readFileSync(filePath)
//     return new WebAssembly.Module(bytes)
// と直接 fs.readFileSync を呼ぶ。
//
// OpenNext esbuild は platform: "node" + conditions: ["workerd"] で両方の条件が立つが、
// package.json の exports 順 (node が workerd より先) のため "node" 条件が優先され
// index.js が選ばれる。結果 fs.readFileSync が bundle に inline されて Workers で死ぬ。
let indexJsAlreadyPatched = false
let indexJsExists = false
if (existsSync(INDEX_JS_PATH)) {
  indexJsExists = true
  let indexJs = readFileSync(INDEX_JS_PATH, 'utf-8')
  if (indexJs.includes(PATCH_MARKER)) {
    log('index.js already patched, skipping')
    indexJsAlreadyPatched = true
  } else {
    // index.js のパターン (path.join / fs.readFileSync 両方を含む):
    //   getQueryCompilerWasmModule: async () => {
    //     const queryCompilerWasmFilePath = require('path').join(config.dirname, 'query_compiler_bg.wasm')
    //     const queryCompilerWasmFileBytes = require('fs').readFileSync(queryCompilerWasmFilePath)
    //     return new WebAssembly.Module(queryCompilerWasmFileBytes)
    //   }
    const indexJsRegex = /getQueryCompilerWasmModule:\s*async\s*\(\s*\)\s*=>\s*\{[^}]*?require\(\s*['"`]fs['"`]\s*\)\.readFileSync[^}]*?\}/m
    // Workers では top-level の binding を返し、Node.js (next build の静的生成) では
    // 元の fs.readFileSync 経路に fallback する hybrid 実装。
    // 注意: Workers bundle にも fallback コードが含まれるが、Workers では
    //   __PRISMA_WASM_MODULE が真値になり if 内で return するため fs.readFileSync は
    //   実行されない。
    const indexJsReplacement = `getQueryCompilerWasmModule: async () => {
        ${PATCH_MARKER}
        if (__PRISMA_WASM_MODULE) {
          return __PRISMA_WASM_MODULE
        }
        // Node.js fallback (next build / next start の query 実行用)
        const queryCompilerWasmFilePath = require('path').join(config.dirname, 'query_compiler_bg.wasm')
        const queryCompilerWasmFileBytes = require('fs').readFileSync(queryCompilerWasmFilePath)
        return new WebAssembly.Module(queryCompilerWasmFileBytes)
      }`
    if (!indexJsRegex.test(indexJs)) {
      log('WARNING: getQueryCompilerWasmModule (fs.readFileSync version) pattern not found in index.js')
      log('Prisma generator output may have changed. Inspect the file to update the patch.')
      process.exit(1)
    }
    // top-level guarded require を挿入 (Workers では実行、Node.js では skip)
    const indexJsTopLevelRequire = `\n${PATCH_MARKER}\n// Top-level guarded require: Workers では esbuild が wrangler binding に静的解決する。\n// Node.js (next build の Collecting page data 等) では navigator が undefined なので\n// require は実行されず、Node.js が .wasm を JS として parse して落ちる事故を防ぐ。\nlet __PRISMA_WASM_MODULE\nif (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') {\n  __PRISMA_WASM_MODULE = require('./query_compiler_bg.wasm')\n}\n\n`
    indexJs = indexJs.replace(/(config\.compilerWasm\s*=\s*\{)/, `${indexJsTopLevelRequire}$1`)
    indexJs = indexJs.replace(indexJsRegex, indexJsReplacement)
    writeFileSync(INDEX_JS_PATH, indexJs)
    log(`patched: ${INDEX_JS_PATH}`)
  }
}

// ====== 4. Build 時の sentinel module を project 配下に書き出す ======
// この sentinel をアプリの runtime コード (例: /api/ping) から import すれば、
// build 時に patch が走ったかを runtime レスポンスで確認できる。
const SENTINEL_DIR = path.join('lib', 'generated')
const SENTINEL_PATH = path.join(SENTINEL_DIR, 'prisma-wasm-patch-state.ts')
mkdirSync(SENTINEL_DIR, { recursive: true })
const sentinelTs = `// AUTO-GENERATED by scripts/patch-prisma-wasm-loader.mjs at ${new Date().toISOString()}
// Do not edit. Regenerated on every \`prisma generate && patch\` cycle.
//
// /api/ping?probe=db から import して runtime レスポンスに乗せ、Cloudflare build
// 環境で patch script が実際に走ったかを判別する。
export const PRISMA_WASM_PATCH_STATE = {
  appliedAt: ${JSON.stringify(new Date().toISOString())},
  wasmBytes: ${wasmBytes.byteLength},
  base64Chars: ${base64.length},
  workerLoaderPatched: true,
  wasmJsPatched: true,
  indexJsExists: ${indexJsExists},
  indexJsPatched: ${indexJsExists && !indexJsAlreadyPatched ? true : indexJsExists ? 'true /* already patched on prev run */' : false},
} as const
`
writeFileSync(SENTINEL_PATH, sentinelTs)
log(`wrote sentinel: ${SENTINEL_PATH}`)

log('done')
