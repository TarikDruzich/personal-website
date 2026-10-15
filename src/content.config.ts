import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
const optionalText = () => z.preprocess((value) => value === '' || value === null ? undefined : value, z.string().optional());
const optionalDate = () => z.preprocess((value) => value === '' || value === null ? undefined : value, z.coerce.date().optional());

const posts = defineCollection({
  // Uploaded files can change without Markdown changing. Re-render on each sync
  // so cached HTML never keeps an obsolete image hash or missing variants.
  loader: {
    name: 'posts-with-uploaded-images',
    async load(context) {
      context.store.clear();
      await glob({ pattern: '**/*.md', base: './src/content/posts' }).load(context);
    },
  },
  schema: z.object({
    title: z.string().min(1), description: z.string().min(1),
    date: z.preprocess((value) => value === '' || value === null ? undefined : value, z.coerce.date()),
    time: z.preprocess((value) => value === '' || value === null ? undefined : value, z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional()),
    updated: optionalDate(),
    category: z.string().min(1).default('Bilješke'), tags: z.preprocess((value) => value ?? [], z.array(z.string())),
    draft: z.boolean().default(true),
    cover: optionalText(), coverAlt: optionalText(), coverCaption: optionalText(),
  }).refine((p) => !p.cover || Boolean(p.coverAlt?.trim()), { message: 'Naslovna slika mora imati opis (coverAlt).' }),
});
export const collections = { posts };
