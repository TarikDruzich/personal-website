import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { imageMetadata } from 'astro/assets/utils';
import { mediaUrl } from './media-url.mjs';

// Public uploads remain unchanged; only generated HTML receives intrinsic dimensions.
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
  } catch {
    // Unknown formats and missing files remain subject to generated-output verification.
    return undefined;
  }
}

export function readingImages({ base = '/', publicDir = 'public' } = {}) {
  return async (tree) => {
    const pending = [];
    const cache = new Map();
    const dimensions = (src) => {
      if (!cache.has(src)) cache.set(src, localImageDimensions(src, base, publicDir));
      return cache.get(src);
    };
    const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
    async function rawImages(value) {
      const matches = [...value.matchAll(/<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)];
      // Work backwards to keep offsets stable as attributes are added.
      for (const match of matches.reverse()) {
        const tag = match[0];
        let additions = '';
        if (!/\s(?:width|height)\s*=/i.test(tag)) {
          const size = await dimensions(attribute(tag, 'src'));
          if (size) additions += ` width="${size.width}" height="${size.height}"`;
        }
        if (!/\sloading\s*=/i.test(tag)) additions += ' loading="lazy"';
        if (!/\sdecoding\s*=/i.test(tag)) additions += ' decoding="async"';
        const updated = tag.replace(/\s*\/?\s*>$/, (ending) => additions + ending);
        value = value.slice(0, match.index) + updated + value.slice(match.index + tag.length);
      }
      return value;
    }
    function visit(node) {
      if (node.type === 'element' && node.tagName === 'img') {
        const props = node.properties;
        if (!props.width && !props.height) pending.push(dimensions(props.src).then((size) => { if (size) Object.assign(props, size); }));
      }
      if (node.type === 'raw') pending.push(rawImages(node.value).then((value) => { node.value = value; }));
      node.children?.forEach(visit);
    }
    visit(tree);
    await Promise.all(pending);
  };
}
