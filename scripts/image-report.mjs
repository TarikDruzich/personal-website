import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { optimizedImage } from './optimized-images.mjs';

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}
const report = [];
for (const file of await files('public/uploads')) {
  const src = '/' + file.slice('public/'.length).replaceAll('\\', '/');
  const image = await optimizedImage(src);
  if (!image) continue;
  report.push({ source: src, originalBytes: image.originalBytes, width: image.width, height: image.height,
    variants: image.variants.map(v => ({ width:v.width, bytes:v.bytes, format:v.name.split('.').at(-1), savingsPercent:Number((100*(1-v.bytes/image.originalBytes)).toFixed(2)) })),
    // Estimates use CSS pixels, no scrollbar, and an upper-bound 790px column.
    // Browsers may choose differently based on density, caching and data-saving.
    estimatedTransfers: [320,375,430,768,1024,1440,1920].map(viewport => {
      const displayWidth = Math.min(image.width,790,viewport - Math.min(64,Math.max(32,viewport*.08)));
      const choose = dpr => { const v = image.variants.find(v => v.width >= displayWidth*dpr) ?? image.variants.at(-1); return {width:v.width,bytes:v.bytes}; };
      return { viewport, dpr1:choose(1), dpr2:choose(2) };
    }) });
}
await mkdir('.qa', {recursive:true});
await writeFile('.qa/image-sizes.json', JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
