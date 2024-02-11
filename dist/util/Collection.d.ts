export declare class Collection<T> extends Map<string, T> {
    filter(predicate: (value: T, key: string, collection: Collection<T>) => boolean): Collection<T>;
    sort(compareFn: (a: T, b: T) => number): Collection<T>;
    constructor(...args: any[]);
    get(key: string): T | undefined;
    set(key: string, value: T): this;
}
