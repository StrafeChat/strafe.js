// Strafe's wire types (`API*`, `Gateway*`, `REST*`), the analogue of `discord-api-types`. Every id is
// a decimal string; permission bits are read as JSON numbers and written as decimal strings; timestamps are RFC 3339 strings.
export * from './common.js';
export * from './user.js';
export * from './room.js';
export * from './space.js';
export * from './message.js';
export * from './voice.js';
export * from './instance.js';
export * from './oauth2.js';
export * from './gateway.js';
export * from './rest.js';
export * from './webhook.js';
export * from './bridge.js';
