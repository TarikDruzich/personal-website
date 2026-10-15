import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { mediaUrl } from './media-url.mjs';

const cache = new Map();
// Match .shell: 70ch with gutters clamped between 16px and 32px.
export const imageSizes = 'min(70ch, calc(100vw - clamp(32px, 8vw, 64px)))';

// Content-addressed output deduplicates identical uploads, including renamed files.
export async function optimizedImage(src, base = '/', publicDir = 'public') {
  const normalized = mediaUrl(src, base);
  if (typeof normalized !== 'string') return undefined;
  const prefix = base.replace(/\/$/, '');
  const path = prefix && normalized.startsWith(`${prefix}/`) ? normalized.slice(prefix.length) : normalized;
  if (!/^\/(uploads|assets)\//.test(path)) return undefined;
  const root = resolve(publicDir);
  let file;
  try { file = resolve(root, `.${decodeURIComponent(path.split(/[?#]/)[0])}`); }
  catch { return undefined; }
  if (!file.startsWith(root + sep)) return undefined;
  let input;
  try { input = await readFile(file); } catch { return undefined; }
  if (!input.length) return undefined;
  const hash = createHash('sha256').update('lossless-responsive-v1').update(input).digest('hex').slice(0, 24);
  const key = `${root}:${prefix}:${hash}`;
  if (!cache.has(key)) cache.set(key, (async () => {
    const directory = resolve(root, '_optimized');
    const manifestDir = resolve(root, '../.astro/image-manifests');
    const manifestPath = resolve(manifestDir, `${hash}.json`);
    try {
      const saved = JSON.parse(await readFile(manifestPath, 'utf8'));
      await Promise.all(saved.variants.map(v => access(resolve(directory, v.name))));
      return { ...saved, variants: saved.variants.map(v => ({ ...v, src: `${prefix}/_optimized/${v.name}` })) };
    } catch { /* First build or generated files removed: regenerate from originals. */ }
    const metadata = await sharp(input).metadata().catch(() => ({}));
    const { width, height, format, pages = 1 } = metadata;
    if (!width || !height || pages > 1 || !['png', 'jpeg', 'webp'].includes(format) || metadata.orientation > 1) return undefined;
    const widths = [...new Set([320, 480, 640, 800, 1200, 1600, width].filter(w => w <= width))].sort((a,b) => a-b);
    await mkdir(directory, { recursive: true });
    const variants = [];
    for (const w of widths) {
      const pipeline = sharp(input).resize({ width: w, withoutEnlargement: true });
      // Lossless conversion protects screenshot text and exact alpha values.
      const webp = await pipeline.clone().webp({ lossless: true, effort: 6 }).toBuffer();
      const fallback = w === width ? input : await (format === 'png' ? pipeline.clone().png() : format === 'jpeg' ? pipeline.clone().jpeg({ quality: 90 }) : pipeline.clone().webp({ lossless: true })).toBuffer();
      const useWebp = webp.length < fallback.length;
      const data = useWebp ? webp : fallback;
      const extension = useWebp ? 'webp' : format === 'jpeg' ? 'jpg' : format;
      const name = `${hash}-${w}.${extension}`;
      await writeFile(resolve(directory, name), data);
      variants.push({ width: w, bytes: data.length, name, src: `${prefix}/_optimized/${name}` });
    }
    const result = { width, height, originalBytes: input.length, variants };
    await mkdir(manifestDir, { recursive: true });
    await writeFile(manifestPath, JSON.stringify(result));
    return result;
  })());
  const result = await cache.get(key);
  if (!result) return undefined;
  // Resizing screenshot text can increase lossless entropy. Omit any smaller
  // candidate that costs at least as many bytes as a larger candidate.
  const variants = result.variants.filter((v, i, all) => !all.slice(i + 1).some(larger => larger.bytes <= v.bytes));
  return { ...result, variants, src: variants.at(-1).src, srcset: variants.map(v => `${v.src} ${v.width}w`).join(', '), sizes: imageSizes };
}
