// Imports the built package the way a user would (ESM) and checks a few exports exist.
import assert from 'node:assert/strict';

const lib = await import('@strafechat/strafe.js');

for (const name of ['REST', 'Routes', 'Collection', 'PermissionsBitField', 'PermissionFlagsBits', 'SnowflakeUtil']) {
  assert.ok(name in lib, `missing export ${name}`);
}
assert.equal(lib.SnowflakeUtil.timestampFrom('2102226824774811648') > 0, true);
console.log('ESM smoke ok');
