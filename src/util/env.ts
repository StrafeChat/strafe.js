/**
 * Reads an environment variable without importing `node:process`, so the module also loads in
 * Deno (without `--allow-env` it just returns `undefined`) and in browsers.
 *
 * @param name - Variable name, e.g. `STRAFE_TOKEN`.
 * @internal
 */
export function readEnv(name: string): string | undefined {
  try {
    const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
    return value === undefined || value === '' ? undefined : value;
  } catch {
    return undefined;
  }
}
