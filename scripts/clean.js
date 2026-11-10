// Removes build output so a publish never ships stale files.
import { rm } from 'node:fs/promises';

for (const dir of ['dist', 'coverage']) {
  await rm(new URL(`../${dir}`, import.meta.url), { recursive: true, force: true });
}
