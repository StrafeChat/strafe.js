// Lets the theme's TypeScript import single-file components. They are compiled by VitePress, not tsc.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}
