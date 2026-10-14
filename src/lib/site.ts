import { getCollection, type CollectionEntry } from 'astro:content';
export const site = { name: 'Tarik Družić', description: 'Zapisujem šta mi padne na pamet.' };
export const url = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
export const articleUrl = (post: CollectionEntry<'posts'>) => url(`writing/${post.id}/`);
export const publicationKey = (post: CollectionEntry<'posts'>) => `${post.data.date.toISOString().slice(0, 10)}T${post.data.time || '00:00'}`;
export async function publishedPosts() {
  return (await getCollection('posts', ({ data }) => !data.draft)).sort((a, b) => publicationKey(b).localeCompare(publicationKey(a)) || a.id.localeCompare(b.id));
}
export const formatDate = (date: Date) => new Intl.DateTimeFormat('bs-BA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
export const readingTime = (body = '') => Math.max(1, Math.ceil(body.replace(/<[^>]*>|[`#*_>]/g, '').split(/\s+/).filter(Boolean).length / 200));
