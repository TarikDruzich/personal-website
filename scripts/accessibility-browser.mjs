// Dependency-free Chrome checks against a temporary article and the real static build.
// No fixture survives this test; the production build is restored in finally.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import sharp from 'sharp';

const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
assert(existsSync(chrome), 'Set CHROME_PATH to an installed Chrome/Chromium executable.');
const qa = resolve('.qa');
mkdirSync(qa, { recursive: true });
const profile = mkdtempSync(join(qa, 'reading-chrome-'));
const fixture = 'src/content/posts/qa-reading-accessibility.md';
const shortFixture = 'src/content/posts/qa-reading-cover.md';
const images = ['public/uploads/qa-reading-landscape.svg', 'public/uploads/qa-reading-portrait.svg', 'public/uploads/qa-reading-cover.png'];
for (const path of [fixture, shortFixture, ...images]) assert(!existsSync(path), `Refusing to overwrite ${path}`);
const astro = resolve('node_modules/astro', JSON.parse(readFileSync('node_modules/astro/package.json', 'utf8')).bin.astro);
function build() {
  const result = spawnSync(process.execPath, [astro, 'build'], { stdio: 'inherit', windowsHide: true });
  assert.equal(result.status, 0, 'Astro build failed');
}
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
let browser, server, socket;
const results = [];
const baseline = process.env.QA_BASELINE_DIR ? resolve(process.env.QA_BASELINE_DIR) : undefined;
const base = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');

// Evaluated inside Chrome: actual geometry, rendered colors, images, and semantics.
function measure(kind = 'article') {
  const required = (selector) => {
    const element = document.querySelector(selector);
    if (!(element instanceof Element)) throw new Error(`Missing required element ${selector} on ${location.href} (${document.readyState})`);
    return element;
  };
  const body = required('body');
  const shell = required('.shell');
  const main = required('main#content');
  const reading = kind === 'listing' ? required('.editorial-list') : kind === 'article' ? required('.prose') : main;
  if (kind === 'listing') required('.archive-heading h1');
  const rect = (element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  };
  const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
  const luminance = (color) => rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const contrast = (foreground, background) => {
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  };
  const background = (element) => {
    for (let current = element; current; current = current.parentElement) {
      const value = getComputedStyle(current).backgroundColor;
      if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const colors = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const element = walker.currentNode.parentElement;
    if (!walker.currentNode.textContent.trim() || element.closest('script,style,.skip-link')) continue;
    const style = getComputedStyle(element);
    if (style.display === 'none' || !element.getClientRects().length) continue;
    const size = parseFloat(style.fontSize);
    colors.push({ text: walker.currentNode.textContent.trim().slice(0, 60), ratio: contrast(style.color, background(element)), required: size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5 });
  }
  const style = getComputedStyle(shell);
  return {
    width: innerWidth, layoutWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    shell: rect(shell), content: rect(main), textAlign: getComputedStyle(document.body).textAlign,
    paddingLeft: parseFloat(style.paddingLeft), paddingRight: parseFloat(style.paddingRight),
    bodySize: parseFloat(getComputedStyle(body).fontSize), lineHeight: parseFloat(getComputedStyle(reading).lineHeight),
    rootScale: parseFloat(getComputedStyle(document.documentElement).fontSize) / 16,
    textSizes: [...reading.querySelectorAll('p:not(.eyebrow):not(.metadata)')].map(element => parseFloat(getComputedStyle(element).fontSize)),
    cards: kind === 'listing' ? [...reading.querySelectorAll('li > article')].map(article => ({
      title: !!article.querySelector('h2 a[href]')?.textContent.trim(),
      description: !!article.querySelector('p')?.textContent.trim(),
      link: !!article.querySelector('a.read-more[href][aria-label]'),
    })) : undefined,
    headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((element) => ({ level: Number(element.tagName[1]), text: element.textContent.trim(), ...rect(element) })),
    images: [...document.images].map((image) => ({ alt: image.alt, currentSrc: image.currentSrc, loaded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, reservedWidth: image.getAttribute('width'), reservedHeight: image.getAttribute('height'), ...rect(image) })),
    targets: [...document.querySelectorAll('.site-header a,.site-footer a,.read-more,.pagination a')].map((element) => ({ text: element.textContent, ...rect(element) })),
    metadataSize: [...document.querySelectorAll('.metadata,.eyebrow,figcaption')].map((element) => parseFloat(getComputedStyle(element).fontSize)),
    unnamedLinks: [...document.querySelectorAll('a')].filter((element) => !(element.getAttribute('aria-label') || element.textContent.trim() || element.querySelector('img[alt]'))).length,
    lang: document.documentElement.lang, scripts: document.scripts.length,
    contrasts: colors, forms: document.querySelectorAll('input,select,textarea,button').length,
  };
}

function check(metrics, label) {
  assert(metrics.scrollWidth <= metrics.layoutWidth + 1, `Page overflow: ${label}`);
  assert(metrics.bodySize >= (metrics.width <= 600 ? 17 : 18) * metrics.rootScale, `Small body text: ${label}`);
  assert(metrics.lineHeight >= metrics.bodySize * 1.5, `Tight reading line height: ${label}`);
  assert(metrics.textSizes.length > 0, `No paragraph text measured: ${label}`);
  for (const size of metrics.textSizes) assert(size >= metrics.bodySize, `Small paragraph text: ${label}`);
  if (metrics.cards) {
    assert(metrics.cards.length > 0, `Missing editorial cards for published fixtures: ${label}`);
    for (const card of metrics.cards) assert(card.title && card.description && card.link, `Incomplete editorial card: ${label}`);
  }
  assert(Math.abs(metrics.shell.x * 2 + metrics.shell.width - metrics.layoutWidth) < 2, `Column not centered: ${label}`);
  assert.equal(metrics.paddingLeft, metrics.paddingRight);
  assert.equal(metrics.textAlign, 'left');
  assert.equal(metrics.lang, 'bs');
  assert.equal(metrics.scripts, 0, 'Client scripts introduced');
  assert.equal(metrics.unnamedLinks, 0, 'Unnamed link');
  assert.equal(metrics.headings.filter((heading) => heading.level === 1).length, 1);
  let previous = 0;
  for (const heading of metrics.headings) {
    assert(heading.text && heading.level <= previous + 1, `Heading hierarchy: ${label}`);
    assert(heading.x >= metrics.content.x - 1 && heading.x + heading.width <= metrics.content.x + metrics.content.width + 1, `Heading overflow: ${label}`);
    previous = heading.level;
  }
  for (const image of metrics.images) {
    assert(image.loaded && image.alt.trim(), `Image loading/alt: ${label}`);
    assert(image.reservedWidth && image.reservedHeight, `Image dimensions missing: ${label}`);
    assert(image.width <= metrics.content.width + 1, `Image overflow: ${label}`);
    assert(Math.abs(image.x + image.width / 2 - metrics.layoutWidth / 2) < 2, `Image not centered: ${label}`);
    assert(Math.abs(image.width / image.height - image.naturalWidth / image.naturalHeight) < .02, `Image distorted: ${label}`);
  }
  for (const target of metrics.targets) assert(target.height >= 43.99 && target.width >= 24, `Small navigation target: ${label}: ${JSON.stringify(target)}`);
  for (const size of metrics.metadataSize) assert(size >= 14 * metrics.rootScale, `Small metadata: ${label}`);
  assert(metrics.contrasts.length > 0, `No text contrast measured: ${label}`);
  for (const color of metrics.contrasts) assert(color.ratio >= color.required, `Contrast ${color.ratio.toFixed(2)}: ${color.text} (${label})`);
  results.push({ label, ...metrics });
}

try {
  mkdirSync('public/uploads', { recursive: true });
  for (const [index, path] of images.slice(0, 2).entries()) {
    const [width, height] = index ? [300, 500] : [1200, 700];
    writeFileSync(path, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f2d46b"/></svg>`, { flag: 'wx' });
  }
  writeFileSync(images[2], await sharp({ create: { width: 900, height: 600, channels: 3, background: '#f2d46b' } }).png().toBuffer(), { flag: 'wx' });
  // Keep the cover/short-article case independent of articles that CMS users
  // can rename, unpublish or remove. The long fixture covers body features.
  writeFileSync(shortFixture, `---\ntitle: "QA cover and short article"\ndescription: "Short article layout fixture."\ndate: "2026-10-14"\ndraft: false\ncover: "/uploads/qa-reading-cover.png"\ncoverAlt: "Landscape cover fixture"\ncoverCaption: "Cover caption fixture"\n---\nShort article paragraph for reading and mobile layout checks.\n`, { flag: 'wx' });
  writeFileSync(fixture, `---
title: "Provjera čitljivosti: č, ć, đ, š, ž"
description: "Privremeni tekst za provjeru prikaza i pristupačnosti."
date: "2026-10-14"
draft: false
---

${'Ovo je odlomak za provjeru čitljivosti. Čitanje treba biti ugodno i na uskom ekranu, uz jasne razmake između riječi i odlomaka. '.repeat(8)}

## Naslov odjeljka

Tekst s **naglašenim riječima**, *kurzivom* i [deskriptivnom poveznicom na arhivu](${base}/writing/).

![Pejzažna testna slika](/uploads/qa-reading-landscape.svg)

### Manji naslov

<figure><img src="/uploads/qa-reading-portrait.svg" width="300" height="500" alt="Portretna testna slika" /><figcaption>Čitljiv potpis slike, sa slovima č, ć, đ, š i ž.</figcaption></figure>

> Citirani odlomak za provjeru udobne veličine slova i razmaka između redova.

- Prva stavka
- Druga stavka
  - Ugniježđena stavka

Poveznica sa dugom adresom: [${'duga-adresa-'.repeat(25)}](${base}/writing/).

\`\`\`js
// Readable comments are part of accessible syntax highlighting.
const example = "${'long_code_'.repeat(40)}";
console.log(example);
\`\`\`

| Naziv | Opis |
| --- | --- |
| Čitanje | Provjera prikaza tabele |
`, { flag: 'wx' });
  build();
  const dist = resolve('dist');
  server = createServer((request, response) => {
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (base && !path.startsWith(`${base}/`)) { response.writeHead(404).end(); return; }
    path = path.slice(base.length);
    if (path.endsWith('/')) path += 'index.html';
    const directory = baseline && path.startsWith('/__baseline/') ? baseline : dist;
    if (directory === baseline) path = path.slice('/__baseline'.length);
    const file = resolve(directory, `.${path}`);
    if (!file.startsWith(`${directory}/`) && !file.startsWith(`${directory}\\`)) { response.writeHead(403).end(); return; }
    if (!existsSync(file)) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
    response.end(readFileSync(file));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; !existsSync(portFile) && i < 100; i++) await delay(100);
  assert(existsSync(portFile), 'Chrome debugging endpoint unavailable');
  const [port, endpoint] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((done, fail) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', fail, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (pending.has(message.id)) { const { done, fail } = pending.get(message.id); pending.delete(message.id); message.error ? fail(message.error) : done(message.result); }
  });
  const command = (method, params = {}, sessionId) => new Promise((done, fail) => {
    const key = ++id;
    const timeout = setTimeout(() => { pending.delete(key); fail(new Error(`Chrome command timed out: ${method}`)); }, 15000);
    pending.set(key, { done: (value) => { clearTimeout(timeout); done(value); }, fail: (error) => { clearTimeout(timeout); fail(error); } });
    socket.send(JSON.stringify({ id: key, method, params, sessionId }));
  });
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  const cdp = (method, params) => command(method, params, sessionId);
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!exceptionDetails, JSON.stringify(exceptionDetails));
    return result.value;
  };
  await cdp('Page.enable');
  const navigate = async (path) => {
    const url = `${origin}${base}/${path}`;
    const response = await fetch(url);
    await response.arrayBuffer();
    assert.equal(response.status, 200, `Expected a built HTML page, got HTTP ${response.status}: ${url}`);
    assert(response.headers.get('content-type')?.includes('text/html'), `Not an HTML page: ${url}`);
    const navigation = await cdp('Page.navigate', { url });
    assert(!navigation.errorText, `Navigation failed: ${url}: ${navigation.errorText}`);
    for (let i = 0; i < 100; i++) {
      await delay(50);
      if (await evaluate(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(`${base}/${path}`)}`)) break;
    }
    assert.equal(await evaluate('location.href'), url, `Navigation did not reach ${url}`);
    assert.equal(await evaluate('document.readyState'), 'complete', `Page did not finish loading: ${url}`);
    assert(await evaluate(`!!document.querySelector('.shell main#content')`), `Required layout missing on ${url}`);
    await evaluate(`Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); }))`);
  };
  const routes = ['', 'writing/', 'writing/qa-reading-accessibility/', 'writing/qa-reading-cover/', '404.html'];
  const pageKind = path => ['', 'writing/'].includes(path) ? 'listing' : path === '404.html' ? 'error' : 'article';
  const metricsFor = path => evaluate(`(${measure.toString()})(${JSON.stringify(pageKind(path))})`);
  // Regression checks: a missing route or required selector must fail with a
  // useful diagnostic, rather than pass via a body fallback or throw a TypeError.
  await assert.rejects(navigate('qa-accessibility-missing-page/'), /got HTTP 404/);
  await navigate('');
  const missingShell = await evaluate(`(() => {
    const shell = document.querySelector('.shell');
    shell.remove();
    try { (${measure.toString()})('listing'); return ''; }
    catch (error) { return error.message; }
    finally { document.body.append(shell); }
  })()`);
  assert(missingShell.includes('Missing required element .shell'), 'Missing layout must have a clear diagnostic');
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const path of routes) {
      await navigate(path);
      const metrics = await metricsFor(path);
      check(metrics, `${path || 'home'} at ${width}px`);
      if (width >= 768) assert(metrics.content.width <= metrics.bodySize * 42, 'Excessive reading width');
      if ([375, 1440].includes(width) && ['', 'writing/qa-reading-accessibility/'].includes(path)) {
        const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(join(qa, `reading-${path ? 'article' : 'home'}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      const focus = await evaluate(`({skip:document.activeElement.classList.contains('skip-link'), top:document.activeElement.getBoundingClientRect().top, outline:getComputedStyle(document.activeElement).outlineWidth})`);
      assert(focus.skip && focus.top >= 0 && parseFloat(focus.outline) >= 3, 'Visible keyboard skip link');
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await delay(50);
      assert.equal(await evaluate('document.activeElement.id'), 'content', 'Skip link did not focus main');
    }
  }
  // Text-only resizing, plus the 320 CSS-pixel reflow equivalent of 1280px at 400% zoom.
  for (const width of [320, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const path of routes) {
      await navigate(path);
      await evaluate(`document.documentElement.style.fontSize = '200%'`);
      check(await metricsFor(path), `${path || 'home'} at ${width}px, text 200%`);
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('');
  for (const text of ['Preskoči na sadržaj', 'Tarik Družić', 'Početna', 'Tekstovi']) {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const focus = await evaluate(`({text:document.activeElement.textContent.trim(), outline:getComputedStyle(document.activeElement).outlineWidth})`);
    assert.equal(focus.text, text, 'Unexpected keyboard navigation order');
    assert(parseFloat(focus.outline) >= 3, 'Navigation focus not visible');
  }
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await delay(100);
  assert.equal(await evaluate('location.pathname'), `${base}/writing/`, 'Keyboard navigation link failed');
  await navigate('writing/qa-reading-accessibility/');
  await evaluate(`{ const style = document.createElement('style'); style.textContent = '* {line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p {margin-bottom:2em!important}'; document.head.append(style); }`);
  check(await evaluate(`(${measure.toString()})()`), '320px reflow with WCAG text-spacing overrides');
  await navigate('writing/qa-reading-accessibility/');
  const code = await evaluate(`{ const block = document.querySelector('pre'); block.focus(); ({tabIndex:block.tabIndex, label:block.getAttribute('aria-label'), overflow:block.scrollWidth > block.clientWidth, outline:getComputedStyle(block).outlineWidth}); }`);
  assert(code.tabIndex === 0 && code.label && code.overflow && parseFloat(code.outline) >= 3, 'Keyboard-accessible code region');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await delay(200);
  assert(await evaluate('document.querySelector("pre").scrollLeft > 0'), 'Code block not keyboard scrollable');
  await cdp('Accessibility.enable');
  const tree = await cdp('Accessibility.getFullAXTree');
  assert(tree.nodes.some((node) => !node.ignored && node.role?.value === 'main'), 'Main landmark missing in accessibility tree');
  assert(tree.nodes.some((node) => !node.ignored && node.role?.value === 'region' && node.name?.value === 'Blok koda'), 'Named code region missing');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate('getComputedStyle(document.documentElement).scrollBehavior'), 'auto');
  if (baseline) {
    // Compare an article present in both builds; a CMS draft must not leave
    // this optional comparison pointing at a stale hard-coded slug either.
    const articleRoutes = (directory, prefix = '') => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return articleRoutes(path, `${prefix}${entry.name}/`);
      return entry.name === 'index.html' && /class="prose"/.test(readFileSync(path, 'utf8')) ? [prefix] : [];
    });
    const previousArticles = new Set(articleRoutes(baseline));
    const comparisonPath = articleRoutes(dist).find(path => previousArticles.has(path) && !path.includes('/qa-reading-'));
    assert(comparisonPath, 'No published article exists in both current and baseline builds; refresh QA_BASELINE_DIR.');
    const comparison = [];
    const readingGeometry = () => [...document.querySelectorAll('.site-header,.article-heading,.prose,.cover,.prose p,.prose img,.cover img,figcaption,.site-footer')].map(element => {
      const style = getComputedStyle(element);
      const {x,y,width,height} = element.getBoundingClientRect();
      return {tag:element.tagName, x,y,width,height, font:style.fontFamily, size:style.fontSize, lineHeight:style.lineHeight, margin:style.margin, color:style.color};
    });
    for (const width of [320,375,430,768,1024,1440,1920]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height:1000, deviceScaleFactor:1, mobile:false });
      await navigate(`__baseline/${comparisonPath}`);
      const before = await evaluate(`(${readingGeometry.toString()})()`);
      const originalNavigation = await evaluate(`!!document.querySelector('.article-navigation')`);
      const oldShot = await cdp('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
      writeFileSync(join(qa, `article-before-${width}.png`), Buffer.from(oldShot.data,'base64'));
      await navigate(comparisonPath);
      // The temporary accessibility fixture creates a newer-post link that did
      // not exist in the baseline. Remove only that fixture-induced navigation.
      if (!originalNavigation) await evaluate(`document.querySelector('.article-navigation')?.remove()`);
      const after = await evaluate(`(${readingGeometry.toString()})()`);
      assert.deepEqual(after, before, `Article reading design changed at ${width}px`);
      const newShot = await cdp('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
      writeFileSync(join(qa, `article-after-${width}.png`), Buffer.from(newShot.data,'base64'));
      comparison.push({width, identicalGeometryAndTypography:true, images:(await evaluate(`(${measure.toString()})()`)).images});
    }
    writeFileSync(join(qa,'article-comparison.json'),JSON.stringify(comparison,null,2));
    console.log('Article geometry, typography, spacing and colors match the pre-change build at all seven widths.');
  }
  writeFileSync(join(qa, 'reading-accessibility-results.json'), JSON.stringify(results, null, 2));
  console.log(`Passed ${results.length} layout/contrast checks, keyboard skip links, scrollable code, accessibility landmarks, images, and reduced-motion checks.`);
  await command('Browser.close');
} catch (error) {
  console.error('Browser check failed:', error);
  throw error;
} finally {
  socket?.close();
  browser?.kill();
  if (server) {
    server.closeAllConnections();
    server.close();
  }
  for (const path of [fixture, shortFixture, ...images]) if (existsSync(path)) unlinkSync(path);
  build();
}
