const assert = require('node:assert/strict');
const { brotliCompressSync, brotliDecompressSync } = require('node:zlib');

assert.equal(process.versions.node, '24.22.1', 'The image must use the patched Node runtime');
const original = Buffer.from('Evolution API Brotli runtime smoke test');
const compressed = brotliCompressSync(original);
assert.deepEqual(brotliDecompressSync(compressed), original);
assert.throws(() => brotliDecompressSync(compressed.subarray(0, compressed.length - 1)));

// Load a native dependency to check compatibility with the rebuilt runtime.
assert.equal(typeof require('sharp'), 'function');
console.log(`Node ${process.versions.node}; Brotli ${process.versions.brotli}; Brotli and sharp smoke checks passed`);
