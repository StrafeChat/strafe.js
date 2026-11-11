<script setup lang="ts">
// The home page body. Its words live in docs/index.md: the `strafe` frontmatter for the hero, the
// points and the guide cards, and the `code` slot for the samples (Markdown, so Shiki highlights
// them at build time). Links go through VPLink and VPButton, which add `.html` the way the rest of
// the site does.
import { useData } from 'vitepress';
import { VPButton, VPLink } from 'vitepress/theme';
import { computed } from 'vue';

interface HomeAction {
  text: string;
  link: string;
  theme?: 'brand' | 'alt';
  target?: string;
}

interface HomeCard {
  title: string;
  details: string;
  link?: string;
  target?: string;
  icon?: 'federated' | 'encrypted' | 'small' | 'familiar';
}

interface HomeData {
  badge?: string;
  /** `{word}` marks the word drawn in the accent colour. */
  headline: string;
  lede: string;
  actions?: HomeAction[];
  aside?: { text: string; linkText: string; link: string };
  pointsTitle?: string;
  points?: HomeCard[];
  guideTitle?: string;
  guide?: HomeCard[];
}

const { frontmatter } = useData();
const home = computed(() => frontmatter.value['strafe'] as HomeData);
const headline = computed(() =>
  home.value.headline.split(/\{([^}]+)\}/).map((text, index) => ({ text, accent: index % 2 === 1 })),
);
</script>

<template>
  <div class="StrafeHome">
    <section class="hero" aria-labelledby="strafe-home-title">
      <div class="copy">
        <p v-if="home.badge" class="badge"><span class="dot" aria-hidden="true" />{{ home.badge }}</p>
        <h1 id="strafe-home-title" class="headline">
          <template v-for="(part, index) in headline" :key="index">
            <span v-if="part.accent" class="accent">{{ part.text }}</span>
            <template v-else>{{ part.text }}</template>
          </template>
        </h1>
        <p class="lede">{{ home.lede }}</p>
        <div v-if="home.actions" class="actions">
          <VPButton
            v-for="action in home.actions"
            :key="action.link"
            tag="a"
            size="big"
            :theme="action.theme ?? 'alt'"
            :text="action.text"
            :href="action.link"
            :target="action.target"
          />
        </div>
        <p v-if="home.aside" class="aside">
          {{ home.aside.text }}
          <VPLink class="aside-link" :href="home.aside.link">{{ home.aside.linkText }}</VPLink>
        </p>
      </div>
      <div class="code vp-doc"><slot name="code" /></div>
    </section>

    <section v-if="home.points" class="section" aria-labelledby="strafe-home-points">
      <h2 id="strafe-home-points" class="label">{{ home.pointsTitle }}</h2>
      <ul class="grid points">
        <li v-for="point in home.points" :key="point.title" class="card">
          <span v-if="point.icon" class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="point.icon === 'federated'">
                <circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" />
                <path d="M8.5 6h7M7.2 8.3l3.6 7.4M16.8 8.3l-3.6 7.4" />
              </template>
              <template v-else-if="point.icon === 'encrypted'">
                <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2" />
              </template>
              <template v-else-if="point.icon === 'small'">
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
              </template>
              <template v-else>
                <path d="M9 4C7 4 6 5 6 7v2.5C6 10.5 5.3 12 4 12c1.3 0 2 1.5 2 2.5V17c0 2 1 3 3 3M15 4c2 0 3 1 3 3v2.5c0 1 .7 2.5 2 2.5-1.3 0-2 1.5-2 2.5V17c0 2-1 3-3 3" />
              </template>
            </svg>
          </span>
          <h3 class="card-title">{{ point.title }}</h3>
          <p class="card-details">{{ point.details }}</p>
        </li>
      </ul>
    </section>

    <section v-if="home.guide" class="section" aria-labelledby="strafe-home-guide">
      <h2 id="strafe-home-guide" class="label">{{ home.guideTitle }}</h2>
      <ul class="grid guide">
        <li v-for="card in home.guide" :key="card.title">
          <VPLink class="card card-link" :href="card.link" :target="card.target" no-icon>
            <span class="card-title">{{ card.title }}<span class="arrow" aria-hidden="true">→</span></span>
            <span class="card-details">{{ card.details }}</span>
          </VPLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.StrafeHome {
  margin: 0 auto;
  padding: 0 var(--strafe-home-gutter);
  max-width: var(--vp-layout-max-width);
}

/* ---- hero: the pitch on the left, the code on the right ---- */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr); /* a long code line scrolls in its card, never the page */
  gap: 28px;
  padding: 28px 0 40px;
}

@media (min-width: 960px) {
  .hero {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    align-items: center;
    gap: 40px;
    padding: 56px 0;
  }
}

@media (min-width: 1280px) {
  .hero {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    gap: 56px;
  }
}

@media (min-width: 1600px) {
  .hero {
    gap: 80px;
    padding: 72px 0 64px;
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  padding: 4px 12px 4px 10px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--vp-c-text-2);
  background-color: var(--vp-c-bg-soft);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--vp-c-brand-3);
}

.headline {
  margin: 0;
  font-size: clamp(34px, 3.6vw + 8px, 64px);
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: -0.03em;
  color: var(--vp-c-text-1);
  text-wrap: balance;
}

.accent {
  color: var(--vp-c-brand-1);
}

.lede {
  margin: 18px 0 0;
  max-width: 38em;
  font-size: 17px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

@media (min-width: 1280px) {
  .lede {
    font-size: 18px;
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.aside {
  margin: 20px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.aside-link {
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
  text-underline-offset: 3px;
}

.aside-link:hover {
  color: var(--vp-c-brand-2);
  text-decoration-color: currentColor;
}

.code {
  min-width: 0;
}

/* ---- sections ---- */
.section {
  padding: 0 0 44px;
}

.label {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 0 14px;
  font-size: 12px;
  font-weight: 700;
  line-height: 20px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.label::after {
  flex: 1;
  height: 1px;
  background-color: var(--vp-c-divider);
  content: '';
}

.grid {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .guide {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* The points carry a paragraph each: four in a row only once a card is wide enough for it to read
   in three or four lines (2 x 2 at 1024px). */
@media (min-width: 1200px) {
  .points {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .guide {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.guide > li {
  display: flex;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 16px 18px;
  width: 100%;
  background-color: var(--vp-c-bg-soft);
}

.points .card {
  padding: 18px 20px 20px;
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  border-radius: 8px;
  width: 34px;
  height: 34px;
  color: var(--vp-c-brand-1);
  background-color: var(--vp-c-brand-soft);
}

.card-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
  letter-spacing: -0.005em;
  color: var(--vp-c-text-1);
}

.card-details {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.card-link {
  transition: border-color 0.2s ease-out, background-color 0.2s ease-out;
}

.card-link:hover {
  border-color: var(--vp-c-brand-3);
}

.card-link:hover .card-title {
  color: var(--vp-c-brand-1);
}

.arrow {
  margin-left: auto;
  color: var(--vp-c-text-3);
  transition: transform 0.2s ease-out, color 0.2s ease-out;
}

.card-link:hover .arrow {
  color: var(--vp-c-brand-1);
  transform: translateX(2px);
}
</style>
