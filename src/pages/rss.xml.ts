import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { publishedPosts, articleUrl, site, url } from '../lib/site';
export async function GET(context: APIContext) {
  const posts = await publishedPosts();
  return rss({ title: site.name, description: site.description, site: new URL(url(), context.site!), items: posts.map((p) => ({ title: p.data.title, description: p.data.description, pubDate: p.data.date, link: articleUrl(p), categories: [p.data.category, ...p.data.tags] })), customData: '<language>bs</language>' });
}
