// "Log in with Strafe" for a website: the authorization-code flow with PKCE and a `state` check,
// using only node:http. No bot and no gateway are involved.
//
// 1. Create an application in Settings -> Developers on your instance, and register the redirect
//    URI http://localhost:3000/callback on it (exactly).
// 2. STRAFE_INSTANCE=app.strafe.chat STRAFE_CLIENT_ID=... STRAFE_CLIENT_SECRET=... node examples/oauth2-login.ts
// 3. Open http://localhost:3000.
//
// The code exchange needs the client secret even with PKCE (Strafe has no public clients), so it
// always runs on a server like this one, never in a browser.
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ErrorCodes, OAuth2Client, OAuth2Scopes, StrafeError, createPKCE, createState } from '@strafechat/strafe.js';

const port = Number(process.env.PORT ?? 3000);
const clientId = process.env.STRAFE_CLIENT_ID;
const clientSecret = process.env.STRAFE_CLIENT_SECRET;
if (clientId === undefined || clientSecret === undefined) throw new Error('Set STRAFE_CLIENT_ID and STRAFE_CLIENT_SECRET');

const oauth = new OAuth2Client({
  instance: process.env.STRAFE_INSTANCE,
  clientId,
  clientSecret,
  redirectUri: `http://localhost:${String(port)}/callback`,
});

/** Logins in progress, from state to PKCE verifier. Use your session store in production. */
const pending = new Map<string, string>();

const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

function page(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><title>Strafe login</title><body style="font-family:sans-serif">${body}</body>`);
}

function cookie(req: IncomingMessage, name: string): string | undefined {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie ?? '');
  return match?.[1];
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://localhost:${String(port)}`);

  if (url.pathname === '/') {
    page(res, 200, '<a href="/login">Log in with Strafe</a>');
    return;
  }

  // #region flow
  if (url.pathname === '/login') {
    // A fresh state (ties the redirect to this browser) and PKCE pair (ties the code to this server).
    const state = createState();
    const pkce = await createPKCE();
    pending.set(state, pkce.verifier);
    setTimeout(() => pending.delete(state), 10 * 60_000).unref();
    const location = oauth.generateAuthURL({
      scopes: [OAuth2Scopes.Identify, OAuth2Scopes.Spaces],
      state,
      codeChallenge: pkce.challenge,
    });
    res.writeHead(302, {
      Location: location,
      'Set-Cookie': `strafe_state=${state}; HttpOnly; SameSite=Lax; Path=/callback; Max-Age=600`,
    });
    res.end();
    return;
  }

  if (url.pathname === '/callback') {
    const state = cookie(req, 'strafe_state') ?? '';
    const verifier = pending.get(state);
    pending.delete(state);
    try {
      // Checks the state first, then turns ?error=access_denied into OAuth2AccessDenied.
      const { code } = oauth.parseCallback(url, state);
      if (verifier === undefined) throw new StrafeError(ErrorCodes.OAuth2StateMismatch);
      const tokens = await oauth.exchangeCode(code, { codeVerifier: verifier });

      const user = await oauth.fetchUser(tokens);
      const spaces = await oauth.fetchSpaces(tokens);
      // Store tokens.refreshToken to call the API later (oauth.refreshToken() renews the pair);
      // this demo only needed them once, so it hands them back.
      await oauth.revokeToken(tokens);

      const list = spaces.map((space) => `<li>${escape(space.name)}${space.owner ? ' (owner)' : ''}</li>`).join('');
      page(res, 200, `<h1>Hello, ${escape(user.displayName)}</h1><p>@${escape(user.handle)}</p><ul>${list}</ul>`);
    } catch (error) {
      if (error instanceof StrafeError && error.code === ErrorCodes.OAuth2AccessDenied) {
        page(res, 200, 'You cancelled the login. <a href="/login">Try again</a>');
        return;
      }
      throw error;
    }
    return;
  }

  // #endregion flow
  page(res, 404, 'Not found');
}

createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    console.error(error);
    page(res, 500, 'Something went wrong. <a href="/login">Try again</a>');
  });
}).listen(port, () => {
  console.log(`Open http://localhost:${String(port)}`);
});
