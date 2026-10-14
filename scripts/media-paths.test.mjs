import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { mediaPaths } from './media-paths.mjs';
import { mediaUrl } from './media-url.mjs';

test('custom-domain media migration preserves suffixes and external URLs', async () => {
  for (const path of ['/uploads/photo.png', 'uploads/photo.png', './uploads/photo.png', '../uploads/photo.png', '/personal-website/uploads/photo.png', '/personal-website/personal-website/uploads/photo.png', '/personal-website//uploads//photo.png', 'https://tarikdruzich.github.io/personal-website/uploads/photo.png', 'https://tarikdruzich.xyz/uploads/photo.png']) {
    assert.equal(mediaUrl(`${path}?v=1#image`), '/uploads/photo.png?v=1#image');
    assert.equal(mediaUrl(mediaUrl(path)), '/uploads/photo.png');
    const renderer = await createMarkdownProcessor({ rehypePlugins: [[mediaPaths, { base: '/' }]] });
    const { code } = await renderer.render(`![Original alt](${path})\n\n<figure><img src="${path}" alt="Portrait alt" /><figcaption>Original caption</figcaption></figure>`);
    assert.equal([...code.matchAll(/src="\/uploads\/photo.png"/g)].length, 2);
    assert(code.includes('Original alt') && code.includes('Portrait alt') && code.includes('Original caption'));
  }
  for (const path of ['https://example.com/uploads/photo.png', '//example.com/uploads/photo.png', 'data:image/png;base64,abc', 'https://tarikdruzich.github.io/other/uploads/photo.png']) assert.equal(mediaUrl(path), path);
});

test('CMS body and cover use the same portable upload source', () => {
  const config = YAML.parse(readFileSync('.pages.yml', 'utf8'));
  const images = config.media.find((source) => source.name === 'images');
  assert.equal(images.input, 'public/uploads');
  assert.equal(images.output, '/uploads');
  const fields = config.content.find((entry) => entry.name === 'posts').fields;
  assert.equal(fields.find((field) => field.name === 'body').type, 'rich-text');
  assert.deepEqual(fields.find((field) => field.name === 'body').options, { format: 'markdown', media: 'images', switcher: true });
  assert.equal(fields.find((field) => field.name === 'cover').options.media, 'images');
  assert.equal(fields.find((field) => field.name === 'draft').default, true);
});

for (const base of ['/personal-website', '/personal-website/', '/']) {
  test(`inline images and Markdown rendering with base ${base}`, async () => {
    const prefix = base.replace(/\/$/, '');
    const renderer = await createMarkdownProcessor({ rehypePlugins: [[mediaPaths, { base }]] });
    const { code } = await renderer.render(`
## Heading

Before **bold** and *italic*.

![First descriptive image](/uploads/first.png)

Between images.

![Second descriptive image](/uploads/second.webp)

![Already based](${prefix}/uploads/third.jpg)

![External](https://example.com/uploads/external.png)

![Protocol relative](//example.com/uploads/external.png)

[Download](/uploads/first.png)

<figure><img src='/uploads/figure.jpg' alt='Descriptive figure' /><figcaption>A caption</figcaption></figure>

> A quotation.

\`/uploads/literal.png\`

\`\`\`html
<img src="/uploads/code-example.png" alt="Code only" />
\`\`\`
`);
    for (const name of ['first.png', 'second.webp', 'third.jpg', 'figure.jpg']) assert(code.includes(`${prefix}/uploads/${name}`), name);
    assert(code.includes('https://example.com/uploads/external.png'));
    assert(code.includes('//example.com/uploads/external.png'));
    if (prefix) assert(!code.includes(`${prefix}${prefix}/`));
    for (const fragment of ['<h2', '<strong>bold</strong>', '<em>italic</em>', '<blockquote>', '<figcaption>A caption</figcaption>', '<code>/uploads/literal.png</code>', 'astro-code', 'First descriptive image', 'Second descriptive image']) assert(code.includes(fragment), fragment);
    assert(!code.includes(`${prefix}/uploads/code-example.png`) || !prefix, 'Code example was rewritten');
  });
  test(`media transform is idempotent with base ${base}`, () => {
    const tree = { type: 'root', children: [
      { type: 'element', tagName: 'img', properties: { src: '/uploads/image.png', alt: 'Description' }, children: [] },
      { type: 'raw', value: '<figure><img src="/uploads/image.png" alt="Description" /></figure>' },
    ] };
    const transform = mediaPaths({ base });
    transform(tree);
    const first = structuredClone(tree);
    transform(tree);
    assert.deepEqual(tree, first);
  });
}
