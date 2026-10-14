import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { readingImages, localImageDimensions } from './reading-images.mjs';
import { mediaPaths } from './media-paths.mjs';

test('build-time dimensions reserve local image space without changing URLs or authored sizes', async () => {
  mkdirSync('.qa', { recursive: true });
  const publicDir = mkdtempSync(resolve('.qa', 'image-metadata-'));
  const uploads = join(publicDir, 'uploads');
  mkdirSync(uploads);
  const image = join(uploads, 'landscape.svg');
  writeFileSync(image, '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"></svg>');
  const portrait = join(uploads, 'portrait.svg');
  writeFileSync(portrait, '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"></svg>');
  try {
    for (const src of ['../uploads/portrait.svg', '/personal-website/uploads/portrait.svg', 'https://tarikdruzich.github.io/personal-website/uploads/portrait.svg']) assert.deepEqual(await localImageDimensions(src, '/', publicDir), { width: 300, height: 500 });
    for (const base of ['/personal-website', '/']) {
      const prefix = base.replace(/\/$/, '');
      assert.deepEqual(await localImageDimensions(`${prefix}/uploads/landscape.svg?version=1`, base, publicDir), { width: 1200, height: 700 });
      const renderer = await createMarkdownProcessor({ rehypePlugins: [[mediaPaths, { base }], [readingImages, { base, publicDir }]] });
      const { code } = await renderer.render(`![Descriptive image](/uploads/landscape.svg)

<figure><img src='/uploads/landscape.svg' alt='Captioned image' /><figcaption>Caption</figcaption></figure>

<img src='/uploads/landscape.svg' width='600' height='350' alt='Authored size' />

![External image](https://example.com/image.png)
`);
      const tags = [...code.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag);
      assert.equal(tags.length, 4);
      for (const tag of tags.slice(0, 2)) {
        assert(tag.includes('width="1200"') && tag.includes('height="700"'));
        assert(tag.includes(`src="${prefix}/uploads/landscape.svg"`));
        assert(tag.includes('loading="lazy"') && tag.includes('decoding="async"'));
      }
      assert(tags[2].includes('width="600"') && tags[2].includes('height="350"'));
      assert(!tags[3].includes('width=') && tags[3].includes('https://example.com/image.png'));
    }
    for (const path of ['//example.com/uploads/image.png', 'https://example.com/image.png', '/uploads/missing.png', '/uploads/../../package.json']) assert.equal(await localImageDimensions(path, '/', publicDir), undefined);
  } finally {
    unlinkSync(image);
    unlinkSync(portrait);
    rmdirSync(uploads);
    rmdirSync(publicDir);
  }
});
