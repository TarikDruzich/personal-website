// Normalize known local media without changing remote images or article source.
export function mediaUrl(value, base = '/') {
  if (typeof value !== 'string') return value;
  let path = value;
  if (/^https?:\/\//i.test(path)) {
    const absolute = new URL(path);
    if (!['tarikdruzich.xyz', 'www.tarikdruzich.xyz', 'tarikdruzich.github.io'].includes(absolute.hostname)) return value;
    path = absolute.pathname + absolute.search + absolute.hash;
    if (absolute.hostname === 'tarikdruzich.github.io' && !path.startsWith('/personal-website/')) return value;
  } else if (/^(?:\/\/|[a-z][a-z\d+.-]*:)/i.test(path)) return value;
  const prefix = base.replace(/^\/+|\/+$/g, '');
  path = path.replace(/\/{2,}/g, '/');
  // Accept CMS-relative paths as well as old project-prefixed paths.
  path = path.replace(/^(?:\.\.?\/)+/, '').replace(/^\/?(?:personal-website\/)+/, '');
  if (prefix && path.startsWith(`/${prefix}/`)) path = path.slice(prefix.length + 1);
  path = path.replace(/^\//, '');
  if (!/^(?:uploads|assets)\//.test(path)) return value;
  return `${prefix ? `/${prefix}` : ''}/${path}`;
}
