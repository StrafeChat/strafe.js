import type { Client } from '../client/Client.js';

/**
 * The base of every structure: it knows its {@link Client} and serializes to camelCase JSON.
 * Structures are patched in place when the server sends newer data, so a reference you hold stays
 * current.
 *
 * (Implementation rule: fields that `_patch` sets are `declare`d, and only the final class calls
 * `_patch` from its constructor, so class-field initialisation never overwrites patched values.)
 */
export abstract class Base {
  /** The client that created this. */
  declare public readonly client: Client<true>;

  /**
   * @param client - The client.
   */
  public constructor(client: Client) {
    Object.defineProperty(this, 'client', { value: client, enumerable: false, writable: false });
  }

  /**
   * Applies wire data.
   *
   * @internal
   */
  public abstract _patch(data: unknown): void;

  /**
   * A shallow copy (used to hand out the "old" object of update events).
   *
   * @internal
   */
  public _clone(): this {
    // Copy every own property, the non-enumerable ones too (`client`, `space`, managers), so the
    // copy's getters keep working. Managers are shared with the original.
    return Object.defineProperties(Object.create(Object.getPrototypeOf(this) as object) as this, Object.getOwnPropertyDescriptors(this));
  }

  /**
   * Patches a copy and returns it, leaving this one unchanged.
   *
   * @internal
   */
  public _update(data: unknown): this {
    const clone = this._clone();
    this._patch(data);
    return clone;
  }

  /**
   * The public fields as plain JSON (ids, names, timestamps; not the client or managers).
   */
  public toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this)) {
      if (key.startsWith('_')) continue;
      out[key] = toJSONValue(value);
    }
    return out;
  }

  /** The id, for structures that have one. */
  public valueOf(): string {
    return (this as unknown as { id?: string }).id ?? '';
  }
}

function toJSONValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(toJSONValue);
  if (value instanceof Map) return [...value.keys()];
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return (value as { toJSON(): unknown }).toJSON();
  return value;
}
