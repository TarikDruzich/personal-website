# Tarik Družić

Minimal Bosnian personal blog built with Astro. Main pages: `/` and `/writing/`; published articles use `/writing/[slug]/`. RSS, sitemap, SEO metadata, and Markdown rendering are retained.

## Development

Use Node 24. Run `npm.cmd ci`, `npm.cmd run dev`, `npm.cmd run check`, `npm.cmd run build`, and `npm.cmd run verify`. `npm.cmd run test:content` temporarily exercises publishing and drafts, removes its fixtures, and restores the real build.

The default base is `/personal-website/`. `SITE_URL` and `BASE_PATH` configure a custom domain. Build output is `dist/`.

## Writing with Pages CMS

Select this repository and `main` in Pages CMS. The article editor is configured in `.pages.yml`; media uploads go to `public/uploads/`.

Create a Markdown entry in **Tekstovi**, choose a permanent filename, enter title, description, and date, and write the body. Category defaults to Bilješke; tags, time, updated date, and cover are optional. Covers require descriptive alt text. Keep **Nacrt** enabled while writing; disable it to publish. Missing draft flags also default to unpublished. Published posts sort newest first by date and optional time.

Markdown files live in `src/content/posts/`. No sample articles are included. Drafts are excluded from pages, RSS, and sitemap. Pages CMS authentication and live saves require account testing.

## Source-only archive

The three removed articles' complete current Markdown files are preserved in `archive/private-posts/`. Earlier source material remains in `archive/legacy/`. The three Markdown files in `archive/private-posts/` are tracked by Git and outside Astro content and public directories. They are included in source checkouts, but never deployed. The directory name does not imply repository privacy: anyone with repository access can read these files. Other legacy material remains local and Git-ignored. Verification checks exact path casing, Git tracking, content hashes (ignoring CRLF versus LF), and build exclusion. Old article URLs and redirects have been removed.

## Deployment

The existing GitHub Actions workflow checks, builds, verifies, and deploys pushes to `main`. No push or merge has been performed. Review and approve changes before pushing.

## Insert images in Pages CMS

1. Open this repository on **main** in Pages CMS, then open **Tekstovi** and the article.
2. In **Tekst**, select **Editor** mode. Place the cursor on a new paragraph between the paragraphs where the image belongs.
3. Use the editor's image insertion control, then select an existing image or upload a new one from the media picker. The **Slike** source stores uploads in `public/uploads/`; safe renaming removes awkward filename characters. Repeat at any other cursor position for additional images.
4. Use **Source** mode to check or edit the image's descriptive alt text. The saved Markdown should look like `![Pogled na rijeku u Sarajevu](/uploads/rijeka.jpg)`. Keep the path portable: do not add `/public`, `/personal-website`, or the domain.
5. For an optional caption, use Source mode and replace the image line with a figure (blank lines before and after):

```html
<figure>
  <img src="/uploads/rijeka.jpg" alt="Pogled na rijeku u Sarajevu" />
  <figcaption>Miljacka nakon kiše.</figcaption>
</figure>
```

Keep HTML figures in Source mode when editing captions; switching visual editors can normalize raw HTML. A Markdown image title is a tooltip, not a visible caption. Covers are optional and separate from inline images. Keep **Nacrt** enabled until ready, then disable it and save to publish. Media uploads themselves are public assets even when their article is a draft.

Configuration uses the supported [rich-text options](https://pagescms.org/docs/configuration/fields/rich-text/) and [media sources](https://pagescms.org/docs/configuration/media/). The Astro unified rehype plugin prefixes local upload paths once at build time. External URLs are unchanged. Existing aspect-ratio and responsive image styles apply to all article images. The authenticated CMS picker/save flow still needs testing in your account.

## Custom domain later

Set GitHub repository Actions variables `SITE_URL` to the HTTPS origin (for example `https://example.com`) and `BASE_PATH` to `/`. Configure the custom domain and DNS in GitHub Pages; add `public/CNAME` if required by that setup. No changes to `.pages.yml` or portable `/uploads/` article paths are needed. Rebuild and verify after changing these variables. Already-prefixed paths are tolerated on the current site, but use portable paths in saved content to avoid needing edits when the base changes.

Run `npm.cmd run test:images` for renderer/path tests. `npm.cmd run test:content` tests inline Markdown images, figures, covers, other Markdown features, and draft transitions in real article builds, cleaning up its temporary fixtures afterward.

## Reading layout and accessibility checks

Typography and responsive styles live in `src/styles/global.css`. The site uses system fonts, serif headings, 18px desktop / 17px mobile article text, 1.75 line spacing, a centered 70ch measure, and larger monospace navigation/metadata. Local article images receive build-time dimensions using [Astro imageMetadata](https://docs.astro.build/en/reference/modules/astro-assets/#imagemetadata), reserving space before loading while preserving original image files and authored dimensions. For external images, specify known width and height in HTML when possible.

`npm.cmd run test:accessibility` runs headless Chrome viewport, contrast, text-resizing, image, and keyboard tests with a temporary article; it removes fixtures and restores the production build. Set `CHROME_PATH` if Chrome is installed elsewhere. `npm.cmd run test:images` covers portable media paths and intrinsic dimensions. No client-side scripts or extra frontend dependencies are required. Recorded results and manual verification limits are in [docs/VALIDATION.md](docs/VALIDATION.md).
