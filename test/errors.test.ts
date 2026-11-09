import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HTTPError, RateLimitError, StrafeAPIError } from '../src/errors/APIErrors.js';
import { ErrorCodes, ErrorMessages } from '../src/errors/ErrorCodes.js';
import { StrafeError, StrafeRangeError, StrafeTypeError, errorDetails } from '../src/errors/StrafeError.js';
import { version } from '../src/util/version.js';

const requestBody = { json: { plaintext: 'hi' }, files: undefined };

describe('library errors', () => {
  it('fill in messages from the code', () => {
    const error = new StrafeError(ErrorCodes.RoomEncrypted);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('RoomEncrypted');
    expect(error.name).toBe('StrafeError [RoomEncrypted]');
    expect(error.message).toMatch(/end-to-end encrypted/);
    expect(new StrafeError(ErrorCodes.InstanceMissing).message).toMatch(/STRAFE_INSTANCE/);
    expect(new StrafeError(ErrorCodes.TokenMissing).message).toMatch(/STRAFE_TOKEN/);
  });

  it('take arguments, a path and a cause', () => {
    const cause = new Error('inner');
    const error = new StrafeRangeError(ErrorCodes.EmbedInvalid, 'embeds[0].title', 'too long', errorDetails({ path: 'embeds[0].title', cause }));
    expect(error).toBeInstanceOf(RangeError);
    expect(error.message).toBe('embeds[0].title: too long');
    expect(error.path).toBe('embeds[0].title');
    expect(error.cause).toBe(cause);
    const typeError = new StrafeTypeError(ErrorCodes.InvalidType, 'content', 'a string');
    expect(typeError).toBeInstanceOf(TypeError);
    expect(typeError.message).toBe('content must be a string.');
    expect(typeError.path).toBeUndefined();
  });

  it('every code has a message', () => {
    for (const code of Object.values(ErrorCodes)) expect(ErrorMessages[code]).toBeDefined();
  });
});

describe('API errors', () => {
  it('StrafeAPIError keeps the body, code and path', () => {
    const error = new StrafeAPIError(
      { error: 'embeds[0].title: too long', code: 'invalid_embed', path: 'embeds[0].title' },
      400,
      'POST',
      'https://x/api/rooms/1/messages',
      requestBody,
    );
    expect(error.status).toBe(400);
    expect(error.code).toBe('invalid_embed');
    expect(error.path).toBe('embeds[0].title');
    expect(error.message).toBe('embeds[0].title: too long');
    expect(error.name).toBe('StrafeAPIError[invalid_embed]');
    expect(error.requestBody).toBe(requestBody);
  });

  it('StrafeAPIError reads OAuth2 errors and plain messages', () => {
    const oauth = new StrafeAPIError({ error: 'invalid_grant', error_description: 'code expired' }, 400, 'POST', 'u', requestBody);
    expect(oauth.code).toBe('invalid_grant');
    expect(oauth.message).toBe('invalid_grant: code expired');
    const plain = new StrafeAPIError({ error: 'message not found' }, 404, 'GET', 'u', requestBody);
    expect(plain.code).toBeNull();
    expect(plain.name).toBe('StrafeAPIError[404]');
    const slow = new StrafeAPIError({ error: 'slowmode is on in this channel', retry_after: 3 }, 429, 'POST', 'u', requestBody); // terms-ok: server text
    expect(slow.retryAfter).toBe(3);
    expect(new StrafeAPIError({ error: '' }, 500, 'GET', 'u', requestBody).message).toBe('500 GET u');
  });

  it('HTTPError and RateLimitError', () => {
    const http = new HTTPError(502, 'Bad Gateway', 'GET', 'u', '<html>', requestBody);
    expect(http.message).toBe('Bad Gateway');
    expect(http.name).toBe('HTTPError');
    const limit = new RateLimitError({
      timeToReset: 5000,
      limit: 15,
      method: 'POST',
      hash: 'POST /rooms/:id/messages',
      url: 'u',
      route: '/rooms/:id/messages',
      majorParameter: '1',
      global: false,
      scope: 'user',
      retryAfter: 5000,
      sublimitTimeout: 0,
    });
    expect(limit.message).toMatch(/5000 ms/);
    expect(limit.route).toBe('/rooms/:id/messages');
    expect(limit.name).toBe('RateLimitError');
  });
});

describe('version', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(version).toBe(pkg.version);
  });
});
