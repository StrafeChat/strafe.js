export declare class Collection<T> extends Map<any, T> {
    filter(predicate: (value: T, key: any, collection: Collection<T>) => boolean): Collection<T>;
    sort(compareFn: (a: T, b: T) => number): Collection<T>;
    constructor(...args: any[]);
    get(key: any): T | undefined;
    set(key: any, value: T): this;
    find(predicate: (value: T, key: any, collection: Collection<T>) => boolean): T | undefined;
    map<U>(mapper: (value: T, key: any, collection: Collection<T>) => U): Collection<U>;
}
