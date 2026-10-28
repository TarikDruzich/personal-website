import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve('dist');
const base = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');
const origin = process.env.SITE_URL || 'https://tarikdruzich.xyz';
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]); }
assert(existsSync(root), 'Run npm run build first.');
const output = files(root);
for (const route of ['index.html', 'writing/index.html', '404.html', 'rss.xml', 'sitemap-index.xml']) assert(existsSync(join(root, route)), `Missing route: ${route}`);
let checkedLinks = 0;
for (const file of output.filter((path) => path.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  assert.equal([...html.matchAll(/src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-4SXX4F51YF"/g)].length, 1, `Missing or duplicate GA4 loader: ${file}`);
  assert(!/analytics-consent|privacy-settings|consent-actions|Postavke privatnosti/.test(html), `Consent UI leaked: ${file}`);
  assert(html.includes('lang="bs"'), `Missing Bosnian language: ${file}`);
  assert(/<title>[^<]+<\/title>/.test(html), `Missing title: ${file}`);
  assert(/rel="canonical"/.test(html), `Missing canonical: ${file}`);
  for (const match of html.matchAll(/(?:rel="canonical" href|property="og:url" content)="([^"]+)"/g)) {
    const target = new URL(match[1]);
    assert.equal(target.origin, new URL(origin).origin, `Wrong SEO origin: ${file}`);
    assert(!target.pathname.includes('/personal-website/'), `Legacy SEO path: ${file}`);
    assert(!target.pathname.includes('//'), `Duplicate SEO slash: ${file}`);
  }
  const references = [
    ...html.matchAll(/<(?:a|link|img|script)\b[^>]*?\b(?:href|src)="([^"]+)"/g),
    ...html.matchAll(/<meta (?:property="og:image"|name="twitter:image") content="([^"]+)"/g),
  ];
  for (const match of references) {
    const value = match[1].replaceAll('&amp;', '&');
    if (/^(mailto:|tel:|data:|#)/.test(value)) continue;
    const target = new URL(value, `${origin}${base}/${file.slice(root.length + 1).replaceAll('\\', '/')}`);
    if (target.origin !== new URL(origin).origin) continue;
    const pathname = decodeURIComponent(target.pathname);
    if (!base) assert(!pathname.includes('/personal-website/'), `Legacy project path: ${value}`);
    assert(!pathname.includes('//'), `Duplicate slash: ${value}`);
    assert(!base || pathname === base || pathname.startsWith(`${base}/`), `Base path lost: ${value} in ${file}`);
    const local = join(root, pathname.slice(base.length));
    assert(existsSync(local), `Broken local link/image: ${value} in ${file}`);
    if (statSync(local).isDirectory()) assert(existsSync(join(local, 'index.html')), `Missing page for ${value}`);
    checkedLinks++;
  }
  for (const img of html.matchAll(/<img\b[^>]*>/g)) {
    assert(/\balt="[^"\s][^"]*"/.test(img[0]), `Image needs descriptive alt text: ${file}`);
    const srcset = img[0].match(/\bsrcset="([^"]+)"/)?.[1];
    if (srcset?.includes('/_optimized/')) {
      assert(/\bwidth="\d+"/.test(img[0]) && /\bheight="\d+"/.test(img[0]) && /\bsizes="/.test(img[0]), `Responsive image lacks dimensions/sizes: ${file}`);
      for (const candidate of srcset.split(',')) {
        const [src, width] = candidate.trim().split(/\s+/);
        assert(/^\d+w$/.test(width), `Invalid responsive descriptor: ${candidate}`);
        assert(existsSync(join(root, decodeURIComponent(src.slice(base.length)))), `Missing responsive image: ${src}`);
      }
    }
  }
}
const rss = readFileSync(join(root, 'rss.xml'), 'utf8');
assert(rss.includes('<rss') && rss.includes('<language>bs</language>'), 'RSS missing or invalid language');
for (const link of rss.matchAll(/<link>([^<]+)<\/link>/g)) assert(link[1].startsWith(`${origin}${base}`), `RSS base path lost: ${link[1]}`);
const sitemap = output.filter((p) => /sitemap.*\.xml$/.test(p)).map((p) => readFileSync(p, 'utf8')).join('');
for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const target = new URL(match[1]);
  assert.equal(target.origin, new URL(origin).origin, `Wrong sitemap origin: ${match[1]}`);
  if (!base) assert(!target.pathname.includes('/personal-website/'), `Legacy sitemap path: ${match[1]}`);
}
for (const source of files('public/uploads')) {
  const deployed = join(root, source.slice('public'.length));
  assert(existsSync(deployed), `Upload missing from build: ${source}`);
  assert(readFileSync(source).equals(readFileSync(deployed)), `Upload changed in build: ${source}`);
}
assert(!sitemap.includes('/blog/posts/'), 'Compatibility pages must not appear in sitemap');
for (const route of ['projects', 'about', 'now', 'blog', 'writing/category']) assert(!existsSync(join(root, route)), `Removed route leaked: ${route}`);
// Normalize only line endings so Git's Windows checkout conversion is harmless.
const archivedPosts = {
  'kako-ucim-programiranje': '678492f7aac6351181866b7f90ae1ca2fc17f32a634558176d997e47a7487f67',
  'linux-na-thinkpadu': '986843a0eb30466720657f83458a0518e8bcd60617b67ebc05a6db021b2e1114',
  'moj-novi-blog': 'd6786aa37a332ed94ada8b41e848438cd6e105573a45d87055ba33fcbb2ec6d0',
};
const archiveDir = join('archive', 'private-posts');
assert(readdirSync('.').includes('archive') && readdirSync('archive').includes('private-posts'), 'Archive directory casing mismatch');
const archiveNames = readdirSync(archiveDir);
const trackedFiles = new Set(execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', windowsHide: true }).split('\0'));
for (const [slug, expectedHash] of Object.entries(archivedPosts)) {
  const name = `${slug}.md`;
  const archivePath = join(archiveDir, name);
  assert(existsSync(archivePath), `Local archive missing: ${slug}`);
  assert(archiveNames.includes(name), `Archive filename casing mismatch: ${name}`);
  assert(trackedFiles.has(`archive/private-posts/${name}`), `Archive not tracked by Git: ${name}`);
  const source = readFileSync(archivePath, 'utf8').replaceAll('\r\n', '\n');
  assert.equal(createHash('sha256').update(source).digest('hex'), expectedHash, `Archived article changed: ${slug}`);
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
assert(home.includes('Tarik Družić') && /<h1(?:\s[^>]*)?>Zapisujem šta mi padne na pamet\.<\/h1>/.test(home), 'Homepage identity missing');
assert(!/<h1(?:\s[^>]*)?>Tarik Družić<\/h1>/.test(home), 'Large homepage name heading is still present');
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
