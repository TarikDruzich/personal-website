# Validation

The output verifier checks the homepage, writing archive, error page, RSS, sitemap, SEO metadata, internal links and assets, exactly two navigation links, empty states, and absence of removed routes and archived articles. Draft exclusion is checked for every current Markdown source. Archived articles must exist with exact directory/filename casing, be tracked by Git, and match recorded SHA-256 hashes after CRLF-to-LF normalization. Their routes and slug references must remain absent from generated output.

The content smoke test creates temporary published and draft entries, checks article rendering, media, metadata, and publish-to-draft removal, then removes all fixtures and restores the empty production build.

Live Pages CMS authorization, GitHub Actions, and deployment require account testing. No push or merge is part of this local change.

## Reading and accessibility review (2026-10-14)

Implemented 18px desktop / 17px mobile body text, 1.75 line height, a centered 70ch reading measure, responsive gutters, larger monospace metadata/navigation, underlined links, 44px minimum navigation/footer target dimensions, and readable captions. Serif headings and the original dark/warm-white/yellow palette remain. No web fonts or client scripts are added.

Fixed the writing archive's skipped h2 level, made code blocks focusable named scroll regions, labeled keyboard-scrollable tables, strengthened focus indicators, and selected github-dark-high-contrast syntax colors. Empty previous/next article navigation is omitted. Build-time image metadata reserves local upload/asset dimensions for Markdown images, HTML figures, and covers without editing source articles. Explicit authored dimensions are retained.

`npm.cmd run test:accessibility` launches installed Chrome headlessly against a temporary built article, then removes fixtures and rebuilds the real site. Set `CHROME_PATH` to another Chrome/Chromium executable if needed. No automation dependency is required. Test artifacts and screenshots are in ignored `.qa/`.

Chrome passed 41 layout/contrast cases:

- Homepage, writing archive, temporary article, and 404 at 320, 375, 430, 768, 1024, 1440, and 1920px (28 cases).
- The same four pages with 200% root font sizing at 320, 768, and 1440px (12 cases).
- Article reflow at 320 CSS pixels with 1.5 line height, .12em letter spacing, .16em word spacing, and 2em paragraph spacing overrides (one case). 320 CSS pixels represents the available layout width of a 1280px viewport at 400% zoom; actual native browser zoom remains a manual check.

No page-level horizontal scrolling was found. Reading columns were centered within the usable viewport (excluding the browser scrollbar), with equal gutters and left-aligned text. Portrait and landscape images loaded with descriptive alt text, stayed within the column, retained aspect ratios, and reserved intrinsic space. Long code lines scroll within their focused region. Heading order, meaningful link names, navigation touch targets, language bs, rendered foreground/background contrast (including syntax tokens), and zero client scripts were checked.

Keyboard tests covered visible skip links focusing main, Tab order through the wordmark and both navigation links, Enter navigation to the archive, visible code focus, and arrow-key code scrolling. Chrome's accessibility tree exposed the main landmark and named code region. Reduced-motion emulation retained automatic scrolling. There are no form controls to audit.

Contrast ratios on #17191b: body #deded8 = 13.05:1; metadata #a5aaa5 = 7.46:1; accent/focus #f2d46b = 12.09:1. The old code comment color #6a737d on #24292e was 3.05:1; the new theme passed rendered contrast tests. Calculations use the WCAG relative-luminance formula and unrounded pass thresholds. See [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

Mobile homepage and desktop article screenshots were visually inspected. Image-path/metadata tests passed (eight tests), along with the publishing/draft smoke test. Final build, generated-output verification, and Astro checks passed.

Remaining manual work: screen readers (NVDA/VoiceOver), physical touch devices, Firefox/Safari, native zoom, and author review of future article alt text, captions, and heading structure. External images should include known width/height to reserve loading space; their dimensions are deliberately not fetched remotely during a build. No axe/Lighthouse audit was run and no Core Web Vitals or complete WCAG-conformance claim is made.

Changed files for this review: `src/styles/global.css`, `src/components/PostList.astro`, `src/pages/writing/index.astro`, `src/pages/writing/[...slug].astro`, `astro.config.mjs`, `scripts/media-paths.mjs`, `scripts/reading-images.mjs`, `scripts/reading-images.test.mjs`, `scripts/accessibility-browser.mjs`, `package.json`, `README.md`, and `docs/VALIDATION.md`. Article sources, dates, slugs, Pages CMS configuration, and deployment workflow remain unchanged.
