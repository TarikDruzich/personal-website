# Homepage/archive and image optimization report

Local review, 2026-10-16. Branch: `main`. Nothing was committed, pushed, merged or deployed.

## Design and preservation

The homepage and `/writing/` share scoped editorial cards: date above a centered serif title, complete metadata description, and a descriptive `Pročitaj tekst →` link. There are no listing images, extra sections, animations or shadows. The original dark palette, warm text, yellow accents, two navigation links and visible keyboard focus remain. The compact homepage introduction uses the existing name and tagline. Published posts sort newest first and paginate at 12 entries. Older entries remain reachable at `/page/2/` and `/writing/page/2/`; no fake articles remain. The existing empty message is preserved.

`src/styles/global.css`, article source/metadata, `.pages.yml`, RSS implementation, domain settings, and deployment branch rules are unchanged. The article template changes only image delivery attributes. An explicit original aspect ratio prevents resized raster rounding from changing image heights. Authored image dimensions and captions remain intact.

## Image implementation

Sharp 0.35.5 was already installed through Astro. It is now an explicit pinned dependency. The earlier npm failure reported registry EACCES and inability to write logs in the user cache. `npm.cmd install --save-exact sharp@0.35.5 --offline --cache .npm-cache` succeeded using installed/cached packages. No global permission changes or new Sharp download were needed.

The async Markdown plugin handles ordinary Markdown images and raw HTML figures. Covers use the same optimizer. Only known local uploads/assets are read; remote URLs are preserved and never fetched. Filenames with spaces, Unicode, percent encoding and nested paths are covered by tests. Original upload files are unchanged and are verified byte-for-byte against their deployed copies.

For eligible static PNG/JPEG/WebP images, candidate widths are 320, 480, 640, 800, 1200, 1600 and the original width, bounded by source dimensions. WebP is lossless, preserving screenshot text and alpha; each candidate retains the original format if WebP is larger. A candidate is omitted if a larger candidate costs no more bytes. Responsive `srcset`/`sizes`, intrinsic dimensions, original aspect ratios and async decoding are added. Covers remain high-priority, opening inline images can load eagerly, and subsequent images load lazily. No client JavaScript or external service was added.

Content hashes deduplicate identical files; in-memory promises and disk manifests reuse image work across rendering/builds. Markdown re-renders on content sync, including when an image changes without Markdown changes. Only generated variants referenced in output HTML are retained in the final build. Generated files and test artifacts are Git-ignored. The CMS upload/save/build workflow needs no new author steps.

## Measured image bytes

The actual repository uploads are smaller than the approximately 1 MB files described in the brief. Measurements are against these actual originals, with Sharp 0.35.5 on Windows/Node 24.20.0.

| Upload | Original bytes | Served WebP width | WebP bytes | Savings |
| --- | ---: | ---: | ---: | ---: |
| `Screenshot 2026-10-14 174045.png` | 95,612 | 347 | 57,970 | 39.37% |
| `slikeBlog/screenshot-2026-10-14-175438.png` | 337,843 | 320 | 81,490 | 75.88% |
| same | 337,843 | 480 | 157,044 | 53.52% |
| same | 337,843 | 593 | 181,970 | 46.14% |

A 320px cover candidate was generated at 62,022 bytes and deliberately omitted: the 347px candidate is sharper and smaller. The final output contains only the four WebP files above. Full-size combined delivery is 239,940 bytes instead of 433,455 (44.64% fewer bytes). All originals remain publicly available at their original URLs.

Both actual full-size WebP outputs were decoded and compared with their originals as RGBA: every component matched exactly. Sharp omitted the originals' redundant fully opaque alpha channels in the encoded WebP files; normalized pixel colors and opacity are identical.

| Viewport | Selected widths, cover / inline (Chrome DPR 1) | Combined image bytes | Expected combined bytes at DPR 2 |
| --- | --- | ---: | ---: |
| 320 | 347 / 320 | 139,460 | 239,940 |
| 375 | 347 / 480 | 215,014 | 239,940 |
| 430 | 347 / 480 | 215,014 | 239,940 |
| 768 | 347 / 593 | 239,940 | 239,940 |
| 1024 | 347 / 593 | 239,940 | 239,940 |
| 1440 | 347 / 593 | 239,940 | 239,940 |
| 1920 | 347 / 593 | 239,940 | 239,940 |

DPR 1 selections were observed through Chrome `currentSrc`; bytes come from the selected files. DPR 2 is an estimate from candidate widths, not a browser measurement. These totals exclude HTTP headers, CSS, HTML, cache effects and lazy-loading timing. Browsers can vary candidate selection. No Fast 4G timing, LCP, Lighthouse score or Core Web Vitals improvement is claimed. Regenerate file measurements with `node scripts/image-report.mjs`; the JSON is in ignored `.qa/image-sizes.json`.

## Validation

- `npm.cmd run check`: zero errors, warnings or hints.
- `npm.cmd run build` and `npm.cmd run verify`: pass; the real build has four HTML pages and 42 verified local references, plus RSS and sitemap. Verification also checks every generated responsive candidate, upload preservation, SEO, archived-content exclusion and drafts.
- `npm.cmd run test:images`: 11 tests pass. Added coverage includes real encoded output, exact full-size decoded pixels/alpha, no upscaling, dimensions, byte comparisons, duplicate content, local/legacy/base paths, malformed paths, raw figures, authored sizing, alt/captions and remote query strings.
- `npm.cmd run test:content`: passes Markdown features, covers, inline images, captions, metadata, explicit/default drafts, publish-to-draft removal and a 13-fixture pagination boundary test. Temporary fixtures are removed and the real build restored.
- `npm.cmd run test:accessibility`: 51 Chrome layout/contrast cases pass. Home, archive, fixture article, actual article and 404 are tested at 320, 375, 430, 768, 1024, 1440 and 1920px. The five routes are also checked with 200% root font size at 320, 768 and 1440px, plus fixture article text-spacing overrides at 320px. Checks cover overflow, image aspect ratios, headings, link names, navigation targets, focus/skip links, keyboard navigation/code scrolling, accessibility landmarks, contrast and reduced motion. No frontend scripts are present.
- Optional baseline comparison passes at all seven widths: exact measured article typography, margins, colors, element positions and image/column dimensions match the preserved pre-change local build in `.qa/baseline-dist`. The temporary fixture-induced newer-article navigation is excluded from that comparison. Before/after screenshots are saved in `.qa/article-before-*.png` and `.qa/article-after-*.png`; homepage screenshots are `.qa/reading-home-375.png` and `.qa/reading-home-1440.png`. Mobile home and article screenshots were visually inspected.

The first sandboxed Chrome attempt timed out; Chrome passed outside the sandbox. One initial content-test run collided with the browser test's simultaneous rebuild of `dist`; sequential reruns passed. Run build-changing tests sequentially.

Windows validation was performed locally. Node filesystem APIs, URL handling, paths and subprocesses support Windows/Linux, and Ubuntu GitHub Actions now runs image tests before its existing build/verification steps. Ubuntu CI has not been executed because no push or deployment was authorized. Authenticated Pages CMS publishing, screen-reader testing, Safari/Firefox, physical devices and native browser zoom remain manual checks. Automated tests do not establish full WCAG compliance.

## Files

- Listing: `src/components/PostList.astro`, new `src/components/WritingArchive.astro`, `src/pages/index.astro`, `src/pages/writing/index.astro`, new `src/lib/pagination.ts`, new `src/pages/page/[page].astro`, new `src/pages/writing/page/[page].astro`.
- Images/build: new `scripts/optimized-images.mjs`, `scripts/reading-images.mjs`, image attributes in `src/pages/writing/[...slug].astro`, `src/content.config.ts`, `astro.config.mjs`, `.gitignore`, `package.json`, `package-lock.json`.
- Tests/reporting: new `scripts/optimized-images.test.mjs`, new `scripts/image-report.mjs`, `scripts/reading-images.test.mjs`, `scripts/content-smoke.mjs`, `scripts/accessibility-browser.mjs`, `scripts/verify.mjs`, `.github/workflows/deploy.yml` (image test step only).
- Documentation: `README.md`, this report.

## Limits

Remote-image speed depends on the provider. Unknown remote dimensions cannot be reserved automatically without fetching them. SVG, animated and EXIF-oriented images stay unchanged; future formats or unusually large images may need additional policy. Opening-image loading is a static heuristic, not viewport/LCP detection. Full-resolution originals still contribute to deployment storage. Lossless encoding prioritizes screenshot fidelity over maximum photo compression. The baseline is the original local checkout build, not a downloaded production screenshot.

## Safe PowerShell commit and deployment

Run only after approving the local changes. Fetch first and stop if Pages CMS advanced `main`; this protects concurrent edits instead of automatically rebasing an uncommitted working tree. These commands require the checkout to remain on the original remote commit. If the guard stops, reconcile changes and rerun validation before committing.

```powershell
Set-Location C:\Users\emina\Projects\personal-website
git fetch origin main
if ($LASTEXITCODE -ne 0) { throw 'Fetch failed' }
if ((git branch --show-current) -ne 'main') { throw 'Expected main' }
if ((git rev-parse HEAD) -ne (git rev-parse origin/main)) {
    throw 'main differs from origin/main; reconcile Pages CMS changes before continuing'
}
git status --short
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'Resolve diff errors first' }

npm.cmd run check
if ($LASTEXITCODE -ne 0) { throw 'Astro check failed' }
npm.cmd run test:images
if ($LASTEXITCODE -ne 0) { throw 'Image tests failed' }
npm.cmd run test:content
if ($LASTEXITCODE -ne 0) { throw 'Publishing tests failed' }
npm.cmd run test:accessibility
if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
npm.cmd run verify
if ($LASTEXITCODE -ne 0) { throw 'Verification failed' }

$files = @(
    '.github/workflows/deploy.yml', '.gitignore', 'astro.config.mjs',
    'package.json', 'package-lock.json', 'README.md', 'docs/REDESIGN-REPORT.md',
    'scripts/optimized-images.mjs', 'scripts/reading-images.mjs',
    'scripts/optimized-images.test.mjs', 'scripts/reading-images.test.mjs',
    'scripts/image-report.mjs', 'scripts/content-smoke.mjs',
    'scripts/accessibility-browser.mjs', 'scripts/verify.mjs',
    'src/components/PostList.astro', 'src/components/WritingArchive.astro',
    'src/content.config.ts', 'src/lib/pagination.ts', 'src/pages/index.astro',
    'src/pages/writing/index.astro', 'src/pages/writing/[...slug].astro',
    'src/pages/page/[page].astro', 'src/pages/writing/page/[page].astro'
)
git --literal-pathspecs add -- $files
if ($LASTEXITCODE -ne 0) { throw 'Staging failed' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Staged diff has errors' }
git diff --cached --stat
git diff --cached
```

Review the staged diff before running the next commands. Ensure it contains no concurrent CMS edits, original uploads, test fixtures or build artifacts. Any already-staged changes also appear in that diff.

```powershell
git commit -m "Redesign writing archive and optimize uploaded images"
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git push origin HEAD:main
if ($LASTEXITCODE -ne 0) { throw 'Push failed; fetch and reconcile without force-pushing' }
```

Pushing to `main` triggers the existing GitHub Pages build and deployment. Never force-push to bypass a concurrent CMS update. No domain or DNS command is required.
