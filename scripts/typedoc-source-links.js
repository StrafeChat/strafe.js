// @ts-check
// TypeDoc builds source links from `sourceLinkTemplate` rather than from git (`disableGit` in
// typedoc.json), so the API reference links the same way on any build host: Vercel's checkout, for
// one, has no `origin` remote TypeDoc can read. That template is applied to every file, though,
// including TypeScript's own lib files that Collection inherits Map's members from, which are not
// in this repository. This drops those links before the pages are rendered.
import { RendererEvent } from 'typedoc';

/** @param {import('typedoc').Application} app */
export function load(app) {
  app.renderer.on(RendererEvent.BEGIN, (event) => {
    for (const reflection of Object.values(event.project.reflections)) {
      for (const source of reflection.sources ?? []) {
        if (source.fullFileName.includes('/node_modules/')) delete source.url;
      }
    }
  });
}
