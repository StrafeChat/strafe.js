export class Collection<T> extends Map<string, T> {
    filter(predicate: (value: T, key: string, collection: Collection<T>) => boolean): Collection<T> {
        const filteredCollection = new Collection<T>();
        for (const [key, value] of this.entries()) {
            if (predicate(value, key, this)) {
                filteredCollection.set(key, value);
            }
        }
        return filteredCollection;
    }

    sort(compareFn: (a: T, b: T) => number): Collection<T> {
        const sortedCollection = new Collection<T>();
        const entries = [...this.entries()].sort((a, b) => compareFn(a[1], b[1]));
        for (const [key, value] of entries) {
            sortedCollection.set(key, value);
        }
        return sortedCollection;
    }

    constructor(...args: any[]) {
        super(...args);
    }

    public get(key: string): T | undefined {
        // TODO: Implement LRU System
        return super.get(key);
    }

    public set(key: string, value: T): this {
        // TODO: Implement LRU System
        return super.set(key, value);
    }
}
