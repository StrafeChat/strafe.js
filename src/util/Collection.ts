/**
 * A `Map` with array-like helpers: `client.spaces.cache.find((space) => space.name === 'Lobby')`.
 *
 * Every callback receives `(value, key, collection)`. Methods that return a new collection never
 * change this one; `sort`, `reverse` and `sweep` work in place like their array counterparts.
 *
 * @remarks
 * Coming from discord.js: shaped like its `Collection`, so the same habits work.
 *
 * @typeParam K - Key type (a {@link Snowflake} for every cache in this library).
 * @typeParam V - Value type.
 */
export class Collection<K, V> extends Map<K, V> {
  /**
   * Returns the value for `key`, or creates it with `defaultValueGenerator`, stores it and returns it.
   *
   * @param key - The key to look up.
   * @param defaultValueGenerator - Called when the key is missing.
   */
  public ensure(key: K, defaultValueGenerator: (key: K, collection: this) => V): V {
    if (this.has(key)) return this.get(key) as V;
    const value = defaultValueGenerator(key, this);
    this.set(key, value);
    return value;
  }

  /**
   * Whether every one of `keys` is in the collection.
   *
   * @param keys - Keys to check.
   */
  public hasAll(...keys: K[]): boolean {
    return keys.every((key) => super.has(key));
  }

  /**
   * Whether at least one of `keys` is in the collection.
   *
   * @param keys - Keys to check.
   */
  public hasAny(...keys: K[]): boolean {
    return keys.some((key) => super.has(key));
  }

  /** The first value (insertion order), or `undefined` when empty. */
  public first(): V | undefined;
  /**
   * The first `amount` values; a negative amount takes from the end.
   *
   * @param amount - How many values to return.
   */
  public first(amount: number): V[];
  public first(amount?: number): V | V[] | undefined {
    if (amount === undefined) return this.values().next().value;
    if (amount < 0) return this.last(amount * -1);
    amount = Math.min(this.size, amount);
    const iterator = this.values();
    return Array.from({ length: amount }, () => iterator.next().value as V);
  }

  /** The first key, or `undefined` when empty. */
  public firstKey(): K | undefined;
  /**
   * The first `amount` keys; a negative amount takes from the end.
   *
   * @param amount - How many keys to return.
   */
  public firstKey(amount: number): K[];
  public firstKey(amount?: number): K | K[] | undefined {
    if (amount === undefined) return this.keys().next().value;
    if (amount < 0) return this.lastKey(amount * -1);
    amount = Math.min(this.size, amount);
    const iterator = this.keys();
    return Array.from({ length: amount }, () => iterator.next().value as K);
  }

  /** The last value, or `undefined` when empty. */
  public last(): V | undefined;
  /**
   * The last `amount` values; a negative amount takes from the start.
   *
   * @param amount - How many values to return.
   */
  public last(amount: number): V[];
  public last(amount?: number): V | V[] | undefined {
    const values = [...this.values()];
    if (amount === undefined) return values.at(-1);
    if (amount < 0) return this.first(amount * -1);
    if (amount === 0) return [];
    return values.slice(-amount);
  }

  /** The last key, or `undefined` when empty. */
  public lastKey(): K | undefined;
  /**
   * The last `amount` keys; a negative amount takes from the start.
   *
   * @param amount - How many keys to return.
   */
  public lastKey(amount: number): K[];
  public lastKey(amount?: number): K | K[] | undefined {
    const keys = [...this.keys()];
    if (amount === undefined) return keys.at(-1);
    if (amount < 0) return this.firstKey(amount * -1);
    if (amount === 0) return [];
    return keys.slice(-amount);
  }

  /**
   * The value at `index` in insertion order; negative indexes count from the end (like `Array#at`).
   *
   * @param index - Position of the value.
   */
  public at(index: number): V | undefined {
    index = Math.trunc(index);
    if (index >= 0) {
      if (index >= this.size) return undefined;
    } else {
      index += this.size;
      if (index < 0) return undefined;
    }
    const iterator = this.values();
    for (let i = 0; i < index; i++) iterator.next();
    return iterator.next().value;
  }

  /**
   * The key at `index` in insertion order; negative indexes count from the end.
   *
   * @param index - Position of the key.
   */
  public keyAt(index: number): K | undefined {
    index = Math.trunc(index);
    if (index >= 0) {
      if (index >= this.size) return undefined;
    } else {
      index += this.size;
      if (index < 0) return undefined;
    }
    const iterator = this.keys();
    for (let i = 0; i < index; i++) iterator.next();
    return iterator.next().value;
  }

  /** A random value, or `undefined` when empty. */
  public random(): V | undefined;
  /**
   * `amount` distinct random values.
   *
   * @param amount - How many values to return.
   */
  public random(amount: number): V[];
  public random(amount?: number): V | V[] | undefined {
    const values = [...this.values()];
    if (amount === undefined) return values[Math.floor(Math.random() * values.length)];
    return shuffle(values).slice(0, Math.max(0, amount));
  }

  /** A random key, or `undefined` when empty. */
  public randomKey(): K | undefined;
  /**
   * `amount` distinct random keys.
   *
   * @param amount - How many keys to return.
   */
  public randomKey(amount: number): K[];
  public randomKey(amount?: number): K | K[] | undefined {
    const keys = [...this.keys()];
    if (amount === undefined) return keys[Math.floor(Math.random() * keys.length)];
    return shuffle(keys).slice(0, Math.max(0, amount));
  }

  /**
   * The first value `fn` returns true for (like `Array#find`).
   *
   * @param fn - Test function.
   * @param thisArg - `this` inside `fn`.
   */
  public find<V2 extends V>(fn: (value: V, key: K, collection: this) => value is V2, thisArg?: unknown): V2 | undefined;
  public find(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): V | undefined;
  public find(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): V | undefined {
    const test = bind(fn, thisArg);
    for (const [key, value] of this) if (test(value, key, this)) return value;
    return undefined;
  }

  /**
   * The key of the first value `fn` returns true for.
   *
   * @param fn - Test function.
   * @param thisArg - `this` inside `fn`.
   */
  public findKey(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): K | undefined {
    const test = bind(fn, thisArg);
    for (const [key, value] of this) if (test(value, key, this)) return key;
    return undefined;
  }

  /**
   * The last value `fn` returns true for (searching from the end).
   *
   * @param fn - Test function.
   * @param thisArg - `this` inside `fn`.
   */
  public findLast(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): V | undefined {
    const test = bind(fn, thisArg);
    for (const [key, value] of [...this.entries()].reverse()) if (test(value, key, this)) return value;
    return undefined;
  }

  /**
   * The key of the last value `fn` returns true for.
   *
   * @param fn - Test function.
   * @param thisArg - `this` inside `fn`.
   */
  public findLastKey(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): K | undefined {
    const test = bind(fn, thisArg);
    for (const [key, value] of [...this.entries()].reverse()) if (test(value, key, this)) return key;
    return undefined;
  }

  /**
   * Removes every entry `fn` returns true for, in place.
   *
   * @param fn - Test function.
   * @param thisArg - `this` inside `fn`.
   * @returns How many entries were removed.
   */
  public sweep(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): number {
    const test = bind(fn, thisArg);
    const before = this.size;
    for (const [key, value] of this) if (test(value, key, this)) this.delete(key);
    return before - this.size;
  }

  /**
   * A new collection of the entries `fn` returns true for (like `Array#filter`).
   *
   * @param fn - Test function.
   * @param thisArg - `this` inside `fn`.
   */
  public filter<V2 extends V>(fn: (value: V, key: K, collection: this) => value is V2, thisArg?: unknown): Collection<K, V2>;
  public filter(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): Collection<K, V>;
  public filter(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): Collection<K, V> {
    const test = bind(fn, thisArg);
    const result = new Collection<K, V>();
    for (const [key, value] of this) if (test(value, key, this)) result.set(key, value);
    return result;
  }

  /**
   * Splits the collection in two: entries `fn` returns true for, and the rest.
   *
   * @param fn - Test function.
   * @param thisArg - `this` inside `fn`.
   */
  public partition<V2 extends V>(
    fn: (value: V, key: K, collection: this) => value is V2,
    thisArg?: unknown,
  ): [Collection<K, V2>, Collection<K, Exclude<V, V2>>];
  public partition(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): [Collection<K, V>, Collection<K, V>];
  public partition(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): [Collection<K, V>, Collection<K, V>] {
    const test = bind(fn, thisArg);
    const pass = new Collection<K, V>();
    const fail = new Collection<K, V>();
    for (const [key, value] of this) (test(value, key, this) ? pass : fail).set(key, value);
    return [pass, fail];
  }

  /**
   * Maps each entry to a collection and merges the results.
   *
   * @param fn - Returns a collection per entry.
   * @param thisArg - `this` inside `fn`.
   */
  public flatMap<T>(fn: (value: V, key: K, collection: this) => Collection<K, T>, thisArg?: unknown): Collection<K, T> {
    const mapper = bind(fn, thisArg);
    const result = new Collection<K, T>();
    for (const [key, value] of this) for (const [k, v] of mapper(value, key, this)) result.set(k, v);
    return result;
  }

  /**
   * Maps each entry to a value and returns an ARRAY (like discord.js; use {@link Collection.mapValues}
   * to keep a collection).
   *
   * @param fn - Mapping function.
   * @param thisArg - `this` inside `fn`.
   */
  public map<T>(fn: (value: V, key: K, collection: this) => T, thisArg?: unknown): T[] {
    const mapper = bind(fn, thisArg);
    const result: T[] = [];
    for (const [key, value] of this) result.push(mapper(value, key, this));
    return result;
  }

  /**
   * Maps each value and returns a new collection with the same keys.
   *
   * @param fn - Mapping function.
   * @param thisArg - `this` inside `fn`.
   */
  public mapValues<T>(fn: (value: V, key: K, collection: this) => T, thisArg?: unknown): Collection<K, T> {
    const mapper = bind(fn, thisArg);
    const result = new Collection<K, T>();
    for (const [key, value] of this) result.set(key, mapper(value, key, this));
    return result;
  }

  /**
   * Whether `fn` returns true for at least one entry.
   *
   * @param fn - Test function.
   * @param thisArg - `this` inside `fn`.
   */
  public some(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): boolean {
    const test = bind(fn, thisArg);
    for (const [key, value] of this) if (test(value, key, this)) return true;
    return false;
  }

  /**
   * Whether `fn` returns true for every entry (true for an empty collection).
   *
   * @param fn - Test function.
   * @param thisArg - `this` inside `fn`.
   */
  public every<V2 extends V>(fn: (value: V, key: K, collection: this) => value is V2, thisArg?: unknown): this is Collection<K, V2>;
  public every(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): boolean;
  public every(fn: (value: V, key: K, collection: this) => unknown, thisArg?: unknown): boolean {
    const test = bind(fn, thisArg);
    for (const [key, value] of this) if (!test(value, key, this)) return false;
    return true;
  }

  /**
   * Reduces the collection to one value (like `Array#reduce`), seeding the accumulator with the
   * first value. An empty collection throws a `TypeError`.
   *
   * @param fn - Reducer.
   */
  public reduce(fn: (accumulator: V, value: V, key: K, collection: this) => V): V;
  /**
   * Reduces the collection to one value (like `Array#reduce`).
   *
   * @param fn - Reducer.
   * @param initialValue - Starting accumulator.
   */
  public reduce<T>(fn: (accumulator: T, value: V, key: K, collection: this) => T, initialValue: T): T;
  public reduce<T>(fn: (accumulator: T, value: V, key: K, collection: this) => T, ...rest: [T?]): T {
    return reduceEntries([...this.entries()], fn, this, rest);
  }

  /**
   * Like {@link Collection.reduce} but from the last entry to the first.
   *
   * @param fn - Reducer.
   */
  public reduceRight(fn: (accumulator: V, value: V, key: K, collection: this) => V): V;
  /**
   * Like {@link Collection.reduce} but from the last entry to the first.
   *
   * @param fn - Reducer.
   * @param initialValue - Starting accumulator.
   */
  public reduceRight<T>(fn: (accumulator: T, value: V, key: K, collection: this) => T, initialValue: T): T;
  public reduceRight<T>(fn: (accumulator: T, value: V, key: K, collection: this) => T, ...rest: [T?]): T {
    return reduceEntries([...this.entries()].reverse(), fn, this, rest);
  }

  /**
   * Runs `fn` for each entry and returns the collection (chainable `forEach`).
   *
   * @param fn - Called per entry.
   * @param thisArg - `this` inside `fn`.
   */
  public each(fn: (value: V, key: K, collection: this) => void, thisArg?: unknown): this {
    const run = bind(fn, thisArg);
    for (const [key, value] of this) run(value, key, this);
    return this;
  }

  /**
   * Runs `fn` with the whole collection and returns it (for chains).
   *
   * @param fn - Called once with the collection.
   * @param thisArg - `this` inside `fn`.
   */
  public tap(fn: (collection: this) => void, thisArg?: unknown): this {
    bind(fn, thisArg)(this);
    return this;
  }

  /** A shallow copy. */
  public clone(): Collection<K, V> {
    return new Collection<K, V>(this);
  }

  /**
   * A new collection with this one's entries followed by each of `collections` (later ones win).
   *
   * @param collections - Collections to append.
   */
  public concat(...collections: ReadonlyCollection<K, V>[]): Collection<K, V> {
    const result = this.clone();
    for (const collection of collections) for (const [key, value] of collection) result.set(key, value);
    return result;
  }

  /**
   * Whether both collections hold the same keys with identical (`===`) values.
   *
   * @param collection - Collection to compare with.
   */
  public equals(collection: ReadonlyCollection<K, V>): boolean {
    if (this === collection) return true;
    if (this.size !== collection.size) return false;
    for (const [key, value] of this) {
      if (!collection.has(key) || value !== collection.get(key)) return false;
    }
    return true;
  }

  /**
   * Sorts the collection IN PLACE and returns it (like `Array#sort`). The default order compares
   * values with `<` / `>`.
   *
   * @param compareFunction - Comparator over values (and keys).
   */
  public sort(compareFunction: Comparator<K, V> = defaultSort): this {
    const entries = [...this.entries()];
    entries.sort((a, b) => compareFunction(a[1], b[1], a[0], b[0]));
    super.clear();
    for (const [key, value] of entries) super.set(key, value);
    return this;
  }

  /**
   * A sorted copy, leaving this collection unchanged (like `Array#toSorted`).
   *
   * @param compareFunction - Comparator over values (and keys).
   */
  public toSorted(compareFunction: Comparator<K, V> = defaultSort): Collection<K, V> {
    return this.clone().sort(compareFunction);
  }

  /**
   * Alias of {@link Collection.toSorted} (discord.js v13's name).
   *
   * @param compareFunction - Comparator over values (and keys).
   */
  public sorted(compareFunction: Comparator<K, V> = defaultSort): Collection<K, V> {
    return this.toSorted(compareFunction);
  }

  /** Reverses the order IN PLACE and returns the collection. */
  public reverse(): this {
    const entries = [...this.entries()].reverse();
    super.clear();
    for (const [key, value] of entries) super.set(key, value);
    return this;
  }

  /** A reversed copy. */
  public toReversed(): Collection<K, V> {
    return this.clone().reverse();
  }

  /**
   * Entries whose key is in both collections (values from this one).
   *
   * @param other - The other collection.
   */
  public intersection(other: ReadonlyCollection<K, unknown>): Collection<K, V> {
    return this.filter((_value, key) => other.has(key));
  }

  /**
   * Entries of both collections (this one's value wins on a shared key).
   *
   * @param other - The other collection.
   */
  public union<V2>(other: ReadonlyCollection<K, V2>): Collection<K, V | V2> {
    const result = new Collection<K, V | V2>(this);
    for (const [key, value] of other) if (!result.has(key)) result.set(key, value);
    return result;
  }

  /**
   * Entries whose key is in this collection but not in `other`.
   *
   * @param other - The other collection.
   */
  public difference(other: ReadonlyCollection<K, unknown>): Collection<K, V> {
    return this.filter((_value, key) => !other.has(key));
  }

  /**
   * Entries whose key is in exactly one of the two collections.
   *
   * @param other - The other collection.
   */
  public symmetricDifference<V2>(other: ReadonlyCollection<K, V2>): Collection<K, V | V2> {
    const result = new Collection<K, V | V2>(this.difference(other));
    for (const [key, value] of other) if (!this.has(key)) result.set(key, value);
    return result;
  }

  /** The values as an array, which is what `JSON.stringify(collection)` produces. */
  public toJSON(): V[] {
    return [...this.values()];
  }

  /**
   * Builds a collection from entries, combining values of repeated keys with `combine`.
   *
   * @param entries - Key/value pairs.
   * @param combine - Merges an existing value with a new one for the same key.
   */
  public static combineEntries<K, V>(entries: Iterable<[K, V]>, combine: (first: V, second: V, key: K) => V): Collection<K, V> {
    const result = new Collection<K, V>();
    for (const [key, value] of entries) {
      result.set(key, result.has(key) ? combine(result.get(key) as V, value, key) : value);
    }
    return result;
  }
}

/** Read-only view of a collection (or any map) accepted by the comparison helpers. */
export type ReadonlyCollection<K, V> = ReadonlyMap<K, V>;

/** Comparator used by {@link Collection.sort}: values first, then keys. */
export type Comparator<K, V> = (firstValue: V, secondValue: V, firstKey: K, secondKey: K) => number;

function defaultSort(a: unknown, b: unknown): number {
  if (a === b) return 0;
  return String(a) > String(b) ? 1 : -1;
}

function bind<F extends (...args: never[]) => unknown>(fn: F, thisArg: unknown): F {
  return thisArg === undefined ? fn : (fn.bind(thisArg) as F);
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
  return items;
}

function reduceEntries<K, V, T, C>(
  entries: [K, V][],
  fn: (accumulator: T, value: V, key: K, collection: C) => T,
  collection: C,
  rest: [T?],
): T {
  let index = 0;
  let accumulator: T;
  if (rest.length > 0) {
    accumulator = rest[0] as T;
  } else {
    const first = entries[0];
    if (!first) throw new TypeError('Reduce of empty collection with no initial value');
    accumulator = first[1] as unknown as T;
    index = 1;
  }
  for (const [key, value] of entries.slice(index)) accumulator = fn(accumulator, value, key, collection);
  return accumulator;
}
