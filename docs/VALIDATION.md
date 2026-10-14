# Validation

The output verifier checks the homepage, writing archive, error page, RSS, sitemap, SEO metadata, internal links and assets, exactly two navigation links, empty states, and absence of removed routes and archived articles. Draft exclusion is checked for every current Markdown source. Archived articles must exist with exact directory/filename casing, be tracked by Git, and match recorded SHA-256 hashes after CRLF-to-LF normalization. Their routes and slug references must remain absent from generated output.

The content smoke test creates temporary published and draft entries, checks article rendering, media, metadata, and publish-to-draft removal, then removes all fixtures and restores the empty production build.

Live Pages CMS authorization, GitHub Actions, and deployment require account testing. No push or merge is part of this local change.
