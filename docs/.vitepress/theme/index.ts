// The docs theme: VitePress's default theme in Strafe's colours, type and widths (strafe.css), plus
// the home page component and the phone-only foot of the sidebar. Everything it uses ships with the
// site; nothing is fetched from another host (VitePress bundles the Inter font files it serves).
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import { h } from 'vue';
import StrafeHome from './StrafeHome.vue';
import StrafeSidebarExtras from './StrafeSidebarExtras.vue';
import './strafe.css';

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { 'sidebar-nav-after': () => h(StrafeSidebarExtras) }),
  enhanceApp({ app }) {
    app.component('StrafeHome', StrafeHome);
  },
} satisfies Theme;
