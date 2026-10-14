import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve('dist');
const base = (process.env.BASE_PATH ?? '/personal-website').replace(/\/$/, '');
const origin = process.env.SITE_URL || 'https://tarikdruzich.github.io';
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]); }
assert(existsSync(root), 'Run npm run build first.');
const output = files(root);
for (const route of ['index.html', 'writing/index.html', '404.html', 'rss.xml', 'sitemap-index.xml']) assert(existsSync(join(root, route)), `Missing route: ${route}`);
let checkedLinks = 0;
for (const file of output.filter((path) => path.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  assert(html.includes('lang="bs"'), `Missing Bosnian language: ${file}`);
  assert(/<title>[^<]+<\/title>/.test(html), `Missing title: ${file}`);
  assert(/rel="canonical"/.test(html), `Missing canonical: ${file}`);
  for (const match of html.matchAll(/<(?:a|link|img|script)\b[^>]*?\b(?:href|src)="([^"]+)"/g)) {
    const value = match[1].replaceAll('&amp;', '&');
    if (/^(mailto:|tel:|data:|#)/.test(value)) continue;
    const target = new URL(value, `${origin}${base}/${file.slice(root.length + 1).replaceAll('\\', '/')}`);
    if (target.origin !== new URL(origin).origin) continue;
    const pathname = decodeURIComponent(target.pathname);
    assert(!base || pathname === base || pathname.startsWith(`${base}/`), `Base path lost: ${value} in ${file}`);
    const local = join(root, pathname.slice(base.length));
    assert(existsSync(local), `Broken local link/image: ${value} in ${file}`);
    if (statSync(local).isDirectory()) assert(existsSync(join(local, 'index.html')), `Missing page for ${value}`);
    checkedLinks++;
  }
  for (const img of html.matchAll(/<img\b[^>]*>/g)) assert(/\balt="[^"\s][^"]*"/.test(img[0]), `Image needs descriptive alt text: ${file}`);
}
const rss = readFileSync(join(root, 'rss.xml'), 'utf8');
assert(rss.includes('<rss') && rss.includes('<language>bs</language>'), 'RSS missing or invalid language');
for (const link of rss.matchAll(/<link>([^<]+)<\/link>/g)) assert(link[1].startsWith(`${origin}${base}`), `RSS base path lost: ${link[1]}`);
const sitemap = output.filter((p) => /sitemap.*\.xml$/.test(p)).map((p) => readFileSync(p, 'utf8')).join('');
assert(!sitemap.includes('/blog/posts/'), 'Compatibility pages must not appear in sitemap');
for (const route of ['projects', 'about', 'now', 'blog', 'writing/category']) assert(!existsSync(join(root, route)), `Removed route leaked: ${route}`);
for (const slug of ['kako-ucim-programiranje', 'linux-na-thinkpadu', 'moj-novi-blog']) {
  assert(existsSync(`archive/private-posts/${slug}.md`), `Local archive missing: ${slug}`);
  for (const file of output) {
    assert(!file.includes(slug), `Archived route leaked: ${file}`);
    if (/\.(html|xml)$/.test(file)) assert(!readFileSync(file, 'utf8').includes(slug), `Archived post leaked: ${file}`);
  }
}
assert(!output.some((file) => /[\\/]archive[\\/]/.test(file)), 'Private archive deployed');
for (const route of ['index.html', 'writing/index.html']) {
  const html = readFileSync(join(root, route), 'utf8');
  const nav = html.match(/<nav aria-label="Glavna navigacija">([\s\S]*?)<\/nav>/)[1];
  assert.equal([...nav.matchAll(/<a /g)].length, 2, 'Expected exactly two navigation links');
  assert(nav.includes('Početna') && nav.includes('Tekstovi'), 'Navigation labels missing');
  assert(!/Projekti|O meni|Sada|GitHub|Substack/.test(html), 'Portfolio content leaked');
}
const home = readFileSync(join(root, 'index.html'), 'utf8');
assert(home.includes('Tarik Družić') && home.includes('Zapisujem šta mi padne na pamet.'), 'Homepage identity missing');
if (!output.some((file) => /[\\/]writing[\\/].+[\\/]index.html$/.test(file))) {
  for (const route of ['index.html', 'writing/index.html']) assert(readFileSync(join(root, route), 'utf8').includes('Ovdje će uskoro biti prvi tekst.'), 'Empty state missing');
  assert(!rss.includes('<item>'), 'Empty RSS contains articles');
}
for (const file of files('src/content/posts').filter((p) => p.endsWith('.md'))) {
  const text = readFileSync(file, 'utf8');
  const metadata = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
  if (!/^draft:\s*false\s*$/m.test(metadata)) {
    const slug = file.slice('src/content/posts'.length + 1).replaceAll('\\', '/').replace(/\.md$/, '');
    assert(!existsSync(join(root, `writing/${slug}`)), `Draft route leaked: ${slug}`);
    assert(!rss.includes(`/writing/${slug}/`) && !sitemap.includes(`/writing/${slug}/`), `Draft leaked into feeds: ${slug}`);
    const title = metadata.match(/^title:\s*(.+)$/m)?.[1].replace(/^['"]|['"]$/g, '');
    if (title) for (const file of output.filter((p) => p.endsWith('.html'))) assert(!readFileSync(file, 'utf8').includes(title), `Draft title leaked: ${title}`);
  }
}
console.log(`Verified ${output.filter((p) => p.endsWith('.html')).length} HTML pages, ${checkedLinks} internal links/assets, archive exclusion, navigation, RSS, sitemap, and draft exclusion.`);
