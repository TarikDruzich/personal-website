# Content reset

All three formerly published Markdown articles were moved intact from `src/content/posts/` to `archive/private-posts/`. Original migration sources remain in `archive/legacy/`. The three files in `archive/private-posts/` are tracked by Git and outside the public build and content loader. Other legacy material is still ignored. This is a source-only archive, not a confidentiality guarantee: a public repository exposes the Markdown sources. Verification checks exact casing, Git tracking, and SHA-256 integrity with only line endings normalized.

Their `/writing/` routes and all `/blog/posts/` compatibility routes are removed. Categories, projects, biography, and current-activity pages are removed. The public collection starts empty; new writing retains the existing article URL format.
