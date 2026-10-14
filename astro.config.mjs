import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { mediaPaths } from './scripts/media-paths.mjs';
import { readingImages } from './scripts/reading-images.mjs';

const site = process.env.SITE_URL || 'https://tarikdruzich.github.io';
const base = process.env.BASE_PATH ?? '/personal-website';
export default defineConfig({
  site, base, trailingSlash: 'always', output: 'static',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  markdown: { shikiConfig: { theme: 'github-dark-high-contrast' }, processor: unified({ rehypePlugins: [[mediaPaths, { base }], [readingImages, { base }]] }) },
});
