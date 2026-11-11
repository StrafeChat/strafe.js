// @ts-check
// Makes the API reference (TypeDoc) part of the same site as the guide (VitePress):
//
// - Theme choice. Both are served from one origin but keep the choice under different keys:
//   VitePress stores 'auto' | 'light' | 'dark' in `vitepress-theme-appearance` (nothing stored means
//   dark, the site's default), TypeDoc 'os' | 'light' | 'dark' in `tsd-theme`. A script at the top of
//   <body>, ahead of TypeDoc's own, copies the guide's choice in, and a choice made in the
//   reference's Settings is copied back out.
// - Top bar. toolbar.js (copied next to TypeDoc's scripts) gives the bar the guide's wordmark,
//   search field, theme switch and GitHub icon; see that file.
// - Font. strafe.css uses Inter like the guide. The font file is the one VitePress already bundles
//   (and serves), copied next to the stylesheet, so the reference fetches nothing from elsewhere.
// - Code colours. Light mode uses One Light with the Strafe client's darker token colours, the
//   same swap the guide makes (../.vitepress/theme/code-colors.json).
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { JSX, RendererEvent } from 'typedoc';

const resolve = createRequire(import.meta.url).resolve;
const vitepressFonts = join(dirname(resolve('vitepress/package.json')), 'dist/client/theme-default/fonts');
const FONTS = ['inter-roman-latin.woff2', 'inter-roman-latin-ext.woff2'];

/** @type {{ light: Record<string, string> }} */
const codeColors = JSON.parse(
  readFileSync(new URL('../.vitepress/theme/code-colors.json', import.meta.url), 'utf8'),
);

const THEME_SYNC = `try{var v=localStorage.getItem('vitepress-theme-appearance')||'dark';localStorage.setItem('tsd-theme',v==='auto'?'os':v==='light'?'light':'dark');document.addEventListener('change',function(e){var t=e.target;if(t&&t.id==='tsd-theme')try{localStorage.setItem('vitepress-theme-appearance',t.value==='os'?'auto':t.value)}catch(_){}})}catch(_){}`;

const TOOLBAR = 'strafe-toolbar.js';

/** @param {string} source */
const script = (source) => JSX.createElement('script', null, JSX.createElement(JSX.Raw, { html: source }));

/** @param {import('typedoc').Application} app */
export function load(app) {
  app.renderer.hooks.on('body.begin', () => script(THEME_SYNC));
  // Not deferred: it runs before TypeDoc's deferred main.js, while the page is still hidden.
  app.renderer.hooks.on('body.end', (context) =>
    JSX.createElement('script', { src: context.relativeURL(`assets/${TOOLBAR}`) }),
  );

  // After TypeDoc has written its own assets (a lower priority runs later).
  app.renderer.on(
    RendererEvent.END,
    (event) => {
      const assets = join(event.outputDirectory, 'assets');
      for (const font of FONTS) copyFileSync(join(vitepressFonts, font), join(assets, font));
      copyFileSync(new URL('toolbar.js', import.meta.url), join(assets, TOOLBAR));

      const highlight = join(assets, 'highlight.css');
      const css = readFileSync(highlight, 'utf8').replace(
        /(--light-[\w-]+:\s*)(#[0-9a-f]{6})\b/gi,
        (match, name, hex) => {
          const swap = codeColors.light[String(hex).toUpperCase()];
          return swap === undefined ? match : `${String(name)}${swap}`;
        },
      );
      writeFileSync(highlight, css);
    },
    -100,
  );
}
