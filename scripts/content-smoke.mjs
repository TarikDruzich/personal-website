// Exercise publishing behavior with temporary content, then restore the real build.
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const astroCli = resolve('node_modules/astro', JSON.parse(readFileSync('node_modules/astro/package.json', 'utf8')).bin.astro);

const published = 'src/content/posts/qa-publishing-fixture.md';
const draft = 'src/content/posts/qa-draft-fixture.md';
const implicit = 'src/content/posts/qa-default-draft.md';
const emptyFields = 'src/content/posts/qa-empty-fields.md';
for (const path of [published, draft, implicit, emptyFields]) assert(!existsSync(path), `Refusing to overwrite ${path}`);
const content = (title, flag) => `---\ntitle: "${title}"\ndescription: "Privremeni tekst za provjeru objave."\ndate: "2026-10-14"\ncategory: "QA"\ntags: [rust, linux]\n${flag}\ncover: "/uploads/qa-fixture.svg"\ncoverAlt: "Postojeća slika iz arhiva bloga"\ncoverCaption: "Potpis testne slike"\nupdated: "2026-10-14"\n---\n\n## Provjera sadržaja\n\n> Citirani tekst.\n\n\`\`\`rust\nfn main() { println!("Hello"); }\n\`\`\`\n\nTekst prije slike.\n\n![Prva inline slika](/uploads/qa-fixture.svg)\n\nTekst između slika.\n\n![Druga inline slika](/uploads/qa-fixture.svg)\n\n[Preuzmi sliku](/uploads/qa-fixture.svg)\n\n<figure><img src="/uploads/qa-fixture.svg" alt="Postojeća slika u tekstu" /><figcaption>Potpis u tekstu</figcaption></figure>\n`;
function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', windowsHide: true });
  assert.equal(result.status, 0, `Failed: ${script} ${args.join(' ')}`);
}
const image = 'public/uploads/qa-fixture.svg';
assert(!existsSync(image), 'Refusing to overwrite test image');
mkdirSync('public/uploads', { recursive: true });
try {
  writeFileSync(image, readFileSync('public/favicon.svg'), { flag: 'wx' });
  writeFileSync(published, content('QA published fixture', 'draft: false'), { flag: 'wx' });
  writeFileSync(draft, content('QA explicit draft secret', 'draft: true'), { flag: 'wx' });
  writeFileSync(implicit, content('QA implicit draft secret', ''), { flag: 'wx' });
  writeFileSync(emptyFields, '---\ntitle: "QA empty optional fields"\ndescription: "CMS empty field check"\ndate: "2026-10-14"\ndraft: true\nupdated: null\ntime: ""\ncover: ""\ncoverAlt: null\ncoverCaption: ""\ntags: null\n---\nEmpty optional fields.\n', { flag: 'wx' });
  run(astroCli, ['build']);
  run('scripts/verify.mjs');
  const html = readFileSync('dist/writing/qa-publishing-fixture/index.html', 'utf8');
  const base = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');
  for (const fragment of ['Prva inline slika', 'Druga inline slika', 'Tekst prije slike.', 'Preuzmi sliku', 'astro-code', '<span style="color:', '<blockquote>', '<figcaption>', 'Potpis testne slike', 'article:modified_time', '#rust', `${base}/uploads/qa-fixture.svg`]) assert(html.includes(fragment), `Missing Markdown/metadata feature: ${fragment}`);
  if (base) assert(!html.includes(`${base}${base}/uploads/`), 'Duplicate image base path');
  // Simulate the CMS draft-to-published transition, keeping the same filename.
  writeFileSync(published, content('QA published fixture', 'draft: true'));
  run(astroCli, ['build']);
  run('scripts/verify.mjs');
  assert(!existsSync('dist/writing/qa-publishing-fixture'), 'Unpublished article must disappear');
  console.log('Verified code highlighting, captions, images, tags, updated metadata, explicit/default drafts, and publish-to-draft removal.');
} finally {
  for (const path of [published, draft, implicit, emptyFields, image]) if (existsSync(path)) unlinkSync(path);
  run(astroCli, ['build']);
}
