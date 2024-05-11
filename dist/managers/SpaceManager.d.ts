import { Space } from "../structure/Space";
import { CacheManager } from "./CacheManager";
export declare class SpaceManager extends CacheManager<Space> {
    /**
     * Get a space from cache or fetch one if it isn't cached.
     * @param id The id of the space
     * @returns A space or null if one is not found.
     * @throws Error is thrown if something goes wrong.
     */
    fetch(id: string): Promise<Space | null>;
    /**
     * Creates a new space.
     * @param name The name of the space.
     * @param icon The icon of the space.
     */
    create(name: string): Promise<Space>;
}
