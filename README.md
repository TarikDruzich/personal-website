# Tarik Družić

Minimal Bosnian personal blog built with Astro. Main pages: `/` and `/writing/`; published articles use `/writing/[slug]/`. RSS, sitemap, SEO metadata, and Markdown rendering are retained.

## Development

Use Node 24. Run `npm.cmd ci`, `npm.cmd run dev`, `npm.cmd run check`, `npm.cmd run build`, and `npm.cmd run verify`. `npm.cmd run test:content` temporarily exercises publishing and drafts, removes its fixtures, and restores the real build.

The default base is `/personal-website/`. `SITE_URL` and `BASE_PATH` configure a custom domain. Build output is `dist/`.

## Writing with Pages CMS

Select this repository and `redesign-astro` in Pages CMS. The article editor is configured in `.pages.yml`; media uploads go to `public/uploads/`.

Create a Markdown entry in **Tekstovi**, choose a permanent filename, enter title, description, and date, and write the body. Category defaults to Bilješke; tags, time, updated date, and cover are optional. Covers require descriptive alt text. Keep **Nacrt** enabled while writing; disable it to publish. Missing draft flags also default to unpublished. Published posts sort newest first by date and optional time.

Markdown files live in `src/content/posts/`. No sample articles are included. Drafts are excluded from pages, RSS, and sitemap. Pages CMS authentication and live saves require account testing.

## Local archive

The three removed articles' complete current Markdown files are preserved in `archive/private-posts/`. Earlier source material remains in `archive/legacy/`. The entire archive is Git-ignored and outside Astro content and public directories. Keep a local backup; the archive is neither deployed nor included in future source commits. Old article URLs and redirects have been removed.

## Deployment

The existing GitHub Actions workflow checks, builds, verifies, and deploys pushes to `redesign-astro`. No push or merge has been performed. Review and approve changes before pushing.
