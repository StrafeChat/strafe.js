import type { Snowflake } from '../../util/Snowflake.js';
import type { ISO8601Timestamp } from './common.js';

/** OAuth2 scope strings Strafe knows. */
export type APIOAuth2Scope = 'identify' | 'email' | 'spaces' | 'spaces.join' | 'bot';

/** `POST /oauth2/token` success. */
export interface APIOAuth2TokenResponse {
  /** The access token (send as `Authorization: Bearer`). */
  access_token: string;
  /** Always `Bearer`. */
  token_type: 'Bearer';
  /** Seconds until the access token expires (604800 = 7 days). */
  expires_in: number;
  /** Trade it for a new pair; refresh tokens do not expire on their own. */
  refresh_token: string;
  /** Granted scopes, space separated. */
  scope: string;
}

/** An application as public endpoints show it. */
export interface APIApplicationSummary {
  /** Application id (equals its client id and its bot's user id). */
  id: Snowflake;
  /** Name. */
  name: string;
  /** Description. */
  description: string;
  /** Icon URL or `""`. */
  icon: string;
  /** Whether it has a bot. */
  has_bot: boolean;
  /** Whether anyone may install the bot. */
  bot_public: boolean;
}

/** `GET /oauth2/@me` with a Bearer access token. */
export interface APIOAuth2CurrentAuthorization {
  /** The application the token belongs to. */
  application: APIApplicationSummary;
  /** Granted scopes. */
  scopes: string[];
  /** When the access token expires. */
  expires: ISO8601Timestamp;
  /** The user (with `identify` or `email`). */
  user?: { id: Snowflake; username: string; display_name: string; avatar: string; public_flags: number };
}
