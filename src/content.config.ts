import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
const optionalText = () => z.preprocess((value) => value === '' || value === null ? undefined : value, z.string().optional());
const optionalDate = () => z.preprocess((value) => value === '' || value === null ? undefined : value, z.coerce.date().optional());

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
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
