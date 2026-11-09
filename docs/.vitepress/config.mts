import { defineConfig } from 'vitepress';

// The guide is hand-written Markdown; the API reference is TypeDoc's HTML output, generated into
// docs/public/api by `npm run docs:api` (part of `npm run docs:build`) and served as static files at
// /api/. Links to it carry `target="_self"` so VitePress's router hands them to the browser.
//
// Privacy: no analytics, no third-party fonts or scripts, local search only. VitePress bundles its
// fonts with the site.

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
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Coming from discord.js', link: '/guide/coming-from-discord-js' },
      { text: 'Examples', link: '/examples' },
      { text: 'API', link: '/api/index.html', target: '_self' },
    ],
    sidebar: { '/': guide },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: 'https://github.com/StrafeChat/strafe.js' }],
    footer: {
      message: 'strafe.js documentation. Strafe is federated: every instance documents its own API at /docs/.',
    },
  },
});
