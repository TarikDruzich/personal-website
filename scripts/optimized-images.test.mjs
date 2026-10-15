import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { optimizedImage } from './optimized-images.mjs';
import { readingImages } from './reading-images.mjs';
import { mediaPaths } from './media-paths.mjs';

test('responsive output preserves originals, alpha, dimensions, paths and deduplicates bytes', async () => {
  await mkdir('.qa', { recursive: true });
  const publicDir = await mkdtemp(resolve('.qa', 'optimization-'));
  const nested = join(publicDir, 'uploads', 'slike čć');
  await mkdir(nested, { recursive: true });
  const input = await sharp({ create: { width: 900, height: 600, channels: 4, background: { r: 45, g: 75, b: 110, alpha: .5 } } }).png().toBuffer();
  const file = join(nested, 'moja slika š.png');
  await writeFile(file, input);
  await writeFile(join(nested, 'kopija.png'), input);
  const src = '/uploads/slike čć/moja slika š.png';
  const image = await optimizedImage(src, '/', publicDir);
  assert.deepEqual(await readFile(file), input);
  assert.equal(image.width, 900);
  assert.equal(image.height, 600);
  assert.deepEqual(image.variants.map(v => v.width), [320, 480, 640, 800, 900]);
  for (const variant of image.variants) {
    const path = join(publicDir, '_optimized', variant.name);
    const metadata = await sharp(path).metadata();
    assert.equal(metadata.width, variant.width);
    assert.equal(metadata.height, Math.round(600 * variant.width / 900));
    assert.equal(metadata.hasAlpha, true);
    assert.equal((await stat(path)).size, variant.bytes);
  }
  const full = join(publicDir, '_optimized', image.variants.at(-1).name);
  assert.deepEqual(await sharp(full).raw().toBuffer(), await sharp(input).raw().toBuffer(), 'Full-size output must be lossless');
  const before = await readdir(join(publicDir, '_optimized'));
  const duplicate = await optimizedImage('/uploads/slike čć/kopija.png', '/', publicDir);
  assert.equal(duplicate.src, image.src);
  assert.deepEqual(await readdir(join(publicDir, '_optimized')), before);
  assert.equal((await optimizedImage(encodeURI(src), '/personal-website/', publicDir)).src, '/personal-website' + image.src);
  for (const path of ['https://example.com/uploads/no.png', '//example.com/uploads/no.png', '/uploads/../../package.json', '/uploads/%ZZ.png', '/uploads/missing.png']) assert.equal(await optimizedImage(path, '/', publicDir), undefined);
  const renderer = await createMarkdownProcessor({ rehypePlugins: [[mediaPaths], [readingImages, { publicDir }]] });
  const { code } = await renderer.render(`![Opis](<${src}>)\n\n<figure><img src="${src}" width="450" height="300" alt="Opis figure" /><figcaption>Potpis</figcaption></figure>\n\n![Remote](https://example.com/image.png)`);
  const tags = [...code.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  assert(tags[0].includes('srcset=') && tags[0].includes('width="900"') && tags[0].includes('loading="eager"'));
  assert(tags[1].includes('width="450"') && tags[1].includes('height="300"') && tags[1].includes('srcset=') && tags[1].includes('loading="lazy"'));
  assert(code.includes('<figcaption>Potpis</figcaption>'));
  assert(tags[2].includes('src="https://example.com/image.png"') && tags[2].includes('loading="lazy"') && tags[2].includes('decoding="async"') && !tags[2].includes('srcset='));
  assert((await renderer.render(`<figure><img src="${src}" alt="Prva slika" /></figure>`)).code.includes('loading="eager"'));
  const external = 'https://example.com/image.png?width=600&amp;format=webp';
  const raw = (await renderer.render(`<figure><img src="${external}" alt="External" /><figcaption>Remote</figcaption></figure>`)).code;
  const renderedExternal = raw.match(/\bsrc="([^"]+)"/)[1].replaceAll('&#x26;', '&').replaceAll('&amp;', '&');
  assert.equal(renderedExternal, external.replaceAll('&amp;', '&'), 'Remote query parameters must remain unchanged');
});

test('each variant uses the smaller lossless WebP or fallback and skips unsupported formats', async () => {
  await mkdir('.qa', { recursive: true });
  const publicDir = await mkdtemp(resolve('.qa', 'format-choice-'));
  await mkdir(join(publicDir, 'uploads'));
  for (const [name, width, height] of [['tiny', 1, 1], ['large', 640, 480]]) {
    const input = await sharp({ create: { width, height, channels: 3, background: '#f2d46b' } }).png().toBuffer();
    await writeFile(join(publicDir, 'uploads', `${name}.png`), input);
    const result = await optimizedImage(`/uploads/${name}.png`, '/', publicDir);
    const webp = await sharp(input).resize({width}).webp({lossless:true,effort:6}).toBuffer();
    assert.equal(result.variants.at(-1).bytes, Math.min(input.length, webp.length));
    assert(result.variants.every(v => v.width <= width));
    assert(result.src.endsWith(webp.length < input.length ? '.webp' : '.png'));
  }
  await writeFile(join(publicDir, 'uploads', 'vector.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"/>');
  assert.equal(await optimizedImage('/uploads/vector.svg', '/', publicDir), undefined);
});
