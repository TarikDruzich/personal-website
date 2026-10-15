import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { mediaPaths } from './scripts/media-paths.mjs';
import { readingImages } from './scripts/reading-images.mjs';
import { cp, access, readdir, readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const site = process.env.SITE_URL || 'https://tarikdruzich.xyz';
const base = process.env.BASE_PATH ?? '/';
export default defineConfig({
  site, base, trailingSlash: 'always', output: 'static',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') }), {
    name: 'optimized-uploads', hooks: { 'astro:build:done': async ({ dir }) => {
      if (!await access('public/_optimized').then(() => true, () => false)) return;
      const output = new URL('_optimized/', dir);
      await cp('public/_optimized', fileURLToPath(output), { recursive: true });
      const used = new Set();
      async function scan(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? '/' : ''), directory);
          if (entry.isDirectory()) { if (entry.name !== '_optimized') await scan(path); }
          else if (entry.name.endsWith('.html')) {
            for (const match of (await readFile(path, 'utf8')).matchAll(/\/_optimized\/([a-f0-9]+-\d+\.(?:webp|png|jpg))/g)) used.add(match[1]);
          }
        }
      }
      await scan(dir);
      // Only prune generated variants in the build output; uploads stay untouched.
      for (const name of await readdir(output)) {
        if (/^[a-f0-9]+-\d+\.(?:webp|png|jpg)$/.test(name) && !used.has(name)) await unlink(new URL(name, output));
      }
    } },
  }],
  markdown: { shikiConfig: { theme: 'github-dark-high-contrast' }, processor: unified({ rehypePlugins: [[mediaPaths, { base }], [readingImages, { base }]] }) },
});
