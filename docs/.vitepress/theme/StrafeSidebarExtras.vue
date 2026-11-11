<script setup lang="ts">
// The foot of the sidebar on a phone (strafe.css shows it below 768px only). On pages with a
// sidebar the hamburger menu is hidden there, so the two things only it held, the theme switch and
// the GitHub link, are here instead and the page has one menu. VPSwitchAppearance is VitePress's own
// switch (same storage key, same view of the theme), imported from its published dist path.
import { useData } from 'vitepress';
import { VPSocialLinks } from 'vitepress/theme';
import VPSwitchAppearance from 'vitepress/dist/client/theme-default/components/VPSwitchAppearance.vue';

const { site, theme } = useData();
</script>

<template>
  <div class="StrafeSidebarExtras">
    <div v-if="site.appearance && site.appearance !== 'force-dark' && site.appearance !== 'force-auto'" class="row">
      <span>{{ theme.darkModeSwitchLabel || 'Appearance' }}</span>
      <VPSwitchAppearance />
    </div>
    <div v-if="theme.socialLinks" class="row">
      <span>GitHub</span>
      <VPSocialLinks class="social" :links="theme.socialLinks" />
    </div>
  </div>
</template>
