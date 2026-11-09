import type { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';

/**
 * Thrown by `room.bulkDelete()` when some deletions failed. Strafe has no bulk endpoint, so each
 * message is deleted on its own and some may succeed while others fail.
 */
export class BulkDeleteError extends AggregateError {
  /** What was deleted (the message, or its id when it was not cached). */
  public readonly deleted: Collection<Snowflake, unknown>;
  /** What failed, with the error of each. */
  public readonly failed: Collection<Snowflake, unknown>;

  /**
   * @param deleted - Deleted messages by id.
   * @param failed - Errors by message id.
   */
  public constructor(deleted: Collection<Snowflake, unknown>, failed: Collection<Snowflake, unknown>) {
    super([...failed.values()], `${failed.size} of ${deleted.size + failed.size} messages could not be deleted`);
    this.deleted = deleted;
    this.failed = failed;
  }

  /** `BulkDeleteError`. */
  public override get name(): string {
    return 'BulkDeleteError';
  }
}
