import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { imageMetadata } from 'astro/assets/utils';
import { mediaUrl } from './media-url.mjs';
import { optimizedImage } from './optimized-images.mjs';

export async function localImageDimensions(src, base = '/', publicDir = 'public') {
  src = mediaUrl(src, base);
  if (typeof src !== 'string' || !src.startsWith('/') || src.startsWith('//')) return undefined;
  const prefix = base.replace(/\/$/, '');
  let path = src;
  if (prefix && path.startsWith(`${prefix}/`)) path = path.slice(prefix.length);
  if (!/^\/(uploads|assets)\//.test(path)) return undefined;
  try {
    const root = resolve(publicDir);
    const file = resolve(root, `.${decodeURIComponent(path.split(/[?#]/)[0])}`);
    if (!file.startsWith(`${root}${sep}`)) return undefined;
    const { width, height } = await imageMetadata(await readFile(file), file);
    return { width, height };
  } catch { return undefined; }
}

export function readingImages({ base = '/', publicDir = 'public' } = {}) {
  return async (tree) => {
    let seenImage = false;
    // Conservatively eager-load an image in the opening two blocks, including
    // a raw HTML figure. Everything farther into the article remains lazy.
    const opening = new Set(tree.children?.filter(n => n.type !== 'text' || n.value.trim()).slice(0, 2));
    async function properties(props, nearTop) {
      const authoredWidth = props.width;
      const src = props.src;
      const size = await localImageDimensions(src, base, publicDir);
      if (!props.width && !props.height && size) Object.assign(props, size);
      else if (size && props.width && !props.height) props.height = Math.round(Number(props.width) * size.height / size.width);
      else if (size && props.height && !props.width) props.width = Math.round(Number(props.height) * size.width / size.height);
      const image = !props.srcSet && !props.sizes && await optimizedImage(src, base, publicDir);
      if (image) {
        props.src = image.src;
        props.srcSet = image.srcset;
        props.sizes = authoredWidth ? `min(${Number(authoredWidth)}px, 70ch, calc(100vw - clamp(32px, 8vw, 64px)))` : image.sizes;
        if (props.width && props.height && !/aspect-ratio\s*:/.test(props.style ?? '')) props.style = `${props.style ?? ''};aspect-ratio:${props.width} / ${props.height}`;
      }
      if (!seenImage && nearTop && (!props.loading || props.loading === 'lazy')) props.loading = 'eager';
      else props.loading ??= 'lazy';
      props.decoding ??= 'async';
      seenImage = true;
    }
    const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
    async function rawImages(value, nearTop) {
      const matches = [...value.matchAll(/<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)];
      const replacements = [];
      for (const match of matches) {
        const tag = match[0];
        const props = {};
        for (const name of ['src', 'width', 'height', 'loading', 'decoding', 'sizes', 'style']) props[name] = attribute(tag, name);
        props.srcSet = attribute(tag, 'srcset');
        const original = { ...props };
        await properties(props, nearTop);
        let updated = tag;
        for (const [key, value] of Object.entries(props)) {
          if (value === undefined || value === original[key]) continue;
          const name = key === 'srcSet' ? 'srcset' : key;
          const pattern = new RegExp(`(\\s${name}\\s*=\\s*)(["']).*?\\2`, 'i');
          if (pattern.test(updated)) updated = updated.replace(pattern, () => ` ${name}="${escape(value)}"`);
          else updated = updated.replace(/\s*\/?\s*>$/, ending => ` ${name}="${escape(value)}"${ending}`);
        }
        replacements.push({ match, updated });
      }
      for (const {match, updated} of replacements.reverse()) value = value.slice(0, match.index) + updated + value.slice(match.index + match[0].length);
      return value;
    }
    async function visit(node, nearTop = false) {
      if (node.type === 'element' && node.tagName === 'img') await properties(node.properties, nearTop);
      if (node.type === 'raw') node.value = await rawImages(node.value, nearTop);
      for (const child of node.children ?? []) await visit(child, nearTop || opening.has(child));
    }
    await visit(tree);
  };
}
