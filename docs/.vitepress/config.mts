import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitepress';

// The guide is hand-written Markdown; the API reference is TypeDoc's HTML output, generated into
// docs/public/api by `npm run docs:api` (part of `npm run docs:build`) and served as static files at
// /api/. Links to it carry `target="_self"` so VitePress's router hands them to the browser.
//
// Privacy: no analytics, no third-party fonts or scripts, local search only. VitePress bundles its
// fonts with the site, and the logo and icons are files in docs/public.
//
// The look (Strafe's colours, type and widths) is the theme in ./theme. Code is coloured like the
// Strafe client's code blocks: One Dark Pro, and One Light with the client's darker light-mode
// token colours (theme/code-colors.json, shared with the API reference) so comments and strings
// stay readable on white. Both themes ship with VitePress's own Shiki; the swap is done on the
// highlighted HTML, so no theme package has to be imported here.

const codeColors = JSON.parse(readFileSync(new URL('./theme/code-colors.json', import.meta.url), 'utf8')) as {
  light: Record<string, string>;
};

/** Swaps each One Light token colour for the Strafe client's light-mode equivalent. */
const strafeLightColors = (html: string): string =>
  html.replace(/(--shiki-light:)(#[0-9a-f]{6})\b/gi, (match, name: string, hex: string) => {
    const swap = codeColors.light[hex.toUpperCase()];
    return swap === undefined ? match : name + swap;
  });

const guide = [
  {
    text: 'Guide',
    items: [
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'Your first bot', link: '/guide/first-bot' },
      { text: 'Events', link: '/guide/events' },
      { text: 'Messages and embeds', link: '/guide/messages' },
      { text: 'Spaces, members and roles', link: '/guide/spaces' },
      { text: 'Permissions', link: '/guide/permissions' },
    ],
  },
  {
    text: 'Websites',
    items: [{ text: 'OAuth2 login', link: '/guide/oauth2' }],
  },
  {
    text: 'In depth',
    items: [
      { text: 'Instances and federation', link: '/guide/instances' },
      { text: 'REST, errors and rate limits', link: '/guide/errors' },
      { text: 'Limits and differences', link: '/guide/limits' },
      { text: 'Coming from discord.js', link: '/guide/coming-from-discord-js' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Examples', link: '/examples' },
      { text: 'API reference', link: '/api/index.html', target: '_self' },
      { text: 'Changelog', link: '/changelog' },
    ],
  },
];

export default defineConfig({
  title: 'strafe.js',
  description: 'The official TypeScript library for Strafe bots, the REST API and OAuth2.',
  lang: 'en',
  srcExclude: ['public/**'],
  // Strafe's own developer docs and client open in Strafe Dark, so this site does too (and its
  // theme-color is the dark canvas); the switch in the bar still offers light, and a visitor's
  // choice is remembered and shared with the API reference.
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#101114' }],
  ],
  markdown: {
    theme: { light: 'one-light', dark: 'one-dark-pro' },
    codeTransformers: [{ name: 'strafe:light-colors', postprocess: strafeLightColors }],
    config(md) {
      // Wrap tables so the wrapper, not the page, scrolls sideways and carries the border.
      md.renderer.rules['table_open'] = () => '<div class="strafe-table" tabindex="0">\n<table>\n';
      md.renderer.rules['table_close'] = () => '</table>\n</div>\n';
    },
  },
  themeConfig: {
    logo: { src: '/strafe-logo.png', alt: '' },
    // The hidden space keeps the link's accessible name two words ("strafe.js Docs"); the gap you see
    // is the label's margin.
    siteTitle:
      'strafe<span class="strafe-dot">.js</span><span class="visually-hidden">&nbsp;</span><span class="strafe-tag">Docs</span>',
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Examples', link: '/examples' },
      { text: 'API', link: '/api/index.html', target: '_self' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: { '/': guide },
    // This search covers the guide pages; the API reference has its own ("Search the API"), so
    // neither label promises the other's results.
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Search the guide', buttonAriaLabel: 'Search the guide' },
          modal: { noResultsText: 'Nothing in the guide matches' },
        },
      },
    },
    // Extensionless links 404 on the static host (cleanUrls is off), so the page says how to recover.
    notFound: {
      title: 'Page not found',
      quote:
        'This page is not in this version of the docs. If the link had no .html at the end, try adding it, or use search.',
      linkLabel: 'Back to the docs home',
      linkText: 'Back to the docs home',
    },
    outline: { level: [2, 3], label: 'On this page' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/StrafeChat/strafe.js' }],
    footer: {
      message: 'strafe.js documentation. Strafe is federated: every instance documents its own API at /docs/.',
    },
  },
});
