"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
class Collection extends Map {
    filter(predicate) {
        const filteredCollection = new Collection();
        for (const [key, value] of this.entries()) {
            if (predicate(value, key, this)) {
                filteredCollection.set(key, value);
            }
        }
        return filteredCollection;
    }
    sort(compareFn) {
        const sortedCollection = new Collection();
        const entries = [...this.entries()].sort((a, b) => compareFn(a[1], b[1]));
        for (const [key, value] of entries) {
            sortedCollection.set(key, value);
        }
        return sortedCollection;
    }
    constructor(...args) {
        super(...args);
    }
    get(key) {
        // TODO: Implement LRU System
        return super.get(key);
    }
    set(key, value) {
        // TODO: Implement LRU System
        return super.set(key, value);
    }
    find(predicate) {
        for (const [key, value] of this.entries()) {
            if (predicate(value, key, this)) {
                return value;
            }
        }
        return undefined;
    }
    map(mapper) {
        const mappedCollection = new Collection();
        for (const [key, value] of this.entries()) {
            const mappedValue = mapper(value, key, this);
            mappedCollection.set(key, mappedValue);
        }
        return mappedCollection;
    }
}
exports.Collection = Collection;
