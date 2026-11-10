/** `GET <api>/`: what an instance is and what it offers (no auth). */
export interface APIInstanceIndex {
  /** Server identity. */
  strafe: { version?: string };
  /** Feature switches. */
  features?: {
    /** Registration captcha. */
    captcha?: { enabled: boolean; provider?: string; site_key?: string; api_url?: string };
    /** Email delivery. */
    email?: { enabled: boolean; verification_required?: boolean };
    /** Registration by instance invite only. */
    invite_only?: { enabled: boolean };
    /** Voice and video. */
    voice?: { enabled: boolean };
    /** GIF search. */
    gifs?: { enabled: boolean; providers?: string[] };
    /** Game activity. */
    activities?: { enabled: boolean };
    /** Anything newer. */
    [feature: string]: unknown;
  };
  /** Where services live. */
  services?: {
    /** The gateway (omitted when not configured). */
    stargate?: { url?: string };
    /** The web client. */
    web?: { url?: string };
    /** The CDN (`url` only while enabled). */
    cdn?: { enabled: boolean; url?: string };
    /** Voice signalling. */
    voice?: { enabled: boolean; url?: string };
  };
  /** Federation. */
  federation?: { enabled: boolean; domain?: string };
}

/** `https://<domain>/.well-known/strafe`: served by instances that federate. */
export interface APIInstanceWellKnown {
  /** Federation domain. */
  domain: string;
  /** Protocol version. */
  version: number;
  /** REST API base. */
  api_url: string;
  /** Gateway URL, when advertised. */
  gateway_url?: string;
  /** Federation endpoint. */
  federation_url?: string;
  /** Signing key id. */
  key_id?: string;
  /** Ed25519 public key (base64). */
  public_key?: string;
  /** Server software. */
  software?: { name: string; version: string };
}
