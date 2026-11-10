// The package is ESM only; Node >= 22.12 can still require() it (require(esm)). This proves it.
const assert = require('node:assert/strict');

const lib = require('@strafechat/strafe.js');

for (const name of ['REST', 'Routes', 'Collection', 'PermissionsBitField']) {
  assert.ok(name in lib, `missing export ${name}`);
}
console.log('CJS require(esm) smoke ok');
