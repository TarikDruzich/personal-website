#!/usr/bin/env python3
from datetime import datetime
from html import escape
from pathlib import Path
import re

import markdown

ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "blog" / "md"
OUTPUT_DIR = ROOT / "blog" / "posts"
INDEX_FILE = ROOT / "index.html"

START_MARKER = "<!-- AUTO_POSTS_START -->"
END_MARKER = "<!-- AUTO_POSTS_END -->"
GENERATED_MARKER = "<!-- GENERATED_FROM_MARKDOWN -->"


def read_post(path: Path):
    text = path.read_text(encoding="utf-8")

    if not text.startswith("---\n"):
        raise ValueError(f"{path}: post mora početi sa --- front matter blokom")

    try:
        front_matter, body = text[4:].split("\n---\n", 1)
    except ValueError as exc:
        raise ValueError(f"{path}: nedostaje završni ---") from exc

    meta = {}
    for line in front_matter.splitlines():
        line = line.strip()
        if not line:
            continue
        key, separator, value = line.partition(":")
        if not separator:
            raise ValueError(f"{path}: neispravna metadata linija: {line}")
        meta[key.strip().lower()] = value.strip().strip('"').strip("'")

    now = datetime.now()
    changed = False

    if not meta.get("date"):
        meta["date"] = now.strftime("%Y-%m-%d")
        changed = True

    if not meta.get("time"):
        meta["time"] = now.strftime("%H:%M")
        changed = True

    if not meta.get("slug"):
        meta["slug"] = path.stem
        changed = True

    required = ("title", "description", "image", "alt")
    missing = [key for key in required if not meta.get(key)]
    if missing:
        raise ValueError(f"{path}: nedostaje: {', '.join(missing)}")

    if not re.fullmatch(r"[a-zA-Z0-9_-]+", meta["slug"]):
        raise ValueError(
            f"{path}: slug smije sadržati samo slova bez kvačica, brojeve, - i _"
        )

    try:
        published = datetime.strptime(
            f"{meta['date']} {meta['time']}", "%Y-%m-%d %H:%M"
        )
    except ValueError as exc:
        raise ValueError(
            f"{path}: date mora biti YYYY-MM-DD, a time HH:MM"
        ) from exc

    if changed:
        write_metadata_back(path, meta, body)

    return meta, body.strip(), published


def write_metadata_back(path: Path, meta: dict, body: str):
    ordered_keys = ("title", "description", "image", "alt", "date", "time", "slug")
    lines = ["---"]
    for key in ordered_keys:
        if meta.get(key):
            lines.append(f"{key}: {meta[key]}")
    lines += ["---", "", body.rstrip(), ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def root_relative_image_for_post(image: str) -> str:
    clean = image.strip().lstrip("/")
    if clean.startswith("./"):
        clean = clean[2:]
    return "../../" + clean


def display_datetime(published: datetime) -> str:
    return published.strftime("%d.%m.%Y · %H:%M")


def iso_datetime(published: datetime) -> str:
    return published.strftime("%Y-%m-%dT%H:%M")


def render_post(meta: dict, body: str, published: datetime) -> str:
    content = markdown.markdown(
        body,
        extensions=["fenced_code", "tables", "sane_lists"],
    )

    title = escape(meta["title"])
    description = escape(meta["description"])
    alt = escape(meta["alt"])
    image = escape(root_relative_image_for_post(meta["image"]), quote=True)

    return f'''<!DOCTYPE html>
{GENERATED_MARKER}
<html lang="bs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="{description}">
    <title>{title} · Tarik Druzich</title>
    <link rel="stylesheet" href="../../style.css">
</head>
<body>
    <header class="article-site-header">
        <a class="site-name" href="../../index.html">Tarik Druzich</a>
    </header>

    <main>
        <article>
            <div class="post-cover-wrap">
                <img class="post-cover" src="{image}" alt="{alt}">
            </div>

            <div class="post-heading">
                <h1>{title}</h1>
                <time class="publication-date" datetime="{iso_datetime(published)}">
                    {display_datetime(published)}
                </time>
            </div>

            <div class="post-body">
{content}
            </div>
        </article>

        <div class="post-links">
            <a href="../../index.html">← Nazad na blog</a>
        </div>
    </main>
</body>
</html>
'''


def render_index_entry(meta: dict, published: datetime) -> str:
    title = escape(meta["title"])
    description = escape(meta["description"])
    slug = escape(meta["slug"], quote=True)

    return f'''            <li lang="bs">
                <time class="publication-date" datetime="{iso_datetime(published)}">
                    {display_datetime(published)}
                </time>

                <h3>
                    <a href="blog/posts/{slug}.html">{title}</a>
                </h3>

                <p>{description}</p>
            </li>'''


def update_index(posts):
    index = INDEX_FILE.read_text(encoding="utf-8")

    if START_MARKER not in index or END_MARKER not in index:
        raise ValueError(
            "index.html nema AUTO_POSTS markere. Dodaj ih unutar <ul class=\"post-list\">."
        )

    before, rest = index.split(START_MARKER, 1)
    _, after = rest.split(END_MARKER, 1)

    entries = "\n\n".join(
        render_index_entry(meta, published)
        for meta, _, published in sorted(posts, key=lambda item: item[2], reverse=True)
    )

    replacement = START_MARKER + "\n"
    if entries:
        replacement += entries + "\n"
    replacement += "            " + END_MARKER

    INDEX_FILE.write_text(before + replacement + after, encoding="utf-8")


def remove_stale_generated_posts(generated_names):
    for html_file in OUTPUT_DIR.glob("*.html"):
        if html_file.name in generated_names:
            continue
        try:
            prefix = html_file.read_text(encoding="utf-8")[:300]
        except UnicodeDecodeError:
            continue
        if GENERATED_MARKER in prefix:
            html_file.unlink()
            print(f"Obrisan stari generisani post: {html_file.relative_to(ROOT)}")


def main():
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    source_files = sorted(SOURCE_DIR.glob("*.md"))
    posts = []
    generated_names = set()

    for source in source_files:
        meta, body, published = read_post(source)
        output = OUTPUT_DIR / f"{meta['slug']}.html"
        output.write_text(render_post(meta, body, published), encoding="utf-8")
        generated_names.add(output.name)
        posts.append((meta, body, published))
        print(f"Generisan: {output.relative_to(ROOT)}")

    remove_stale_generated_posts(generated_names)
    update_index(posts)
    print(f"Ažuriran: {INDEX_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
