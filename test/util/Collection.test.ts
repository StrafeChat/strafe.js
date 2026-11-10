import { describe, expect, it } from 'vitest';
import { Collection } from '../../src/util/Collection.js';

function make(): Collection<string, number> {
  return new Collection([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ]);
}

describe('Collection', () => {
  it('is a Map', () => {
    const c = make();
    expect(c).toBeInstanceOf(Map);
    expect(c.get('b')).toBe(2);
  });

  it('first/last/at/keyAt follow insertion order', () => {
    const c = make();
    expect(c.first()).toBe(1);
    expect(c.first(2)).toEqual([1, 2]);
    expect(c.first(-1)).toEqual([3]);
    expect(c.first(10)).toEqual([1, 2, 3]);
    expect(c.firstKey()).toBe('a');
    expect(c.firstKey(2)).toEqual(['a', 'b']);
    expect(c.last()).toBe(3);
    expect(c.last(2)).toEqual([2, 3]);
    expect(c.last(0)).toEqual([]);
    expect(c.lastKey()).toBe('c');
    expect(c.lastKey(-1)).toEqual(['a']);
    expect(c.at(0)).toBe(1);
    expect(c.at(-1)).toBe(3);
    expect(c.at(5)).toBeUndefined();
    expect(c.at(-5)).toBeUndefined();
    expect(c.keyAt(1)).toBe('b');
    expect(c.keyAt(-3)).toBe('a');
    expect(new Collection().first()).toBeUndefined();
  });

  it('random picks distinct members', () => {
    const c = make();
    expect([1, 2, 3]).toContain(c.random());
    const picked = c.random(3);
    expect(new Set(picked).size).toBe(3);
    expect(c.random(0)).toEqual([]);
    expect(['a', 'b', 'c']).toContain(c.randomKey());
    expect(c.randomKey(2)).toHaveLength(2);
  });

  it('find, findKey, findLast, findLastKey', () => {
    const c = make();
    expect(c.find((v) => v > 1)).toBe(2);
    expect(c.findKey((v) => v > 1)).toBe('b');
    expect(c.findLast((v) => v < 3)).toBe(2);
    expect(c.findLastKey((v) => v < 3)).toBe('b');
    expect(c.find((v) => v > 10)).toBeUndefined();
    expect(c.findLast((v) => v > 10)).toBeUndefined();
  });

  it('passes value, key, collection and honours thisArg', () => {
    const c = make();
    const seen: [number, string][] = [];
    c.each((v, k, coll) => {
      expect(coll).toBe(c);
      seen.push([v, k]);
    });
    expect(seen).toEqual([
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);
    const ctx = { min: 2 };
    expect(
      c.filter(function (this: typeof ctx, v) {
        return v >= this.min;
      }, ctx).size,
    ).toBe(2);
  });

  it('filter and partition return new collections', () => {
    const c = make();
    const odd = c.filter((v) => v % 2 === 1);
    expect([...odd.keys()]).toEqual(['a', 'c']);
    expect(odd).toBeInstanceOf(Collection);
    expect(c.size).toBe(3);
    const [even, rest] = c.partition((v) => v % 2 === 0);
    expect([...even.values()]).toEqual([2]);
    expect([...rest.values()]).toEqual([1, 3]);
  });

  it('map returns an array, mapValues a collection, flatMap merges', () => {
    const c = make();
    expect(c.map((v, k) => `${k}${v}`)).toEqual(['a1', 'b2', 'c3']);
    const doubled = c.mapValues((v) => v * 2);
    expect(doubled).toBeInstanceOf(Collection);
    expect(doubled.get('c')).toBe(6);
    const flat = c.flatMap((v, k) => new Collection([[`${k}x`, v]]));
    expect([...flat.keys()]).toEqual(['ax', 'bx', 'cx']);
  });

  it('some, every, reduce, reduceRight', () => {
    const c = make();
    expect(c.some((v) => v === 2)).toBe(true);
    expect(c.every((v) => v > 0)).toBe(true);
    expect(c.every((v) => v > 1)).toBe(false);
    expect(new Collection().every(() => false)).toBe(true);
    expect(c.reduce((acc, v) => acc + v, 0)).toBe(6);
    expect(c.reduce((acc, v) => acc + v)).toBe(6);
    expect(c.reduceRight((acc, _v, k) => acc + k, '')).toBe('cba');
    expect(() => new Collection<string, number>().reduce((a, b) => a + b)).toThrow(TypeError);
    expect(new Collection<string, number>().reduce((a, b) => a + b, 5)).toBe(5);
  });

  it('sweep removes in place', () => {
    const c = make();
    expect(c.sweep((v) => v < 3)).toBe(2);
    expect([...c.keys()]).toEqual(['c']);
  });

  it('ensure, hasAll, hasAny', () => {
    const c = make();
    expect(c.ensure('a', () => 99)).toBe(1);
    expect(c.ensure('z', (k) => k.length * 26)).toBe(26);
    expect(c.get('z')).toBe(26);
    expect(c.hasAll('a', 'b')).toBe(true);
    expect(c.hasAll('a', 'q')).toBe(false);
    expect(c.hasAny('q', 'b')).toBe(true);
    expect(c.hasAny('q')).toBe(false);
  });

  it('sort in place, toSorted/sorted copy, reverse/toReversed', () => {
    const c = new Collection([
      ['x', 3],
      ['y', 1],
      ['z', 2],
    ]);
    const sorted = c.toSorted((a, b) => a - b);
    expect([...sorted.values()]).toEqual([1, 2, 3]);
    expect([...c.values()]).toEqual([3, 1, 2]);
    expect([...c.sorted((a, b) => b - a).values()]).toEqual([3, 2, 1]);
    expect(c.sort((a, b) => a - b)).toBe(c);
    expect([...c.keys()]).toEqual(['y', 'z', 'x']);
    expect([...c.sort().values()]).toEqual([1, 2, 3]);
    expect([...c.toReversed().values()]).toEqual([3, 2, 1]);
    expect([...c.values()]).toEqual([1, 2, 3]);
    c.reverse();
    expect([...c.values()]).toEqual([3, 2, 1]);
  });

  it('clone, concat, equals', () => {
    const c = make();
    const copy = c.clone();
    expect(copy).not.toBe(c);
    expect(copy.equals(c)).toBe(true);
    copy.set('a', 100);
    expect(copy.equals(c)).toBe(false);
    expect(c.equals(c)).toBe(true);
    expect(c.equals(new Collection([['a', 1]]))).toBe(false);
    const joined = c.concat(new Collection([['d', 4]]), new Collection([['a', 9]]));
    expect([...joined.entries()]).toEqual([
      ['a', 9],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ]);
  });

  it('set operations', () => {
    const c = make();
    const other = new Collection([
      ['b', 20],
      ['d', 40],
    ]);
    expect([...c.intersection(other).entries()]).toEqual([['b', 2]]);
    expect([...c.difference(other).keys()]).toEqual(['a', 'c']);
    expect([...c.union(other).entries()]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 40],
    ]);
    expect([...c.symmetricDifference(other).keys()]).toEqual(['a', 'c', 'd']);
  });

  it('tap, toJSON and combineEntries', () => {
    const c = make();
    let size = 0;
    expect(c.tap((coll) => (size = coll.size))).toBe(c);
    expect(size).toBe(3);
    expect(JSON.stringify(c)).toBe('[1,2,3]');
    const combined = Collection.combineEntries(
      [
        ['a', 1],
        ['a', 2],
        ['b', 5],
      ],
      (x, y) => x + y,
    );
    expect([...combined.entries()]).toEqual([
      ['a', 3],
      ['b', 5],
    ]);
  });

  it('narrows types through type guards', () => {
    const c = new Collection<string, string | number>([
      ['a', 1],
      ['b', 'two'],
    ]);
    const numbers = c.filter((v): v is number => typeof v === 'number');
    const n: number | undefined = numbers.first();
    expect(n).toBe(1);
    const found: string | undefined = c.find((v): v is string => typeof v === 'string');
    expect(found).toBe('two');
  });
});
